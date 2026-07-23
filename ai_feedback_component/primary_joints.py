import json
import numpy as np

SMOOTH_WINDOW = 10
TOP_K_RATIO = 0.4


# --------------------------------------------------------
# Helpers
# --------------------------------------------------------

def moving_average(data, window):
    smoothed = []
    for i in range(len(data)):
        start = max(0, i - window + 1)
        smoothed.append(np.mean(data[start:i+1], axis=0))
    return np.array(smoothed)


def rank_normalize(values):
    """
    Converts values into [0,1] based on their rank instead of magnitude.

    Makes the algorithm adapt automatically to every exercise.
    """
    order = np.argsort(values)
    ranks = np.empty_like(order, dtype=float)
    ranks[order] = np.arange(len(values))

    if len(values) == 1:
        return np.ones_like(values)

    return ranks / (len(values) - 1)


# --------------------------------------------------------
# Loading
# --------------------------------------------------------

def load_json(input_path):

    with open(input_path) as f:
        data = json.load(f)

    frames = data["frames"]

    joint_names = list(frames[0]["angles"].keys())

    angle_matrix = []

    for frame in frames:

        angle_matrix.append([
            frame["angles"].get(j)
            if frame["angles"].get(j) is not None
            else np.nan
            for j in joint_names
        ])

    angle_matrix = np.asarray(angle_matrix, dtype=float)

    # interpolate missing angles

    for c in range(angle_matrix.shape[1]):

        col = angle_matrix[:, c]

        if np.all(np.isnan(col)):
            angle_matrix[:, c] = 0
            continue

        mask = ~np.isnan(col)

        angle_matrix[:, c] = np.interp(
            np.arange(len(col)),
            np.where(mask)[0],
            col[mask]
        )

    frame_idx = np.array([f["frameIndex"] for f in frames])

    dt = np.diff(frame_idx).reshape(-1, 1)
    dt[dt == 0] = 1

    velocities = np.diff(angle_matrix, axis=0) / dt
    velocities = np.vstack([np.zeros((1, velocities.shape[1])), velocities])

    return joint_names, angle_matrix, velocities


# --------------------------------------------------------
# Metrics
# --------------------------------------------------------

def compute_rom(angle_matrix):
    return np.max(angle_matrix, axis=0) - np.min(angle_matrix, axis=0)


def compute_energy(velocities):
    return np.sum(np.abs(velocities), axis=0)


def compute_activity(velocities):
    """
    Percentage of frames where the joint is moving.
    Adaptive threshold.
    """

    threshold = np.percentile(np.abs(velocities), 70)

    active = np.abs(velocities) > threshold

    return active.mean(axis=0)


def compute_periodicity(velocities):

    scores = []

    for j in range(velocities.shape[1]):

        signal = velocities[:, j]

        signal = signal - np.mean(signal)

        fft = np.abs(np.fft.rfft(signal))

        fft[0] = 0

        if fft.sum() == 0:
            scores.append(0)
        else:
            scores.append(fft.max() / fft.sum())

    return np.array(scores)


def compute_smoothness(angle_matrix):
    """
    Smoothness is NOT importance.

    It becomes a confidence multiplier.
    """

    smoothed = moving_average(angle_matrix, 7)

    signal = np.var(smoothed, axis=0)
    noise = np.var(angle_matrix - smoothed, axis=0)

    snr = signal / (noise + 1e-6)

    return snr


# --------------------------------------------------------
# Scoring
# --------------------------------------------------------

def compute_scores(angle_matrix, velocities):

    rom = compute_rom(angle_matrix)

    energy = compute_energy(velocities)

    activity = compute_activity(velocities)

    periodicity = compute_periodicity(velocities)

    smoothness = compute_smoothness(angle_matrix)

    rom = rank_normalize(rom)
    energy = rank_normalize(energy)
    activity = rank_normalize(activity)
    periodicity = rank_normalize(periodicity)
    smoothness = smoothness # rank_normalize(smoothness)

    importance = (
        0.35 * energy +
        0.30 * periodicity +
        0.20 * activity +
        0.15 * rom
    )

    confidence = smoothness

    final_score = importance * (0.5 + 0.5 * confidence)

    return {
        "score": final_score,
        "importance": importance,
        "confidence": confidence,
        "rom": rom,
        "energy": energy,
        "activity": activity,
        "periodicity": periodicity,
        "smoothness": smoothness
    }


# --------------------------------------------------------
# Selection
# --------------------------------------------------------

def select_joints(scores, joint_names):

    K = max(2, int(len(joint_names) * TOP_K_RATIO))

    idx = np.argsort(scores)[::-1][:K]

    return [joint_names[i] for i in idx]


# --------------------------------------------------------
# Main
# --------------------------------------------------------

def generate_primary_joints(video_file, json_dir):

    input_json = json_dir / "angles.json"
    output_json = json_dir / "imp-joints.json"

    joint_names, angles, velocities = load_json(input_json)

    velocities = moving_average(velocities, SMOOTH_WINDOW)

    metrics = compute_scores(angles, velocities)

    selected = select_joints(metrics["score"], joint_names)

    print(f"\nPrimary joints for {video_file}")

    order = np.argsort(metrics["score"])[::-1]

    for i in order:

        print(
            f"{joint_names[i]:20}"
            f" Score={metrics['score'][i]:.3f}"
            f" Energy={metrics['energy'][i]:.2f}"
            f" Periodicity={metrics['periodicity'][i]:.2f}"
            f" Activity={metrics['activity'][i]:.2f}"
            f" ROM={metrics['rom'][i]:.2f}"
            f" Smooth={metrics['smoothness'][i]:.2f}"
        )

    with open(output_json, "w") as f:

        json.dump(
            {
                "primary_joints": selected
            },
            f,
            indent=2
        )

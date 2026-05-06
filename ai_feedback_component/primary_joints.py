import json
import numpy as np
import os


VEL_THRESHOLD = 0.02
SMOOTH_WINDOW = 10
TOP_K_RATIO = 0.4

# -----------------------------
# Helpers
# -----------------------------
def moving_average(data, window):
    smoothed = []
    for i in range(len(data)):
        start = max(0, i - window + 1)
        chunk = data[start:i+1]
        smoothed.append(np.mean(chunk, axis=0))
    return np.array(smoothed)

def normalize(x):
    return x / np.sum(x) if np.sum(x) != 0 else x


def load_json_and_compute_velocity(input_path):
    """
    Parses the JSON angle schema and calculates velocity: (next - curr) / dt
    """
    with open(input_path, 'r') as f:
        data = json.load(f)

    frames = data["frames"]
    # Get joint names from the first frame
    joint_names = list(frames[0]["angles"].keys())
    
    angle_matrix = []
    for f in frames:
        angle_matrix.append([f["angles"].get(j, 0) for j in joint_names])
    angle_matrix = np.array(angle_matrix)

    # Replicate velocity logic: (val_next - val_curr) / (frame_next - frame_curr)
    frame_indices = np.array([f["frameIndex"] for f in frames])
    dt = np.diff(frame_indices).reshape(-1, 1)
    dt[dt == 0] = 1 # Avoid division by zero
    
    # Calculate velocity across all joints
    velocities = np.diff(angle_matrix, axis=0) / dt
    
    # Pad to maintain frame count (prefix with 0 velocity for frame 0)
    velocities = np.vstack([np.zeros((1, velocities.shape[1])), velocities])
    
    return joint_names, velocities


def compute_joint_scores(velocities_smooth):
    def periodicity_score(data):
        scores = []
        for j in range(data.shape[1]):
            signal = data[:, j]
            # Center signal for FFT
            fft = np.abs(np.fft.rfft(signal - np.mean(signal)))
            fft[0] = 0
            if fft.sum() == 0:
                scores.append(0)
            else:
                scores.append(fft.max() / fft.sum())
        return np.array(scores)

    # ROM (Range of Motion) in velocity space
    rom = np.max(velocities_smooth, axis=0) - np.min(velocities_smooth, axis=0)
    periodicity = periodicity_score(velocities_smooth)
    
    # Smoothness (1 / Variance of Acceleration)
    velocity_diff = np.diff(velocities_smooth, axis=0)
    smoothness = 1 / (1 + np.var(velocity_diff, axis=0))

    # Weighting: 50% Rhythm, 30% Activity, 20% Smoothness
    score = (
        0.5 * normalize(periodicity) +
        0.3 * normalize(rom) +
        0.2 * normalize(smoothness)
    )
    return score


def select_top_joints(score, joint_names):
    K = max(2, int(len(score) * TOP_K_RATIO))
    top_indices = np.argsort(score)[-K:][::-1]
    selected_names = [joint_names[i] for i in top_indices]
    return selected_names


def generate_primary_joints(base_name, data_dir="./data", mode="instructor"):
    input_json = os.path.join(data_dir, f"{base_name}-angles.json")
    important_joints_csv = os.path.join(data_dir, f"{base_name}-important-joints.csv")
    output_json = os.path.join(data_dir, f"{base_name}-imp-joints.json")

    # 1. Load and Compute
    joint_names, velocities = load_json_and_compute_velocity(input_json)
    
    # 2. Smooth
    velocities_smooth = moving_average(velocities, SMOOTH_WINDOW)

    # 3. Score
    score = compute_joint_scores(velocities_smooth)
    top_joint_names = select_top_joints(score, joint_names)

    print(f"Selected joints for {base_name}:")
    for j in top_joint_names:
        print(f"  - {j}")

    with open(output_json, "w") as f:
        json.dump({
            "primary_joints": top_joint_names,
        }, f, indent=2)

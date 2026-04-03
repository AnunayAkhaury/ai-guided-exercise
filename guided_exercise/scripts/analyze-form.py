"""
Exercise-agnostic form analysis module.

Compares Good Form and Bad Form joint angle JSON files (produced by
calculate-joint-angles.py) to detect technique deviations.

Usage:
    python analyze-form.py <good_form.json> <bad_form.json> [output.json]

Output:
    JSON written to output.json (default: bad_reps.json), sorted by timestampMs,
    each entry:
    {
        "frameIndex": int,
        "timestampMs": int,
        "rep_index": int,
        "joint": str,
        "type": "Peak" | "Valley",
        "expected_angle": float,
        "actual_angle": float,
        "diff_pct": float
    }
"""

import json
import sys
import bisect
import numpy as np
from scipy.signal import find_peaks

STATIC_ROM_THRESHOLD = 15.0   # degrees — joints with smaller ROM are ignored
PROMINENCE_FACTOR = 0.20      # fraction of ROM used as peak/valley prominence
DEVIATION_THRESHOLD = 10.0    # percent — deviations beyond this are flagged


def load_angles(path: str) -> list[dict]:
    """Load frames list from an angles JSON file."""
    with open(path, "r") as f:
        data = json.load(f)
    return data["frames"]


def _series(frames: list[dict], joint: str) -> np.ndarray:
    return np.array([f["angles"][joint] for f in frames])


def analyze_good_form(frames: list[dict]) -> dict:
    """
    Analyse the Good Form frames.

    Returns a dict keyed by joint name, each value:
    {
        "avg_peak":       float,
        "avg_valley":     float,
        "prominence":     float,
        "rom":            float,
        "rep_boundaries": list[int],   # timestampMs of each valley (primary joint only)
    }
    The "rep_boundaries" list is populated only on the primary joint (highest ROM).
    """
    joints = list(frames[0]["angles"].keys())
    timestamps = [f["timestampMs"] for f in frames]
    baseline = {}
    best_periodicity = 0
    primary_joint = None

    for joint in joints:
        series = _series(frames, joint)
        rom = float(series.max() - series.min())

        if rom < STATIC_ROM_THRESHOLD:
            continue  # static joint — skip

        prominence = PROMINENCE_FACTOR * rom
        peak_indices, _ = find_peaks(series, prominence=prominence)
        valley_indices, _ = find_peaks(-series, prominence=prominence)

        if len(peak_indices) == 0 or len(valley_indices) == 0:
            continue  # not enough signal

        avg_peak = float(series[peak_indices].mean())
        avg_valley = float(series[valley_indices].mean())

        baseline[joint] = {
            "avg_peak": avg_peak,
            "avg_valley": avg_valley,
            "prominence": prominence,
            "rom": rom,
            "valley_indices": valley_indices.tolist(),  # temp, used for rep boundaries
        }

        periodicity = len(peak_indices) + len(valley_indices)
        if periodicity > best_periodicity:
            best_periodicity = periodicity
            primary_joint = joint

    # Attach rep boundaries to the primary joint; remove temp key from all
    for joint, info in baseline.items():
        valley_idxs = info.pop("valley_indices")
        if joint == primary_joint:
            info["rep_boundaries"] = [timestamps[i] for i in valley_idxs]
        else:
            info["rep_boundaries"] = []

    return baseline


def find_bad_form_extrema(frames: list[dict], baseline: dict) -> list[dict]:
    """
    Find peaks and valleys in the Bad Form data for each active joint, using
    the same prominence values derived from Good Form.

    Returns a flat list of extrema dicts (unsorted, unfiltered).
    """
    extrema = []
    for joint, info in baseline.items():
        series = _series(frames, joint)
        prominence = info["prominence"]

        peak_indices, _ = find_peaks(series, prominence=prominence)
        valley_indices, _ = find_peaks(-series, prominence=prominence)

        for idx in peak_indices:
            frame = frames[idx]
            extrema.append({
                "frameIndex": frame["frameIndex"],
                "timestampMs": frame["timestampMs"],
                "joint": joint,
                "type": "Peak",
                "actual_angle": float(series[idx]),
            })

        for idx in valley_indices:
            frame = frames[idx]
            extrema.append({
                "frameIndex": frame["frameIndex"],
                "timestampMs": frame["timestampMs"],
                "joint": joint,
                "type": "Valley",
                "actual_angle": float(series[idx]),
            })

    return extrema


def assign_rep_index(extrema: list[dict], rep_boundaries: list[int]) -> list[dict]:
    """
    Tag each extremum with a 1-based rep_index using the Good Form valley
    timestamps as rep boundaries.

    Rep 1 = before the first valley, Rep 2 = between valley 1 and valley 2, etc.
    """
    for entry in extrema:
        # bisect_left gives how many boundaries are <= timestampMs
        rep_idx = bisect.bisect_left(rep_boundaries, entry["timestampMs"]) + 1
        entry["rep_index"] = rep_idx
    return extrema


def flag_deviations(
    extrema: list[dict],
    baseline: dict,
    threshold: float = DEVIATION_THRESHOLD,
) -> list[dict]:
    """
    Compare each Bad Form extremum against the Good Form average.
    Return only those that deviate by more than `threshold` percent.
    """
    flagged = []
    for entry in extrema:
        joint = entry["joint"]
        info = baseline[joint]
        expected = info["avg_peak"] if entry["type"] == "Peak" else info["avg_valley"]
        actual = entry["actual_angle"]
        diff_pct = abs(actual - expected) / abs(expected) * 100.0 if expected != 0 else 0.0

        if diff_pct > threshold:
            flagged.append({
                "frameIndex": entry["frameIndex"],
                "timestampMs": entry["timestampMs"],
                "rep_index": entry["rep_index"],
                "joint": joint,
                "type": entry["type"],
                "expected_angle": round(expected, 4),
                "actual_angle": round(actual, 4),
                "diff_pct": round(diff_pct, 2),
            })

    flagged.sort(key=lambda x: (x["timestampMs"], x["frameIndex"]))
    return flagged


def analyze(good_path: str, bad_path: str) -> list[dict]:
    """
    Full pipeline: load both files, analyse Good Form, find Bad Form extrema,
    assign rep indices, flag deviations, return sorted results.
    """
    good_frames = load_angles(good_path)
    bad_frames = load_angles(bad_path)

    baseline = analyze_good_form(good_frames)
    if not baseline:
        return []

    # Identify the primary joint and its good-form prominence
    primary_joint = None
    primary_prominence = None
    for joint, info in baseline.items():
        if info["rep_boundaries"]:
            primary_joint = joint
            primary_prominence = info["prominence"]
            break

    # Detect rep boundaries from the bad form data using the primary joint's
    # good-form prominence — good form timestamps are from a different video
    # with different duration/pacing and must not be used directly.
    rep_boundaries: list[int] = []
    if primary_joint is not None:
        bad_series = _series(bad_frames, primary_joint)
        bad_valley_idxs, _ = find_peaks(-bad_series, prominence=primary_prominence)
        rep_boundaries = [bad_frames[i]["timestampMs"] for i in bad_valley_idxs]

    extrema = find_bad_form_extrema(bad_frames, baseline)
    extrema = assign_rep_index(extrema, rep_boundaries)
    return flag_deviations(extrema, baseline)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(
            "Usage: python analyze-form.py <good_form_angles.json> <bad_form_angles.json> [output.json]",
            file=sys.stderr,
        )
        sys.exit(1)

    output_path = sys.argv[3] if len(sys.argv) >= 4 else "bad_reps.json"

    results = analyze(sys.argv[1], sys.argv[2])

    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Wrote {len(results)} flagged rep(s) to {output_path}", file=sys.stderr)
    print(json.dumps(results, indent=2))

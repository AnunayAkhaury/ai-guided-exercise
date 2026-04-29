import json
import sys
import os
import numpy as np
from scipy.signal import find_peaks, savgol_filter

# Threshold for flagging deviations (percent)
DEVIATION_THRESHOLD = 25.0
SAVGOL_WINDOW = 11
SAVGOL_POLY   = 2

def load_angles(path: str) -> list[dict]:
    with open(path, "r") as f:
        data = json.load(f)
    return data["frames"]

def load_rep_boundaries(path: str) -> list[dict]:
    """Loads the pre-calculated consensus boundaries."""
    with open(path, "r") as f:
        data = json.load(f)
    return data["student_reps"]

def load_baseline(path: str) -> dict:
    """Load the ideal baseline JSON."""
    with open(path, "r") as f:
        data = json.load(f)
    return data["joints"]

def _series(frames: list[dict], joint: str) -> np.ndarray:
    raw_values = []
    for f in frames:
        is_valid = f["usableDict"].get(joint, False)
        val = f["angles"].get(joint)
        raw_values.append(val if (is_valid and val is not None) else np.nan)
    
    series = np.array(raw_values, dtype=float)
    nans = np.isnan(series)
    if not np.all(nans):
        series[nans] = np.interp(np.flatnonzero(nans), np.flatnonzero(~nans), series[~nans])
        if len(series) > SAVGOL_WINDOW:
            series = savgol_filter(series, window_length=SAVGOL_WINDOW, polyorder=SAVGOL_POLY)
    return series

def find_form_extrema(frames: list[dict], baseline: dict) -> list[dict]:
    """Find peaks and valleys for each joint using baseline prominence."""
    extrema = []
    for joint, info in baseline.items():
        series = _series(frames, joint)
        prominence = info["prominence"]

        peak_indices, _ = find_peaks(series, prominence=prominence)
        valley_indices, _ = find_peaks(-series, prominence=prominence)

        for idx in peak_indices:
            extrema.append({
                "frameIndex": frames[idx]["frameIndex"],
                "timestampMs": frames[idx]["timestampMs"],
                "joint": joint,
                "type": "Peak",
                "actual_angle": float(series[idx]),
            })

        for idx in valley_indices:
            extrema.append({
                "frameIndex": frames[idx]["frameIndex"],
                "timestampMs": frames[idx]["timestampMs"],
                "joint": joint,
                "type": "Valley",
                "actual_angle": float(series[idx]),
            })
    return extrema

def assign_rep_index(extrema: list[dict], rep_boundaries: list[dict]) -> list[dict]:
    """
    Tags each extremum with a 1-based rep_index based on boundaries.
    If an extremum falls outside all boundaries, it is tagged as rep_index 0.
    """
    for entry in extrema:
        ts = entry["timestampMs"]
        found_rep = 0
        for i, rep in enumerate(rep_boundaries):
            if rep["start_ms"] <= ts <= rep["end_ms"]:
                # Use the rep_index from JSON if available, otherwise use 1-based loop index
                found_rep = rep.get("rep_index", i + 1)
                break
        entry["rep_index"] = found_rep
    return extrema

def flag_deviations(extrema: list[dict], baseline: dict, threshold: float = DEVIATION_THRESHOLD) -> list[dict]:
    flagged = []
    for entry in extrema:
        # Only process extrema that actually fell inside a detected rep
        if entry["rep_index"] == 0:
            continue

        joint = entry["joint"]
        info = baseline[joint]
        expected = info["avg_peak"] if entry["type"] == "Peak" else info["avg_valley"]
        actual = entry["actual_angle"]
        
        if expected == 0: continue
        diff_pct = abs(actual - expected) / expected * 100.0

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

def run_form_analysis(video_name, ideal_base_name=None, data_dir="./data"):
    ideal_file = ideal_base_name if ideal_base_name else video_name
    
    baseline_path   = os.path.join(data_dir, f"{ideal_file}-ideal.json")
    input_path      = os.path.join(data_dir, f"{video_name}-angles.json")
    boundaries_path = os.path.join(data_dir, f"{video_name}-rep-boundaries.json")
    output_path     = os.path.join(data_dir, f"{video_name}-bad-reps.json")

    if not os.path.exists(boundaries_path):
        print(f"Boundaries not found at {boundaries_path}")
        return

    # Load everything
    baseline = load_baseline(baseline_path)
    form_frames = load_angles(input_path)
    rep_boundaries = load_rep_boundaries(boundaries_path)

    # Original Pipeline
    extrema = find_form_extrema(form_frames, baseline)
    
    # Updated Assignment (Uses your new JSON boundaries)
    extrema = assign_rep_index(extrema, rep_boundaries)
    
    # Original Flagging logic
    results = flag_deviations(extrema, baseline)

    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    flagged_reps = len({r["rep_index"] for r in results})
    print(f"Wrote {len(results)} flag(s) across {flagged_reps} flagged rep(s) to {output_path}")
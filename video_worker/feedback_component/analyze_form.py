import json
import sys
import os
import bisect
import numpy as np
from scipy.signal import find_peaks

# Threshold for flagging deviations (percent)
DEVIATION_THRESHOLD = 25.0   # percent — deviations beyond this are flagged
MIN_REP_GAP_MS      = 500    # ms — valley timestamps closer than this are merged into one boundary

def load_angles(path: str) -> list[dict]:
    with open(path, "r") as f:
        data = json.load(f)
    return data["frames"]

def _series(frames: list[dict], joint: str) -> np.ndarray:
    return np.array([f["angles"][joint] for f in frames])

def load_baseline(path: str) -> dict:
    """Load the ideal baseline JSON written by analyze-ideal.py."""
    with open(path, "r") as f:
        data = json.load(f)
    return data["joints"]

def _merge_boundaries(timestamps: list[int]) -> list[int]:
    """Deduplicate valley timestamps from multiple joints that fall within MIN_REP_GAP_MS of each other."""
    merged = []
    for ts in sorted(timestamps):
        if not merged or ts - merged[-1] >= MIN_REP_GAP_MS:
            merged.append(ts)
    return merged

def find_form_extrema(frames: list[dict], baseline: dict) -> list[dict]:
    """
    Find peaks and valleys in the form data for each active joint, using
    the prominence values derived from the ideal baseline.
    """
    extrema = []
    for joint, info in baseline.items():
        series = _series(frames, joint)
        prominence = info["prominence"]

        peak_indices,   _ = find_peaks(series,  prominence=prominence)
        valley_indices, _ = find_peaks(-series, prominence=prominence)

        for idx in peak_indices:
            frame = frames[idx]
            extrema.append({
                "frameIndex":   frame["frameIndex"],
                "timestampMs":  frame["timestampMs"],
                "joint":        joint,
                "type":         "Peak",
                "actual_angle": float(series[idx]),
            })

        for idx in valley_indices:
            frame = frames[idx]
            extrema.append({
                "frameIndex":   frame["frameIndex"],
                "timestampMs":  frame["timestampMs"],
                "joint":        joint,
                "type":         "Valley",
                "actual_angle": float(series[idx]),
            })
    return extrema

def assign_rep_index(extrema: list[dict], rep_boundaries: list[int]) -> list[dict]:
    """
    Tag each extremum with a 1-based rep_index.
    Rep 1 = before the first boundary, Rep 2 = between boundary 1 and 2, etc.
    """
    for entry in extrema:
        entry["rep_index"] = bisect.bisect_left(rep_boundaries, entry["timestampMs"]) + 1
    return extrema

def flag_deviations(
    extrema: list[dict],
    baseline: dict,
    threshold: float = DEVIATION_THRESHOLD,
) -> list[dict]:
    """Return extrema that deviate from the ideal average by more than threshold%."""
    flagged = []
    for entry in extrema:
        joint    = entry["joint"]
        info     = baseline[joint]
        expected = info["avg_peak"] if entry["type"] == "Peak" else info["avg_valley"]
        actual   = entry["actual_angle"]
        
        # Avoid division by zero
        diff_pct = abs(actual - expected) / expected * 100.0

        if diff_pct > threshold:
            flagged.append({
                "frameIndex":     entry["frameIndex"],
                "timestampMs":    entry["timestampMs"],
                "rep_index":      entry["rep_index"],
                "joint":          joint,
                "type":           entry["type"],
                "expected_angle": round(expected, 4),
                "actual_angle":   round(actual,   4),
                "diff_pct":       round(diff_pct, 2),
            })

    flagged.sort(key=lambda x: (x["timestampMs"], x["frameIndex"]))
    return flagged

def run_form_analysis(video_file, ideal_file, json_dir):
    """
    Constructs paths and runs the analysis pipeline.
    """
    # If no specific ideal file is provided, assume it's the same base name

    input_path    = json_dir / "angles.json"
    output_path   = json_dir / "bad-reps.json"

    if not os.path.exists(ideal_file):
        print(f"Baseline file not found: {ideal_file}")
        return
    if not os.path.exists(input_path):
        print(f"Input angles file not found: {input_path}")
        return

    # Load data
    baseline = load_baseline(ideal_file)
    form_frames = load_angles(input_path)
    
    # Re-detect rep boundaries from all joints with significant ROM.
    # Valley timestamps from multiple joints are merged to avoid duplicates.
    all_valley_ts: list[int] = []
    for joint, info in baseline.items():
        if not info["rep_boundaries"]:
            continue
        form_series = _series(form_frames, joint)
        valley_idxs, _ = find_peaks(-form_series, prominence=info["prominence"])
        all_valley_ts.extend(form_frames[i]["timestampMs"] for i in valley_idxs)

    rep_boundaries = _merge_boundaries(all_valley_ts)

    # Process deviations
    extrema = find_form_extrema(form_frames, baseline)
    extrema = assign_rep_index(extrema, rep_boundaries)
    results = flag_deviations(extrema, baseline)

    # Save output
    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    flagged_reps = len({r["rep_index"] for r in results})
    print(f"Wrote {len(results)} flag(s) across {flagged_reps} flagged rep(s) to {output_path}", file=sys.stderr)
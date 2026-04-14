import json
import sys
import os
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from scipy.signal import find_peaks

# Constants
STATIC_ROM_THRESHOLD    = 15.0   # degrees — joints with smaller ROM are ignored
PROMINENCE_FACTOR       = 0.20   # fraction of ROM used as peak/valley prominence
REP_BOUNDARY_ROM_THRESHOLD = 40.0  # degrees — joints above this ROM contribute rep boundaries

def load_angles(path: str) -> list[dict]:
    with open(path, "r") as f:
        data = json.load(f)
    return data["frames"]

def _series(frames: list[dict], joint: str) -> np.ndarray:
    return np.array([f["angles"][joint] for f in frames])

def analyze_good_form(frames: list[dict]) -> dict:
    """
    Analyse ideal-form frames.

    Returns a dict keyed by joint name, each value:
    {
        "avg_peak":       float,
        "avg_valley":     float,
        "prominence":     float,
        "rom":            float,
        "rep_boundaries": list[int],   # timestampMs of valleys for joints above REP_BOUNDARY_ROM_THRESHOLD
    }
    """
    joints = list(frames[0]["angles"].keys())
    timestamps = [f["timestampMs"] for f in frames]
    baseline = {}

    for joint in joints:
        series = _series(frames, joint)

        rom = float(series.max() - series.min())

        if rom < STATIC_ROM_THRESHOLD:
            continue

        prominence = PROMINENCE_FACTOR * rom
        peak_indices, _ = find_peaks(series, prominence=prominence)
        valley_indices, _ = find_peaks(-series, prominence=prominence)

        if len(peak_indices) == 0 or len(valley_indices) == 0:
            continue

        avg_peak   = float(series[peak_indices].mean())
        avg_valley = float(series[valley_indices].mean())

        baseline[joint] = {
            "avg_peak":      avg_peak,
            "avg_valley":    avg_valley,
            "prominence":    prominence,
            "rom":           rom,
            "valley_indices": valley_indices.tolist(),
        }

    # Clean up and assign rep boundaries based on primary joint
    for joint, info in baseline.items():
        valley_idxs = info.pop("valley_indices")
        if info["rom"] >= REP_BOUNDARY_ROM_THRESHOLD:
            info["rep_boundaries"] = [timestamps[i] for i in valley_idxs]
        else:
            info["rep_boundaries"] = []

    return baseline

def generate_ideal_baseline(base_name, data_dir="/app/data"):
    """
    Main logic: Reads angles, processes peaks, and writes the baseline JSON.
    """
    input_path = os.path.join(data_dir, f"{base_name}-angles.json")
    output_path = os.path.join(data_dir, f"{base_name}-ideal.json")

    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        return

    frames = load_angles(input_path)
    baseline = analyze_good_form(frames)

    if not baseline:
        print(f"No active joints found for {base_name} — check STATIC_ROM_THRESHOLD.", file=sys.stderr)
        return

    boundary_joints = [j for j, info in baseline.items() if info["rep_boundaries"]]

    output = {
        "sourceFile":    os.path.basename(input_path),
        "generatedAt":   datetime.now(timezone.utc).isoformat(),
        "joints":        baseline,
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(
        f"Wrote baseline for {len(baseline)} joints "
        f"(rep boundaries from: {', '.join(boundary_joints) or 'none'}) to {output_path}",
        file=sys.stderr,
    )
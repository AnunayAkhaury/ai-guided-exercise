"""
Ideal-form baseline generator.

Analyses a perfect-form joint angle JSON (produced by calculate-joint-angles.py)
and writes a reusable baseline JSON consumed by analyze-form.py.

Usage:
    python analyze-ideal.py [ideal_angles.json] [output.json]
    (defaults to the config block below when no argv are given)

Output JSON:
    {
        "sourceFile":       str,
        "generatedAt":      str (ISO-8601 UTC),
        "primaryJoint":     str,
        "primaryProminence": float,
        "joints": {
            "<joint>": {
                "avg_peak":      float,
                "avg_valley":    float,
                "prominence":    float,
                "rom":           float,
                "rep_boundaries": list[int]   # non-empty on primaryJoint only
            }, ...
        }
    }
"""

import json
import sys
import os
from datetime import datetime, timezone
import numpy as np
from scipy.signal import find_peaks

STATIC_ROM_THRESHOLD    = 15.0   # degrees — joints with smaller ROM are ignored
PROMINENCE_FACTOR       = 0.20   # fraction of ROM used as peak/valley prominence
REP_BOUNDARY_ROM_THRESHOLD = 40.0  # degrees — joints above this ROM contribute rep boundaries

# ── Configure these for each new ideal video ──────────────────────────────────
VIDEO_NAME  = "GoodFormCurls"        # base name of the -angles.json file
ASSETS_DIR  = "../src/assets/images" # relative to scripts/
# ──────────────────────────────────────────────────────────────────────────────
INPUT_PATH  = f"{ASSETS_DIR}/{VIDEO_NAME}-angles.json"
OUTPUT_PATH = f"{ASSETS_DIR}/{VIDEO_NAME}-ideal.json"


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

    for joint, info in baseline.items():
        valley_idxs = info.pop("valley_indices")
        if info["rom"] >= REP_BOUNDARY_ROM_THRESHOLD:
            info["rep_boundaries"] = [timestamps[i] for i in valley_idxs]
        else:
            info["rep_boundaries"] = []

    return baseline


if __name__ == "__main__":
    input_path  = sys.argv[1] if len(sys.argv) >= 2 else INPUT_PATH
    output_path = sys.argv[2] if len(sys.argv) >= 3 else OUTPUT_PATH

    frames = load_angles(input_path)
    baseline = analyze_good_form(frames)

    if not baseline:
        print("No active joints found — check STATIC_ROM_THRESHOLD.", file=sys.stderr)
        sys.exit(1)

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

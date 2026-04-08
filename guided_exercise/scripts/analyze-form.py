"""
Form deviation analyzer.

Compares a joint angle JSON (produced by calculate-joint-angles.py) against an
ideal baseline JSON (produced by analyze-ideal.py) and flags technique deviations.

Usage:
    python analyze-form.py [ideal_baseline.json] [form_angles.json] [output.json]
    (defaults to the config block below when no argv are given)

Output JSON — array sorted by timestampMs, each entry:
    {
        "frameIndex":     int,
        "timestampMs":    int,
        "rep_index":      int,
        "joint":          str,
        "type":           "Peak" | "Valley",
        "expected_angle": float,
        "actual_angle":   float,
        "diff_pct":       float
    }
"""

import json
import sys
import bisect
import numpy as np
from scipy.signal import find_peaks

DEVIATION_THRESHOLD = 25.0   # percent — deviations beyond this are flagged
MIN_REP_GAP_MS      = 500    # ms — valley timestamps closer than this are merged into one boundary

# ── Configure these for each new comparison ───────────────────────────────────
VIDEO_NAME    = "BadFormCurls"              # base name of the -angles.json to test
IDEAL_FILE    = "GoodFormCurls-ideal.json"  # output of analyze-ideal.py
ASSETS_DIR    = "../src/assets/images"
# ──────────────────────────────────────────────────────────────────────────────
BASELINE_PATH = f"{ASSETS_DIR}/{IDEAL_FILE}"
INPUT_PATH    = f"{ASSETS_DIR}/{VIDEO_NAME}-angles.json"
OUTPUT_PATH   = f"{ASSETS_DIR}/{VIDEO_NAME}-bad_reps.json"


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
        diff_pct = abs(actual - expected) / info["rom"] * 100.0

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


def analyze(baseline_path: str, form_path: str) -> list[dict]:
    """Full pipeline: load baseline + form data, detect reps, flag deviations."""
    baseline   = load_baseline(baseline_path)
    form_frames = load_angles(form_path)

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

    extrema = find_form_extrema(form_frames, baseline)
    extrema = assign_rep_index(extrema, rep_boundaries)
    return flag_deviations(extrema, baseline)


if __name__ == "__main__":
    baseline_path = sys.argv[1] if len(sys.argv) >= 2 else BASELINE_PATH
    input_path    = sys.argv[2] if len(sys.argv) >= 3 else INPUT_PATH
    output_path   = sys.argv[3] if len(sys.argv) >= 4 else OUTPUT_PATH

    results = analyze(baseline_path, input_path)

    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Wrote {len(results)} flagged rep(s) to {output_path}", file=sys.stderr)

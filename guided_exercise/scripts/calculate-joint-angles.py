"""
calculate-joint-angles.py

Reads  <BaseName>-pose.json
Writes <BaseName>-angles.json      (10 joint angles per frame, degrees)
Writes <BaseName>-angle-deltas.json (frame-to-frame angle differences)

Usage:
    python scripts/calculate-joint-angles.py <BaseName>
    e.g. python scripts/calculate-joint-angles.py BadFormCurls

Defaults to 'exercise-test' when no argument is given.
No external dependencies -- stdlib only.
"""

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

# paths
SCRIPTS_DIR  = Path(__file__).parent
PROJECT_ROOT = SCRIPTS_DIR.parent
ASSETS_DIR   = PROJECT_ROOT / "src" / "assets" / "images"

BASE_NAME  = sys.argv[1] if len(sys.argv) > 1 else "GoodFormCurls"
POSE_JSON  = ASSETS_DIR / f"{BASE_NAME}-pose.json"
ANGLES_JSON = ASSETS_DIR / f"{BASE_NAME}-angles.json"
DELTAS_JSON = ASSETS_DIR / f"{BASE_NAME}-angle-deltas.json"

# joint definitions (point_a, vertex, point_c)
# angle is measured at the vertex between the two bones a-b and c-b.
JOINTS = {
    "left_elbow":     ("left_shoulder",  "left_elbow",    "left_wrist"),
    "right_elbow":    ("right_shoulder", "right_elbow",   "right_wrist"),
    "left_shoulder":  ("left_hip",       "left_shoulder", "left_elbow"),
    "right_shoulder": ("right_hip",      "right_shoulder","right_elbow"),
    "left_knee":      ("left_hip",       "left_knee",     "left_ankle"),
    "right_knee":     ("right_hip",      "right_knee",    "right_ankle"),
    "left_hip":       ("left_shoulder",  "left_hip",      "left_knee"),
    "right_hip":      ("right_shoulder", "right_hip",     "right_knee"),
    "left_ankle":     ("left_knee",      "left_ankle",    "left_foot_index"),
    "right_ankle":    ("right_knee",     "right_ankle",   "right_foot_index"),
}

JOINT_NAMES = list(JOINTS.keys())

# minimum absolute delta (degrees) for a frame transition to be considered 
DELTA_THRESHOLD = 5.0


# geometry
def angle_3pt(a: dict, b: dict, c: dict) -> float | None:
    """
    angle (degrees) at vertex b between bones a-b and c-b.
    uses 3-d coordinates (x, y, z).
    returns none if either bone has zero length.
    """
    ba = (a["x"] - b["x"], a["y"] - b["y"], a["z"] - b["z"])
    bc = (c["x"] - b["x"], c["y"] - b["y"], c["z"] - b["z"])

    dot     = sum(ba[i] * bc[i] for i in range(3))
    mag_ba  = math.sqrt(sum(v * v for v in ba))
    mag_bc  = math.sqrt(sum(v * v for v in bc))

    if mag_ba < 1e-9 or mag_bc < 1e-9:
        return None

    cos_val = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
    return round(math.degrees(math.acos(cos_val)), 4)


# per-frame helpers
def landmarks_to_dict(landmarks: list) -> dict:
    """convert list of {name, x, y, z, ...} to {name: {x, y, z}} lookup."""
    return {lm["name"]: {"x": lm["x"], "y": lm["y"], "z": lm["z"]}
            for lm in landmarks}


def is_significant(deltas: dict) -> bool:
    """true if at least one joint changed by >= delta_threshold degrees."""
    vals = [abs(v) for v in deltas.values() if v is not None]
    return bool(vals) and max(vals) >= DELTA_THRESHOLD


def compute_angles(lm_dict: dict) -> dict:
    """return {joint_name: angle_degrees | none} for all defined joints."""
    angles = {}
    for joint, (a_name, b_name, c_name) in JOINTS.items():
        if a_name in lm_dict and b_name in lm_dict and c_name in lm_dict:
            angles[joint] = angle_3pt(lm_dict[a_name], lm_dict[b_name], lm_dict[c_name])
        else:
            angles[joint] = None
    return angles


# main
def main():
    # load pose data
    with open(POSE_JSON, encoding="utf-8") as f:
        pose_data = json.load(f)

    now_iso = datetime.now(timezone.utc).isoformat()

    # pass 1: calculate angles
    angle_frames = []

    for frame in pose_data["frames"]:
        poses = frame.get("poses", [])
        if poses:
            lm_dict = landmarks_to_dict(poses[0]["worldLandmarks"])
            angles  = compute_angles(lm_dict)
        else:
            angles = {j: None for j in JOINT_NAMES}

        angle_frames.append({
            "frameIndex":  frame["frameIndex"],
            "timestampMs": frame["timestampMs"],
            "angles":      angles,
        })

    angles_output = {
        "sourceFile":  f"{BASE_NAME}-pose.json",
        "generatedAt": now_iso,
        "captureRate": pose_data["captureRate"],
        "joints":      JOINT_NAMES,
    }

    # pass 2: calculate frame-to-frame deltas
    delta_frames = []

    for i in range(len(angle_frames) - 1):
        prev = angle_frames[i]["angles"]
        curr = angle_frames[i + 1]["angles"]

        deltas = {}
        for joint in JOINT_NAMES:
            p, c = prev[joint], curr[joint]
            deltas[joint] = round(c - p, 4) if (p is not None and c is not None) else None

        delta_frames.append({
            "fromFrame":   angle_frames[i]["frameIndex"],
            "toFrame":     angle_frames[i + 1]["frameIndex"],
            "timestampMs": angle_frames[i + 1]["timestampMs"],
            "deltas":      deltas,
        })

    # pass 3: filter near-zero transitions, align files 1:1
    sig_deltas = [d for d in delta_frames if is_significant(d["deltas"])]

    # one angle entry per significant delta, keyed to toFrame.
    # this guarantees angles[i] and deltas[i] are directly paired.
    angles_by_index = {f["frameIndex"]: f for f in angle_frames}
    sig_angle_frames = [
        angles_by_index[d["toFrame"]]
        for d in sig_deltas
        if d["toFrame"] in angles_by_index
    ]

    dropped_deltas = len(delta_frames) - len(sig_deltas)
    print(f"Kept {len(sig_deltas)} significant transitions (dropped {dropped_deltas}, threshold={DELTA_THRESHOLD}deg)")

    deltas_output = {
        "sourceFile":  f"{BASE_NAME}-angles.json",
        "generatedAt": now_iso,
        "captureRate": pose_data["captureRate"],
        "deltaThreshold": DELTA_THRESHOLD,
        "totalDeltas": len(sig_deltas),
        "joints":      JOINT_NAMES,
        "frames":      sig_deltas,
    }

    with open(DELTAS_JSON, "w", encoding="utf-8") as f:
        json.dump(deltas_output, f, indent=2)

    print(f"Deltas  written to {DELTAS_JSON}")

    angles_output["totalFrames"] = len(sig_angle_frames)
    angles_output["deltaThreshold"] = DELTA_THRESHOLD
    angles_output["frames"] = sig_angle_frames

    with open(ANGLES_JSON, "w", encoding="utf-8") as f:
        json.dump(angles_output, f, indent=2)

    print(f"Angles  written to {ANGLES_JSON} ({len(sig_angle_frames)} frames kept)")

    # quick sanity print
    sample = sig_angle_frames[len(sig_angle_frames) // 2]
    print(f"\nSample angles  (frame {sample['frameIndex']}):")
    for joint, val in sample["angles"].items():
        print(f"  {joint:20s}: {val}")


if __name__ == "__main__":
    main()

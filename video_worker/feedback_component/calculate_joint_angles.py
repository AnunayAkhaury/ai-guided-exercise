import json
import math
import sys
import os
from datetime import datetime, timezone
from pathlib import Path

# Constants for geometry threshold
DELTA_THRESHOLD = 5.0

# Joint definitions remain at module level for easy configuration
JOINTS = {
    "left_elbow":      ("left_shoulder",  "left_elbow",    "left_wrist"),
    "right_elbow":     ("right_shoulder", "right_elbow",   "right_wrist"),
    "left_shoulder":   ("left_hip",       "left_shoulder", "left_elbow"),
    "right_shoulder":  ("right_hip",      "right_shoulder","right_elbow"),
    "left_knee":       ("left_hip",       "left_knee",     "left_ankle"),
    "right_knee":      ("right_hip",      "right_knee",    "right_ankle"),
    "left_hip":        ("left_shoulder",  "left_hip",      "left_knee"),
    "right_hip":       ("right_shoulder", "right_hip",     "right_knee"),
    "left_ankle":      ("left_knee",      "left_ankle",    "left_foot_index"),
    "right_ankle":     ("right_knee",     "right_ankle",   "right_foot_index"),
}

JOINT_NAMES = list(JOINTS.keys())

def angle_3pt(a: dict, b: dict, c: dict) -> float | None:
    """Calculates angle (degrees) at vertex b between bones a-b and c-b."""
    ba = (a["x"] - b["x"], a["y"] - b["y"], a["z"] - b["z"])
    bc = (c["x"] - b["x"], c["y"] - b["y"], c["z"] - b["z"])

    dot     = sum(ba[i] * bc[i] for i in range(3))
    mag_ba  = math.sqrt(sum(v * v for v in ba))
    mag_bc  = math.sqrt(sum(v * v for v in bc))

    if mag_ba < 1e-9 or mag_bc < 1e-9:
        return None

    cos_val = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
    return round(math.degrees(math.acos(cos_val)), 4)

def landmarks_to_dict(landmarks: list) -> dict:
    return {lm["name"]: {"x": lm["x"], "y": lm["y"], "z": lm["z"]} for lm in landmarks}

def is_significant(deltas: dict) -> bool:
    vals = [abs(v) for v in deltas.values() if v is not None]
    return bool(vals) and max(vals) >= DELTA_THRESHOLD

def compute_angles(lm_dict: dict) -> dict:
    angles = {}
    for joint, (a_name, b_name, c_name) in JOINTS.items():
        if all(k in lm_dict for k in (a_name, b_name, c_name)):
            angles[joint] = angle_3pt(lm_dict[a_name], lm_dict[b_name], lm_dict[c_name])
        else:
            angles[joint] = None
    return angles

def calculate_joint_angles(video_file, json_dir):
    """
    Constructs paths internally, calculates joint angles and deltas, 
    and saves JSON outputs.
    """
    # Internal Path Construction
    pose_json_path = json_dir / "pose.json"
    angles_json_path = json_dir / "angles.json"
    deltas_json_path = json_dir / "angle-deltas.json"

    if not os.path.exists(pose_json_path):
        print(f"File not found: {pose_json_path}")
        return

    with open(pose_json_path, encoding="utf-8") as f:
        pose_data = json.load(f)

    now_iso = datetime.now(timezone.utc).isoformat()
    angle_frames = []

    # Pass 1: Calculate angles
    for frame in pose_data["frames"]:
        poses = frame.get("poses", [])
        if poses:
            lm_dict = landmarks_to_dict(poses[0]["worldLandmarks"])
            angles = compute_angles(lm_dict)
        else:
            angles = {j: None for j in JOINT_NAMES}

        angle_frames.append({
            "frameIndex": frame["frameIndex"],
            "timestampMs": frame["timestampMs"],
            "angles": angles,
        })

    # Pass 2: Calculate frame-to-frame deltas
    delta_frames = []
    for i in range(len(angle_frames) - 1):
        prev = angle_frames[i]["angles"]
        curr = angle_frames[i + 1]["angles"]

        deltas = {}
        for joint in JOINT_NAMES:
            p, c = prev[joint], curr[joint]
            deltas[joint] = round(c - p, 4) if (p is not None and c is not None) else None

        delta_frames.append({
            "fromFrame": angle_frames[i]["frameIndex"],
            "toFrame": angle_frames[i + 1]["frameIndex"],
            "timestampMs": angle_frames[i + 1]["timestampMs"],
            "deltas": deltas,
        })

    # Pass 3: Filter significance
    sig_deltas = [d for d in delta_frames if is_significant(d["deltas"])]
    angles_by_index = {f["frameIndex"]: f for f in angle_frames}
    sig_angle_frames = [angles_by_index[d["toFrame"]] for d in sig_deltas if d["toFrame"] in angles_by_index]

    # Save Deltas
    deltas_output = {
        "sourceFile": json_dir / "angles.json",
        "generatedAt": now_iso,
        "captureRate": pose_data["captureRate"],
        "deltaThreshold": DELTA_THRESHOLD,
        "totalDeltas": len(sig_deltas),
        "joints": JOINT_NAMES,
        "frames": sig_deltas,
    }
    with open(deltas_json_path, "w", encoding="utf-8") as f:
        json.dump(deltas_output, f, indent=2)

    # Save Angles
    angles_output = {
        "sourceFile": json_dir / "pose.json",
        "generatedAt": now_iso,
        "captureRate": pose_data["captureRate"],
        "joints": JOINT_NAMES,
        "totalFrames": len(sig_angle_frames),
        "deltaThreshold": DELTA_THRESHOLD,
        "frames": sig_angle_frames
    }
    with open(angles_json_path, "w", encoding="utf-8") as f:
        json.dump(angles_output, f, indent=2)

    print(f"Deltas written to {deltas_json_path}")
    print(f"Angles written to {angles_json_path} ({len(sig_angle_frames)} frames kept)")
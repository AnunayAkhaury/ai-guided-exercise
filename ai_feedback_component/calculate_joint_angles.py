import json
import math
import os
from datetime import datetime, timezone

EDGE_MARGIN = 0.02

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

# All landmark names referenced as vertices in JOINTS
_JOINT_LANDMARK_NAMES = {name for triple in JOINTS.values() for name in triple}

def is_out_of_frame(landmarks: list) -> bool:
    for lm in landmarks:
        if lm.get("name") not in _JOINT_LANDMARK_NAMES:
            continue
        x_img = lm.get("x_img")
        y_img = lm.get("y_img")
        if x_img is None or y_img is None:
            return False  # old pose.json without image coords — skip filter
        if lm.get("confident", True):
            continue  # confidently detected at edge = just close framing, not cut off
        if x_img < EDGE_MARGIN or x_img > 1.0 - EDGE_MARGIN:
            return True
        if y_img < EDGE_MARGIN or y_img > 1.0 - EDGE_MARGIN:
            return True
    return False

def angle_3pt(a: dict, b: dict, c: dict) -> float | None:
    ba = (a["x"] - b["x"], a["y"] - b["y"], a["z"] - b["z"])
    bc = (c["x"] - b["x"], c["y"] - b["y"], c["z"] - b["z"])
    dot = sum(ba[i] * bc[i] for i in range(3))
    mag_ba = math.sqrt(sum(v * v for v in ba))
    mag_bc = math.sqrt(sum(v * v for v in bc))
    if mag_ba < 1e-9 or mag_bc < 1e-9: return None
    cos_val = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
    return round(math.degrees(math.acos(cos_val)), 4)

def landmarks_to_dict(landmarks: list) -> dict:
    return {lm["name"]: {"x": lm["x"], "y": lm["y"], "z": lm["z"], "confident": lm["confident"]} for lm in landmarks}

def compute_angles(lm_dict: dict) -> dict:
    angles = {}
    usable_dict = {}
    for joint, (a_name, b_name, c_name) in JOINTS.items():
        if all(k in lm_dict for k in (a_name, b_name, c_name)):
            angles[joint] = angle_3pt(lm_dict[a_name], lm_dict[b_name], lm_dict[c_name])
            usable_dict[joint] = True if lm_dict[a_name]["confident"] and lm_dict[b_name]["confident"] and lm_dict[c_name]["confident"] else False
        else:
            angles[joint] = None
            usable_dict[joint] = False
    return angles, usable_dict

def calculate_joint_angles(json_dir):
    pose_json_path = json_dir / "pose.json"
    angles_json_path = json_dir / "angles.json"
    
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
        if poses and not is_out_of_frame(poses[0]["worldLandmarks"]):
            lm_dict = landmarks_to_dict(poses[0]["worldLandmarks"])
            angles, usable_dict = compute_angles(lm_dict)
        else:
            angles = {j: None for j in JOINT_NAMES}
            usable_dict = {j: False for j in JOINT_NAMES}

        angle_frames.append({
            "frameIndex": frame["frameIndex"],
            "timestampMs": frame["timestampMs"],
            "angles": angles,
            "usableDict": usable_dict,
        })

    angles_output = {
        "sourceFile": str(json_dir / "pose.json"),
        "generatedAt": now_iso,
        "captureRate": pose_data["captureRate"],
        "joints": JOINT_NAMES,
        "totalFrames": len(angle_frames),
        "frames": angle_frames
    }

    with open(angles_json_path, "w", encoding="utf-8") as f:
        json.dump(angles_output, f, indent=2)

    print(f"Angles written to {angles_json_path} for {len(angle_frames)} frames")
import json
import math
import os
from datetime import datetime, timezone

EDGE_MARGIN = 0.02

# Standard 1-DOF joints (shoulders calculated in 2-DOF below)
JOINTS = {
    "left_elbow":   ("left_shoulder",  "left_elbow",    "left_wrist"),
    "right_elbow":  ("right_shoulder", "right_elbow",   "right_wrist"),
    "left_knee":    ("left_hip",       "left_knee",     "left_ankle"),
    "right_knee":   ("right_hip",      "right_knee",    "right_ankle"),
    "left_hip":     ("left_shoulder",  "left_hip",      "left_knee"),
    "right_hip":    ("right_shoulder", "right_hip",     "right_knee"),
    "left_ankle":   ("left_knee",      "left_ankle",    "left_foot_index"),
    "right_ankle":  ("right_knee",     "right_ankle",   "right_foot_index"),
}

# 2-DOF Shoulder Definitions: (same_hip, same_shoulder, same_elbow, opp_shoulder)
# Right plane = (left_shoulder, right_shoulder, right_hip)
# Left plane  = (right_shoulder, left_shoulder, left_hip)
SHOULDER_JOINTS = {
    "left_shoulder":  ("left_hip",  "left_shoulder",  "left_elbow",  "right_shoulder"),
    "right_shoulder": ("right_hip", "right_shoulder", "right_elbow", "left_shoulder")
}

# Expand JOINT_NAMES dynamically for both shoulders (in-plane / out-of-plane)
JOINT_NAMES = list(JOINTS.keys()) + [
    "left_shoulder_in_plane",  "left_shoulder_out_plane",
    "right_shoulder_in_plane", "right_shoulder_out_plane"
]

_JOINT_LANDMARK_NAMES = {name for triple in JOINTS.values() for name in triple} | {
    "left_hip", "left_shoulder", "left_elbow",
    "right_hip", "right_shoulder", "right_elbow"
}

def is_out_of_frame(landmarks: list) -> bool:
    for lm in landmarks:
        if lm.get("name") not in _JOINT_LANDMARK_NAMES:
            continue
        x_img = lm.get("x_img")
        y_img = lm.get("y_img")
        if x_img is None or y_img is None:
            return False
        if lm.get("confident", True):
            continue
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

def deconstruct_shoulder_angles(hip: dict, shoulder: dict, elbow: dict, opp_shoulder: dict) -> tuple[float | None, float | None]:
    """
    Computes 2 DoF angles relative to the exact 3-point plane:
    Plane = (opp_shoulder, same_shoulder, same_hip)
    1. in_plane: Angle of upper arm projected into the 3-point torso plane.
    2. out_plane: Angle perpendicular/out-of-plane relative to this 3-point plane.
    """
    # Vectors anchored at the target shoulder
    v_shoulder_line = (opp_shoulder["x"] - shoulder["x"], opp_shoulder["y"] - shoulder["y"], opp_shoulder["z"] - shoulder["z"])
    v_torso_side    = (hip["x"] - shoulder["x"],          hip["y"] - shoulder["y"],          hip["z"] - shoulder["z"])
    v_arm           = (elbow["x"] - shoulder["x"],        elbow["y"] - shoulder["y"],        elbow["z"] - shoulder["z"])

    mag_arm = math.sqrt(sum(x*x for x in v_arm))
    mag_torso = math.sqrt(sum(x*x for x in v_torso_side))
    if mag_arm < 1e-9 or mag_torso < 1e-9:
        return None, None

    # Normal vector perpendicular to Plane(opp_shoulder, same_shoulder, same_hip)
    n = (
        v_shoulder_line[1] * v_torso_side[2] - v_shoulder_line[2] * v_torso_side[1],
        v_shoulder_line[2] * v_torso_side[0] - v_shoulder_line[0] * v_torso_side[2],
        v_shoulder_line[0] * v_torso_side[1] - v_shoulder_line[1] * v_torso_side[0]
    )

    mag_n = math.sqrt(sum(x*x for x in n))
    if mag_n < 1e-9:
        n_unit = (0.0, 0.0, 1.0)
    else:
        n_unit = (n[0] / mag_n, n[1] / mag_n, n[2] / mag_n)

    # 1. Out-of-plane angle (Deviation from the 3-point plane; 0° = flat inside plane)
    dot_v_n = sum(v_arm[i] * n_unit[i] for i in range(3))
    cos_out = max(-1.0, min(1.0, dot_v_n / mag_arm))
    out_plane_angle = round(abs(90.0 - math.degrees(math.acos(cos_out))), 4)

    # 2. In-plane angle (Projection of upper arm onto the 3-point plane relative to hip axis)
    v_arm_proj = (
        v_arm[0] - dot_v_n * n_unit[0],
        v_arm[1] - dot_v_n * n_unit[1],
        v_arm[2] - dot_v_n * n_unit[2]
    )
    mag_v_proj = math.sqrt(sum(x*x for x in v_arm_proj))

    if mag_v_proj < 1e-9:
        in_plane_angle = 0.0
    else:
        dot_in = sum(v_torso_side[i] * v_arm_proj[i] for i in range(3))
        cos_in = max(-1.0, min(1.0, dot_in / (mag_torso * mag_v_proj)))
        in_plane_angle = round(math.degrees(math.acos(cos_in)), 4)

    return in_plane_angle, out_plane_angle

def landmarks_to_dict(landmarks: list) -> dict:
    return {lm["name"]: {"x": lm["x"], "y": lm["y"], "z": lm["z"], "confident": lm["confident"]} for lm in landmarks}

def compute_angles(lm_dict: dict) -> tuple[dict, dict]:
    angles = {}
    usable_dict = {}

    # 1. Standard 1-DOF 3-point joints
    for joint, (a_name, b_name, c_name) in JOINTS.items():
        if all(k in lm_dict for k in (a_name, b_name, c_name)):
            angles[joint] = angle_3pt(lm_dict[a_name], lm_dict[b_name], lm_dict[c_name])
            usable_dict[joint] = lm_dict[a_name]["confident"] and lm_dict[b_name]["confident"] and lm_dict[c_name]["confident"]
        else:
            angles[joint] = None
            usable_dict[joint] = False

    # 2. Deconstructed Left & Right Shoulder 2-DOF Angles using Plane(opp_shoulder, same_shoulder, same_hip)
    for joint_prefix, (hip_k, sh_k, el_k, opp_sh_k) in SHOULDER_JOINTS.items():
        in_key = f"{joint_prefix}_in_plane"
        out_key = f"{joint_prefix}_out_plane"

        req_keys = (hip_k, sh_k, el_k, opp_sh_k)
        if all(k in lm_dict for k in req_keys):
            in_p, out_p = deconstruct_shoulder_angles(
                lm_dict[hip_k], lm_dict[sh_k], lm_dict[el_k], lm_dict[opp_sh_k]
            )
            angles[in_key] = in_p
            angles[out_key] = out_p

            is_usable = all(lm_dict[k]["confident"] for k in req_keys)
            usable_dict[in_key] = is_usable
            usable_dict[out_key] = is_usable
        else:
            angles[in_key] = None
            angles[out_key] = None
            usable_dict[in_key] = False
            usable_dict[out_key] = False

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

    for frame in pose_data["frames"]:
        poses = frame.get("poses", [])
        if not poses:
            continue

        lm_dict = landmarks_to_dict(poses[0]["worldLandmarks"])
        if len(poses):
            angles, usable_dict = compute_angles(lm_dict)

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

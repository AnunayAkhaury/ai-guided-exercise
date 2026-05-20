import json
import numpy as np
from scipy.signal import savgol_filter
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
from pathlib import Path

# --- IMPORT FROM YOUR PHASES PIPELINE ---
from ai_feedback_component.phases import extract_instructor_phases_with_pca

# --- CONFIGURATION ---
ANGLE_DEVIATION_THRESHOLD = 20.0
SAVGOL_WINDOW = 21
SAVGOL_POLY = 2
DTW_RADIUS = 30
NUM_JOINTS = 16

# Mapping joints to their final operational extremity for spatial tracking
JOINT_TO_EXTREMITY = {
    "left_elbow": "left_wrist",
    "right_elbow": "right_wrist",
    "left_shoulder": "left_shoulder",
    "right_shoulder": "right_shoulder",
    "left_knee": "left_ankle",
    "right_knee": "right_ankle",
    "left_hip": "left_hip",
    "right_hip": "right_hip",
}

def _parse_pose_landmarks(frame_obj):
    lm_dict = {}
    poses = frame_obj.get("poses", [])
    if poses:
        landmarks = poses[0].get("worldLandmarks", [])
        for lm in landmarks:
            lm_dict[lm["name"]] = np.array([lm.get("x", 0), lm.get("y", 0), lm.get("z", 0)])
    return lm_dict

def _get_clean_series(frames: list[dict], joint: str, is_student: bool = True) -> np.ndarray:
    raw_values = []
    for f in frames:
        val = f.get("angles", {}).get(joint)
        if is_student:
            is_valid = f.get("usableDict", {}).get(joint, False)
            raw_values.append(val if (is_valid and val is not None) else np.nan)
        else:
            raw_values.append(val if val is not None else np.nan)
    
    series = np.array(raw_values, dtype=float)
    nans = np.isnan(series)
    if np.all(nans): return np.zeros_like(series)

    non_nan_indices = np.flatnonzero(~nans)
    nan_indices = np.flatnonzero(nans)
    series[nans] = np.interp(nan_indices, non_nan_indices, series[~nans],
                            left=series[non_nan_indices[0]], right=series[non_nan_indices[-1]])

    if len(series) >= SAVGOL_WINDOW:
        series = savgol_filter(series, window_length=SAVGOL_WINDOW, polyorder=SAVGOL_POLY)
    
    return np.nan_to_num(series, nan=0.0)

def convert_hdbscan_phases_to_boundaries(detected_phases):
    if not detected_phases: return [0]
    boundaries = [phase["start_frame"] for phase in detected_phases]
    boundaries.append(detected_phases[-1]["end_frame"])
    return sorted(list(set(boundaries)))


# ==========================================
#      DYNAMIC KINEMATIC ENGINE (INSTRUCTOR)
# ==========================================

def analyze_instructor_phase_mechanics(i_a_frames, i_p_frames, apex_i_indices):
    """
    Analyzes instructor data to isolate stability vs. execution joints per phase.
    Stability joints MUST be below the hip (y > 0) and stationary for at least 
    75% of the frames in the phase.
    """
    phase_maps = {}
    all_joints = list(i_a_frames[0]["angles"].keys())
    
    print("\n==================================================")
    print("      INSTRUCTOR PHASE MECHANICS KINEMATIC ANALYSIS")
    print("==================================================")
    
    for p_idx in range(len(apex_i_indices) - 1):
        start_i, end_i = apex_i_indices[p_idx], apex_i_indices[p_idx+1]
        p_angle_slice = i_a_frames[start_i : end_i + 1]
        p_pose_slice = i_p_frames[start_i : end_i + 1]
        
        phase_num = p_idx + 1
        total_phase_frames = len(p_angle_slice)
        if total_phase_frames < 2:
            continue
            
        # 1. PROFILE STABILITY PILLARS (Below hip AND stationary for >= 75% of frames)
        stability_pillars = []
        
        # Gather frame-by-frame coordinate tracks for extremities
        joint_tracks = {j: [] for j in JOINT_TO_EXTREMITY.keys()}
        for pf in p_pose_slice:
            lms = _parse_pose_landmarks(pf)
            for j_name, ext_name in JOINT_TO_EXTREMITY.items():
                if ext_name in lms:
                    joint_tracks[j_name].append(lms[ext_name])

        for j_name, tracks in joint_tracks.items():
            if len(tracks) < 2: continue
            
            tracks_matrix = np.array(tracks) # Shape: (Frames, 3) -> [x, y, z]
            
            # Calculate frame-to-frame displacement vectors and velocities
            displacements = np.diff(tracks_matrix, axis=0)
            frame_velocities = np.linalg.norm(displacements, axis=1)
            
            valid_grounded_frames = 0
            # Evaluate frame conditions (comparing frame i with frame i+1)
            for i in range(len(frame_velocities)):
                y_val = tracks_matrix[i][1]       # y-coordinate of current frame
                velocity = frame_velocities[i]    # velocity moving to next frame
                
                # Condition: Below hip (y > 0) AND relatively stationary (low velocity)
                if y_val > 0.0 and velocity < 0.02:
                    valid_grounded_frames += 1
            
            # Calculate what percentage of the phase this joint spent grounded below the hip
            grounded_ratio = valid_grounded_frames / len(frame_velocities)
            
            # EXPECT MOST FRAMES GROUNDED: Must satisfy criteria for at least 75% of the phase
            if grounded_ratio >= 0.75:
                stability_pillars.append(j_name)

        # 2. PROFILE EXECUTION JOINTS
        joint_roms = {}
        joint_velocities = {}
        
        for joint in all_joints:
            angles = [f["angles"].get(joint, 0) for f in p_angle_slice if f["angles"].get(joint) is not None]
            if angles:
                joint_roms[joint] = np.ptp(angles)
                joint_velocities[joint] = np.mean(np.abs(np.diff(angles)))
            else:
                joint_roms[joint] = 0
                joint_velocities[joint] = 0
                
        mean_rom = np.mean(list(joint_roms.values())) if joint_roms else 0
        
        # Active execution joints drive the phase (high ROM relative to phase average)
        execution_joints = [j for j, r in joint_roms.items() if r > mean_rom and r > 15.0]
        
        # A joint cannot be both stability and execution in the same phase block
        execution_joints = [j for j in execution_joints if j not in stability_pillars]
        
        # 3. TRANSITION DETECTOR
        moving_joints_count = sum(1 for v in joint_velocities.values() if v > 2.5)
        # It's a transition phase only if half the body is shifting AND no stability pillars are locked
        is_transition = moving_joints_count > (len(all_joints) * 0.4) and len(stability_pillars) == 0
        
        phase_maps[phase_num] = {
            "stability": sorted(stability_pillars),
            "execution": sorted(execution_joints),
            "is_transition": is_transition
        }
        
        print(f"\n[PHASE {phase_num}] Frames: {start_i} -> {end_i}")
        print(f"  -> STABILITY JOINTS : {phase_maps[phase_num]['stability']}")
        print(f"  -> EXECUTION JOINTS : {phase_maps[phase_num]['execution']}")
        print(f"  -> TRANSITION PHASE?: {is_transition} ({moving_joints_count}/{len(all_joints)} joints actively driving)")
        
    print("==================================================\n")
    return phase_maps

def run_form_analysis(json_dir, exercise_name):
    CURRENT_DIR = Path(__file__).resolve().parent
    json_dir = Path(json_dir)

    inst_pose_path = CURRENT_DIR / "ideals" / exercise_name / "pose.json"
    inst_angles_path = CURRENT_DIR / "ideals" / exercise_name / "angles.json"
    rep_boundaries_path = json_dir / "rep-boundaries.json"

    print("\n--- Executing ML Clustering Phase Core Extraction ---")
    detected_phases = extract_instructor_phases_with_pca(
        str(inst_pose_path), str(inst_angles_path), str(rep_boundaries_path)
    )
    
    apex_i_indices = convert_hdbscan_phases_to_boundaries(detected_phases)

    with open(json_dir / "angles.json", "r") as f: s_angle_data = json.load(f)["frames"]
    with open(rep_boundaries_path, "r") as f: rep_data = json.load(f)
    with open(inst_angles_path, "r") as f: i_angle_data = json.load(f)["frames"]
    with open(inst_pose_path, "r") as f: i_pose_data = json.load(f)["frames"]

    # Generate the dynamic analysis configuration mapping out of the instructor records
    phase_mechanics = analyze_instructor_phase_mechanics(i_angle_data, i_pose_data, apex_i_indices)

    total_errors_running = 0
    rep_count = 0

    output_json = json_dir / "bad-reps.json"
    out_f = open(output_json, "w")
    out_f.write('{\n  "reps": [\n')
    
    first_rep = True

    for s_rep in rep_data["student_reps"]:
        rep_idx = s_rep["rep_index"]
        s_bound = s_rep["student_boundary"]
        i_tmpl = s_rep["instructor_template"]
        
        s_frames = [f for f in s_angle_data if s_bound["start_frame"] <= f["frameIndex"] <= s_bound["end_frame"]]
        i_a_frames = [f for f in i_angle_data if i_tmpl["start_frame"] <= f["frameIndex"] <= i_tmpl["end_frame"]]
        
        if not s_frames or not i_a_frames: continue

        # Pull all structural joint tracks for DTW alignment mapping
        all_joint_keys = list(i_a_frames[0]["angles"].keys())
        s_feats = [ _get_clean_series(s_frames, j) for j in all_joint_keys ]
        i_feats = [ _get_clean_series(i_a_frames, j, is_student=False) for j in all_joint_keys ]

        _, raw_path = fastdtw(np.column_stack(s_feats), np.column_stack(i_feats), radius=DTW_RADIUS, dist=euclidean)
        rep_events = []

        for s_idx, i_idx in raw_path:
            sf, ifr_a = s_frames[s_idx], i_a_frames[i_idx]
            global_student_frame = sf["frameIndex"]
            global_instructor_frame = ifr_a["frameIndex"]
            
            # Map global instructor frames cleanly back to target phase blocks
            curr_phase = 1
            for p_idx in range(len(apex_i_indices) - 1):
                if apex_i_indices[p_idx] <= global_instructor_frame <= apex_i_indices[p_idx+1]:
                    curr_phase = p_idx + 1
                    break
            
            # Retrieve cached requirements calculated from the instructor
            current_rules = phase_mechanics.get(curr_phase, {"stability": [], "execution": [], "is_transition": False})
            
            # Drop check if this window registers as a global posture transition zone
            if current_rules["is_transition"]:
                continue

            for joint, s_val in sf["angles"].items():
                if not sf["usableDict"].get(joint, False): continue
                i_val = ifr_a["angles"].get(joint, s_val)
                diff = abs(s_val - i_val)
                
                if diff > ANGLE_DEVIATION_THRESHOLD:
                    is_stability_issue = joint in current_rules["stability"]
                    is_execution_issue = joint in current_rules["execution"]
                    
                    if not (is_stability_issue or is_execution_issue):
                        # Skip if joint variance drifts on an unimportant or unassigned joint for this phase
                        continue
                        
                    rep_events.append({
                        "timestampMs": sf["timestampMs"],
                        "frameIndex": global_student_frame,
                        "joint": joint,
                        "phase": curr_phase,
                        "issue": "stability" if is_stability_issue else "execution",
                        "actual": round(s_val, 2), "expected": round(i_val, 2)
                    })
                    total_errors_running += 1 

        if not first_rep: out_f.write(',\n')
        out_f.write('\n' + json.dumps({"rep_index": rep_idx, "events": rep_events}))
        first_rep = False
        rep_count += 1

    overall_quality = max(0.1, (NUM_JOINTS - total_errors_running) / NUM_JOINTS)
    points = round(rep_count * overall_quality * 1000 / 5) * 5

    out_f.write('\n  ],\n')
    out_f.write(f'  "total_reps": {rep_count},\n')
    out_f.write(f'  "quality_modifier": {round(overall_quality, 4)},\n')
    out_f.write(f'  "points": {points}\n')
    out_f.write('}')
    out_f.close()
    
    print(f"Analysis Complete. Reps: {rep_count} | Quality: {overall_quality:.2f} | Points: {points}")

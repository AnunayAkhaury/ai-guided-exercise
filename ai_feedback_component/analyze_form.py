import json
import numpy as np
from scipy.signal import savgol_filter
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean
from pathlib import Path

# --- IMPORT FROM YOUR NEW PHASES PIPELINE ---
from ai_feedback_component.phases import extract_instructor_phases_with_pca

# --- CONFIGURATION ---
ANGLE_DEVIATION_THRESHOLD = 20.0
SAVGOL_WINDOW = 21
SAVGOL_POLY = 2
FPS = 30
PERSISTENCE_THRESHOLD_FRAMES = 12
DTW_RADIUS = 30
NUM_JOINTS = 16

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
            lm_dict[lm["name"]] = [lm.get("x", 0), lm.get("y", 0), lm.get("z", 0)]
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
    """
    Translates HDBSCAN dictionary arrays into an ordered frame index boundary map
    compatible with structural timeline slicing logic.
    """
    if not detected_phases:
        return [0]
    
    boundaries = []
    # Collect every start position and append the final boundary tail
    for phase in detected_phases:
        boundaries.append(phase["start_frame"])
    boundaries.append(detected_phases[-1]["end_frame"])
    
    return sorted(list(set(boundaries)))

def run_form_analysis(json_dir, exercise_name):
    CURRENT_DIR = Path(__file__).resolve().parent
    json_dir = Path(json_dir)

    # 1. PATH RESOLUTION FOR FILES
    inst_pose_path = CURRENT_DIR / "ideals" / exercise_name / "pose.json"
    inst_angles_path = CURRENT_DIR / "ideals" / exercise_name / "angles.json"
    rep_boundaries_path = json_dir / "rep-boundaries.json"

    # 2. RUN HDBSCAN PIPELINE FROM PHASES.PY FOR THE INSTRUCTOR TEMPLATE
    # We execute without passing video parameters to prevent plotting popups during analysis loops.
    print("\n--- Executing ML Clustering Phase Core Extraction ---")
    detected_phases = extract_instructor_phases_with_pca(
        str(inst_pose_path), 
        str(inst_angles_path), 
        str(rep_boundaries_path)
    )
    
    # Translate structural phase dict blocks to linear indexing boundaries
    apex_i_indices = convert_hdbscan_phases_to_boundaries(detected_phases)

    # 3. LOAD DATA MATRICES FOR STUDENT COMPARSION
    with open(json_dir / "angles.json", "r") as f: 
        s_angle_data = json.load(f)["frames"]
    with open(rep_boundaries_path, "r") as f: 
        rep_data = json.load(f)
    with open(inst_angles_path, "r") as f:
        i_angle_data = json.load(f)["frames"]
    with open(inst_pose_path, "r") as f:
        i_pose_data = json.load(f)["frames"]
    with open(CURRENT_DIR / "ideals" / exercise_name / "imp-joints.json", "r") as f:
        primary_joints = json.load(f)["primary_joints"]

    num_priority_joints = len(primary_joints)
    inverse_priority_joint_ratio = NUM_JOINTS / (NUM_JOINTS - num_priority_joints) if num_priority_joints < NUM_JOINTS else 1.0
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
        i_p_frames = [f for f in i_pose_data if i_tmpl["start_frame"] <= f["frameIndex"] <= i_tmpl["end_frame"]]
        
        if not s_frames or not i_a_frames: continue

        s_feats = [ _get_clean_series(s_frames, j) for j in primary_joints ]
        i_feats = [ _get_clean_series(i_a_frames, j, is_student=False) for j in primary_joints ]

        # 4. MAP ROTATION STABILITY AND KINEMATIC PILLARS
        phase_pillars = {}
        for p_idx in range(len(apex_i_indices) - 1):
            start_i, end_i = apex_i_indices[p_idx], apex_i_indices[p_idx+1]
            p_angle_slice = i_a_frames[start_i : end_i + 1]
            p_pose_slice = i_p_frames[start_i : end_i + 1]
            
            all_i_y = [lm[1] for pf in p_pose_slice for lm in _parse_pose_landmarks(pf).values() if lm[1] > 0]
            FLOOR_THRESHOLD = np.percentile(all_i_y, 85) if all_i_y else 0.5
            GROUND_BUFFER = 0.1 
            
            pillars = []
            for j_name in i_a_frames[0]["angles"].keys():
                phase_angles = [f["angles"].get(j_name, 0) for f in p_angle_slice]
                rom = np.ptp(phase_angles) if phase_angles else 999
                
                ext_name = JOINT_TO_EXTREMITY.get(j_name)
                is_grnd = False
                
                if ext_name:
                    y_vals = []
                    for pf in p_pose_slice:
                        frame_lms = _parse_pose_landmarks(pf)
                        if ext_name in frame_lms:
                            y_vals.append(frame_lms[ext_name][1])
                    
                    if y_vals and any(y > (FLOOR_THRESHOLD - GROUND_BUFFER) for y in y_vals):
                        is_grnd = True
                
                if is_grnd:
                    pillars.append(j_name)

            phase_pillars[p_idx + 1] = sorted(pillars) if sorted(pillars) != ['left_knee', 'right_knee'] else []

        # Run your DTW alignment using local array configurations
        _, raw_path = fastdtw(np.column_stack(s_feats), np.column_stack(i_feats), radius=DTW_RADIUS, dist=euclidean)
        
        rep_events, persistence = [], {}

        for s_idx, i_idx in raw_path:
            # 1. Look up the true dictionary data packets using the local matrix positions
            sf, ifr_a = s_frames[s_idx], i_a_frames[i_idx]
            
            # 2. Extract the true global video frame numbers
            global_student_frame = sf["frameIndex"]
            global_instructor_frame = ifr_a["frameIndex"]
            
            # 3. Use the true instructor video frame to calculate phase regions cleanly
            curr_phase = 1
            for p_idx in range(len(apex_i_indices) - 1):
                if apex_i_indices[p_idx] <= global_instructor_frame <= apex_i_indices[p_idx+1]:
                    curr_phase = p_idx + 1
                    break
            
            active_pils = phase_pillars.get(curr_phase, [])

            for joint, s_val in sf["angles"].items():
                if not sf["usableDict"].get(joint, False): continue
                i_val = ifr_a["angles"].get(joint, s_val)
                diff = abs(s_val - i_val)
                
                is_prio, is_pil = joint in primary_joints, joint in active_pils

                if (is_prio or is_pil) and diff > ANGLE_DEVIATION_THRESHOLD:
                    persistence[joint] = persistence.get(joint, 0) + 1
                    # Use the true video frame to check against apex moments
                    if (global_instructor_frame in apex_i_indices) or (persistence[joint] >= PERSISTENCE_THRESHOLD_FRAMES):
                        rep_events.append({
                            "timestampMs": sf["timestampMs"],
                            "frameIndex": global_student_frame, # Optional: helpful for debugging!
                            "joint": joint,
                            "phase": curr_phase,
                            "issue": "stability" if is_pil else "execution",
                            "actual": round(s_val, 2), "expected": round(i_val, 2)
                        })
                        total_errors_running += 1 
                        persistence[joint] = 0
                else: 
                    persistence[joint] = 0

        if not first_rep: out_f.write(',\n')
        out_f.write('\n' + json.dumps({"rep_index": rep_idx, "events": rep_events}))
        first_rep = False
        rep_count += 1

    # --- FINAL SCORE OUTPUT CALCULATIONS ---
    overall_quality = (NUM_JOINTS - total_errors_running) / NUM_JOINTS
    overall_quality = max(0.1, overall_quality) 
    points = round(rep_count * overall_quality * inverse_priority_joint_ratio * 1000 / 5) * 5

    out_f.write('\n  ],\n')
    out_f.write(f'  "total_reps": {rep_count},\n')
    out_f.write(f'  "quality_modifier": {round(overall_quality, 4)},\n')
    out_f.write(f'  "points": {points}\n')
    out_f.write('}')
    out_f.close()
    
    print(f"Analysis Complete. Reps: {rep_count} | Quality: {overall_quality:.2f} | Points: {points}")

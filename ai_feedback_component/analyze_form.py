import json
import os
import numpy as np
from scipy.signal import savgol_filter, find_peaks
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean

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
    """
    FORMATTING LOGIC:
    Converts the nested JSON structure:
    {"poses": [{"worldLandmarks": [{"name": "left_shoulder", "y": -0.13}, ...]}]}
    Into a flat dictionary:
    {"left_shoulder": [x, y, z], ...}
    """
    lm_dict = {}
    # Access the 'poses' list
    poses = frame_obj.get("poses", [])
    if poses:
        # Access the first pose's 'worldLandmarks'
        landmarks = poses[0].get("worldLandmarks", [])
        for lm in landmarks:
            # Store coordinates by landmark name
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

def extract_instructor_apex_indices(series: np.ndarray, min_phase_length=12):
    """
    Identifies the 'Deepest' and 'Highest' points of a movement.
    For a pushup elbow, the 'Deepest' point is the apex at the bottom.
    """
    # 1. Light smoothing to keep the peaks sharp but remove sensor flicker
    smoothed = savgol_filter(series, 7, 2)
    
    # 2. Find Peaks (Top of the pushup)
    # distance = min frames between peaks
    # prominence = how much the peak must 'stand out' from its surroundings
    peaks, _ = find_peaks(smoothed, distance=min_phase_length, prominence=10)
    
    # 3. Find Valleys (Bottom of the pushup)
    # We invert the signal to find the 'bottoms' as if they were peaks
    valleys, _ = find_peaks(-smoothed, distance=min_phase_length, prominence=10)
    
    # 4. Combine and add start/end boundaries
    apexes = sorted(list(set([0, len(series)-1] + list(peaks) + list(valleys))))
    
    return apexes

def get_consensus_apexes(all_joint_series, min_phase_length=12):
    """
    all_joint_series: List of np.ndarrays (one for each primary joint)
    """
    raw_candidates = []
    
    # 1. Collect apexes from every joint
    for series in all_joint_series:
        joint_apexes = extract_instructor_apex_indices(series, min_phase_length)
        raw_candidates.extend(joint_apexes)
    
    raw_candidates = sorted(list(set(raw_candidates)))
    if not raw_candidates:
        return [0]

    # 2. Cluster apexes that are close together (e.g., within 5 frames)
    # We want to find groups of frames that represent the same 'event'
    consensus = []
    if raw_candidates:
        current_cluster = [raw_candidates[0]]
        
        for i in range(1, len(raw_candidates)):
            # If the next candidate is within 5 frames, add to cluster
            if raw_candidates[i] - current_cluster[-1] < 5:
                current_cluster.append(raw_candidates[i])
            else:
                # Close the cluster and take the average (the consensus frame)
                consensus.append(int(np.mean(current_cluster)))
                current_cluster = [raw_candidates[i]]
        
        consensus.append(int(np.mean(current_cluster)))

    # 3. Final cleanup: Ensure start and end are included
    return sorted(list(set(consensus)))

def run_form_analysis(json_dir, exercise_name):
    # 1. LOAD ALL JSON FILES
    with open(json_dir /"angles.json", "r") as f: 
        s_angle_data = json.load(f)["frames"]
    with open(json_dir / "rep-boundaries.json", "r") as f: 
        rep_data = json.load(f)
    with open(f"ideals/{exercise_name}/angles.json", "r") as f: 
        i_angle_data = json.load(f)["frames"]
    with open(f"ideals/{exercise_name}/pose.json", "r") as f: 
        i_pose_data = json.load(f)["frames"]
    with open(f"ideals/{exercise_name}/imp-joints.json", "r") as f: 
        primary_joints = json.load(f)["primary_joints"]

    # Points Calculation Setup
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
        apex_i_indices = get_consensus_apexes(i_feats, min_phase_length=12)

        # Determine the pillar / load-bearing joints in each phase of the rep
        phase_pillars = {}
        for p_idx in range(len(apex_i_indices) - 1):
            # Use +1 to include the last frame of the phase
            start_i, end_i = apex_i_indices[p_idx], apex_i_indices[p_idx+1]
            p_angle_slice = i_a_frames[start_i : end_i + 1]
            p_pose_slice = i_p_frames[start_i : end_i + 1]
            
            # In worldLandmarks, 0 is defined by the center of the hip and Y is positive for values going downward.
            # WorldLandmarkers attempt to identify the height in meters of the landmarker away from the hip center.
            # Joints on the floor are at the same height away from the hip center and this value would be the max Y
            # of the pose.
            all_i_y = [lm[1] for pf in p_pose_slice for lm in _parse_pose_landmarks(pf).values() if lm[1] > 0]
            FLOOR_THRESHOLD = np.percentile(all_i_y, 85) if all_i_y else 0.5
            GROUND_BUFFER = 0.1 # In case Mediapipe is noisy
            
            pillars = []
            for j_name in i_a_frames[0]["angles"].keys():
                # 1. CALCULATE ROM (Stillness)
                # ptp (peak-to-peak) gives the max difference in angles during this phase
                phase_angles = [f["angles"].get(j_name, 0) for f in p_angle_slice]
                rom = np.ptp(phase_angles) if phase_angles else 999
                
                # 2. CHECK GROUNDING (Proximity)
                ext_name = JOINT_TO_EXTREMITY.get(j_name)
                is_grnd = False
                
                if ext_name:
                    y_vals = []
                    for pf in p_pose_slice:
                        frame_lms = _parse_pose_landmarks(pf)
                        if ext_name in frame_lms:
                            y_vals.append(frame_lms[ext_name][1])
                    
                    # Proximity check against your filtered FLOOR_THRESHOLD
                    if y_vals and any(y > (FLOOR_THRESHOLD - GROUND_BUFFER) for y in y_vals):
                        is_grnd = True
                
                # 3. COMBINE: Must be grounded AND static to be a Pillar
                # 15 degrees is a good standard for 'static' in noisy pose data
                if is_grnd:
                    pillars.append(j_name)
                    # print(f"  [PILLAR FOUND] {j_name} | ROM: {rom:.2f} | Grounded: {is_grnd}")
                else:
                    # Useful for debugging why a grounded joint isn't a pillar
                    # print(f"  [SKIPPED] {j_name} not grounded. ROM: {rom:.2f}")
                    pass

            # Store the identified pillars for this phase
            phase_pillars[p_idx + 1] = sorted(pillars) if sorted(pillars) != ['left_knee', 'right_knee'] else []

        # DTW ALIGNMENT
        _, raw_path = fastdtw(np.column_stack(s_feats), np.column_stack(i_feats), radius=DTW_RADIUS, dist=euclidean)
        
        rep_events, persistence = [], {}

        for s_idx, i_idx in raw_path:
            sf, ifr_a = s_frames[s_idx], i_a_frames[i_idx]
            curr_phase = 1
            for p_idx in range(len(apex_i_indices) - 1):
                if apex_i_indices[p_idx] <= i_idx <= apex_i_indices[p_idx+1]:
                    curr_phase = p_idx + 1; break
            
            active_pils = phase_pillars.get(curr_phase, [])

            for joint, s_val in sf["angles"].items():
                if not sf["usableDict"].get(joint, False): continue
                i_val = ifr_a["angles"].get(joint, s_val)
                diff = abs(s_val - i_val)
                
                is_prio, is_pil = joint in primary_joints, joint in active_pils

                if (is_prio or is_pil) and diff > ANGLE_DEVIATION_THRESHOLD:
                    persistence[joint] = persistence.get(joint, 0) + 1
                    if (i_idx in apex_i_indices) or (persistence[joint] >= PERSISTENCE_THRESHOLD_FRAMES):
                        rep_events.append({
                            "frameIndex": sf["frameIndex"], "joint": joint, "phase": curr_phase,
                            "issue": "stability" if is_pil else "execution",
                            "actual": round(s_val, 2), "expected": round(i_val, 2)
                        })
                        total_errors_running += 1 # Tracking for overall quality
                        persistence[joint] = 0
                else: persistence[joint] = 0

        # Rep JSON and video aggregation
        if not first_rep: out_f.write(',\n')
        out_f.write('    ' + json.dumps({"rep_index": rep_idx, "events": rep_events}))
        first_rep = False
        rep_count += 1

    # --- FINAL SCORE CALCULATION ---
    overall_quality = (NUM_JOINTS - total_errors_running) / NUM_JOINTS
    # Avoid negative or overly low quality modifiers from high error counts
    overall_quality = max(0.1, overall_quality) 
    points = round(rep_count * overall_quality * inverse_priority_joint_ratio * 1000 / 5) * 5

    out_f.write('\n  ],\n')
    out_f.write(f'  "total_reps": {rep_count},\n')
    out_f.write(f'  "quality_modifier": {round(overall_quality, 4)},\n')
    out_f.write(f'  "points": {points}\n')
    out_f.write('}')
    out_f.close()
    print(f"Analysis Complete. Reps: {rep_count} | Quality: {overall_quality:.2f} | Points: {points}")
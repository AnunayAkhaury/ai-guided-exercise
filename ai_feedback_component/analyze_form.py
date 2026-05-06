import json
import os
import numpy as np
from scipy.signal import savgol_filter
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean

# Modern MoviePy 2.0+ Imports
from moviepy import VideoFileClip, clips_array, concatenate_videoclips
from moviepy.video.fx.Margin import Margin

# --- CONFIGURATION ---
ANGLE_DEVIATION_THRESHOLD = 20.0 
SAVGOL_WINDOW = 21 
SAVGOL_POLY = 2
FPS = 30
PERSISTENCE_THRESHOLD_FRAMES = 30 
DTW_RADIUS = 30         # Max frames to drift from the diagonal
DROPOUT_THRESHOLD = 0.5 # Exclude joint from alignment if >50% of rep is NaN/unusable

def _get_clean_series(frames: list[dict], joint: str, is_student: bool = True) -> np.ndarray:
    """
    Cleans data for DTW. If student, drops points based on usableDict.
    """
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
    
    return np.nan_to_num(series, nan=0.0, posinf=0.0, neginf=0.0)

def extract_instructor_apex_indices(series: np.ndarray):
    """
    Finds velocity zero-crossings to define phases and apex points.
    """
    velocity = np.gradient(series)
    if len(velocity) > 15:
        velocity = savgol_filter(velocity, 11, 2)
    
    apexes = [0, len(series) - 1]
    for i in range(1, len(velocity)):
        if np.sign(velocity[i]) != np.sign(velocity[i-1]) and velocity[i-1] != 0:
            apexes.append(i)
    return sorted(list(set(apexes)))

def run_form_analysis(video_name, instructor_video_name, data_dir="./data"):
    # Path Setup
    s_angles_path = os.path.join(data_dir, f"{video_name}-angles.json")
    rep_info_path = os.path.join(data_dir, f"{video_name}-rep-boundaries.json")
    i_angles_path = os.path.join(data_dir, f"{instructor_video_name}-angles.json")
    imp_joints_path = os.path.join(data_dir, f"{instructor_video_name}-imp-joints.json")
    
    output_json = os.path.join(data_dir, f"{video_name}-bad-reps.json")
    output_video = os.path.join(data_dir, f"{video_name}-comparison.mp4")

    # Load All Data
    with open(s_angles_path, "r") as f: s_all_frames = json.load(f)["frames"]
    with open(rep_info_path, "r") as f: rep_data = json.load(f)
    with open(i_angles_path, "r") as f: i_all_frames = json.load(f)["frames"]
    with open(imp_joints_path, "r") as f: primary_joints = json.load(f)["primary_joints"]

    s_clip = VideoFileClip(os.path.join(data_dir, f"{video_name}.mp4"))
    i_clip = VideoFileClip(os.path.join(data_dir, f"{instructor_video_name}.mp4"))

    all_flagged_events = []
    comparison_clips = []

    for s_rep in rep_data["student_reps"]:
        rep_idx = s_rep["rep_index"]
        s_bound = s_rep["student_boundary"]
        i_tmpl = s_rep["instructor_template"]
        
        s_rep_frames = [f for f in s_all_frames if s_bound["start_frame"] <= f["frameIndex"] <= s_bound["end_frame"]]
        i_rep_frames = [f for f in i_all_frames if i_tmpl["start_frame"] <= f["frameIndex"] <= i_tmpl["end_frame"]]
        
        if not s_rep_frames or not i_rep_frames:
            continue

        # --- DYNAMIC FEATURE SELECTION FOR DTW ---
        s_feature_stack = []
        i_feature_stack = []
        
        # We store all joints for error checking later, but only "good" ones for DTW sync
        current_rep_s_data = {}
        current_rep_i_data = {}

        for joint in primary_joints:
            # Check dropout rate using usableDict
            usable_flags = [f.get("usableDict", {}).get(joint, False) for f in s_rep_frames]
            dropout_rate = 1.0 - (sum(usable_flags) / len(usable_flags))
            
            s_series = _get_clean_series(s_rep_frames, joint, is_student=True)
            i_series = _get_clean_series(i_rep_frames, joint, is_student=False)
            
            current_rep_s_data[joint] = s_series
            current_rep_i_data[joint] = i_series

            # Only include in DTW matrix if data is reliable for this rep
            if dropout_rate < DROPOUT_THRESHOLD:
                s_feature_stack.append(s_series)
                i_feature_stack.append(i_series)
            else:
                print(f"Rep {rep_idx}: Joint '{joint}' excluded from alignment (Dropout: {dropout_rate:.2%})")

        # Fallback: if all joints are bad, use the first one to avoid empty stack
        if not s_feature_stack:
            s_feature_stack = [current_rep_s_data[primary_joints[0]]]
            i_feature_stack = [current_rep_i_data[primary_joints[0]]]

        s_features = np.column_stack(s_feature_stack)
        i_features = np.column_stack(i_feature_stack)

        # Extract apexes based on the first instructor series provided
        apex_i_indices = extract_instructor_apex_indices(i_feature_stack[0])

        # --- MULTIVARIATE DTW ---
        _, raw_path = fastdtw(s_features, i_features, radius=DTW_RADIUS, dist=euclidean)
        
        # Enforce monotonicity
        clean_path = []
        highest_s, highest_i = -1, -1
        for s_idx, i_idx in raw_path:
            if s_idx > highest_s and i_idx > highest_i:
                clean_path.append((s_idx, i_idx))
                highest_s, highest_i = s_idx, i_idx

        persistence_tracker = {j: 0 for j in primary_joints}
        rep_frames_for_viz = []

        for s_idx, i_idx in clean_path:
            current_frame_errors = []
            s_frame_obj = s_rep_frames[s_idx]
            i_frame_obj = i_rep_frames[i_idx] 
            
            s_usable_dict = s_frame_obj.get("usableDict", {})
            is_apex_frame = (i_idx in apex_i_indices)

            # Phase Calculation
            current_phase = 0
            for p_idx in range(len(apex_i_indices) - 1):
                if apex_i_indices[p_idx] <= i_idx <= apex_i_indices[p_idx+1]:
                    current_phase = p_idx + 1
                    break

            for joint in primary_joints:
                # Rule: Skip error flagging if student joint is not visible/usable in THIS frame
                if not s_usable_dict.get(joint, False):
                    persistence_tracker[joint] = 0
                    continue

                s_val = current_rep_s_data[joint][s_idx]
                i_val = current_rep_i_data[joint][i_idx]
                diff = abs(s_val - i_val)

                if diff > ANGLE_DEVIATION_THRESHOLD:
                    persistence_tracker[joint] += 1
                else:
                    persistence_tracker[joint] = 0

                should_flag = (is_apex_frame and diff > ANGLE_DEVIATION_THRESHOLD) or \
                             (persistence_tracker[joint] >= PERSISTENCE_THRESHOLD_FRAMES)

                if should_flag:
                    error_entry = {
                        "frameIndex": s_frame_obj["frameIndex"],
                        "timestampMs": s_frame_obj["timestampMs"],
                        "rep_index": rep_idx,
                        "phase_num": current_phase,
                        "joint": joint,
                        "is_apex": is_apex_frame,
                        "expected": round(float(i_val), 2),
                        "actual": round(float(s_val), 2),
                        "diff": round(float(diff), 2)
                    }
                    all_flagged_events.append(error_entry)
                    current_frame_errors.append(error_entry)

            # --- VIDEO COMPOSITION ---
            i_ts, s_ts = i_frame_obj["timestampMs"]/1000.0, s_frame_obj["timestampMs"]/1000.0
            
            i_img = i_clip.to_ImageClip(t=i_ts).with_duration(1/FPS).resized(width=640)
            s_img = s_clip.to_ImageClip(t=s_ts).with_duration(1/FPS).resized(width=640)

            border_color = (0, 0, 0)
            if is_apex_frame: border_color = (0, 0, 255) # Blue for Apex
            elif current_frame_errors: border_color = (255, 0, 0) # Red for Error

            s_img = s_img.with_effects([Margin(top=10, bottom=10, left=10, right=10, color=border_color)])
            rep_frames_for_viz.append(clips_array([[i_img, s_img]]))

        if rep_frames_for_viz:
            comparison_clips.append(concatenate_videoclips(rep_frames_for_viz, method="compose"))

    # Final Save
    if comparison_clips:
        final_video = concatenate_videoclips(comparison_clips, method="compose")
        final_video.write_videofile(output_video, fps=FPS, codec="libx264")

    with open(output_json, "w") as f:
        json.dump(all_flagged_events, f, indent=2)

    print(f"Analysis Complete. {len(all_flagged_events)} errors flagged.")

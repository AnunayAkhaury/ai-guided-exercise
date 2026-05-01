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

def _get_clean_series(frames: list[dict], joint: str) -> np.ndarray:
    raw_values = []
    for f in frames:
        is_valid = f.get("usableDict", {}).get(joint, False)
        val = f.get("angles", {}).get(joint)
        raw_values.append(val if (is_valid and val is not None) else np.nan)
    
    series = np.array(raw_values, dtype=float)
    nans = np.isnan(series)
    if not np.all(nans):
        # Linear interpolation for missing frames
        series[nans] = np.interp(np.flatnonzero(nans), np.flatnonzero(~nans), series[~nans])
        if len(series) > SAVGOL_WINDOW:
            series = savgol_filter(series, window_length=SAVGOL_WINDOW, polyorder=SAVGOL_POLY)
    return series

def run_form_analysis(video_name, instructor_video_name, data_dir="./data"):
    # Paths
    student_video_path = os.path.join(data_dir, f"{video_name}.mp4")
    inst_video_path = os.path.join(data_dir, f"{instructor_video_name}.mp4")
    
    s_angles_path = os.path.join(data_dir, f"{video_name}-angles.json")
    rep_info_path = os.path.join(data_dir, f"{video_name}-rep-boundaries.json")
    i_angles_path = os.path.join(data_dir, f"{instructor_video_name}-angles.json")
    
    output_json = os.path.join(data_dir, f"{video_name}-bad-reps.json")
    output_video = os.path.join(data_dir, f"{video_name}-comparison.mp4")

    # Load Data
    with open(s_angles_path, "r") as f: s_frames = json.load(f)["frames"]
    with open(rep_info_path, "r") as f: rep_data = json.load(f)
    with open(i_angles_path, "r") as f: i_frames = json.load(f)["frames"]

    s_clip = VideoFileClip(student_video_path)
    i_clip = VideoFileClip(inst_video_path)

    all_flagged_events = []
    comparison_clips = []

    # 3. PROCESS EACH REP (New Data Format Logic)
    for s_rep in rep_data["student_reps"]:
        rep_idx = s_rep["rep_index"]
        s_bound = s_rep["student_boundary"]
        i_tmpl = s_rep["instructor_template"] # Pulled per-rep now
        
        # Filter frames for this specific student rep and instructor template
        s_rep_frames = [f for f in s_frames if s_bound["start_frame"] <= f["frameIndex"] <= s_bound["end_frame"]]
        i_rep_frames = [f for f in i_frames if i_tmpl["start_frame"] <= f["frameIndex"] <= i_tmpl["end_frame"]]
        
        if not s_rep_frames or not i_rep_frames:
            continue

        # Use the joint that defined this specific rep for DTW mapping
        mapping_joint = i_tmpl["joint"]
        s_map_series = _get_clean_series(s_rep_frames, mapping_joint)
        i_map_series = _get_clean_series(i_rep_frames, mapping_joint)

        # Apply FastDTW to align the student's timing to the instructor's
        _, raw_path = fastdtw(s_map_series.reshape(-1, 1), i_map_series.reshape(-1, 1), dist=euclidean)

        # Enforce strict monotonicity (no jumping back in time)
        clean_path = []
        highest_s_idx = -1
        highest_i_idx = -1
        for s_idx, i_idx in raw_path:
            if s_idx > highest_s_idx and i_idx > highest_i_idx:
                clean_path.append((s_idx, i_idx))
                highest_s_idx = s_idx
                highest_i_idx = i_idx

        # Analyze all available joints for this aligned path
        available_joints = list(s_rep_frames[0]["angles"].keys())
        current_rep_s_data = {j: _get_clean_series(s_rep_frames, j) for j in available_joints}
        current_rep_i_data = {j: _get_clean_series(i_rep_frames, j) for j in available_joints}

        rep_frames_for_viz = []

        for s_idx, i_idx in clean_path:
            current_frame_errors = []
            s_frame_obj = s_rep_frames[s_idx]
            
            for joint in available_joints:
                s_val = current_rep_s_data[joint][s_idx]
                i_val = current_rep_i_data[joint][i_idx]
                diff = abs(s_val - i_val)

                if diff > ANGLE_DEVIATION_THRESHOLD:
                    diff_pct = (diff / max(abs(i_val), 1.0)) * 100
                    
                    error_entry = {
                        "frameIndex": s_frame_obj["frameIndex"],
                        "timestampMs": s_frame_obj["timestampMs"],
                        "rep_index": rep_idx,
                        "joint": joint,
                        "expected_angle": round(float(i_val), 2),
                        "actual_angle": round(float(s_val), 2),
                        "diff_deg": round(float(diff), 2)
                    }
                    all_flagged_events.append(error_entry)
                    current_frame_errors.append(error_entry)

            # --- VIDEO COMPOSITION ---
            s_ts = s_frame_obj["timestampMs"] / 1000.0
            i_ts = i_rep_frames[i_idx]["timestampMs"] / 1000.0

            # Side-by-side frames (Synchronized by DTW)
            i_img = i_clip.to_ImageClip(t=i_ts).with_duration(1/FPS).resized(width=640)
            s_img = s_clip.to_ImageClip(t=s_ts).with_duration(1/FPS).resized(width=640)

            # Red border highlights frames where form deviations were found
            border_color = (255, 0, 0) if current_frame_errors else (0, 0, 0)
            s_img = s_img.with_effects([Margin(top=10, bottom=10, left=10, right=10, color=border_color)])

            combined = clips_array([[i_img, s_img]])
            rep_frames_for_viz.append(combined)

        if rep_frames_for_viz:
            rep_clip = concatenate_videoclips(rep_frames_for_viz, method="compose")
            comparison_clips.append(rep_clip)

    # Save Output
    if comparison_clips:
        final_video = concatenate_videoclips(comparison_clips, method="compose")
        final_video.write_videofile(output_video, fps=FPS, codec="libx264")

    with open(output_json, "w") as f:
        json.dump(all_flagged_events, f, indent=2)

    print(f"Analysis Complete. Flags: {len(all_flagged_events)}. Output: {output_video}")
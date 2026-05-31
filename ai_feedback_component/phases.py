import os
import json
import numpy as np
import pandas as pd
from scipy.signal import butter, filtfilt
from scipy.stats import mode
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
import hdbscan
import cv2

def load_json(path):
    if not path or not os.path.exists(path):
        return None
    with open(path, 'r') as f:
        return json.load(f)

def butter_lowpass_filter(data, cutoff, fps, order=4):
    nyq = 0.5 * fps
    normal_cutoff = cutoff / nyq
    b, a = butter(order, normal_cutoff, btype='low', analog=False)
    return filtfilt(b, a, data)

def calculate_torso_floor_angle(pose_data, start_frame, end_frame):
    if not pose_data or "frames" not in pose_data:
        return None
    frames_dict = {f["frameIndex"]: f for f in pose_data["frames"]}
    frame_indices = list(range(start_frame, end_frame + 1))
    angle_series = []
    
    for idx in frame_indices:
        f_data = frames_dict.get(idx)
        if not f_data or not f_data.get("poses"):
            angle_series.append(90.0)
            continue
        landmarks = f_data["poses"][0].get("worldLandmarks", [])
        lm_dict = {lm["name"]: lm for lm in landmarks}
        
        try:
            l_shoulder = np.array([lm_dict["left_shoulder"]["x"], lm_dict["left_shoulder"]["y"], lm_dict["left_shoulder"]["z"]])
            r_shoulder = np.array([lm_dict["right_shoulder"]["x"], lm_dict["right_shoulder"]["y"], lm_dict["right_shoulder"]["z"]])
            l_hip = np.array([lm_dict["left_hip"]["x"], lm_dict["left_hip"]["y"], lm_dict["left_hip"]["z"]])
            r_hip = np.array([lm_dict["right_hip"]["x"], lm_dict["right_hip"]["y"], lm_dict["right_hip"]["z"]])
            
            shoulder_mid = (l_shoulder + r_shoulder) / 2.0
            hip_mid = (l_hip + r_hip) / 2.0
            
            torso_vec = shoulder_mid - hip_mid
            dx, dy, dz = torso_vec[0], torso_vec[1], torso_vec[2]
            horizontal_dist = np.sqrt(dx**2 + dz**2)
            
            angle_rad = np.arctan2(abs(dy), horizontal_dist)
            angle_series.append(np.degrees(angle_rad))
        except KeyError:
            angle_series.append(90.0)
            
    return frame_indices, angle_series

def render_phases_video(video_path, output_path, final_phases, fps):
    if not os.path.exists(video_path):
        print(f"Error: Source video not found at {video_path}")
        return

    print(f"--- Starting Phase Video Rendering -> Creating: {output_path} ---")
    cap = cv2.VideoCapture(video_path)
    
    width  = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    blank_frame = np.zeros((height, width, 3), dtype=np.uint8)
    blank_duration_frames = int(fps * 1.0)
    
    for i, phase in enumerate(final_phases):
        print(f"Slicing Phase #{phase['phase_index']} (Frames {phase['start_frame']} to {phase['end_frame']})...")
        
        for f_idx in range(phase['start_frame'], phase['end_frame'] + 1):
            cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
            ret, frame = cap.read()
            if ret:
                cv2.putText(frame, f"Phase {phase['phase_index']}", (50, 80), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3, cv2.LINE_AA)
                out.write(frame)
            else:
                break
                
        if i < len(final_phases) - 1:
            for _ in range(blank_duration_frames):
                canvas = blank_frame.copy()
                cv2.putText(canvas, "--- NEXT PHASE ---", (int(width*0.3), int(height*0.5)), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 2, cv2.LINE_AA)
                out.write(canvas)
                
    cap.release()
    out.release()
    print(f"Successfully compiled and saved phase extraction to: {output_path}\n")

def extract_instructor_phases_with_pca(inst_pose_path, inst_angles_path, rep_boundaries_path, video_path=None, output_video_path=None):
    pose_data = load_json(inst_pose_path)
    angles_data = load_json(inst_angles_path)
    boundaries_data = load_json(rep_boundaries_path)
    
    print("--- Initializing Pure Angular Geometric Phase Detection ---")
    
    fps = boundaries_data.get("metadata", {}).get("fps", 30)
    inst_template_info = boundaries_data["student_reps"][0]["instructor_template"]
    start_frame = inst_template_info["start_frame"]
    end_frame = inst_template_info["end_frame"]

    # 1. Parse Pure Joint Angles
    angles_dict = {f["frameIndex"]: f.get("angles", {}) for f in angles_data.get("frames", [])}
    sample_angles = list(angles_dict.values())[0].keys() if angles_dict else []
    angle_features = {f"angle_{k}": [] for k in sample_angles}
    valid_frame_indices = []
    
    for idx in range(start_frame, end_frame + 1):
        if idx not in angles_dict:
            continue
        valid_frame_indices.append(idx)
        for k in sample_angles:
            angle_features[f"angle_{k}"].append(angles_dict[idx].get(k, 180.0))
            
    df = pd.DataFrame(angle_features, index=valid_frame_indices)
    df = df.interpolate().ffill().bfill()
    
    # 2. Smooth Base Angular Features
    features = []
    for col in df.columns:
        features.append(butter_lowpass_filter(df[col].values, cutoff=0.8, fps=fps))
        
    # 3. Inject Torso Floor Angle Dimension (A purely static positional orientation angle)
    _, floor_angles = calculate_torso_floor_angle(pose_data, start_frame, end_frame)
    floor_angles_filtered = [floor_angles[i - start_frame] for i in valid_frame_indices]
    features.append(butter_lowpass_filter(np.array(floor_angles_filtered), cutoff=0.8, fps=fps))
    print("Successfully integrated static Torso-Floor positional layout columns.")
        
    # NOTE: Velocity/Speed calculations have been completely stripped out here.
    X = np.column_stack(features)
    X_norm = (X - np.mean(X, axis=0)) / (np.std(X, axis=0) + 1e-6)
    
    # 4. PCA Processing
    pca = PCA(n_components=0.95, random_state=42)
    X_pca = pca.fit_transform(X_norm)
    print(f"PCA reduced integrated posture feature map down to {X_pca.shape[1]} components.")
    
    # 5. HDBSCAN Density Clustering
    min_cluster_size = 6 
    min_samples = 3        
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=min_cluster_size, 
        min_samples=min_samples, 
        metric='euclidean'
    )
    labels = clusterer.fit_predict(X_pca)
    
    outlier_scores = clusterer.outlier_scores_
    labels = np.where(outlier_scores > 0.5, -1, labels)
    
    window_size = 5
    if len(labels) > window_size:
        smoothed_labels = np.copy(labels)
        for i in range(len(labels) - window_size):
            sub_arr = labels[i : i + window_size]
            m = mode(sub_arr, keepdims=False)[0]
            smoothed_labels[i + window_size // 2] = m
        labels = smoothed_labels

    df['cluster_label'] = labels
    
    # 6. Chronological Phase Compiling
    all_detected_chunks = []
    max_gap_allowed = 3
    unique_clusters = [c for c in np.unique(labels) if c != -1]
    
    for cluster_id in unique_clusters:
        cluster_frames = df[df['cluster_label'] == cluster_id].index.values
        if len(cluster_frames) == 0:
            continue
        frame_gaps = np.diff(cluster_frames) > max_gap_allowed
        split_indices = np.where(frame_gaps)[0] + 1
        chunks = np.split(cluster_frames, split_indices)
        for chunk in chunks:
            chunk_len = len(chunk)
            if chunk_len >= min_cluster_size:
                all_detected_chunks.append({
                    "cluster_id": int(cluster_id),
                    "start_frame": int(chunk[0]),
                    "end_frame": int(chunk[-1]),
                    "total_frames": chunk_len,
                    "duration_seconds": round(chunk_len / fps, 2)
                })
                
    all_detected_chunks.sort(key=lambda x: x["start_frame"])
    if len(all_detected_chunks) == 0:
        print("No phases detected, returning entire rep as a phase")
        chunk_len = end_frame - start_frame + 1
        all_detected_chunks.append({
            "cluster_id": 0,
            "start_frame": start_frame,
            "end_frame": end_frame,
            "total_frames": chunk_len,
            "duration_seconds": round(chunk_len / fps, 2)
        })

    for idx, phase in enumerate(all_detected_chunks):
        phase["phase_index"] = idx + 1
        
    print("\n================ DETECTED PURE ANGULAR PHASES ================")
    for phase in all_detected_chunks:
        print(f"Phase #{phase['phase_index']} [Group {phase['cluster_id']}]: "
              f"Frames {phase['start_frame']} to {phase['end_frame']} ({phase['total_frames']} frames)")
    print("==============================================================\n")
    
    # 7. Video Output Generation
    if video_path and output_video_path:
        render_phases_video(video_path, output_video_path, all_detected_chunks, fps)
        
    return all_detected_chunks

if __name__ == "__main__":
    # instructor = "GoodLunge"
    # student = "Lunge_3"
    # instructor = "GoodBurpee"
    # student = "Burpee_4"
    # instructor = "GoodPushup"
    # student = "pushup-student"
    instructor = "GoodMountainClimbers"
    student = "MountainClimbers_10"
    # instructor = "GoodJumpingJacks"
    # student = "JStudent"
    INSTRUCTOR_POSE = f"data/{instructor}-pose.json" 
    INSTRUCTOR_ANGLES = f"data/{instructor}-angles.json"  
    REP_BOUNDARIES = f"data/{student}-rep-boundaries.json"
    
    INPUT_VIDEO_MP4 = f"data/{instructor}.mp4" 
    OUTPUT_PHASES_MP4 = f"output/{instructor}_Phases_PureAngles.mp4"
    
    extract_instructor_phases_with_pca(
        INSTRUCTOR_POSE, 
        INSTRUCTOR_ANGLES, 
        REP_BOUNDARIES,
        video_path=INPUT_VIDEO_MP4,
        output_video_path=OUTPUT_PHASES_MP4
    )

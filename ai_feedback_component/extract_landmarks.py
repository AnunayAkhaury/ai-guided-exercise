import cv2
import json
import os
import time
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# --- Constants from extract_landmarks.py ---
KEEP_INDICES = {
    11,12,13,14,15,16,
    23,24,25,26,27,28,29,30,31,32
}

ALL_LANDMARKS = [
    "nose","left_eye_inner","left_eye","left_eye_outer","right_eye_inner",
    "right_eye","right_eye_outer","left_ear","right_ear","mouth_left",
    "mouth_right","left_shoulder","right_shoulder","left_elbow","right_elbow",
    "left_wrist","right_wrist","left_pinky","right_pinky","left_index",
    "right_index","left_thumb","right_thumb","left_hip","right_hip",
    "left_knee","right_knee","left_ankle","right_ankle","left_heel",
    "right_heel","left_foot_index","right_foot_index"
]

BODY_LANDMARK_NAMES = [ALL_LANDMARKS[i] for i in KEEP_INDICES]

CONFIDENCE_THRES = 0.5

MODEL_PATH = "pose_landmarker_heavy.task"

def filter_pose_to_schema(landmarks):
    """
    Replicates the nested worldLandmarks structure from extract_landmarks.py.
    """
    world_landmarks = []
    for i in KEEP_INDICES:
        lm = landmarks[i]
        # Confidence logic from get_pose.py/extract_landmarks.py 
        vis = getattr(lm, "visibility", 0.0) or 0.0
        pres = getattr(lm, "presence", 0.0) or 0.0
        confidence = vis * 0.6 + pres * 0.4
        
        world_landmarks.append({
            "name": ALL_LANDMARKS[i],
            "x": round(lm.x, 6),
            "y": round(lm.y, 6),
            "z": round(lm.z, 6),
            "confident": True if confidence > CONFIDENCE_THRES else False,
        })
    return {"worldLandmarks": world_landmarks}

def extract_landmarks(base_name, data_dir="./data"):
    video_path = os.path.join(data_dir, f"{base_name}.mp4")
    output_path = os.path.join(data_dir, f"{base_name}-pose.json")

    if not os.path.exists(video_path):
        print(f"Video not found: {video_path}")
        return

    base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )

    detector = vision.PoseLandmarker.create_from_options(options)
    cap = cv2.VideoCapture(video_path)
    
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frames_list = []
    frame_idx = 0

    print(f"Processing {base_name} with high-res sampling...")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Replicating the per-frame sampling from get_pose.py
        timestamp_ms = int((frame_idx / fps) * 1000)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        
        # Detect using Video Mode logic
        result = detector.detect_for_video(mp_image, timestamp_ms)

        poses = []
        if result.pose_world_landmarks:
            # Replicating the nested 'poses' array structure
            poses.append(filter_pose_to_schema(result.pose_world_landmarks[0]))

        frames_list.append({
            "frameIndex": frame_idx,
            "timestampMs": timestamp_ms,
            "poses": poses
        })

        frame_idx += 1
        if frame_idx % 50 == 0:
            print(f"\rProcessed {frame_idx} frames...", end="")

    cap.release()

    # Final JSON structure matching extract_landmarks.py format
    output = {
        "videoFile": f"{base_name}.mp4",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "captureRate": int(fps),
        "totalFrames": len(frames_list),
        "landmarks": BODY_LANDMARK_NAMES,
        "frames": frames_list
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone -> {output_path}")

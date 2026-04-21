import cv2
import json
import sys
import os
import time
import mediapipe as mp

from mediapipe.tasks import python
from mediapipe.tasks.python import vision

EXTRACT_FPS = 10

# Landmarks configuration kept at module level as they are constants
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

def filter_pose(landmarks):
    result = []
    for i in KEEP_INDICES:
        lm = landmarks[i]
        result.append({
            "name": ALL_LANDMARKS[i],
            "x": round(lm.x, 6),
            "y": round(lm.y, 6),
            "z": round(lm.z, 6),
            "visibility": round(lm.visibility, 6)
        })
    return {"worldLandmarks": result}

def extract_landmarks(base_name, data_dir="/app/data", model_path="pose_landmarker_heavy.task"):
    """
    Constructs paths internally and processes the video.
    """
    # Logic moved inside:
    video_path = os.path.join(data_dir, f"{base_name}.mp4")
    output_path = os.path.join(data_dir, f"{base_name}-pose.json")

    if not os.path.exists(video_path):
        print(f"Video not found: {video_path}")
        return

    # Setup MediaPipe Tasks
    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.IMAGE,
        num_poses=1
    )

    detector = vision.PoseLandmarker.create_from_options(options)
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS)
    # Ensure fps is valid to avoid division by zero
    frame_interval = max(1, int(fps / EXTRACT_FPS))

    frames = []
    frame_index = 0
    saved_index = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_index % frame_interval == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = detector.detect(mp_image)

            poses = []
            if result.pose_world_landmarks:
                poses.append(filter_pose(result.pose_world_landmarks[0]))

            frames.append({
                "frameIndex": saved_index,
                "timestampMs": int((saved_index / EXTRACT_FPS) * 1000),
                "poses": poses
            })
            saved_index += 1
            print(f"\rProcessing frame {saved_index}...", end="")

        frame_index += 1

    cap.release()

    output = {
        "videoFile": f"{base_name}.mp4",
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "captureRate": EXTRACT_FPS,
        "totalFrames": len(frames),
        "landmarks": BODY_LANDMARK_NAMES,
        "frames": frames
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nDone -> {output_path}")
import cv2
import mediapipe as mp
import csv
import os
import numpy as np
import pickle

from mediapipe.tasks.python.vision import drawing_utils
from mediapipe.tasks.python.vision import drawing_styles
from mediapipe.tasks.python import vision

# GLOBALS
rootDir = os.path.dirname(os.path.abspath(__file__))

model_path = f"{rootDir}/pose_landmarker_heavy.task"
video_path = f"{rootDir}/instructor_pushup.mp4"
output_csv = f"{rootDir}/output/instructor_pushup.csv"
saved_detection_result = f"{rootDir}/output/instructor_detection_result.pkl"

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=model_path),
    running_mode=VisionRunningMode.VIDEO,
    output_segmentation_masks=False
)

# CREATE CSV
def get_pose_detection_data(cap, landmarker):
    frames = []
    detection_results = []

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_timestamp_ms = 0
    csv_data = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)

        print("Processing frame at timestamp:", frame_timestamp_ms)
        detection_result = landmarker.detect_for_video(mp_image, frame_timestamp_ms)

        if detection_result.pose_world_landmarks:
            for idx, landmark in enumerate(detection_result.pose_world_landmarks[0]):
                csv_data.append([
                    frame_timestamp_ms,
                    f"landmark {idx}",
                    landmark.x,
                    landmark.y,
                    landmark.z
                ])

        frames.append(frame)
        detection_results.append(detection_result)

        frame_timestamp_ms += int(1000 / fps)

    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    write_csv(csv_data, output_csv)
    return frames, detection_results

def write_csv(csv_data, output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerows(csv_data)

    print(f"Data written to {output_path}")

# DRAW LANDMARKS
def draw_landmarks_on_image(rgb_image, detection_result):
    pose_landmarks_list = detection_result.pose_landmarks
    annotated_image = np.copy(rgb_image)

    pose_landmark_style = drawing_styles.get_default_pose_landmarks_style()
    pose_connection_style = drawing_utils.DrawingSpec(color=(0, 255, 0), thickness=2)

    for pose_landmarks in pose_landmarks_list:
        drawing_utils.draw_landmarks(
            image=annotated_image,
            landmark_list=pose_landmarks,
            connections=vision.PoseLandmarksConnections.POSE_LANDMARKS,
            landmark_drawing_spec=pose_landmark_style,
            connection_drawing_spec=pose_connection_style
        )

    return annotated_image

def simulate_video(frames, detection_results, angles, rep_by_frame, state_by_frame):
    if len(frames) != len(detection_results) or len(frames) != len(angles):
        print("Incorrect input array sizes")
        return
    
    for i in range(len(frames)):
        frame = frames[i]
        detection_result = detection_results[i]

        resized_frame = cv2.resize(frame, (800, 600))
        rgb_frame = cv2.cvtColor(resized_frame, cv2.COLOR_BGR2RGB)

        annotated_frame = draw_landmarks_on_image(rgb_frame, detection_result)

        frame_angles = angles[i]

        if detection_result.pose_landmarks:
            landmarks = detection_result.pose_landmarks[0]
            h, w, _ = annotated_frame.shape

            for joint_name, angle in frame_angles.items():
                _, b, _ = JOINTS[joint_name]

                lm = landmarks[b]

                x = int(lm.x * w)
                y = int(lm.y * h)

                cv2.putText(annotated_frame, f"{int(angle)}", (x + 15, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

        cv2.putText(annotated_frame, f"Reps: {rep_by_frame[i]}, State: {state_by_frame[i]}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

        cv2.imshow(
            'MediaPipe Pose',
            cv2.cvtColor(annotated_frame, cv2.COLOR_RGB2BGR)
        )

        if cv2.waitKey(50) & 0xFF == ord('q'):
            break

# COMPUTE ANGLES
JOINTS = {
    "left-elbow": (11, 13, 15),
    "right-elbow": (12, 14, 16),
    "left-body": (11, 23, 27),
    "right-body": (12, 24, 28),
}

def calculate_joint_angle(a, b, c):
    a = np.array([a.x, a.y, a.z])
    b = np.array([b.x, b.y, b.z])
    c = np.array([c.x, c.y, c.z])

    ba = a - b
    bc = c - b

    cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
    angle = np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0)))

    return angle

def compute_all_angles(detection_results):
    all_angles = []

    for detection_result in detection_results:
        frame_angles = {}
        if detection_result.pose_landmarks:
            landmarks = detection_result.pose_landmarks[0]

            for joint_name, (a, b, c) in JOINTS.items():
                point_a = landmarks[a]
                point_b = landmarks[b]
                point_c = landmarks[c]

                frame_angles[joint_name] = calculate_joint_angle(point_a, point_b, point_c)

        all_angles.append(frame_angles)

    return all_angles

# REPS DETECTION
def detect_pushup_rep(angles, up_threshold=150, down_threshold=100):
    if not angles:
        return None, None, None
    
    pushup_count = 0
    rep_by_frame = [0] * len(angles)
    state_by_frame = [None] * len(angles)

    state = "up"

    for i in range(len(angles)):
        angle = angles[i]

        avg_elbow_angle = (angle['left-elbow'] + angle['right-elbow']) / 2
        if state == "up":
            if avg_elbow_angle < down_threshold:
                state = "down"
                pushup_count += 1

        elif state == "down":
            if avg_elbow_angle > up_threshold:
                state = "up"

        rep_by_frame[i] = pushup_count
        state_by_frame[i] = state

    return pushup_count, rep_by_frame, state_by_frame

def detect_repetitions(exercise_name, angles):
    if exercise_name == "pushup":
        return detect_pushup_rep(angles)
    else:
        print("Unsupported exercise")
        return None, None, None

# DATA CLEANING
def clean_and_smooth(frames, detection_results, visibility_threshold=0.5, window_size=5):
    cleaned_frames = []
    cleaned_results = []

    # Step 1: Filter invalid frames (keep alignment)
    for frame, result in zip(frames, detection_results):
        if not result.pose_landmarks:
            continue

        landmarks = result.pose_landmarks[0]

        visible_count = sum(lm.visibility >= visibility_threshold for lm in landmarks)
        total_count = len(landmarks)

        if visible_count / total_count < 0.2:
            continue

        cleaned_frames.append(frame)
        cleaned_results.append(result)

    # Step 2: Extract landmarks
    if not cleaned_results:
        return [], []

    landmarks_list = [
        res.pose_landmarks[0] for res in cleaned_results
    ]

    # Step 3: Smooth landmarks
    smoothed_landmarks = smooth_landmarks(landmarks_list, window_size)

    # Step 4: Rebuild detection_results with smoothed landmarks
    smoothed_results = []

    for i, result in enumerate(cleaned_results):
        # Replace landmarks but keep same MediaPipe structure
        result.pose_landmarks = [smoothed_landmarks[i]]
        smoothed_results.append(result)

    return cleaned_frames, smoothed_results

def smooth_landmarks(landmarks_list, window_size=5):
    smoothed = []

    half_window = window_size // 2

    for i in range(len(landmarks_list)):
        start = max(0, i - half_window)
        end = min(len(landmarks_list), i + half_window + 1)

        window = landmarks_list[start:end]

        smoothed_frame = []

        for j in range(len(window[0])):
            xs = [frame[j].x for frame in window]
            ys = [frame[j].y for frame in window]
            zs = [frame[j].z for frame in window]

            avg_x = float(np.mean(xs))
            avg_y = float(np.mean(ys))
            avg_z = float(np.mean(zs))

            # Create SAME TYPE (MediaPipe landmark)
            lm = type(window[-1][j])(
                x=avg_x,
                y=avg_y,
                z=avg_z,
                visibility=window[-1][j].visibility
            )

            smoothed_frame.append(lm)

        smoothed.append(smoothed_frame)

    return smoothed

# MAIN
def main(load_from_pkl=True):
    detection_results = None
    frames = None

    # Load precomputed results from pickle object file
    if load_from_pkl and os.path.exists(saved_detection_result):
        with open(saved_detection_result, 'rb') as f:
            data = pickle.load(f)

        if isinstance(data, dict):
            frames = data.get("frames")
            detection_results = data.get("results")

    # Compute results if not loaded
    if detection_results is None:
        with PoseLandmarker.create_from_options(options) as landmarker:
            cap = cv2.VideoCapture(video_path)
            frames, detection_results = get_pose_detection_data(cap, landmarker)

        with open(saved_detection_result, 'wb') as f:
            pickle.dump({
                "frames": frames,
                "results": detection_results
            }, f)

    frames, detection_results = clean_and_smooth(frames, detection_results)
    print("Data cleaned and smoothed.", len(frames), "frames and", len(detection_results), "results.")
    angles = compute_all_angles(detection_results)
    exercise_count, rep_by_frame, state_by_frame = detect_repetitions("pushup", angles)
    simulate_video(frames, detection_results, angles, rep_by_frame, state_by_frame)


if __name__ == "__main__":
    main()
import cv2
import mediapipe as mp
import os
import pickle
import argparse

from exercise_data import *
from video_annotations import VideoAnnotations

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


class FeedbackGenerator:
    def __init__(self, model_path, video_path, pickle_path, recompute_data = True, exercise_data = None):
        self.rootDir = os.path.dirname(os.path.abspath(__file__))
        print("Root directory:", self.rootDir)
        self.model_path = os.path.join(self.rootDir, model_path)
        self.video_path = os.path.join(self.rootDir, video_path)
        self.pickle_path = os.path.join(self.rootDir, pickle_path)
        self.recompute_data = recompute_data
        self.exercise_data = exercise_data

        BaseOptions = mp.tasks.BaseOptions
        self.PoseLandmarker = mp.tasks.vision.PoseLandmarker
        PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
        VisionRunningMode = mp.tasks.vision.RunningMode

        self.options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=model_path),
            running_mode=VisionRunningMode.VIDEO,
            output_segmentation_masks=False
)
        if not os.path.exists(self.model_path):
            print(f"Model path not found: {self.model_path}")
        if not os.path.exists(self.video_path):
            print(f"Video path not found: {self.video_path}")

    def extract_video_data(self, cap, landmarker):
        self.exercise_data = ExerciseData()
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_timestamp_ms = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)

            print("Processing frame at timestamp", frame_timestamp_ms)
            detection_result = landmarker.detect_for_video(mp_image, frame_timestamp_ms)

            frame_data = FrameData(frame, detection_result)
            self.exercise_data.add_frame(frame_data)

            frame_timestamp_ms += int(1000 / fps)

        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        
    """
        Check pickle_path for computed data if recompute_data is false. Otherwise, compute angle and video data from video path.
    """
    def process_video(self):
        if self.recompute_data == False and os.path.exists(self.pickle_path):
            with open(self.pickle_path, 'rb') as f:
                data = pickle.load(f)

            if isinstance(data, dict):
                self.exercise_data = data.get("exercise_data")
        else:
            with self.PoseLandmarker.create_from_options(self.options) as landmarker:
                cap = cv2.VideoCapture(self.video_path)
                self.extract_video_data(cap, landmarker)
                self.exercise_data.print_landmarks()
                self.clean_data()
                self.compute_derived_data()

            with open(self.pickle_path, 'wb') as f:
                pickle.dump({
                    "exercise_data": self.exercise_data,
                }, f)

    """
        Clean and smooth landmarks. May delete and edit landmarks with new data!
    """
    def clean_data(self):
        if self.exercise_data:
            self.exercise_data.clean_landmarks()
            self.exercise_data.smooth_landmarks()
    
    """
        Calculate additional information from exercise data like angles.
    """
    def compute_derived_data(self):
        self.exercise_data.compute_all_angles()


# Example usage: python main.py --model_path "pose_landmarker_heavy.task" --video_path "instructor_pushup.mp4" --pickle_path "output/instructor_detection_result.pkl" --recompute_data 0
def main():
    # Parse arguments
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", required=True)
    parser.add_argument("--video_path", required=True)
    parser.add_argument("--pickle_path", required=True)
    parser.add_argument("--recompute_data", type=int, default=1)
    args = parser.parse_args()

    feedbackGenerator = FeedbackGenerator(args.model_path, args.video_path, args.pickle_path, recompute_data=bool(args.recompute_data))
    feedbackGenerator.process_video()
    feedbackGenerator.exercise_data.compute_all_angles()

    video_annotator = VideoAnnotations(feedbackGenerator.exercise_data)
    video_annotator.annotated_video()

if __name__ == "__main__":
    main()
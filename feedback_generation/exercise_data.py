import numpy as np

# Labels for joints based on landmark indexes
# https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
JOINTS = {
    "left-elbow": (11, 13, 15),
    "right-elbow": (12, 14, 16),
    "left-body": (11, 23, 27),
    "right-body": (12, 24, 28),
}

class Landmark:
    def __init__(self, num, x, y, z, visibility):
        self.landmark_num = num
        self.x = x
        self.y = y
        self.z = z
        self.visibility = visibility

class FrameData: 
    def __init__(self, image, detected_results):
        self.image = image
        self.landmarks = self.extract_landmarks(detected_results)
        self.visualization_landmarks = self.extract_visualization_landmarks(detected_results)
        self.frame_angles = {}

    def extract_landmarks(self, detected_results):
        landmarks = []
        if not detected_results or not detected_results.pose_world_landmarks:
            return None
        for idx, landmark in enumerate(detected_results.pose_world_landmarks[0]):
            landmarks.append(Landmark(idx, landmark.x, landmark.y, landmark.z, landmark.visibility))
        return landmarks

    def extract_visualization_landmarks(self, detected_results):
        visualization_landmarks = []
        if not detected_results or not detected_results.pose_landmarks:
            return None
        for idx, landmark in enumerate(detected_results.pose_landmarks[0]):
            visualization_landmarks.append(Landmark(idx, landmark.x, landmark.y, landmark.z, landmark.visibility))
        return visualization_landmarks

class ExerciseData:
    def __init__(self):
        self.frames = []

    def add_frame(self, frame):
        self.frames.append(frame)

    def clean_landmarks(self, visibility_threshold=0.5):
        # Delete frames with overall visibility below threshold less than 20%
        for idx, frame in enumerate(self.frames):
            if frame.landmarks is None:
                self.frames = self.frames[:idx] + self.frames[idx+1:]
                continue

            landmarks = frame.landmarks

            visible_count = sum(lm.visibility >= visibility_threshold for lm in landmarks)
            total_count = len(landmarks)

            visibility_ratio = visible_count / total_count if total_count > 0 else 0 #prevent divisible by zero error
            if visibility_ratio < 0.2:
                self.frames = self.frames[:idx] + self.frames[idx+1:]

    def smooth_landmarks(self, window_size=5):
        # Smooth landmarks using a moving average filter
        if not self.frames:
            return

        smoothed_frames = []
        half_window = window_size // 2

        for i in range(len(self.frames)):
            start = max(0, i - half_window)
            end = min(len(self.frames), i + half_window + 1)

            window = self.frames[start:end]

            if not window or not window[0].landmarks:
                continue

            smoothed_landmarks = []

            for j in range(len(window[0].landmarks)):
                xs = [frame.landmarks[j].x for frame in window]
                ys = [frame.landmarks[j].y for frame in window]
                zs = [frame.landmarks[j].z for frame in window]
                vis = [frame.landmarks[j].visibility for frame in window]

                smoothed_landmarks.append(
                    Landmark(
                        num=j,
                        x=float(np.mean(xs)),
                        y=float(np.mean(ys)),
                        z=float(np.mean(zs)),
                        visibility=float(np.mean(vis))
                    )
                )

            new_frame = FrameData(self.frames[i].image, detected_results=None)
            new_frame.landmarks = smoothed_landmarks
            new_frame.visualization_landmarks = self.frames[i].visualization_landmarks
            new_frame.frame_angles = self.frames[i].frame_angles

            smoothed_frames.append(new_frame)

        self.frames = smoothed_frames

    def calculate_joint_angle(self, a, b, c):
        a = np.array([a.x, a.y, a.z])
        b = np.array([b.x, b.y, b.z])
        c = np.array([c.x, c.y, c.z])

        ba = a - b
        bc = c - b

        cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc))
        angle = np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0)))

        return angle

    def compute_all_angles(self):
        for frame in self.frames:
            landmarks = frame.landmarks
            for joint_name, (a, b, c) in JOINTS.items():
                point_a = landmarks[a]
                point_b = landmarks[b]
                point_c = landmarks[c]

                frame.frame_angles[joint_name] = self.calculate_joint_angle(point_a, point_b, point_c)

    def print_landmarks(self):
        # Print landmarks for each frame
        if not self.frames:
            print("No frames available.")
            return

        for i, frame in enumerate(self.frames):
            print(f"\n=== Frame {i} ===")

            if not frame.landmarks:
                print("  No landmarks detected.")
                continue

            for landmark in frame.landmarks:
                print(
                    f"  Landmark {landmark.landmark_num:2d}: "
                    f"({landmark.x:.4f}, {landmark.y:.4f}, {landmark.z:.4f})"
                )
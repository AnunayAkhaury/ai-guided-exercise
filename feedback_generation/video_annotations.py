import cv2
import mediapipe as mp

from exercise_data import *

POSE_CONNECTIONS = [
    (11, 13), (13, 15),  # left arm
    (12, 14), (14, 16),  # right arm
    (11, 12),            # shoulders
    (23, 24),            # hips
    (11, 23), (12, 24),  # torso
    (23, 25), (25, 27),  # left leg
    (24, 26), (26, 28),  # right leg
]

class VideoAnnotations:
    def __init__(self, exercise_data: ExerciseData):
        self.exercise_data = exercise_data

    def annotated_video(self, width=640, height=480):

        for frame in self.exercise_data.frames:
            resized_image = cv2.resize(frame.image, (width, height))

            # draw landmark points
            for landmark in frame.visualization_landmarks:
                point_x = int(landmark.x * width)
                point_y = int(landmark.y * height)
                cv2.circle(resized_image, (point_x, point_y), 5, (255, 170, 0), -1)

            # draw landmark connections
            for start_idx, end_idx in POSE_CONNECTIONS:
                lm1 = frame.visualization_landmarks[start_idx]
                lm2 = frame.visualization_landmarks[end_idx]

                x1, y1 = int(lm1.x * width), int(lm1.y * height)
                x2, y2 = int(lm2.x * width), int(lm2.y * height)

                cv2.line(resized_image, (x1, y1), (x2, y2), (251, 255, 0), 2)

            # draw angles
            for joint_name, angle in frame.frame_angles.items():
                _, b, _ = JOINTS[joint_name]

                lm = frame.visualization_landmarks[b]

                x = int(lm.x * width)
                y = int(lm.y * height)

                cv2.putText(resized_image, f"{int(angle)}", (x + 15, y), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (133, 0, 77), 1, cv2.LINE_AA)

            cv2.imshow("Video", resized_image)

            if cv2.waitKey(30) & 0xFF == ord('q'):
                break
        
        cv2.destroyAllWindows()
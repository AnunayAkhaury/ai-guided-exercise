import json
from collections import defaultdict
import cv2


def annotate_bad_angles(
    video_path: str,
    json_dir: str,
):
    """
    Annotates a video with exercise angle errors.

    Frames containing one or more errors receive:
      - Thick red border
      - Semi-transparent black text background
      - One line per error:
            Right Elbow: 107.8° / 167.6°

    Parameters
    ----------
    video_path : str
        Path to the input video.

    json_path : str
        Path to bad-angles.json.

    output_path : str
        Where to save the annotated video.
    """

    json_path = json_dir / "bad-reps.json"
    output_path = json_dir / "annotated.mp4"

    # ----------------------------
    # Load JSON
    # ----------------------------
    with open(json_path, "r") as f:
        data = json.load(f)

    # frame -> list of events
    events_by_frame = defaultdict(list)

    for rep in data["reps"]:
        for event in rep["events"]:
            events_by_frame[event["frameIndex"]].append(
                {
                    "joint": event["joint"],
                    "actual": event["actual"],
                    "expected": event["expected"],
                    "issue": event.get("issue", ""),
                }
            )

    # ----------------------------
    # Open video
    # ----------------------------
    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        raise FileNotFoundError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(
        output_path,
        fourcc,
        fps,
        (width, height),
    )

    frame_index = 0

    # ----------------------------
    # Process frames
    # ----------------------------
    while True:
        ret, frame = cap.read()

        if not ret:
            break

        if frame_index in events_by_frame:

            # Thick red border
            cv2.rectangle(
                frame,
                (0, 0),
                (width - 1, height - 1),
                (0, 0, 255),
                15,
            )

            # Background behind text
            overlay = frame.copy()
            box_height = 30 + 35 * len(events_by_frame[frame_index])

            cv2.rectangle(
                overlay,
                (15, 15),
                (width - 15, 15 + box_height),
                (0, 0, 0),
                -1,
            )

            frame = cv2.addWeighted(overlay, 0.55, frame, 0.45, 0)

            y = 45

            for event in events_by_frame[frame_index]:
                joint = event["joint"].replace("_", " ").title()

                text = (
                    f"{joint}: "
                    f"{event['actual']:.1f}° / {event['expected']:.1f}°"
                )

                cv2.putText(
                    frame,
                    text,
                    (30, y),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8,
                    (255, 255, 255),
                    2,
                    cv2.LINE_AA,
                )

                y += 35

        writer.write(frame)
        frame_index += 1

    cap.release()
    writer.release()

    print(f"Saved annotated video to: {output_path}")

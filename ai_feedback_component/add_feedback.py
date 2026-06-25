import json
import sys
import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv


load_dotenv()

cred = credentials.Certificate({
    "type": "service_account",
    "project_id": os.environ["FIREBASE_PROJECT_ID"],
    "private_key": os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
    "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
    "token_uri": "https://oauth2.googleapis.com/token",
})

firebase_admin.initialize_app(cred)

db = firestore.client()


def add_feedback(user_id: str, exercise: str, feedback_json: str, rep_count: int, start_time: int):
    try:
        data = feedback_json

        repetition_feedbacks = [
            {
                "timestampStart": item.get("timestamp_start"),
                "timestampEnd": item.get("timestamp_end"),
                "feedback": item.get("feedback", ""),
            }
            for item in data.get("repetition_feedbacks", [])
        ]

        doc_data = {
            "userId": user_id,
            "exercise": exercise,
            "data": repetition_feedbacks,
            "feedbackJson": json.dumps(feedback_json),
            "summary": data.get("summary", ""),
            "score": data.get("score"),
            "createdAt": firestore.SERVER_TIMESTAMP,
            "repCount": rep_count,
            "starttime": start_time,
        }

        doc_ref = db.collection("feedbacks").document()
        doc_ref.set(doc_data)

        print(f"Created feedback document: {doc_ref.id}")

    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) != 6:
        print(
            "Usage: python add_feedback.py <userId> <exercise> <json_file> <repCount> <startTime>"
        )
        sys.exit(1)

    user_id = sys.argv[1]
    exercise = sys.argv[2]
    json_file = sys.argv[3]
    rep_count = int(sys.argv[4])
    start_time = int(sys.argv[5])

    with open(json_file, "r", encoding="utf-8") as f:
        feedback_json = json.load(f)

    add_feedback(user_id, exercise, feedback_json, rep_count, start_time)

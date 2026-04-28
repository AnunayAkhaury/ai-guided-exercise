import firebase_admin
from firebase_admin import credentials, firestore

cred = credentials.Certificate("ai-guided-exercise-feedback-firebase-adminsdk-fbsvc-a1a5e9aa9e.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

def write_feedback(user_id, recording_id, feedback):
    db.collection("feedback").document().set({
    "userId": user_id,
    "recordingId": recording_id,
    "feedback": feedback
    })

def get_timestamps(recording_id):
    doc = db.collection("recordings_v2").document(recording_id).get()
    session_id = doc.get("sessionId")
    recording_start = doc.get("recordingStart")
    recording_start_ms = int(recording_start.timestamp() * 1000) # convert to millisec timestamp
    
    query = db.collection("timestamps").where(
        "sessionId", "==", session_id
    )

    docs = query.stream()

    return recording_start_ms, [d.to_dict() for d in docs]



    
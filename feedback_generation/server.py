import uvicorn
from fastapi import FastAPI
import boto3
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from main import main

# Load variables from .env into the environment
load_dotenv()

# Access specific variables
aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
aws_secret_acccess_key = os.getenv("AWS_SECRET_ACCESS_KEY")

# Initialize the S3 client
s3 = boto3.client(
    's3',
    aws_access_key_id=aws_access_key_id,
    aws_secret_access_key=aws_secret_acccess_key,
    region_name='us-east-1'
)

class Request(BaseModel):
    uid: str
    recording_prefix: str | None = None

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/feedback/")
async def get_feedback(req: Request):
    print("User id: ", req.uid)

    # bucket_name = 'ivs-dev-storage'
    # aws_folder_path = 'bIVQrr57SY9S/st-1elYXXpH24TxW/Uu2l9OOFyFgY/2026-04-08T19-53-36Z'
    # local_file_path = 'student_video.mp4'
    # s3.download_file(bucket_name, s3_file_key, local_file_path)

    main("pose_landmarker_heavy.task", "instructor_pushup.mp4", "output/instructor_detection_result.pkl", 1)

    return {"message": "Feedback goes here"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)

# Video Worker

One-shot Python container that post-processes one Amazon IVS participant recording. The backend starts this worker through ECS/Fargate when a recording is queued or retried.

## What It Does

1. Reads one recording job from environment variables.
2. Downloads the IVS high-quality HLS rendition from S3.
3. Runs `ffmpeg` to generate `final_fixed.mp4`.
4. Uploads the MP4 to S3.
5. Optionally calls the backend worker callback endpoint.

The worker is intentionally stateless. One ECS task should process one recording and then exit.

## Input and Output

Required input:

- `RECORDING_ID`
- `RAW_S3_PREFIX`

`RAW_S3_PREFIX` can be either:

```text
bucket/path/to/raw/recording
s3://bucket/path/to/raw/recording
```

The worker downloads:

```text
RAW_S3_PREFIX/media/hls/high/
```

and expects:

```text
playlist.m3u8
```

Default output:

```text
s3://OUTPUT_BUCKET/processed/users/USER_ID/recordings/RECORDING_ID/final_fixed.mp4
```

If `USER_ID` is not provided:

```text
s3://OUTPUT_BUCKET/processed/RECORDING_ID/final_fixed.mp4
```

## Environment Variables

Required:

```env
RECORDING_ID=recording_document_id
RAW_S3_PREFIX=s3://bucket/raw/prefix
```

Recommended:

```env
AWS_REGION=us-west-2
USER_ID=firebase_user_id
OUTPUT_BUCKET=processed_output_bucket
BACKEND_UPDATE_URL=https://your-backend.example.com/api/recordings/worker-complete
WORKER_SECRET=same_value_as_backend_WORKER_SHARED_SECRET
```

Optional:

```env
OUTPUT_KEY=custom/output/key.mp4
WORKDIR=/tmp/video-worker
```

AWS credentials are normally provided by the ECS task role. For local testing, use your normal AWS CLI environment or exported credentials.

## Local Run

```bash
cd video_worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export AWS_REGION=us-west-2
export RECORDING_ID=test-recording
export RAW_S3_PREFIX="s3://your-ivs-bucket/path/to/raw/prefix"
export USER_ID=test-user
export OUTPUT_BUCKET=your-output-bucket
export BACKEND_UPDATE_URL=http://localhost:4000/api/recordings/worker-complete
export WORKER_SECRET=your_worker_secret

python main.py
```

If `BACKEND_UPDATE_URL` is omitted, the worker uploads the MP4 and exits without updating the backend.

## Docker Build

From the repo root:

```bash
docker build -t video-worker ./video_worker
```

Run locally:

```bash
docker run --rm \
  -e AWS_REGION=us-west-2 \
  -e RECORDING_ID=test-recording \
  -e RAW_S3_PREFIX=s3://your-ivs-bucket/path/to/raw/prefix \
  -e USER_ID=test-user \
  -e OUTPUT_BUCKET=your-output-bucket \
  video-worker
```

## ECS/Fargate Integration

The backend starts this container from `guided_exercise_backend/src/services/AWS/ecs.ts`.

Backend env controls the ECS task:

- `ECS_CLUSTER_ARN`
- `ECS_TASK_DEFINITION`
- `ECS_CONTAINER_NAME`
- `ECS_SUBNET_IDS`
- `ECS_SECURITY_GROUP_IDS`
- `ECS_ASSIGN_PUBLIC_IP`
- `WORKER_OUTPUT_BUCKET`
- `WORKER_CALLBACK_URL`
- `WORKER_SHARED_SECRET`

The backend injects these worker env vars per task:

- `RECORDING_ID`
- `RAW_S3_PREFIX`
- `USER_ID`
- `OUTPUT_BUCKET`
- `BACKEND_UPDATE_URL`
- `WORKER_SECRET`

## Backend Callback

On success, the worker sends:

```json
{
  "recordingId": "recording-id",
  "processedVideoUrl": "s3://bucket/key/final_fixed.mp4",
  "outputBucket": "bucket",
  "outputKey": "key/final_fixed.mp4",
  "status": "processed"
}
```

Headers:

```text
x-worker-secret: WORKER_SECRET
```

The backend maps this to `status: completed` and stores the processed video URL.

## Failure Behavior

If the worker fails before callback, ECS logs are the source of truth and the backend recording may stay `processing` unless the task launch itself failed. Retry from the app recording screen or call:

```bash
curl -X POST https://YOUR_BACKEND_URL/api/recordings/RECORDING_ID/process
```

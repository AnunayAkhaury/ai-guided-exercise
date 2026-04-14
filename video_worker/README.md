# Video Worker

One-shot container for post-processing an IVS participant recording.

## What it does

1. Reads a single recording job from environment variables
2. Downloads `media/hls/high/*` from S3
3. Runs `ffmpeg` to create a fixed MP4
4. Uploads the MP4 back to S3
5. Optionally calls a backend update endpoint

## Required environment variables

- `RECORDING_ID`
- `RAW_S3_PREFIX`
  - accepts either `bucket/path/to/prefix` or `s3://bucket/path/to/prefix`

## Optional environment variables

- `AWS_REGION`
- `OUTPUT_BUCKET`
  - defaults to the input bucket
- `OUTPUT_KEY`
  - defaults to `processed/<RECORDING_ID>/final_fixed.mp4`
- `WORKDIR`
  - defaults to `/tmp/video-worker`
- `BACKEND_UPDATE_URL`
  - optional callback URL after upload
- `WORKER_SECRET`
  - sent as `x-worker-secret` if callback URL is set

## Local run

```bash
cd video_worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export AWS_REGION=us-west-2
export RECORDING_ID=test-recording
export RAW_S3_PREFIX="move-together-ivs-bucket/gUiseWNvaUuJ/st-1tDGz7IKCfVhT/ehwqDXVtTuxH/2026-04-09T18-16-46Z"

python main.py
```

## Container build

```bash
docker build -t video-worker ./video_worker
```

## ECS/Fargate shape

Run one task per recording with environment overrides for:

- `RECORDING_ID`
- `RAW_S3_PREFIX`
- `OUTPUT_BUCKET`
- `OUTPUT_KEY`
- `BACKEND_UPDATE_URL`
- `WORKER_SECRET`

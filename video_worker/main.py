import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Tuple
from feedback_component.feedback_main import generate_comparison
import json

import boto3
import requests

base_dir = Path(__file__).resolve().parent

def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def parse_s3_prefix(raw_s3_prefix: str) -> Tuple[str, str]:
    value = raw_s3_prefix.strip()

    if value.startswith("s3://"):
        value = value[5:]

    parts = value.split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise RuntimeError(
            "RAW_S3_PREFIX must look like 'bucket/prefix' or 's3://bucket/prefix'"
        )

    return parts[0], parts[1].rstrip("/")


def build_output_key(recording_id: str) -> str:
    explicit_output_key = os.getenv("OUTPUT_KEY")
    if explicit_output_key:
        return explicit_output_key.lstrip("/")

    user_id = os.getenv("USER_ID")
    if user_id:
        return f"processed/users/{user_id}/recordings/{recording_id}/final_fixed.mp4"

    return f"processed/{recording_id}/final_fixed.mp4"

def build_output_key_clip(recording_id: str, index: str) -> str:
    explicit_output_key = os.getenv("OUTPUT_KEY")
    if explicit_output_key:
        return explicit_output_key.lstrip("/")

    user_id = os.getenv("USER_ID")
    if user_id:
        return f"processed/users/{user_id}/recordings/{recording_id}/{index}.mp4"

    return f"processed/{recording_id}/{index}.mp4"

def ensure_clean_dir(path: Path) -> None:
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def download_prefix(s3_client, bucket: str, prefix: str, destination: Path) -> int:
    paginator = s3_client.get_paginator("list_objects_v2")
    count = 0

    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            rel = key[len(prefix) :].lstrip("/")
            if not rel:
                continue

            local_path = destination / rel
            local_path.parent.mkdir(parents=True, exist_ok=True)
            s3_client.download_file(bucket, key, str(local_path))
            count += 1

    return count


def run_ffmpeg(input_playlist: Path, output_file: Path) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-fflags",
        "+genpts",
        "-i",
        str(input_playlist),
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        str(output_file),
    ]

    subprocess.run(cmd, check=True)


def upload_file(s3_client, local_path: Path, bucket: str, key: str) -> str:
    s3_client.upload_file(str(local_path), bucket, key, ExtraArgs={"ContentType": "video/mp4"})
    return f"s3://{bucket}/{key}"

def maybe_callback(
    recording_id: str,
    processed_video_url: str,
    output_bucket: str,
    output_key: str,
) -> None:
    backend_update_url = os.getenv("BACKEND_UPDATE_URL")
    if not backend_update_url:
        print("BACKEND_UPDATE_URL not set; skipping backend callback.")
        return

    payload = {
        "recordingId": recording_id,
        "processedVideoUrl": processed_video_url,
        "outputBucket": output_bucket,
        "outputKey": output_key,
        "status": "processed",
    }

    headers = {"Content-Type": "application/json"}
    worker_secret = os.getenv("WORKER_SECRET")
    if worker_secret:
        headers["x-worker-secret"] = worker_secret

    response = requests.post(backend_update_url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    print("Backend callback succeeded:", response.text)

def save_clip_callback(
    recording_id: str,
    processed_video_url: str,
    exercise: str,
    feedback: str,
    user_id:str,
    duration:int
) -> None:
    backend_add_clip_url = os.getenv("BACKEND_ADD_CLIP_URL")
    if not backend_add_clip_url:
        print("BACKEND_ADD_CLIP_URL not set; skipping add clip callback.")
        return

    payload = {
        "recordingId": recording_id,
        "processedVideoUrl": processed_video_url,
        "exercise": exercise,
        "feedback": feedback,
        "userId": user_id,
        "duration": str(duration)
    }

    headers = {"Content-Type": "application/json"}
    worker_secret = os.getenv("WORKER_SECRET")
    if worker_secret:
        headers["x-worker-secret"] = worker_secret

    response = requests.post(backend_add_clip_url, json=payload, headers=headers, timeout=30)
    response.raise_for_status()
    print("Add clip callback succeeded:", response.text)

def get_ideal_path(exercise: str):
    return Path(base_dir) / "ideals" / f"{exercise}.json"

def feedback_pipeline(s3_client, output_bucket):
    user_id = os.getenv("USER_ID")
    recording_id = os.getenv("RECORDING_ID")
    recording_start = os.getenv("RECORDING_START_MS")
    timestamps_raw = os.getenv("TIMESTAMPS_JSON")
    timestamps = json.loads(timestamps_raw) if timestamps_raw else []

    # convert recording start to ms
    recording_start_ms = int(recording_start)

    workdir = Path("/tmp/video-worker")
    clips_dir = workdir / "clips"
    clips_dir.mkdir(parents=True, exist_ok=True)

    clip_paths = []

    for i, t in enumerate(timestamps):
        try:
            start_ms = int(t["starttime"])
            end_ms = int(t["endtime"])
            exercise = t.get("exercise")

            # convert to offsets relative to recording start
            start_offset = max(0, (start_ms - recording_start_ms) / 1000)
            duration = max(0.1, (end_ms - start_ms) / 1000)

            clip_path = clips_dir / f"{exercise}_{i}.mp4"

            cmd = [
                "ffmpeg",
                "-y",
                "-i", str(workdir / "final_fixed.mp4"),
                "-ss", str(start_offset),
                "-t", str(duration),
                "-c:v", "libx264",
                "-c:a", "aac",
                str(clip_path),
            ]

            subprocess.run(cmd, check=True)
            clip_paths.append((clip_path, exercise, t, i))

        except Exception as e:
            print(f"Skipping timestamp {i} due to error: {e}")
            continue

    for clip_path, exercise, t, i in clip_paths:
        try:
            json_dir = workdir / "json"
            json_dir.mkdir(parents=True, exist_ok=True)
            model_path = Path(base_dir / "feedback_component" / "pose_landmarker_heavy.task").resolve()            
            feedback = generate_comparison(exercise_name=exercise, video_file=clip_path, ideal_file=get_ideal_path(exercise), json_dir=json_dir, model_path=model_path)

            # Store clips + feedback
            clip_output_key = build_output_key_clip(recording_id=recording_id, index=i)
            processed_video_url = upload_file(s3_client, clip_path, output_bucket, clip_output_key)
            duration = t["endtime"] - t["starttime"]

            save_clip_callback(recording_id=recording_id, processed_video_url=processed_video_url, exercise=exercise, feedback=feedback, user_id=user_id, duration=duration)

        except Exception as e:
            print(f"generate_comparison failed for {clip_path}: {e}")


def main() -> int:
    recording_id = require_env("RECORDING_ID")
    raw_s3_prefix = require_env("RAW_S3_PREFIX")
    aws_region = os.getenv("AWS_REGION", "us-west-2")

    input_bucket, input_prefix = parse_s3_prefix(raw_s3_prefix)
    output_bucket = os.getenv("OUTPUT_BUCKET", input_bucket)
    output_key = build_output_key(recording_id)

    workdir = Path("/tmp/video-worker")
    hls_dir = workdir / "high"
    output_file = workdir / f"final_fixed.mp4"

    s3_client = boto3.client("s3", region_name=aws_region)

    print(
        "Starting video worker",
        {
            "recordingId": recording_id,
            "inputBucket": input_bucket,
            "inputPrefix": input_prefix,
            "outputBucket": output_bucket,
            "outputKey": output_key,
        },
    )

    hls_prefix = f"{input_prefix}/media/hls/high/"
    downloaded = download_prefix(s3_client, input_bucket, hls_prefix, hls_dir)

    if downloaded == 0:
        raise RuntimeError(f"No HLS files found under s3://{input_bucket}/{hls_prefix}")

    playlist_path = hls_dir / "playlist.m3u8"
    if not playlist_path.exists():
        raise RuntimeError(f"Missing playlist at {playlist_path}")

    run_ffmpeg(playlist_path, output_file)

    if not output_file.exists():
        raise RuntimeError("ffmpeg did not produce an output file")

    try:
        feedback_pipeline(s3_client, output_bucket)
    except Exception as e:
        print(f"feedback pipeline failed (skipping): {e}")

    # Store full video
    processed_video_url = upload_file(s3_client, output_file, output_bucket, output_key)
    print("Uploaded processed video:", processed_video_url)

    maybe_callback(recording_id, processed_video_url, output_bucket, output_key)
    print("Video worker completed successfully.")
    ensure_clean_dir(workdir)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Video worker failed: {exc}", file=sys.stderr)
        raise

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Tuple

import boto3
import requests


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


def main() -> int:
    recording_id = require_env("RECORDING_ID")
    raw_s3_prefix = require_env("RAW_S3_PREFIX")
    aws_region = os.getenv("AWS_REGION", "us-west-2")

    input_bucket, input_prefix = parse_s3_prefix(raw_s3_prefix)
    output_bucket = os.getenv("OUTPUT_BUCKET", input_bucket)
    output_key = build_output_key(recording_id)

    workdir = Path(os.getenv("WORKDIR", "/tmp/video-worker"))
    hls_dir = workdir / "high"
    output_file = workdir / "final_fixed.mp4"

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

    ensure_clean_dir(workdir)
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

    processed_video_url = upload_file(s3_client, output_file, output_bucket, output_key)
    print("Uploaded processed video:", processed_video_url)

    maybe_callback(recording_id, processed_video_url, output_bucket, output_key)
    print("Video worker completed successfully.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Video worker failed: {exc}", file=sys.stderr)
        raise

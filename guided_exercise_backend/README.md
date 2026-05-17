# Guided Exercise Backend

Express + TypeScript API for the Guided Exercise app. The backend owns profile data, session lifecycle, IVS token creation, participant tracking, recordings, push notifications, S3 playback URLs, and ECS/Fargate recording processing jobs.

## Stack

- Node.js + Express
- TypeScript, ESM, path alias `@/*`
- Firebase Admin SDK
- Firestore collections for profiles, sessions, participants, recordings, telemetry, push tokens
- Firebase Cloud Messaging for browser push
- Expo Server SDK for native Expo push
- AWS IVS RealTime SDK
- AWS S3 signed URLs
- AWS ECS RunTask for video worker jobs

## Run Locally

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:4000
```

The app binds to `0.0.0.0` and uses:

```ts
Number(process.env.PORT) || 4000
```

so Render and other cloud hosts can inject their own port.

## Scripts

```bash
npm run dev          # tsx watch server
npm run type-check   # TypeScript only, no emit
npm run build        # compile to dist
npm start            # run dist/app.js
```

## Environment Variables

Required for core API:

```env
PORT=4000
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@example.iam.gserviceaccount.com
AWS_REGION=us-west-2
IVS_STAGE_ARN=arn:aws:ivs:us-west-2:123456789012:stage/your_stage_id
```

Required for AWS SDK calls in production:

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
```

Required for recording ingest:

```env
RECORDING_INGEST_SECRET=replace_with_strong_random_secret
```

Required for push notification reminder cron:

```env
NOTIFICATION_CRON_SECRET=replace_with_strong_random_secret
```

Optional for Expo native push:

```env
EXPO_ACCESS_TOKEN=your_expo_access_token
```

Required if recording processing is enabled:

```env
AUTO_START_RECORDING_PROCESSING=true
ECS_CLUSTER_ARN=arn:aws:ecs:us-west-2:123456789012:cluster/your_cluster_name
ECS_TASK_DEFINITION=your_task_definition_name_or_arn
ECS_CONTAINER_NAME=video-worker
ECS_SUBNET_IDS=subnet-abc123,subnet-def456
ECS_SECURITY_GROUP_IDS=sg-abc123
ECS_ASSIGN_PUBLIC_IP=ENABLED
WORKER_OUTPUT_BUCKET=your_processed_video_bucket
WORKER_CALLBACK_URL=https://your-backend.example.com/api/recordings/worker-complete
WORKER_SHARED_SECRET=replace_with_strong_random_secret
```

`FIREBASE_PRIVATE_KEY` must preserve newline escapes. In most cloud dashboards, store it with `\n` sequences exactly as copied from the service account JSON.

## Firebase Data Model

Main collections:

- `profiles` - app users, roles, names, email.
- `sessions` - class metadata, owner, code, stage ARN, status, schedule times.
- `sessions/{sessionId}/participants` - IVS participants, app user ids, display names, active/left state, heartbeat.
- `recordings` - raw S3 prefix, participant/user/session linkage, processing status, processed output URL.
- `pushTokens` - Expo and web FCM push tokens per user.
- `telemetry` - client-side IVS events used for debugging.

## Session Lifecycle

Session status values:

- `scheduled`
- `live`
- `ended`

Important rules:

- Every session has an `instructorUid`; that user owns the session.
- Only the session owner can start, cancel, or end that session.
- Other instructor accounts may join a live session, but the app treats them as students inside that session.
- Scheduled sessions can only be started inside the configured start window, currently 5 minutes before scheduled start.
- Starting one session ends other live sessions and disconnects known IVS participants.

## API Surface

Health:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Basic health check |
| `GET` | `/health` | Basic health check |

Profiles:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/firebase/createProfile` | Create user profile after Firebase Auth signup |
| `POST` | `/api/firebase/getProfile` | Hydrate app profile after login |
| `POST` | `/api/firebase/updateProfile` | Update username/full name |
| `GET` | `/api/firebase/users?role=student` | List profiles, optionally by role |
| `POST` | `/api/firebase/getAchievements` | Return profile achievement data |

IVS and sessions:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/ivs/token` | Create IVS participant token |
| `POST` | `/api/ivs/telemetry` | Store client IVS telemetry |
| `POST` | `/api/ivs/sessions/create` | Create scheduled/direct session metadata |
| `POST` | `/api/ivs/sessions/start` | Mark owned session live |
| `POST` | `/api/ivs/sessions/join` | Join live session by code |
| `POST` | `/api/ivs/sessions/end` | End/cancel owned session |
| `GET` | `/api/ivs/sessions?status=live,scheduled` | List sessions by status |
| `GET` | `/api/ivs/sessions/:sessionId` | Fetch one session |
| `GET` | `/api/ivs/sessions/:sessionId/participants` | List session participants |
| `POST` | `/api/ivs/sessions/participants/upsert` | Register/update participant |
| `POST` | `/api/ivs/sessions/participants/heartbeat` | Keep participant active |
| `POST` | `/api/ivs/sessions/participants/leave` | Mark participant left |

Recordings:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/recordings/upsert` | Ingest/update a recording from IVS/EventBridge/manual source |
| `GET` | `/api/recordings/session/:sessionId` | List recordings for a session |
| `GET` | `/api/recordings/user/:userId` | List recordings for a user, including session names when resolvable |
| `GET` | `/api/recordings/:recordingId/playback` | Return signed playback URL |
| `POST` | `/api/recordings/:recordingId/process` | Start/retry ECS processing |
| `POST` | `/api/recordings/worker-complete` | Worker callback after processing |

Notifications:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/notifications/register-token` | Register native Expo or web FCM token |
| `POST` | `/api/notifications/unregister-token` | Disable a token |
| `POST` | `/api/notifications/class-reminders/send-due` | Cron endpoint for 5-minute class reminders |

Legacy/basic AWS helpers:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/aws/uploadVideo` | Upload video helper |
| `POST` | `/api/aws/getVideo` | Signed video URL helper |
| `POST` | `/api/firebase/addRecording` | Legacy recording write |
| `POST` | `/api/firebase/getUserRecordings` | Legacy recording read |

## Recording Ingest

`POST /api/recordings/upsert` requires:

- `x-ingest-secret: RECORDING_INGEST_SECRET`
- `sessionId`
- `participantId`
- `rawS3Prefix`

The controller resolves the app session in this order:

1. Match `sessionId` against stored `ivsSessionId`.
2. Match `sessionId` against app `sessionId`.
3. Fall back to latest known participant linkage.
4. Backfill `ivsSessionId` when an IVS session id is discovered.

If `AUTO_START_RECORDING_PROCESSING=true`, completed EventBridge ingests automatically claim the recording and start an ECS worker task.

## Recording Worker Callback

`POST /api/recordings/worker-complete` requires:

- `x-worker-secret: WORKER_SHARED_SECRET`
- `recordingId`
- `processedVideoUrl` on success
- optional `feedbackJsonUrl`
- optional `status: failed` and `error` on failure

On success, the backend marks the recording `completed` and notifies the owner. On failure, it marks the recording `failed` unless a processed video already exists.

## Class Reminder Cron

Call this endpoint every minute from a cron service:

```bash
curl -X POST https://YOUR_BACKEND_URL/api/notifications/class-reminders/send-due \
  -H "x-cron-secret: YOUR_NOTIFICATION_CRON_SECRET"
```

It checks scheduled sessions starting within five minutes, sends student notifications, and marks each reminder as sent.

## Deployment Notes

Render configuration should point at this folder:

```text
Root Directory: guided_exercise_backend
Build Command: npm install && npm run build
Start Command: npm start
```

When frontend code calls a new backend endpoint, deploy backend first, then redeploy web/TestFlight builds.

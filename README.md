# Move Together, Heal Together

Cross-platform guided exercise platform for instructor-led therapeutic exercise classes. The repo contains the Expo app, the Express/Firebase/AWS backend, and the ECS video worker used to process Amazon IVS recordings.

## Repository Structure

- `guided_exercise/` - Expo React Native app for iOS, Android, and web.
- `guided_exercise_backend/` - Express + TypeScript API for Firebase, IVS, notifications, recordings, and AWS worker orchestration.
- `video_worker/` - Python/ffmpeg worker container run by ECS/Fargate to convert raw IVS HLS recordings into MP4 files.

## Architecture

```text
Expo app
  |-- Firebase Auth for sign-in, sign-up, password reset
  |-- Firestore realtime listeners for classes, participants, and session state
  |-- Backend REST API for profiles, IVS tokens, session lifecycle, recordings, notifications
  |-- Amazon IVS Real-Time Stage for live video
  |-- Expo push notifications on native, Firebase web push on browser

Backend
  |-- Firebase Admin SDK for profiles, sessions, participants, recordings, telemetry, push tokens
  |-- AWS IVS RealTime SDK for stage participant tokens and disconnects
  |-- AWS S3 signed URLs for recording playback
  |-- AWS ECS RunTask for post-processing recordings

Video worker
  |-- Downloads raw IVS HLS from S3
  |-- Runs ffmpeg to produce final_fixed.mp4
  |-- Uploads processed MP4 to S3
  |-- Calls backend callback to mark recording completed or failed
```

## Main Product Flows

### Instructor

1. Signs in with Firebase Auth.
2. Creates a class from the schedule screen or direct start screen.
3. Starts a class when allowed by the lifecycle rules.
4. Receives an IVS participant token from the backend.
5. Publishes camera/mic into the shared IVS Real-Time stage.
6. Ends or cancels sessions they own.

Only the instructor account that created a session is treated as the session owner. Other instructor accounts can still join a live session, but they are treated as students for that session.

### Student

1. Signs in with Firebase Auth.
2. Watches live and scheduled classes through Firestore realtime listeners.
3. Joins live sessions using the session code/session metadata.
4. Receives a subscribe/publish IVS token for participation.
5. Gets class reminders and recording notifications when push is enabled.

### Recordings

1. IVS recording ingest calls the backend with a raw S3 prefix.
2. Backend resolves the app session and participant from the IVS metadata.
3. Recording appears in the app as queued, processing, completed, or failed.
4. Backend can start the ECS video worker automatically or from the app retry button.
5. Worker converts the raw HLS stream to MP4 and calls the backend callback.
6. App playback uses short-lived signed S3 URLs.

## Local Development

Run the backend first:

```bash
cd guided_exercise_backend
npm install
npm run dev
```

The backend defaults to `http://localhost:4000`.

Run the app:

```bash
cd guided_exercise
npm install
npx expo start
```

Use this frontend env shape:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
```

For physical iOS/Android devices, replace `localhost` with your machine IP:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4000
```

For production web and TestFlight builds:

```env
EXPO_PUBLIC_API_URL=https://ai-guided-exercise-031f.onrender.com
```

Do not include a trailing `/api`; frontend API helpers add `/api/...` paths themselves.

## Deployment

### Backend

The backend is designed for Render or any Node host that provides `PORT`.

```bash
cd guided_exercise_backend
npm run build
npm start
```

Render should build from the backend package and run `npm start`. Required backend environment variables are documented in [guided_exercise_backend/README.md](guided_exercise_backend/README.md).

### Web

Expo web is deployed with EAS Hosting.

```bash
cd guided_exercise
rm -rf dist
npx expo export --platform web --clear
npx eas-cli deploy --prod
```

Production URL:

```text
https://guided-exercise.expo.app
```

### iOS TestFlight

```bash
cd guided_exercise
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

## Useful Commands

Backend:

```bash
cd guided_exercise_backend
npm run type-check
npm run build
npm run dev
```

Frontend:

```bash
cd guided_exercise
npm run lint
npx expo start
npx expo export --platform web --clear
```

Video worker:

```bash
docker build -t video-worker ./video_worker
```

## More Documentation

- Frontend details: [guided_exercise/README.md](guided_exercise/README.md)
- Backend details: [guided_exercise_backend/README.md](guided_exercise_backend/README.md)
- Video worker details: [video_worker/README.md](video_worker/README.md)

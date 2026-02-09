# Zoom Teacher Flow (V1)

## Goal
Enable a teacher to create and join a Zoom Video SDK session inside the app.

## Minimal V1 Flow
1. Teacher opens Start Meeting screen.
2. Teacher enters `sessionName` and `userName`.
3. App requests a Zoom Video SDK JWT from backend.
4. App joins the session using the Zoom Video SDK.
5. Teacher sees in-session view (self + participants).

## Required Environment Variables
Frontend (Expo):
- `EXPO_PUBLIC_API_URL` (e.g. `http://localhost:4000`)

Backend (Express):
- `ZOOM_SDK_KEY`
- `ZOOM_SDK_SECRET`

## Backend Changes
Add a new endpoint:
- `POST /api/zoom/token`
- Body: `{ sessionName, userName, role }`
- Returns: `{ token }`

JWT is created server-side using the Zoom Video SDK key/secret.

## Frontend Changes
Add a small API wrapper:
- `src/api/zoom.ts` with `getZoomToken(...)`

Add teacher screens:
- `app/(teacher)/start-meeting.tsx` (inputs + start)
- `app/(teacher)/session.tsx` (join + video + leave)

## Commit Order
1. docs: map teacher zoom flow
2. backend: add zoom token endpoint
3. frontend: add zoom api client
4. teacher: start meeting screen
5. teacher: session join/leave
6. ux: loading/errors/permissions

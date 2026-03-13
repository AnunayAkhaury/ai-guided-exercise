# Move Together, Heal Together

Mobile + backend platform for virtual therapeutic exercise classes for pediatric and young adult oncology patients and survivors.

The app enables:
- Instructor-led live classes over Amazon IVS Real-Time Stage
- Student discovery and join flow for live/scheduled sessions
- Session lifecycle management (scheduled, live, ended)
- Firebase-based auth/profile data and class metadata
- TestFlight alpha distribution

## Repository Structure

- `guided_exercise/` React Native Expo app (iOS/Android)
- `guided_exercise_backend/` Node/Express backend (IVS + Firebase APIs)

## Core Stack

- Frontend: Expo, React Native, Expo Router, Zustand
- Video: `expo-realtime-ivs-broadcast` (Amazon IVS Real-Time)
- Backend: Express + TypeScript
- Data/Auth: Firebase (Auth + Firestore)
- Deployment:
  - Backend: Render
  - iOS app distribution: EAS Build + TestFlight

## Key Product Flows

### Instructor
1. Schedule class (title, date/time, duration)
2. Class appears in instructor Classes view
3. Start class when ready
4. Join IVS stage and run session
5. End session to close class lifecycle

### Student
1. Open Classes tab
2. See live/ready/scheduled classes
3. Join live class
4. Auto-exit when instructor ends session

## IVS Session Lifecycle (Current)

- Backend session APIs:
  - `POST /api/ivs/sessions/create`
  - `POST /api/ivs/sessions/start`
  - `POST /api/ivs/sessions/join`
  - `POST /api/ivs/sessions/end`
  - `GET /api/ivs/sessions?status=...`
  - `GET /api/ivs/sessions/:sessionId`
- Frontend creates/starts/joins using session tokens
- Shared stage is reused, while each class run creates a new stage session timeline

## Local Development

## 1) Backend

From `guided_exercise_backend/`:

```bash
npm install
npm run dev
```

Default local backend: `http://localhost:4000`

See backend README for required Firebase service configuration:
- [guided_exercise_backend/README.md](guided_exercise_backend/README.md)

## 2) Mobile app

From `guided_exercise/`:

```bash
npm install
npx expo start
```

Set env in `guided_exercise/.env`:

```env
EXPO_PUBLIC_API_URL=http://<your-ipv4>:4000/api
```

For deployed backend:

```env
EXPO_PUBLIC_API_URL=https://<your-render-service>.onrender.com/api
```

Important:
- Use `EXPO_PUBLIC_*` vars only for client-safe values.
- Do not place secrets in frontend env.

## iOS Alpha Release (TestFlight)

From `guided_exercise/`:

```bash
npx eas-cli@latest build -p ios --profile production
npx eas-cli@latest submit -p ios
```

Then in App Store Connect:
1. Wait for build processing
2. Add build to internal testing group(s)
3. Invite testers / verify install status

## Production Notes

- Backend must be reachable from devices (Render URL configured in app env)
- Keep Expo project env (`EXPO_PUBLIC_API_URL`) updated for production builds
- If release crashes differ from local debug behavior, test in local `Release` scheme and capture device logs

## Current Focus Areas

- Stable session lifecycle across repeated class runs
- Better in-call UX (camera-off states, mute affordances)
- Role-based auth and class routing
- TestFlight-friendly error handling and observability

## Additional Docs

- Frontend README: [guided_exercise/README.md](guided_exercise/README.md)
- Backend README: [guided_exercise_backend/README.md](guided_exercise_backend/README.md)

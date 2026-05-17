# Guided Exercise Frontend

Expo app for iOS, Android, and web. The app uses Expo Router, Firebase Auth, Firestore realtime listeners, Amazon IVS Real-Time, Expo notifications, Firebase web push, and a small shared component layer.

## Stack

- Expo SDK 54
- React Native + React Native Web
- Expo Router file-based navigation
- Zustand for local user/call state
- Firebase Auth client SDK
- Firestore listeners for live session state
- `expo-realtime-ivs-broadcast` for native IVS calls
- Browser IVS implementation in `src/components/IvsCall.web.tsx`
- Expo Notifications on native
- Firebase web push through `public/firebase-messaging-sw.js`
- EAS Build for iOS TestFlight
- EAS Hosting for web

## Routes

- `app/index.tsx` - auth bootstrap and role routing.
- `app/(onboarding)/login.tsx` - login and password reset.
- `app/(onboarding)/signup.tsx` - account and profile creation.
- `app/(tabs)/_layout.tsx` - role-aware tab shell.
- `app/(tabs)/(teacher)/classes.tsx` - teacher live/ready/scheduled class dashboard.
- `app/(tabs)/(teacher)/schedule.tsx` and `.web.tsx` - schedule a class.
- `app/(tabs)/(teacher)/start-meeting.tsx` - direct start or launch a scheduled class.
- `app/(tabs)/(teacher)/students.tsx` - instructor student directory.
- `app/(tabs)/(student)/classes.tsx` - student class discovery and join flow.
- `app/(tabs)/(teacher)/recordings.tsx` - instructor recordings.
- `app/(tabs)/(student)/recordings.tsx` - student recordings.
- `app/(tabs)/session.tsx` - live IVS class screen.
- `app/(extra)/recording-display.*.tsx` - recording playback.
- `app/(tabs)/profile*.tsx` and `app/edit-profile.tsx` - profile and achievements.

## Source Layout

- `src/api/ivs.ts` - backend IVS/session/recording API client and token cache.
- `src/api/Firebase/firebase-auth.tsx` - Firebase Auth plus backend profile hydration.
- `src/api/notifications.ts` - push token registration API client.
- `src/components/IvsCall.tsx` - native IVS call implementation.
- `src/components/IvsCall.web.tsx` - web IVS call implementation.
- `src/components/notifications/` - native and web push registration providers.
- `src/components/ui/ToastProvider.tsx` - cross-platform in-app toasts.
- `src/hooks/use-ivs-firestore.ts` - realtime Firestore listeners for sessions and participants.
- `src/hooks/use-session-participant-heartbeat.ts` - participant heartbeat while in class.
- `src/store/userStore.tsx` - hydrated user profile state.

## Environment

Create `guided_exercise/.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:4000
```

For a physical device pointed at your local backend:

```env
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4000
```

For production:

```env
EXPO_PUBLIC_API_URL=https://ai-guided-exercise-1.onrender.com
```

Important:

- Do not include `/api` at the end. API helpers append `/api/...`.
- Only put client-safe values in `EXPO_PUBLIC_*` variables.
- Backend secrets, AWS keys, Firebase Admin keys, worker secrets, and cron secrets belong in `guided_exercise_backend/.env` or host environment variables.

Optional web push variable:

```env
EXPO_PUBLIC_FIREBASE_WEB_PUSH_VAPID_KEY=your_firebase_web_push_vapid_key
```

Native Expo push works without this VAPID key. Browser push needs Firebase web push configuration.

## Local Development

```bash
npm install
npx expo start
```

Common targets:

```bash
npx expo start --web
npx expo start --ios
npx expo start --android
```

Run lint:

```bash
npm run lint
```

## Web Deployment

```bash
rm -rf dist
npx expo export --platform web --clear
npx eas-cli deploy --prod
```

Production URL:

```text
https://guided-exercise.expo.app
```

If production looks stale, check the generated bundle before deploy:

```bash
rg "expected text or feature name" dist/_expo/static/js/web
```

Then open the production URL in an incognito window to bypass browser cache.

## iOS TestFlight

Build and submit:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

Use a new EAS build for native changes, native dependency changes, IVS native code changes, notification permission changes, or any change you need TestFlight users to receive.

## Live Class Flow

1. App loads user profile after Firebase Auth login.
2. Role-aware tabs route instructors and students to their own class screens.
3. Class lists are backed by Firestore realtime listeners.
4. Teacher start/join or student join requests an IVS token from the backend.
5. App upserts the session participant record and starts heartbeat updates.
6. `app/(tabs)/session.tsx` determines the effective session role from the session owner, not just the account role.
7. `IvsCall` renders native or web video, with mute/camera controls and leave/end behavior.

## Recordings Flow

1. Recording screens load recordings by user through `/api/recordings/user/:userId`.
2. Cards show processing state: queued, processing, failed, completed.
3. Playback is disabled until the backend has a playable raw HLS or processed MP4 URL.
4. Retry/process calls `/api/recordings/:recordingId/process`.
5. Playback routes to `recording-display` with a short-lived signed URL from the backend.

## Push Notifications

The app registers push tokens after a user is logged in:

- Native: Expo push token, sent as `type: "expo"`.
- Web: Firebase web push token, sent as `type: "fcm_web"`.

Backend notifications currently cover:

- New class scheduled
- Class live
- Class canceled
- Class reminder
- Recording ready
- Recording failed

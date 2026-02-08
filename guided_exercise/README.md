# Guided Exercise App

This is an [Expo](https://expo.dev) app using [Expo Router](https://docs.expo.dev/router/introduction/) and file-based routing.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

## Project structure

- `app/` routes (file-based routing)
  - `app/_layout.tsx` root stack
  - `app/(tabs)/_layout.tsx` tabs layout
  - `app/(tabs)/` tab screens
- `src/` shared code (components, hooks, constants, assets)

## Environment variables

Create an .env file in the root of the project and fill in your configuration values:

```
# Firebase Config
EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID

# API Url
EXPO_PUBLIC_API_URL=YOUR_API_URL
```

- Firebase configs can be found by clicking settings (gear icon) -> General -> scroll down to "Your apps"
- API Url should be in the format of "http://\<your IPv4 address\>:4000/api"
  - IPv4 address can be found using ipconfig.
  - localhost works for web but will not work for Expo Go.

Note: All variables prefixed with EXPO_PUBLIC are safe to be exposed to the client. Do not put private keys or secrets in .env.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router documentation](https://docs.expo.dev/router/introduction/)

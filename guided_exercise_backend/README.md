# AI-Guided Feedback Exercise App Backend

Backend for the AI-Guided Feedback Exercise App using **Express** and **Firebase**.

## Requirements

- Node.js v18+
- npm or yarn
- Firebase project with Owner or Service Account access

## Setup

1. Install dependencies:

```bash
npm install
```

or

```bash
yarn install
```

2. Create `development_env.json` in the project root (backend):

```json
{
  "FIREBASE_PROJECT_ID": "<your-firebase-project-id>",
  "FIREBASE_PRIVATE_KEY": "<your-firebase-private-key>",
  "FIREBASE_CLIENT_EMAIL": "<your-firebase-client-email>"
}
```

> To get these values, go to Firebase Console → Project Settings → Service Accounts → Generate new private key. Copy the fields above into this file and ignore the rest of the fields.

## Run the server

```bash
npm run dev
```

or

```bash
yarn dev
```

Developement server runs at: `http://localhost:4000`

## API Endpoints

| Method | Endpoint           | Description                   | Request Body                                                                              | Response              |
| ------ | ------------------ | ----------------------------- | ----------------------------------------------------------------------------------------- | --------------------- |
| GET    | `/`                | hello world check             | —                                                                                         | `{ "message": "OK" }` |
| POST   | `/api/createUsers` | Create a new user in Firebase | `{ "email": "string", "password": "string", "username": "string", "fullname": "string" }` | `{ "uid": "string" }` |

> POST requests must be `application/json`.
> Please update the endpoint list when you add a new endpoint.

## Notes

- Do not commit `development_env.json`.
- Use Postman for testing or add functions in frontend src/api.

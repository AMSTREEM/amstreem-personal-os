# Amstreem Atlas — Mobile

Native iOS and Android client. The existing desktop web application remains in the repository root and is not replaced.

## Architecture
- Expo + React Native + TypeScript.
- Supabase Auth for the same accounts used by the web app.
- Existing Atlas Express API for workspace data; no second database.
- Only the Supabase publishable key belongs in this app. Never add a secret or service-role key.

## Local setup
1. Install Node.js 22.13 or newer.
2. Copy `.env.example` to `.env`.
3. Set the Supabase project URL and publishable key. The public values are in the web app's `public/supabase-config.js`; do not copy any server secret.
4. Keep `EXPO_PUBLIC_ATLAS_API_URL` set to the deployed Atlas API origin.
5. Run `npm install`, `npx expo install --fix`, `npm run typecheck`, then `npm start`.
6. Install Expo Go on an iPhone or Android device and scan the development QR code.

## Current milestone
Persistent Supabase sign-in (email or existing username), authenticated app shell, overview metrics, and task completion. More Atlas sections will be ported in stages and tested against the existing API.

Store submission is out of scope until the app is complete and tested. No paid publishing account is needed for local development.

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a3de6108-f90d-4245-903d-294dda97dca1

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create `.env.local` and set:
   `GEMINI_API_KEY=your_key`
3. Start backend server:
   `npm run dev:server`
4. In another terminal, start frontend:
   `npm run dev`

Frontend runs on `http://localhost:3000` and proxies `/api` to `http://localhost:8787`.

## Run as a Single Server (Production Style)

1. Build frontend assets:
   `npm run build`
2. Start Express server:
   `npm run start`

The server hosts API endpoints and serves `dist/` on `http://localhost:8787` (or `PORT`).

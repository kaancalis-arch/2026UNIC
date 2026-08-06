<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/da65f030-8e8d-427b-bc44-4334fe360e7f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure the frontend environment variables from [.env.example](.env.example). UNIC AI Danışman calls OpenAI only through authenticated Supabase Edge Functions; configure server-side secrets as described in [AI Advisor Setup](docs/AI_ADVISOR_SETUP.md) and [Deployment and Auth Setup](docs/DEPLOYMENT_AUTH_SETUP.md).
3. Run the app:
   `npm run dev`

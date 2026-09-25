# SkillLink prototype deployment

The SkillLink app is a Vite/React frontend. Its existing account and booking data is stored in browser `localStorage`; this chat prototype deliberately reuses that store and does not add a second booking system. It does not add email, payments, M-Pesa, or SMS.

## Vercel

1. Import the repository into Vercel and keep the **Root Directory** at the repository root. `vercel.json` builds `@workspace/skilllink` and publishes its Vite output; it also rewrites the app's client-side routes to the single-page entry point.
2. Add `OPENAI_API_KEY` as a Vercel environment variable to enable AI replies. The key is read only by the server-side `/api/chat` function and must not use a `VITE_` prefix.
3. Redeploy after adding the variable.

The default model is `gpt-4o-mini`. Optionally set `OPENAI_MODEL` to another compatible model or `OPENAI_BASE_URL` to an OpenAI-compatible API base URL ending before `/chat/completions`. The provider wrapper lives in `artifacts/api-server/src/lib/assistant-provider.ts`; the Vercel function and the existing Express API both call it.

Without `OPENAI_API_KEY`, the UI falls back to a small guided flow so the draft/confirmation path can still be tried, but responses are not AI-generated. The chat API has a small in-memory request limit; it is suitable for a prototype, not a substitute for production abuse controls.

## Replit preview

Add the same `OPENAI_API_KEY` through Replit Secrets to enable AI replies through the existing `/api/chat` route. Do not commit the key or put it in frontend environment variables.

## Prototype boundaries

- The assistant asks for service, description, location, preferred date, and preferred time.
- It only calls the existing `createJob` store function after the customer presses **Confirm & create request**. Typing “yes” alone does not create anything.
- Created jobs appear in the existing local dashboard on that browser. This repository does not currently provide shared server-side accounts/bookings or secure status lookups.
- Availability and account-specific status are not asserted by the assistant. Email notifications are deferred.
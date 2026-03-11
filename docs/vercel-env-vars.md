# Vercel environment variables (Supabase + Gemini)

Set these in your Vercel project: **Settings → Environment Variables**. Apply to **Production** (and Preview if you want the same for PR previews).

---

## Required

| Variable | Description | Where to get it |
|----------|-------------|------------------|
| **`NEXT_PUBLIC_SUPABASE_URL`** | Supabase project URL | Supabase Dashboard → Project Settings → API → Project URL |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Supabase anon/public key | Supabase Dashboard → Project Settings → API → anon public |
| **`GOOGLE_GENERATIVE_AI_API_KEY`** | Gemini API key | [Google AI Studio](https://aistudio.google.com/app/apikey) (or use `GEMINI_API_KEY`) |

---

## Optional

| Variable | Description |
|----------|-------------|
| **`GEMINI_MODEL`** | Override Gemini model (default: `gemini-2.0-flash`) |

---

## After first deploy

In **Supabase → Authentication → URL Configuration**, set **Site URL** to your Vercel URL (e.g. `https://your-app.vercel.app`) so auth redirects work.

---

## Summary

- **Auth & DB:** Supabase (no Turso, no Prisma, no NextAuth).
- **AI:** Gemini via `@ai-sdk/google`; env: `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`.
- **Build:** `npm run build` (Next.js only).

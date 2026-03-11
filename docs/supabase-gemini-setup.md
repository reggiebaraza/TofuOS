# Supabase + Gemini setup

This app uses **Supabase** for auth and database, and **Google Gemini** for AI (personas, chat, insights).

---

## 1. Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project (or use an existing one).
2. In the dashboard: **Project Settings → API**:
   - Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. In **SQL Editor**, run the migration that creates tables and RLS:
   - Open `supabase/migrations/001_initial.sql` in this repo.
   - Copy its contents into the SQL Editor and run it.
   - This creates `profiles`, `personas`, `interviews`, `messages` and Row Level Security so users only see their own data.

---

## 2. Enable Email auth

- In Supabase: **Authentication → Providers → Email**.
- Ensure **Email** is enabled (default).
- Optional: turn on **Confirm email** if you want users to verify their address before signing in.

---

## 3. Gemini API key

1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create an API key.
3. Set one of these in your env (the app reads whichever is set):
   - **`GOOGLE_GENERATIVE_AI_API_KEY`** (recommended), or
   - **`GEMINI_MODEL`** is optional; default is `gemini-2.0-flash`.

---

## 4. Local env

Create `.env.local` (from `.env.example`):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

Run the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then **Create one** to register. The trigger in the DB will create a `profiles` row with your name from signup.

---

## 5. Deploy to Vercel

1. Push the repo to GitHub and import the project in [Vercel](https://vercel.com).
2. In the Vercel project: **Settings → Environment Variables**. Add:

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `GOOGLE_GENERATIVE_AI_API_KEY` | Your Gemini API key |

3. Deploy. After the first deploy, in Supabase **Authentication → URL Configuration**, set **Site URL** to your Vercel URL (e.g. `https://your-app.vercel.app`) so redirects work.

---

## Summary

- **Auth & DB:** Supabase (Postgres + Auth). No Prisma or NextAuth.
- **AI:** Gemini via `@ai-sdk/google`; env: `GOOGLE_GENERATIVE_AI_API_KEY` (or `GEMINI_API_KEY`).
- **Build:** `npm run build` (no Prisma generate).

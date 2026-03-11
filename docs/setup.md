# Setup

## Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** (install via `npm install -g pnpm` or corepack)
- For production deploy: **Turso** (hosted SQLite), **Vercel** account, optionally **GitHub CLI** (`brew install gh`) and **Vercel CLI** (`npm i -g vercel`)

## Environment Variables

Copy `.env.example` to `.env` and fill in values. Do not commit `.env`.

| Variable | Description | Example |
|----------|-------------|---------|
| `LOCAL_DATABASE_URL` | Optional. Local SQLite path for Prisma CLI (migrations). Fallback: `DATABASE_URL`. | `file:./prisma/dev.db` |
| `DATABASE_URL` | SQLite path for local dev when not using Turso. Use an **absolute** path to avoid "Unable to open database file" errors. | `file:/absolute/path/to/prisma/dev.db` |
| `TURSO_DATABASE_URL` | Turso connection URL (production / Vercel). If set, the app uses Turso instead of local SQLite. | `libsql://your-db.turso.io` |
| `TURSO_AUTH_TOKEN` | Turso auth token. Required when `TURSO_DATABASE_URL` is set. | From `turso db tokens create <db-name>` |
| `NEXTAUTH_SECRET` | Secret for signing JWT/session cookies. Generate: `openssl rand -base64 32`. | Long random string |
| `NEXTAUTH_URL` | Base URL of the app. Local: `http://localhost:3000`. Vercel: `https://your-project.vercel.app`. | |
| `OPENAI_API_KEY` | OpenAI API key for persona generation, chat, and insights. | `sk-...` |

Example `.env` for **local only** (no Turso):

```
DATABASE_URL="file:/path/to/PM-synthetic/prisma/dev.db"
NEXTAUTH_SECRET="change-me-to-a-random-secret-string"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-your-key-here"
```

Example for **local + Turso** (e.g. testing production DB locally):

```
LOCAL_DATABASE_URL="file:./prisma/dev.db"
DATABASE_URL="file:./prisma/dev.db"
TURSO_DATABASE_URL="libsql://your-db.turso.io"
TURSO_AUTH_TOKEN="eyJ..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."
```

## Database Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Generate Prisma client (required after any schema change):
   ```bash
   pnpm prisma generate
   ```

3. **Local SQLite:** Apply migrations (creates/updates the SQLite file):
   ```bash
   pnpm prisma migrate dev
   ```
   For production or CI, use `pnpm prisma migrate deploy` (no interactive prompts).

4. **Turso (for Vercel / production):** The app uses [Turso](https://turso.tech/) (hosted libSQL/SQLite) when `TURSO_DATABASE_URL` is set. Prisma Migrate runs against a local DB; you then apply the same SQL to Turso.

   - Install Turso CLI: `brew install tursodatabase/tap/turso`
   - Log in: `turso auth login` (opens browser).
   - Create a database: `turso db create pm-synthetic` (or another name).
   - Get URL and token:
     ```bash
     turso db show pm-synthetic --url
     turso db tokens create pm-synthetic
     ```
   - Add `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to `.env` (and in Vercel project settings for production).
   - Apply the schema to Turso (run from project root; replace `pm-synthetic` with your DB name and the migration folder with the one under `prisma/migrations/`):
     ```bash
     turso db shell pm-synthetic < ./prisma/migrations/20260306101248_init/migration.sql
     ```
   - For new migrations: run `pnpm prisma migrate dev --name <name>` locally, then apply the new `migration.sql` to Turso with `turso db shell <db-name> < ./prisma/migrations/<timestamp>_<name>/migration.sql`.

## Running Locally

```bash
pnpm dev
```

Default port is 3000. To force a port:

```bash
pnpm dev --port 3000
```

Open [http://localhost:3000](http://localhost:3000), register a user, and use the app.

## Build

```bash
pnpm build
```

Use this to verify the project compiles. Start production server with `pnpm start` (after build).

## Deploying via ngrok (shareable link)

1. Start the dev server (see above), e.g. on port 3000.

2. In a separate terminal, start ngrok:
   ```bash
   ngrok http 3000
   ```

3. Copy the HTTPS URL ngrok shows (e.g. `https://xxx.ngrok-free.dev`).

4. Set in `.env`:
   ```
   NEXTAUTH_URL="https://xxx.ngrok-free.dev"
   ```

5. Restart the dev server so it picks up the new `NEXTAUTH_URL`. Auth callbacks (login, session) will then work when opening the ngrok URL.

6. Share the ngrok URL. Visitors may see a one-time ngrok interstitial; after clicking through, the app loads. The URL stays valid as long as the ngrok process and dev server are running.

## Version control and GitHub

1. **First-time:** Install GitHub CLI and log in:
   ```bash
   brew install gh
   gh auth login
   ```

2. From the project root (if not already a git repo):
   ```bash
   git init
   git add -A && git commit -m "Initial commit"
   ```

3. Create a private repo and push:
   ```bash
   gh repo create PM-synthetic --private --source=. --remote=origin --push --description "Internal app for synthetic PM interviews"
   ```
   If the repo already exists on GitHub, add the remote and push:
   ```bash
   git remote add origin https://github.com/<your-username>/PM-synthetic.git
   git push -u origin main
   ```

## Deploying to Vercel

Production runs on Vercel with Turso as the database (no local SQLite on the server).

1. **Turso:** Complete the Turso steps above (create DB, get URL and token, apply migration).

2. **Vercel CLI (optional):** `npm i -g vercel` then `vercel login`.

3. **Link and deploy:**
   - **Option A — From CLI:** In the project root, run `vercel` (follow prompts to link or create a project). Then set environment variables (see below) in the [Vercel dashboard](https://vercel.com/dashboard) under your project → Settings → Environment Variables. Run `vercel --prod` to deploy.
   - **Option B — From GitHub:** In the [Vercel dashboard](https://vercel.com), import the GitHub repo. Vercel will detect Next.js and pnpm. Add the environment variables, then deploy.

4. **Required environment variables on Vercel:**

   | Variable | Value |
   |----------|--------|
   | `TURSO_DATABASE_URL` | Your Turso DB URL (`libsql://...`) |
   | `TURSO_AUTH_TOKEN` | Token from `turso db tokens create <db-name>` |
   | `NEXTAUTH_SECRET` | Strong random secret (`openssl rand -base64 32`) |
   | `NEXTAUTH_URL` | Production URL, e.g. `https://your-project.vercel.app` (set after first deploy if needed) |
   | `OPENAI_API_KEY` | Your OpenAI API key |
   | `DATABASE_URL` | Optional at build time. Set to your Turso URL (same as `TURSO_DATABASE_URL`) for consistency, or leave unset—the build will still succeed. |

5. After the first deploy, set `NEXTAUTH_URL` to the Vercel project URL and redeploy so auth callbacks work.

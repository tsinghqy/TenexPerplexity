# Deploy Tenexity (P7)

## Prerequisites

- GitHub repo with `main` containing the full app (P1–P6)
- Supabase project with migrations applied (`p4` → `p5` → `p6`)
- OpenAI and/or OpenRouter API keys

## 1. Vercel project

1. Import `TenexPerplexity` from GitHub
2. **Production Branch** = `main` (not an old phase branch)
3. Framework: Next.js (auto)

## 2. Environment variables

Set for **Production** (and Preview if you use it):

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `OPENAI_API_KEY` | Chat + embeddings + search fallback |
| `OPENROUTER_API_KEY` | Optional (Gemini/Claude) |
| `OPENAI_WEB_SEARCH_API_KEY` | Optional dedicated search key |
| `OPENAI_WEB_SEARCH_MODEL` | Optional (e.g. `gpt-4o-mini`) |
| `DEFAULT_MODEL_ID` | Optional |
| `NEXT_PUBLIC_APP_URL` | Full origin, e.g. `https://your-app.vercel.app` |
| `NEXT_PUBLIC_SITE_URL` | Same as app URL (host-only values are normalized) |

Deploy once if you need the `.vercel.app` hostname, then set the two public URL vars and redeploy.

## 3. Supabase auth URLs

**Authentication → URL Configuration**

- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:**
  - `https://your-app.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` (local)

## 4. Database

In Supabase SQL Editor, ensure these ran (in order):

1. `supabase/migrations/p4_combined.sql`
2. `supabase/migrations/p5_combined.sql`
3. `supabase/migrations/p6_combined.sql`

## 5. Smoke test

1. Sign up / sign in on the Vercel URL
2. Send a message with Live sources on
3. Refresh — chat remains in the sidebar
4. Branch from here → Explore map shows a fork edge
5. Drag a card — position survives refresh

## Notes

- Stream and most API routes use the **Edge** runtime
- Prefer Node 22+ locally/on CI when possible (Supabase JS deprecates Node ≤20)
- Custom domain: add in Vercel Domains, then update Site URL, redirects, and `NEXT_PUBLIC_*` URLs

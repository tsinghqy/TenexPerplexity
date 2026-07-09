# TenexPerplexity Setup

## Prerequisites

- Node.js 20+ (Tailwind CSS 4 / `@tailwindcss/oxide` require Node 20+)
- npm (or yarn / pnpm)
- A Supabase project (from P1)
- OpenAI and/or OpenRouter API keys (from P2/P3)

## Step 1: Install dependencies

```bash
cd TenexPerplexity
npm install
```

## Step 2: Environment variables

Copy `.env.example` to `.env.local` and fill in values as phases require them.

```bash
cp .env.example .env.local
```

### Required by phase

| Variable | Phase |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | P1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | P1 |
| `SUPABASE_SERVICE_ROLE_KEY` | P1 (server only) |
| `OPENAI_API_KEY` | P2 (chat + embeddings) |
| `OPENROUTER_API_KEY` | P2/P3 (optional; multi-model + `:online` search) |
| `OPENAI_WEB_SEARCH_API_KEY` | P3 (optional dedicated search key) |
| `OPENAI_WEB_SEARCH_MODEL` | P3 (optional) |
| `DEFAULT_MODEL_ID` | P2 (optional) |
| `NEXT_PUBLIC_APP_URL` | P1+ (auth redirects / OpenRouter referer) |

## Step 3: Supabase (P1+)

1. Create a project at [supabase.com](https://supabase.com)
2. Settings → API: copy Project URL, anon key, service_role key into `.env.local`
3. Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
4. For faster local testing: Authentication → Providers → Email → disable **Confirm email**
5. Run SQL migrations from `supabase/migrations/` in order (added in P4+)

### P1 auth smoke test

1. `npm run dev` → open http://localhost:3000 (should redirect to `/auth/signin`)
2. Sign up with email/password
3. Sign in → land on protected home with your email
4. Sign out → back to sign-in
5. Visit `/` while signed out → redirected to sign-in with `?redirect=/`

## Step 4: Run locally

```bash
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## Step 5: Production (P7)

1. Deploy to Vercel (or similar)
2. Set the same env vars in the host dashboard
3. Add custom domain
4. Update Supabase redirect URLs and `NEXT_PUBLIC_APP_URL`

## Troubleshooting

- **Build errors**: `rm -rf .next && npm install && npm run build`
- **Auth redirects**: confirm Supabase redirect URLs match the app origin
- **Missing API keys**: chat/search routes return clear errors until keys are set

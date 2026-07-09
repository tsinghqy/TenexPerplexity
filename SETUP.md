# Tenexity Setup

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
| `OPENAI_API_KEY` **or** `OPENROUTER_API_KEY` | P2 (at least one) |
| `DEFAULT_MODEL_ID` | P2 (optional) |
| `OPENAI_WEB_SEARCH_API_KEY` | P3 (optional dedicated search key) |
| `OPENAI_WEB_SEARCH_MODEL` | P3 (optional) |
| `NEXT_PUBLIC_APP_URL` | P1+ (auth redirects / OpenRouter referer) |

### P2 streaming chat smoke test

1. Add `OPENAI_API_KEY` and/or `OPENROUTER_API_KEY` to `.env.local`, restart `npm run dev`
2. Sign in → home shows the Tenexity chat UI
3. Send a message → tokens stream into an assistant bubble
4. Stop works mid-stream; Clear resets the thread
5. Without LLM keys, the API returns a clear 503 explaining which env vars to set

## Step 3: Supabase (P1+)

1. Create a project at [supabase.com](https://supabase.com)
2. Settings → API: copy Project URL, anon key, service_role key into `.env.local`
3. Authentication → URL Configuration:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
4. For faster local testing: Authentication → Providers → Email → disable **Confirm email**
5. Run SQL migrations from `supabase/migrations/` in order (P4+)

### P4 persistence migrations

In the Supabase dashboard → **SQL Editor**, run either:

- `supabase/migrations/p4_combined.sql` once, or
- files `001` → `005` in order

This creates `chats`, `nodes`, `node_links`, pgvector, and RLS policies.

### P4 persistence smoke test

1. Sign in → send a message → chat appears in the left sidebar with a title
2. Refresh the page → sidebar still lists the chat
3. Click the chat → messages reload
4. **New chat** → send again → second conversation is separate

### P5 RAG migrations

After P4 SQL is applied, run `supabase/migrations/p5_combined.sql` in the SQL Editor.

### P5 RAG smoke test

1. In one chat: “My project is called Aurora.”
2. Follow up: “What’s my project called?”
3. Answer should use the prior turn (server loads context from `nodes`, not only client history)
4. In Table Editor → `nodes`, the user message row should have a non-null `embedding`

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

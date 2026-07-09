# Tenexity

Streaming answer engine with live web search, citations, and forkable research branches.

> Repo folder: `TenexPerplexity` (package name unchanged). Product name in the UI is **Tenexity**.

## Stack

- Next.js 15 + React 19
- Tailwind CSS 4 + DaisyUI + shadcn/ui
- Supabase (Auth + Postgres + pgvector)
- OpenAI / OpenRouter
- React Flow (Explore map)

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + LLM keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). See `SETUP.md` for env vars and migrations.

## Scripts

```bash
npm run dev      # local server
npm run build    # production build
npm run lint     # ESLint
npm run test     # Vitest
```

## Features (shipped)

| Area | What you get |
|------|----------------|
| Auth | Supabase email sign-up / sign-in, protected home |
| Chat | Streaming answers, model picker, Live sources toggle |
| Citations | Source cards under assistant replies when web search returns URLs |
| Persist | Sidebar chats, reload after refresh |
| RAG | User-message embeddings + linear / path context |
| Explore | Branch from an answer → React Flow map, drag cards, path-scoped follow-ups |

## Deploy

Production checklist: **`DEPLOY.md`**. Local + Supabase setup: **`SETUP.md`**.

## Agent guidance

- `AGENTS.md` — essential context
- `rules/` and `.cursor/rules/` — coding standards
- `agent-rules/` — deeper guidelines

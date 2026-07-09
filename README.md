# TenexPerplexity

Streaming answer engine with live web search, citations, and forkable research branches.

## Stack

- Next.js 15 + React 19
- Tailwind CSS 4 + DaisyUI + shadcn/ui
- Supabase (Auth + Postgres + pgvector) — from P1
- OpenAI / OpenRouter — from P2/P3
- React Flow graph branching — from P6

## Quick start (P0)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You should see the Phase 0 scaffold page.

## Scripts

```bash
npm run dev      # local server
npm run build    # production build
npm run lint     # ESLint
npm run test     # Vitest
```

## Phased delivery

Each phase ends in a runnable checkpoint for testing and a PR:

0. Scaffold + Cursor rules (current)
1. Auth
2. Streaming chat
3. Web search + citations
4. Persist chats/messages
5. RAG + embeddings
6. Graph branching
7. Deploy

See `SETUP.md` for external services (Supabase, API keys, domain).

## Agent guidance

- `AGENTS.md` — essential context
- `rules/` and `.cursor/rules/` — coding standards
- `agent-rules/` — deeper guidelines

# Tenexity - Essential Context

**What**: Streaming answer engine with live web search, citations, and forkable research branches (path-scoped RAG).
**Product name (UI)**: Tenexity
**Repo / package**: TenexPerplexity / `tenexperplexity`
**Stack**: Next.js 15 + React 19 + Supabase (PostgreSQL+pgvector) + React Flow + OpenAI / OpenRouter

---

## SIMPLICITY IS THE TOP PRIORITY

**These principles override everything else. When in doubt, choose the simpler solution.**

### The Simplicity Manifesto

1. **Simple is better than complex** - Always prefer the straightforward solution
2. **Clear is better than clever** - Write code others can understand, not code to impress
3. **Boring code is good code** - Predictable, maintainable code beats "elegant" complexity
4. **Solve the immediate problem** - Don't add features "for the future" or "just in case"
5. **Avoid abstractions until you need them 2 times** - Don't create frameworks from one example
6. **Don't overcomplicate to show off technical skills** - Simplicity demonstrates mastery

## Critical Rules (NON-NEGOTIABLE)

1. **SIMPLICITY FIRST** - Simple is better than complex. Don't overcomplicate. Boring code is good code.
2. **No duplicate logic** - DRY principle, abstract out common code. Have ONE SINGLE source of truth (Critical).
3. **NEVER break existing functionality** - Test before committing
4. **Mobile responsive required** - Test 320px-768px, Tailwind breakpoints mandatory
5. **Read before editing** - Use Read tool on files before modifications
6. **Type safety** - Strict TypeScript, no `any`

---

## Delivery status

| Phase | Goal | Status |
|-------|------|--------|
| P0 | Scaffold + rules | Done |
| P1 | Auth (Supabase) | Done |
| P2 | Streaming chat | Done |
| P3 | Web search + citations | Done |
| P4 | Persist chats/messages | Done |
| P5 | RAG + embeddings | Done |
| P6 | Graph branching (Explore) | Done |
| P7 | Deploy (Vercel) | Done — see `DEPLOY.md` |

---

## Detailed Reference Files

Refer to these files in `agent-rules/` when working on related areas:

| File | When to Use |
|------|-------------|
| `agent-rules/code-style.md` | Writing or reviewing code |
| `agent-rules/typescript-guidelines.md` | TypeScript types and safety |
| `agent-rules/react-nextjs-guidelines.md` | React, hooks, API routes, mobile |
| `agent-rules/react-best-practices.md` | React performance |
| `agent-rules/code-review-checklist.md` | Before submitting for review |
| `agent-rules/database-schema.md` | DB queries / migrations |
| `agent-rules/rag-system.md` | RAG / embeddings / path context |
| `agent-rules/common-patterns.md` | Existing code patterns |
| `agent-rules/directory-structure.md` | Where to place new code |
| `agent-rules/development.md` | Dev commands |
| `agent-rules/environment.md` | Env vars |
| `agent-rules/known-limitations.md` | Constraints |

Also see `rules/` for Cursor project rules (mirrored under `.cursor/rules/*.mdc`).

**For setup / deploy**: `SETUP.md`, `DEPLOY.md`, `README.md`.

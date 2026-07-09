# Directory Structure

```
TenexPerplexity/
  app/                 # Next.js App Router (pages + API routes)
  components/
    chat/              # Sidebar, messages, composer
    graph/             # Explore React Flow canvas
    auth/              # Auth form layout
    ui/                # Shared UI primitives
  context/             # AuthProvider
  lib/
    api/               # Client fetch helpers
    chat/              # Persist, SSE, request parsing
    graph/             # Explore layout (collision-free placement)
    hooks/             # useStreamingChat, etc.
    llm/               # Providers, models, citations, web search
    rag/               # Linear + path context retrieval
    supabase/          # Browser/server clients + types
  supabase/migrations/ # p4 / p5 / p6 combined SQL
  rules/               # Human-readable project rules
  .cursor/rules/       # Cursor auto-attached .mdc rules
  agent-rules/         # Deeper agent guidance
  test/                # Vitest setup
```

Place new feature code under `lib/` (domain) or `components/` (UI). API routes under `app/api/`.

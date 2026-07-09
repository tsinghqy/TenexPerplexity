# Directory Structure

```
TenexPerplexity/
  app/                 # Next.js App Router (pages + API routes)
  components/ui/       # shadcn/ui primitives
  lib/                 # Shared utilities, later: llm/, rag/, supabase/
  rules/               # Human-readable project rules
  .cursor/rules/       # Cursor auto-attached .mdc rules
  agent-rules/         # Deeper agent guidance
  supabase/            # Migrations (P4+)
  test/                # Vitest setup
```

Place new feature code under `lib/` (domain) or `components/` (UI). API routes under `app/api/`.

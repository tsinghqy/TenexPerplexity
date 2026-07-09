# Database Schema

**Status**: Live in production via `supabase/migrations/`.

## Core tables

- `chats` — conversation / Explore cards (`position_x`, `position_y`, title, RLS)
- `nodes` — messages (`user` / `assistant`) with `parent_id`, optional `embedding` (pgvector)
- `node_parent_paths` — materialized ancestry for path-scoped RAG and Explore forks
- `node_links` — optional manual edges (schema present; Explore uses fork edges from parent chats)

All user tables use Supabase RLS (users only access their own rows).

## Apply migrations

Prefer combined files in the SQL Editor:

1. `p4_combined.sql` — chats, nodes, node_links, pgvector, RLS
2. `p5_combined.sql` — `search_chat_nodes_safe`, embedding helpers
3. `p6_combined.sql` — parent paths, positions, path RPCs, RLS fixes

Individual numbered migrations under `supabase/migrations/` match the same history.

**See also**: `supabase/README.md`, `lib/chat/persist.ts`, `lib/rag/`.

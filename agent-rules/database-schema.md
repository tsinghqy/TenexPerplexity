# Database Schema

**Status**: Schema lands in P4+ via `supabase/migrations/`.

Until migrations are ported, treat this as a placeholder. Planned tables:

- `chats` — conversation / canvas nodes
- `nodes` — messages (user/assistant) with optional `parent_id`, embeddings
- `node_parent_paths` — materialized ancestry for path-scoped RAG
- `node_links` — optional manual edges

All user tables use Supabase RLS.

**See also**: GraphChat source migrations under `GraphChat/graphchat/supabase/migrations/` for the port source of truth during transfer.

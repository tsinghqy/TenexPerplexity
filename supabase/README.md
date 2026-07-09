# Database setup

## P4 — chats / nodes / RLS

Run in the Supabase SQL Editor (once):

- `supabase/migrations/p4_combined.sql`

Or files `001` → `005` in order.

## P5 — linear RAG helpers

After P4 is applied, run:

- `supabase/migrations/p5_combined.sql`

This adds `search_chat_nodes_safe`, `get_nodes_needing_embeddings`, and an index for chat message queries.

## P6 — graph branching / path RAG

After P5 is applied, run:

- `supabase/migrations/p6_combined.sql`

This adds `node_parent_paths`, chat canvas positions, path RPCs, and related RLS.

## Verify

1. Table Editor shows `chats`, `nodes`, `node_links`, `node_parent_paths`
2. Send a message → user row in `nodes` gets an `embedding` shortly after
3. Follow-up in the same chat answers using prior turns
4. Branch from an answer → Explore shows a fork edge; branch follow-ups use ancestor path context

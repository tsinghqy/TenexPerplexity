# RAG System

**Status**: Implemented (P5 linear + P6 path context).

## Approach

- Embed **user** messages with `text-embedding-3-small` (1536-d) after insert
- Linear retrieval: prior turns in the same chat (`retrieveLinearChatContext`)
- Path retrieval: walk ancestors via `parent_id` / `get_node_parent_tree` for forks (`retrieveAncestorPathContext`)
- Merge ancestor + linear context into the stream system prompt
- Sibling branches do not share context unless they share an ancestor path

## Key files

- `lib/rag/retriever.ts` — linear + merge helpers
- `lib/rag/path-context.ts` — fork ancestor walk
- `lib/llm/embeddings.ts` — embedding client
- `app/api/chat/stream/route.ts` — wires context into generation

## Ops notes

- Vector RPC failures fall back to chronological context (check server logs for ambiguous column / missing RPC)
- Ensure `p5_combined.sql` and `p6_combined.sql` are applied before relying on path RAG

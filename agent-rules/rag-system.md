# RAG System

**Status**: Lands in P5.

Planned approach (ported from GraphChat):

- Embed user messages (`text-embedding-3-small`, 1536-d)
- Retrieve along `node_parent_paths` (ancestor chain)
- Optional pgvector similarity within ancestor chats
- Sibling branches do not share context

**See also**: `lib/rag/` once P5 is implemented.

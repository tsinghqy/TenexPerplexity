-- Optimize parent ID auto-detection query
-- NOTE: This migration was created for the old approach that queried nodes table
-- The current implementation (as of 2024) uses chat.root_node_id instead, which is more efficient
-- This index is kept for backwards compatibility and may be used by other queries

CREATE INDEX IF NOT EXISTS idx_nodes_chat_user_role_created 
ON public.nodes(chat_id, user_id, role, created_at DESC);

-- NOTE: Parent ID auto-detection now uses a simpler approach:
-- - Query: SELECT root_node_id FROM chats WHERE id = ? AND user_id = ?
-- - This query is optimized by idx_chats_id_user_id (created in migration 021)
-- - See app/api/chat/route.ts and app/api/chat/stream/route.ts for implementation
--
-- The old approach (querying nodes table) was replaced because:
-- 1. More efficient: Single query to chats table vs querying nodes table with filters
-- 2. More accurate: Uses the chat's explicit root_node_id field
-- 3. Simpler: No need to filter by parent_id, exclude placeholders, or order by created_at


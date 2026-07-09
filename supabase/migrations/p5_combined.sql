-- P5: same-chat vector search (linear RAG; parent-path RPCs deferred to P6)
CREATE OR REPLACE FUNCTION public.search_chat_nodes_safe(
  p_user_id UUID,
  p_chat_id UUID,
  p_query_embedding vector(1536),
  p_limit INT DEFAULT 5,
  p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
  id UUID,
  chat_id UUID,
  user_id UUID,
  parent_id UUID,
  role message_role,
  content TEXT,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this chat
  IF NOT EXISTS (
    SELECT 1 FROM public.chats
    WHERE id = p_chat_id
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: User does not have access to this chat';
  END IF;

  -- Verify the requesting user matches
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: Cannot access another user''s nodes';
  END IF;

  -- Perform vector search with chat_id and user_id filter (user messages only)
  RETURN QUERY
  SELECT 
    n.id,
    n.chat_id,
    n.user_id,
    n.parent_id,
    n.role,
    n.content,
    1 - (n.embedding <=> p_query_embedding) AS similarity,
    n.created_at
  FROM public.nodes n
  WHERE n.chat_id = p_chat_id
    AND n.user_id = p_user_id
    AND n.role = 'user'
    AND n.embedding IS NOT NULL
    AND (1 - (n.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY n.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

-- Optimized function to search nodes across parent chats using parent paths
-- This function efficiently searches all chats in the parent tree of a given node

GRANT EXECUTE ON FUNCTION public.search_chat_nodes_safe(UUID, UUID, vector, INT, FLOAT) TO authenticated;
-- Backfill missing embeddings for user messages
-- This migration creates a function to backfill embeddings for nodes that don't have them
-- Note: This function should be called manually or via an API endpoint, not automatically
-- because it requires OpenAI API calls which should be done server-side

-- Function to get nodes that need embeddings backfilled
CREATE OR REPLACE FUNCTION public.get_nodes_needing_embeddings(
  p_user_id UUID,
  p_limit INT DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.content,
    n.created_at
  FROM public.nodes n
  WHERE n.user_id = p_user_id
    AND n.role = 'user'
    AND n.embedding IS NULL
    AND n.content IS NOT NULL
    AND n.content != ''
    AND n.content != '__PLACEHOLDER_NODE__'
  ORDER BY n.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_nodes_needing_embeddings(UUID, INT) TO authenticated;

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


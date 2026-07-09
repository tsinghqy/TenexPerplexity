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

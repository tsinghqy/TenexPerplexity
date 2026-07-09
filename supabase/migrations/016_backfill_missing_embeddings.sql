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


-- Fix RAG context retrieval for forked chats
-- When a node has a parent in a different chat, include ALL nodes from that parent chat
-- not just the parent node itself

-- Update search_parent_chat_nodes_safe to include all nodes from parent chats
CREATE OR REPLACE FUNCTION public.search_parent_chat_nodes_safe(
  p_user_id UUID,
  p_node_id UUID,
  p_query_embedding vector(1536),
  p_limit INT DEFAULT 10,
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
  created_at TIMESTAMPTZ,
  depth INTEGER
) AS $$
DECLARE
  v_chat_ids UUID[];
  v_path UUID[];
  v_node RECORD;
  v_parent_chat_id UUID;
BEGIN
  -- Verify user has access to the node
  IF NOT EXISTS (
    SELECT 1 FROM public.nodes n
    WHERE n.id = p_node_id AND n.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: Node not found or user does not have access';
  END IF;

  -- Verify the requesting user matches
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: Cannot access another user''s nodes';
  END IF;

  -- Get the parent path for this node
  SELECT path INTO v_path
  FROM public.node_parent_paths
  WHERE node_id = p_node_id
    AND user_id = p_user_id;

  -- Initialize chat_ids with current node's chat
  SELECT ARRAY[chat_id] INTO v_chat_ids
  FROM public.nodes
  WHERE id = p_node_id;

  -- If we have a path, get chat_ids from all nodes in the path
  IF v_path IS NOT NULL AND array_length(v_path, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT chat_id) INTO v_chat_ids
    FROM public.nodes
    WHERE id = ANY(v_path)
      AND user_id = p_user_id;
  END IF;

  -- CRITICAL FIX: For each node in the path that has a parent in a different chat,
  -- include ALL nodes from that parent's chat (not just the parent node)
  FOR v_node IN
    SELECT n.id, n.chat_id, n.parent_id
    FROM public.nodes n
    WHERE n.id = ANY(COALESCE(v_path, ARRAY[]::UUID[]))
      AND n.user_id = p_user_id
      AND n.parent_id IS NOT NULL
  LOOP
    -- Check if parent is in a different chat
    SELECT chat_id INTO v_parent_chat_id
    FROM public.nodes
    WHERE id = v_node.parent_id
      AND user_id = p_user_id;

    -- If parent is in a different chat, add that chat_id to our list
    IF v_parent_chat_id IS NOT NULL AND v_parent_chat_id != v_node.chat_id THEN
      -- Add parent chat_id if not already in the array
      IF NOT (v_parent_chat_id = ANY(v_chat_ids)) THEN
        v_chat_ids := array_append(v_chat_ids, v_parent_chat_id);
      END IF;
    END IF;
  END LOOP;

  -- Fallback: if no chat_ids found, use current node's chat
  IF v_chat_ids IS NULL OR array_length(v_chat_ids, 1) = 0 THEN
    SELECT ARRAY[chat_id] INTO v_chat_ids
    FROM public.nodes
    WHERE id = p_node_id;
  END IF;

  -- Perform vector search across all parent chats in a single query
  RETURN QUERY
  WITH chat_searches AS (
    SELECT 
      n.id,
      n.chat_id,
      n.user_id,
      n.parent_id,
      n.role,
      n.content,
      1 - (n.embedding <=> p_query_embedding) AS similarity,
      n.created_at,
      COALESCE(npp.depth, 0) AS depth
    FROM public.nodes n
    LEFT JOIN public.node_parent_paths npp ON npp.node_id = n.id
    WHERE n.chat_id = ANY(v_chat_ids)
      AND n.user_id = p_user_id
      AND n.role = 'user'
      AND n.embedding IS NOT NULL
      AND (1 - (n.embedding <=> p_query_embedding)) >= p_similarity_threshold
  )
  SELECT 
    cs.id,
    cs.chat_id,
    cs.user_id,
    cs.parent_id,
    cs.role,
    cs.content,
    cs.similarity,
    cs.created_at,
    cs.depth
  FROM chat_searches cs
  ORDER BY cs.similarity DESC, cs.depth ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update get_node_parent_tree to include full parent chat context for cross-chat relationships
-- Returns nodes in order: parent chat nodes first (chronologically), then current path nodes
CREATE OR REPLACE FUNCTION public.get_node_parent_tree(
  p_node_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  id UUID,
  role message_role,
  content TEXT,
  created_at TIMESTAMPTZ,
  depth INTEGER
) AS $$
DECLARE
  v_path UUID[];
  v_node RECORD;
  v_parent_chat_id UUID;
  v_path_node_ids UUID[];
  v_parent_chat_nodes UUID[];
  v_parent_chat_ids UUID[];
BEGIN
  -- Verify user has access
  IF NOT EXISTS (
    SELECT 1 FROM public.nodes n
    WHERE n.id = p_node_id AND n.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: Node not found or user does not have access';
  END IF;
  
  -- Get the path for this node
  SELECT path INTO v_path
  FROM public.node_parent_paths
  WHERE node_id = p_node_id
    AND user_id = p_user_id;

  -- If no path found, return empty
  IF v_path IS NULL OR array_length(v_path, 1) = 0 THEN
    RETURN;
  END IF;

  -- Store path node IDs to avoid duplicates
  v_path_node_ids := v_path;

  -- Collect unique parent chat IDs (to avoid returning duplicate parent chat nodes)
  -- First, collect all unique parent chat IDs
  FOR v_node IN
    SELECT n.id, n.chat_id, n.parent_id
    FROM public.nodes n
    WHERE n.id = ANY(v_path)
      AND n.user_id = p_user_id
      AND n.parent_id IS NOT NULL
  LOOP
    -- Check if parent is in a different chat
    SELECT chat_id INTO v_parent_chat_id
    FROM public.nodes
    WHERE id = v_node.parent_id
      AND user_id = p_user_id;

    -- If parent is in a different chat, add that chat_id to our list
    IF v_parent_chat_id IS NOT NULL AND v_parent_chat_id != v_node.chat_id THEN
      -- Add parent chat_id if not already in the array
      IF v_parent_chat_ids IS NULL OR NOT (v_parent_chat_id = ANY(v_parent_chat_ids)) THEN
        v_parent_chat_ids := COALESCE(v_parent_chat_ids, ARRAY[]::UUID[]) || ARRAY[v_parent_chat_id];
      END IF;
    END IF;
  END LOOP;

  -- Return parent chat nodes first (ordered by creation time)
  -- Only return nodes from unique parent chats
  IF v_parent_chat_ids IS NOT NULL AND array_length(v_parent_chat_ids, 1) > 0 THEN
    FOR v_parent_chat_id IN SELECT unnest(v_parent_chat_ids)
    LOOP
      RETURN QUERY
      SELECT 
        n.id,
        n.role,
        n.content,
        n.created_at,
        COALESCE(npp.depth, 0) AS depth
      FROM public.nodes n
      LEFT JOIN public.node_parent_paths npp ON npp.node_id = n.id
      WHERE n.chat_id = v_parent_chat_id
        AND n.user_id = p_user_id
        AND NOT (n.id = ANY(v_path)) -- Don't duplicate nodes already in our path
      ORDER BY n.created_at ASC; -- Order by creation time to maintain conversation flow
    END LOOP;
  END IF;

  -- Then return nodes in the direct path (ordered by position in path)
  RETURN QUERY
  SELECT 
    n.id,
    n.role,
    n.content,
    n.created_at,
    npp.depth
  FROM public.node_parent_paths npp
  JOIN public.nodes n ON n.id = ANY(npp.path)
  WHERE npp.node_id = p_node_id
    AND npp.user_id = p_user_id
  ORDER BY array_position(npp.path, n.id); -- Order by position in path array
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


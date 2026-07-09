-- Fix ambiguous column references in RAG functions
-- This fixes the "column reference is ambiguous" errors when dealing with cross-chat relationships

-- Fix get_node_parent_tree function
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
  SELECT npp.path INTO v_path
  FROM public.node_parent_paths npp
  WHERE npp.node_id = p_node_id
    AND npp.user_id = p_user_id;

  -- If no path found, try to build it manually from parent_id chain
  IF v_path IS NULL OR array_length(v_path, 1) = 0 THEN
    -- Build path manually by traversing parent_id chain
    DECLARE
      v_current_id UUID := p_node_id;
      v_parent_id UUID;
      v_manual_path UUID[] := ARRAY[]::UUID[];
    BEGIN
      -- Start with current node
      v_manual_path := ARRAY[v_current_id];
      
      -- Traverse up the parent chain
      WHILE v_current_id IS NOT NULL LOOP
        SELECT n.parent_id INTO v_parent_id
        FROM public.nodes n
        WHERE n.id = v_current_id
          AND n.user_id = p_user_id;
        
        IF v_parent_id IS NOT NULL THEN
          v_manual_path := ARRAY[v_parent_id] || v_manual_path;
          v_current_id := v_parent_id;
        ELSE
          v_current_id := NULL;
        END IF;
      END LOOP;
      
      v_path := v_manual_path;
    END;
  END IF;

  -- If still no path, return empty
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
    SELECT pn.chat_id INTO v_parent_chat_id
    FROM public.nodes pn
    WHERE pn.id = v_node.parent_id
      AND pn.user_id = p_user_id;

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
        COALESCE(npp2.depth, 0) AS depth
      FROM public.nodes n
      LEFT JOIN public.node_parent_paths npp2 ON npp2.node_id = n.id AND npp2.user_id = p_user_id
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
    COALESCE(npp3.depth, 0) AS depth
  FROM unnest(v_path) WITH ORDINALITY AS path_elem(elem_id, elem_order)
  JOIN public.nodes n ON n.id = path_elem.elem_id
  LEFT JOIN public.node_parent_paths npp3 ON npp3.node_id = n.id AND npp3.user_id = p_user_id
  WHERE n.user_id = p_user_id
  ORDER BY path_elem.elem_order; -- Order by position in path array
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix search_parent_chat_nodes_safe function
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
  SELECT npp.path INTO v_path
  FROM public.node_parent_paths npp
  WHERE npp.node_id = p_node_id
    AND npp.user_id = p_user_id;

  -- If no path found, build it manually
  IF v_path IS NULL OR array_length(v_path, 1) = 0 THEN
    DECLARE
      v_current_id UUID := p_node_id;
      v_parent_id UUID;
      v_manual_path UUID[] := ARRAY[]::UUID[];
    BEGIN
      v_manual_path := ARRAY[v_current_id];
      
      WHILE v_current_id IS NOT NULL LOOP
        SELECT n.parent_id INTO v_parent_id
        FROM public.nodes n
        WHERE n.id = v_current_id
          AND n.user_id = p_user_id;
        
        IF v_parent_id IS NOT NULL THEN
          v_manual_path := ARRAY[v_parent_id] || v_manual_path;
          v_current_id := v_parent_id;
        ELSE
          v_current_id := NULL;
        END IF;
      END LOOP;
      
      v_path := v_manual_path;
    END;
  END IF;

  -- Initialize chat_ids with current node's chat
  SELECT ARRAY[n.chat_id] INTO v_chat_ids
  FROM public.nodes n
  WHERE n.id = p_node_id;

  -- If we have a path, get chat_ids from all nodes in the path
  IF v_path IS NOT NULL AND array_length(v_path, 1) > 0 THEN
    SELECT ARRAY_AGG(DISTINCT n.chat_id) INTO v_chat_ids
    FROM public.nodes n
    WHERE n.id = ANY(v_path)
      AND n.user_id = p_user_id;
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
    SELECT pn.chat_id INTO v_parent_chat_id
    FROM public.nodes pn
    WHERE pn.id = v_node.parent_id
      AND pn.user_id = p_user_id;

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
    SELECT ARRAY[n.chat_id] INTO v_chat_ids
    FROM public.nodes n
    WHERE n.id = p_node_id;
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
      COALESCE(npp2.depth, 0) AS depth
    FROM public.nodes n
    LEFT JOIN public.node_parent_paths npp2 ON npp2.node_id = n.id AND npp2.user_id = p_user_id
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


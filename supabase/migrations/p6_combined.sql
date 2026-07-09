-- P6: path-scoped graph RAG + chat canvas positions
-- Apply AFTER p4_combined.sql and p5_combined.sql
-- Includes: node_parent_paths, chat positions, RLS, cross-chat RAG RPC fixes


-- ===== 007_create_node_parent_paths.sql =====
-- Create node_parent_paths table for optimized parent tree retrieval
-- This table stores pre-computed paths from root to each node, eliminating recursive queries
-- The path is stored as an array of node IDs from root to the node itself

CREATE TABLE IF NOT EXISTS public.node_parent_paths (
  node_id UUID PRIMARY KEY REFERENCES public.nodes(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  path UUID[] NOT NULL, -- Array of node IDs from root to this node (inclusive)
  depth INTEGER NOT NULL DEFAULT 0, -- Depth in tree (0 = root)
  root_node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL, -- Direct reference to root
  parent_node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL, -- Direct reference to parent
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  CONSTRAINT path_not_empty CHECK (array_length(path, 1) > 0),
  CONSTRAINT depth_matches_path CHECK (depth = array_length(path, 1) - 1)
);

-- Create indexes for optimal query performance
CREATE INDEX idx_node_parent_paths_chat_id ON public.node_parent_paths(chat_id);
CREATE INDEX idx_node_parent_paths_user_id ON public.node_parent_paths(user_id);
CREATE INDEX idx_node_parent_paths_parent_node_id ON public.node_parent_paths(parent_node_id);
CREATE INDEX idx_node_parent_paths_root_node_id ON public.node_parent_paths(root_node_id);
CREATE INDEX idx_node_parent_paths_depth ON public.node_parent_paths(depth);

-- GIN index for efficient array containment queries (finding descendants)
CREATE INDEX idx_node_parent_paths_path_gin ON public.node_parent_paths USING GIN(path);

-- Composite index for common query pattern: user + chat + depth
CREATE INDEX idx_node_parent_paths_user_chat_depth ON public.node_parent_paths(user_id, chat_id, depth);

-- Function to build parent path for a node
CREATE OR REPLACE FUNCTION public.build_node_path(p_node_id UUID)
RETURNS UUID[] AS $$
DECLARE
  v_path UUID[] := ARRAY[]::UUID[];
  v_current_id UUID := p_node_id;
  v_parent_id UUID;
BEGIN
  -- Build path by traversing up the tree
  WHILE v_current_id IS NOT NULL LOOP
    v_path := ARRAY[v_current_id] || v_path;
    
    SELECT parent_id INTO v_parent_id
    FROM public.nodes
    WHERE id = v_current_id;
    
    v_current_id := v_parent_id;
    
    -- Safety check to prevent infinite loops
    IF v_current_id = ANY(v_path) THEN
      RAISE EXCEPTION 'Circular reference detected in node tree';
    END IF;
  END LOOP;
  
  RETURN v_path;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to maintain parent paths when a node is inserted or updated
CREATE OR REPLACE FUNCTION public.maintain_node_parent_path()
RETURNS TRIGGER AS $$
DECLARE
  v_path UUID[];
  v_depth INTEGER;
  v_root_id UUID;
BEGIN
  -- Build the path for this node
  v_path := public.build_node_path(NEW.id);
  v_depth := array_length(v_path, 1) - 1;
  v_root_id := v_path[1]; -- First element is root
  
  -- Insert or update the parent path record
  INSERT INTO public.node_parent_paths (
    node_id,
    chat_id,
    user_id,
    path,
    depth,
    root_node_id,
    parent_node_id,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.chat_id,
    NEW.user_id,
    v_path,
    v_depth,
    v_root_id,
    NEW.parent_id,
    TIMEZONE('utc', NOW())
  )
  ON CONFLICT (node_id) 
  DO UPDATE SET
    path = EXCLUDED.path,
    depth = EXCLUDED.depth,
    root_node_id = EXCLUDED.root_node_id,
    parent_node_id = EXCLUDED.parent_node_id,
    updated_at = EXCLUDED.updated_at;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update all descendant paths when a node's parent changes
CREATE OR REPLACE FUNCTION public.update_descendant_paths(p_node_id UUID)
RETURNS void AS $$
DECLARE
  v_descendant RECORD;
  v_new_path UUID[];
BEGIN
  -- Find all descendants (nodes whose path contains this node)
  FOR v_descendant IN
    SELECT npp.node_id, npp.path
    FROM public.node_parent_paths npp
    WHERE p_node_id = ANY(npp.path)
      AND npp.node_id != p_node_id
  LOOP
    -- Rebuild path for this descendant
    v_new_path := public.build_node_path(v_descendant.node_id);
    
    -- Update the path
    UPDATE public.node_parent_paths
    SET 
      path = v_new_path,
      depth = array_length(v_new_path, 1) - 1,
      root_node_id = v_new_path[1],
      updated_at = TIMEZONE('utc', NOW())
    WHERE node_id = v_descendant.node_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain parent paths on insert
CREATE TRIGGER maintain_node_parent_path_on_insert
  AFTER INSERT ON public.nodes
  FOR EACH ROW
  EXECUTE FUNCTION public.maintain_node_parent_path();

-- Trigger to maintain parent paths on update (if parent_id changes)
CREATE TRIGGER maintain_node_parent_path_on_update
  AFTER UPDATE OF parent_id ON public.nodes
  FOR EACH ROW
  WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id)
  EXECUTE FUNCTION public.maintain_node_parent_path();

-- Note: Descendant updates are handled by rebuilding paths when needed
-- The update_descendant_paths function can be called manually if needed

-- Function to get parent tree efficiently (using pre-computed paths)
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
BEGIN
  -- Verify user has access
  IF NOT EXISTS (
    SELECT 1 FROM public.nodes n
    WHERE n.id = p_node_id AND n.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: Node not found or user does not have access';
  END IF;
  
  -- Get the path for this node
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.build_node_path(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_node_parent_tree(UUID, UUID) TO authenticated;

-- Enable RLS on node_parent_paths
ALTER TABLE public.node_parent_paths ENABLE ROW LEVEL SECURITY;

-- RLS Policies for node_parent_paths
CREATE POLICY "Users can view own node parent paths"
  ON public.node_parent_paths FOR SELECT
  USING (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );

-- Backfill existing nodes (run this after table creation)
-- This will populate parent paths for all existing nodes
DO $$
DECLARE
  v_node RECORD;
  v_path UUID[];
  v_depth INTEGER;
  v_root_id UUID;
  v_chat_id UUID;
  v_user_id UUID;
  v_parent_id UUID;
BEGIN
  FOR v_node IN SELECT id, chat_id, user_id, parent_id FROM public.nodes LOOP
    BEGIN
      -- Build path for this node
      v_path := public.build_node_path(v_node.id);
      v_depth := array_length(v_path, 1) - 1;
      v_root_id := v_path[1];
      
      -- Insert the parent path record
      INSERT INTO public.node_parent_paths (
        node_id,
        chat_id,
        user_id,
        path,
        depth,
        root_node_id,
        parent_node_id,
        updated_at
      ) VALUES (
        v_node.id,
        v_node.chat_id,
        v_node.user_id,
        v_path,
        v_depth,
        v_root_id,
        v_node.parent_id,
        TIMEZONE('utc', NOW())
      )
      ON CONFLICT (node_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Skip nodes that cause errors (e.g., circular references)
      RAISE NOTICE 'Skipping node %: %', v_node.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- ===== 008_add_chat_node_positions.sql =====
-- Add position columns to chats table for storing chat node positions on the graph canvas

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS position_x FLOAT,
  ADD COLUMN IF NOT EXISTS position_y FLOAT;

-- Create index for faster position queries
CREATE INDEX IF NOT EXISTS idx_chats_position ON public.chats(user_id, position_x, position_y) 
  WHERE position_x IS NOT NULL AND position_y IS NOT NULL;

-- ===== 009_add_node_parent_paths_insert_update_policies.sql =====
-- Add INSERT and UPDATE policies for node_parent_paths table
-- These policies are needed for the trigger function to work properly when nodes are created/updated

-- INSERT policy: Allow inserts when the user_id matches the authenticated user
-- and the chat_id belongs to that user
CREATE POLICY "Users can insert own node parent paths"
  ON public.node_parent_paths FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );

-- UPDATE policy: Allow updates when the user_id matches the authenticated user
-- and the chat_id belongs to that user
CREATE POLICY "Users can update own node parent paths"
  ON public.node_parent_paths FOR UPDATE
  USING (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );

-- Update the trigger function to be SECURITY DEFINER so it can bypass RLS
-- This ensures the trigger always works, but the function still validates user ownership
CREATE OR REPLACE FUNCTION public.maintain_node_parent_path()
RETURNS TRIGGER AS $$
DECLARE
  v_path UUID[];
  v_depth INTEGER;
  v_root_id UUID;
BEGIN
  -- Build the path for this node
  v_path := public.build_node_path(NEW.id);
  v_depth := array_length(v_path, 1) - 1;
  v_root_id := v_path[1]; -- First element is root
  
  -- Insert or update the parent path record
  INSERT INTO public.node_parent_paths (
    node_id,
    chat_id,
    user_id,
    path,
    depth,
    root_node_id,
    parent_node_id,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.chat_id,
    NEW.user_id,
    v_path,
    v_depth,
    v_root_id,
    NEW.parent_id,
    TIMEZONE('utc', NOW())
  )
  ON CONFLICT (node_id) 
  DO UPDATE SET
    path = EXCLUDED.path,
    depth = EXCLUDED.depth,
    root_node_id = EXCLUDED.root_node_id,
    parent_node_id = EXCLUDED.parent_node_id,
    updated_at = EXCLUDED.updated_at;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== 010_add_node_parent_paths_delete_policy.sql =====
-- Add DELETE policy for node_parent_paths table
-- This is needed for efficient deletion when chats are deleted
-- Without this policy, CASCADE deletes can be very slow due to RLS checks

CREATE POLICY "Users can delete own node parent paths"
  ON public.node_parent_paths FOR DELETE
  USING (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );

-- ===== 015_fix_cross_chat_rag_context.sql =====
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

-- ===== 017_fix_ambiguous_column_references.sql =====
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

-- ===== from 006: search_parent_tree_nodes_safe =====
CREATE OR REPLACE FUNCTION public.search_parent_tree_nodes_safe(
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
  v_path UUID[];
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

  -- If no path found, return empty
  IF v_path IS NULL OR array_length(v_path, 1) = 0 THEN
    RETURN;
  END IF;

  -- Perform vector search only on nodes in the parent path
  RETURN QUERY
  SELECT 
    n.id,
    n.chat_id,
    n.user_id,
    n.parent_id,
    n.role,
    n.content,
    1 - (n.embedding <=> p_query_embedding) AS similarity,
    n.created_at,
    npp.depth
  FROM public.nodes n
  JOIN public.node_parent_paths npp ON npp.node_id = n.id
  WHERE n.id = ANY(v_path)
    AND n.user_id = p_user_id
    AND n.role = 'user'
    AND n.embedding IS NOT NULL
    AND (1 - (n.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY 
    -- Order by position in path (earlier nodes first), then by similarity
    array_position(v_path, n.id),
    n.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.search_chat_nodes_safe(UUID, UUID, vector, INT, FLOAT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_parent_chat_nodes_safe(UUID, UUID, vector, INT, FLOAT) TO authenticated;

GRANT EXECUTE ON FUNCTION public.search_parent_tree_nodes_safe(UUID, UUID, vector, INT, FLOAT) TO authenticated;

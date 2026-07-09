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


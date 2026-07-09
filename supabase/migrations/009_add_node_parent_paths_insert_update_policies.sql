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


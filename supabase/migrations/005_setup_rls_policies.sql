-- Enable Row Level Security on all tables
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chats table
-- Users can only access their own chats
CREATE POLICY "Users can view own chats"
  ON public.chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chats"
  ON public.chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chats"
  ON public.chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chats"
  ON public.chats FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for nodes table
-- Users can only access nodes from their own chats
CREATE POLICY "Users can view own nodes"
  ON public.nodes FOR SELECT
  USING (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own nodes"
  ON public.nodes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own nodes"
  ON public.nodes FOR UPDATE
  USING (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own nodes"
  ON public.nodes FOR DELETE
  USING (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );

-- RLS Policies for node_links table
-- Users can only access links they created
CREATE POLICY "Users can view own node links"
  ON public.node_links FOR SELECT
  USING (
    auth.uid() = user_id AND
    source_node_id IN (SELECT id FROM public.nodes WHERE user_id = auth.uid()) AND
    target_node_id IN (SELECT id FROM public.nodes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own node links"
  ON public.node_links FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    source_node_id IN (SELECT id FROM public.nodes WHERE user_id = auth.uid()) AND
    target_node_id IN (SELECT id FROM public.nodes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update own node links"
  ON public.node_links FOR UPDATE
  USING (
    auth.uid() = user_id AND
    source_node_id IN (SELECT id FROM public.nodes WHERE user_id = auth.uid()) AND
    target_node_id IN (SELECT id FROM public.nodes WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own node links"
  ON public.node_links FOR DELETE
  USING (
    auth.uid() = user_id AND
    source_node_id IN (SELECT id FROM public.nodes WHERE user_id = auth.uid()) AND
    target_node_id IN (SELECT id FROM public.nodes WHERE user_id = auth.uid())
  );


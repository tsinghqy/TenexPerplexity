-- Create node_links table for cross-chat linking
-- Allows users to create links between nodes across different chats

CREATE TYPE link_type AS ENUM ('manual', 'auto_suggested', 'accepted');

CREATE TABLE IF NOT EXISTS public.node_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_node_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  target_node_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  link_type link_type DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  CONSTRAINT no_self_link CHECK (source_node_id != target_node_id)
);

-- Create indexes for performance
CREATE INDEX idx_node_links_source ON public.node_links(source_node_id);
CREATE INDEX idx_node_links_target ON public.node_links(target_node_id);
CREATE INDEX idx_node_links_user_id ON public.node_links(user_id);
CREATE INDEX idx_node_links_type ON public.node_links(link_type);


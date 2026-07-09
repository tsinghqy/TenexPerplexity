-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create chats table
-- Each chat represents a conversation thread with a root node

CREATE TYPE message_role AS ENUM ('user', 'assistant');

CREATE TABLE IF NOT EXISTS public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  root_node_id UUID, -- Will reference nodes.id after nodes table is created
  is_expanded BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_chats_user_id ON public.chats(user_id);
CREATE INDEX idx_chats_created_at ON public.chats(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on chats
CREATE TRIGGER update_chats_updated_at
  BEFORE UPDATE ON public.chats
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create nodes table (messages)
-- Each node represents a message in a chat, with parent-child relationships for forking

CREATE TABLE IF NOT EXISTS public.nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
  role message_role NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  position_x FLOAT,
  position_y FLOAT,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_nodes_chat_id ON public.nodes(chat_id);
CREATE INDEX idx_nodes_user_id ON public.nodes(user_id);
CREATE INDEX idx_nodes_parent_id ON public.nodes(parent_id);
CREATE INDEX idx_nodes_created_at ON public.nodes(created_at DESC);
CREATE INDEX idx_nodes_chat_parent ON public.nodes(chat_id, parent_id);

-- Create HNSW index for vector similarity search on user messages only
CREATE INDEX nodes_embedding_idx ON public.nodes 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL; -- Only index messages with embeddings (user messages)

-- Trigger to update updated_at on nodes
CREATE TRIGGER update_nodes_updated_at
  BEFORE UPDATE ON public.nodes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add foreign key constraint for root_node_id in chats table
ALTER TABLE public.chats
  ADD CONSTRAINT fk_chats_root_node_id
  FOREIGN KEY (root_node_id) REFERENCES public.nodes(id) ON DELETE SET NULL;

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


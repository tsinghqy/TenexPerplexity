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


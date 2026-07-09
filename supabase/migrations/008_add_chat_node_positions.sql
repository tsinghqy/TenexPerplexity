-- Add position columns to chats table for storing chat node positions on the graph canvas

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS position_x FLOAT,
  ADD COLUMN IF NOT EXISTS position_y FLOAT;

-- Create index for faster position queries
CREATE INDEX IF NOT EXISTS idx_chats_position ON public.chats(user_id, position_x, position_y) 
  WHERE position_x IS NOT NULL AND position_y IS NOT NULL;





-- Add DELETE policy for node_parent_paths table
-- This is needed for efficient deletion when chats are deleted
-- Without this policy, CASCADE deletes can be very slow due to RLS checks

CREATE POLICY "Users can delete own node parent paths"
  ON public.node_parent_paths FOR DELETE
  USING (
    auth.uid() = user_id AND
    chat_id IN (SELECT id FROM public.chats WHERE user_id = auth.uid())
  );





-- P11: Remove the crowned-winner feature.
-- Research runs no longer pick a winning branch; the final synthesis simply
-- combines all branches. Run after p10_research.sql.

ALTER TABLE public.research_runs
  DROP COLUMN IF EXISTS winning_chat_id;

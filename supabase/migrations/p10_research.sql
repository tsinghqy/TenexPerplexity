-- P10: research synthesis summaries.
-- Run after p8_research.sql.

-- Quick summary shown on Explore card tooltips and the research question hover:
-- branch chats get their branch synthesis, the root chat gets the judge's
-- quick summary of the final conclusion.
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS summary TEXT;

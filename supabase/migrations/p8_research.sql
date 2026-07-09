-- P8: Research mode + claim verification (lie detector)
-- Run after p6_combined.sql.

-- ============================================================
-- 1. research_runs — one row per automatic research question
-- ============================================================
CREATE TABLE IF NOT EXISTS public.research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  root_chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'running', 'scoring', 'complete', 'failed', 'cancelled')),
  winning_chat_id UUID REFERENCES public.chats(id) ON DELETE SET NULL,
  overall_confidence REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_runs_user_created
  ON public.research_runs(user_id, created_at DESC);

ALTER TABLE public.research_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own research runs" ON public.research_runs;
CREATE POLICY "Users can view own research runs"
  ON public.research_runs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own research runs" ON public.research_runs;
CREATE POLICY "Users can insert own research runs"
  ON public.research_runs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own research runs" ON public.research_runs;
CREATE POLICY "Users can update own research runs"
  ON public.research_runs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own research runs" ON public.research_runs;
CREATE POLICY "Users can delete own research runs"
  ON public.research_runs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 2. node_claims — per-sentence verification verdicts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.node_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES public.nodes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  claim_text TEXT NOT NULL,
  start_offset INT NOT NULL,
  end_offset INT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('supported', 'partial', 'unsupported')),
  confidence REAL NOT NULL DEFAULT 0,
  source_url TEXT,
  source_title TEXT,
  source_quote TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_node_claims_node ON public.node_claims(node_id);
CREATE INDEX IF NOT EXISTS idx_node_claims_user ON public.node_claims(user_id);

ALTER TABLE public.node_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own claims" ON public.node_claims;
CREATE POLICY "Users can view own claims"
  ON public.node_claims FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own claims" ON public.node_claims;
CREATE POLICY "Users can insert own claims"
  ON public.node_claims FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own claims" ON public.node_claims;
CREATE POLICY "Users can update own claims"
  ON public.node_claims FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own claims" ON public.node_claims;
CREATE POLICY "Users can delete own claims"
  ON public.node_claims FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. chats — research linkage + branch confidence
-- ============================================================
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS research_run_id UUID REFERENCES public.research_runs(id) ON DELETE SET NULL;

ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS confidence REAL;

CREATE INDEX IF NOT EXISTS idx_chats_research_run ON public.chats(research_run_id);

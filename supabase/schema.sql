-- ============================================================================
-- Uncle Joe's 26th Annual Double Bogey Golf Tournament Schema
-- Run this in the Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. PLAYERS TABLE
CREATE TABLE IF NOT EXISTS public.players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  flight TEXT NOT NULL CHECK (flight IN ('A', 'B')),
  avatar_color TEXT DEFAULT '#059669',
  initial_target_quota INT NOT NULL DEFAULT 27,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COURSES TABLE
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  holes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROUNDS TABLE
CREATE TABLE IF NOT EXISTS public.rounds (
  id TEXT PRIMARY KEY,
  round_number INT NOT NULL,
  name TEXT NOT NULL,
  course_id TEXT REFERENCES public.courses(id),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  target_quotas JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SCORES TABLE (With unique constraint for atomic offline-upserts)
CREATE TABLE IF NOT EXISTS public.scores (
  id BIGSERIAL PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  hole_number INT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes INT NOT NULL CHECK (strokes >= 1),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_player_round_hole UNIQUE (round_id, player_id, hole_number)
);

-- 5. GROUPS / CARTS TABLE
CREATE TABLE IF NOT EXISTS public.groups (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  player_ids TEXT[] NOT NULL DEFAULT '{}',
  current_hole INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allow tournament players and admins to read and submit scores
-- ============================================================================
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Allow public anonymous read on all tournament tables
CREATE POLICY "Public Read Players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Public Read Courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Public Read Rounds" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Public Read Scores" ON public.scores FOR SELECT USING (true);
CREATE POLICY "Public Read Groups" ON public.groups FOR SELECT USING (true);

-- Allow public anonymous upsert/insert on scores and groups
CREATE POLICY "Public Upsert Scores" ON public.scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Upsert Groups" ON public.groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Update Rounds" ON public.rounds FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- ENABLE REALTIME ON SCORES
-- Allows every phone to receive live leaderboard updates via WebSockets
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================
INSERT INTO public.players (id, name, flight, avatar_color, initial_target_quota) VALUES
  ('p_stevieb', 'Stevie B', 'A', '#2563EB', 33),
  ('p_kulik', 'Kulik', 'A', '#059669', 28),
  ('p_jerry', 'Jerry', 'A', '#D97706', 25),
  ('p_unclejoe', 'Uncle Joe', 'A', '#DC2626', 27),
  ('p_bigal', 'Big Al', 'B', '#7C3AED', 18),
  ('p_sean', 'Sean', 'B', '#DB2777', 15),
  ('p_et', 'E.T.', 'A', '#0891B2', 29),
  ('p_danb', 'Dan B', 'A', '#4F46E5', 26),
  ('p_mikec', 'Mike C', 'A', '#16A34A', 25),
  ('p_patb', 'Pat B', 'B', '#EA580C', 20),
  ('p_billk', 'Bill K', 'B', '#9333EA', 19),
  ('p_davel', 'Dave L', 'B', '#CA8A04', 18),
  ('p_tomm', 'Tom M', 'B', '#0D9488', 16),
  ('p_chris', 'Chris', 'B', '#E11D48', 14)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.courses (id, name, location, holes) VALUES
  ('c_colonial', 'Colonial Heritage', 'Williamsburg, VA', '[
    {"holeNumber":1,"par":4,"difficultyRank":11},
    {"holeNumber":2,"par":4,"difficultyRank":5},
    {"holeNumber":3,"par":3,"difficultyRank":17},
    {"holeNumber":4,"par":4,"difficultyRank":7},
    {"holeNumber":5,"par":5,"difficultyRank":1},
    {"holeNumber":6,"par":4,"difficultyRank":9},
    {"holeNumber":7,"par":4,"difficultyRank":13},
    {"holeNumber":8,"par":3,"difficultyRank":15},
    {"holeNumber":9,"par":5,"difficultyRank":3},
    {"holeNumber":10,"par":4,"difficultyRank":8},
    {"holeNumber":11,"par":4,"difficultyRank":4},
    {"holeNumber":12,"par":3,"difficultyRank":16},
    {"holeNumber":13,"par":5,"difficultyRank":2},
    {"holeNumber":14,"par":4,"difficultyRank":12},
    {"holeNumber":15,"par":4,"difficultyRank":6},
    {"holeNumber":16,"par":3,"difficultyRank":18},
    {"holeNumber":17,"par":4,"difficultyRank":10},
    {"holeNumber":18,"par":5,"difficultyRank":14}
  ]'::jsonb),
  ('c_gh_green', 'G.H. Green Course', 'Williamsburg, VA', '[
    {"holeNumber":1,"par":4,"difficultyRank":9},
    {"holeNumber":2,"par":4,"difficultyRank":3},
    {"holeNumber":3,"par":3,"difficultyRank":15},
    {"holeNumber":4,"par":5,"difficultyRank":5},
    {"holeNumber":5,"par":4,"difficultyRank":11},
    {"holeNumber":6,"par":4,"difficultyRank":1},
    {"holeNumber":7,"par":4,"difficultyRank":7},
    {"holeNumber":8,"par":3,"difficultyRank":17},
    {"holeNumber":9,"par":5,"difficultyRank":13},
    {"holeNumber":10,"par":4,"difficultyRank":8},
    {"holeNumber":11,"par":4,"difficultyRank":4},
    {"holeNumber":12,"par":3,"difficultyRank":16},
    {"holeNumber":13,"par":5,"difficultyRank":2},
    {"holeNumber":14,"par":4,"difficultyRank":10},
    {"holeNumber":15,"par":4,"difficultyRank":6},
    {"holeNumber":16,"par":3,"difficultyRank":18},
    {"holeNumber":17,"par":4,"difficultyRank":12},
    {"holeNumber":18,"par":5,"difficultyRank":14}
  ]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.rounds (id, round_number, name, course_id, status, target_quotas) VALUES
  ('round-1', 1, 'Round 1: Colonial Heritage', 'c_colonial', 'completed', '{
    "p_stevieb": 33, "p_kulik": 28, "p_jerry": 25, "p_unclejoe": 27,
    "p_bigal": 18, "p_sean": 15, "p_et": 29, "p_danb": 26, "p_mikec": 25,
    "p_patb": 20, "p_billk": 19, "p_davel": 18, "p_tomm": 16, "p_chris": 14
  }'::jsonb),
  ('round-2', 2, 'Round 2: G.H. Green', 'c_gh_green', 'active', '{
    "p_stevieb": 35, "p_kulik": 26, "p_jerry": 25, "p_unclejoe": 27,
    "p_bigal": 20, "p_sean": 17, "p_et": 29, "p_danb": 26, "p_mikec": 25,
    "p_patb": 20, "p_billk": 19, "p_davel": 18, "p_tomm": 16, "p_chris": 14
  }'::jsonb)
ON CONFLICT (id) DO NOTHING;

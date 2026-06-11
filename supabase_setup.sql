-- ============================================================
-- Our World - Supabase Setup SQL
-- Run this entire script in your Supabase SQL Editor once.
-- ============================================================

-- 1. MEMORIES TABLE
CREATE TABLE IF NOT EXISTS public.memories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    couple_code text NOT NULL,         -- SHA-256 hex of shared secret (data isolation)
    encrypted_data text NOT NULL,      -- nacl.secretbox encrypted JSON {title, caption, date}
    file_url text,                     -- nacl.secretbox encrypted public storage URL
    uploaded_by text,                  -- plaintext name (Shivam / Ayushi)
    created_at timestamptz DEFAULT now()
);

-- Index for fast filtered queries by couple
CREATE INDEX IF NOT EXISTS memories_couple_code_idx ON public.memories(couple_code);

-- 2. SONGS TABLE
CREATE TABLE IF NOT EXISTS public.songs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    couple_code text NOT NULL,
    encrypted_data text NOT NULL,      -- nacl.secretbox encrypted JSON {title, artist}
    file_url text,                     -- nacl.secretbox encrypted storage URL to mp3
    uploaded_by text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS songs_couple_code_idx ON public.songs(couple_code);

-- 3. LETTERS TABLE
CREATE TABLE IF NOT EXISTS public.letters (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    couple_code text NOT NULL,
    encrypted_data text NOT NULL,      -- nacl.secretbox encrypted JSON {salutation, body, signature}
    written_by text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS letters_couple_code_idx ON public.letters(couple_code);

-- 4. REASONS TABLE
CREATE TABLE IF NOT EXISTS public.reasons (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    couple_code text NOT NULL,
    encrypted_data text NOT NULL,      -- nacl.secretbox encrypted plaintext reason string
    written_by text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reasons_couple_code_idx ON public.reasons(couple_code);

-- ============================================================
-- ROW-LEVEL SECURITY (Recommended but Optional)
-- Uncomment below to enable RLS allowing anonymous reads/writes.
-- This is fine for a private app since data is always E2E encrypted.
-- ============================================================

-- ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon all" ON public.memories FOR ALL TO anon USING (true) WITH CHECK (true);

-- ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon all" ON public.songs FOR ALL TO anon USING (true) WITH CHECK (true);

-- ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon all" ON public.letters FOR ALL TO anon USING (true) WITH CHECK (true);

-- ALTER TABLE public.reasons ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow anon all" ON public.reasons FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- STORAGE BUCKETS
-- Create these manually in the Supabase Dashboard → Storage:
--   1. "memories-bucket"  → Public
--   2. "songs-bucket"     → Public
-- ============================================================

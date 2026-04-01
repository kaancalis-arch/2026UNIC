-- ============================================
-- UNIVERSITIES TABLOSU KURULUM SQL
-- ============================================

-- 1. Tabloyu oluştur (varsa yoksa)
CREATE TABLE IF NOT EXISTS public.universities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT,
    countries TEXT[] DEFAULT '{}',
    ranking_url TEXT,
    website_url TEXT,
    departments_url TEXT,
    consulting_type TEXT,
    shared_institution_id TEXT,
    programs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS'i etkinleştir
ALTER TABLE public.universities ENABLE ROW LEVEL SECURITY;

-- 3. Okuma politikası (herkes okuyabilir)
CREATE POLICY "Anyone can read universities" ON public.universities
    FOR SELECT USING (true);

-- 4. Ekleme politikası (anonim kullanıcılar dahil)
CREATE POLICY "Anyone can insert universities" ON public.universities
    FOR INSERT WITH CHECK (true);

-- 5. Güncelleme politikası (anonim kullanıcılar dahil)
CREATE POLICY "Anyone can update universities" ON public.universities
    FOR UPDATE USING (true);

-- 6. Silme politikası (anonim kullanıcılar dahil)
CREATE POLICY "Anyone can delete universities" ON public.universities
    FOR DELETE USING (true);

-- ============================================
-- UNIVERSITY-LOGOS STORAGE BUCKET
-- ============================================

-- 1. Storage bucket oluştur
INSERT INTO storage.buckets (id, name, public)
VALUES ('university-logos', 'university-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage politikaları (okuma ve yazma)
CREATE POLICY "Public access to university logos" ON storage.objects
    FOR SELECT USING (bucket_id = 'university-logos');

CREATE POLICY "Anyone can upload university logos" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'university-logos');

CREATE POLICY "Anyone can delete university logos" ON storage.objects
    FOR DELETE USING (bucket_id = 'university-logos');

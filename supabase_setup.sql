-- ============================================
-- UNIVERSITIES TABLOSU
-- ============================================

DROP TABLE IF EXISTS public.universities;

CREATE TABLE public.universities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo TEXT DEFAULT '',
    countries TEXT[] DEFAULT '{}',
    ranking_url TEXT DEFAULT '',
    website_url TEXT DEFAULT '',
    departments_url TEXT DEFAULT '',
    consulting_type TEXT DEFAULT '',
    university_types TEXT[] DEFAULT '{}',
    shared_institution_id TEXT DEFAULT '',
    programs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.universities DISABLE ROW LEVEL SECURITY;

-- ============================================
-- UNIVERSITY TYPES TABLOSU
-- ============================================

DROP TABLE IF EXISTS public.university_types;

CREATE TABLE public.university_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    link TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.university_types DISABLE ROW LEVEL SECURITY;

-- Default University Types
INSERT INTO public.university_types (id, name, description, link) VALUES
    ('ut-001', 'Araştırma Üniversitesi', 'Yoğun araştırma faaliyetleri yürüten, güçlü akademik kadroya sahip üniversiteler', ''),
    ('ut-002', 'Russell Group', 'Birleşik Krallık''ın önde gelen 24 araştırma üniversitesinin birliği', 'https://russellgroup.ac.uk/'),
    ('ut-003', 'Ivy League', 'ABD''nin sekiz en prestijli üniversitesinin oluşturduğu lig', 'https://www.ivyleague.com/'),
    ('ut-004', 'TU9', 'Almanya''nın dokuz lider teknik üniversitesinin birliği', 'https://www.tu9.de/'),
    ('ut-005', 'Uygulamalı Bilimler', 'Pratik ve uygulamaya yönelik eğitim veren üniversiteler (Fachhochschule)', ''),
    ('ut-006', 'Tasarım Üniversiteleri', 'Görsel sanatlar, tasarım ve mimarlık alanında uzmanlaşmış üniversiteler', ''),
    ('ut-007', 'Top 100', 'Dünya genelinde en iyi 100 üniversite arasında yer alanlar', ''),
    ('ut-008', 'Top 200', 'Dünya genelinde en iyi 200 üniversite arasında yer alanlar', ''),
    ('ut-009', 'Top 500', 'Dünya genelinde en iyi 500 üniversite arasında yer alanlar', ''),
    ('ut-010', 'Devlet Üniversitesi', 'Devlet tarafından finanse edilen üniversiteler', ''),
    ('ut-011', 'Özel Üniversite', 'Özel sektör tarafından finanse edilen üniversiteler', ''),
    ('ut-012', 'Community College', '2 yıllık ön lisans programları sunan kolejler', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- UNIVERSITY TYPES UPSERT FONKSİYONU
-- ============================================

CREATE OR REPLACE FUNCTION public.upsert_university_type(
    p_id TEXT,
    p_name TEXT,
    p_description TEXT DEFAULT '',
    p_link TEXT DEFAULT ''
)
RETURNS TABLE(
    out_id TEXT,
    out_name TEXT,
    out_description TEXT,
    out_link TEXT,
    out_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    INSERT INTO public.university_types (id, name, description, link)
    VALUES (p_id, p_name, p_description, p_link)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        link = EXCLUDED.link
    RETURNING 
        public.university_types.id,
        public.university_types.name,
        public.university_types.description,
        public.university_types.link,
        public.university_types.created_at;
END;
$$;

-- ============================================
-- STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('university-logos', 'university-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "logos_read" ON storage.objects;
DROP POLICY IF EXISTS "logos_insert" ON storage.objects;

CREATE POLICY "logos_read" ON storage.objects FOR SELECT USING (bucket_id = 'university-logos');
CREATE POLICY "logos_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'university-logos');
-- Sub Programs (Alt Bölümler) Table
-- Each sub-program belongs to a main_category (Ana Bölüm)

-- Drop old table if it references interested_programs
DROP TABLE IF EXISTS public.sub_programs;

CREATE TABLE IF NOT EXISTS public.sub_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    main_category_id UUID NOT NULL REFERENCES public.main_categories(id) ON DELETE CASCADE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster lookups by parent category
CREATE INDEX IF NOT EXISTS idx_sub_programs_category ON public.sub_programs(main_category_id);

-- RLS
ALTER TABLE public.sub_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.sub_programs;
CREATE POLICY "Allow public read access" ON public.sub_programs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.sub_programs;
CREATE POLICY "Allow authenticated full access" ON public.sub_programs FOR ALL USING (true);

-- Initial Data: Mühendislik alt bölümleri
DO $$
DECLARE
    v_category_id UUID;
BEGIN
    -- Find "Mühendislik" in main_categories
    SELECT id INTO v_category_id FROM public.main_categories WHERE name = 'Mühendislik' LIMIT 1;
    
    IF v_category_id IS NULL THEN
        RAISE NOTICE 'Mühendislik kategorisi bulunamadı!';
        RETURN;
    END IF;

    -- Insert sub-programs under Mühendislik
    INSERT INTO public.sub_programs (name, main_category_id, sort_order)
    VALUES
        ('Elektrik Mühendisliği',    v_category_id, 10),
        ('Elektronik Mühendisliği',  v_category_id, 20),
        ('Endüstri Mühendisliği',    v_category_id, 30),
        ('Fizik Mühendisliği',       v_category_id, 40),
        ('Uzay Mühendisliği',        v_category_id, 50),
        ('İnşaat Mühendisliği',      v_category_id, 60),
        ('Makine Mühendisliği',      v_category_id, 70),
        ('Otomotiv Mühendisliği',    v_category_id, 80);

    RAISE NOTICE 'Mühendislik alt bölümleri başarıyla eklendi. (% adet)', 8;
END $$;

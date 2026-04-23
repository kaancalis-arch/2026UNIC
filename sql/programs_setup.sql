
-- 1. Create programs table for MainDegreeData (Alt Başlıklar)
CREATE TABLE IF NOT EXISTS public.programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    career_opportunities TEXT,
    ai_impact TEXT,
    top_companies TEXT,
    sector_status_tr TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create junction table for many-to-many relationship with main_categories
CREATE TABLE IF NOT EXISTS public.program_category_junction (
    program_id UUID NOT NULL,
    category_id UUID NOT NULL,
    PRIMARY KEY (program_id, category_id)
);

-- 3. Enable RLS for both tables
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_category_junction ENABLE ROW LEVEL SECURITY;

-- 4. Policies for programs table
DROP POLICY IF EXISTS "Allow public read access" ON public.programs;
CREATE POLICY "Allow public read access" ON public.programs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated full access" ON public.programs;
CREATE POLICY "Allow authenticated full access" ON public.programs FOR ALL USING (true);

-- 5. Policies for junction table
DROP POLICY IF EXISTS "Allow public read access" ON public.program_category_junction;
CREATE POLICY "Allow public read access" ON public.program_category_junction FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated full access" ON public.program_category_junction;
CREATE POLICY "Allow authenticated full access" ON public.program_category_junction FOR ALL USING (true);

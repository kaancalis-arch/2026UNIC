-- 1. Budget Ranges Table
CREATE TABLE IF NOT EXISTS public.budget_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.budget_ranges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.budget_ranges;
CREATE POLICY "Allow public read access" ON public.budget_ranges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.budget_ranges;
CREATE POLICY "Allow authenticated full access" ON public.budget_ranges FOR ALL USING (true); -- Note: For production use (auth.role() = 'authenticated')

-- Initial Data
INSERT INTO public.budget_ranges (label, sort_order) 
SELECT label, sort_order FROM (
  VALUES 
    ('Bütçe Konusunda Kararsızım', 10),
    ('5.000''e kadar', 20),
    ('10.000''e kadar', 30),
    ('15.000''e kadar', 40),
    ('20.000''e kadar', 50),
    ('20.000 üzeri uygundur', 60)
) AS t(label, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.budget_ranges);


-- 2. Interested Programs
CREATE TABLE IF NOT EXISTS public.interested_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.interested_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.interested_programs;
CREATE POLICY "Allow public read access" ON public.interested_programs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.interested_programs;
CREATE POLICY "Allow authenticated full access" ON public.interested_programs FOR ALL USING (true);


-- 3. Main Categories & Junction
CREATE TABLE IF NOT EXISTS public.main_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.main_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.main_categories;
CREATE POLICY "Allow public read access" ON public.main_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.main_categories;
CREATE POLICY "Allow authenticated full access" ON public.main_categories FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.program_category_junction (
    program_id UUID NOT NULL,
    category_id UUID NOT NULL,
    PRIMARY KEY (program_id, category_id)
);


-- 4. University Types
CREATE TABLE IF NOT EXISTS public.university_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add visa_application_date column to student_profiles if it doesn't exist
ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS visa_application_date DATE;

ALTER TABLE public.university_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.university_types;
CREATE POLICY "Allow public read access" ON public.university_types FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.university_types;
CREATE POLICY "Allow authenticated full access" ON public.university_types FOR ALL USING (true);

-- Add visa_reports JSONB to student_profiles
ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS visa_reports JSONB;

-- Add analyse_status column to student_profiles
ALTER TABLE public.student_profiles ADD COLUMN IF NOT EXISTS analyse_status TEXT DEFAULT 'Hot';
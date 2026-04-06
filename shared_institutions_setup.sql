-- =============================================
-- SHARED INSTITUTIONS TABLE (Kurumlar)
-- =============================================

-- 1. Tabloyu oluştur
CREATE TABLE IF NOT EXISTS public.shared_institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    authorized_person TEXT,
    description TEXT,
    contact_name TEXT,
    contact_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. RLS (Row Level Security) aktif et
ALTER TABLE public.shared_institutions ENABLE ROW LEVEL SECURITY;

-- 3. Okuma politikası
DROP POLICY IF EXISTS "Allow public read access" ON public.shared_institutions;
CREATE POLICY "Allow public read access" ON public.shared_institutions FOR SELECT USING (true);

-- 4. Tam erişim politikası
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.shared_institutions;
CREATE POLICY "Allow authenticated full access" ON public.shared_institutions FOR ALL USING (true);

-- =============================================
-- Eğer tablo zaten varsa ve yeni sütunlar eksikse:
-- (Aşağıdaki satırları yalnızca tablo varken çalıştırın)
-- =============================================
-- ALTER TABLE public.shared_institutions ADD COLUMN IF NOT EXISTS phone TEXT;
-- ALTER TABLE public.shared_institutions ADD COLUMN IF NOT EXISTS email TEXT;
-- ALTER TABLE public.shared_institutions ADD COLUMN IF NOT EXISTS notes TEXT;
-- ALTER TABLE public.shared_institutions ADD COLUMN IF NOT EXISTS authorized_person TEXT;

-- 1. Ülkeler Tablosunu Oluştur (Eğer yoksa)
CREATE TABLE IF NOT EXISTS public.countries (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    flag TEXT,
    capital TEXT,
    currency TEXT,
    education_system_description TEXT,
    bachelor_types JSONB DEFAULT '[]'::jsonb,
    master_types JSONB DEFAULT '[]'::jsonb,
    post_grad_work_permit TEXT,
    student_work_permit TEXT,
    yks_requirement TEXT,
    population TEXT,
    popular_sectors TEXT,
    general_application_requirements TEXT,
    exam_requirements TEXT,
    foundation_requirements TEXT,
    visa_types JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Politikaları
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON public.countries;
CREATE POLICY "Allow public read access" ON public.countries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.countries;
CREATE POLICY "Allow authenticated full access" ON public.countries FOR ALL USING (true);

-- 2. Vize Bilgilerini İçeren Ülke Verilerini İşle
INSERT INTO public.countries (id, name, flag, visa_types)
VALUES
('germany', 'Almanya', '🇩🇪', '[
    {"id": "de-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "90 güne kadar turistik ve kısa ziyaretler"},
    {"id": "de-v2", "name": "Eğitim - Dil Kursu Vizesi", "description": "Sadece dil eğitimi için, genelde çalışma izni yok"},
    {"id": "de-v3", "name": "Eğitim - Öğrenci Aday Vizesi", "description": "Üniversite başvuru süreci için geçici giriş"},
    {"id": "de-v4", "name": "Eğitim - Ulusal Öğrenci Vizesi (D Tipi)", "description": "Uzun dönem üniversite eğitimi + oturum izni"}
]'::jsonb),
('usa', 'Amerika Birleşik Devletleri', '🇺🇸', '[
    {"id": "us-v1", "name": "Turistik - B1/B2 Visitor Visa", "description": "Turistik, iş görüşmesi ve kısa süreli ziyaretler"},
    {"id": "us-v2", "name": "Eğitim - F-1 (Akademik eğitim)", "description": "Üniversite ve dil okulları için ana öğrenci vizesi"},
    {"id": "us-v3", "name": "Eğitim - M-1 (Mesleki eğitim)", "description": "Teknik ve vocational programlar için"},
    {"id": "us-v4", "name": "Eğitim - J-1 (Değişim programı)", "description": "Work & Travel, exchange ve staj programları"}
]'::jsonb),
('australia', 'Avustralya', '🇦🇺', '[
    {"id": "au-v1", "name": "Turistik - Visitor Visa (Subclass 600)", "description": "Turistik ziyaret ve kısa süreli seyahat"},
    {"id": "au-v2", "name": "Eğitim - Student Visa (Subclass 500)", "description": "Tüm eğitim türleri + part-time çalışma hakkı"}
]'::jsonb),
('belgium', 'Belçika', '🇧🇪', '[
    {"id": "be-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "90 gün kısa süreli ziyaret"},
    {"id": "be-v2", "name": "Eğitim - Long Stay Student Visa (D Tipi)", "description": "Üniversite eğitimi + oturum izni"}
]'::jsonb),
('france', 'Fransa', '🇫🇷', '[
    {"id": "fr-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "90 güne kadar turistik seyahat"},
    {"id": "fr-v2", "name": "Eğitim - Étudiant Visa (VLS-TS)", "description": "Uzun dönem eğitim + oturum ve sınırlı çalışma hakkı"}
]'::jsonb),
('netherlands', 'Hollanda', '🇳🇱', '[
    {"id": "nl-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "Kısa süreli turistik ziyaret"},
    {"id": "nl-v2", "name": "Eğitim - MVV + Student Residence Permit", "description": "Giriş vizesi + oturum kartı birlikte yürür"}
]'::jsonb),
('united-kingdom', 'İngiltere', '🇬🇧', '[
    {"id": "uk-v1", "name": "Turistik - Standard Visitor Visa", "description": "6 aya kadar turistik ve kısa ziyaret"},
    {"id": "uk-v2", "name": "Eğitim - Student Visa", "description": "Üniversite ve uzun dönem eğitim + çalışma hakkı"},
    {"id": "uk-v3", "name": "Eğitim - Short-term Study Visa", "description": "6-11 ay arası dil eğitimi"}
]'::jsonb),
('ireland', 'İrlanda', '🇮🇪', '[
    {"id": "ie-v1", "name": "Turistik - Short Stay ‘C’ Visa", "description": "90 güne kadar kısa süreli ziyaret"},
    {"id": "ie-v2", "name": "Eğitim - Stamp 2 Student Visa", "description": "Dil okulu ve üniversite + çalışma izni"}
]'::jsonb),
('spain', 'İspanya', '🇪🇸', '[
    {"id": "es-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "90 gün turistik seyahat"},
    {"id": "es-v2", "name": "Eğitim - Student Visa (Estancia por estudios)", "description": "Eğitim süresince oturum hakkı"}
]'::jsonb),
('sweden', 'İsveç', '🇸🇪', '[
    {"id": "se-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "Kısa süreli ziyaret"},
    {"id": "se-v2", "name": "Eğitim - Residence Permit for Studies", "description": "Eğitim süresince oturum ve çalışma imkanı"}
]'::jsonb),
('italy', 'İtalya', '🇮🇹', '[
    {"id": "it-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "90 gün turistik seyahat"},
    {"id": "it-v2", "name": "Eğitim - National Study Visa (D Tipi)", "description": "Üniversite eğitimi + oturum izni"}
]'::jsonb),
('canada', 'Kanada', '🇨🇦', '[
    {"id": "ca-v1", "name": "Turistik - Visitor Visa (TRV)", "description": "Turistik ziyaret için giriş vizesi"},
    {"id": "ca-v2", "name": "Eğitim - Study Permit", "description": "Eğitim süresince kalış + part-time çalışma hakkı"}
]'::jsonb),
('hungary', 'Macaristan', '🇭🇺', '[
    {"id": "hu-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "90 gün kısa ziyaret"},
    {"id": "hu-v2", "name": "Eğitim - Residence Permit for Study Purposes", "description": "Eğitim süresince oturum"}
]'::jsonb),
('poland', 'Polonya', '🇵🇱', '[
    {"id": "pl-v1", "name": "Turistik - Schengen Vizesi (C Tipi)", "description": "Kısa süreli turistik ziyaret"},
    {"id": "pl-v2", "name": "Eğitim - National Visa (D Tipi – Student)", "description": "Uzun dönem eğitim ve oturum"}
]'::jsonb)
ON CONFLICT (name) DO UPDATE SET 
    flag = EXCLUDED.flag,
    visa_types = EXCLUDED.visa_types;

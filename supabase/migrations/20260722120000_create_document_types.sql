BEGIN;

CREATE TABLE IF NOT EXISTS public.document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  english_name text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  file_type text NOT NULL,
  allow_multiple boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_types
  ADD COLUMN IF NOT EXISTS english_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  expected record;
  actual record;
BEGIN
  FOR expected IN
    SELECT * FROM (VALUES
      ('id', 'uuid', true),
      ('name', 'text', true),
      ('english_name', 'text', true),
      ('note', 'text', true),
      ('file_type', 'text', true),
      ('allow_multiple', 'boolean', true),
      ('is_active', 'boolean', true),
      ('is_required', 'boolean', true),
      ('sort_order', 'integer', true),
      ('created_at', 'timestamp with time zone', true),
      ('updated_at', 'timestamp with time zone', true)
    ) AS columns(column_name, data_type, must_be_not_null)
  LOOP
    SELECT c.data_type, c.is_nullable
    INTO actual
    FROM information_schema.columns AS c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'document_types'
      AND c.column_name = expected.column_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'document_types.% is missing; refusing an incompatible schema', expected.column_name;
    END IF;
    IF actual.data_type <> expected.data_type THEN
      RAISE EXCEPTION 'document_types.% has type %, expected %; refusing an incompatible schema',
        expected.column_name, actual.data_type, expected.data_type;
    END IF;
    IF expected.must_be_not_null AND actual.is_nullable <> 'NO' THEN
      RAISE EXCEPTION 'document_types.% must be NOT NULL; clean existing nulls explicitly before retrying', expected.column_name;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.document_types'::regclass
      AND contype = 'p'
      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
  ) THEN
    RAISE EXCEPTION 'document_types must have PRIMARY KEY (id); refusing an incompatible schema';
  END IF;
END;
$$;

ALTER TABLE public.document_types
  DROP CONSTRAINT IF EXISTS document_types_name_not_blank,
  DROP CONSTRAINT IF EXISTS document_types_file_type_not_blank,
  DROP CONSTRAINT IF EXISTS document_types_sort_order_nonnegative;

ALTER TABLE public.document_types
  ADD CONSTRAINT document_types_name_not_blank CHECK (btrim(name) <> ''),
  ADD CONSTRAINT document_types_file_type_not_blank CHECK (btrim(file_type) <> ''),
  ADD CONSTRAINT document_types_sort_order_nonnegative CHECK (sort_order >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS document_types_name_unique_idx
  ON public.document_types (lower(btrim(name)));
CREATE INDEX IF NOT EXISTS document_types_active_sort_idx
  ON public.document_types (is_active, sort_order, name);

INSERT INTO public.document_types (
  name, english_name, note, file_type, allow_multiple, is_active, is_required, sort_order
)
SELECT seed.name, seed.english_name, seed.note, seed.file_type,
  seed.allow_multiple, true, seed.is_required, seed.sort_order
FROM (VALUES
  ('Pasaport', 'Passport', 'Eğitim süresince geçerli olması tavsiye edilir.', 'PDF veya görsel', false, true, 10),
  ('Transkript', 'Transcript', 'Güncel eğitim notlarını gösteren belge.', 'PDF veya görsel', false, true, 20),
  ('Diploma', 'Diploma', 'Mezuniyet belgesi veya diploma.', 'PDF veya görsel', false, false, 30),
  ('CV', 'CV', 'Eğitim geçmişi ve sertifikalar.', 'PDF', false, false, 40),
  ('Dil Belgesi', 'Language Certificate', 'Geçerli dil sınavı sonuç belgesi.', 'PDF veya görsel', true, false, 50),
  ('Niyet Mektubu', 'Motivation Letter', 'Başvuru amacını belirten ön yazı.', 'PDF', true, false, 60),
  ('Referans Mektubu', 'Reference Letter', 'Akademik veya profesyonel referans.', 'PDF', true, false, 70),
  ('Fotoğraf', 'Photograph', 'Güncel öğrenci fotoğrafı.', 'Görsel', false, false, 80)
) AS seed(name, english_name, note, file_type, allow_multiple, is_required, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_types AS existing
  WHERE lower(btrim(existing.name)) = lower(btrim(seed.name))
);

CREATE OR REPLACE FUNCTION public.set_document_types_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_document_types_updated_at ON public.document_types;
CREATE TRIGGER set_document_types_updated_at
BEFORE UPDATE ON public.document_types
FOR EACH ROW EXECUTE FUNCTION public.set_document_types_updated_at();

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_types FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_document_type_actor(require_admin boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_users AS actor
    WHERE actor.id = auth.uid()
      AND actor.status = 'active'
      AND (NOT require_admin OR actor.role IN ('Super Admin', 'Admin'))
  );
$$;

DROP POLICY IF EXISTS document_types_select ON public.document_types;
CREATE POLICY document_types_select
ON public.document_types FOR SELECT TO authenticated
USING (public.is_active_document_type_actor(false));

DROP POLICY IF EXISTS document_types_insert ON public.document_types;
CREATE POLICY document_types_insert
ON public.document_types FOR INSERT TO authenticated
WITH CHECK (public.is_active_document_type_actor(true));

DROP POLICY IF EXISTS document_types_update ON public.document_types;
CREATE POLICY document_types_update
ON public.document_types FOR UPDATE TO authenticated
USING (public.is_active_document_type_actor(true))
WITH CHECK (public.is_active_document_type_actor(true));

DROP POLICY IF EXISTS document_types_delete ON public.document_types;
CREATE POLICY document_types_delete
ON public.document_types FOR DELETE TO authenticated
USING (public.is_active_document_type_actor(true));

REVOKE ALL ON TABLE public.document_types FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.document_types TO authenticated;
GRANT ALL ON TABLE public.document_types TO service_role;
REVOKE ALL ON FUNCTION public.set_document_types_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_active_document_type_actor(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_document_type_actor(boolean) TO authenticated;

COMMIT;

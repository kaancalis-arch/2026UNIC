-- counselor_id is intentionally retained. Renaming it would break deployed clients and
-- unknown database dependencies; application code treats it as the responsible user.
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS branch_id uuid;

-- Preserve existing assignments and derive the student's branch where it is unambiguous.
UPDATE public.student_profiles AS student
SET branch_id = responsible.branch_id
FROM public.system_users AS responsible
WHERE student.branch_id IS NULL
  AND COALESCE(student.counselor_id, student.representative_id) = responsible.id
  AND responsible.branch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS student_profiles_branch_id_idx
  ON public.student_profiles (branch_id);

CREATE INDEX IF NOT EXISTS student_profiles_counselor_id_idx
  ON public.student_profiles (counselor_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.student_profiles'::regclass
      AND conname = 'student_profiles_branch_id_fkey'
  ) THEN
    ALTER TABLE public.student_profiles
      ADD CONSTRAINT student_profiles_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.branches(id)
      ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.student_profiles'::regclass
      AND conname = 'student_profiles_counselor_id_fkey'
  ) THEN
    ALTER TABLE public.student_profiles
      ADD CONSTRAINT student_profiles_counselor_id_fkey
      FOREIGN KEY (counselor_id) REFERENCES public.system_users(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_student_responsible_user()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  responsible public.system_users%ROWTYPE;
BEGIN
  IF NEW.counselor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO responsible
  FROM public.system_users
  WHERE id = NEW.counselor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seçilen sorumlu kullanıcı bulunamadı.';
  END IF;

  IF responsible.role NOT IN ('Danışman', 'Temsilci', 'Öğrenci Temsilci', 'Öğrenci Temsilcisi') THEN
    RAISE EXCEPTION 'Öğrenci yalnızca Danışman, Temsilci veya Öğrenci Temsilcisine atanabilir.';
  END IF;

  IF responsible.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Öğrenci yalnızca aktif bir kullanıcıya atanabilir.';
  END IF;

  IF NEW.branch_id IS NULL OR NEW.branch_id IS DISTINCT FROM responsible.branch_id THEN
    RAISE EXCEPTION 'Öğrenci ile sorumlu kullanıcı aynı şubede olmalıdır.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_student_responsible_user_trigger
  ON public.student_profiles;

CREATE TRIGGER validate_student_responsible_user_trigger
BEFORE INSERT OR UPDATE OF counselor_id, branch_id
ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_student_responsible_user();

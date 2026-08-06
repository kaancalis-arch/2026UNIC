ALTER TABLE public.system_users
  ADD COLUMN IF NOT EXISTS parent_user_id uuid;

CREATE INDEX IF NOT EXISTS system_users_parent_user_id_idx
  ON public.system_users (parent_user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.system_users'::regclass
      AND conname = 'system_users_parent_user_id_fkey'
  ) THEN
    ALTER TABLE public.system_users
      ADD CONSTRAINT system_users_parent_user_id_fkey
      FOREIGN KEY (parent_user_id) REFERENCES public.system_users(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.system_user_parent_is_valid(
  child_role text,
  child_branch_id uuid,
  parent_role text,
  parent_branch_id uuid,
  parent_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(parent_status = 'active'
    AND (child_branch_id IS NULL OR parent_branch_id IS NULL OR child_branch_id = parent_branch_id)
    AND CASE child_role
      WHEN 'Admin' THEN parent_role = 'Super Admin'
      WHEN 'Şube Müdürü' THEN parent_role = 'Admin'
      WHEN 'Danışman' THEN parent_role = 'Şube Müdürü'
        AND child_branch_id IS NOT NULL
        AND child_branch_id = parent_branch_id
      WHEN 'Temsilci' THEN parent_role IN ('Şube Müdürü', 'Danışman')
        AND child_branch_id IS NOT NULL
        AND child_branch_id = parent_branch_id
      WHEN 'Öğrenci Temsilci' THEN parent_role = 'Danışman'
        AND child_branch_id IS NOT NULL
        AND child_branch_id = parent_branch_id
      WHEN 'Öğrenci' THEN parent_role IN ('Danışman', 'Temsilci', 'Öğrenci Temsilci')
        AND child_branch_id IS NOT NULL
        AND child_branch_id = parent_branch_id
      ELSE false
    END, false);
$$;

CREATE OR REPLACE FUNCTION public.validate_system_user_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_record public.system_users%ROWTYPE;
BEGIN
  IF NEW.role IS NULL OR NEW.role NOT IN (
    'Super Admin', 'Admin', 'Şube Müdürü', 'Danışman',
    'Temsilci', 'Öğrenci Temsilci', 'Öğrenci'
  ) THEN
    RAISE EXCEPTION 'Geçersiz kullanıcı rolü.';
  END IF;

  IF NEW.status IS NULL OR NEW.status NOT IN ('active', 'passive') THEN
    RAISE EXCEPTION 'Durum active veya passive olmalıdır.';
  END IF;

  IF NEW.role IN ('Şube Müdürü', 'Danışman', 'Temsilci', 'Öğrenci Temsilci', 'Öğrenci')
     AND NEW.branch_id IS NULL THEN
    RAISE EXCEPTION '% rolü için şube zorunludur.', NEW.role;
  END IF;

  IF NEW.role = 'Super Admin' THEN
    IF NEW.parent_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Super Admin için üst kullanıcı seçilemez.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.parent_user_id IS NULL THEN
    RAISE EXCEPTION '% rolü için üst kullanıcı zorunludur.', NEW.role;
  END IF;

  IF NEW.parent_user_id = NEW.id THEN
    RAISE EXCEPTION 'Kullanıcı kendisinin üst kullanıcısı olamaz.';
  END IF;

  SELECT *
  INTO parent_record
  FROM public.system_users
  WHERE id = NEW.parent_user_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seçilen üst kullanıcı bulunamadı.';
  END IF;

  IF NOT public.system_user_parent_is_valid(
    NEW.role, NEW.branch_id, parent_record.role, parent_record.branch_id, parent_record.status
  ) THEN
    IF parent_record.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION 'Üst kullanıcı aktif olmalıdır.';
    END IF;
    RAISE EXCEPTION 'Üst kullanıcı rolü veya şubesi geçersizdir.';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT user_row.id, user_row.parent_user_id, ARRAY[user_row.id] AS path, false AS cycle
      FROM public.system_users AS user_row
      WHERE user_row.id = NEW.parent_user_id

      UNION ALL

      SELECT user_row.id,
             user_row.parent_user_id,
             ancestors.path || user_row.id,
             user_row.id = ANY(ancestors.path)
      FROM ancestors
      JOIN public.system_users AS user_row ON user_row.id = ancestors.parent_user_id
      WHERE NOT ancestors.cycle
    )
    SELECT 1
    FROM ancestors
    WHERE id = NEW.id OR cycle
  ) THEN
    RAISE EXCEPTION 'Kullanıcı hiyerarşisinde döngü oluşturulamaz.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_invalid_system_user_children()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.system_users AS child
    WHERE child.parent_user_id = OLD.id
      AND public.system_user_parent_is_valid(
        child.role, child.branch_id, OLD.role, OLD.branch_id, OLD.status
      )
      AND NOT public.system_user_parent_is_valid(
        child.role, child.branch_id, NEW.role, NEW.branch_id, NEW.status
      )
  ) THEN
    RAISE EXCEPTION 'Bu değişiklik mevcut alt kullanıcı hiyerarşisini geçersiz kılar.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_system_user_hierarchy_trigger
  ON public.system_users;

CREATE TRIGGER validate_system_user_hierarchy_trigger
BEFORE INSERT OR UPDATE OF role, branch_id, parent_user_id, status
ON public.system_users
FOR EACH ROW
EXECUTE FUNCTION public.validate_system_user_hierarchy();

DROP TRIGGER IF EXISTS prevent_invalid_system_user_children_trigger
  ON public.system_users;

CREATE TRIGGER prevent_invalid_system_user_children_trigger
BEFORE UPDATE OF role, branch_id, status
ON public.system_users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_invalid_system_user_children();

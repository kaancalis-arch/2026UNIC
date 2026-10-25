BEGIN;

CREATE OR REPLACE FUNCTION public.core_actor_can_read_branch(
  target_branch_id uuid,
  target_branch_status text
)
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
      AND (
        actor.role = 'Super Admin'
        OR (
          target_branch_status = 'active'
          AND (
            actor.role = 'Admin'
            OR (
              actor.role IN ('Şube Müdürü', 'Danışman', 'Temsilci', 'Öğrenci Temsilci', 'Öğrenci')
              AND actor.branch_id = target_branch_id
            )
          )
        )
      )
  );
$$;

ALTER FUNCTION public.core_actor_can_read_branch(uuid, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.core_actor_can_read_branch(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.core_actor_can_read_branch(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.core_actor_can_read_system_user(
  target_user_id uuid,
  target_branch_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  WITH RECURSIVE actor AS (
    SELECT actor_row.id, actor_row.role, actor_row.branch_id
    FROM public.system_users AS actor_row
    WHERE actor_row.id = auth.uid()
      AND actor_row.status = 'active'
      AND actor_row.role IN ('Super Admin', 'Admin', 'Şube Müdürü', 'Danışman', 'Temsilci', 'Öğrenci Temsilci', 'Öğrenci')
      AND (
        actor_row.role IN ('Super Admin', 'Admin')
        OR (
          actor_row.branch_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.branches AS actor_branch
            WHERE actor_branch.id = actor_row.branch_id AND actor_branch.status = 'active'
          )
        )
      )
  ), ancestry AS (
    SELECT target.id, target.role, target.branch_id, target.parent_user_id, target.status,
      ARRAY[target.id]::uuid[] AS path
    FROM public.system_users AS target
    WHERE target.id = target_user_id
      AND target.branch_id IS NOT DISTINCT FROM target_branch_id

    UNION ALL

    SELECT parent.id, parent.role, parent.branch_id, parent.parent_user_id, parent.status,
      ancestry.path || parent.id
    FROM ancestry
    JOIN public.system_users AS parent ON parent.id = ancestry.parent_user_id
    WHERE parent.id <> ALL (ancestry.path)
      AND public.system_user_parent_is_valid(
        ancestry.role,
        ancestry.branch_id,
        parent.role,
        parent.branch_id,
        parent.status
      )
  )
  SELECT EXISTS (
    SELECT 1
    FROM actor
    JOIN ancestry ON ancestry.id = actor.id
    WHERE actor.role IN ('Super Admin', 'Admin') OR target_branch_id = actor.branch_id
  );
$$;

ALTER FUNCTION public.core_actor_can_read_system_user(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.core_actor_can_read_system_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.core_actor_can_read_system_user(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_student_auth_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  linked_user public.system_users%ROWTYPE;
BEGIN
  IF NEW.student_user_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO linked_user
  FROM public.system_users
  WHERE id = NEW.student_user_id
  FOR KEY SHARE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Bağlanacak öğrenci kullanıcısı bulunamadı.'; END IF;
  IF linked_user.role IS DISTINCT FROM 'Öğrenci' THEN
    RAISE EXCEPTION 'Yalnız Öğrenci rolündeki kullanıcı bağlanabilir.';
  END IF;
  IF linked_user.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Bağlanacak öğrenci kullanıcısı aktif olmalıdır.';
  END IF;
  IF NEW.branch_id IS NULL OR linked_user.branch_id IS NULL OR NEW.branch_id IS DISTINCT FROM linked_user.branch_id THEN
    RAISE EXCEPTION 'Öğrenci profili ve kullanıcı aynı aktif şubede olmalıdır.';
  END IF;
  IF NEW.counselor_id IS NULL OR linked_user.parent_user_id IS DISTINCT FROM NEW.counselor_id THEN
    RAISE EXCEPTION 'Öğrenci hesabı CRM profilinin sorumlu kullanıcısına bağlı olmalıdır.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.branches AS branch
    WHERE branch.id = NEW.branch_id AND branch.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Öğrenci profili yalnızca aktif bir şubede kullanıcı hesabına bağlanabilir.';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.validate_student_auth_link() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_student_auth_link() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS validate_student_auth_link_trigger ON public.student_profiles;
CREATE TRIGGER validate_student_auth_link_trigger
BEFORE INSERT OR UPDATE OF student_user_id, branch_id, counselor_id
ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_student_auth_link();

CREATE OR REPLACE FUNCTION public.require_student_auth_link_rpc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF current_user <> 'postgres' AND (
    (TG_OP = 'INSERT' AND NEW.student_user_id IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND OLD.student_user_id IS DISTINCT FROM NEW.student_user_id)
  ) THEN
    RAISE EXCEPTION 'STUDENT_AUTH_LINK_RPC_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.require_student_auth_link_rpc() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.require_student_auth_link_rpc() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS require_student_auth_link_rpc_trigger ON public.student_profiles;
CREATE TRIGGER require_student_auth_link_rpc_trigger
BEFORE INSERT OR UPDATE OF student_user_id ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.require_student_auth_link_rpc();

CREATE OR REPLACE FUNCTION public.protect_linked_student_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF current_user = 'postgres' THEN RETURN NEW; END IF;
  IF EXISTS (
    SELECT 1
    FROM public.student_profiles AS student
    WHERE student.student_user_id = OLD.id
      AND (
        NEW.role IS DISTINCT FROM 'Öğrenci'
        OR NEW.status IS DISTINCT FROM 'active'
        OR NEW.branch_id IS NULL
        OR NEW.branch_id IS DISTINCT FROM student.branch_id
        OR NEW.parent_user_id IS DISTINCT FROM student.counselor_id
        OR NOT EXISTS (
          SELECT 1 FROM public.branches AS branch
          WHERE branch.id = NEW.branch_id AND branch.status = 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Bağlı öğrenci hesabının rolü, durumu veya şubesi değiştirilemez.';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.protect_linked_student_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.protect_linked_student_user() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS protect_linked_student_user_trigger ON public.system_users;
CREATE TRIGGER protect_linked_student_user_trigger
BEFORE UPDATE OF role, branch_id, parent_user_id, status ON public.system_users
FOR EACH ROW
EXECUTE FUNCTION public.protect_linked_student_user();

CREATE OR REPLACE FUNCTION public.sync_linked_student_user_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.student_user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.branch_id IS NULL OR NEW.counselor_id IS NULL THEN
    RAISE EXCEPTION 'Hesaba bağlı öğrenci şubesiz veya sorumlusuz bırakılamaz.';
  END IF;
  UPDATE public.system_users
  SET branch_id = NEW.branch_id,
      parent_user_id = NEW.counselor_id
  WHERE id = NEW.student_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bağlı öğrenci hesabı bulunamadı.'; END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.sync_linked_student_user_assignment() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_linked_student_user_assignment() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS sync_linked_student_user_assignment_trigger ON public.student_profiles;
CREATE TRIGGER sync_linked_student_user_assignment_trigger
BEFORE UPDATE OF branch_id, counselor_id ON public.student_profiles
FOR EACH ROW
WHEN (
  OLD.student_user_id IS NOT NULL
  AND (
    OLD.branch_id IS DISTINCT FROM NEW.branch_id
    OR OLD.counselor_id IS DISTINCT FROM NEW.counselor_id
  )
)
EXECUTE FUNCTION public.sync_linked_student_user_assignment();

CREATE OR REPLACE FUNCTION public.prevent_student_document_replacement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'archived'
     AND NEW.status = 'archived'
     AND EXISTS (
       SELECT 1 FROM public.system_users AS actor
       WHERE actor.id = NEW.archived_by AND actor.role = 'Öğrenci'
     ) THEN
    RAISE EXCEPTION 'Öğrenci hesapları mevcut belgeyi arşivleyemez veya değiştiremez.';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.prevent_student_document_replacement() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.prevent_student_document_replacement() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS prevent_student_document_replacement_trigger ON public.student_documents;
CREATE TRIGGER prevent_student_document_replacement_trigger
BEFORE UPDATE OF status ON public.student_documents
FOR EACH ROW
EXECUTE FUNCTION public.prevent_student_document_replacement();

CREATE OR REPLACE FUNCTION public.link_student_user(
  p_student_id uuid,
  p_student_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  changed_id uuid;
BEGIN
  UPDATE public.student_profiles
  SET student_user_id = p_student_user_id
  WHERE id = p_student_id
    AND student_user_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.system_users AS linked_user
      WHERE linked_user.id = p_student_user_id
        AND linked_user.role = 'Öğrenci'
        AND linked_user.status = 'active'
        AND linked_user.branch_id = student_profiles.branch_id
        AND linked_user.parent_user_id = student_profiles.counselor_id
    )
  RETURNING id INTO changed_id;

  IF changed_id IS NULL THEN
    RAISE EXCEPTION 'Öğrenci profili bulunamadı veya başka bir hesaba bağlı.';
  END IF;
  RETURN true;
END;
$$;

ALTER FUNCTION public.link_student_user(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.link_student_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_student_user(uuid, uuid) TO service_role;

COMMIT;

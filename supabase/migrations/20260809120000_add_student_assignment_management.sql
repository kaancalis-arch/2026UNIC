BEGIN;

-- UUID values intentionally remain independent of operational FKs so later deletions
-- cannot erase audit attribution or introduce new delete blockers.
CREATE TABLE public.student_assignment_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id uuid NOT NULL,
  actor_user_id uuid NOT NULL,
  old_branch_id uuid,
  new_branch_id uuid,
  old_assigned_user_id uuid,
  new_assigned_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX student_assignment_audit_student_created_idx
  ON public.student_assignment_audit (student_id, created_at DESC);
CREATE INDEX student_assignment_audit_actor_created_idx
  ON public.student_assignment_audit (actor_user_id, created_at DESC);

ALTER TABLE public.student_assignment_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assignment_audit FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_assignment_audit
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.student_assignment_audit_id_seq
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.require_student_assignment_rpc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'ASSIGNMENT_RPC_REQUIRED';
  END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.require_student_assignment_rpc() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.require_student_assignment_rpc()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS require_student_assignment_rpc_trigger
  ON public.student_profiles;
CREATE TRIGGER require_student_assignment_rpc_trigger
BEFORE UPDATE OF branch_id, counselor_id, representative_id
ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.require_student_assignment_rpc();

DROP TRIGGER IF EXISTS require_student_assignment_rpc_on_insert_trigger
  ON public.student_profiles;
CREATE TRIGGER require_student_assignment_rpc_on_insert_trigger
BEFORE INSERT
ON public.student_profiles
FOR EACH ROW
WHEN (
  NEW.branch_id IS NOT NULL
  OR NEW.counselor_id IS NOT NULL
  OR NEW.representative_id IS NOT NULL
)
EXECUTE FUNCTION public.require_student_assignment_rpc();

CREATE OR REPLACE FUNCTION public.apply_student_assignments(
  p_actor_user_id uuid,
  p_student_ids uuid[],
  p_branch_supplied boolean,
  p_branch_id uuid,
  p_assigned_user_supplied boolean,
  p_assigned_user_id uuid
)
RETURNS TABLE (changed_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  actor public.system_users%ROWTYPE;
  assigned_user public.system_users%ROWTYPE;
  target_count integer;
  audit_count integer;
BEGIN
  IF p_actor_user_id IS NULL
     OR p_student_ids IS NULL
     OR p_branch_supplied IS NULL
     OR p_assigned_user_supplied IS NULL
     OR cardinality(p_student_ids) NOT BETWEEN 1 AND 100
     OR array_position(p_student_ids, NULL) IS NOT NULL
     OR (SELECT count(DISTINCT student_id) FROM unnest(p_student_ids) AS student_id)
        <> cardinality(p_student_ids) THEN
    RAISE EXCEPTION 'ASSIGNMENT_INVALID_PAYLOAD';
  END IF;

  IF NOT p_branch_supplied AND NOT p_assigned_user_supplied THEN
    RAISE EXCEPTION 'ASSIGNMENT_INVALID_PAYLOAD';
  END IF;
  IF (NOT p_branch_supplied AND p_branch_id IS NOT NULL)
     OR (NOT p_assigned_user_supplied AND p_assigned_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'ASSIGNMENT_INVALID_PAYLOAD';
  END IF;

  SELECT system_actor.*
  INTO actor
  FROM public.system_users AS system_actor
  WHERE system_actor.id = p_actor_user_id
  FOR SHARE;

  IF NOT FOUND OR actor.status IS DISTINCT FROM 'active'
     OR actor.role NOT IN ('Super Admin', 'Admin', 'Şube Müdürü') THEN
    RAISE EXCEPTION 'ASSIGNMENT_FORBIDDEN';
  END IF;

  IF actor.role = 'Şube Müdürü' THEN
    IF actor.branch_id IS NULL OR p_branch_supplied THEN
      RAISE EXCEPTION 'ASSIGNMENT_FORBIDDEN';
    END IF;
    PERFORM branch.id
    FROM public.branches AS branch
    WHERE branch.id = actor.branch_id
      AND branch.status = 'active'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ASSIGNMENT_FORBIDDEN';
    END IF;
  END IF;

  PERFORM student.id
  FROM public.student_profiles AS student
  WHERE student.id = ANY (p_student_ids)
  ORDER BY student.id
  FOR UPDATE;
  GET DIAGNOSTICS target_count = ROW_COUNT;

  IF target_count <> cardinality(p_student_ids) THEN
    RAISE EXCEPTION 'ASSIGNMENT_STUDENT_NOT_FOUND';
  END IF;

  IF actor.role = 'Şube Müdürü' AND EXISTS (
    SELECT 1
    FROM public.student_profiles AS student
    WHERE student.id = ANY (p_student_ids)
      AND student.branch_id IS DISTINCT FROM actor.branch_id
  ) THEN
    RAISE EXCEPTION 'ASSIGNMENT_FORBIDDEN';
  END IF;

  IF p_branch_supplied AND p_branch_id IS NOT NULL THEN
    PERFORM branch.id
    FROM public.branches AS branch
    WHERE branch.id = p_branch_id
      AND branch.status = 'active'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ASSIGNMENT_INVALID_BRANCH';
    END IF;
  END IF;

  IF p_assigned_user_supplied AND p_assigned_user_id IS NOT NULL THEN
    SELECT responsible.*
    INTO assigned_user
    FROM public.system_users AS responsible
    WHERE responsible.id = p_assigned_user_id
    FOR SHARE;

    IF NOT FOUND
       OR assigned_user.status IS DISTINCT FROM 'active'
       OR assigned_user.role NOT IN ('Danışman', 'Temsilci', 'Öğrenci Temsilci')
       OR assigned_user.branch_id IS NULL THEN
      RAISE EXCEPTION 'ASSIGNMENT_INVALID_ASSIGNEE';
    END IF;

    PERFORM branch.id
    FROM public.branches AS branch
    WHERE branch.id = assigned_user.branch_id
      AND branch.status = 'active'
    FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ASSIGNMENT_INVALID_ASSIGNEE';
    END IF;

    IF p_branch_supplied THEN
      IF p_branch_id IS NULL OR assigned_user.branch_id IS DISTINCT FROM p_branch_id THEN
        RAISE EXCEPTION 'ASSIGNMENT_BRANCH_MISMATCH';
      END IF;
    ELSIF EXISTS (
      SELECT 1
      FROM public.student_profiles AS student
      WHERE student.id = ANY (p_student_ids)
        AND student.branch_id IS DISTINCT FROM assigned_user.branch_id
    ) THEN
      RAISE EXCEPTION 'ASSIGNMENT_BRANCH_MISMATCH';
    END IF;
  END IF;

  IF p_branch_supplied AND NOT p_assigned_user_supplied THEN
    PERFORM responsible.id
    FROM public.system_users AS responsible
    WHERE responsible.id IN (
      SELECT DISTINCT student.counselor_id
      FROM public.student_profiles AS student
      WHERE student.id = ANY (p_student_ids)
        AND student.counselor_id IS NOT NULL
    )
    ORDER BY responsible.id
    FOR SHARE;
  END IF;

  WITH desired AS MATERIALIZED (
    SELECT
      student.id,
      student.branch_id AS old_branch_id,
      student.counselor_id AS old_assigned_user_id,
      CASE WHEN p_branch_supplied THEN p_branch_id ELSE student.branch_id END AS new_branch_id,
      CASE
        WHEN p_assigned_user_supplied THEN p_assigned_user_id
        WHEN p_branch_supplied AND student.counselor_id IS NOT NULL AND NOT EXISTS (
          SELECT 1
          FROM public.system_users AS responsible
          WHERE responsible.id = student.counselor_id
            AND responsible.status = 'active'
            AND responsible.role IN ('Danışman', 'Temsilci', 'Öğrenci Temsilci')
            AND responsible.branch_id IS NOT DISTINCT FROM p_branch_id
        ) THEN NULL
        ELSE student.counselor_id
      END AS new_assigned_user_id
    FROM public.student_profiles AS student
    WHERE student.id = ANY (p_student_ids)
  ), changed AS (
    UPDATE public.student_profiles AS student
    SET branch_id = desired.new_branch_id,
        counselor_id = desired.new_assigned_user_id
    FROM desired
    WHERE student.id = desired.id
      AND (
        student.branch_id IS DISTINCT FROM desired.new_branch_id
        OR student.counselor_id IS DISTINCT FROM desired.new_assigned_user_id
      )
    RETURNING
      student.id,
      desired.old_branch_id,
      student.branch_id AS new_branch_id,
      desired.old_assigned_user_id,
      student.counselor_id AS new_assigned_user_id
  )
  INSERT INTO public.student_assignment_audit (
    student_id,
    actor_user_id,
    old_branch_id,
    new_branch_id,
    old_assigned_user_id,
    new_assigned_user_id
  )
  SELECT
    changed.id,
    p_actor_user_id,
    changed.old_branch_id,
    changed.new_branch_id,
    changed.old_assigned_user_id,
    changed.new_assigned_user_id
  FROM changed;

  GET DIAGNOSTICS audit_count = ROW_COUNT;
  RETURN QUERY SELECT audit_count;
END;
$$;

ALTER FUNCTION public.apply_student_assignments(uuid, uuid[], boolean, uuid, boolean, uuid)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.apply_student_assignments(uuid, uuid[], boolean, uuid, boolean, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_student_assignments(uuid, uuid[], boolean, uuid, boolean, uuid)
  TO service_role;

COMMIT;

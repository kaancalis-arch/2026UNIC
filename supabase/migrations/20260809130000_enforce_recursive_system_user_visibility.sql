BEGIN;

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
      AND actor_row.role IN (
        'Super Admin',
        'Admin',
        'Şube Müdürü',
        'Danışman',
        'Temsilci',
        'Öğrenci Temsilci',
        'Öğrenci'
      )
      AND (
        actor_row.role IN ('Super Admin', 'Admin')
        OR (
          actor_row.branch_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.branches AS actor_branch
            WHERE actor_branch.id = actor_row.branch_id
              AND actor_branch.status = 'active'
          )
        )
      )
  ), ancestry AS (
    SELECT
      target.id,
      target.role,
      target.branch_id,
      target.parent_user_id,
      ARRAY[target.id]::uuid[] AS path
    FROM public.system_users AS target
    WHERE target.id = target_user_id
      AND target.branch_id IS NOT DISTINCT FROM target_branch_id

    UNION ALL

    SELECT
      parent.id,
      parent.role,
      parent.branch_id,
      parent.parent_user_id,
      ancestry.path || parent.id
    FROM ancestry
    JOIN public.system_users AS parent
      ON parent.id = ancestry.parent_user_id
    WHERE parent.id <> ALL (ancestry.path)
      AND public.system_user_parent_is_valid(
        ancestry.role,
        ancestry.branch_id,
        parent.role,
        parent.branch_id,
        'active'::text
      )
  )
  SELECT EXISTS (
    SELECT 1
    FROM actor
    JOIN ancestry ON ancestry.id = actor.id
    WHERE actor.role IN ('Super Admin', 'Admin')
       OR target_branch_id = actor.branch_id
  );
$$;

ALTER FUNCTION public.core_actor_can_read_system_user(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.core_actor_can_read_system_user(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.core_actor_can_read_system_user(uuid, uuid)
  TO authenticated;

COMMIT;

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
  SELECT EXISTS (
    SELECT 1
    FROM public.system_users AS actor
    WHERE actor.id = auth.uid()
      AND actor.status = 'active'
      AND actor.role IN (
        'Super Admin',
        'Admin',
        'Şube Müdürü',
        'Danışman',
        'Temsilci',
        'Öğrenci Temsilci',
        'Öğrenci'
      )
      AND (
        actor.role IN ('Super Admin', 'Admin')
        OR (
          actor.branch_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.branches AS actor_branch
            WHERE actor_branch.id = actor.branch_id
              AND actor_branch.status = 'active'
          )
        )
      )
      AND (
        actor.id = target_user_id
        OR EXISTS (
          SELECT 1
          FROM public.system_users AS target
          WHERE target.id = target_user_id
            AND target.parent_user_id = actor.id
        )
      )
  );
$$;

ALTER FUNCTION public.core_actor_can_read_system_user(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.core_actor_can_read_system_user(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.core_actor_can_read_system_user(uuid, uuid)
  TO authenticated;

COMMIT;

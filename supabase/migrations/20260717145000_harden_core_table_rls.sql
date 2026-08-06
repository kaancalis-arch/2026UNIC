-- This migration must run after 20260717120000, which adds
-- student_profiles.branch_id, and before the AI Advisor migrations.
-- It intentionally gives browser clients read-only access to these tables.

BEGIN;

SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF to_regclass('public.branches') IS NULL
     OR to_regclass('public.student_profiles') IS NULL
     OR to_regclass('public.system_users') IS NULL THEN
    RAISE EXCEPTION 'CORE_RLS_REQUIRED_TABLE_MISSING';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'student_profiles'
      AND column_name = 'branch_id'
  ) THEN
    RAISE EXCEPTION
      'CORE_RLS_MIGRATION_ORDER_INVALID: apply 20260717120000 before this migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'postgres'
      AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'CORE_RLS_TRUSTED_OWNER_MISSING';
  END IF;
END;
$$;

LOCK TABLE public.branches,
  public.student_profiles,
  public.system_users
IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  -- The core-table lock prevents a concurrent profile mutation between this
  -- check and policy installation. Lock the matching Auth row as well.
  PERFORM 1
  FROM public.system_users AS profile
  JOIN auth.users AS auth_user ON auth_user.id = profile.id
  WHERE profile.role = 'Super Admin'
    AND profile.status = 'active'
  FOR KEY SHARE OF auth_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CORE_RLS_ACTIVE_SUPER_ADMIN_AUTH_LINK_MISSING';
  END IF;
END;
$$;

-- Permissive policies are ORed. Report and replace every existing policy,
-- including policies not represented in this repository, rather than silently
-- retaining one that can bypass the canonical rules below.
DO $$
DECLARE
  existing_policy record;
  using_expression text;
  check_expression text;
  policy_assessment text;
BEGIN
  FOR existing_policy IN
    SELECT
      namespace.nspname AS schema_name,
      relation.relname AS table_name,
      policy.polname AS policy_name,
      policy.polpermissive,
      policy.polcmd,
      ARRAY(
        SELECT CASE
          WHEN role_oid = 0 THEN 'PUBLIC'
          ELSE pg_catalog.pg_get_userbyid(role_oid)
        END
        FROM pg_catalog.unnest(policy.polroles) AS policy_role(role_oid)
      ) AS policy_roles,
      policy.polqual,
      policy.polwithcheck,
      relation.oid AS relation_oid
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS relation ON relation.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN ('branches', 'student_profiles', 'system_users')
    ORDER BY relation.relname, policy.polname
  LOOP
    using_expression := pg_catalog.pg_get_expr(
      existing_policy.polqual,
      existing_policy.relation_oid
    );
    check_expression := pg_catalog.pg_get_expr(
      existing_policy.polwithcheck,
      existing_policy.relation_oid
    );

    policy_assessment := CASE
      WHEN existing_policy.polpermissive
       AND existing_policy.polcmd IN ('*', 'r', 'w', 'd')
       AND (
         using_expression IS NULL
         OR pg_catalog.regexp_replace(
           pg_catalog.lower(using_expression),
           '[()[:space:]]',
           '',
           'g'
         ) IN ('true', 'true::boolean')
       ) THEN 'BROAD_USING'
      WHEN existing_policy.polpermissive
       AND existing_policy.polcmd IN ('*', 'a', 'w')
       AND (
         check_expression IS NULL
         OR pg_catalog.regexp_replace(
           pg_catalog.lower(check_expression),
           '[()[:space:]]',
           '',
           'g'
         ) IN ('true', 'true::boolean')
       ) THEN 'BROAD_WITH_CHECK'
      ELSE 'NON_CANONICAL_REVIEW'
    END;

    RAISE WARNING
      'CORE_RLS_REPLACING_POLICY assessment=% table=%.% name=% roles=% command=% permissive=% using=% with_check=%',
      policy_assessment,
      existing_policy.schema_name,
      existing_policy.table_name,
      existing_policy.policy_name,
      existing_policy.policy_roles,
      existing_policy.polcmd,
      existing_policy.polpermissive,
      COALESCE(using_expression, '<null>'),
      COALESCE(check_expression, '<null>');

    EXECUTE pg_catalog.format(
      'DROP POLICY %I ON %I.%I',
      existing_policy.policy_name,
      existing_policy.schema_name,
      existing_policy.table_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

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
              actor.role IN (
                'Şube Müdürü',
                'Danışman',
                'Temsilci',
                'Öğrenci Temsilci',
                'Öğrenci Temsilcisi'
              )
              AND actor.branch_id = target_branch_id
            )
          )
        )
      )
  );
$$;

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
      AND (
        actor.role IN ('Super Admin', 'Admin')
        OR (
          actor.role IN (
            'Şube Müdürü',
            'Danışman',
            'Temsilci',
            'Öğrenci Temsilci',
            'Öğrenci Temsilcisi'
          )
          AND actor.branch_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.branches AS actor_branch
            WHERE actor_branch.id = actor.branch_id
              AND actor_branch.status = 'active'
          )
          AND (
            actor.id = target_user_id
            OR (
              actor.role = 'Şube Müdürü'
              AND actor.branch_id = target_branch_id
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.core_actor_can_read_student(
  target_branch_id uuid,
  target_counselor_id uuid
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
        -- Global operators retain orphan-row visibility for remediation.
        actor.role IN ('Super Admin', 'Admin')
        OR (
          actor.role = 'Şube Müdürü'
          AND actor.branch_id = target_branch_id
          AND EXISTS (
            SELECT 1
            FROM public.branches AS actor_branch
            WHERE actor_branch.id = actor.branch_id
              AND actor_branch.status = 'active'
          )
        )
        OR (
          actor.role IN (
            'Danışman',
            'Temsilci',
            'Öğrenci Temsilci',
            'Öğrenci Temsilcisi'
          )
          AND actor.id = target_counselor_id
          AND actor.branch_id = target_branch_id
          AND EXISTS (
            SELECT 1
            FROM public.branches AS actor_branch
            WHERE actor_branch.id = actor.branch_id
              AND actor_branch.status = 'active'
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.core_actor_is_active_global_admin()
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
      AND actor.role IN ('Super Admin', 'Admin')
  );
$$;

ALTER FUNCTION public.core_actor_can_read_branch(uuid, text) OWNER TO postgres;
ALTER FUNCTION public.core_actor_can_read_system_user(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.core_actor_can_read_student(uuid, uuid) OWNER TO postgres;
ALTER FUNCTION public.core_actor_is_active_global_admin() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.core_actor_can_read_branch(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.core_actor_can_read_system_user(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.core_actor_can_read_student(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.core_actor_is_active_global_admin()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.core_actor_can_read_branch(uuid, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.core_actor_can_read_system_user(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.core_actor_can_read_student(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.core_actor_is_active_global_admin()
  TO authenticated;

CREATE POLICY branches_select_scoped
ON public.branches
FOR SELECT
TO authenticated
USING (public.core_actor_can_read_branch(id, status));

CREATE POLICY branches_insert_global_admin
ON public.branches
FOR INSERT
TO authenticated
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY branches_update_global_admin
ON public.branches
FOR UPDATE
TO authenticated
USING (public.core_actor_is_active_global_admin())
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY system_users_select_scoped
ON public.system_users
FOR SELECT
TO authenticated
USING (public.core_actor_can_read_system_user(id, branch_id));

CREATE POLICY student_profiles_select_scoped
ON public.student_profiles
FOR SELECT
TO authenticated
USING (public.core_actor_can_read_student(branch_id, counselor_id));

CREATE POLICY student_profiles_insert_global_admin
ON public.student_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY student_profiles_update_global_admin
ON public.student_profiles
FOR UPDATE
TO authenticated
USING (public.core_actor_is_active_global_admin())
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY student_profiles_delete_global_admin
ON public.student_profiles
FOR DELETE
TO authenticated
USING (public.core_actor_is_active_global_admin());

-- RLS does not replace SQL grants. Start from no browser privileges so that
-- PUBLIC/anon cannot retain TRUNCATE, REFERENCES, TRIGGER, or any write grant.
REVOKE ALL ON TABLE public.branches FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.student_profiles FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.system_users FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON TABLE public.branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_profiles TO authenticated;
GRANT SELECT ON TABLE public.system_users TO authenticated;

-- Edge Functions use the service-role client for controlled mutations.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.system_users TO service_role;

COMMIT;

BEGIN;

SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF to_regclass('public.school_names') IS NULL
     OR to_regclass('public.turkey_universities') IS NULL
     OR to_regclass('public.turkey_high_schools') IS NULL
     OR to_regclass('public.system_users') IS NULL THEN
    RAISE EXCEPTION 'SCHOOL_CATALOG_RLS_REQUIRED_TABLE_MISSING';
  END IF;

  IF to_regprocedure('public.core_actor_is_active_global_admin()') IS NULL THEN
    RAISE EXCEPTION
      'SCHOOL_CATALOG_RLS_MIGRATION_ORDER_INVALID: apply 20260717145000 before this migration';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'postgres'
      AND (rolsuper OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'SCHOOL_CATALOG_RLS_TRUSTED_OWNER_MISSING';
  END IF;
END;
$$;

LOCK TABLE public.school_names,
  public.turkey_universities,
  public.turkey_high_schools
IN ACCESS EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION public.set_school_names_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.set_school_names_updated_at() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_school_names_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS set_school_names_updated_at ON public.school_names;
CREATE TRIGGER set_school_names_updated_at
BEFORE UPDATE ON public.school_names
FOR EACH ROW
EXECUTE FUNCTION public.set_school_names_updated_at();

-- Permissive policies are ORed, so replace every live policy rather than only
-- the broad policies known to the repository.
DO $$
DECLARE
  existing_policy record;
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
      pg_catalog.pg_get_expr(policy.polqual, relation.oid) AS using_expression,
      pg_catalog.pg_get_expr(policy.polwithcheck, relation.oid) AS check_expression
    FROM pg_catalog.pg_policy AS policy
    JOIN pg_catalog.pg_class AS relation ON relation.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname IN (
        'school_names',
        'turkey_universities',
        'turkey_high_schools'
      )
    ORDER BY relation.relname, policy.polname
  LOOP
    RAISE WARNING
      'SCHOOL_CATALOG_RLS_REPLACING_POLICY table=%.% name=% roles=% command=% permissive=% using=% with_check=%',
      existing_policy.schema_name,
      existing_policy.table_name,
      existing_policy.policy_name,
      existing_policy.policy_roles,
      existing_policy.polcmd,
      existing_policy.polpermissive,
      COALESCE(existing_policy.using_expression, '<null>'),
      COALESCE(existing_policy.check_expression, '<null>');

    EXECUTE pg_catalog.format(
      'DROP POLICY %I ON %I.%I',
      existing_policy.policy_name,
      existing_policy.schema_name,
      existing_policy.table_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.school_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turkey_universities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turkey_high_schools ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.school_catalog_actor_can_read()
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
        )
      )
  );
$$;

ALTER FUNCTION public.school_catalog_actor_can_read() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.school_catalog_actor_can_read()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.school_catalog_actor_can_read()
  TO authenticated;

CREATE POLICY school_names_select_active_staff
ON public.school_names
FOR SELECT
TO authenticated
USING (public.school_catalog_actor_can_read());

CREATE POLICY school_names_insert_global_admin
ON public.school_names
FOR INSERT
TO authenticated
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY school_names_update_global_admin
ON public.school_names
FOR UPDATE
TO authenticated
USING (public.core_actor_is_active_global_admin())
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY school_names_delete_global_admin
ON public.school_names
FOR DELETE
TO authenticated
USING (public.core_actor_is_active_global_admin());

CREATE POLICY turkey_universities_select_active_staff
ON public.turkey_universities
FOR SELECT
TO authenticated
USING (public.school_catalog_actor_can_read());

CREATE POLICY turkey_universities_insert_global_admin
ON public.turkey_universities
FOR INSERT
TO authenticated
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY turkey_universities_update_global_admin
ON public.turkey_universities
FOR UPDATE
TO authenticated
USING (public.core_actor_is_active_global_admin())
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY turkey_universities_delete_global_admin
ON public.turkey_universities
FOR DELETE
TO authenticated
USING (public.core_actor_is_active_global_admin());

CREATE POLICY turkey_high_schools_select_active_staff
ON public.turkey_high_schools
FOR SELECT
TO authenticated
USING (public.school_catalog_actor_can_read());

CREATE POLICY turkey_high_schools_insert_global_admin
ON public.turkey_high_schools
FOR INSERT
TO authenticated
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY turkey_high_schools_update_global_admin
ON public.turkey_high_schools
FOR UPDATE
TO authenticated
USING (public.core_actor_is_active_global_admin())
WITH CHECK (public.core_actor_is_active_global_admin());

CREATE POLICY turkey_high_schools_delete_global_admin
ON public.turkey_high_schools
FOR DELETE
TO authenticated
USING (public.core_actor_is_active_global_admin());

-- Reset table privileges first so browser roles cannot retain TRUNCATE,
-- REFERENCES, TRIGGER, or privileges inherited from earlier migrations.
REVOKE ALL ON TABLE public.school_names
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.turkey_universities
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.turkey_high_schools
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.school_names
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.turkey_universities
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.turkey_high_schools
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.school_names
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.turkey_universities
  TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.turkey_high_schools
  TO service_role;

COMMIT;

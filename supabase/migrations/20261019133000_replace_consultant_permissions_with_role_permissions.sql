BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'consultant_page_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.consultant_page_permissions;
  END IF;
END;
$$;

DROP TABLE IF EXISTS public.consultant_page_permissions;
DROP FUNCTION IF EXISTS public.can_manage_consultant_permissions(uuid);
DROP FUNCTION IF EXISTS public.set_consultant_page_permission_audit();

CREATE TABLE public.role_page_permissions (
  role text NOT NULL CHECK (role IN (
    'Super Admin', 'Admin', 'Şube Müdürü', 'Danışman',
    'Temsilci', 'Öğrenci Temsilci', 'Öğrenci'
  )),
  page_id text NOT NULL CHECK (page_id IN (
    'dashboard', 'students', 'universities', 'calendar', 'roadmap',
    'visa-results', 'visa-checklist', 'visa-control',
    'student-assignments', 'university-research', 'user-management',
    'my-profile', 'my-roadmap', 'files'
  )),
  can_view boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.system_users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, page_id)
);

CREATE OR REPLACE FUNCTION public.can_manage_role_page_permissions(target_role text)
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
          actor.role = 'Admin'
          AND target_role NOT IN ('Super Admin', 'Admin')
        )
      )
  );
$$;

ALTER FUNCTION public.can_manage_role_page_permissions(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_manage_role_page_permissions(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_role_page_permissions(text) TO authenticated, service_role;

ALTER TABLE public.role_page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_page_permissions_select
ON public.role_page_permissions
FOR SELECT
TO authenticated
USING (
  role = (
    SELECT actor.role
    FROM public.system_users AS actor
    WHERE actor.id = (SELECT auth.uid()) AND actor.status = 'active'
  )
  OR public.can_manage_role_page_permissions(role)
);

CREATE POLICY role_page_permissions_insert
ON public.role_page_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_role_page_permissions(role));

CREATE POLICY role_page_permissions_update
ON public.role_page_permissions
FOR UPDATE
TO authenticated
USING (public.can_manage_role_page_permissions(role))
WITH CHECK (public.can_manage_role_page_permissions(role));

CREATE POLICY role_page_permissions_delete
ON public.role_page_permissions
FOR DELETE
TO authenticated
USING (public.can_manage_role_page_permissions(role));

REVOKE ALL ON TABLE public.role_page_permissions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.role_page_permissions TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_role_page_permission_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_role_page_permission_audit_trigger
BEFORE INSERT OR UPDATE ON public.role_page_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_role_page_permission_audit();

ALTER PUBLICATION supabase_realtime ADD TABLE public.role_page_permissions;

COMMIT;

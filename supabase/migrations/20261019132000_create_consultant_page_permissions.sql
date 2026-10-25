BEGIN;

CREATE TABLE IF NOT EXISTS public.consultant_page_permissions (
  consultant_user_id uuid NOT NULL REFERENCES public.system_users(id) ON DELETE CASCADE,
  page_id text NOT NULL CHECK (page_id IN (
    'dashboard', 'students', 'universities', 'calendar', 'roadmap',
    'visa-results', 'visa-checklist', 'visa-control',
    'university-research', 'user-management'
  )),
  can_view boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES public.system_users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (consultant_user_id, page_id)
);

CREATE OR REPLACE FUNCTION public.can_manage_consultant_permissions(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.system_users AS actor
    JOIN public.system_users AS target ON target.id = target_user_id
    WHERE actor.id = auth.uid()
      AND actor.status = 'active'
      AND target.role = 'Danışman'
      AND (
        actor.role IN ('Super Admin', 'Admin')
        OR (
          actor.role = 'Şube Müdürü'
          AND actor.branch_id IS NOT NULL
          AND actor.branch_id = target.branch_id
          AND target.parent_user_id = actor.id
        )
      )
  );
$$;

ALTER FUNCTION public.can_manage_consultant_permissions(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_manage_consultant_permissions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_consultant_permissions(uuid) TO authenticated, service_role;

ALTER TABLE public.consultant_page_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consultant_page_permissions_select ON public.consultant_page_permissions;
CREATE POLICY consultant_page_permissions_select
ON public.consultant_page_permissions
FOR SELECT
TO authenticated
USING (
  consultant_user_id = (SELECT auth.uid())
  OR public.can_manage_consultant_permissions(consultant_user_id)
);

DROP POLICY IF EXISTS consultant_page_permissions_insert ON public.consultant_page_permissions;
CREATE POLICY consultant_page_permissions_insert
ON public.consultant_page_permissions
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_consultant_permissions(consultant_user_id));

DROP POLICY IF EXISTS consultant_page_permissions_update ON public.consultant_page_permissions;
CREATE POLICY consultant_page_permissions_update
ON public.consultant_page_permissions
FOR UPDATE
TO authenticated
USING (public.can_manage_consultant_permissions(consultant_user_id))
WITH CHECK (public.can_manage_consultant_permissions(consultant_user_id));

DROP POLICY IF EXISTS consultant_page_permissions_delete ON public.consultant_page_permissions;
CREATE POLICY consultant_page_permissions_delete
ON public.consultant_page_permissions
FOR DELETE
TO authenticated
USING (public.can_manage_consultant_permissions(consultant_user_id));

REVOKE ALL ON TABLE public.consultant_page_permissions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.consultant_page_permissions TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_consultant_page_permission_audit()
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

DROP TRIGGER IF EXISTS set_consultant_page_permission_audit_trigger
ON public.consultant_page_permissions;
CREATE TRIGGER set_consultant_page_permission_audit_trigger
BEFORE INSERT OR UPDATE ON public.consultant_page_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_consultant_page_permission_audit();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'consultant_page_permissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.consultant_page_permissions;
  END IF;
END;
$$;

COMMIT;

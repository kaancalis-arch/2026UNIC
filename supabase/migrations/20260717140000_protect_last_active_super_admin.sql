-- The singleton counter makes removal and addition of active Super Admins atomic.
-- It does not modify existing system_users rows.
CREATE TABLE IF NOT EXISTS public.system_user_security_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  active_super_admin_count integer NOT NULL CHECK (active_super_admin_count >= 0)
);

INSERT INTO public.system_user_security_state (singleton, active_super_admin_count)
VALUES (
  true,
  (
    SELECT count(*)::integer
    FROM public.system_users
    WHERE role = 'Super Admin' AND status = 'active'
  )
)
ON CONFLICT (singleton) DO UPDATE
SET active_super_admin_count = EXCLUDED.active_super_admin_count;

CREATE OR REPLACE FUNCTION public.protect_last_active_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  was_active_super_admin boolean := false;
  becomes_active_super_admin boolean := false;
  changed_count integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    was_active_super_admin := OLD.role = 'Super Admin' AND OLD.status = 'active';
  END IF;

  IF TG_OP <> 'DELETE' THEN
    becomes_active_super_admin := NEW.role = 'Super Admin' AND NEW.status = 'active';
  END IF;

  IF was_active_super_admin AND NOT becomes_active_super_admin THEN
    UPDATE public.system_user_security_state
    SET active_super_admin_count = active_super_admin_count - 1
    WHERE singleton = true
      AND active_super_admin_count > 1;

    GET DIAGNOSTICS changed_count = ROW_COUNT;
    IF changed_count <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'SUPER_ADMIN_PROTECTED';
    END IF;
  ELSIF NOT was_active_super_admin AND becomes_active_super_admin THEN
    UPDATE public.system_user_security_state
    SET active_super_admin_count = active_super_admin_count + 1
    WHERE singleton = true;

    GET DIAGNOSTICS changed_count = ROW_COUNT;
    IF changed_count <> 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'SUPER_ADMIN_SECURITY_STATE_MISSING';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_last_active_super_admin() FROM PUBLIC;
REVOKE ALL ON TABLE public.system_user_security_state FROM PUBLIC;
REVOKE ALL ON TABLE public.system_user_security_state FROM anon, authenticated;

DROP TRIGGER IF EXISTS protect_last_active_super_admin_trigger
  ON public.system_users;

CREATE TRIGGER protect_last_active_super_admin_trigger
BEFORE INSERT OR DELETE OR UPDATE OF role, status
ON public.system_users
FOR EACH ROW
EXECUTE FUNCTION public.protect_last_active_super_admin();

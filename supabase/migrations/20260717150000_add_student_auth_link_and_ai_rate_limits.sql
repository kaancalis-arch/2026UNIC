ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS student_user_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.student_profiles'::regclass
      AND conname = 'student_profiles_student_user_id_fkey'
  ) THEN
    ALTER TABLE public.student_profiles
      ADD CONSTRAINT student_profiles_student_user_id_fkey
      FOREIGN KEY (student_user_id) REFERENCES public.system_users(id)
      ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_student_user_id_unique_idx
  ON public.student_profiles (student_user_id)
  WHERE student_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_student_auth_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  linked_user public.system_users%ROWTYPE;
BEGIN
  IF NEW.student_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO linked_user
  FROM public.system_users
  WHERE id = NEW.student_user_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bağlanacak öğrenci kullanıcısı bulunamadı.';
  END IF;
  IF linked_user.role IS DISTINCT FROM 'Öğrenci' THEN
    RAISE EXCEPTION 'Yalnız Öğrenci rolündeki kullanıcı bağlanabilir.';
  END IF;
  IF linked_user.status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Bağlanacak öğrenci kullanıcısı aktif olmalıdır.';
  END IF;
  IF NEW.branch_id IS NULL OR linked_user.branch_id IS NULL
     OR NEW.branch_id IS DISTINCT FROM linked_user.branch_id THEN
    RAISE EXCEPTION 'Öğrenci profili ve kullanıcı aynı aktif şubede olmalıdır.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_student_auth_link_trigger ON public.student_profiles;
CREATE TRIGGER validate_student_auth_link_trigger
BEFORE INSERT OR UPDATE OF student_user_id, branch_id
ON public.student_profiles
FOR EACH ROW
EXECUTE FUNCTION public.validate_student_auth_link();

CREATE TABLE IF NOT EXISTS public.ai_request_logs (
  request_id uuid PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  operation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  success boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ai_request_logs_actor_created_idx
  ON public.ai_request_logs (actor_user_id, created_at DESC);

ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_request_logs FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.begin_ai_request(
  p_actor_user_id uuid,
  p_operation text,
  p_request_id uuid
)
RETURNS TABLE (allowed boolean, reason text, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  minute_count integer;
  day_count integer;
  oldest_in_window timestamptz;
BEGIN
  IF p_actor_user_id IS NULL OR p_request_id IS NULL OR p_operation NOT IN (
    'analyze_student', 'generate_roadmap', 'ask_unic'
  ) THEN
    RETURN QUERY SELECT false, 'invalid_request'::text, 0;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_user_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_id::text, 1));

  IF EXISTS (SELECT 1 FROM public.ai_request_logs WHERE request_id = p_request_id) THEN
    RETURN QUERY SELECT false, 'duplicate_request'::text, 0;
    RETURN;
  END IF;

  SELECT count(*)::integer, min(created_at)
  INTO minute_count, oldest_in_window
  FROM public.ai_request_logs
  WHERE actor_user_id = p_actor_user_id
    AND created_at > clock_timestamp() - interval '60 seconds';

  IF minute_count >= 10 THEN
    RETURN QUERY SELECT false, 'minute_limit'::text,
      GREATEST(1, ceil(extract(epoch FROM (oldest_in_window + interval '60 seconds' - clock_timestamp())))::integer);
    RETURN;
  END IF;

  SELECT count(*)::integer, min(created_at)
  INTO day_count, oldest_in_window
  FROM public.ai_request_logs
  WHERE actor_user_id = p_actor_user_id
    AND created_at > clock_timestamp() - interval '24 hours';

  IF day_count >= 100 THEN
    RETURN QUERY SELECT false, 'daily_limit'::text,
      GREATEST(1, ceil(extract(epoch FROM (oldest_in_window + interval '24 hours' - clock_timestamp())))::integer);
    RETURN;
  END IF;

  INSERT INTO public.ai_request_logs (request_id, actor_user_id, operation)
  VALUES (p_request_id, p_actor_user_id, p_operation);

  RETURN QUERY SELECT true, 'allowed'::text, 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_ai_request(p_request_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.ai_request_logs
  SET success = true
  WHERE request_id = p_request_id;
$$;

REVOKE ALL ON FUNCTION public.begin_ai_request(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_ai_request(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_ai_request(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_ai_request(uuid) TO service_role;

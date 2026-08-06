BEGIN;

DO $$
BEGIN
  IF to_regclass('public.ai_advisor_rules') IS NOT NULL
     OR to_regclass('public.ai_advisor_reports') IS NOT NULL
     OR to_regclass('public.ai_advisor_report_share_links') IS NOT NULL
     OR to_regclass('public.ai_advisor_audit_log') IS NOT NULL THEN
    RAISE EXCEPTION 'An AI Advisor relation already exists. Inspect and reconcile the live schema before applying this migration.';
  END IF;
END;
$$;

CREATE TABLE public.ai_advisor_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  title text NOT NULL,
  instruction text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES public.system_users(id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.system_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_advisor_rules_type_check CHECK (
    report_type IN ('pre_meeting_brief', 'language_assessment', 'post_meeting_report')
  ),
  CONSTRAINT ai_advisor_rules_title_check CHECK (char_length(btrim(title)) BETWEEN 3 AND 120),
  CONSTRAINT ai_advisor_rules_instruction_check CHECK (char_length(btrim(instruction)) BETWEEN 10 AND 2000),
  CONSTRAINT ai_advisor_rules_priority_check CHECK (priority BETWEEN 1 AND 1000),
  CONSTRAINT ai_advisor_rules_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT ai_advisor_rules_version_check CHECK (version > 0)
);

CREATE INDEX ai_advisor_rules_active_idx
  ON public.ai_advisor_rules (report_type, priority, created_at)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.validate_ai_advisor_rule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'AI Advisor rule identity and creator are immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_ai_advisor_rule_trigger
BEFORE UPDATE ON public.ai_advisor_rules
FOR EACH ROW EXECUTE FUNCTION public.validate_ai_advisor_rule();

CREATE TABLE public.ai_advisor_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  report_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  deterministic_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_content jsonb NOT NULL,
  counselor_content jsonb NOT NULL,
  rules_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_version text NOT NULL,
  generated_by uuid NOT NULL REFERENCES public.system_users(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.system_users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_advisor_reports_type_check CHECK (
    report_type IN ('pre_meeting_brief', 'language_assessment', 'post_meeting_report')
  ),
  CONSTRAINT ai_advisor_reports_status_check CHECK (status IN ('draft', 'approved', 'archived')),
  CONSTRAINT ai_advisor_reports_json_check CHECK (
    jsonb_typeof(deterministic_result) = 'object'
    AND jsonb_typeof(generated_content) = 'object'
    AND jsonb_typeof(counselor_content) = 'object'
    AND jsonb_typeof(rules_snapshot) = 'array'
  ),
  CONSTRAINT ai_advisor_reports_provider_check CHECK (provider = 'openai'),
  CONSTRAINT ai_advisor_reports_approval_state_check CHECK (
    (status = 'draft' AND approved_by IS NULL AND approved_at IS NULL)
    OR (status IN ('approved', 'archived') AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX ai_advisor_reports_student_idx
  ON public.ai_advisor_reports (student_id, created_at DESC);
CREATE INDEX ai_advisor_reports_branch_idx
  ON public.ai_advisor_reports (branch_id, created_at DESC);
CREATE INDEX ai_advisor_reports_author_idx
  ON public.ai_advisor_reports (generated_by, created_at DESC);

CREATE TABLE public.ai_advisor_report_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.ai_advisor_reports(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.system_users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  max_views integer,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.system_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_advisor_share_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ai_advisor_share_expiration_check CHECK (expires_at > created_at),
  CONSTRAINT ai_advisor_share_max_views_check CHECK (max_views IS NULL OR max_views BETWEEN 1 AND 10000),
  CONSTRAINT ai_advisor_share_view_count_check CHECK (view_count >= 0),
  CONSTRAINT ai_advisor_share_revoke_state_check CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL)
    OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);

CREATE INDEX ai_advisor_share_report_idx
  ON public.ai_advisor_report_share_links (report_id, created_at DESC);
CREATE INDEX ai_advisor_share_live_idx
  ON public.ai_advisor_report_share_links (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE public.ai_advisor_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id uuid REFERENCES public.ai_advisor_reports(id) ON DELETE SET NULL,
  share_link_id uuid REFERENCES public.ai_advisor_report_share_links(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.student_profiles(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES public.system_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_advisor_audit_event_check CHECK (event_type IN (
    'report_generated', 'draft_updated', 'report_approved', 'report_archived',
    'share_created', 'share_revoked', 'share_used',
    'rule_created', 'rule_updated'
  )),
  CONSTRAINT ai_advisor_audit_metadata_check CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX ai_advisor_audit_report_idx
  ON public.ai_advisor_audit_log (report_id, created_at DESC);
CREATE INDEX ai_advisor_audit_student_idx
  ON public.ai_advisor_audit_log (student_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_ai_advisor_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  target_branch_id uuid;
BEGIN
  SELECT student.branch_id
  INTO target_branch_id
  FROM public.student_profiles AS student
  WHERE student.id = NEW.student_id;

  IF NOT FOUND OR target_branch_id IS NULL OR target_branch_id IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'AI Advisor report branch must match the student branch';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.generated_content IS DISTINCT FROM OLD.generated_content
    OR NEW.deterministic_result IS DISTINCT FROM OLD.deterministic_result
    OR NEW.rules_snapshot IS DISTINCT FROM OLD.rules_snapshot
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.model IS DISTINCT FROM OLD.model
    OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version
    OR NEW.generated_by IS DISTINCT FROM OLD.generated_by
    OR NEW.student_id IS DISTINCT FROM OLD.student_id
    OR NEW.branch_id IS DISTINCT FROM OLD.branch_id
    OR NEW.report_type IS DISTINCT FROM OLD.report_type
  ) THEN
    RAISE EXCEPTION 'AI Advisor generated content and provenance are immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status <> 'draft'
     AND NEW.counselor_content IS DISTINCT FROM OLD.counselor_content THEN
    RAISE EXCEPTION 'Approved AI Advisor counselor content is immutable';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_ai_advisor_report_trigger
BEFORE INSERT OR UPDATE ON public.ai_advisor_reports
FOR EACH ROW EXECUTE FUNCTION public.validate_ai_advisor_report();

CREATE OR REPLACE FUNCTION public.consume_ai_advisor_report_share(
  p_token_hash text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  report_id uuid,
  report_type text,
  content jsonb,
  approved_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  share_record public.ai_advisor_report_share_links%ROWTYPE;
  report_record public.ai_advisor_reports%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  SELECT * INTO share_record
  FROM public.ai_advisor_report_share_links
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND
     OR share_record.revoked_at IS NOT NULL
     OR share_record.expires_at <= now()
     OR (share_record.max_views IS NOT NULL AND share_record.view_count >= share_record.max_views) THEN
    RETURN;
  END IF;

  SELECT * INTO report_record
  FROM public.ai_advisor_reports
  WHERE id = share_record.report_id
    AND status = 'approved'
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.ai_advisor_report_share_links
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE id = share_record.id;

  INSERT INTO public.ai_advisor_audit_log (
    report_id, share_link_id, student_id, event_type, ip_address, user_agent, metadata
  ) VALUES (
    report_record.id, share_record.id, report_record.student_id, 'share_used',
    p_ip_address, left(p_user_agent, 1000),
    jsonb_build_object('view_number', share_record.view_count + 1)
  );

  RETURN QUERY SELECT report_record.id, report_record.report_type,
    report_record.counselor_content, report_record.approved_at;
END;
$$;

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
    'pre_meeting_brief', 'language_assessment', 'post_meeting_report'
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

ALTER TABLE public.ai_advisor_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_advisor_rules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_advisor_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_advisor_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_advisor_report_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_advisor_report_share_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_advisor_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_advisor_audit_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_advisor_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_advisor_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_advisor_report_share_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_advisor_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.ai_advisor_audit_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_advisor_rules TO service_role;
GRANT ALL ON TABLE public.ai_advisor_reports TO service_role;
GRANT ALL ON TABLE public.ai_advisor_report_share_links TO service_role;
GRANT ALL ON TABLE public.ai_advisor_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.ai_advisor_audit_log_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.validate_ai_advisor_report() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_ai_advisor_rule() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_ai_advisor_report_share(text, inet, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_ai_request(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_advisor_report_share(text, inet, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_ai_request(uuid, text, uuid) TO service_role;

COMMIT;

BEGIN;

ALTER TABLE public.student_documents
  ADD COLUMN IF NOT EXISTS drive_sync_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS drive_file_id text,
  ADD COLUMN IF NOT EXISTS drive_file_name text,
  ADD COLUMN IF NOT EXISTS drive_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS drive_sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drive_sync_last_error text,
  ADD COLUMN IF NOT EXISTS drive_sync_next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS drive_sync_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS drive_sync_claim_token uuid,
  ADD COLUMN IF NOT EXISTS drive_delete_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS drive_delete_claim_token uuid;

ALTER TABLE public.student_documents
  DROP CONSTRAINT IF EXISTS student_documents_drive_sync_status_check,
  DROP CONSTRAINT IF EXISTS student_documents_drive_sync_attempts_check,
  DROP CONSTRAINT IF EXISTS student_documents_drive_synced_state_check,
  DROP CONSTRAINT IF EXISTS student_documents_drive_processing_state_check,
  DROP CONSTRAINT IF EXISTS student_documents_drive_deleting_state_check;

ALTER TABLE public.student_documents
  ADD CONSTRAINT student_documents_drive_sync_status_check
    CHECK (drive_sync_status IN ('pending', 'processing', 'synced', 'failed', 'deleting')),
  ADD CONSTRAINT student_documents_drive_sync_attempts_check
    CHECK (drive_sync_attempts >= 0),
  ADD CONSTRAINT student_documents_drive_synced_state_check CHECK (
    drive_sync_status <> 'synced'
    OR (
      drive_file_id IS NOT NULL AND btrim(drive_file_id) <> ''
      AND drive_file_name IS NOT NULL AND btrim(drive_file_name) <> ''
      AND drive_synced_at IS NOT NULL
    )
  ),
  ADD CONSTRAINT student_documents_drive_processing_state_check CHECK (
    (drive_sync_status = 'processing') =
      (drive_sync_started_at IS NOT NULL AND drive_sync_claim_token IS NOT NULL)
  ),
  ADD CONSTRAINT student_documents_drive_deleting_state_check CHECK (
    (
      drive_sync_status = 'deleting'
      AND (
        (drive_delete_started_at IS NULL AND drive_delete_claim_token IS NULL)
        OR (drive_delete_started_at IS NOT NULL AND drive_delete_claim_token IS NOT NULL)
      )
    )
    OR (
      drive_sync_status <> 'deleting'
      AND drive_delete_started_at IS NULL
      AND drive_delete_claim_token IS NULL
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS student_documents_drive_file_id_unique_idx
  ON public.student_documents (drive_file_id)
  WHERE drive_file_id IS NOT NULL AND btrim(drive_file_id) <> '';

CREATE INDEX IF NOT EXISTS student_documents_drive_retry_idx
  ON public.student_documents (drive_sync_status, drive_sync_next_retry_at, drive_sync_started_at)
  WHERE drive_sync_status IN ('pending', 'failed', 'processing');

ALTER TABLE public.student_document_audit_log
  DROP CONSTRAINT IF EXISTS student_document_audit_event_check;

ALTER TABLE public.student_document_audit_log
  ADD CONSTRAINT student_document_audit_event_check CHECK (event_type IN (
    'upload', 'internal_view_url_created', 'share_created', 'share_used',
    'share_revoked', 'archived', 'permanently_deleted',
    'drive_sync_started', 'drive_sync_succeeded', 'drive_sync_failed'
  ));

CREATE OR REPLACE FUNCTION public.claim_student_document_drive_sync(
  p_document_id uuid,
  p_claim_token uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  claimed public.student_documents%ROWTYPE;
  current_record public.student_documents%ROWTYPE;
  recovered_stale boolean := false;
BEGIN
  IF p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Drive sync claim token is required';
  END IF;

  SELECT * INTO current_record
  FROM public.student_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF current_record.status = 'archived' THEN RETURN 'archived'; END IF;
  IF current_record.drive_sync_status = 'deleting' THEN RETURN 'deleting'; END IF;
  IF current_record.drive_sync_status = 'synced' THEN RETURN 'synced'; END IF;
  IF current_record.drive_sync_status = 'failed'
     AND current_record.drive_sync_next_retry_at IS NOT NULL
     AND current_record.drive_sync_next_retry_at > now() THEN
    RETURN 'backoff';
  END IF;
  IF current_record.drive_sync_status = 'processing'
     AND current_record.drive_sync_started_at IS NOT NULL
     AND current_record.drive_sync_started_at > now() - interval '15 minutes' THEN
    RETURN 'active_processing';
  END IF;
  IF current_record.drive_sync_status NOT IN ('pending', 'failed', 'processing') THEN
    RETURN 'not_retryable';
  END IF;

  recovered_stale := current_record.drive_sync_status = 'processing';
  UPDATE public.student_documents
  SET drive_sync_status = 'processing',
      drive_sync_attempts = drive_sync_attempts + 1,
      drive_sync_last_error = NULL,
      drive_sync_next_retry_at = NULL,
      drive_sync_started_at = now(),
      drive_sync_claim_token = p_claim_token,
      drive_delete_started_at = NULL,
      drive_delete_claim_token = NULL,
      updated_at = now()
  WHERE id = p_document_id
    AND status <> 'archived'
  RETURNING * INTO claimed;

  IF NOT FOUND THEN RETURN 'not_retryable'; END IF;

  INSERT INTO public.student_document_audit_log (
    document_id, student_id, actor_user_id, event_type,
    ip_address, user_agent, metadata
  ) VALUES (
    claimed.id, claimed.student_id, p_actor_user_id, 'drive_sync_started',
    p_ip_address, left(p_user_agent, 1000),
    jsonb_build_object(
      'attempt', claimed.drive_sync_attempts,
      'recovered_stale_processing', recovered_stale
    )
  );

  RETURN 'claimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_student_document_drive_sync(
  p_document_id uuid,
  p_claim_token uuid,
  p_drive_file_id text,
  p_drive_file_name text,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  completed public.student_documents%ROWTYPE;
BEGIN
  IF p_drive_file_id IS NULL OR btrim(p_drive_file_id) = ''
     OR p_drive_file_name IS NULL OR btrim(p_drive_file_name) = '' THEN
    RAISE EXCEPTION 'Drive file identity is required';
  END IF;

  UPDATE public.student_documents
  SET drive_sync_status = 'synced',
      drive_file_id = p_drive_file_id,
      drive_file_name = p_drive_file_name,
      drive_synced_at = now(),
      drive_sync_last_error = NULL,
      drive_sync_next_retry_at = NULL,
      drive_sync_started_at = NULL,
      drive_sync_claim_token = NULL,
      updated_at = now()
  WHERE id = p_document_id
    AND drive_sync_status = 'processing'
    AND drive_sync_claim_token = p_claim_token
    AND status <> 'archived'
  RETURNING * INTO completed;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.student_document_audit_log (
    document_id, student_id, actor_user_id, event_type, metadata
  ) VALUES (
    completed.id, completed.student_id, p_actor_user_id, 'drive_sync_succeeded',
    jsonb_build_object('attempt', completed.drive_sync_attempts)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_student_document_drive_sync(
  p_document_id uuid,
  p_claim_token uuid,
  p_safe_error text,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  failed public.student_documents%ROWTYPE;
  safe_error text;
BEGIN
  safe_error := left(coalesce(nullif(btrim(p_safe_error), ''), 'Drive senkronizasyonu tamamlanamadı.'), 240);

  UPDATE public.student_documents
  SET drive_sync_status = 'failed',
      drive_sync_last_error = safe_error,
      drive_sync_next_retry_at = now() + make_interval(
        secs => least(86400, (power(2, least(drive_sync_attempts, 10)) * 60)::integer)
      ),
      drive_sync_started_at = NULL,
      drive_sync_claim_token = NULL,
      updated_at = now()
  WHERE id = p_document_id
    AND drive_sync_status = 'processing'
    AND drive_sync_claim_token = p_claim_token
    AND status <> 'archived'
  RETURNING * INTO failed;

  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.student_document_audit_log (
    document_id, student_id, actor_user_id, event_type, metadata
  ) VALUES (
    failed.id, failed.student_id, p_actor_user_id, 'drive_sync_failed',
    jsonb_build_object('attempt', failed.drive_sync_attempts, 'retry_scheduled', true)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_student_document(
  p_document_id uuid,
  p_actor_user_id uuid,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  target_student_id uuid;
  revoked_share record;
BEGIN
  UPDATE public.student_documents
  SET status = 'archived', archived_at = now(), archived_by = p_actor_user_id
  WHERE id = p_document_id
    AND status <> 'archived'
    AND drive_sync_status NOT IN ('processing', 'deleting')
  RETURNING student_id INTO target_student_id;
  IF NOT FOUND THEN RETURN false; END IF;

  FOR revoked_share IN
    UPDATE public.student_document_share_links
    SET revoked_at = now(), revoked_by = p_actor_user_id
    WHERE document_id = p_document_id
      AND revoked_at IS NULL
    RETURNING id
  LOOP
    INSERT INTO public.student_document_audit_log (
      document_id, share_link_id, student_id, actor_user_id, event_type,
      ip_address, user_agent, metadata
    ) VALUES (
      p_document_id, revoked_share.id, target_student_id, p_actor_user_id,
      'share_revoked', p_ip_address, left(p_user_agent, 1000),
      jsonb_build_object('reason', 'document_archived')
    );
  END LOOP;

  INSERT INTO public.student_document_audit_log (
    document_id, student_id, actor_user_id, event_type,
    ip_address, user_agent, metadata
  ) VALUES (
    p_document_id, target_student_id, p_actor_user_id, 'archived',
    p_ip_address, left(p_user_agent, 1000), '{}'::jsonb
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_student_document_drive_delete(
  p_document_id uuid,
  p_claim_token uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_record public.student_documents%ROWTYPE;
BEGIN
  IF p_claim_token IS NULL THEN
    RAISE EXCEPTION 'Drive delete claim token is required';
  END IF;

  SELECT * INTO current_record
  FROM public.student_documents
  WHERE id = p_document_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF current_record.drive_sync_status = 'processing' THEN
    RETURN 'active_processing';
  END IF;
  IF current_record.drive_sync_status = 'deleting'
     AND current_record.drive_delete_started_at IS NOT NULL
     AND current_record.drive_delete_started_at > now() - interval '15 minutes' THEN
    RETURN 'active_deleting';
  END IF;

  UPDATE public.student_documents
  SET drive_sync_status = 'deleting',
      drive_sync_started_at = NULL,
      drive_sync_claim_token = NULL,
      drive_delete_started_at = now(),
      drive_delete_claim_token = p_claim_token,
      updated_at = now()
  WHERE id = p_document_id
  RETURNING * INTO current_record;

  RETURN 'claimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.release_student_document_drive_delete(
  p_document_id uuid,
  p_claim_token uuid,
  p_safe_error text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE public.student_documents
  SET drive_sync_last_error = left(
        coalesce(nullif(btrim(p_safe_error), ''), 'Kalıcı silme tamamlanamadı.'),
        240
      ),
      drive_delete_started_at = NULL,
      drive_delete_claim_token = NULL,
      updated_at = now()
  WHERE id = p_document_id
    AND drive_sync_status = 'deleting'
    AND drive_delete_claim_token = p_claim_token;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_student_document_permanent_delete(
  p_document_id uuid,
  p_claim_token uuid,
  p_actor_user_id uuid,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  deleted public.student_documents%ROWTYPE;
BEGIN
  DELETE FROM public.student_documents
  WHERE id = p_document_id
    AND drive_sync_status = 'deleting'
    AND drive_delete_claim_token = p_claim_token
  RETURNING * INTO deleted;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.student_document_audit_log (
    document_id, student_id, actor_user_id, event_type,
    ip_address, user_agent, metadata
  ) VALUES (
    NULL, deleted.student_id, p_actor_user_id, 'permanently_deleted',
    p_ip_address, left(p_user_agent, 1000),
    jsonb_build_object(
      'document_id', deleted.id,
      'storage_path', deleted.storage_path,
      'checksum_sha256', deleted.checksum_sha256,
      'drive_file_id', deleted.drive_file_id
    )
  );
  RETURN true;
END;
$$;

ALTER FUNCTION public.claim_student_document_drive_sync(uuid, uuid, uuid, inet, text)
  OWNER TO postgres;
ALTER FUNCTION public.complete_student_document_drive_sync(uuid, uuid, text, text, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.fail_student_document_drive_sync(uuid, uuid, text, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.archive_student_document(uuid, uuid, inet, text)
  OWNER TO postgres;
ALTER FUNCTION public.claim_student_document_drive_delete(uuid, uuid)
  OWNER TO postgres;
ALTER FUNCTION public.release_student_document_drive_delete(uuid, uuid, text)
  OWNER TO postgres;
ALTER FUNCTION public.complete_student_document_permanent_delete(uuid, uuid, uuid, inet, text)
  OWNER TO postgres;

REVOKE ALL ON FUNCTION public.claim_student_document_drive_sync(uuid, uuid, uuid, inet, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_student_document_drive_sync(uuid, uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fail_student_document_drive_sync(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.archive_student_document(uuid, uuid, inet, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_student_document_drive_delete(uuid, uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_student_document_drive_delete(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_student_document_permanent_delete(uuid, uuid, uuid, inet, text)
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.claim_student_document_drive_sync(uuid, uuid, uuid, inet, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_student_document_drive_sync(uuid, uuid, text, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_student_document_drive_sync(uuid, uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_student_document(uuid, uuid, inet, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_student_document_drive_delete(uuid, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_student_document_drive_delete(uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_student_document_permanent_delete(uuid, uuid, uuid, inet, text)
  TO service_role;

COMMIT;

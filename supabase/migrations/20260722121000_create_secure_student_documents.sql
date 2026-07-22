BEGIN;

DO $$
BEGIN
  IF to_regclass('public.student_documents') IS NOT NULL
     OR to_regclass('public.student_document_share_links') IS NOT NULL
     OR to_regclass('public.student_document_audit_log') IS NOT NULL THEN
    RAISE EXCEPTION 'A student document relation already exists. This unapplied migration refuses to guess or overwrite its schema; inspect and reconcile it explicitly.';
  END IF;
END;
$$;

CREATE TABLE public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE RESTRICT,
  document_type_id uuid NOT NULL REFERENCES public.document_types(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  uploaded_by uuid NOT NULL REFERENCES public.system_users(id) ON DELETE RESTRICT,
  original_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  checksum_sha256 text NOT NULL,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'uploaded',
  archived_at timestamptz,
  archived_by uuid REFERENCES public.system_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_documents_original_name_not_blank CHECK (btrim(original_name) <> ''),
  CONSTRAINT student_documents_storage_path_format CHECK (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|png|jpg|webp)$'
  ),
  CONSTRAINT student_documents_mime_type_check CHECK (
    mime_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp')
  ),
  CONSTRAINT student_documents_file_size_check CHECK (size_bytes BETWEEN 1 AND 3145728),
  CONSTRAINT student_documents_sha256_check CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT student_documents_version_check CHECK (version > 0),
  CONSTRAINT student_documents_status_check CHECK (status IN ('uploaded', 'approved', 'rejected', 'archived')),
  CONSTRAINT student_documents_archive_state_check CHECK (
    (status <> 'archived' AND archived_at IS NULL AND archived_by IS NULL)
    OR (status = 'archived' AND archived_at IS NOT NULL AND archived_by IS NOT NULL)
  )
);

CREATE INDEX student_documents_student_status_idx
  ON public.student_documents (student_id, status, created_at DESC);
CREATE INDEX student_documents_type_idx ON public.student_documents (document_type_id);
CREATE INDEX student_documents_branch_idx ON public.student_documents (branch_id);
CREATE INDEX student_documents_uploaded_by_idx ON public.student_documents (uploaded_by);
CREATE UNIQUE INDEX student_documents_student_type_version_idx
  ON public.student_documents (student_id, document_type_id, version);

CREATE TABLE public.student_document_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.student_documents(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES public.system_users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL,
  max_views integer,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.system_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_document_share_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT student_document_share_expiration_check CHECK (expires_at > created_at),
  CONSTRAINT student_document_share_max_views_check CHECK (max_views IS NULL OR max_views BETWEEN 1 AND 10000),
  CONSTRAINT student_document_share_view_count_check CHECK (view_count >= 0),
  CONSTRAINT student_document_share_revoke_state_check CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);

CREATE INDEX student_document_share_document_idx
  ON public.student_document_share_links (document_id, created_at DESC);
CREATE INDEX student_document_share_live_idx
  ON public.student_document_share_links (expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE public.student_document_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id uuid REFERENCES public.student_documents(id) ON DELETE SET NULL,
  share_link_id uuid REFERENCES public.student_document_share_links(id) ON DELETE SET NULL,
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES public.system_users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_document_audit_event_check CHECK (event_type IN (
    'upload', 'internal_view_url_created', 'share_created', 'share_used',
    'share_revoked', 'archived', 'permanently_deleted'
  )),
  CONSTRAINT student_document_audit_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX student_document_audit_document_idx
  ON public.student_document_audit_log (document_id, created_at DESC);
CREATE INDEX student_document_audit_student_idx
  ON public.student_document_audit_log (student_id, created_at DESC);
CREATE INDEX student_document_audit_share_idx
  ON public.student_document_audit_log (share_link_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.register_student_document(
  p_id uuid,
  p_student_id uuid,
  p_branch_id uuid,
  p_document_type_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_checksum_sha256 text,
  p_uploaded_by uuid,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS SETOF public.student_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  allows_multiple boolean;
  next_version integer;
  archived_document record;
  inserted_document public.student_documents%ROWTYPE;
BEGIN
  SELECT definition.allow_multiple
  INTO allows_multiple
  FROM public.document_types AS definition
  WHERE definition.id = p_document_type_id
    AND definition.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document type is missing or inactive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_student_id::text || ':' || p_document_type_id::text, 0));
  SELECT coalesce(max(document.version), 0) + 1
  INTO next_version
  FROM public.student_documents AS document
  WHERE document.student_id = p_student_id
    AND document.document_type_id = p_document_type_id;

  IF NOT allows_multiple THEN
    FOR archived_document IN
      UPDATE public.student_documents
      SET status = 'archived', archived_at = now(), archived_by = p_uploaded_by
      WHERE student_id = p_student_id
        AND document_type_id = p_document_type_id
        AND status <> 'archived'
      RETURNING id
    LOOP
      WITH revoked AS (
        UPDATE public.student_document_share_links
        SET revoked_at = now(), revoked_by = p_uploaded_by
        WHERE document_id = archived_document.id
          AND revoked_at IS NULL
        RETURNING id
      )
      INSERT INTO public.student_document_audit_log (
        document_id, share_link_id, student_id, actor_user_id, event_type,
        ip_address, user_agent, metadata
      )
      SELECT archived_document.id, revoked.id, p_student_id, p_uploaded_by, 'share_revoked',
        p_ip_address, left(p_user_agent, 1000), jsonb_build_object('reason', 'new_version_uploaded')
      FROM revoked;

      INSERT INTO public.student_document_audit_log (
        document_id, student_id, actor_user_id, event_type, ip_address, user_agent, metadata
      ) VALUES (
        archived_document.id, p_student_id, p_uploaded_by, 'archived', p_ip_address,
        left(p_user_agent, 1000), jsonb_build_object('reason', 'new_version_uploaded')
      );
    END LOOP;
  END IF;

  INSERT INTO public.student_documents (
    id, student_id, branch_id, document_type_id, storage_path, original_name,
    mime_type, size_bytes, checksum_sha256, version, status, uploaded_by
  ) VALUES (
    p_id, p_student_id, p_branch_id, p_document_type_id, p_storage_path, p_original_name,
    p_mime_type, p_size_bytes, p_checksum_sha256, next_version, 'uploaded', p_uploaded_by
  ) RETURNING * INTO inserted_document;

  INSERT INTO public.student_document_audit_log (
    document_id, student_id, actor_user_id, event_type, ip_address, user_agent, metadata
  ) VALUES (
    inserted_document.id, p_student_id, p_uploaded_by, 'upload', p_ip_address,
    left(p_user_agent, 1000), jsonb_build_object(
      'mime_type', p_mime_type,
      'size_bytes', p_size_bytes,
      'checksum_sha256', p_checksum_sha256,
      'version', next_version
    )
  );

  RETURN NEXT inserted_document;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_student_document_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  target_branch_id uuid;
  type_is_active boolean;
  type_allows_multiple boolean;
BEGIN
  IF split_part(NEW.storage_path, '/', 1) !~ '^[0-9a-f-]{36}$'
     OR split_part(NEW.storage_path, '/', 2) !~ '^[0-9a-f-]{36}$'
     OR split_part(NEW.storage_path, '/', 3) !~ '^[0-9a-f-]{36}$'
     OR split_part(NEW.storage_path, '/', 1)::uuid IS DISTINCT FROM NEW.branch_id
     OR split_part(NEW.storage_path, '/', 2)::uuid IS DISTINCT FROM NEW.student_id
     OR split_part(NEW.storage_path, '/', 3)::uuid IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Student document storage path does not match branch, student and document ids';
  END IF;

  SELECT student.branch_id INTO target_branch_id
  FROM public.student_profiles AS student
  WHERE student.id = NEW.student_id;

  IF NOT FOUND OR target_branch_id IS NULL OR target_branch_id IS DISTINCT FROM NEW.branch_id THEN
    RAISE EXCEPTION 'Student document branch must match the student branch';
  END IF;

  SELECT definition.is_active, definition.allow_multiple
  INTO type_is_active, type_allows_multiple
  FROM public.document_types AS definition
  WHERE definition.id = NEW.document_type_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student document type must exist';
  END IF;

  IF TG_OP = 'INSERT' AND NOT type_is_active THEN
    RAISE EXCEPTION 'Student document type must be active for new assignments';
  ELSIF TG_OP = 'UPDATE'
        AND NEW.document_type_id IS DISTINCT FROM OLD.document_type_id
        AND NOT type_is_active THEN
    RAISE EXCEPTION 'Student document type must be active for new assignments';
  END IF;

  IF NEW.status <> 'archived' AND NOT type_allows_multiple THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.student_id::text || ':' || NEW.document_type_id::text, 0));
  END IF;

  IF NEW.status <> 'archived' AND NOT type_allows_multiple AND EXISTS (
    SELECT 1
    FROM public.student_documents AS existing
    WHERE existing.student_id = NEW.student_id
      AND existing.document_type_id = NEW.document_type_id
      AND existing.status <> 'archived'
      AND existing.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'This document type permits only one active document per student';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_student_document_write_trigger
BEFORE INSERT OR UPDATE ON public.student_documents
FOR EACH ROW EXECUTE FUNCTION public.validate_student_document_write();

CREATE OR REPLACE FUNCTION public.consume_student_document_share(
  p_token_hash text,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS TABLE (
  document_id uuid,
  original_name text,
  mime_type text,
  storage_path text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  share_record public.student_document_share_links%ROWTYPE;
  document_record public.student_documents%ROWTYPE;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  SELECT * INTO share_record
  FROM public.student_document_share_links
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND
     OR share_record.revoked_at IS NOT NULL
     OR share_record.expires_at <= now()
     OR (share_record.max_views IS NOT NULL AND share_record.view_count >= share_record.max_views) THEN
    RETURN;
  END IF;

  SELECT * INTO document_record
  FROM public.student_documents
  WHERE id = share_record.document_id
    AND status IN ('uploaded', 'approved')
  FOR SHARE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.student_document_share_links
  SET view_count = view_count + 1,
      last_viewed_at = now()
  WHERE id = share_record.id;

  INSERT INTO public.student_document_audit_log (
    document_id, share_link_id, student_id, event_type, ip_address, user_agent, metadata
  ) VALUES (
    document_record.id,
    share_record.id,
    document_record.student_id,
    'share_used',
    p_ip_address,
    left(p_user_agent, 1000),
    jsonb_build_object('view_number', share_record.view_count + 1)
  );

  RETURN QUERY SELECT document_record.id, document_record.original_name,
    document_record.mime_type, document_record.storage_path;
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
      p_document_id, revoked_share.id, target_student_id, p_actor_user_id, 'share_revoked',
      p_ip_address, left(p_user_agent, 1000), jsonb_build_object('reason', 'document_archived')
    );
  END LOOP;

  INSERT INTO public.student_document_audit_log (
    document_id, student_id, actor_user_id, event_type, ip_address, user_agent, metadata
  ) VALUES (
    p_document_id, target_student_id, p_actor_user_id, 'archived',
    p_ip_address, left(p_user_agent, 1000), '{}'::jsonb
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_student_document_share(
  p_share_link_id uuid,
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
  target_document_id uuid;
  target_student_id uuid;
BEGIN
  UPDATE public.student_document_share_links AS share
  SET revoked_at = now(), revoked_by = p_actor_user_id
  FROM public.student_documents AS document
  WHERE share.id = p_share_link_id
    AND share.document_id = document.id
    AND share.revoked_at IS NULL
  RETURNING document.id, document.student_id INTO target_document_id, target_student_id;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO public.student_document_audit_log (
    document_id, share_link_id, student_id, actor_user_id, event_type,
    ip_address, user_agent, metadata
  ) VALUES (
    target_document_id, p_share_link_id, target_student_id, p_actor_user_id, 'share_revoked',
    p_ip_address, left(p_user_agent, 1000), '{}'::jsonb
  );
  RETURN true;
END;
$$;

ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.student_document_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_document_share_links FORCE ROW LEVEL SECURITY;
ALTER TABLE public.student_document_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_document_audit_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_documents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.student_document_share_links FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.student_document_audit_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.student_document_audit_log_id_seq FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.student_documents TO service_role;
GRANT ALL ON TABLE public.student_document_share_links TO service_role;
GRANT ALL ON TABLE public.student_document_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.student_document_audit_log_id_seq TO service_role;
REVOKE ALL ON FUNCTION public.validate_student_document_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.register_student_document(uuid, uuid, uuid, uuid, text, text, text, bigint, text, uuid, inet, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_student_document_share(text, inet, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_student_document(uuid, uuid, inet, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_student_document_share(uuid, uuid, inet, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_student_document(uuid, uuid, uuid, uuid, text, text, text, bigint, text, uuid, inet, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_student_document_share(text, inet, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_student_document(uuid, uuid, inet, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_student_document_share(uuid, uuid, inet, text) TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-documents', 'student-documents', false, 3145728,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE
  policy_record record;
  expression text;
  qual_scoped boolean;
  check_scoped boolean;
  student_qual_scoped boolean;
  student_check_scoped boolean;
  is_exclusively_student_bucket boolean;
  is_clearly_other_bucket boolean;
BEGIN
  FOR policy_record IN
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
  LOOP
    expression := coalesce(policy_record.qual, '') || ' ' || coalesce(policy_record.with_check, '');

    student_qual_scoped := policy_record.qual IS NOT NULL
      AND (
        policy_record.qual ~* 'bucket_id\s*=\s*''student-documents'''
        OR policy_record.qual ~* '''student-documents''\s*(::[a-z ]+)?\s*=\s*bucket_id'
      )
      AND policy_record.qual !~* '\bOR\b'
      AND policy_record.qual !~* 'bucket_id\s+IN\s*\(';
    student_check_scoped := policy_record.with_check IS NOT NULL
      AND (
        policy_record.with_check ~* 'bucket_id\s*=\s*''student-documents'''
        OR policy_record.with_check ~* '''student-documents''\s*(::[a-z ]+)?\s*=\s*bucket_id'
      )
      AND policy_record.with_check !~* '\bOR\b'
      AND policy_record.with_check !~* 'bucket_id\s+IN\s*\(';

    is_exclusively_student_bucket := CASE policy_record.cmd
      WHEN 'SELECT' THEN student_qual_scoped
      WHEN 'DELETE' THEN student_qual_scoped
      WHEN 'INSERT' THEN student_check_scoped
      WHEN 'UPDATE' THEN student_qual_scoped AND (policy_record.with_check IS NULL OR student_check_scoped)
      WHEN 'ALL' THEN student_qual_scoped AND (policy_record.with_check IS NULL OR student_check_scoped)
      ELSE false
    END;

    IF expression ~* '''student-documents''' THEN
      IF NOT is_exclusively_student_bucket THEN
        RAISE EXCEPTION
          'Storage policy %.% mixes student-documents with another or opaque scope; split it before retrying. Definition: %',
          'storage.objects', policy_record.policyname, expression;
      END IF;
      EXECUTE format('DROP POLICY %I ON storage.objects', policy_record.policyname);
      CONTINUE;
    END IF;

    qual_scoped := policy_record.qual IS NOT NULL
      AND (
        policy_record.qual ~* 'bucket_id\s*=\s*''[^'']+'''
        OR policy_record.qual ~* '''[^'']+''\s*(::[a-z ]+)?\s*=\s*bucket_id'
      )
      AND policy_record.qual !~* '\bOR\b'
      AND policy_record.qual !~* 'bucket_id\s*(<>|!=)|bucket_id\s+IS\s+NULL|bucket_id\s+IN\s*\(';
    check_scoped := policy_record.with_check IS NOT NULL
      AND (
        policy_record.with_check ~* 'bucket_id\s*=\s*''[^'']+'''
        OR policy_record.with_check ~* '''[^'']+''\s*(::[a-z ]+)?\s*=\s*bucket_id'
      )
      AND policy_record.with_check !~* '\bOR\b'
      AND policy_record.with_check !~* 'bucket_id\s*(<>|!=)|bucket_id\s+IS\s+NULL|bucket_id\s+IN\s*\(';

    is_clearly_other_bucket := CASE policy_record.cmd
      WHEN 'SELECT' THEN qual_scoped
      WHEN 'DELETE' THEN qual_scoped
      WHEN 'INSERT' THEN check_scoped
      WHEN 'UPDATE' THEN qual_scoped AND (policy_record.with_check IS NULL OR check_scoped)
      WHEN 'ALL' THEN qual_scoped AND (policy_record.with_check IS NULL OR check_scoped)
      ELSE false
    END;

    IF NOT is_clearly_other_bucket THEN
      RAISE EXCEPTION
        'Storage policy %.% is broad or opaque and may affect student-documents; scope it explicitly before retrying. Definition: %',
        'storage.objects', policy_record.policyname, expression;
    END IF;
  END LOOP;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.can_access_student_document(text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.can_access_student_document(text) FROM PUBLIC, anon, authenticated;
    DROP FUNCTION public.can_access_student_document(text);
  END IF;
END;
$$;

COMMIT;

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.student_profile_notes') IS NOT NULL THEN
    RAISE EXCEPTION 'student_profile_notes already exists; inspect the existing relation before applying this migration.';
  END IF;
END;
$$;

CREATE TABLE public.student_profile_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  text text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  author_id uuid NOT NULL REFERENCES public.system_users(id) ON DELETE RESTRICT,
  author_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.system_users(id) ON DELETE RESTRICT,
  CONSTRAINT student_profile_notes_text_check CHECK (
    text = btrim(text) AND char_length(text) BETWEEN 1 AND 2000
  ),
  CONSTRAINT student_profile_notes_author_name_check CHECK (btrim(author_name) <> ''),
  CONSTRAINT student_profile_notes_completion_check CHECK (
    (completed AND completed_at IS NOT NULL AND completed_by IS NOT NULL)
    OR (NOT completed AND completed_at IS NULL AND completed_by IS NULL)
  )
);

CREATE INDEX student_profile_notes_student_created_idx
  ON public.student_profile_notes (student_id, created_at DESC);
CREATE INDEX student_profile_notes_author_idx
  ON public.student_profile_notes (author_id);
CREATE INDEX student_profile_notes_completed_by_idx
  ON public.student_profile_notes (completed_by)
  WHERE completed_by IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_student_profile_note_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_student_profile_note_updated_at_trigger
BEFORE UPDATE ON public.student_profile_notes
FOR EACH ROW EXECUTE FUNCTION public.set_student_profile_note_updated_at();

CREATE OR REPLACE FUNCTION public.assert_student_profile_note_access(
  p_actor_user_id uuid,
  p_student_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_record record;
  student_record record;
BEGIN
  SELECT actor.id, actor.role, actor.branch_id
  INTO actor_record
  FROM public.system_users AS actor
  WHERE actor.id = p_actor_user_id
    AND actor.status = 'active'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOTES_FORBIDDEN'; END IF;

  SELECT student.id, student.branch_id, student.counselor_id
  INTO student_record
  FROM public.student_profiles AS student
  WHERE student.id = p_student_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOTES_STUDENT_NOT_FOUND'; END IF;
  IF student_record.branch_id IS NULL THEN RAISE EXCEPTION 'PROFILE_NOTES_FORBIDDEN'; END IF;

  PERFORM 1
  FROM public.branches AS branch
  WHERE branch.id = student_record.branch_id
    AND branch.status = 'active'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOTES_FORBIDDEN'; END IF;

  IF actor_record.branch_id IS NOT NULL THEN
    PERFORM 1
    FROM public.branches AS branch
    WHERE branch.id = actor_record.branch_id
      AND branch.status = 'active'
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOTES_FORBIDDEN'; END IF;
  END IF;

  IF actor_record.role IN ('Super Admin', 'Admin') THEN
    RETURN;
  END IF;
  IF actor_record.branch_id IS NULL OR actor_record.branch_id IS DISTINCT FROM student_record.branch_id THEN
    RAISE EXCEPTION 'PROFILE_NOTES_FORBIDDEN';
  END IF;
  IF actor_record.role = 'Şube Müdürü' THEN
    RETURN;
  END IF;
  IF actor_record.role IN ('Danışman', 'Temsilci', 'Öğrenci Temsilci')
     AND student_record.counselor_id IS NOT DISTINCT FROM actor_record.id THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'PROFILE_NOTES_FORBIDDEN';
END;
$$;

CREATE OR REPLACE FUNCTION public.create_student_profile_note_secure(
  p_actor_user_id uuid,
  p_student_id uuid,
  p_text text
)
RETURNS SETOF public.student_profile_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_name text;
  inserted_note public.student_profile_notes%ROWTYPE;
BEGIN
  PERFORM public.assert_student_profile_note_access(p_actor_user_id, p_student_id);
  IF p_text IS NULL OR p_text IS DISTINCT FROM btrim(p_text)
     OR char_length(p_text) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'PROFILE_NOTES_INVALID_TEXT';
  END IF;

  SELECT actor.full_name INTO actor_name
  FROM public.system_users AS actor
  WHERE actor.id = p_actor_user_id AND actor.status = 'active';
  IF actor_name IS NULL OR btrim(actor_name) = '' THEN RAISE EXCEPTION 'PROFILE_NOTES_FORBIDDEN'; END IF;

  INSERT INTO public.student_profile_notes (student_id, text, author_id, author_name)
  VALUES (p_student_id, p_text, p_actor_user_id, actor_name)
  RETURNING * INTO inserted_note;
  RETURN NEXT inserted_note;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_student_profile_notes_secure(
  p_actor_user_id uuid,
  p_student_id uuid
)
RETURNS SETOF public.student_profile_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM public.assert_student_profile_note_access(p_actor_user_id, p_student_id);
  RETURN QUERY
  SELECT note.*
  FROM public.student_profile_notes AS note
  WHERE note.student_id = p_student_id
  ORDER BY note.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_student_profile_note_completed_secure(
  p_actor_user_id uuid,
  p_student_id uuid,
  p_note_id uuid,
  p_completed boolean
)
RETURNS SETOF public.student_profile_notes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  updated_note public.student_profile_notes%ROWTYPE;
BEGIN
  PERFORM public.assert_student_profile_note_access(p_actor_user_id, p_student_id);
  IF p_completed IS NULL THEN RAISE EXCEPTION 'PROFILE_NOTES_INVALID_COMPLETION'; END IF;

  UPDATE public.student_profile_notes
  SET completed = p_completed,
      completed_at = CASE WHEN p_completed THEN now() ELSE NULL END,
      completed_by = CASE WHEN p_completed THEN p_actor_user_id ELSE NULL END
  WHERE id = p_note_id
    AND student_id = p_student_id
  RETURNING * INTO updated_note;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOTES_NOTE_NOT_FOUND'; END IF;
  RETURN NEXT updated_note;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_student_profile_reminder_date_secure(
  p_actor_user_id uuid,
  p_student_id uuid,
  p_reminder_date date
)
RETURNS date
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  saved_date date;
BEGIN
  PERFORM public.assert_student_profile_note_access(p_actor_user_id, p_student_id);
  UPDATE public.student_profiles
  SET reminder_date = p_reminder_date
  WHERE id = p_student_id
  RETURNING reminder_date INTO saved_date;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROFILE_NOTES_STUDENT_NOT_FOUND'; END IF;
  RETURN saved_date;
END;
$$;

ALTER TABLE public.student_profile_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profile_notes FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_profile_notes FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.set_student_profile_note_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_student_profile_note_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.assert_student_profile_note_access(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_student_profile_notes_secure(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_student_profile_note_secure(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_student_profile_note_completed_secure(uuid, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_student_profile_reminder_date_secure(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_student_profile_notes_secure(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_student_profile_note_secure(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_student_profile_note_completed_secure(uuid, uuid, uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_student_profile_reminder_date_secure(uuid, uuid, date) TO service_role;

COMMIT;

DO $$
DECLARE
  super_admin_id uuid;
  target_ids uuid[];
  reference_record record;
BEGIN
  SELECT id
  INTO super_admin_id
  FROM public.system_users
  WHERE role = 'Super Admin'
  ORDER BY (status = 'active') DESC, created_at
  LIMIT 1;

  IF super_admin_id IS NULL THEN
    RAISE EXCEPTION 'Kullanıcı temizliği iptal edildi: Super Admin bulunamadı.';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO target_ids
  FROM public.system_users
  WHERE role <> 'Super Admin';

  IF cardinality(target_ids) = 0 THEN
    RETURN;
  END IF;

  -- Remove hierarchy references first; the target rows are deleted in the same transaction.
  ALTER TABLE public.system_users DISABLE TRIGGER validate_system_user_hierarchy_trigger;
  ALTER TABLE public.system_users DISABLE TRIGGER protect_linked_student_user_trigger;
  UPDATE public.system_users
  SET parent_user_id = NULL
  WHERE id = ANY(target_ids) OR parent_user_id = ANY(target_ids);
  ALTER TABLE public.system_users ENABLE TRIGGER protect_linked_student_user_trigger;
  ALTER TABLE public.system_users ENABLE TRIGGER validate_system_user_hierarchy_trigger;

  -- Detach linked student accounts before counselor references are cleared, otherwise the
  -- sync trigger would reject the update while a student_user_id is still attached.
  ALTER TABLE public.student_profiles DISABLE TRIGGER require_student_auth_link_rpc_trigger;
  UPDATE public.student_profiles
  SET student_user_id = NULL
  WHERE student_user_id = ANY(target_ids);
  ALTER TABLE public.student_profiles ENABLE TRIGGER require_student_auth_link_rpc_trigger;

  -- Preserve business records: nullable user references are cleared, required audit references
  -- are transferred to the retained Super Admin.
  FOR reference_record IN
    SELECT
      source_namespace.nspname AS schema_name,
      source_table.relname AS table_name,
      source_column.attname AS column_name,
      source_column.attnotnull AS is_required
    FROM pg_constraint AS constraint_row
    JOIN pg_class AS source_table ON source_table.oid = constraint_row.conrelid
    JOIN pg_namespace AS source_namespace ON source_namespace.oid = source_table.relnamespace
    JOIN pg_class AS target_table ON target_table.oid = constraint_row.confrelid
    JOIN pg_namespace AS target_namespace ON target_namespace.oid = target_table.relnamespace
    JOIN pg_attribute AS source_column
      ON source_column.attrelid = source_table.oid
      AND source_column.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND cardinality(constraint_row.conkey) = 1
      AND cardinality(constraint_row.confkey) = 1
      AND source_namespace.nspname = 'public'
      AND (
        (target_namespace.nspname = 'public' AND target_table.relname = 'system_users')
        OR (target_namespace.nspname = 'auth' AND target_table.relname = 'users')
      )
      AND NOT (
        source_table.relname = 'system_users'
      )
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = $1 WHERE %I = ANY($2)',
      reference_record.schema_name,
      reference_record.table_name,
      reference_record.column_name,
      reference_record.column_name
    )
    USING CASE WHEN reference_record.is_required THEN super_admin_id ELSE NULL END, target_ids;
  END LOOP;

  DELETE FROM public.system_users WHERE id = ANY(target_ids);
  DELETE FROM auth.users WHERE id = ANY(target_ids);
END;
$$;

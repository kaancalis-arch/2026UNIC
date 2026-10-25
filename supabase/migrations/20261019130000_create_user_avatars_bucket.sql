BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS user_avatars_public_read ON storage.objects;
CREATE POLICY user_avatars_public_read
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-avatars');

DROP POLICY IF EXISTS user_avatars_manager_insert ON storage.objects;
CREATE POLICY user_avatars_manager_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  AND EXISTS (
    SELECT 1
    FROM public.system_users AS actor
    WHERE actor.id = (SELECT auth.uid())
      AND actor.status = 'active'
      AND actor.role IN ('Super Admin', 'Admin', 'Şube Müdürü')
  )
);

COMMIT;

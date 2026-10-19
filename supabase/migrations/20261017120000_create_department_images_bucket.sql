BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'department-images',
  'department-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS department_images_public_read ON storage.objects;
CREATE POLICY department_images_public_read
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'department-images');

DROP POLICY IF EXISTS department_images_global_admin_insert ON storage.objects;
CREATE POLICY department_images_global_admin_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'department-images'
  AND public.core_actor_is_active_global_admin()
);

DROP POLICY IF EXISTS department_images_global_admin_update ON storage.objects;
CREATE POLICY department_images_global_admin_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'department-images'
  AND public.core_actor_is_active_global_admin()
)
WITH CHECK (
  bucket_id = 'department-images'
  AND public.core_actor_is_active_global_admin()
);

DROP POLICY IF EXISTS department_images_global_admin_delete ON storage.objects;
CREATE POLICY department_images_global_admin_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'department-images'
  AND public.core_actor_is_active_global_admin()
);

COMMIT;

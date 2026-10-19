BEGIN;

CREATE POLICY student_profiles_update_scoped
ON public.student_profiles
FOR UPDATE
TO authenticated
USING (public.core_actor_can_read_student(branch_id, counselor_id))
WITH CHECK (public.core_actor_can_read_student(branch_id, counselor_id));

COMMIT;

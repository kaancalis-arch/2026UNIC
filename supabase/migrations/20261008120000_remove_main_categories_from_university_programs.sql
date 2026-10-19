alter table public.university_programs
  drop column if exists main_category_id,
  drop column if exists main_category_2_id,
  drop column if exists main_category_3_id;

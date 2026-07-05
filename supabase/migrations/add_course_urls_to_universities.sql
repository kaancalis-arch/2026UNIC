alter table public.universities
add column if not exists undergraduate_courses_url text,
add column if not exists master_courses_url text;

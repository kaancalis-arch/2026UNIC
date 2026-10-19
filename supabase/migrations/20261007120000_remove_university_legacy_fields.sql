alter table public.universities
  drop column if exists departments_url,
  drop column if exists parser_profile,
  drop column if exists consulting_type,
  drop column if exists shared_institution_id;

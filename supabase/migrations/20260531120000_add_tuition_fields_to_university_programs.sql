alter table if exists public.university_programs
  add column if not exists tuition_budget_range text,
  add column if not exists tuition_currency text;

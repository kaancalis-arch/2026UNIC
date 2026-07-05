create table if not exists public.program_department_mapping_rules (
  id uuid primary key default gen_random_uuid(),
  program_name_pattern text not null,
  matched_departments text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists unique_program_department_rule
on public.program_department_mapping_rules (program_name_pattern);

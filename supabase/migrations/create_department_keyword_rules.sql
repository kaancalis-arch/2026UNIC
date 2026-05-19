create table if not exists public.department_keyword_rules (
  id uuid primary key default gen_random_uuid(),
  keyword text not null,
  matched_department text not null,
  priority integer default 100,
  is_active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists unique_department_keyword_rule
on public.department_keyword_rules (lower(keyword), matched_department);

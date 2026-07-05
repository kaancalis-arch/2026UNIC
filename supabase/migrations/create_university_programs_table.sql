create table if not exists public.university_programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references public.universities(id) on delete cascade,
  program_name text not null,
  degree text,
  duration text,
  url text,
  level text not null,
  matched_departments text[] default '{}',
  match_status text default 'needs_manual_review',
  match_notes text,
  source_url text,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create unique index if not exists unique_university_program_url
on public.university_programs (university_id, url);

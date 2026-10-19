alter table public.universities
  add column if not exists campuses text[] not null default '{}';

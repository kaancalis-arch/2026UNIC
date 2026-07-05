create table if not exists public.school_names (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('high_school', 'university')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_names_type_name_key unique (type, name)
);

create index if not exists school_names_type_idx on public.school_names (type);
create index if not exists school_names_name_idx on public.school_names (name);

create or replace function public.set_school_names_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_school_names_updated_at on public.school_names;
create trigger set_school_names_updated_at
before update on public.school_names
for each row
execute function public.set_school_names_updated_at();

alter table public.school_names enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'school_names'
      and policyname = 'Allow client access to school names'
  ) then
    create policy "Allow client access to school names"
      on public.school_names
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

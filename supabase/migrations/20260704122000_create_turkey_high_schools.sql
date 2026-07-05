create table if not exists public.turkey_high_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists turkey_high_schools_name_idx
on public.turkey_high_schools (name);

create or replace function public.set_turkey_high_schools_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_turkey_high_schools_updated_at on public.turkey_high_schools;
create trigger set_turkey_high_schools_updated_at
before update on public.turkey_high_schools
for each row
execute function public.set_turkey_high_schools_updated_at();

alter table public.turkey_high_schools enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'turkey_high_schools'
      and policyname = 'Allow client access to turkey high schools'
  ) then
    create policy "Allow client access to turkey high schools"
      on public.turkey_high_schools
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

insert into public.turkey_high_schools (name)
select name
from public.school_names
where type = 'high_school'
on conflict (name) do nothing;

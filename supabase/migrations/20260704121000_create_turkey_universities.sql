create table if not exists public.turkey_universities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists turkey_universities_name_idx
on public.turkey_universities (name);

create or replace function public.set_turkey_universities_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_turkey_universities_updated_at on public.turkey_universities;
create trigger set_turkey_universities_updated_at
before update on public.turkey_universities
for each row
execute function public.set_turkey_universities_updated_at();

alter table public.turkey_universities enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'turkey_universities'
      and policyname = 'Allow client access to turkey universities'
  ) then
    create policy "Allow client access to turkey universities"
      on public.turkey_universities
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

insert into public.turkey_universities (name)
select name
from public.school_names
where type = 'university'
on conflict (name) do nothing;

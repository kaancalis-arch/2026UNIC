create extension if not exists pgcrypto;

drop table if exists public.calendar_list;

create table public.calendar_list (
  id uuid primary key default gen_random_uuid(),
  record_type text not null default 'event' check (record_type in ('entry', 'event')),
  date date not null,
  title text,
  entry_type text check (entry_type in ('webinar', 'randevu', 'etkinlik')),
  event_type text check (event_type in ('toplanti', 'webinar', 'randevu', 'egitim', 'seminer')),
  note text,
  start_time time,
  end_time time,
  link text,
  assigned_user_id text,
  assigned_user_name text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_list_date
  on public.calendar_list (date);

create index if not exists idx_calendar_list_record_type
  on public.calendar_list (record_type);

create index if not exists idx_calendar_list_event_type
  on public.calendar_list (event_type);

create or replace function public.set_calendar_list_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_calendar_list_updated_at on public.calendar_list;

create trigger trg_calendar_list_updated_at
before update on public.calendar_list
for each row
execute function public.set_calendar_list_updated_at();

alter table public.calendar_list enable row level security;

drop policy if exists "calendar_list_select_all" on public.calendar_list;
drop policy if exists "calendar_list_insert_all" on public.calendar_list;
drop policy if exists "calendar_list_update_all" on public.calendar_list;
drop policy if exists "calendar_list_delete_all" on public.calendar_list;

create policy "calendar_list_select_all"
on public.calendar_list
for select
to anon, authenticated
using (true);

create policy "calendar_list_insert_all"
on public.calendar_list
for insert
to anon, authenticated
with check (true);

create policy "calendar_list_update_all"
on public.calendar_list
for update
to anon, authenticated
using (true)
with check (true);

create policy "calendar_list_delete_all"
on public.calendar_list
for delete
to anon, authenticated
using (true);

alter table public.department_keyword_rules
  add column if not exists department_name text,
  add column if not exists major_keywords text[] default '{}',
  add column if not exists required_match_keywords text[] default '{}',
  add column if not exists rule_notes text;

update public.department_keyword_rules
set department_name = coalesce(nullif(trim(department_name), ''), nullif(trim(matched_department), ''), nullif(trim(keyword), ''))
where department_name is null or trim(department_name) = '';

with ranked_rules as (
  select
    id,
    row_number() over (
      partition by department_name
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.department_keyword_rules
  where department_name is not null
)
delete from public.department_keyword_rules rules
using ranked_rules ranked
where rules.id = ranked.id
  and ranked.row_number > 1;

alter table public.department_keyword_rules
  alter column department_name set not null;

create unique index if not exists unique_department_keyword_rule_department_name
  on public.department_keyword_rules (department_name);

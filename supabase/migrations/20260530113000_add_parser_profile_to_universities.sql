alter table public.universities
add column if not exists parser_profile text not null default 'auto';

update public.universities
set parser_profile = 'birmingham_course_index'
where name = 'University of Birmingham';

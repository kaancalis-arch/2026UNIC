do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'department_keyword_rules'
      and policyname = 'Allow client access to department keyword rules'
  ) then
    create policy "Allow client access to department keyword rules"
      on public.department_keyword_rules
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

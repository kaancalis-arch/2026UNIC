update public.department_keyword_rules as rule
set major_keywords = (
  select array_agg(keyword order by first_position)
  from (
    select keyword, min(position) as first_position
    from unnest(coalesce(rule.major_keywords, '{}'::text[]) || array['=Design'])
      with ordinality as combined(keyword, position)
    group by keyword
  ) as unique_keywords
),
updated_at = now()
where rule.department_name = 'İç Mimarlık / Ürün Tasarımı / Endüstriyel Tasarım';

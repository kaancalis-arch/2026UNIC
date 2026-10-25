do $$
declare
  rule_update record;
begin
  for rule_update in
    select *
    from (values
      ('Bilgisayar Bilimleri', array['cyber security', 'web development', 'bioinformatics', 'data analyst']),
      ('Biyoloji Temelli Bilimler', array['biomedicine', 'nanobiology', 'life science', 'physiology', 'bioinformatics']),
      ('Dilbilimi / Eğitim Bilimleri', array['comparative literature', 'literary studies', 'creative writing', 'creative and professional writing', 'early years', 'vulnerable children and families']),
      ('Dijital Tasarım', array['creative technology', 'creative technologies', 'audio design', 'environmental design', 'visual design', 'video design', 'set design', 'jewelry design', 'transportation design', 'design innovation']),
      ('Ekonomi / Finans', array['accountancy', 'real estate']),
      ('Fizik Temelli Bilimler', array['environmental geoscience', 'earth sciences', 'earth and planetary sciences', 'earth and climate dynamics', 'earth climate and technology', 'earth, climate and technology', 'natural sciences', 'science for sustainable societies', 'sustainability science', 'environmental sustainability science', 'environmental change and sustainability', 'sustainability']),
      ('Gastronomi', array['food tech']),
      ('Hukuk', array['llb', 'll.b', 'criminal justice']),
      ('İletişim / Medya', array['communications', 'cinema', 'filmmaking', 'photography', 'creative writing', 'creative and professional writing', 'creative industries']),
      ('Kimya Temelli Bilimler', array['pharmaceutical science', 'pharmaceutical sciences']),
      ('Matematik Temelli Bilimler', array['mathematical sciences']),
      ('Oyun Tasarımı', array['games development', 'game creation']),
      ('Resim / Sanat', array['comics', 'visual storytelling', 'creative photography', 'visual representation', 'photography', 'arts curating', 'hand embroidery']),
      ('Sağlık Bilimleri', array['operating department practitioner', 'mental health', 'radiography', 'paramedic science', 'pharmaceutical science', 'pharmaceutical sciences', 'clinical science', 'nutritional sciences', 'social care', 'occupational safety', 'primary care', 'women''s health', 'radiotherapy', 'oncology']),
      ('Sahne Sanatları', array['dance']),
      ('Sosyal Bilimler', array['social science', 'comparative literature', 'literary studies', 'liberal arts', 'humanities', 'human sciences', 'ancient studies', 'ancient civilizations', 'social work', 'global governance', 'global humanities', 'war studies', 'classical literature', 'security studies', 'asian studies', 'african studies', 'urban studies', 'computational social science', 'vulnerable children and families']),
      ('Spor Bilimleri', array['coach', 'fitness coach']),
      ('Veterinerlik', array['animal care'])
    ) as updates(department_name, keywords)
  loop
    update public.department_keyword_rules as rule
    set major_keywords = (
      select array_agg(keyword order by first_position)
      from (
        select keyword, min(position) as first_position
        from unnest(coalesce(rule.major_keywords, '{}'::text[]) || rule_update.keywords)
          with ordinality as combined(keyword, position)
        group by keyword
      ) as unique_keywords
    ),
    updated_at = now()
    where rule.department_name = rule_update.department_name;
  end loop;
end
$$;

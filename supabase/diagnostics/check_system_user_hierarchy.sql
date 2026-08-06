-- Read-only diagnostic for the UNIC system user hierarchy.
-- Run with a role that can read public.system_users, public.branches, and auth.users.
WITH RECURSIVE
valid_roles(role) AS (
  VALUES
    ('Super Admin'::text),
    ('Admin'::text),
    ('Şube Müdürü'::text),
    ('Danışman'::text),
    ('Temsilci'::text),
    ('Öğrenci Temsilci'::text),
    ('Öğrenci'::text)
),
branch_required_roles(role) AS (
  VALUES
    ('Şube Müdürü'::text),
    ('Danışman'::text),
    ('Temsilci'::text),
    ('Öğrenci Temsilci'::text),
    ('Öğrenci'::text)
),
allowed_parent_roles(child_role, parent_role) AS (
  VALUES
    ('Admin'::text, 'Super Admin'::text),
    ('Şube Müdürü'::text, 'Admin'::text),
    ('Danışman'::text, 'Şube Müdürü'::text),
    ('Temsilci'::text, 'Şube Müdürü'::text),
    ('Temsilci'::text, 'Danışman'::text),
    ('Öğrenci Temsilci'::text, 'Danışman'::text),
    ('Öğrenci'::text, 'Danışman'::text),
    ('Öğrenci'::text, 'Temsilci'::text),
    ('Öğrenci'::text, 'Öğrenci Temsilci'::text)
),
duplicate_emails AS (
  SELECT lower(trim(email)) AS normalized_email
  FROM public.system_users
  WHERE email IS NOT NULL
    AND trim(email) <> ''
  GROUP BY lower(trim(email))
  HAVING count(*) > 1
),
hierarchy_paths AS (
  SELECT
    user_row.id AS start_user_id,
    user_row.parent_user_id AS next_user_id,
    ARRAY[user_row.id] AS visited_ids,
    false AS repeated_node,
    false AS returned_to_start
  FROM public.system_users AS user_row

  UNION ALL

  SELECT
    path.start_user_id,
    parent_row.parent_user_id AS next_user_id,
    path.visited_ids || parent_row.id,
    parent_row.id = ANY(path.visited_ids) AS repeated_node,
    parent_row.id = path.start_user_id AS returned_to_start
  FROM hierarchy_paths AS path
  JOIN public.system_users AS parent_row
    ON parent_row.id = path.next_user_id
  WHERE path.next_user_id IS NOT NULL
    AND NOT path.repeated_node
),
cycle_members AS (
  SELECT DISTINCT start_user_id AS user_id
  FROM hierarchy_paths
  WHERE returned_to_start
),
problems AS (
  SELECT
    'INVALID_ROLE'::text AS problem_type,
    user_row.id::text AS user_id,
    user_row.full_name::text AS full_name,
    user_row.role::text AS role,
    format('Geçersiz rol değeri: %s.', COALESCE(user_row.role, 'NULL')) AS explanation
  FROM public.system_users AS user_row
  LEFT JOIN valid_roles ON valid_roles.role = user_row.role
  WHERE valid_roles.role IS NULL

  UNION ALL

  SELECT
    'INVALID_STATUS',
    user_row.id::text,
    user_row.full_name::text,
    user_row.role::text,
    format('Geçersiz status değeri: %s.', COALESCE(user_row.status, 'NULL'))
  FROM public.system_users AS user_row
  WHERE user_row.status IS NULL
     OR user_row.status NOT IN ('active', 'passive')

  UNION ALL

  SELECT
    'MISSING_REQUIRED_BRANCH',
    user_row.id::text,
    user_row.full_name::text,
    user_row.role::text,
    format('%s rolü için branch_id zorunludur.', user_row.role)
  FROM public.system_users AS user_row
  JOIN branch_required_roles ON branch_required_roles.role = user_row.role
  WHERE user_row.branch_id IS NULL

  UNION ALL

  SELECT
    'MISSING_REQUIRED_PARENT',
    user_row.id::text,
    user_row.full_name::text,
    user_row.role::text,
    format('%s rolü için parent_user_id zorunludur.', user_row.role)
  FROM public.system_users AS user_row
  JOIN valid_roles ON valid_roles.role = user_row.role
  WHERE user_row.role <> 'Super Admin'
    AND user_row.parent_user_id IS NULL

  UNION ALL

  SELECT
    'INVALID_PARENT_ROLE',
    child.id::text,
    child.full_name::text,
    child.role::text,
    format(
      '%s rolündeki kullanıcı %s rolündeki üst kullanıcıya bağlanamaz.',
      child.role,
      parent.role
    )
  FROM public.system_users AS child
  JOIN public.system_users AS parent ON parent.id = child.parent_user_id
  JOIN valid_roles AS child_valid_role ON child_valid_role.role = child.role
  LEFT JOIN allowed_parent_roles AS allowed
    ON allowed.child_role = child.role
   AND allowed.parent_role = parent.role
  WHERE child.role = 'Super Admin'
     OR allowed.child_role IS NULL

  UNION ALL

  SELECT
    'CROSS_BRANCH_PARENT',
    child.id::text,
    child.full_name::text,
    child.role::text,
    format(
      'Alt kullanıcının branch_id değeri (%s), üst kullanıcının branch_id değeriyle (%s) aynı değildir.',
      child.branch_id,
      parent.branch_id
    )
  FROM public.system_users AS child
  JOIN public.system_users AS parent ON parent.id = child.parent_user_id
  WHERE child.branch_id IS NOT NULL
    AND parent.branch_id IS NOT NULL
    AND child.branch_id IS DISTINCT FROM parent.branch_id

  UNION ALL

  SELECT
    'PASSIVE_PARENT',
    child.id::text,
    child.full_name::text,
    child.role::text,
    format('Bağlı olunan üst kullanıcı (%s) aktif değildir.', COALESCE(parent.full_name, parent.id::text))
  FROM public.system_users AS child
  JOIN public.system_users AS parent ON parent.id = child.parent_user_id
  WHERE parent.status IS DISTINCT FROM 'active'

  UNION ALL

  SELECT
    'SELF_PARENT',
    user_row.id::text,
    user_row.full_name::text,
    user_row.role::text,
    'Kullanıcının parent_user_id değeri kendi id değeriyle aynıdır.'
  FROM public.system_users AS user_row
  WHERE user_row.parent_user_id = user_row.id

  UNION ALL

  SELECT
    'HIERARCHY_CYCLE',
    user_row.id::text,
    user_row.full_name::text,
    user_row.role::text,
    'Kullanıcı, kendisine geri dönen döngüsel bir üst kullanıcı zincirinin parçasıdır.'
  FROM cycle_members
  JOIN public.system_users AS user_row ON user_row.id = cycle_members.user_id

  UNION ALL

  SELECT
    'PARENT_NOT_FOUND',
    child.id::text,
    child.full_name::text,
    child.role::text,
    format('parent_user_id (%s) system_users tablosunda bulunamadı.', child.parent_user_id)
  FROM public.system_users AS child
  LEFT JOIN public.system_users AS parent ON parent.id = child.parent_user_id
  WHERE child.parent_user_id IS NOT NULL
    AND parent.id IS NULL

  UNION ALL

  SELECT
    'BRANCH_NOT_FOUND',
    user_row.id::text,
    user_row.full_name::text,
    user_row.role::text,
    format('branch_id (%s) branches tablosunda bulunamadı.', user_row.branch_id)
  FROM public.system_users AS user_row
  LEFT JOIN public.branches AS branch ON branch.id = user_row.branch_id
  WHERE user_row.branch_id IS NOT NULL
    AND branch.id IS NULL

  UNION ALL

  SELECT
    'DUPLICATE_EMAIL',
    user_row.id::text,
    user_row.full_name::text,
    user_row.role::text,
    format('E-posta adresi birden fazla profilde kullanılıyor: %s.', user_row.email)
  FROM public.system_users AS user_row
  JOIN duplicate_emails ON duplicate_emails.normalized_email = lower(trim(user_row.email))

  UNION ALL

  SELECT
    'PROFILE_WITHOUT_AUTH_USER',
    profile.id::text,
    profile.full_name::text,
    profile.role::text,
    'system_users profiline karşılık gelen auth.users hesabı bulunamadı.'
  FROM public.system_users AS profile
  LEFT JOIN auth.users AS auth_user ON auth_user.id = profile.id
  WHERE auth_user.id IS NULL

  UNION ALL

  SELECT
    'AUTH_USER_WITHOUT_PROFILE',
    auth_user.id::text,
    COALESCE(
      auth_user.raw_user_meta_data ->> 'full_name',
      auth_user.email,
      '(isimsiz auth kullanıcısı)'
    )::text,
    (auth_user.raw_user_meta_data ->> 'role')::text,
    'auth.users hesabına karşılık gelen system_users profili bulunamadı.'
  FROM auth.users AS auth_user
  LEFT JOIN public.system_users AS profile ON profile.id = auth_user.id
  WHERE profile.id IS NULL
)
SELECT
  problem_type,
  user_id,
  full_name,
  role,
  explanation
FROM problems
ORDER BY problem_type, full_name NULLS LAST, user_id;

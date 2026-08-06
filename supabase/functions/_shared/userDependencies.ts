import { SafeError } from './safeErrors.ts';

type SupabaseLikeClient = {
  from: (table: string) => any;
};

type DependencyCheckOptions = {
  includeCalendar?: boolean;
  activeChildrenOnly?: boolean;
};

export async function assertNoUserDependencies(
  admin: SupabaseLikeClient,
  userId: string,
  options: DependencyCheckOptions = {},
): Promise<void> {
  let childrenQuery = admin
    .from('system_users')
    .select('id')
    .eq('parent_user_id', userId);
  if (options.activeChildrenOnly) childrenQuery = childrenQuery.eq('status', 'active');

  const queries: Array<{ name: string; result: PromiseLike<any> }> = [
    { name: 'doğrudan alt kullanıcılar', result: childrenQuery.limit(1) },
    {
      name: 'öğrenci sorumlulukları',
      result: admin
        .from('student_profiles')
        .select('id')
        .or(`counselor_id.eq.${userId},representative_id.eq.${userId}`)
        .limit(1),
    },
    {
      name: 'aktif şube yöneticilikleri',
      result: admin
        .from('branches')
        .select('id')
        .eq('manager_id', userId)
        .eq('status', 'active')
        .limit(1),
    },
  ];

  if (options.includeCalendar) {
    queries.push({
      name: 'takvim kayıtları',
      result: admin
        .from('calendar_list')
        .select('id')
        .or(`assigned_user_id.eq.${userId},created_by.eq.${userId}`)
        .limit(1),
    });
  }

  let results: Array<{ name: string; data?: any[] | null; error?: unknown }>;
  try {
    results = await Promise.all(queries.map(async ({ name, result }) => ({ name, ...(await result) })));
  } catch (error) {
    console.error('Kullanıcı bağımlılık sorguları tamamlanamadı:', error);
    throw new SafeError('INTERNAL_ERROR', 'Kullanıcı bağımlılıkları doğrulanamadı.', 500);
  }
  const failed = results.find(({ error }) => error);
  if (failed) {
    console.error(`Kullanıcı bağımlılık sorgusu başarısız (${failed.name}):`, failed.error);
    throw new SafeError('INTERNAL_ERROR', 'Kullanıcı bağımlılıkları doğrulanamadı.', 500);
  }

  if (results.some(({ data }) => (data?.length ?? 0) > 0)) {
    throw new SafeError(
      'DEPENDENT_RECORDS',
      'Kullanıcıya bağlı kayıtlar bulunuyor. Önce bu kayıtları başka bir kullanıcıya devredin.',
      409,
    );
  }
}

import { supabase } from './supabaseClient';

export type DepartmentKeywordRule = {
  id: string;
  keyword: string | null;
  matched_department: string | null;
  department_name: string | null;
  major_keywords: string[] | null;
  required_match_keywords: string[] | null;
  rule_notes: string | null;
  is_active: boolean | null;
  priority: number | null;
};

export const departmentKeywordRuleService = {
  async getActive(): Promise<DepartmentKeywordRule[]> {
    if (!supabase) throw new Error('Supabase is not configured');

    const rules: DepartmentKeywordRule[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('department_keyword_rules')
        .select('id, keyword, matched_department, department_name, major_keywords, required_match_keywords, rule_notes, is_active, priority')
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .order('department_name', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      rules.push(...((data || []) as DepartmentKeywordRule[]));
      if (!data || data.length < pageSize) break;
    }

    return rules;
  },
};

import { MainDegreeData } from '../types';
import type { DepartmentKeywordRule } from '../services/departmentKeywordRuleService';

const normalizeMatchText = (value: string) => value
  .trim()
  .toLowerCase()
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .replace(/ı/g, 'i');
const isWordCharacter = (value: string | undefined) => Boolean(value && /[\p{L}\p{N}]/u.test(value));

export const containsMatchPhrase = (text: string, phrase: string) => {
  const normalizedText = normalizeMatchText(text);
  const normalizedPhrase = normalizeMatchText(phrase);
  if (!normalizedPhrase) return false;
  if (normalizedPhrase.startsWith('=')) {
    return normalizedText === normalizedPhrase.slice(1).trim();
  }

  let index = normalizedText.indexOf(normalizedPhrase);
  while (index !== -1) {
    const startsAtBoundary = index === 0 || !isWordCharacter(normalizedText[index - 1]);
    const endIndex = index + normalizedPhrase.length;
    const endsAtBoundary = endIndex === normalizedText.length || !isWordCharacter(normalizedText[endIndex]);
    if (startsAtBoundary && endsAtBoundary) return true;
    index = normalizedText.indexOf(normalizedPhrase, index + 1);
  }

  return false;
};

export type DepartmentMatch = {
  degree: MainDegreeData;
  keyword: string;
};

export const matchProgramDepartments = (
  programName: string,
  rules: DepartmentKeywordRule[],
  degrees: MainDegreeData[],
  limit = 3,
): DepartmentMatch[] => {
  const degreesByName = new Map(degrees.map(degree => [normalizeMatchText(degree.name), degree]));
  const matchedDegreeIds = new Set<string>();
  const matches: DepartmentMatch[] = [];

  const orderedRules = [...rules].sort((left, right) =>
    (left.priority ?? 100) - (right.priority ?? 100)
    || (left.department_name || '').localeCompare(right.department_name || '', 'tr-TR')
    || left.id.localeCompare(right.id)
  );

  for (const rule of orderedRules) {
    if (!rule.is_active) continue;

    const keyword = [
      rule.keyword,
      ...(rule.major_keywords || []),
      ...(rule.required_match_keywords || []),
    ].filter((value): value is string => Boolean(value?.trim()))
      .find(value => containsMatchPhrase(programName, value));

    if (!keyword) continue;

    const departmentName = (rule.department_name || rule.matched_department || '').trim();
    const degree = degreesByName.get(normalizeMatchText(departmentName));
    if (!degree || matchedDegreeIds.has(degree.id)) continue;

    matches.push({ degree, keyword });
    matchedDegreeIds.add(degree.id);
    if (matches.length === limit) break;
  }

  return matches;
};

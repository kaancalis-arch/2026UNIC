export type AiOperation = 'analyze_student' | 'generate_roadmap' | 'ask_unic';

export type AiRequest = {
  operation: AiOperation;
  student_id: string;
  question?: string;
};

export type AnalysisResult = {
  recommendedPrograms: string[];
  visaRiskScore: number;
  visaRiskReasoning: string;
  scholarshipProbability: number;
  suggestedUniversities: Array<{
    name: string;
    country: string;
    matchScore: number;
    tuition: number;
  }>;
  overallAssessment: string;
};

export type RoadmapResult = {
  steps: Array<{
    id: string;
    title: string;
    description: string;
    deadline: string;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    category: 'document' | 'application' | 'visa' | 'financial';
  }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPERATIONS: readonly AiOperation[] = ['analyze_student', 'generate_roadmap', 'ask_unic'];
const REQUEST_FIELDS = new Set(['operation', 'student_id', 'question']);
const ROADMAP_STATUSES = new Set(['pending', 'in_progress', 'completed', 'blocked']);
const ROADMAP_CATEGORIES = new Set(['document', 'application', 'visa', 'financial']);

export function parseAiRequest(value: unknown): AiRequest | null {
  if (!isRecord(value) || Object.keys(value).some((key) => !REQUEST_FIELDS.has(key))) return null;
  if (!OPERATIONS.includes(value.operation as AiOperation) || !isUuid(value.student_id)) return null;

  if (value.operation === 'ask_unic') {
    if (typeof value.question !== 'string') return null;
    const question = value.question.trim();
    if (!question || question.length > 2000) return null;
    return { operation: value.operation, student_id: value.student_id, question };
  }

  if ('question' in value) return null;
  return { operation: value.operation, student_id: value.student_id };
}

export function sanitizeAnalysis(value: unknown): AnalysisResult | null {
  if (!isRecord(value)) return null;
  const recommendedPrograms = stringArray(value.recommendedPrograms, 30, 300);
  const universities = Array.isArray(value.suggestedUniversities)
    ? value.suggestedUniversities.slice(0, 30).map(sanitizeUniversity)
    : null;
  const visaReasoning = cleanString(value.visaRiskReasoning, 3000);
  const assessment = cleanString(value.overallAssessment, 5000);
  if (!recommendedPrograms || !universities || universities.some((item) => !item) ||
    !visaReasoning || !assessment || !isFiniteNumber(value.visaRiskScore) ||
    !isFiniteNumber(value.scholarshipProbability)) return null;

  return {
    recommendedPrograms,
    visaRiskScore: clamp(value.visaRiskScore, 0, 100),
    visaRiskReasoning: `${visaReasoning}\n\nBu vize riski yalnız otomatik bir ön değerlendirmedir; resmi makam kararı değildir.`,
    scholarshipProbability: clamp(value.scholarshipProbability, 0, 100),
    suggestedUniversities: universities as AnalysisResult['suggestedUniversities'],
    overallAssessment: `${assessment}\n\nBu otomatik AI değerlendirmesi sonuç veya kabul garantisi vermez. Üniversite uygunluğu ve ücretler resmi üniversite kaynaklarından ayrıca doğrulanmalıdır.`,
  };
}

export function sanitizeRoadmap(value: unknown): RoadmapResult | null {
  if (!isRecord(value) || !Array.isArray(value.steps) || value.steps.length === 0) return null;
  const steps = value.steps.slice(0, 20).map((step) => {
    if (!isRecord(step)) return null;
    const id = cleanString(step.id, 100);
    const title = cleanString(step.title, 300);
    const description = cleanString(step.description, 3000);
    const deadline = cleanString(step.deadline, 100);
    if (!id || !title || !description || !deadline ||
      !ROADMAP_STATUSES.has(step.status as string) ||
      !ROADMAP_CATEGORIES.has(step.category as string)) return null;
    return {
      id,
      title,
      description: `${description} Bu otomatik AI önerisi sonuç garantisi vermez; ilgili gereklilik ve tarihleri resmi kurum kaynaklarından doğrulayın.`,
      deadline,
      status: step.status as RoadmapResult['steps'][number]['status'],
      category: step.category as RoadmapResult['steps'][number]['category'],
    };
  });
  return steps.some((step) => !step) ? null : { steps: steps as RoadmapResult['steps'] };
}

export function sanitizeAnswer(value: unknown): string | null {
  const answer = cleanString(value, 5000);
  return answer
    ? `${answer}\n\nBu yanıt otomatik olarak üretilmiştir, sonuç garantisi vermez ve önemli bilgiler resmi kaynaklardan doğrulanmalıdır.`
    : null;
}

function sanitizeUniversity(value: unknown): AnalysisResult['suggestedUniversities'][number] | null {
  if (!isRecord(value)) return null;
  const name = cleanString(value.name, 300);
  const country = cleanString(value.country, 200);
  if (!name || !country || !isFiniteNumber(value.matchScore) || !isFiniteNumber(value.tuition)) return null;
  return {
    name,
    country,
    matchScore: clamp(value.matchScore, 0, 100),
    tuition: clamp(value.tuition, 0, 1_000_000),
  };
}

function stringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const values = value.slice(0, maxItems).map((item) => cleanString(item, maxLength));
  return values.some((item) => !item) ? null : values as string[];
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

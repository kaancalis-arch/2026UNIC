import { SafeError } from '../../_shared/safeErrors.ts';
import type { AdvisorProvider, AdvisorReportContent, GenerateAdvisorReportInput } from './types.ts';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6-luna';
const FIXED_WARNING = 'Bu metin AI tarafından hazırlanmış bir danışman taslağıdır. Son değerlendirme ve sorumluluk gerçek danışmana aittir.';

const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string', maxLength: 120 },
    summary: { type: 'string', maxLength: 600 },
    observations: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 220 } },
    questions: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 220 } },
    actions: { type: 'array', maxItems: 4, items: { type: 'string', maxLength: 220 } },
    warning: { type: 'string', maxLength: 240 },
  },
  required: ['title', 'summary', 'observations', 'questions', 'actions', 'warning'],
} as const;

export function createOpenAIProvider(): AdvisorProvider {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  const model = Deno.env.get('OPENAI_MODEL')?.trim() || DEFAULT_MODEL;
  if (!apiKey) throw new SafeError('CONFIGURATION_ERROR', 'AI hizmeti yapılandırılmamış.', 500);
  if (!/^gpt-[a-z0-9.-]+$/i.test(model)) {
    throw new SafeError('CONFIGURATION_ERROR', 'AI model yapılandırması geçersiz.', 500);
  }

  return {
    name: 'openai',
    model,
    generateReport: (input) => generateReport(apiKey, model, input),
  };
}

async function generateReport(
  apiKey: string,
  model: string,
  input: GenerateAdvisorReportInput,
): Promise<AdvisorReportContent> {
  let response: Response;
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: 'low' },
        max_output_tokens: 1000,
        input: [
          {
            role: 'developer',
            content: [{ type: 'input_text', text: input.systemInstructions }],
          },
          {
            role: 'user',
            content: [{
              type: 'input_text',
              text: `<UNIC_DATA>${escapeDataBlock(JSON.stringify(input.dataBlock))}</UNIC_DATA>`,
            }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'unic_ai_advisor_report',
            strict: true,
            schema: REPORT_SCHEMA,
          },
        },
      }),
    });
  } catch (error) {
    console.error('OpenAI bağlantısı kurulamadı:', error);
    throw new SafeError('AI_UNAVAILABLE', 'AI hizmetine şu anda ulaşılamıyor.', 503);
  }

  if (!response.ok) {
    const requestId = response.headers.get('x-request-id');
    console.error('OpenAI isteği başarısız:', { status: response.status, requestId });
    throw new SafeError('AI_UNAVAILABLE', 'AI hizmeti isteği tamamlayamadı.', 503);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    console.error('OpenAI yanıtı JSON olarak ayrıştırılamadı:', error);
    throw new SafeError('AI_RESPONSE_INVALID', 'AI yanıtı doğrulanamadı.', 502);
  }

  const outputText = extractOutputText(body);
  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch (error) {
    console.error('OpenAI yapılandırılmış yanıtı ayrıştırılamadı:', error);
    throw new SafeError('AI_RESPONSE_INVALID', 'AI yanıtı doğrulanamadı.', 502);
  }
  const sanitized = sanitizeContent(parsed);
  if (!sanitized) throw new SafeError('AI_RESPONSE_INVALID', 'AI yanıtı doğrulanamadı.', 502);
  return sanitized;
}

function extractOutputText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.output)) {
    throw new SafeError('AI_RESPONSE_INVALID', 'AI yanıtı doğrulanamadı.', 502);
  }
  for (const item of value.output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }
  throw new SafeError('AI_RESPONSE_INVALID', 'AI yanıtı doğrulanamadı.', 502);
}

export function sanitizeContent(value: unknown): AdvisorReportContent | null {
  if (!isRecord(value)) return null;
  const title = cleanString(value.title, 120);
  const summary = cleanString(value.summary, 600);
  const observations = cleanStringArray(value.observations, 4, 220);
  const questions = cleanStringArray(value.questions, 4, 220);
  const actions = cleanStringArray(value.actions, 4, 220);
  if (!title || !summary || !observations || !questions || !actions) return null;
  return { title, summary, observations, questions, actions, warning: FIXED_WARNING };
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const result = value.slice(0, maxItems).map((item) => cleanString(item, maxLength));
  return result.some((item) => item === null) ? null : result as string[];
}

function cleanString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function escapeDataBlock(value: string): string {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

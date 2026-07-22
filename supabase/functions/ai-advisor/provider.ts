import { SafeError } from '../_shared/safeErrors.ts';
import { createOpenAIProvider } from './providers/openai.ts';
import type { AdvisorProvider } from './providers/types.ts';

export function getAdvisorProvider(): AdvisorProvider {
  const provider = Deno.env.get('AI_PROVIDER')?.trim().toLowerCase() || 'openai';
  if (provider !== 'openai') {
    console.error('Desteklenmeyen AI_PROVIDER değeri:', provider);
    throw new SafeError('CONFIGURATION_ERROR', 'AI sağlayıcı yapılandırması geçersiz.', 500);
  }
  return createOpenAIProvider();
}

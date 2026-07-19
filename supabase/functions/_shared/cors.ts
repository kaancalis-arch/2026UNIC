import { errorResponse, SafeError } from './safeErrors.ts';

const allowedHeaders = 'authorization, x-client-info, apikey, content-type';

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (!origin) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// CORS only controls browser origins; it never replaces bearer authentication.
export function handleCors(req: Request): Response | null {
  const origin = req.headers.get('Origin');
  const allowedOrigins = new Set(
    (Deno.env.get('ALLOWED_ORIGINS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );

  if (origin && !allowedOrigins.has(origin)) {
    return errorResponse(
      new SafeError('CORS_FORBIDDEN', 'Bu origin için erişime izin verilmiyor.', 403),
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  return null;
}

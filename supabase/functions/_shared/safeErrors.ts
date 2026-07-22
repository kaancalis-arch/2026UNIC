export type SafeErrorCode =
  | 'CORS_FORBIDDEN'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFIGURATION_ERROR'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'ACTOR_INACTIVE'
  | 'FORBIDDEN'
  | 'INVALID_JSON'
  | 'VALIDATION_ERROR'
  | 'INVALID_ROLE'
  | 'INVALID_HIERARCHY'
  | 'INVALID_BRANCH'
  | 'TARGET_NOT_FOUND'
  | 'SUPER_ADMIN_PROTECTED'
  | 'SELF_UPDATE_RESTRICTED'
  | 'SELF_DELETE_RESTRICTED'
  | 'DEPENDENT_RECORDS'
  | 'EMAIL_ALREADY_EXISTS'
  | 'AUTH_CREATE_FAILED'
  | 'AUTH_UPDATE_FAILED'
  | 'PROFILE_CREATE_FAILED'
  | 'PROFILE_UPDATE_FAILED'
  | 'PROFILE_DELETE_FAILED'
  | 'AUTH_DELETE_FAILED'
  | 'CONSISTENCY_ERROR'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'STUDENT_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'AI_RESPONSE_INVALID'
  | 'AI_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class SafeError extends Error {
  constructor(
    public readonly code: SafeErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = 'SafeError';
  }
}

export function errorResponse(
  error: unknown,
  headers: Record<string, string> = {},
): Response {
  if (error instanceof SafeError) {
    return jsonResponse(
      { success: false, code: error.code, error: error.message },
      error.status,
      headers,
    );
  }

  console.error('Beklenmeyen Edge Function hatası:', error);
  return jsonResponse(
    { success: false, code: 'INTERNAL_ERROR', error: 'İşlem sırasında beklenmeyen bir hata oluştu.' },
    500,
    headers,
  );
}

export function successResponse(
  user: unknown,
  headers: Record<string, string> = {},
): Response {
  return jsonResponse({ success: true, user }, 200, headers);
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

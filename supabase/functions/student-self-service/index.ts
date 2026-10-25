import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { authorizeAuthenticatedActor } from '../_shared/authorization.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { errorResponse, jsonResponse, SafeError } from '../_shared/safeErrors.ts';

const PROFILE_FIELDS = [
  'id', 'first_name', 'last_name', 'email', 'phone', 'dob', 'pipeline_stage',
  'gpa', 'target_degree', 'target_countries', 'budget', 'english_level',
  'interests', 'target_programs', 'avatar_url', 'school_name', 'current_grade',
  'education_status', 'analysis', 'branch_id', 'student_user_id', 'applications',
].join(',');

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const headers = corsHeaders(req);

  if (req.method !== 'POST') {
    return errorResponse(new SafeError('METHOD_NOT_ALLOWED', 'Yalnız POST metodu desteklenir.', 405), headers);
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceRoleKey) {
      throw new SafeError('CONFIGURATION_ERROR', 'Sunucu yapılandırması eksik.', 500);
    }
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const actor = await authorizeAuthenticatedActor(admin, req);
    if (actor.role !== 'Öğrenci') {
      throw new SafeError('FORBIDDEN', 'Bu işlem yalnız öğrenci hesapları içindir.', 403);
    }

    const body = await req.json().catch(() => null) as { operation?: unknown } | null;
    if (!body || body.operation !== 'profile') {
      throw new SafeError('VALIDATION_ERROR', 'Desteklenmeyen operation değeri.', 400);
    }

    const { data: profile, error } = await admin
      .from('student_profiles')
      .select(PROFILE_FIELDS)
      .eq('student_user_id', actor.id)
      .maybeSingle();
    if (error) {
      console.error('Öğrenci öz profili okunamadı:', error);
      throw new SafeError('INTERNAL_ERROR', 'Öğrenci profiliniz yüklenemedi.', 500);
    }
    if (profile && (!actor.branch_id || profile.branch_id !== actor.branch_id)) {
      throw new SafeError('FORBIDDEN', 'Öğrenci profili şube bağlantısı geçersiz.', 403);
    }

    const preferences = profile?.analysis?.preferences;
    const safeProfile = profile ? {
      ...profile,
      analysis: preferences ? {
        preferences: {
          country1: preferences.country1,
          country2: preferences.country2,
          country3: preferences.country3,
          program1: preferences.program1,
          program2: preferences.program2,
        },
      } : undefined,
      applications: Array.isArray(profile.applications)
        ? profile.applications.map((application: Record<string, unknown>) => ({
          id: application.id,
          universityName: application.universityName,
          programName: application.programName,
          status: application.status,
        }))
        : [],
    } : null;

    return jsonResponse({ success: true, profile: safeProfile }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
});

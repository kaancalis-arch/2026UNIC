import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CreateSystemUserPayload = {
  full_name: string;
  email: string;
  password: string;
  role: string;
  branch_id?: string | null;
  parent_user_id?: string | null;
  status?: 'active' | 'passive';
  avatar_url?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Missing Supabase service configuration' }, 500);
    }

    const payload = (await req.json()) as CreateSystemUserPayload;
    const validationError = validatePayload(payload);
    if (validationError) {
      return jsonResponse({ error: validationError }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingProfile } = await admin
      .from('system_users')
      .select('id, email')
      .eq('email', payload.email)
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse({ error: 'Bu e-posta adresi zaten Kullanıcı Yönetimi listesinde kayıtlı.' }, 409);
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: payload.full_name,
        role: payload.role,
      },
    });

    if (authError) {
      return jsonResponse({ error: authError.message }, 400);
    }

    const authUserId = authData.user?.id;
    if (!authUserId) {
      return jsonResponse({ error: 'Auth user could not be created' }, 500);
    }

    const { data: profile, error: profileError } = await admin
      .from('system_users')
      .insert({
        id: authUserId,
        full_name: payload.full_name,
        email: payload.email,
        role: payload.role,
        branch_id: payload.branch_id || null,
        parent_user_id: payload.parent_user_id || null,
        status: payload.status || 'active',
        avatar_url: payload.avatar_url || null,
      })
      .select('*')
      .single();

    if (profileError) {
      await admin.auth.admin.deleteUser(authUserId);
      return jsonResponse({ error: profileError.message }, 400);
    }

    return jsonResponse({ user: profile }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse({ error: message }, 500);
  }
});

function validatePayload(payload: CreateSystemUserPayload) {
  if (!payload.full_name?.trim()) return 'Ad Soyad zorunludur.';
  if (!payload.email?.trim()) return 'E-posta zorunludur.';
  if (!payload.password || payload.password.length < 6) return 'Şifre en az 6 karakter olmalıdır.';
  if (!payload.role?.trim()) return 'Rol zorunludur.';
  return null;
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

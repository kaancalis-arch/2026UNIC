import { FunctionsHttpError } from '@supabase/supabase-js';
import type { UserRole } from '../types';
import { supabase } from './supabaseClient';

export type StudentAssignmentBranch = {
  id: string;
  name: string;
};

export type StudentAssignmentUser = {
  id: string;
  fullName: string;
  role: UserRole;
  branchId: string;
};

export type StudentAssignmentOptions = {
  branches: StudentAssignmentBranch[];
  users: StudentAssignmentUser[];
};

export type StudentAssignmentInput = {
  studentIds: string[];
  branchId?: string | null;
  assignedUserId?: string | null;
};

type EdgeResponse = {
  success?: boolean;
  code?: string;
  error?: string;
  branches?: unknown[];
  users?: unknown[];
  changed_count?: number;
};

const EDGE_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  INVALID_TOKEN: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  ACTOR_INACTIVE: 'Hesabınız aktif olmadığı için bu işlemi yapamazsınız.',
  FORBIDDEN: 'Bu öğrenciler için atama yetkiniz bulunmuyor.',
  VALIDATION_ERROR: 'Atama bilgileri geçersiz. Seçimleri kontrol edin.',
  INVALID_BRANCH: 'Yalnız aktif bir şube seçilebilir.',
  INVALID_HIERARCHY: 'Öğrenci ve sorumlu kullanıcı aynı aktif şubede olmalıdır.',
  STUDENT_NOT_FOUND: 'Seçilen öğrencilerden biri bulunamadı.',
  CONFLICT: 'Atama başka bir işlem nedeniyle tamamlanamadı. Listeyi yenileyin.',
  INTERNAL_ERROR: 'Öğrenci ataması tamamlanamadı. Lütfen tekrar deneyin.',
};

async function requireAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  const expired = session?.expires_at !== undefined && session.expires_at * 1000 <= Date.now();
  if (error || !session?.access_token || expired) {
    throw new Error('Oturumunuz sona erdi. Lütfen yeniden giriş yapın.');
  }
  return session.access_token;
}

async function parseEdgeError(error: unknown, data?: unknown): Promise<never> {
  let body = data as EdgeResponse | undefined;
  if (error instanceof FunctionsHttpError && error.context instanceof Response) {
    try {
      body = await error.context.clone().json();
    } catch {}
  }
  throw new Error((body?.code && EDGE_ERROR_MESSAGES[body.code]) || 'Öğrenci ataması tamamlanamadı. Lütfen tekrar deneyin.');
}

async function invoke(body: Record<string, unknown>): Promise<EdgeResponse> {
  const token = await requireAccessToken();
  const { data, error } = await supabase.functions.invoke('student-assignments', {
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (error || !data?.success) await parseEdgeError(error, data);
  return data as EdgeResponse;
}

function isBranch(value: unknown): value is { id: string; name: string } {
  if (!value || typeof value !== 'object') return false;
  const branch = value as Record<string, unknown>;
  return typeof branch.id === 'string' && typeof branch.name === 'string';
}

function isUser(value: unknown): value is { id: string; full_name: string; role: UserRole; branch_id: string } {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.id === 'string' && typeof user.full_name === 'string' &&
    typeof user.role === 'string' && typeof user.branch_id === 'string';
}

export const studentAssignmentService = {
  async getOptions(branchId?: string | null): Promise<StudentAssignmentOptions> {
    const body: Record<string, unknown> = { action: 'options' };
    if (branchId !== undefined) body.branch_id = branchId;
    const response = await invoke(body);
    if (!Array.isArray(response.branches) || !response.branches.every(isBranch) ||
      !Array.isArray(response.users) || !response.users.every(isUser)) {
      throw new Error('Atama seçenekleri güvenli biçimde yüklenemedi.');
    }
    return {
      branches: response.branches.map(branch => ({ id: branch.id, name: branch.name })),
      users: response.users.map(user => ({
        id: user.id,
        fullName: user.full_name,
        role: user.role,
        branchId: user.branch_id,
      })),
    };
  },

  async assign(input: StudentAssignmentInput): Promise<{ changedCount: number }> {
    const body: Record<string, unknown> = { action: 'assign', student_ids: input.studentIds };
    if (Object.prototype.hasOwnProperty.call(input, 'branchId')) body.branch_id = input.branchId;
    if (Object.prototype.hasOwnProperty.call(input, 'assignedUserId')) {
      body.assigned_user_id = input.assignedUserId;
    }
    const response = await invoke(body);
    if (!Number.isInteger(response.changed_count) || (response.changed_count as number) < 0) {
      throw new Error('Atama sonucu doğrulanamadı. Listeyi yenileyin.');
    }
    return { changedCount: response.changed_count as number };
  },
};

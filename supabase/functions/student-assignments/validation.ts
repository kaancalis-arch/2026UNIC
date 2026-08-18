import { SafeError } from '../_shared/safeErrors.ts';
import { isUuid } from '../_shared/userHierarchy.ts';

export type OptionsPayload = {
  action: 'options';
  branch_id?: string | null;
};

export type AssignPayload = {
  action: 'assign';
  student_ids: string[];
  branchSupplied: boolean;
  branch_id: string | null;
  assignedUserSupplied: boolean;
  assigned_user_id: string | null;
};

export type StudentAssignmentPayload = OptionsPayload | AssignPayload;

const optionsFields = new Set(['action', 'branch_id']);
const assignFields = new Set(['action', 'student_ids', 'branch_id', 'assigned_user_id']);

export function assertAssignmentRole(role: string, branchId: string | null): void {
  if (!['Super Admin', 'Admin', 'Şube Müdürü'].includes(role)) {
    throw new SafeError('FORBIDDEN', 'Bu işlem için yetkiniz bulunmuyor.', 403);
  }
  if (role === 'Şube Müdürü' && !branchId) {
    throw new SafeError('FORBIDDEN', 'Aktif şube bilgisi bulunmuyor.', 403);
  }
}

export function assertAssignScope(role: string, payload: AssignPayload): void {
  if (role === 'Şube Müdürü' && payload.branchSupplied) {
    throw new SafeError('FORBIDDEN', 'Şube müdürü öğrencinin şubesini değiştiremez.', 403);
  }
}

export function parseStudentAssignmentPayload(value: unknown): StudentAssignmentPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SafeError('VALIDATION_ERROR', 'Geçersiz istek gövdesi.', 400);
  }

  const input = value as Record<string, unknown>;
  if (input.action === 'options') return parseOptionsPayload(input);
  if (input.action === 'assign') return parseAssignPayload(input);
  throw new SafeError('VALIDATION_ERROR', 'Geçersiz işlem türü.', 400);
}

function parseOptionsPayload(input: Record<string, unknown>): OptionsPayload {
  rejectUnknownFields(input, optionsFields);
  if (input.branch_id !== undefined && input.branch_id !== null && !isUuid(input.branch_id)) {
    throw new SafeError('VALIDATION_ERROR', 'Şube id geçerli bir UUID olmalıdır.', 400);
  }
  return {
    action: 'options',
    ...(Object.prototype.hasOwnProperty.call(input, 'branch_id')
      ? { branch_id: input.branch_id as string | null }
      : {}),
  };
}

function parseAssignPayload(input: Record<string, unknown>): AssignPayload {
  rejectUnknownFields(input, assignFields);
  if (!Array.isArray(input.student_ids) || input.student_ids.length < 1 || input.student_ids.length > 100) {
    throw new SafeError('VALIDATION_ERROR', 'Bir işlemde 1 ile 100 arasında öğrenci seçilmelidir.', 400);
  }

  const studentIds = input.student_ids;
  if (studentIds.some((id) => !isUuid(id))) {
    throw new SafeError('VALIDATION_ERROR', 'Öğrenci kimliklerinden biri geçersiz.', 400);
  }
  const normalizedIds = studentIds.map((id) => (id as string).toLowerCase());
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    throw new SafeError('VALIDATION_ERROR', 'Aynı öğrenci bir toplu istekte tekrar edemez.', 400);
  }

  const branchSupplied = Object.prototype.hasOwnProperty.call(input, 'branch_id');
  const assignedUserSupplied = Object.prototype.hasOwnProperty.call(input, 'assigned_user_id');
  if (!branchSupplied && !assignedUserSupplied) {
    throw new SafeError('VALIDATION_ERROR', 'En az bir atama alanı gönderilmelidir.', 400);
  }
  validateNullableUuid(input.branch_id, branchSupplied, 'Şube id');
  validateNullableUuid(input.assigned_user_id, assignedUserSupplied, 'Sorumlu kullanıcı id');

  return {
    action: 'assign',
    student_ids: normalizedIds,
    branchSupplied,
    branch_id: branchSupplied ? input.branch_id as string | null : null,
    assignedUserSupplied,
    assigned_user_id: assignedUserSupplied ? input.assigned_user_id as string | null : null,
  };
}

function rejectUnknownFields(input: Record<string, unknown>, allowedFields: Set<string>): void {
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new SafeError('VALIDATION_ERROR', 'İstek gövdesinde desteklenmeyen alan var.', 400);
  }
}

function validateNullableUuid(value: unknown, supplied: boolean, label: string): void {
  if (!supplied) return;
  if (value !== null && !isUuid(value)) {
    throw new SafeError('VALIDATION_ERROR', `${label} geçerli bir UUID veya null olmalıdır.`, 400);
  }
}

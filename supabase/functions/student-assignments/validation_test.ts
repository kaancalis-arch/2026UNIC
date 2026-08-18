import { SafeError } from '../_shared/safeErrors.ts';
import { assertAssignmentRole, assertAssignScope, parseStudentAssignmentPayload } from './validation.ts';

const ID_1 = '11111111-1111-4111-8111-111111111111';
const ID_2 = '22222222-2222-4222-8222-222222222222';

function expectSafeError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof SafeError && error.code === code) return;
    throw error;
  }
  throw new Error(`Expected SafeError ${code}`);
}

Deno.test('assignment role matrix accepts global admins and branch managers', () => {
  assertAssignmentRole('Super Admin', null);
  assertAssignmentRole('Admin', null);
  assertAssignmentRole('Şube Müdürü', ID_1);
});

Deno.test('assignment role matrix rejects lower roles and branchless managers', () => {
  for (const role of ['Danışman', 'Temsilci', 'Öğrenci Temsilci', 'Öğrenci']) {
    expectSafeError(() => assertAssignmentRole(role, ID_1), 'FORBIDDEN');
  }
  expectSafeError(() => assertAssignmentRole('Şube Müdürü', null), 'FORBIDDEN');
});

Deno.test('assign distinguishes omitted fields from explicit null', () => {
  const payload = parseStudentAssignmentPayload({
    action: 'assign',
    student_ids: [ID_1],
    assigned_user_id: null,
  });
  if (payload.action !== 'assign' || payload.branchSupplied || !payload.assignedUserSupplied) {
    throw new Error('Assignment field presence was not preserved');
  }
});

Deno.test('assignment scope permits admins and blocks branch changes for branch managers', () => {
  const payload = parseStudentAssignmentPayload({
    action: 'assign',
    student_ids: [ID_1],
    branch_id: ID_2,
  });
  if (payload.action !== 'assign') throw new Error('Expected assign payload');
  assertAssignScope('Super Admin', payload);
  assertAssignScope('Admin', payload);
  expectSafeError(() => assertAssignScope('Şube Müdürü', payload), 'FORBIDDEN');
});

Deno.test('assign rejects duplicate, invalid and oversized student ids', () => {
  expectSafeError(() => parseStudentAssignmentPayload({
    action: 'assign', student_ids: [ID_1, ID_1], assigned_user_id: ID_2,
  }), 'VALIDATION_ERROR');
  expectSafeError(() => parseStudentAssignmentPayload({
    action: 'assign', student_ids: ['invalid'], assigned_user_id: ID_2,
  }), 'VALIDATION_ERROR');
  expectSafeError(() => parseStudentAssignmentPayload({
    action: 'assign', student_ids: Array.from({ length: 101 }, (_, index) =>
      `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`), assigned_user_id: ID_2,
  }), 'VALIDATION_ERROR');
});

Deno.test('assign rejects unknown and missing assignment fields', () => {
  expectSafeError(() => parseStudentAssignmentPayload({
    action: 'assign', student_ids: [ID_1], unknown: true,
  }), 'VALIDATION_ERROR');
  expectSafeError(() => parseStudentAssignmentPayload({
    action: 'assign', student_ids: [ID_1],
  }), 'VALIDATION_ERROR');
});

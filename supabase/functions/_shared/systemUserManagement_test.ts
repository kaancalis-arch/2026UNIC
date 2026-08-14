import { assertEquals } from 'jsr:@std/assert@1';
import {
  assertNotSelfTarget,
  canBranchManagerCreateTarget,
  canManageDirectTarget,
  canUpdateTargetFields,
} from './systemUserManagement.ts';

const actor = { id: 'manager', role: 'Şube Müdürü', branch_id: 'branch-a' };
const consultant = {
  id: 'consultant',
  role: 'Danışman',
  branch_id: 'branch-a',
  parent_user_id: actor.id,
  status: 'active',
};

Deno.test('branch actors can only manage direct targets in their branch', () => {
  assertEquals(canManageDirectTarget(actor, { ...actor, parent_user_id: 'admin' }), false);
  assertEquals(canManageDirectTarget(actor, {
    id: 'indirect',
    role: 'Temsilci',
    branch_id: 'branch-a',
    parent_user_id: consultant.id,
  }), false);
  assertEquals(canManageDirectTarget(actor, consultant), true);
  assertEquals(canManageDirectTarget(actor, { ...consultant, branch_id: 'branch-b' }), false);
});

Deno.test('global actors only require a direct target and unknown roles are rejected', () => {
  const admin = { id: 'admin', role: 'Admin', branch_id: null };
  assertEquals(canManageDirectTarget(admin, {
    ...consultant,
    branch_id: 'branch-b',
    parent_user_id: admin.id,
  }), true);
  assertEquals(canManageDirectTarget({ ...actor, role: 'Bilinmeyen Rol' }, consultant), false);
});

Deno.test('self update and delete return explicit 403 errors', () => {
  for (const code of ['SELF_UPDATE_RESTRICTED', 'SELF_DELETE_RESTRICTED'] as const) {
    try {
      assertNotSelfTarget(actor.id, actor.id, code);
      throw new Error('Self target was not rejected');
    } catch (error) {
      assertEquals(error instanceof Error && 'code' in error ? error.code : null, code);
      assertEquals(error instanceof Error && 'status' in error ? error.status : null, 403);
    }
  }
});

Deno.test('branch manager cannot change hierarchy and lower roles can only change status', () => {
  assertEquals(canUpdateTargetFields('Şube Müdürü', ['full_name', 'phone', 'status']), true);
  assertEquals(canUpdateTargetFields('Şube Müdürü', ['role']), false);
  assertEquals(canUpdateTargetFields('Şube Müdürü', ['branch_id']), false);
  assertEquals(canUpdateTargetFields('Şube Müdürü', ['parent_user_id']), false);
  assertEquals(canUpdateTargetFields('Danışman', ['status']), true);
  assertEquals(canUpdateTargetFields('Danışman', ['full_name']), false);
});

Deno.test('branch manager creation stays in the active hierarchy', () => {
  assertEquals(canBranchManagerCreateTarget(actor, consultant, null), true);
  assertEquals(canBranchManagerCreateTarget(actor, {
    role: 'Temsilci',
    branch_id: 'branch-a',
    parent_user_id: actor.id,
  }, null), true);
  assertEquals(canBranchManagerCreateTarget(actor, {
    role: 'Temsilci',
    branch_id: 'branch-a',
    parent_user_id: consultant.id,
  }, consultant), true);
  assertEquals(canBranchManagerCreateTarget(actor, {
    role: 'Temsilci',
    branch_id: 'branch-b',
    parent_user_id: consultant.id,
  }, consultant), false);
  assertEquals(canBranchManagerCreateTarget(actor, {
    role: 'Temsilci',
    branch_id: 'branch-a',
    parent_user_id: consultant.id,
  }, { ...consultant, status: 'passive' }), false);
  assertEquals(canBranchManagerCreateTarget(actor, {
    role: 'Admin',
    branch_id: 'branch-a',
    parent_user_id: actor.id,
  }, null), false);
});

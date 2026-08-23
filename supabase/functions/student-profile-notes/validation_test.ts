import { SafeError } from "../_shared/safeErrors.ts";
import {
  assertNoteMatchesStudent,
  canAccessStudentNotes,
  normalizeNoteText,
  normalizeReminderDate,
  parseStudentProfileNotesPayload,
} from "./validation.ts";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const BRANCH_ID = "44444444-4444-4444-8444-444444444444";
const OTHER_BRANCH_ID = "55555555-5555-4555-8555-555555555555";

const student = {
  id: STUDENT_ID,
  branch_id: BRANCH_ID,
  counselor_id: ACTOR_ID,
};

function expectSafeError(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof SafeError && error.code === code) return;
    throw error;
  }
  throw new Error(`Expected SafeError ${code}`);
}

Deno.test("global administrators can access students", () => {
  for (const role of ["Super Admin", "Admin"]) {
    if (
      !canAccessStudentNotes({ id: ACTOR_ID, role, branch_id: null }, student)
    ) {
      throw new Error(`${role} should have access`);
    }
  }
});

Deno.test("branch manager can access only a student in the same branch", () => {
  const manager = { id: ACTOR_ID, role: "Şube Müdürü", branch_id: BRANCH_ID };
  if (!canAccessStudentNotes(manager, student)) {
    throw new Error("Same-branch manager should have access");
  }
  if (
    canAccessStudentNotes(manager, { ...student, branch_id: OTHER_BRANCH_ID })
  ) {
    throw new Error("Different-branch manager must be rejected");
  }
});

Deno.test("assigned consultants and representatives can access their same-branch student", () => {
  for (const role of ["Danışman", "Temsilci", "Öğrenci Temsilci"]) {
    if (
      !canAccessStudentNotes(
        { id: ACTOR_ID, role, branch_id: BRANCH_ID },
        student,
      )
    ) {
      throw new Error(`${role} should have access to assigned student`);
    }
  }
});

Deno.test("unassigned users, branch mismatches and unknown roles are rejected", () => {
  if (
    canAccessStudentNotes({
      id: OTHER_ID,
      role: "Danışman",
      branch_id: BRANCH_ID,
    }, student)
  ) {
    throw new Error("Unassigned consultant must be rejected");
  }
  if (
    canAccessStudentNotes({
      id: ACTOR_ID,
      role: "Temsilci",
      branch_id: OTHER_BRANCH_ID,
    }, student)
  ) {
    throw new Error("Different-branch representative must be rejected");
  }
  if (
    canAccessStudentNotes({
      id: ACTOR_ID,
      role: "Bilinmeyen",
      branch_id: BRANCH_ID,
    }, student)
  ) {
    throw new Error("Unknown role must be rejected");
  }
});

Deno.test("note validation trims text and rejects empty or oversized notes", () => {
  if (normalizeNoteText("  Takip et  ") !== "Takip et") {
    throw new Error("Note was not trimmed");
  }
  expectSafeError(() => normalizeNoteText("   "), "VALIDATION_ERROR");
  expectSafeError(
    () => normalizeNoteText("a".repeat(2001)),
    "VALIDATION_ERROR",
  );
});

Deno.test("reminder validation accepts real ISO dates and null", () => {
  if (normalizeReminderDate("2028-02-29") !== "2028-02-29") {
    throw new Error("Valid leap date rejected");
  }
  if (normalizeReminderDate(null) !== null) {
    throw new Error("Null reminder rejected");
  }
  for (
    const value of ["2027-02-29", "2026-13-01", "01-01-2026", "", undefined]
  ) {
    expectSafeError(() => normalizeReminderDate(value), "VALIDATION_ERROR");
  }
});

Deno.test("set_completed requires and preserves an explicit completed value", () => {
  const payload = parseStudentProfileNotesPayload({
    operation: "set_completed",
    student_id: STUDENT_ID,
    note_id: OTHER_ID,
    completed: false,
  });
  if (payload.operation !== "set_completed" || payload.completed !== false) {
    throw new Error("Explicit completed value was not preserved");
  }
  expectSafeError(() =>
    parseStudentProfileNotesPayload({
      operation: "set_completed",
      student_id: STUDENT_ID,
      note_id: OTHER_ID,
    }), "VALIDATION_ERROR");
});

Deno.test("a note belonging to another student is rejected", () => {
  assertNoteMatchesStudent({ student_id: STUDENT_ID }, STUDENT_ID);
  expectSafeError(
    () => assertNoteMatchesStudent({ student_id: OTHER_ID }, STUDENT_ID),
    "TARGET_NOT_FOUND",
  );
});

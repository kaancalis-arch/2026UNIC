import { SafeError } from "../_shared/safeErrors.ts";
import { isUuid } from "../_shared/userHierarchy.ts";

export type StudentNoteActor = {
  id: string;
  role: string;
  branch_id: string | null;
};

export type StudentNoteTarget = {
  id: string;
  branch_id: string | null;
  counselor_id: string | null;
};

export type StudentProfileNotesPayload =
  | { operation: "list_notes"; student_id: string }
  | { operation: "create_note"; student_id: string; text: string }
  | {
    operation: "set_completed";
    student_id: string;
    note_id: string;
    completed: boolean;
  }
  | {
    operation: "set_reminder_date";
    student_id: string;
    reminder_date: string | null;
  };

const operationFields: Record<
  StudentProfileNotesPayload["operation"],
  Set<string>
> = {
  list_notes: new Set(["operation", "student_id"]),
  create_note: new Set(["operation", "student_id", "text"]),
  set_completed: new Set(["operation", "student_id", "note_id", "completed"]),
  set_reminder_date: new Set(["operation", "student_id", "reminder_date"]),
};

export function canAccessStudentNotes(
  actor: StudentNoteActor,
  student: StudentNoteTarget,
): boolean {
  if (!student.branch_id) return false;
  if (actor.role === "Super Admin" || actor.role === "Admin") return true;
  if (!actor.branch_id || actor.branch_id !== student.branch_id) return false;
  if (actor.role === "Şube Müdürü") return true;
  if (["Danışman", "Temsilci", "Öğrenci Temsilci"].includes(actor.role)) {
    return student.counselor_id === actor.id;
  }
  return false;
}

export function normalizeNoteText(value: unknown): string {
  if (typeof value !== "string") {
    throw new SafeError(
      "VALIDATION_ERROR",
      "Not metni metin biçiminde olmalıdır.",
      400,
    );
  }
  const text = value.trim();
  if (!text || [...text].length > 2000) {
    throw new SafeError(
      "VALIDATION_ERROR",
      "Not metni 1 ile 2000 karakter arasında olmalıdır.",
      400,
    );
  }
  return text;
}

export function normalizeReminderDate(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || !isRealIsoDate(value)) {
    throw new SafeError(
      "VALIDATION_ERROR",
      "Hatırlatma tarihi geçerli bir YYYY-MM-DD tarihi veya null olmalıdır.",
      400,
    );
  }
  return value;
}

export function assertNoteMatchesStudent(
  note: { student_id: string },
  studentId: string,
): void {
  if (note.student_id !== studentId) {
    throw new SafeError("TARGET_NOT_FOUND", "Not bulunamadı.", 404);
  }
}

export function parseStudentProfileNotesPayload(
  value: unknown,
): StudentProfileNotesPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SafeError("VALIDATION_ERROR", "Geçersiz istek gövdesi.", 400);
  }

  const input = value as Record<string, unknown>;
  if (!isOperation(input.operation)) {
    throw new SafeError("VALIDATION_ERROR", "Geçersiz işlem türü.", 400);
  }
  rejectUnknownFields(input, operationFields[input.operation]);
  const studentId = requiredUuid(input.student_id, "Öğrenci id");

  if (input.operation === "list_notes") {
    return { operation: input.operation, student_id: studentId };
  }
  if (input.operation === "create_note") {
    return {
      operation: input.operation,
      student_id: studentId,
      text: normalizeNoteText(input.text),
    };
  }
  if (input.operation === "set_completed") {
    if (typeof input.completed !== "boolean") {
      throw new SafeError(
        "VALIDATION_ERROR",
        "Tamamlanma durumu açıkça true veya false olmalıdır.",
        400,
      );
    }
    return {
      operation: input.operation,
      student_id: studentId,
      note_id: requiredUuid(input.note_id, "Not id"),
      completed: input.completed,
    };
  }
  return {
    operation: input.operation,
    student_id: studentId,
    reminder_date: normalizeReminderDate(input.reminder_date),
  };
}

function isOperation(
  value: unknown,
): value is StudentProfileNotesPayload["operation"] {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(operationFields, value);
}

function requiredUuid(value: unknown, label: string): string {
  if (!isUuid(value)) {
    throw new SafeError(
      "VALIDATION_ERROR",
      `${label} geçerli bir UUID olmalıdır.`,
      400,
    );
  }
  return value.toLowerCase();
}

function rejectUnknownFields(
  input: Record<string, unknown>,
  allowedFields: Set<string>,
): void {
  if (Object.keys(input).some((field) => !allowedFields.has(field))) {
    throw new SafeError(
      "VALIDATION_ERROR",
      "İstek gövdesinde desteklenmeyen alan var.",
      400,
    );
  }
}

function isRealIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(`${value}T00:00:00Z`);
  return Number(year) > 0 && !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day);
}

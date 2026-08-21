import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  type AuthenticatedActor,
  authorizeAuthenticatedActor,
} from "../_shared/authorization.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import {
  errorResponse,
  jsonResponse,
  SafeError,
} from "../_shared/safeErrors.ts";
import {
  canAccessStudentNotes,
  parseStudentProfileNotesPayload,
  type StudentNoteTarget,
  type StudentProfileNotesPayload,
} from "./validation.ts";

type AdminClient = any;

const MAX_BODY_BYTES = 10_000;
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const headers = corsHeaders(req);

  if (req.method !== "POST") {
    return errorResponse(
      new SafeError(
        "METHOD_NOT_ALLOWED",
        "Yalnız POST metodu desteklenir.",
        405,
      ),
      headers,
    );
  }

  try {
    const admin = createAdminClient();
    const actor = await authorizeAuthenticatedActor(admin, req);
    const payload = parseStudentProfileNotesPayload(await readBody(req));
    const student = await authorizeStudent(admin, actor, payload.student_id);
    const result = await handleOperation(admin, actor, student, payload);
    return jsonResponse({ success: true, ...result }, 200, headers);
  } catch (error) {
    return errorResponse(error, headers);
  }
});

function createAdminClient(): AdminClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new SafeError(
      "CONFIGURATION_ERROR",
      "Sunucu yapılandırması eksik.",
      500,
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function readBody(req: Request): Promise<unknown> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new SafeError(
      "PAYLOAD_TOO_LARGE",
      "İstek gövdesi en fazla 10KB olabilir.",
      413,
    );
  }
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new SafeError(
      "PAYLOAD_TOO_LARGE",
      "İstek gövdesi en fazla 10KB olabilir.",
      413,
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Öğrenci profil notu istek gövdesi ayrıştırılamadı:", error);
    throw new SafeError(
      "INVALID_JSON",
      "Geçerli bir JSON istek gövdesi gönderilmelidir.",
      400,
    );
  }
}

async function authorizeStudent(
  admin: AdminClient,
  actor: AuthenticatedActor,
  studentId: string,
): Promise<StudentNoteTarget & { branch_id: string }> {
  const { data: student, error } = await admin
    .from("student_profiles")
    .select("id, branch_id, counselor_id")
    .eq("id", studentId)
    .maybeSingle();
  if (error) {
    internalFailure("Öğrenci profil notu erişimi doğrulanamadı", error);
  }
  if (!student) {
    throw new SafeError("STUDENT_NOT_FOUND", "Öğrenci bulunamadı.", 404);
  }
  if (!student.branch_id) {
    throw new SafeError(
      "FORBIDDEN",
      "Öğrencinin aktif bir şubesi bulunmuyor.",
      403,
    );
  }

  const { data: branch, error: branchError } = await admin
    .from("branches")
    .select("id")
    .eq("id", student.branch_id)
    .eq("status", "active")
    .maybeSingle();
  if (branchError) internalFailure("Öğrenci şubesi doğrulanamadı", branchError);
  if (!branch || !canAccessStudentNotes(actor, student)) {
    throw new SafeError(
      "FORBIDDEN",
      "Bu öğrenci için not ve hatırlatma erişiminiz bulunmuyor.",
      403,
    );
  }
  return student as StudentNoteTarget & { branch_id: string };
}

async function handleOperation(
  admin: AdminClient,
  actor: AuthenticatedActor,
  student: StudentNoteTarget & { branch_id: string },
  payload: StudentProfileNotesPayload,
): Promise<Record<string, unknown>> {
  switch (payload.operation) {
    case "list_notes":
      return listNotes(admin, actor, student.id);
    case "create_note":
      return createNote(admin, actor, student.id, payload.text);
    case "set_completed":
      return setCompleted(
        admin,
        actor,
        student.id,
        payload.note_id,
        payload.completed,
      );
    case "set_reminder_date":
      return setReminderDate(admin, actor, student.id, payload.reminder_date);
  }
}

async function listNotes(
  admin: AdminClient,
  actor: AuthenticatedActor,
  studentId: string,
): Promise<{ notes: unknown[] }> {
  const { data, error } = await admin
    .rpc("list_student_profile_notes_secure", {
      p_actor_user_id: actor.id,
      p_student_id: studentId,
    });
  if (error) throw mapRpcError("Öğrenci profil notları listelenemedi", error);
  return { notes: data ?? [] };
}

async function createNote(
  admin: AdminClient,
  actor: AuthenticatedActor,
  studentId: string,
  text: string,
): Promise<{ note: unknown }> {
  const { data, error } = await admin
    .rpc("create_student_profile_note_secure", {
      p_actor_user_id: actor.id,
      p_student_id: studentId,
      p_text: text,
    })
    .single();
  if (error) throw mapRpcError("Öğrenci profil notu oluşturulamadı", error);
  if (!data) throw new SafeError("INTERNAL_ERROR", "Not oluşturulamadı.", 500);
  return { note: data };
}

async function setCompleted(
  admin: AdminClient,
  actor: AuthenticatedActor,
  studentId: string,
  noteId: string,
  completed: boolean,
): Promise<{ note: unknown }> {
  const { data, error } = await admin
    .rpc("set_student_profile_note_completed_secure", {
      p_actor_user_id: actor.id,
      p_student_id: studentId,
      p_note_id: noteId,
      p_completed: completed,
    })
    .single();
  if (error) throw mapRpcError("Öğrenci profil notu güncellenemedi", error);
  if (!data) throw new SafeError("INTERNAL_ERROR", "Not güncellenemedi.", 500);
  return { note: data };
}

async function setReminderDate(
  admin: AdminClient,
  actor: AuthenticatedActor,
  studentId: string,
  reminderDate: string | null,
): Promise<{ reminder_date: string | null }> {
  const { data, error } = await admin.rpc(
    "set_student_profile_reminder_date_secure",
    {
      p_actor_user_id: actor.id,
      p_student_id: studentId,
      p_reminder_date: reminderDate,
    },
  );
  if (error) {
    throw mapRpcError("Öğrenci hatırlatma tarihi güncellenemedi", error);
  }
  if (data !== null && typeof data !== "string") {
    throw new SafeError(
      "INTERNAL_ERROR",
      "Hatırlatma tarihi güncellenemedi.",
      500,
    );
  }
  return { reminder_date: data };
}

function mapRpcError(
  context: string,
  error: { message?: string; details?: string },
): SafeError {
  console.error(`${context}:`, error);
  const detail = `${error.message ?? ""} ${error.details ?? ""}`;
  if (/PROFILE_NOTES_FORBIDDEN/.test(detail)) {
    return new SafeError(
      "FORBIDDEN",
      "Bu öğrenci için işlem yetkiniz bulunmuyor.",
      403,
    );
  }
  if (/PROFILE_NOTES_STUDENT_NOT_FOUND/.test(detail)) {
    return new SafeError("STUDENT_NOT_FOUND", "Öğrenci bulunamadı.", 404);
  }
  if (/PROFILE_NOTES_NOTE_NOT_FOUND/.test(detail)) {
    return new SafeError("TARGET_NOT_FOUND", "Not bulunamadı.", 404);
  }
  if (
    /PROFILE_NOTES_INVALID_TEXT|PROFILE_NOTES_INVALID_COMPLETION/.test(detail)
  ) {
    return new SafeError("VALIDATION_ERROR", "Not bilgisi geçersiz.", 400);
  }
  return new SafeError(
    "INTERNAL_ERROR",
    "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
    500,
  );
}

function internalFailure(context: string, error: unknown): never {
  console.error(`${context}:`, error);
  throw new SafeError(
    "INTERNAL_ERROR",
    "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
    500,
  );
}

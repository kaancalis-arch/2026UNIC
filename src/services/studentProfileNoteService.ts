import { FunctionsHttpError } from '@supabase/supabase-js';
import type { StudentProfileNote } from '../types';
import { supabase } from './supabaseClient';

type EdgeNote = {
  id: string;
  student_id: string;
  text: string;
  completed: boolean;
  author_id: string;
  author_name: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  completed_by: string | null;
};

type EdgeResponse = {
  success?: boolean;
  code?: string;
  notes?: unknown[];
  note?: unknown;
  reminder_date?: unknown;
};

const EDGE_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  INVALID_TOKEN: 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.',
  ACTOR_INACTIVE: 'Hesabınız aktif olmadığı için bu işlemi yapamazsınız.',
  FORBIDDEN: 'Bu öğrenci için not ve hatırlatma yetkiniz bulunmuyor.',
  VALIDATION_ERROR: 'Not veya hatırlatma bilgisi geçersiz.',
  STUDENT_NOT_FOUND: 'Öğrenci bulunamadı.',
  TARGET_NOT_FOUND: 'Not bulunamadı veya başka bir öğrenciye ait.',
  CONFLICT: 'Kayıt başka bir işlem nedeniyle güncellenemedi. Listeyi yenileyin.',
  INTERNAL_ERROR: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.',
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
  throw new Error((body?.code && EDGE_ERROR_MESSAGES[body.code]) || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.');
}

async function invoke(body: Record<string, unknown>): Promise<EdgeResponse> {
  const token = await requireAccessToken();
  const { data, error } = await supabase.functions.invoke('student-profile-notes', {
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (error || !data?.success) await parseEdgeError(error, data);
  return data as EdgeResponse;
}

function isEdgeNote(value: unknown): value is EdgeNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === 'string' && typeof note.student_id === 'string' &&
    typeof note.text === 'string' && typeof note.completed === 'boolean' &&
    typeof note.author_id === 'string' && typeof note.author_name === 'string' &&
    typeof note.created_at === 'string' && typeof note.updated_at === 'string' &&
    (note.completed_at === null || typeof note.completed_at === 'string') &&
    (note.completed_by === null || typeof note.completed_by === 'string');
}

function mapNote(note: EdgeNote): StudentProfileNote {
  return {
    id: note.id,
    studentId: note.student_id,
    text: note.text,
    completed: note.completed,
    authorId: note.author_id,
    authorName: note.author_name,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    completedAt: note.completed_at,
    completedBy: note.completed_by,
  };
}

function requireNote(value: unknown): StudentProfileNote {
  if (!isEdgeNote(value)) throw new Error('Not yanıtı doğrulanamadı. Listeyi yenileyin.');
  return mapNote(value);
}

export const studentProfileNoteService = {
  async list(studentId: string): Promise<StudentProfileNote[]> {
    const response = await invoke({ operation: 'list_notes', student_id: studentId });
    if (!Array.isArray(response.notes) || !response.notes.every(isEdgeNote)) {
      throw new Error('Notlar güvenli biçimde yüklenemedi.');
    }
    return response.notes.map(mapNote);
  },

  async create(studentId: string, text: string): Promise<StudentProfileNote> {
    const response = await invoke({ operation: 'create_note', student_id: studentId, text });
    return requireNote(response.note);
  },

  async setCompleted(studentId: string, noteId: string, completed: boolean): Promise<StudentProfileNote> {
    const response = await invoke({
      operation: 'set_completed', student_id: studentId, note_id: noteId, completed,
    });
    return requireNote(response.note);
  },

  async setReminderDate(studentId: string, reminderDate: string | null): Promise<string | null> {
    const response = await invoke({
      operation: 'set_reminder_date', student_id: studentId, reminder_date: reminderDate,
    });
    if (response.reminder_date !== null && typeof response.reminder_date !== 'string') {
      throw new Error('Hatırlatma tarihi yanıtı doğrulanamadı.');
    }
    return response.reminder_date as string | null;
  },
};

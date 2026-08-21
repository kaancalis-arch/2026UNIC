import type { AuthenticatedActor } from "../_shared/authorization.ts";
import { SafeError } from "../_shared/safeErrors.ts";

export const DRIVE_OPERATION_STALE_MS = 15 * 60 * 1000;

export type DriveSyncStatus =
  | "pending"
  | "processing"
  | "synced"
  | "failed"
  | "deleting";
export type DocumentLifecycleStatus =
  | "uploaded"
  | "approved"
  | "rejected"
  | "archived";

type StudentScope = {
  branch_id: string;
  counselor_id: string | null;
};

export function canAccessStudentDocuments(
  actor: AuthenticatedActor,
  student: StudentScope,
): boolean {
  switch (actor.role) {
    case "Super Admin":
    case "Admin":
      return true;
    case "Şube Müdürü":
      return actor.branch_id === student.branch_id;
    case "Danışman":
    case "Temsilci":
    case "Öğrenci Temsilci":
      return actor.branch_id === student.branch_id &&
        student.counselor_id === actor.id;
    case "Öğrenci":
    default:
      return false;
  }
}

export function assertDriveSyncRetryable(
  driveStatus: unknown,
  documentStatus: unknown,
  driveSyncStartedAt: unknown = null,
  nextRetryAt: unknown = null,
  now = Date.now(),
): asserts driveStatus is "pending" | "failed" | "processing" {
  if (documentStatus === "archived") {
    throw new SafeError(
      "VALIDATION_ERROR",
      "Arşivlenmiş belge Drive ile yeniden eşitlenemez.",
      409,
    );
  }
  if (!["uploaded", "approved", "rejected"].includes(String(documentStatus))) {
    throw new SafeError(
      "VALIDATION_ERROR",
      "Belge durumu Drive eşitlemesi için geçerli değil.",
      409,
    );
  }
  if (driveStatus === "failed") {
    const retryAt = timestamp(nextRetryAt);
    if (retryAt !== null && retryAt > now) {
      throw new SafeError(
        "CONFLICT",
        "Drive eşitlemesi için yeniden deneme süresi henüz dolmadı.",
        409,
      );
    }
    return;
  }
  if (driveStatus === "processing") {
    const startedAt = timestamp(driveSyncStartedAt);
    if (startedAt !== null && startedAt > now - DRIVE_OPERATION_STALE_MS) {
      throw new SafeError(
        "CONFLICT",
        "Belgenin Drive eşitlemesi halen devam ediyor.",
        409,
      );
    }
    return;
  }
  if (driveStatus !== "pending") {
    throw new SafeError(
      "CONFLICT",
      "Belge Drive eşitlemesi için bekleyen veya hatalı durumda değil.",
      409,
    );
  }
}

export function canArchiveDriveStatus(driveStatus: unknown): boolean {
  return driveStatus === "pending" || driveStatus === "failed" ||
    driveStatus === "synced";
}

export function assertDriveDeleteClaimed(outcome: unknown): void {
  if (outcome === "claimed" || outcome === "not_found") return;
  if (outcome === "active_processing") {
    throw new SafeError(
      "CONFLICT",
      "Drive eşitlemesi devam ederken belge kalıcı olarak silinemez.",
      409,
    );
  }
  if (outcome === "active_deleting") {
    throw new SafeError(
      "CONFLICT",
      "Belgenin kalıcı silme işlemi halen devam ediyor.",
      409,
    );
  }
  throw new SafeError(
    "CONFLICT",
    "Belge kalıcı silme için claim edilemedi.",
    409,
  );
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import type { AuthenticatedActor } from "../_shared/authorization.ts";
import { SafeError } from "../_shared/safeErrors.ts";
import {
  assertDriveDeleteClaimed,
  assertDriveSyncRetryable,
  canAccessStudentDocuments,
  canArchiveDriveStatus,
  DRIVE_OPERATION_STALE_MS,
} from "./driveSyncPolicy.ts";

const actor = (values: Partial<AuthenticatedActor>): AuthenticatedActor => ({
  id: "11111111-1111-4111-8111-111111111111",
  role: "Danışman",
  branch_id: "22222222-2222-4222-8222-222222222222",
  status: "active",
  ...values,
});

Deno.test("failed and pending Drive documents are retryable", () => {
  assertDriveSyncRetryable("failed", "uploaded");
  assertDriveSyncRetryable("pending", "approved");
  assertDriveSyncRetryable("failed", "rejected");
});

Deno.test("archived Drive document retry is rejected", () => {
  const error = assertThrows(
    () => assertDriveSyncRetryable("failed", "archived"),
    SafeError,
  );
  assertEquals(error.code, "VALIDATION_ERROR");
  assertEquals(error.status, 409);
});

Deno.test("student document access follows role, branch, and assignment scope", () => {
  const student = { branch_id: "branch-a", counselor_id: "counselor-a" };
  for (const role of ["Super Admin", "Admin"] as const) {
    assertEquals(
      canAccessStudentDocuments(actor({ role, branch_id: null }), student),
      true,
    );
  }
  assertEquals(
    canAccessStudentDocuments(
      actor({ role: "Şube Müdürü", branch_id: "branch-a" }),
      student,
    ),
    true,
  );
  assertEquals(
    canAccessStudentDocuments(
      actor({ role: "Şube Müdürü", branch_id: "branch-b" }),
      student,
    ),
    false,
  );
  for (const role of ["Danışman", "Temsilci", "Öğrenci Temsilci"] as const) {
    assertEquals(
      canAccessStudentDocuments(
        actor({ role, id: "counselor-a", branch_id: "branch-a" }),
        student,
      ),
      true,
    );
    assertEquals(
      canAccessStudentDocuments(
        actor({ role, id: "counselor-b", branch_id: "branch-a" }),
        student,
      ),
      false,
    );
    assertEquals(
      canAccessStudentDocuments(
        actor({ role, id: "counselor-a", branch_id: "branch-b" }),
        student,
      ),
      false,
    );
  }
  assertEquals(
    canAccessStudentDocuments(
      actor({ role: "Öğrenci", id: "counselor-a" }),
      student,
    ),
    false,
  );
});

Deno.test("active processing cannot be retried but stale processing can", () => {
  const now = Date.parse("2026-08-21T12:30:00.000Z");
  const error = assertThrows(
    () =>
      assertDriveSyncRetryable(
        "processing",
        "uploaded",
        new Date(now - DRIVE_OPERATION_STALE_MS + 1).toISOString(),
        null,
        now,
      ),
    SafeError,
  );
  assertEquals(error.code, "CONFLICT");
  assertEquals(error.status, 409);

  assertDriveSyncRetryable(
    "processing",
    "uploaded",
    new Date(now - DRIVE_OPERATION_STALE_MS).toISOString(),
    null,
    now,
  );
  assertDriveSyncRetryable("processing", "uploaded", null, null, now);
});

Deno.test("failed Drive retry honors backoff before and after expiry", () => {
  const now = Date.parse("2026-08-21T12:30:00.000Z");
  const error = assertThrows(
    () =>
      assertDriveSyncRetryable(
        "failed",
        "uploaded",
        null,
        new Date(now + 1).toISOString(),
        now,
      ),
    SafeError,
  );
  assertEquals(error.code, "CONFLICT");
  assertEquals(error.status, 409);

  assertDriveSyncRetryable(
    "failed",
    "uploaded",
    null,
    new Date(now).toISOString(),
    now,
  );
});

Deno.test("archive policy rejects processing and deleting races", () => {
  assertEquals(canArchiveDriveStatus("pending"), true);
  assertEquals(canArchiveDriveStatus("failed"), true);
  assertEquals(canArchiveDriveStatus("synced"), true);
  assertEquals(canArchiveDriveStatus("processing"), false);
  assertEquals(canArchiveDriveStatus("deleting"), false);
});

Deno.test("permanent delete rejects active sync and delete claims", () => {
  for (const outcome of ["active_processing", "active_deleting"]) {
    const error = assertThrows(
      () => assertDriveDeleteClaimed(outcome),
      SafeError,
    );
    assertEquals(error.code, "CONFLICT");
    assertEquals(error.status, 409);
  }
  assertDriveDeleteClaimed("claimed");
  assertDriveDeleteClaimed("not_found");
});

Deno.test("unknown Drive and document states fail closed", () => {
  for (
    const [driveStatus, documentStatus] of [
      ["unknown", "uploaded"],
      [
        "failed",
        "unknown",
      ],
      ["synced", "uploaded"],
      ["deleting", "uploaded"],
    ]
  ) {
    const error = assertThrows(
      () => assertDriveSyncRetryable(driveStatus, documentStatus),
      SafeError,
    );
    assertEquals(error.status, 409);
  }
});

import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "jsr:@std/assert@1";
import {
  buildDriveFileName,
  deleteFileFromGoogleDrive,
  GoogleDriveError,
  mirrorFileToGoogleDrive,
  sanitizeDriveFileName,
} from "./googleDrive.ts";

const ENVIRONMENT: Record<string, string> = {
  GOOGLE_DRIVE_CLIENT_ID: "client-id",
  GOOGLE_DRIVE_CLIENT_SECRET: "client-secret",
  GOOGLE_DRIVE_REFRESH_TOKEN: "refresh-token",
  GOOGLE_DRIVE_FOLDER_ID: "folder-id",
};

const INPUT = {
  studentDocumentId: "11111111-1111-4111-8111-111111111111",
  studentId: "22222222-2222-4222-8222-222222222222",
  branchId: "33333333-3333-4333-8333-333333333333",
  checksumSha256: "a".repeat(64),
  studentFirstName: "Çağrı",
  studentLastName: "Şen",
  documentName: "Öğrenci Belgesi",
  extension: "pdf",
  mimeType: "application/pdf",
  bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
};

const getEnv = (name: string) => ENVIRONMENT[name];
const json = (value: unknown, status = 200) => Response.json(value, { status });

Deno.test("Drive file name sanitization replaces forbidden and control characters", () => {
  assertEquals(
    sanitizeDriveFileName('  A/B\\C:D*E?F"G<H>I|J\u0000  '),
    "A_B_C_D_E_F_G_H_I_J_",
  );
  assertEquals(
    buildDriveFileName("Ali", "Veli", "Transkript/Not", "PDF"),
    "Ali_Veli_Transkript_Not.pdf",
  );
});

Deno.test("Drive file name preserves Turkish characters and applies a safe maximum", () => {
  const name = buildDriveFileName(
    "Çağrı",
    "Şenoğlu",
    `Öğrenci${"ğ".repeat(300)}`,
    "pdf",
  );
  assertStringIncludes(name, "Çağrı_Şenoğlu_Öğrenci");
  assertEquals(Array.from(name).length, 180);
});

Deno.test("Drive mirror returns an existing idempotent file without uploading", async () => {
  const calls: string[] = [];
  const result = await mirrorFileToGoogleDrive(INPUT, {
    getEnv,
    fetch: async (request) => {
      const url = String(request);
      calls.push(url);
      if (url.includes("oauth2")) {
        return json({
          access_token: "access",
          scope: "https://www.googleapis.com/auth/drive.file",
        });
      }
      return json({
        files: [{
          id: "existing-id",
          name: "Mevcut.pdf",
          appProperties: { checksum_sha256: INPUT.checksumSha256 },
        }],
      });
    },
  });
  assertEquals(result, {
    id: "existing-id",
    name: "Mevcut.pdf",
    existing: true,
  });
  assertEquals(calls.length, 2);
});

Deno.test("Drive mirror performs a multipart upload after an empty lookup", async () => {
  let uploadBody = "";
  const result = await mirrorFileToGoogleDrive(INPUT, {
    getEnv,
    fetch: async (request, init) => {
      const url = String(request);
      if (url.includes("oauth2")) {
        return json({
          access_token: "access",
          scope: "https://www.googleapis.com/auth/drive.file",
        });
      }
      if (!url.includes("/upload/")) return json({ files: [] });
      uploadBody = await (init?.body as Blob).text();
      return json({ id: "uploaded-id", name: "Çağrı_Şen_Öğrenci Belgesi.pdf" });
    },
  });
  assertEquals(result.existing, false);
  assertStringIncludes(uploadBody, "student_document_id");
  assertStringIncludes(uploadBody, INPUT.studentDocumentId);
});

Deno.test("Drive token and upload failures expose only a safe error classification", async () => {
  await assertRejects(
    () =>
      mirrorFileToGoogleDrive(INPUT, {
        getEnv,
        fetch: async () => json({ provider_secret: "hidden" }, 401),
      }),
    GoogleDriveError,
    "token",
  );

  await assertRejects(
    () =>
      mirrorFileToGoogleDrive(INPUT, {
        getEnv,
        fetch: async () => json({ access_token: "broad-or-unknown" }),
      }),
    GoogleDriveError,
    "token",
  );

  await assertRejects(
    () =>
      mirrorFileToGoogleDrive(INPUT, {
        getEnv,
        fetch: async (request) => {
          const url = String(request);
          if (url.includes("oauth2")) {
            return json({
              access_token: "access",
              scope: "https://www.googleapis.com/auth/drive.file",
            });
          }
          if (!url.includes("/upload/")) return json({ files: [] });
          return json({ provider_detail: "hidden" }, 500);
        },
      }),
    GoogleDriveError,
    "upload",
  );
});

Deno.test("malformed Drive responses retain their operation classification", async () => {
  await assertRejects(
    () =>
      mirrorFileToGoogleDrive(INPUT, {
        getEnv,
        fetch: async () => new Response("not-json"),
      }),
    GoogleDriveError,
    "token",
  );

  await assertRejects(
    () =>
      mirrorFileToGoogleDrive(INPUT, {
        getEnv,
        fetch: async (request) => {
          if (String(request).includes("oauth2")) {
            return json({
              access_token: "access",
              scope: "https://www.googleapis.com/auth/drive.file",
            });
          }
          return new Response("not-json");
        },
      }),
    GoogleDriveError,
    "lookup",
  );
});

Deno.test("OAuth refresh omits scope and rejects additional granted scopes", async () => {
  let tokenBody = "";
  await mirrorFileToGoogleDrive(INPUT, {
    getEnv,
    fetch: async (request, init) => {
      if (String(request).includes("oauth2")) {
        tokenBody = String(init?.body);
        return json({
          access_token: "access",
          scope: "https://www.googleapis.com/auth/drive.file",
        });
      }
      if (String(request).includes("/upload/")) {
        return json({ id: "uploaded-id", name: "Uploaded.pdf" });
      }
      return json({ files: [] });
    },
  });
  assertEquals(new URLSearchParams(tokenBody).has("scope"), false);

  await assertRejects(
    () =>
      mirrorFileToGoogleDrive(INPUT, {
        getEnv,
        fetch: async () =>
          json({
            access_token: "access",
            scope:
              "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive",
          }),
      }),
    GoogleDriveError,
    "token",
  );
});

Deno.test("existing Drive mirror requires a matching checksum", async () => {
  await assertRejects(
    () =>
      mirrorFileToGoogleDrive(INPUT, {
        getEnv,
        fetch: async (request) => {
          if (String(request).includes("oauth2")) {
            return json({
              access_token: "access",
              scope: "https://www.googleapis.com/auth/drive.file",
            });
          }
          return json({
            files: [{
              id: "existing-id",
              name: "Mevcut.pdf",
              appProperties: { checksum_sha256: "b".repeat(64) },
            }],
          });
        },
      }),
    GoogleDriveError,
    "consistency",
  );
});

Deno.test("multiple Drive mirrors fail consistency instead of selecting one", async () => {
  await assertRejects(
    () =>
      mirrorFileToGoogleDrive(INPUT, {
        getEnv,
        fetch: async (request) => {
          if (String(request).includes("oauth2")) {
            return json({
              access_token: "access",
              scope: "https://www.googleapis.com/auth/drive.file",
            });
          }
          return json({
            files: [
              { id: "first", name: "First.pdf" },
              { id: "second", name: "Second.pdf" },
            ],
          });
        },
      }),
    GoogleDriveError,
    "consistency",
  );
});

Deno.test("Drive delete uses stored id and treats 404 as already absent", async () => {
  const calls: Array<{ url: string; method?: string }> = [];
  const result = await deleteFileFromGoogleDrive({
    studentDocumentId: INPUT.studentDocumentId,
    driveFileId: "stored-drive-id",
  }, {
    getEnv,
    fetch: async (request, init) => {
      const url = String(request);
      calls.push({ url, method: init?.method });
      if (url.includes("oauth2")) {
        return json({
          access_token: "access",
          scope: "https://www.googleapis.com/auth/drive.file",
        });
      }
      return new Response(null, { status: 404 });
    },
  });
  assertEquals(result, { alreadyAbsent: true });
  assertEquals(calls.length, 2);
  assertStringIncludes(calls[1].url, "stored-drive-id");
  assertEquals(calls[1].method, "DELETE");
});

Deno.test("orphan Drive delete looks up appProperty and removes the file", async () => {
  const calls: string[] = [];
  const result = await deleteFileFromGoogleDrive({
    studentDocumentId: INPUT.studentDocumentId,
  }, {
    getEnv,
    fetch: async (request, init) => {
      const url = String(request);
      calls.push(`${init?.method || "GET"} ${url}`);
      if (url.includes("oauth2")) {
        return json({
          access_token: "access",
          scope: "https://www.googleapis.com/auth/drive.file",
        });
      }
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return json({
        files: [{ id: "orphan-id", name: "Orphan.pdf" }],
      });
    },
  });
  assertEquals(result, { alreadyAbsent: false });
  assertEquals(calls.length, 3);
  assertStringIncludes(calls[1], "student_document_id");
  assertStringIncludes(calls[2], "orphan-id");
});

Deno.test("Drive delete failure remains safe and blocks local cleanup", async () => {
  await assertRejects(
    () =>
      deleteFileFromGoogleDrive({
        studentDocumentId: INPUT.studentDocumentId,
        driveFileId: "stored-drive-id",
      }, {
        getEnv,
        fetch: async (request) => {
          if (String(request).includes("oauth2")) {
            return json({
              access_token: "access",
              scope: "https://www.googleapis.com/auth/drive.file",
            });
          }
          return json({ provider_secret: "hidden" }, 503);
        },
      }),
    GoogleDriveError,
    "delete",
  );
});

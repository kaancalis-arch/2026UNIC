const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const MAX_DRIVE_FILE_NAME_LENGTH = 180;
const GOOGLE_REQUEST_TIMEOUT_MS = 20_000;

type DriveErrorCode =
  | "configuration"
  | "invalid_input"
  | "token"
  | "lookup"
  | "upload"
  | "delete"
  | "consistency";

export class GoogleDriveError extends Error {
  readonly safeMessage = "Drive senkronizasyonu tamamlanamadı.";

  constructor(public readonly code: DriveErrorCode) {
    super(`Google Drive operation failed: ${code}`);
    this.name = "GoogleDriveError";
  }
}

export type GoogleDriveUploadInput = {
  studentDocumentId: string;
  studentId: string;
  branchId: string;
  checksumSha256: string;
  studentFirstName: string;
  studentLastName: string;
  documentName: string;
  extension: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type GoogleDriveFile = {
  id: string;
  name: string;
  existing: boolean;
};

export type GoogleDriveDeleteInput = {
  studentDocumentId: string;
  driveFileId?: string | null;
};

type GoogleDriveDependencies = {
  fetch?: typeof fetch;
  getEnv?: (name: string) => string | undefined;
};

type DriveConfiguration = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
};

export function sanitizeDriveFileName(
  value: string,
  maximumLength = MAX_DRIVE_FILE_NAME_LENGTH,
): string {
  if (!Number.isInteger(maximumLength) || maximumLength < 1) {
    throw new GoogleDriveError("invalid_input");
  }
  const sanitized = value.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_")
    .trim();
  if (!sanitized) throw new GoogleDriveError("invalid_input");
  return Array.from(sanitized).slice(0, maximumLength).join("");
}

export function buildDriveFileName(
  studentFirstName: string,
  studentLastName: string,
  documentName: string,
  extension: string,
): string {
  const firstName = sanitizeRequiredPart(studentFirstName);
  const lastName = sanitizeRequiredPart(studentLastName);
  const definitionName = sanitizeRequiredPart(documentName);
  const normalizedExtension = extension.trim().toLocaleLowerCase("en-US");
  if (!/^[a-z0-9]{2,5}$/.test(normalizedExtension)) {
    throw new GoogleDriveError("invalid_input");
  }

  const suffix = `.${normalizedExtension}`;
  const maximumBaseLength = MAX_DRIVE_FILE_NAME_LENGTH - suffix.length;
  const base = sanitizeDriveFileName(
    `${firstName}_${lastName}_${definitionName}`,
    maximumBaseLength,
  );
  return `${base}${suffix}`;
}

export async function mirrorFileToGoogleDrive(
  input: GoogleDriveUploadInput,
  dependencies: GoogleDriveDependencies = {},
): Promise<GoogleDriveFile> {
  assertUploadInput(input);
  const configuration = readConfiguration(
    dependencies.getEnv ?? ((name) => Deno.env.get(name)),
  );
  const request = dependencies.fetch ?? fetch;
  const accessToken = await getAccessToken(configuration, request);
  const existing = await findExistingFile(
    input.studentDocumentId,
    input.checksumSha256,
    accessToken,
    request,
  );
  if (existing) {
    return { id: existing.id, name: existing.name, existing: true };
  }

  const name = buildDriveFileName(
    input.studentFirstName,
    input.studentLastName,
    input.documentName,
    input.extension,
  );
  return await uploadFile(
    input,
    name,
    configuration.folderId,
    accessToken,
    request,
  );
}

export async function deleteFileFromGoogleDrive(
  input: GoogleDriveDeleteInput,
  dependencies: GoogleDriveDependencies = {},
): Promise<{ alreadyAbsent: boolean }> {
  if (
    typeof input.studentDocumentId !== "string" ||
    !input.studentDocumentId.trim() ||
    (input.driveFileId !== undefined && input.driveFileId !== null &&
      (typeof input.driveFileId !== "string" || !input.driveFileId.trim()))
  ) {
    throw new GoogleDriveError("invalid_input");
  }

  const configuration = readConfiguration(
    dependencies.getEnv ?? ((name) => Deno.env.get(name)),
  );
  const request = dependencies.fetch ?? fetch;
  const accessToken = await getAccessToken(configuration, request);
  const fileId = input.driveFileId?.trim() ||
    (await findExistingFile(
      input.studentDocumentId,
      null,
      accessToken,
      request,
    ))?.id;
  if (!fileId) return { alreadyAbsent: true };

  let response: Response;
  try {
    response = await timedFetch(
      request,
      `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  } catch {
    throw new GoogleDriveError("delete");
  }
  if (response.status === 404) return { alreadyAbsent: true };
  if (!response.ok) throw new GoogleDriveError("delete");
  return { alreadyAbsent: false };
}

function sanitizeRequiredPart(value: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new GoogleDriveError("invalid_input");
  }
  return sanitizeDriveFileName(value);
}

function assertUploadInput(input: GoogleDriveUploadInput): void {
  for (
    const value of [
      input.studentDocumentId,
      input.studentId,
      input.branchId,
      input.checksumSha256,
    ]
  ) {
    if (typeof value !== "string" || !value.trim()) {
      throw new GoogleDriveError("invalid_input");
    }
  }
  if (
    typeof input.mimeType !== "string" || !input.mimeType.trim() ||
    input.bytes.length < 1
  ) {
    throw new GoogleDriveError("invalid_input");
  }
  buildDriveFileName(
    input.studentFirstName,
    input.studentLastName,
    input.documentName,
    input.extension,
  );
}

function readConfiguration(
  getEnv: (name: string) => string | undefined,
): DriveConfiguration {
  const values = {
    clientId: getEnv("GOOGLE_DRIVE_CLIENT_ID")?.trim(),
    clientSecret: getEnv("GOOGLE_DRIVE_CLIENT_SECRET")?.trim(),
    refreshToken: getEnv("GOOGLE_DRIVE_REFRESH_TOKEN")?.trim(),
    folderId: getEnv("GOOGLE_DRIVE_FOLDER_ID")?.trim(),
  };
  if (
    !values.clientId || !values.clientSecret || !values.refreshToken ||
    !values.folderId
  ) {
    throw new GoogleDriveError("configuration");
  }
  return values as DriveConfiguration;
}

async function getAccessToken(
  configuration: DriveConfiguration,
  request: typeof fetch,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: configuration.clientId,
    client_secret: configuration.clientSecret,
    refresh_token: configuration.refreshToken,
    grant_type: "refresh_token",
  });
  let response: Response;
  try {
    response = await timedFetch(request, TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch {
    throw new GoogleDriveError("token");
  }
  if (!response.ok) throw new GoogleDriveError("token");

  const payload = await safeJson(response, "token");
  const accessToken = typeof payload.access_token === "string"
    ? payload.access_token
    : "";
  const grantedScopes = typeof payload.scope === "string"
    ? payload.scope.split(/\s+/).filter(Boolean)
    : [];
  if (
    !accessToken || grantedScopes.length !== 1 ||
    grantedScopes[0] !== DRIVE_FILE_SCOPE
  ) {
    throw new GoogleDriveError("token");
  }
  return accessToken;
}

async function findExistingFile(
  studentDocumentId: string,
  expectedChecksumSha256: string | null,
  accessToken: string,
  request: typeof fetch,
): Promise<{ id: string; name: string; checksumSha256: string | null } | null> {
  const escapedId = studentDocumentId.replace(
    /['\\]/g,
    (character) => `\\${character}`,
  );
  const parameters = new URLSearchParams({
    q: `trashed = false and appProperties has { key='student_document_id' and value='${escapedId}' }`,
    spaces: "drive",
    pageSize: "2",
    fields: "files(id,name,appProperties)",
  });
  let response: Response;
  try {
    response = await timedFetch(request, `${DRIVE_FILES_URL}?${parameters}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new GoogleDriveError("lookup");
  }
  if (!response.ok) throw new GoogleDriveError("lookup");

  const payload = await safeJson(response, "lookup");
  if (!Array.isArray(payload.files)) throw new GoogleDriveError("lookup");
  if (payload.files.length === 0) return null;
  if (payload.files.length !== 1) throw new GoogleDriveError("consistency");
  const file = payload.files[0];
  if (
    !isRecord(file) || typeof file.id !== "string" || !file.id ||
    typeof file.name !== "string" || !file.name
  ) {
    throw new GoogleDriveError("lookup");
  }
  const checksumSha256 = isRecord(file.appProperties) &&
      typeof file.appProperties.checksum_sha256 === "string"
    ? file.appProperties.checksum_sha256
    : null;
  if (
    expectedChecksumSha256 !== null && checksumSha256 !== expectedChecksumSha256
  ) {
    throw new GoogleDriveError("consistency");
  }
  return { id: file.id, name: file.name, checksumSha256 };
}

async function uploadFile(
  input: GoogleDriveUploadInput,
  name: string,
  folderId: string,
  accessToken: string,
  request: typeof fetch,
): Promise<GoogleDriveFile> {
  const boundary = `unic_${crypto.randomUUID().replaceAll("-", "")}`;
  const metadata = {
    name,
    parents: [folderId],
    appProperties: {
      student_document_id: input.studentDocumentId,
      student_id: input.studentId,
      branch_id: input.branchId,
      checksum_sha256: input.checksumSha256,
    },
  };
  const prefix =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${
      JSON.stringify(metadata)
    }\r\n` +
    `--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const body = new Blob([prefix, input.bytes as BlobPart, suffix], {
    type: `multipart/related; boundary=${boundary}`,
  });

  let response: Response;
  try {
    response = await timedFetch(
      request,
      `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
  } catch {
    throw new GoogleDriveError("upload");
  }
  if (!response.ok) throw new GoogleDriveError("upload");

  const payload = await safeJson(response, "upload");
  if (
    typeof payload.id !== "string" || !payload.id ||
    typeof payload.name !== "string" || !payload.name
  ) {
    throw new GoogleDriveError("upload");
  }
  return { id: payload.id, name: payload.name, existing: false };
}

async function safeJson(
  response: Response,
  errorCode: DriveErrorCode,
): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    if (isRecord(value)) return value;
  } catch {}
  throw new GoogleDriveError(errorCode);
}

async function timedFetch(
  request: typeof fetch,
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    GOOGLE_REQUEST_TIMEOUT_MS,
  );
  try {
    return await request(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

import { upload } from "@vercel/blob/client";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export interface PdfUploadResult {
  file: File;
  url: string;
  pathname: string;
}

export interface PdfUploadFailure {
  file: File;
  error: string;
}

/** Turns a raw upload error into something a non-technical admin can act on. */
export function friendlyUploadError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/network|fetch failed|failed to fetch|load failed/i.test(message)) {
    return "Network issue — check your connection and try again.";
  }
  if (/too large|maximumSizeInBytes|exceeds/i.test(message)) {
    return `File is too large (max ${MAX_PDF_BYTES / 1024 / 1024}MB).`;
  }
  if (/content.?type|not allowed/i.test(message)) {
    return "Only PDF files are supported.";
  }
  if (/unauthorized|forbidden|401|403/i.test(message)) {
    return "Your session expired — refresh the page and sign in again.";
  }
  return "Couldn't upload this file — try again.";
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * Uploads PDFs straight from the browser to Blob storage (bypassing the
 * serverless function body-size limit entirely), a few at a time. Progress
 * and failures are reported per-file so the UI can show a status bar and let
 * the admin retry just the ones that failed instead of the whole batch.
 */
export async function uploadPdfsToBlob(
  files: File[],
  clientId: string,
  onProgress: (file: File, percentage: number) => void,
  concurrency = 4,
): Promise<{ results: PdfUploadResult[]; failures: PdfUploadFailure[] }> {
  const results: PdfUploadResult[] = [];
  const failures: PdfUploadFailure[] = [];
  let index = 0;

  async function worker() {
    while (index < files.length) {
      const file = files[index++];
      try {
        const blob = await upload(`reports/${clientId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`, file, {
          access: "private",
          contentType: "application/pdf",
          handleUploadUrl: "/api/batches/upload",
          onUploadProgress: ({ percentage }) => onProgress(file, percentage),
        });
        results.push({ file, url: blob.url, pathname: blob.pathname });
      } catch (err) {
        failures.push({ file, error: friendlyUploadError(err) });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return { results, failures };
}

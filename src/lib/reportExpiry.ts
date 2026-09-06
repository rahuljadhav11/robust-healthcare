import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const REPORT_RETENTION_DAYS = 90;

export interface ExpiryCandidate {
  id: string;
  blobPathname: string;
  sentAt: Date;
  status: string;
}

/**
 * Messages whose report PDF is older than the retention window and safe to
 * expire. Deliberately excludes anything not in a terminal *successful*
 * state — a failed/pending message can still be retried from the Failed
 * page, and retrying re-sends the existing blob rather than re-uploading
 * one, so its file must not disappear out from under it.
 */
export async function findExpiredReportCandidates(retentionDays = REPORT_RETENTION_DAYS): Promise<ExpiryCandidate[]> {
  const db = getDb();
  const result = await db.execute<{ id: string; blob_pathname: string; sent_at: Date; status: string }>(sql`
    SELECT id, blob_pathname, sent_at, status
    FROM messages
    WHERE status IN ('sent', 'delivered', 'read')
      AND sent_at IS NOT NULL
      AND sent_at < now() - (${retentionDays} || ' days')::interval
    ORDER BY sent_at
  `);

  return result.rows.map((r) => ({
    id: r.id,
    blobPathname: r.blob_pathname,
    sentAt: r.sent_at,
    status: r.status,
  }));
}

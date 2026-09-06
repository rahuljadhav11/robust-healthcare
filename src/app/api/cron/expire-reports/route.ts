import { NextResponse } from "next/server";
import { findExpiredReportCandidates, REPORT_RETENTION_DAYS } from "@/lib/reportExpiry";

// Dry run only, for now — logs what a 90-day report retention policy WOULD
// delete without touching any blob or DB row, so the candidate set can be
// reviewed (via Vercel's function logs) before this is ever turned into a
// real deletion. See src/lib/reportExpiry.ts for the exact retention rule.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidates = await findExpiredReportCandidates();

  console.log(
    `[report-expiry] DRY RUN: ${candidates.length} report(s) older than ${REPORT_RETENTION_DAYS} days — no blobs or rows were touched.`,
  );
  for (const c of candidates.slice(0, 50)) {
    console.log(`[report-expiry] would delete: message=${c.id} status=${c.status} sentAt=${c.sentAt.toISOString()} blob=${c.blobPathname}`);
  }
  if (candidates.length > 50) {
    console.log(`[report-expiry] …and ${candidates.length - 50} more (truncated in logs)`);
  }

  return NextResponse.json({
    dryRun: true,
    retentionDays: REPORT_RETENTION_DAYS,
    candidateCount: candidates.length,
  });
}

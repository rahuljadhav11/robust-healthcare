import { NextResponse } from "next/server";
import { requireAuthorizedUserId } from "@/lib/authz";
import { getDb } from "@/db";
import { batches, employees, messages } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface MatchedRowInput {
  empId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  pdfFilename: string;
  blobUrl: string;
  blobPathname: string;
}

interface CreateBatchBody {
  clientId?: string;
  label?: string;
  unmatchedEmployeesCount?: number;
  unmatchedPdfsCount?: number;
  matchedRows?: MatchedRowInput[];
}

export async function POST(request: Request) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });
  const userId = auth.userId;

  let body: CreateBatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "That request didn't come through right — please try again." }, { status: 400 });
  }

  const { clientId, label, matchedRows, unmatchedEmployeesCount = 0, unmatchedPdfsCount = 0 } = body;

  if (typeof clientId !== "string" || !Array.isArray(matchedRows) || matchedRows.length === 0) {
    return NextResponse.json({ error: "No matched employees to queue" }, { status: 400 });
  }

  // PDFs are uploaded client-side straight to Blob storage before this runs
  // (see /api/batches/upload), so every row must already carry its blob URL.
  // Anything missing one means the upload step didn't finish — nothing here
  // can recover that, so reject with a message that says what to do next.
  const incomplete = matchedRows.find((r) => !r.blobUrl || !r.blobPathname);
  if (incomplete) {
    return NextResponse.json(
      { error: `"${incomplete.pdfFilename}" hasn't finished uploading — refresh the page and try again.` },
      { status: 400 },
    );
  }

  const db = getDb();

  const [{ maxSequence }] = await db
    .select({ maxSequence: sql<number>`coalesce(max(${batches.sequence}), 0)` })
    .from(batches)
    .where(eq(batches.clientId, clientId));

  const [batch] = await db
    .insert(batches)
    .values({
      id: crypto.randomUUID(),
      clientId,
      sequence: Number(maxSequence) + 1,
      label: typeof label === "string" && label.trim() ? label.trim() : null,
      createdBy: userId,
      totalMatched: matchedRows.length,
      unmatchedEmployees: unmatchedEmployeesCount,
      unmatchedPdfs: unmatchedPdfsCount,
    })
    .returning();

  let queued = 0;

  for (const row of matchedRows) {
    const [existing] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.clientId, clientId), eq(employees.empId, row.empId)));

    const employeeId = existing?.id ?? crypto.randomUUID();
    if (existing) {
      await db
        .update(employees)
        .set({ firstName: row.firstName, lastName: row.lastName, mobile: row.mobile })
        .where(eq(employees.id, existing.id));
    } else {
      await db.insert(employees).values({
        id: employeeId,
        clientId,
        empId: row.empId,
        firstName: row.firstName,
        lastName: row.lastName,
        mobile: row.mobile,
      });
    }

    await db.insert(messages).values({
      id: crypto.randomUUID(),
      batchId: batch.id,
      employeeId,
      blobPathname: row.blobPathname,
      blobUrl: row.blobUrl,
      originalFilename: row.pdfFilename,
    });

    queued++;
  }

  // Deliberately does NOT send here. Queueing and sending are kept as two
  // distinct, visible steps so a non-technical admin always has an explicit
  // moment where they choose to actually notify real people — not a side
  // effect of finishing the upload wizard.
  return NextResponse.json({ batch, queued, skipped: [] });
}

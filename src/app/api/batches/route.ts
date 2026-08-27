import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { getDb } from "@/db";
import { batches, employees, messages } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

interface MatchedRowInput {
  empId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  pdfFilename: string;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const clientId = formData.get("clientId");
  const label = formData.get("label");
  const matchedRowsRaw = formData.get("matchedRows");
  const unmatchedEmployeesCount = Number(formData.get("unmatchedEmployeesCount") ?? "0");
  const unmatchedPdfsCount = Number(formData.get("unmatchedPdfsCount") ?? "0");

  if (typeof clientId !== "string" || typeof matchedRowsRaw !== "string") {
    return NextResponse.json({ error: "Missing clientId or matchedRows" }, { status: 400 });
  }

  let matchedRows: MatchedRowInput[];
  try {
    matchedRows = JSON.parse(matchedRowsRaw);
  } catch {
    return NextResponse.json({ error: "matchedRows is not valid JSON" }, { status: 400 });
  }
  if (!Array.isArray(matchedRows) || matchedRows.length === 0) {
    return NextResponse.json({ error: "No matched rows to queue" }, { status: 400 });
  }

  const pdfFiles = formData.getAll("pdfs").filter((v): v is File => v instanceof File);
  const pdfByName = new Map(pdfFiles.map((f) => [f.name, f]));

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
  const skipped: string[] = [];

  for (const row of matchedRows) {
    const pdfFile = pdfByName.get(row.pdfFilename);
    if (!pdfFile) {
      skipped.push(row.pdfFilename);
      continue;
    }

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

    const blobPathname = `reports/${clientId}/${row.empId}-${crypto.randomUUID()}.pdf`;
    const blob = await put(blobPathname, pdfFile, { access: "private", contentType: "application/pdf" });

    await db.insert(messages).values({
      id: crypto.randomUUID(),
      batchId: batch.id,
      employeeId,
      blobPathname,
      blobUrl: blob.url,
      originalFilename: row.pdfFilename,
    });

    queued++;
  }

  return NextResponse.json({ batch, queued, skipped });
}

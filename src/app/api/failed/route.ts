import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { requireAuthorizedUserId } from "@/lib/authz";
import { getDb } from "@/db";
import { messages, employees, clients, batches } from "@/db/schema";

export async function GET() {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const db = getDb();
  const rows = await db
    .select({
      id: messages.id,
      error: messages.error,
      attempts: messages.attempts,
      updatedAt: messages.updatedAt,
      empId: employees.empId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      mobile: employees.mobile,
      companyId: clients.id,
      companyName: clients.name,
      batchId: batches.id,
      batchSequence: batches.sequence,
    })
    .from(messages)
    .innerJoin(employees, eq(messages.employeeId, employees.id))
    .innerJoin(clients, eq(employees.clientId, clients.id))
    .innerJoin(batches, eq(messages.batchId, batches.id))
    .where(eq(messages.status, "failed"))
    .orderBy(desc(messages.updatedAt));

  return NextResponse.json(
    { failed: rows },
    { headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=45" } },
  );
}

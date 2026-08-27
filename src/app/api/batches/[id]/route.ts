import { NextResponse } from "next/server";
import { requireAuthorizedUserId } from "@/lib/authz";
import { getDb } from "@/db";
import { batches, employees, messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncSentMessageStatuses } from "@/lib/statusSync";

export async function GET(_request: Request, ctx: RouteContext<"/api/batches/[id]">) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const { id } = await ctx.params;
  const db = getDb();

  const [batch] = await db.select().from(batches).where(eq(batches.id, id));
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Pulls real delivery/read status from MSG91's logs for anything still
  // sitting at "sent" — a fallback for when MSG91's webhook isn't configured.
  await syncSentMessageStatuses().catch(() => null);

  const rows = await db
    .select({
      id: messages.id,
      status: messages.status,
      error: messages.error,
      attempts: messages.attempts,
      sentAt: messages.sentAt,
      empId: employees.empId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      mobile: employees.mobile,
    })
    .from(messages)
    .innerJoin(employees, eq(messages.employeeId, employees.id))
    .where(eq(messages.batchId, id));

  const summary = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({ batch, messages: rows, summary });
}

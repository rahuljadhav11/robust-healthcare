import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/db";
import { batches, employees, messages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(_request: Request, ctx: RouteContext<"/api/batches/[id]">) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();

  const [batch] = await db.select().from(batches).where(eq(batches.id, id));
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { requireAuthorizedUserId } from "@/lib/authz";
import { getDb } from "@/db";
import { chatMessages, employees, clients, inboxReadState } from "@/db/schema";

export async function GET(_request: Request, ctx: RouteContext<"/api/inbox/[number]">) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const { number } = await ctx.params;
  const db = getDb();

  // Opening (or continuing to poll) this thread marks it read up to now —
  // any message that arrives while it's open is seen immediately, same as
  // real WhatsApp/Slack behavior.
  await db
    .insert(inboxReadState)
    .values({ counterpartyNumber: number, lastViewedAt: new Date() })
    .onConflictDoUpdate({ target: inboxReadState.counterpartyNumber, set: { lastViewedAt: new Date() } });

  const rows = await db
    .select({
      id: chatMessages.id,
      direction: chatMessages.direction,
      messageType: chatMessages.messageType,
      textBody: chatMessages.textBody,
      mediaFilename: chatMessages.mediaFilename,
      attachmentToken: chatMessages.attachmentToken,
      status: chatMessages.status,
      error: chatMessages.error,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.counterpartyNumber, number))
    .orderBy(asc(chatMessages.createdAt));

  const [identity] = await db
    .select({ firstName: employees.firstName, lastName: employees.lastName, empId: employees.empId, companyName: clients.name })
    .from(chatMessages)
    .leftJoin(employees, eq(employees.id, chatMessages.employeeId))
    .leftJoin(clients, eq(clients.id, chatMessages.clientId))
    .where(eq(chatMessages.counterpartyNumber, number))
    .limit(1);

  return NextResponse.json({ number, identity: identity ?? null, messages: rows });
}

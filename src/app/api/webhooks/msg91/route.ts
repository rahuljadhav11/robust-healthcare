import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { messages, webhookEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

// MSG91's exact delivery-status webhook payload shape hasn't been confirmed
// against a live event yet. This defensively tries a few plausible field
// names for the message id and status, and always logs the raw body so the
// mapping can be corrected from real traffic without losing events.
const STATUS_MAP: Record<string, string> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
  undelivered: "failed",
};

export async function POST(request: Request) {
  const raw = await request.text();
  const db = getDb();

  interface WebhookPayload {
    messageId?: string;
    message_id?: string;
    status?: string;
    data?: { messageId?: string; message_id?: string; status?: string };
  }

  let payload: WebhookPayload | null = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    // fall through with payload = null; still log the raw body below
  }

  const msg91MessageId =
    payload?.messageId ?? payload?.message_id ?? payload?.data?.messageId ?? payload?.data?.message_id ?? null;
  const rawStatus = (payload?.status ?? payload?.data?.status ?? "").toString().toLowerCase();
  const mappedStatus = STATUS_MAP[rawStatus];

  let matchedMessageId: string | null = null;

  if (msg91MessageId && mappedStatus) {
    const [message] = await db.select().from(messages).where(eq(messages.msg91MessageId, msg91MessageId));
    if (message) {
      matchedMessageId = message.id;
      await db
        .update(messages)
        .set({ status: mappedStatus, updatedAt: new Date() })
        .where(eq(messages.id, message.id));
    }
  }

  await db.insert(webhookEvents).values({
    id: crypto.randomUUID(),
    rawBody: raw,
    matchedMessageId,
  });

  return NextResponse.json({ ok: true });
}

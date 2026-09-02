import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, webhookEvents } from "@/db/schema";

// Confirmed payload shape (MSG91's own webhook docs): eventName is one of
// sent/delivered/read/failed, uuid is the message id we stored as
// msg91MessageId at send time, reason carries the failure reason.
const STATUS_MAP: Record<string, string> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

// MSG91 auto-pauses a webhook that ever returns 4xx/5xx and retries up to 4x
// on anything slower than 8s — so this always responds 200 fast, logging
// failures internally instead of surfacing them as an HTTP error.
export async function POST(request: Request) {
  const raw = await request.text();
  const db = getDb();

  let matchedMessageId: string | null = null;

  try {
    const payload = JSON.parse(raw);
    const uuid: string | undefined = payload?.uuid;
    const eventName: string = String(payload?.eventName ?? "").toLowerCase();
    const mappedStatus = STATUS_MAP[eventName];

    if (uuid && mappedStatus) {
      const [message] = await db.select().from(messages).where(eq(messages.msg91MessageId, uuid));
      if (message) {
        matchedMessageId = message.id;
        await db
          .update(messages)
          .set({
            status: mappedStatus,
            error: mappedStatus === "failed" ? (payload?.reason ?? null) : null,
            updatedAt: new Date(),
          })
          .where(eq(messages.id, message.id));
      }
    }
  } catch {
    // fall through — still log the raw body below
  }

  await db.insert(webhookEvents).values({ id: crypto.randomUUID(), rawBody: raw, matchedMessageId }).catch(() => null);

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages } from "@/db/schema";
import { matchEmployeeByPhone } from "@/lib/matchInbound";

// Confirmed payload shape (MSG91's own webhook docs) for inbound messages:
// customerNumber, customerName, contentType, text, url (media), filename,
// caption, uuid, ts. There's no pull API for inbound messages — this
// webhook is the only way to ever see what an employee sent back.
//
// MSG91 has two inbound event types ("Request Received" and "Report
// Received") that can both fire for the same message with the same uuid,
// often within milliseconds of each other — we recommend enabling both
// (belt and suspenders against missing one). A plain "check then insert"
// dedupe isn't safe here: two near-simultaneous requests can both pass the
// check before either has inserted (confirmed happening in production — 3
// rows landed for one reply). The fix is a DB-level partial unique index on
// msg91_message_id (migrations/chat_messages_msg91_message_id_unique) plus
// ON CONFLICT ... DO NOTHING in the same statement as the insert, which
// Postgres guarantees is atomic even under concurrent requests.
export async function POST(request: Request) {
  const raw = await request.text();
  const db = getDb();

  try {
    const payload = JSON.parse(raw);
    const customerNumber: string | undefined = payload?.customerNumber;
    if (!customerNumber) {
      return NextResponse.json({ ok: true }); // nothing usable to store
    }

    const match = await matchEmployeeByPhone(customerNumber);
    const contentType = String(payload?.contentType ?? "text").toLowerCase();
    const messageType = ["text", "image", "document", "audio", "video", "location"].includes(contentType)
      ? contentType
      : "unknown";
    const uuid: string | null = payload?.uuid ?? null;
    const textBody: string | null = payload?.text ?? payload?.caption ?? null;
    const mediaUrl: string | null = payload?.url ?? null;
    const mediaFilename: string | null = payload?.filename ?? null;

    if (uuid) {
      // Atomic: the uniqueness check and the insert happen as one statement.
      await db.execute(sql`
        INSERT INTO chat_messages
          (id, employee_id, client_id, counterparty_number, direction, message_type, text_body, media_url, media_filename, msg91_message_id, status, raw_payload)
        VALUES
          (${crypto.randomUUID()}, ${match?.employeeId ?? null}, ${match?.clientId ?? null}, ${customerNumber}, 'inbound', ${messageType}, ${textBody}, ${mediaUrl}, ${mediaFilename}, ${uuid}, 'received', ${raw})
        ON CONFLICT (msg91_message_id) WHERE msg91_message_id IS NOT NULL DO NOTHING
      `);
    } else {
      // No message id to dedupe on at all — just insert (rare: MSG91 always
      // sends a uuid in practice, but don't drop the message if it doesn't).
      await db.insert(chatMessages).values({
        id: crypto.randomUUID(),
        employeeId: match?.employeeId ?? null,
        clientId: match?.clientId ?? null,
        counterpartyNumber: customerNumber,
        direction: "inbound",
        messageType,
        textBody,
        mediaUrl,
        mediaFilename,
        status: "received",
        rawPayload: raw,
      });
    }
  } catch {
    // Still store the raw payload even if it doesn't parse as expected, so
    // nothing is lost while the schema assumptions above get corrected.
    await db
      .insert(chatMessages)
      .values({
        id: crypto.randomUUID(),
        counterpartyNumber: "unknown",
        direction: "inbound",
        messageType: "unknown",
        status: "received",
        rawPayload: raw,
      })
      .catch(() => null);
  }

  return NextResponse.json({ ok: true });
}

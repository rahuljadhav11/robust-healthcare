import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { chatMessages } from "@/db/schema";
import { matchEmployeeByPhone } from "@/lib/matchInbound";

// Confirmed payload shape (MSG91's own webhook docs) for inbound messages:
// customerNumber, customerName, contentType, text, url (media), filename,
// caption, uuid, ts. There's no pull API for inbound messages — this
// webhook is the only way to ever see what an employee sent back.
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

    await db.insert(chatMessages).values({
      id: crypto.randomUUID(),
      employeeId: match?.employeeId ?? null,
      clientId: match?.clientId ?? null,
      counterpartyNumber: customerNumber,
      direction: "inbound",
      messageType,
      textBody: payload?.text ?? payload?.caption ?? null,
      mediaUrl: payload?.url ?? null,
      mediaFilename: payload?.filename ?? null,
      msg91MessageId: payload?.uuid ?? null,
      status: "received",
      rawPayload: raw,
    });
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

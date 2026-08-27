import { NextResponse } from "next/server";
import { get, head } from "@vercel/blob";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { consumeSendToken, peekSendToken } from "@/lib/tokens";

async function loadMessage(messageId: string) {
  const db = getDb();
  const [message] = await db.select().from(messages).where(eq(messages.id, messageId));
  return message ?? null;
}

function contentHeaders(filename: string, size: number, contentType: string) {
  return {
    "content-type": contentType,
    "content-length": String(size),
    "content-disposition": `attachment; filename="${filename}"`,
    // Meta/MSG91 may fetch more than once (redelivery, retries) — cache
    // the response so those extra hits don't re-read from Blob storage.
    "cache-control": "public, max-age=31536000, immutable",
  };
}

export async function GET(_request: Request, ctx: RouteContext<"/api/reports/[token]">) {
  const { token } = await ctx.params;

  const consumed = await consumeSendToken(token);
  if (!consumed) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const message = await loadMessage(consumed.messageId);
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blobFile = await get(message.blobUrl, { access: "private" });
  if (!blobFile || blobFile.statusCode !== 200) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new Response(blobFile.stream, {
    headers: contentHeaders(message.originalFilename, blobFile.blob.size, "application/pdf"),
  });
}

// Media fetchers (including Meta's WhatsApp document-download step) commonly
// probe with HEAD before GET to check content-type/length — without this,
// that probe 405'd, which likely broke document delivery even though the
// initial send API call reported success.
export async function HEAD(_request: Request, ctx: RouteContext<"/api/reports/[token]">) {
  const { token } = await ctx.params;

  const peeked = await peekSendToken(token);
  if (!peeked) return new Response(null, { status: 404 });

  const message = await loadMessage(peeked.messageId);
  if (!message) return new Response(null, { status: 404 });

  const meta = await head(message.blobUrl).catch(() => null);
  if (!meta) return new Response(null, { status: 404 });

  return new Response(null, {
    status: 200,
    headers: contentHeaders(message.originalFilename, meta.size, "application/pdf"),
  });
}

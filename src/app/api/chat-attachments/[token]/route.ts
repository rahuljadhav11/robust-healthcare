import { NextResponse } from "next/server";
import { get, head } from "@vercel/blob";
import { getDb } from "@/db";
import { chatMessages } from "@/db/schema";
import { eq } from "drizzle-orm";

async function loadByToken(token: string) {
  const db = getDb();
  const [row] = await db.select().from(chatMessages).where(eq(chatMessages.attachmentToken, token));
  return row ?? null;
}

function contentHeaders(filename: string, size: number, contentType: string) {
  return {
    "content-type": contentType,
    "content-length": String(size),
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "public, max-age=31536000, immutable",
  };
}

export async function GET(_request: Request, ctx: RouteContext<"/api/chat-attachments/[token]">) {
  const { token } = await ctx.params;
  const row = await loadByToken(token);
  if (!row || !row.mediaUrl) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blobFile = await get(row.mediaUrl, { access: "private" });
  if (!blobFile || blobFile.statusCode !== 200) return NextResponse.json({ error: "File not found" }, { status: 404 });

  return new Response(blobFile.stream, {
    headers: contentHeaders(row.mediaFilename ?? "attachment", blobFile.blob.size, blobFile.blob.contentType),
  });
}

export async function HEAD(_request: Request, ctx: RouteContext<"/api/chat-attachments/[token]">) {
  const { token } = await ctx.params;
  const row = await loadByToken(token);
  if (!row || !row.mediaUrl) return new Response(null, { status: 404 });

  const meta = await head(row.mediaUrl).catch(() => null);
  if (!meta) return new Response(null, { status: 404 });

  return new Response(null, { status: 200, headers: contentHeaders(row.mediaFilename ?? "attachment", meta.size, meta.contentType) });
}

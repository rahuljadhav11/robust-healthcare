import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { consumeSendToken } from "@/lib/tokens";

export async function GET(_request: Request, ctx: RouteContext<"/api/reports/[token]">) {
  const { token } = await ctx.params;

  const consumed = await consumeSendToken(token);
  if (!consumed) {
    return NextResponse.json({ error: "Link expired or invalid" }, { status: 404 });
  }

  const db = getDb();
  const [message] = await db.select().from(messages).where(eq(messages.id, consumed.messageId));
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blobFile = await get(message.blobUrl, { access: "private" });
  if (!blobFile || blobFile.statusCode !== 200) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new Response(blobFile.stream, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${message.originalFilename}"`,
    },
  });
}

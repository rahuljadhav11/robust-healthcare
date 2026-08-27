import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { get } from "@vercel/blob";
import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { eq } from "drizzle-orm";

// Admin-only preview of a report already on file — distinct from the public,
// permanent /api/reports/[token] link handed to MSG91/Meta. This one requires
// a Clerk session and renders inline instead of forcing a download.
export async function GET(_request: Request, ctx: RouteContext<"/api/messages/[id]/preview">) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const db = getDb();
  const [message] = await db.select().from(messages).where(eq(messages.id, id));
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const blobFile = await get(message.blobUrl, { access: "private" });
  if (!blobFile || blobFile.statusCode !== 200) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new Response(blobFile.stream, {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(blobFile.blob.size),
      "content-disposition": `inline; filename="${message.originalFilename}"`,
    },
  });
}

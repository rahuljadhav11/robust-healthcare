import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomBytes } from "crypto";
import { requireAuthorizedUserId } from "@/lib/authz";
import { getDb } from "@/db";
import { chatMessages } from "@/db/schema";
import { normalizeMobile, sendSessionMessage } from "@/lib/msg91";
import { matchEmployeeByPhone } from "@/lib/matchInbound";
import { getAppUrl } from "@/lib/appUrl";

function guessContentType(mimeType: string): "image" | "video" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

export async function POST(request: Request, ctx: RouteContext<"/api/inbox/[number]/reply">) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const { number } = await ctx.params;
  const formData = await request.formData();
  const text = formData.get("text");
  const file = formData.get("file");

  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasFile = file instanceof File && file.size > 0;
  if (!hasText && !hasFile) {
    return NextResponse.json({ error: "Write a message or attach a file" }, { status: 400 });
  }

  const db = getDb();
  const match = await matchEmployeeByPhone(number);
  const to = normalizeMobile(number);

  let mediaUrl: string | null = null;
  let mediaFilename: string | null = null;
  let attachmentToken: string | null = null;
  let contentType: "text" | "image" | "video" | "document" = "text";

  if (hasFile) {
    const uploadedFile = file as File;
    contentType = guessContentType(uploadedFile.type);
    attachmentToken = randomBytes(24).toString("hex");
    const blobPathname = `chat-attachments/${number}/${crypto.randomUUID()}-${uploadedFile.name}`;
    const blob = await put(blobPathname, uploadedFile, { access: "private", contentType: uploadedFile.type || "application/octet-stream" });
    mediaUrl = blob.url;
    mediaFilename = uploadedFile.name;
  }

  const result = await sendSessionMessage({
    to,
    contentType,
    text: hasText ? (text as string).trim() : undefined,
    attachmentUrl: attachmentToken ? `${getAppUrl()}/api/chat-attachments/${attachmentToken}` : undefined,
    filename: mediaFilename ?? undefined,
  }).catch((err) => ({ ok: false, msg91MessageId: null, raw: { error: err instanceof Error ? err.message : String(err) } }));

  const [row] = await db
    .insert(chatMessages)
    .values({
      id: crypto.randomUUID(),
      employeeId: match?.employeeId ?? null,
      clientId: match?.clientId ?? null,
      counterpartyNumber: number,
      direction: "outbound",
      messageType: contentType,
      textBody: hasText ? (text as string).trim() : null,
      mediaUrl,
      mediaFilename,
      attachmentToken,
      msg91MessageId: result.msg91MessageId,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : `MSG91 rejected send: ${JSON.stringify(result.raw)}`,
    })
    .returning();

  return NextResponse.json({ ok: result.ok, message: row });
}

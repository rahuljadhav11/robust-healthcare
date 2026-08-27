import { NextResponse } from "next/server";
import { requireAuthorizedUserId } from "@/lib/authz";
import { runSendQueue } from "@/lib/sendQueue";

export async function POST() {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const result = await runSendQueue();
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { runSendQueue } from "@/lib/sendQueue";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await runSendQueue();
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { runSendQueue } from "@/lib/sendQueue";

// Daily safety-net run (Vercel Hobby plans only allow once-per-day cron
// schedules). Admins can also trigger sending immediately via the "Send now"
// button on a batch page — see /api/batches/send-now.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runSendQueue();
  return NextResponse.json(result);
}

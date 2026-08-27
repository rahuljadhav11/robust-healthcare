import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { retryMessage } from "@/lib/sendQueue";

export async function POST(_request: Request, ctx: RouteContext<"/api/messages/[id]/retry">) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await retryMessage(id);
  if (!result.ok && result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

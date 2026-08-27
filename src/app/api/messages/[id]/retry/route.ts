import { NextResponse } from "next/server";
import { requireAuthorizedUserId } from "@/lib/authz";
import { retryMessage } from "@/lib/sendQueue";

export async function POST(_request: Request, ctx: RouteContext<"/api/messages/[id]/retry">) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const { id } = await ctx.params;
  const result = await retryMessage(id);
  if (!result.ok && result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

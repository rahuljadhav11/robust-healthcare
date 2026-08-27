import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getEmployeesWithLatestStatus } from "@/lib/employeeStatus";
import { syncSentMessageStatuses } from "@/lib/statusSync";

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/employees">) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  await syncSentMessageStatuses().catch(() => null);

  const employees = await getEmployeesWithLatestStatus(id);
  return NextResponse.json({ employees });
}

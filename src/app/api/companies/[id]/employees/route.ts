import { NextResponse } from "next/server";
import { requireAuthorizedUserId } from "@/lib/authz";
import { getEmployeesWithLatestStatus } from "@/lib/employeeStatus";
import { syncSentMessageStatuses } from "@/lib/statusSync";

export async function GET(_request: Request, ctx: RouteContext<"/api/companies/[id]/employees">) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const { id } = await ctx.params;
  await syncSentMessageStatuses().catch(() => null);

  const employees = await getEmployeesWithLatestStatus(id);
  return NextResponse.json({ employees });
}

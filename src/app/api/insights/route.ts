import { NextResponse } from "next/server";
import { requireAuthorizedUserId } from "@/lib/authz";
import { fetchWhatsappAnalytics } from "@/lib/msg91";
import { getAllCompanyStats } from "@/lib/companyStats";

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const today = new Date();
  const start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000); // MSG91 caps at 31 days
  const [global, companies] = await Promise.all([
    fetchWhatsappAnalytics(toDateStr(start), toDateStr(today)).catch(() => null),
    getAllCompanyStats(),
  ]);

  return NextResponse.json({ global, companies });
}

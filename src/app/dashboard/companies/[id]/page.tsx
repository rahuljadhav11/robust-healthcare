import Link from "next/link";
import { Clock, AlertCircle, CheckCircle2, Users, ArrowRight } from "lucide-react";
import { getDb } from "@/db";
import { batches, messages } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCompanyStats } from "@/lib/companyStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";

export default async function CompanyOverviewPage({ params }: PageProps<"/dashboard/companies/[id]">) {
  const { id } = await params;
  const stats = await getCompanyStats(id);
  const db = getDb();

  const recentBatches = await db
    .select({
      id: batches.id,
      sequence: batches.sequence,
      label: batches.label,
      totalMatched: batches.totalMatched,
      createdAt: batches.createdAt,
      sent: sql<number>`count(*) filter (where ${messages.status} in ('sent','delivered','read'))`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')`,
      pending: sql<number>`count(*) filter (where ${messages.status} in ('pending','sending'))`,
    })
    .from(batches)
    .leftJoin(messages, eq(messages.batchId, batches.id))
    .where(eq(batches.clientId, id))
    .groupBy(batches.id, batches.sequence, batches.label, batches.totalMatched, batches.createdAt)
    .orderBy(desc(batches.createdAt))
    .limit(5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Employees" value={stats?.employeeCount ?? 0} tone="muted" />
        <StatCard icon={CheckCircle2} label="Delivered" value={stats?.delivered ?? 0} tone="success" />
        <StatCard icon={Clock} label="Pending" value={stats?.pending ?? 0} tone="warning" />
        <StatCard icon={AlertCircle} label="Failed" value={stats?.failed ?? 0} tone="destructive" />
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent batches</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/companies/${id}/batches`}>
              View all
              <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentBatches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No batches yet — click &quot;New batch&quot; to get started.
            </p>
          ) : (
            <div className="divide-y">
              {recentBatches.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/companies/${id}/batches/${s.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                >
                  <div>
                    <div className="text-sm font-medium">
                      Batch #{s.sequence}
                      {s.label && <span className="font-normal text-muted-foreground"> — {s.label}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.totalMatched} employees</div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="default">{s.sent} sent</Badge>
                    {Number(s.failed) > 0 && <Badge variant="destructive">{s.failed} failed</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

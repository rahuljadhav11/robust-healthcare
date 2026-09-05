import Link from "next/link";
import { Clock, AlertCircle, CheckCircle2, Users, ArrowRight, ListPlus, Inbox } from "lucide-react";
import { getDb } from "@/db";
import { batches, messages } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCompanyStats } from "@/lib/companyStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { timeAgo } from "@/lib/utils";

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
          {recentBatches.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/companies/${id}/batches`}>
                View all
                <ArrowRight />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentBatches.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No batches yet"
              description="Upload an employee list and PDFs to send your first batch of reports."
              action={
                <Button asChild size="sm">
                  <Link href={`/dashboard/companies/${id}/new-batch`}>
                    <ListPlus />
                    New batch
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y">
              {recentBatches.map((s) => {
                const total = Number(s.sent) + Number(s.pending) + Number(s.failed);
                const sentPct = total > 0 ? (Number(s.sent) / total) * 100 : 0;
                const failedPct = total > 0 ? (Number(s.failed) / total) * 100 : 0;
                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/companies/${id}/batches/${s.id}`}
                    className="block rounded-md px-2 py-3 transition-colors hover:bg-muted/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          Batch #{s.sequence}
                          {s.label && <span className="font-normal text-muted-foreground"> — {s.label}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{s.totalMatched} employees</span>
                          <span>·</span>
                          <span>{timeAgo(s.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Badge variant="default">{s.sent} sent</Badge>
                        {Number(s.pending) > 0 && <Badge variant="secondary">{s.pending} pending</Badge>}
                        {Number(s.failed) > 0 && <Badge variant="destructive">{s.failed} failed</Badge>}
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="mt-2 flex h-1 w-full overflow-hidden rounded-full bg-muted">
                        {sentPct > 0 && <div className="h-full bg-chat" style={{ width: `${sentPct}%` }} />}
                        {failedPct > 0 && <div className="h-full bg-destructive" style={{ width: `${failedPct}%` }} />}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

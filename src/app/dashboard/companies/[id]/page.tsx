import Link from "next/link";
import { Clock, AlertCircle, CheckCircle2, Users, ArrowRight } from "lucide-react";
import { getDb } from "@/db";
import { batches, messages } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCompanyStats } from "@/lib/companyStats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
            <Users className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats?.employeeCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats?.delivered ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats?.pending ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats?.failed ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
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
                  className="flex items-center justify-between py-3 hover:opacity-80"
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

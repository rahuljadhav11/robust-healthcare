import Link from "next/link";
import { SendHorizonal, Clock, AlertCircle, CheckCircle2, Building2 } from "lucide-react";
import { getDb } from "@/db";
import { batches, clients, messages } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getDailyLimit, getSentTodayCount } from "@/lib/rateLimit";
import { AddCompanySheet } from "@/components/add-company-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function loadData() {
  const db = getDb();
  const clientRows = await db.select().from(clients).orderBy(desc(clients.createdAt));

  const batchRows = await db
    .select({
      id: batches.id,
      label: batches.label,
      clientId: batches.clientId,
      totalMatched: batches.totalMatched,
      createdAt: batches.createdAt,
      sent: sql<number>`count(*) filter (where ${messages.status} in ('sent','delivered','read'))`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')`,
      pending: sql<number>`count(*) filter (where ${messages.status} in ('pending','sending'))`,
    })
    .from(batches)
    .leftJoin(messages, eq(messages.batchId, batches.id))
    .groupBy(batches.id, batches.label, batches.clientId, batches.totalMatched, batches.createdAt)
    .orderBy(desc(batches.createdAt));

  const [totals] = await db
    .select({
      delivered: sql<number>`count(*) filter (where ${messages.status} in ('sent','delivered','read'))`,
      pending: sql<number>`count(*) filter (where ${messages.status} in ('pending','sending'))`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')`,
    })
    .from(messages);

  const sentToday = await getSentTodayCount();

  return { clientRows, batchRows, totals, sentToday };
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  done: { label: "All delivered", variant: "default" },
  pending: { label: "In progress", variant: "secondary" },
  attention: { label: "Needs attention", variant: "destructive" },
};

export default async function DashboardPage() {
  const { clientRows, batchRows, totals, sentToday } = await loadData();
  const clientNameById = new Map(clientRows.map((c) => [c.id, c.name]));
  const dailyLimit = getDailyLimit();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Track deliveries and manage the companies you send reports for.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new-batch">
            <SendHorizonal />
            Send reports
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent today</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {sentToday} <span className="text-sm font-normal text-muted-foreground">/ {dailyLimit}</span>
            </div>
            <p className="text-xs text-muted-foreground">WhatsApp&apos;s daily sending cap</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            <Clock className="size-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totals?.pending ?? 0}</div>
            <p className="text-xs text-muted-foreground">Queued, waiting to send</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
            <AlertCircle className="size-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totals?.failed ?? 0}</div>
            <p className="text-xs text-muted-foreground">Needs your attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totals?.delivered ?? 0}</div>
            <p className="text-xs text-muted-foreground">All-time reports sent</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Batches</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {batchRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <SendHorizonal className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">No reports sent yet</p>
                  <p className="text-sm text-muted-foreground">
                    Add a company, then send your first batch of reports.
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href="/dashboard/new-batch">Send reports</Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batchRows.map((b) => {
                    const state = Number(b.failed) > 0 ? "attention" : Number(b.pending) > 0 ? "pending" : "done";
                    const badge = STATUS_BADGE[state];
                    return (
                      <TableRow key={b.id} className="cursor-pointer">
                        <TableCell className="font-medium">
                          <Link href={`/dashboard/batches/${b.id}`} className="hover:underline">
                            {b.label}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {clientNameById.get(b.clientId) ?? "Unknown company"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {b.sent}/{b.totalMatched} sent
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4" />
              Companies
            </CardTitle>
            <AddCompanySheet />
          </CardHeader>
          <CardContent>
            {clientRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add the company you&apos;re sending reports for to get started.
              </p>
            ) : (
              <ul className="space-y-1">
                {clientRows.map((c) => (
                  <li key={c.id} className="rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

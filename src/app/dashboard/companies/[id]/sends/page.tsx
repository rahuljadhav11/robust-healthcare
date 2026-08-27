import Link from "next/link";
import { getDb } from "@/db";
import { batches, messages } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function SendsPage({ params }: PageProps<"/dashboard/companies/[id]/sends">) {
  const { id } = await params;
  const db = getDb();

  const sends = await db
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
    .orderBy(desc(batches.sequence));

  return (
    <Card>
      <CardContent className="pt-6">
        {sends.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No sends yet — click &quot;New send&quot; to get started.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Send</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead className="text-right">Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sends.map((s) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/companies/${id}/sends/${s.id}`} className="hover:underline">
                      Send #{s.sequence}
                      {s.label && <span className="font-normal text-muted-foreground"> — {s.label}</span>}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.totalMatched}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Badge variant="default">{s.sent} sent</Badge>
                      {Number(s.pending) > 0 && <Badge variant="secondary">{s.pending} pending</Badge>}
                      {Number(s.failed) > 0 && <Badge variant="destructive">{s.failed} failed</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

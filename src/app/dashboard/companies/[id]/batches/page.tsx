import { getDb } from "@/db";
import { batches, messages } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { BatchesTable } from "./batches-table";

export default async function BatchesPage({ params }: PageProps<"/dashboard/companies/[id]/batches">) {
  const { id } = await params;
  const db = getDb();

  const batchRows = await db
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
    <Card className="border-none shadow-sm">
      <CardContent className="pt-6">
        {batchRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No batches yet — click &quot;New batch&quot; to get started.
          </p>
        ) : (
          <BatchesTable
            companyId={id}
            batches={batchRows.map((s) => ({
              id: s.id,
              sequence: s.sequence,
              label: s.label,
              totalMatched: s.totalMatched,
              createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt),
              sent: Number(s.sent),
              failed: Number(s.failed),
              pending: Number(s.pending),
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}

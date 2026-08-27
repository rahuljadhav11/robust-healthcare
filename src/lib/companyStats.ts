import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { batches, clients, employees, messages } from "@/db/schema";

export interface CompanyStats {
  clientId: string;
  name: string;
  employeeCount: number;
  delivered: number;
  pending: number;
  failed: number;
  lastSendAt: Date | null;
}

/** One row per company with rollup send stats — powers the Companies list/home pages. */
export async function getAllCompanyStats(): Promise<CompanyStats[]> {
  const db = getDb();

  const rows = await db
    .select({
      clientId: clients.id,
      name: clients.name,
      delivered: sql<number>`count(*) filter (where ${messages.status} in ('sent','delivered','read'))`,
      pending: sql<number>`count(*) filter (where ${messages.status} in ('pending','sending'))`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')`,
      lastSendAt: sql<Date | null>`max(${batches.createdAt})`,
    })
    .from(clients)
    .leftJoin(batches, eq(batches.clientId, clients.id))
    .leftJoin(messages, eq(messages.batchId, batches.id))
    .groupBy(clients.id, clients.name);

  const employeeCounts = await db
    .select({ clientId: employees.clientId, count: sql<number>`count(*)` })
    .from(employees)
    .groupBy(employees.clientId);
  const countByClient = new Map(employeeCounts.map((r) => [r.clientId, Number(r.count)]));

  return rows
    .map((r) => ({ ...r, employeeCount: countByClient.get(r.clientId) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCompanyStats(clientId: string): Promise<CompanyStats | null> {
  const all = await getAllCompanyStats();
  return all.find((c) => c.clientId === clientId) ?? null;
}

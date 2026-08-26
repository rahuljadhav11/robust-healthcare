import { getDb } from "@/db";
import { messages } from "@/db/schema";
import { and, gte, inArray, sql } from "drizzle-orm";

export function getDailyLimit(): number {
  return Number(process.env.DAILY_SEND_LIMIT ?? "250");
}

/** Counts messages already sent (or in flight) today, across all clients/batches. */
export async function getSentTodayCount(): Promise<number> {
  const db = getDb();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(messages)
    .where(
      and(
        gte(messages.sentAt, startOfDay),
        inArray(messages.status, ["sending", "sent", "delivered", "read"]),
      ),
    );

  return Number(row?.count ?? 0);
}

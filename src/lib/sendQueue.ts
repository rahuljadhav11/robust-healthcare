import { sql, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { employees, messages } from "@/db/schema";
import { getDailyLimit, getSentTodayCount } from "@/lib/rateLimit";
import { normalizeMobile, sendDocumentTemplate } from "@/lib/msg91";
import { createSendToken } from "@/lib/tokens";
import { getAppUrl } from "@/lib/appUrl";

// Total messages one invocation will attempt, capped further by whatever's
// left of today's DAILY_SEND_LIMIT. Sent with modest concurrency so a full
// day's quota fits comfortably inside a single function's time budget.
const RUN_SIZE = 2000;
const CONCURRENCY = 10;

interface ClaimedMessage extends Record<string, unknown> {
  id: string;
  employee_id: string;
  blob_pathname: string;
  original_filename: string;
}

async function sendOne(db: ReturnType<typeof getDb>, msg: ClaimedMessage) {
  try {
    const [employee] = await db.select().from(employees).where(eq(employees.id, msg.employee_id));
    if (!employee) throw new Error("Employee record missing");

    const token = await createSendToken(msg.id);
    const documentUrl = `${getAppUrl()}/api/reports/${token}`;

    const result = await sendDocumentTemplate({
      to: normalizeMobile(employee.mobile),
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      documentUrl,
      filename: msg.original_filename,
    });

    if (!result.ok) throw new Error(`MSG91 rejected send: ${JSON.stringify(result.raw)}`);

    await db
      .update(messages)
      .set({
        status: "sent",
        msg91MessageId: result.msg91MessageId,
        sentAt: new Date(),
        attempts: sql`${messages.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, msg.id));

    return { id: msg.id, ok: true };
  } catch (err) {
    await db
      .update(messages)
      .set({
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        attempts: sql`${messages.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(messages.id, msg.id));

    return { id: msg.id, ok: false };
  }
}

/** Claims pending messages up to today's remaining quota and sends them with bounded concurrency. */
export async function runSendQueue() {
  const db = getDb();
  const dailyLimit = getDailyLimit();
  const sentToday = await getSentTodayCount();
  const remaining = dailyLimit - sentToday;

  if (remaining <= 0) {
    return { claimed: 0, results: [], reason: "daily limit reached" };
  }

  const claimSize = Math.min(RUN_SIZE, remaining);

  const claimed = await db.execute<ClaimedMessage>(sql`
    UPDATE messages
    SET status = 'sending', updated_at = now()
    WHERE id IN (
      SELECT id FROM messages
      WHERE status = 'pending'
      ORDER BY created_at
      LIMIT ${claimSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, employee_id, blob_pathname, original_filename
  `);

  const results: { id: string; ok: boolean }[] = [];
  const queue = [...claimed.rows];

  async function worker() {
    let msg: ClaimedMessage | undefined;
    while ((msg = queue.shift())) {
      results.push(await sendOne(db, msg));
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () => worker()));

  return { claimed: claimed.rows.length, results };
}

/** Re-attempts a single failed message right away, respecting today's remaining quota. */
export async function retryMessage(messageId: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const dailyLimit = getDailyLimit();
  const sentToday = await getSentTodayCount();
  if (sentToday >= dailyLimit) {
    return { ok: false, error: "Today's WhatsApp sending limit has been reached — this will need to wait until tomorrow." };
  }

  const claimed = await db.execute<ClaimedMessage>(sql`
    UPDATE messages
    SET status = 'sending', updated_at = now()
    WHERE id = ${messageId} AND status = 'failed'
    RETURNING id, employee_id, blob_pathname, original_filename
  `);

  const msg = claimed.rows[0];
  if (!msg) return { ok: false, error: "This message isn't in a failed state, so it can't be retried right now." };

  const result = await sendOne(db, msg);
  return { ok: result.ok };
}

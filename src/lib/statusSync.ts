import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { employees, messages, syncState } from "@/db/schema";
import { fetchWhatsappLogs, normalizeMobile, type WhatsappLogEntry } from "./msg91";

const STATUS_MAP: Record<string, string> = {
  sent: "sent",
  delivered: "delivered",
  read: "read",
  failed: "failed",
};

const CLOCK_SKEW_TOLERANCE_MS = 5_000;
const SYNC_COOLDOWN_SECONDS = 20;

/**
 * Claims the right to actually hit MSG91's API right now — at most once per
 * cooldown window, no matter how many requests ask concurrently. Dashboard
 * pages poll our own DB every few seconds; that's fast and free, but it used
 * to also re-trigger this slow external call on every single poll, which is
 * what made the app feel sluggish. Everyone else just reads whatever the last
 * successful sync left behind.
 */
async function claimSyncSlot(): Promise<boolean> {
  const db = getDb();
  await db.insert(syncState).values({ id: "global", lastSyncedAt: null }).onConflictDoNothing();

  const claimed = await db.execute(sql`
    UPDATE sync_state
    SET last_synced_at = now()
    WHERE id = 'global'
      AND (last_synced_at IS NULL OR last_synced_at < now() - make_interval(secs => ${SYNC_COOLDOWN_SECONDS}))
    RETURNING id
  `);
  return claimed.rows.length > 0;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** MSG91 requestedAt is "YYYY-MM-DD HH:mm:ss" in IST (UTC+5:30), no offset included. */
function parseRequestedAt(requestedAt: string): number {
  return new Date(`${requestedAt.replace(" ", "T")}+05:30`).getTime();
}

interface PendingMessage {
  id: string;
  status: string;
  sentAt: Date | null;
  mobile: string;
}

/**
 * Backfills delivery status (sent -> delivered -> read, or -> failed) for
 * messages we've sent but haven't heard back about, by polling MSG91's own
 * logs — a fallback for when the MSG91 webhook isn't configured, and a way
 * to recover the message id we couldn't parse from the original send response.
 *
 * Matches by phone number, using a time window per message: everything MSG91
 * logged for that number between this message's send time and the next
 * message's send time (or now, for the last one) belongs to this message.
 * A window can hold more than one log row — WhatsApp/Meta can log a
 * redelivery attempt as a fresh row with its own id — so the most recent row
 * in the window (the furthest-progressed status) wins. Positional pairing
 * (row N <-> message N) breaks under exactly this case, which is why this
 * matches per-window instead.
 */
export async function syncSentMessageStatuses(): Promise<{ synced: number; throttled?: boolean }> {
  if (!(await claimSyncSlot())) return { synced: 0, throttled: true };

  const db = getDb();

  const pending: PendingMessage[] = await db
    .select({
      id: messages.id,
      status: messages.status,
      sentAt: messages.sentAt,
      mobile: employees.mobile,
    })
    .from(messages)
    .innerJoin(employees, eq(messages.employeeId, employees.id))
    .where(inArray(messages.status, ["sent"]));

  if (pending.length === 0) return { synced: 0 };

  const today = new Date();
  const lookbackStart = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000); // MSG91 caps the range at 3 days
  const logs = await fetchWhatsappLogs(toDateStr(lookbackStart), toDateStr(today));

  const logsByNumber = new Map<string, WhatsappLogEntry[]>();
  for (const log of logs) {
    const list = logsByNumber.get(log.customerNumber) ?? [];
    list.push(log);
    logsByNumber.set(log.customerNumber, list);
  }
  for (const list of logsByNumber.values()) {
    list.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  }

  const pendingByNumber = new Map<string, PendingMessage[]>();
  for (const msg of pending) {
    const number = normalizeMobile(msg.mobile);
    const list = pendingByNumber.get(number) ?? [];
    list.push(msg);
    pendingByNumber.set(number, list);
  }
  for (const list of pendingByNumber.values()) {
    list.sort((a, b) => (a.sentAt?.getTime() ?? 0) - (b.sentAt?.getTime() ?? 0));
  }

  let synced = 0;
  for (const [number, msgList] of pendingByNumber) {
    const logList = logsByNumber.get(number) ?? [];

    for (let i = 0; i < msgList.length; i++) {
      const msg = msgList[i];
      const windowStart = (msg.sentAt?.getTime() ?? 0) - CLOCK_SKEW_TOLERANCE_MS;
      const windowEnd = i + 1 < msgList.length ? (msgList[i + 1].sentAt?.getTime() ?? Infinity) : Infinity;

      const inWindow = logList.filter((log) => {
        const t = parseRequestedAt(log.requestedAt);
        return t >= windowStart && t < windowEnd;
      });
      if (inWindow.length === 0) continue;

      const mostRecent = inWindow[inWindow.length - 1];
      const mappedStatus = STATUS_MAP[mostRecent.status];
      if (!mappedStatus || mappedStatus === msg.status) continue;

      await db
        .update(messages)
        .set({
          status: mappedStatus,
          msg91MessageId: mostRecent.uuid ?? null,
          error: mappedStatus === "failed" ? mostRecent.failureReason : null,
          updatedAt: new Date(),
        })
        .where(eq(messages.id, msg.id));
      synced++;
    }
  }

  return { synced };
}

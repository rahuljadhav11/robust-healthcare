import { getDb } from "@/db";
import { employees } from "@/db/schema";
import { normalizeMobile } from "./msg91";

/**
 * MSG91's one integrated WhatsApp number receives replies from everyone
 * across every company. This looks up which employee (and therefore which
 * company) a reply came from by normalized phone number, searching globally
 * since inbound webhooks carry no other routing hint. Unmatched senders
 * still get a chat_messages row (employeeId/clientId left null) — nothing
 * is silently dropped just because we don't recognize the number.
 */
export async function matchEmployeeByPhone(rawNumber: string): Promise<{ employeeId: string; clientId: string } | null> {
  const normalized = normalizeMobile(rawNumber);
  const db = getDb();

  const candidates = await db.select({ id: employees.id, clientId: employees.clientId, mobile: employees.mobile }).from(employees);
  const match = candidates.find((e) => normalizeMobile(e.mobile) === normalized);
  return match ? { employeeId: match.id, clientId: match.clientId } : null;
}

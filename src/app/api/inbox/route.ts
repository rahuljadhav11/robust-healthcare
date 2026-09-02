import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAuthorizedUserId } from "@/lib/authz";
import { getDb } from "@/db";

export async function GET() {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const db = getDb();
  // One row per conversation (counterparty number): latest message preview,
  // employee/company name when matched, and how many messages are inbound
  // (a crude but cheap "there's activity here" signal in place of read/unread).
  const result = await db.execute(sql`
    SELECT DISTINCT ON (cm.counterparty_number)
      cm.counterparty_number,
      cm.text_body AS last_text,
      cm.media_filename AS last_media_filename,
      cm.direction AS last_direction,
      cm.message_type AS last_message_type,
      cm.created_at AS last_at,
      e.first_name, e.last_name, e.emp_id,
      c.name AS company_name,
      (SELECT count(*) FROM chat_messages WHERE counterparty_number = cm.counterparty_number) AS message_count
    FROM chat_messages cm
    LEFT JOIN employees e ON e.id = cm.employee_id
    LEFT JOIN clients c ON c.id = cm.client_id
    ORDER BY cm.counterparty_number, cm.created_at DESC
  `);

  const conversations = result.rows.sort(
    (a, b) => new Date(b.last_at as string).getTime() - new Date(a.last_at as string).getTime(),
  );

  return NextResponse.json({ conversations });
}

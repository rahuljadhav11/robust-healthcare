import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export interface EmployeeWithLatestStatus extends Record<string, unknown> {
  id: string;
  emp_id: string;
  first_name: string;
  last_name: string;
  mobile: string;
  message_id: string | null;
  status: string | null;
  error: string | null;
  sent_at: string | null;
  updated_at: string | null;
}

/** One row per employee for a company, carrying their most recent send's status (or nulls if never sent). */
export async function getEmployeesWithLatestStatus(clientId: string): Promise<EmployeeWithLatestStatus[]> {
  const db = getDb();
  const result = await db.execute<EmployeeWithLatestStatus>(sql`
    SELECT DISTINCT ON (e.id)
      e.id, e.emp_id, e.first_name, e.last_name, e.mobile,
      m.id AS message_id, m.status, m.error, m.sent_at, m.updated_at
    FROM employees e
    LEFT JOIN messages m ON m.employee_id = e.id
    WHERE e.client_id = ${clientId}
    ORDER BY e.id, m.created_at DESC NULLS LAST
  `);
  return result.rows;
}

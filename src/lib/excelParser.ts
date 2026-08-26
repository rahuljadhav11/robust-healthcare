import ExcelJS from "exceljs";
import type { ParsedEmployeeRow } from "./matching";

const HEADER_ALIASES: Record<string, string[]> = {
  empId: ["emp_id", "empid", "employee id", "employee_id", "id"],
  name: ["name", "employee name", "full name", "full_name"],
  firstName: ["first_name", "first name", "firstname"],
  lastName: ["last_name", "last name", "lastname"],
  mobile: ["mobile", "phone", "mobile number", "mobile_number", "contact", "contact number", "phone number"],
};

function findColumn(headerRow: string[], aliases: string[]): number {
  return headerRow.findIndex((h) => aliases.includes(h.trim().toLowerCase()));
}

export async function parseEmployeeExcel(buffer: Buffer): Promise<{
  rows: ParsedEmployeeRow[];
  errors: string[];
}> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled types predate the newer Buffer<TArrayBuffer> generic in
  // @types/node, so the two Buffer shapes don't structurally match.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: ["Workbook has no sheets"] };

  const headerRow = (sheet.getRow(1).values as unknown[]).map((v) => String(v ?? ""));
  const empIdCol = findColumn(headerRow, HEADER_ALIASES.empId);
  const nameCol = findColumn(headerRow, HEADER_ALIASES.name);
  const firstNameCol = findColumn(headerRow, HEADER_ALIASES.firstName);
  const lastNameCol = findColumn(headerRow, HEADER_ALIASES.lastName);
  const mobileCol = findColumn(headerRow, HEADER_ALIASES.mobile);

  const errors: string[] = [];
  if (empIdCol === -1) errors.push("Could not find an emp_id column");
  if (mobileCol === -1) errors.push("Could not find a mobile number column");
  if (nameCol === -1 && (firstNameCol === -1 || lastNameCol === -1)) {
    errors.push("Could not find a name column (either 'name', or both 'first_name' and 'last_name')");
  }
  if (errors.length > 0) return { rows: [], errors };

  const rows: ParsedEmployeeRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as unknown[];
    const empId = String(values[empIdCol] ?? "").trim();
    const mobile = String(values[mobileCol] ?? "").trim();
    if (!empId && !mobile) return; // skip blank rows

    let firstName = "";
    let lastName = "";
    if (nameCol !== -1) {
      const full = String(values[nameCol] ?? "").trim();
      const parts = full.split(/\s+/).filter(Boolean);
      // Drop any middle name(s) — PDFs and the WhatsApp greeting both use
      // just first + last, matching the emp_id-first_last.pdf convention.
      firstName = parts[0] ?? "";
      lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    } else {
      firstName = String(values[firstNameCol] ?? "").trim();
      lastName = String(values[lastNameCol] ?? "").trim();
    }

    rows.push({ rowNumber, empId, firstName, lastName, mobile });
  });

  return { rows, errors: [] };
}

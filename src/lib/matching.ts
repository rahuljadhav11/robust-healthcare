export interface ParsedEmployeeRow {
  rowNumber: number;
  empId: string;
  firstName: string;
  lastName: string;
  mobile: string;
}

export function isValidMobile(mobile: string): boolean {
  const digits = mobile.replace(/[^0-9]/g, "");
  return digits.length === 10 || digits.length === 11 || digits.length === 12;
}

/** Extracts the emp_id from a `emp_id-first_last.pdf` filename. */
export function empIdFromFilename(filename: string): string | null {
  const base = filename.replace(/\.pdf$/i, "");
  const dashIndex = base.indexOf("-");
  if (dashIndex === -1) return null;
  return base.slice(0, dashIndex).trim();
}

export interface MatchResult {
  matched: { row: ParsedEmployeeRow; pdfFilename: string }[];
  unmatchedEmployees: ParsedEmployeeRow[];
  unmatchedPdfs: string[];
  invalidMobiles: ParsedEmployeeRow[];
}

export function matchEmployeesToPdfs(rows: ParsedEmployeeRow[], pdfFilenames: string[]): MatchResult {
  const pdfByEmpId = new Map<string, string>();
  for (const filename of pdfFilenames) {
    const empId = empIdFromFilename(filename);
    if (empId) pdfByEmpId.set(empId.toLowerCase(), filename);
  }

  const matched: MatchResult["matched"] = [];
  const unmatchedEmployees: ParsedEmployeeRow[] = [];
  const invalidMobiles: ParsedEmployeeRow[] = [];
  const usedPdfs = new Set<string>();

  for (const row of rows) {
    if (!isValidMobile(row.mobile)) {
      invalidMobiles.push(row);
      continue;
    }
    const pdfFilename = pdfByEmpId.get(row.empId.toLowerCase());
    if (!pdfFilename) {
      unmatchedEmployees.push(row);
      continue;
    }
    matched.push({ row, pdfFilename });
    usedPdfs.add(pdfFilename);
  }

  const unmatchedPdfs = pdfFilenames.filter((f) => !usedPdfs.has(f));

  return { matched, unmatchedEmployees, unmatchedPdfs, invalidMobiles };
}

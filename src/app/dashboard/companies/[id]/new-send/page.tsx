"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, FolderOpen, ShieldCheck, CheckCircle2, AlertTriangle, ListPlus, Search, Eye } from "lucide-react";
import {
  matchEmployeesToPdfs,
  type MatchResult,
  type ParsedEmployeeRow,
} from "@/lib/matching";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MAX_BATCH_BYTES = 80 * 1024 * 1024; // headroom under the 100MB function body limit

function StepNumber({ n, done }: { n: number; done?: boolean }) {
  return (
    <div
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
        done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {done ? <CheckCircle2 className="size-4" /> : n}
    </div>
  );
}

export default function NewSendPage({ params }: PageProps<"/dashboard/companies/[id]/new-send">) {
  const { id: clientId } = use(params);
  const router = useRouter();

  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<ParsedEmployeeRow[] | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const match: MatchResult | null = useMemo(() => {
    if (!rows || pdfFiles.length === 0) return null;
    return matchEmployeesToPdfs(rows, pdfFiles.map((f) => f.name));
  }, [rows, pdfFiles]);

  // Every new match starts fully selected — admins deselect the ones to skip.
  // Adjusted during render (not an effect) so there's no extra render pass.
  const [matchForSelection, setMatchForSelection] = useState<MatchResult | null>(null);
  if (match !== matchForSelection) {
    setMatchForSelection(match);
    setSelectedRows(new Set(match?.matched.map((m) => m.row.rowNumber) ?? []));
  }

  async function handleExcelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-excel", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't read that Excel file");
        return;
      }
      setRows(data.rows);
      toast.success(`${data.rows.length} employees found`);
    } finally {
      setExcelBusy(false);
    }
  }

  function handlePdfFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setPdfFiles(files);
    if (files.length > 0) toast.success(`${files.length} PDFs found`);
  }

  // Files already sit in browser memory, so previewing costs nothing server-side.
  function handlePreviewPdf(filename: string) {
    const file = pdfFiles.find((p) => p.name === filename);
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const filteredMatched = useMemo(() => {
    if (!match) return [];
    const q = matchSearch.trim().toLowerCase();
    if (!q) return match.matched;
    return match.matched.filter(
      (m) =>
        m.row.empId.toLowerCase().includes(q) ||
        m.row.firstName.toLowerCase().includes(q) ||
        m.row.lastName.toLowerCase().includes(q) ||
        m.row.mobile.includes(q) ||
        m.pdfFilename.toLowerCase().includes(q),
    );
  }, [match, matchSearch]);

  const selectedMatched = useMemo(
    () => match?.matched.filter((m) => selectedRows.has(m.row.rowNumber)) ?? [],
    [match, selectedRows],
  );

  function toggleRow(rowNumber: number, checked: boolean) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (checked) next.add(rowNumber);
      else next.delete(rowNumber);
      return next;
    });
  }

  function toggleFiltered(checked: boolean) {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      for (const m of filteredMatched) {
        if (checked) next.add(m.row.rowNumber);
        else next.delete(m.row.rowNumber);
      }
      return next;
    });
  }

  const allFilteredSelected =
    filteredMatched.length > 0 && filteredMatched.every((m) => selectedRows.has(m.row.rowNumber));
  const someFilteredSelected = filteredMatched.some((m) => selectedRows.has(m.row.rowNumber));

  const matchedBytes = selectedMatched.reduce((sum, m) => {
    const f = pdfFiles.find((p) => p.name === m.pdfFilename);
    return sum + (f?.size ?? 0);
  }, 0);
  const overSizeLimit = matchedBytes > MAX_BATCH_BYTES;

  async function handleConfirm() {
    if (!match || selectedMatched.length === 0) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("clientId", clientId);
      if (label.trim()) formData.append("label", label.trim());
      formData.append("unmatchedEmployeesCount", String(match.unmatchedEmployees.length));
      formData.append("unmatchedPdfsCount", String(match.unmatchedPdfs.length));
      formData.append(
        "matchedRows",
        JSON.stringify(
          selectedMatched.map((m) => ({
            empId: m.row.empId,
            firstName: m.row.firstName,
            lastName: m.row.lastName,
            mobile: m.row.mobile,
            pdfFilename: m.pdfFilename,
          })),
        ),
      );
      for (const m of selectedMatched) {
        const file = pdfFiles.find((p) => p.name === m.pdfFilename);
        if (file) formData.append("pdfs", file, file.name);
      }

      const res = await fetch("/api/batches", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't queue this send");
        return;
      }
      toast.success(`${data.queued} employees queued — click "Send now" on the next page when you're ready.`);
      router.push(`/dashboard/companies/${clientId}/sends/${data.batch.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <StepNumber n={1} done={Boolean(rows)} />
            <div>
              <CardTitle>Upload your employee list</CardTitle>
              <CardDescription>An Excel file with columns for employee ID, name, and mobile number.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pl-[52px]">
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="send-label">Name this send (optional)</Label>
              <Input
                id="send-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. August health checkup"
              />
            </div>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-muted">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              {excelBusy ? "Reading…" : rows ? "Choose a different file" : "Choose Excel file"}
              <input type="file" accept=".xlsx,.xls" onChange={handleExcelChange} className="hidden" />
            </label>
            {rows && (
              <p className="text-sm text-muted-foreground">
                <CheckCircle2 className="mr-1 inline size-3.5 text-emerald-600" />
                {rows.length} employees found
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <StepNumber n={2} done={pdfFiles.length > 0} />
            <div>
              <CardTitle>Upload the report PDFs</CardTitle>
              <CardDescription>
                Open the folder in the file picker, then select all (Ctrl/Cmd+A) and open — files should be named
                like <code className="rounded bg-muted px-1 py-0.5 text-xs">1023-Asha_Patel.pdf</code>.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pl-[52px]">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-muted">
              <FolderOpen className="size-4 text-muted-foreground" />
              {pdfFiles.length > 0 ? "Choose different PDF files" : "Choose PDF files"}
              <input type="file" accept=".pdf" multiple onChange={handlePdfFilesChange} className="hidden" />
            </label>
            {pdfFiles.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mr-1 inline size-3.5 text-emerald-600" />
                {pdfFiles.length} PDFs found
              </p>
            )}
          </CardContent>
        </Card>

        {match && (
          <Card>
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <StepNumber n={3} />
              <div>
                <CardTitle>Review before sending</CardTitle>
                <CardDescription>Nothing is sent until you confirm below.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pl-[52px]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-xl font-semibold text-emerald-600">
                    {selectedMatched.length}
                    <span className="text-sm font-normal text-muted-foreground">/{match.matched.length}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Selected to send</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xl font-semibold text-amber-600">{match.unmatchedEmployees.length}</div>
                  <div className="text-xs text-muted-foreground">No PDF found</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xl font-semibold text-amber-600">{match.unmatchedPdfs.length}</div>
                  <div className="text-xs text-muted-foreground">PDF has no employee</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xl font-semibold text-destructive">{match.invalidMobiles.length}</div>
                  <div className="text-xs text-muted-foreground">Invalid mobile number</div>
                </div>
              </div>

              {match.matched.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Who will receive a report</p>
                    <div className="relative w-56">
                      <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={matchSearch}
                        onChange={(e) => setMatchSearch(e.target.value)}
                        placeholder="Search by name, ID, mobile…"
                        className="h-8 pl-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          <TableHead className="w-8">
                            <Checkbox
                              checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                              onCheckedChange={(checked) => toggleFiltered(checked === true)}
                              aria-label="Select all"
                            />
                          </TableHead>
                          <TableHead>Employee ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>Matched PDF</TableHead>
                          <TableHead className="w-8" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMatched.map((m) => (
                          <TableRow key={m.row.rowNumber}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRows.has(m.row.rowNumber)}
                                onCheckedChange={(checked) => toggleRow(m.row.rowNumber, checked === true)}
                                aria-label={`Send to ${m.row.firstName} ${m.row.lastName}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{m.row.empId}</TableCell>
                            <TableCell>
                              {m.row.firstName} {m.row.lastName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{m.row.mobile}</TableCell>
                            <TableCell className="text-muted-foreground">{m.pdfFilename}</TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => handlePreviewPdf(m.pdfFilename)}
                                aria-label={`Preview ${m.pdfFilename}`}
                              >
                                <Eye className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredMatched.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No matches for &quot;{matchSearch}&quot;
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedMatched.length} of {match.matched.length} employees selected to receive a report
                    {matchSearch && ` (showing ${filteredMatched.length} matching "${matchSearch}")`}.
                  </p>
                </div>
              )}

              {overSizeLimit && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>This send is too large</AlertTitle>
                  <AlertDescription>
                    {(matchedBytes / 1024 / 1024).toFixed(0)}MB, over the {MAX_BATCH_BYTES / 1024 / 1024}MB limit per
                    send. Split this into smaller groups and send them separately.
                  </AlertDescription>
                </Alert>
              )}

              {match.unmatchedEmployees.length > 0 && (
                <details className="rounded-md border">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-amber-700">
                    {match.unmatchedEmployees.length} employees without a matching PDF — they won&apos;t be sent
                  </summary>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {match.unmatchedEmployees.slice(0, 200).map((r) => (
                        <TableRow key={r.rowNumber}>
                          <TableCell>{r.empId}</TableCell>
                          <TableCell>
                            {r.firstName} {r.lastName}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              )}

              {match.invalidMobiles.length > 0 && (
                <details className="rounded-md border">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-destructive">
                    {match.invalidMobiles.length} employees with an invalid mobile number — they won&apos;t be sent
                  </summary>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Mobile</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {match.invalidMobiles.slice(0, 200).map((r) => (
                        <TableRow key={r.rowNumber}>
                          <TableCell>{r.empId}</TableCell>
                          <TableCell>{r.mobile}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              )}

              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" />
                Each report is sent as a private, unguessable link only WhatsApp can fetch — never a public URL.
              </div>

              <div className="space-y-2">
                <Button
                  onClick={handleConfirm}
                  disabled={busy || selectedMatched.length === 0 || overSizeLimit}
                  size="lg"
                >
                  <ListPlus />
                  {busy ? "Queueing…" : `Queue ${selectedMatched.length} employees`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  This adds them to the send queue — you&apos;ll click a separate &quot;Send now&quot; button on the
                  next page whenever you&apos;re ready to actually notify them.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

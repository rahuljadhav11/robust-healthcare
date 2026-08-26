"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, FolderOpen, ShieldCheck, CheckCircle2, AlertTriangle, Send } from "lucide-react";
import {
  matchEmployeesToPdfs,
  type MatchResult,
  type ParsedEmployeeRow,
} from "@/lib/matching";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const MAX_BATCH_BYTES = 80 * 1024 * 1024; // headroom under the 100MB function body limit

interface ClientOption {
  id: string;
  name: string;
}

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

export default function NewBatchPage() {
  const router = useRouter();
  const dirInputRef = useRef<HTMLInputElement>(null);

  const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState("");
  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<ParsedEmployeeRow[] | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);

  useEffect(() => {
    dirInputRef.current?.setAttribute("webkitdirectory", "true");
    dirInputRef.current?.setAttribute("directory", "true");
  }, []);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setClientOptions(d.clients ?? []));
  }, []);

  const match: MatchResult | null = useMemo(() => {
    if (!rows || pdfFiles.length === 0) return null;
    return matchEmployeesToPdfs(rows, pdfFiles.map((f) => f.name));
  }, [rows, pdfFiles]);

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

  function handlePdfFolderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setPdfFiles(files);
    if (files.length > 0) toast.success(`${files.length} PDFs found`);
  }

  const matchedBytes =
    match?.matched.reduce((sum, m) => {
      const f = pdfFiles.find((p) => p.name === m.pdfFilename);
      return sum + (f?.size ?? 0);
    }, 0) ?? 0;
  const overSizeLimit = matchedBytes > MAX_BATCH_BYTES;

  async function handleConfirm() {
    if (!match || !clientId || !label.trim()) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("clientId", clientId);
      formData.append("label", label.trim());
      formData.append("unmatchedEmployeesCount", String(match.unmatchedEmployees.length));
      formData.append("unmatchedPdfsCount", String(match.unmatchedPdfs.length));
      formData.append(
        "matchedRows",
        JSON.stringify(
          match.matched.map((m) => ({
            empId: m.row.empId,
            firstName: m.row.firstName,
            lastName: m.row.lastName,
            mobile: m.row.mobile,
            pdfFilename: m.pdfFilename,
          })),
        ),
      );
      for (const m of match.matched) {
        const file = pdfFiles.find((p) => p.name === m.pdfFilename);
        if (file) formData.append("pdfs", file, file.name);
      }

      const res = await fetch("/api/batches", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't queue this batch");
        return;
      }
      toast.success("Reports queued for sending");
      router.push(`/dashboard/batches/${data.batch.id}`);
    } finally {
      setBusy(false);
    }
  }

  const step1Done = Boolean(clientId && label.trim());

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Send reports</h1>
        <p className="text-sm text-muted-foreground">
          Upload your employee list and report PDFs — we&apos;ll match each employee to their report automatically.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <StepNumber n={1} done={step1Done} />
            <div>
              <CardTitle>Which company are these reports for?</CardTitle>
              <CardDescription>Reports are always sent for one company at a time.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 pl-[52px]">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {clientOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientOptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No companies yet — add one from the Overview page first.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="batch-label">Batch name</Label>
              <Input
                id="batch-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. August health checkup"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <StepNumber n={2} done={Boolean(rows)} />
            <div>
              <CardTitle>Upload your employee list</CardTitle>
              <CardDescription>An Excel file with columns for employee ID, name, and mobile number.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pl-[52px]">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-muted">
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              {excelBusy ? "Reading…" : rows ? "Choose a different file" : "Choose Excel file"}
              <input type="file" accept=".xlsx,.xls" onChange={handleExcelChange} className="hidden" />
            </label>
            {rows && (
              <p className="mt-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mr-1 inline size-3.5 text-emerald-600" />
                {rows.length} employees found
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <StepNumber n={3} done={pdfFiles.length > 0} />
            <div>
              <CardTitle>Upload the report PDFs</CardTitle>
              <CardDescription>
                Select the whole folder — files should be named like{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">1023-Asha_Patel.pdf</code>.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pl-[52px]">
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-muted">
              <FolderOpen className="size-4 text-muted-foreground" />
              {pdfFiles.length > 0 ? "Choose a different folder" : "Choose PDF folder"}
              <input ref={dirInputRef} type="file" onChange={handlePdfFolderChange} className="hidden" />
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
              <StepNumber n={4} />
              <div>
                <CardTitle>Review before sending</CardTitle>
                <CardDescription>Nothing is sent until you confirm below.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pl-[52px]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md border p-3">
                  <div className="text-xl font-semibold text-emerald-600">{match.matched.length}</div>
                  <div className="text-xs text-muted-foreground">Ready to send</div>
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

              {overSizeLimit && (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertTitle>This batch is too large</AlertTitle>
                  <AlertDescription>
                    {(matchedBytes / 1024 / 1024).toFixed(0)}MB, over the {MAX_BATCH_BYTES / 1024 / 1024}MB limit per
                    batch. Split this into smaller groups and send them as separate batches.
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
                Each report is sent as a private, expiring link — never a public URL. Only WhatsApp can fetch it, and
                only for a few minutes.
              </div>

              <Button
                onClick={handleConfirm}
                disabled={busy || !clientId || !label.trim() || match.matched.length === 0 || overSizeLimit}
                size="lg"
              >
                <Send />
                {busy ? "Queueing…" : `Send to ${match.matched.length} employees`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

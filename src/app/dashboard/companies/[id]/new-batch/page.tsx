"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileSpreadsheet, FolderOpen, ShieldCheck, CheckCircle2, AlertTriangle, ListPlus, Search, Eye, Users, FileX, FileWarning, PhoneOff, Loader2 } from "lucide-react";
import {
  matchEmployeesToPdfs,
  type MatchResult,
  type ParsedEmployeeRow,
} from "@/lib/matching";
import { uploadPdfsToBlob } from "@/lib/blobUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatCard } from "@/components/stat-card";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PdfUploadState {
  status: "uploading" | "done" | "error";
  progress: number;
  blobUrl?: string;
  blobPathname?: string;
  error?: string;
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

export default function NewBatchPage({ params }: PageProps<"/dashboard/companies/[id]/new-batch">) {
  const { id: clientId } = use(params);
  const router = useRouter();

  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<ParsedEmployeeRow[] | null>(null);
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<Map<string, PdfUploadState>>(new Map());
  const [uploadingPdfs, setUploadingPdfs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const [matchSearch, setMatchSearch] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [excelDragOver, setExcelDragOver] = useState(false);
  const [pdfDragOver, setPdfDragOver] = useState(false);

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

  async function handleExcelFile(file: File | undefined) {
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

  function handlePdfFiles(fileList: FileList | File[] | null | undefined) {
    const files = Array.from(fileList ?? []).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setPdfFiles(files);
    setUploads(new Map());
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

  // Files this run of "Queue" is actively uploading — drives the progress bar.
  const [uploadBatch, setUploadBatch] = useState<string[]>([]);
  const uploadBatchDone = uploadBatch.filter((name) => uploads.get(name)?.status === "done").length;

  const allSelectedUploaded =
    selectedMatched.length > 0 && selectedMatched.every((m) => uploads.get(m.pdfFilename)?.status === "done");
  const anySelectedFailed = selectedMatched.some((m) => uploads.get(m.pdfFilename)?.status === "error");

  // Applies a batch of changes to the uploads map immutably in one setState call.
  function patchUploads(entries: [string, PdfUploadState][]) {
    setUploads((prev) => {
      const next = new Map(prev);
      for (const [name, state] of entries) next.set(name, state);
      return next;
    });
  }

  async function handleUploadClick() {
    if (!match || selectedMatched.length === 0) return;
    setBusy(true);
    try {
      const alreadyDone = new Set(
        [...uploads.entries()].filter(([, u]) => u.status === "done").map(([name]) => name),
      );
      const neededNames = new Set(selectedMatched.map((m) => m.pdfFilename));
      const filesToUpload = pdfFiles.filter((f) => neededNames.has(f.name) && !alreadyDone.has(f.name));
      if (filesToUpload.length === 0) return;

      setUploadingPdfs(true);
      setUploadBatch(filesToUpload.map((f) => f.name));
      patchUploads(filesToUpload.map((f) => [f.name, { status: "uploading", progress: 0 }]));

      const startedAt = Date.now();
      const { results, failures } = await uploadPdfsToBlob(filesToUpload, clientId, (file, percentage) => {
        patchUploads([[file.name, { status: "uploading", progress: percentage }]]);
      });

      patchUploads([
        ...results.map((r): [string, PdfUploadState] => [
          r.file.name,
          { status: "done", progress: 100, blobUrl: r.url, blobPathname: r.pathname },
        ]),
        ...failures.map((f): [string, PdfUploadState] => [f.file.name, { status: "error", progress: 0, error: f.error }]),
      ]);

      // A handful of small PDFs can upload in well under a second — keep the
      // progress bar on screen for a perceptible minimum so it doesn't just flash by.
      const MIN_VISIBLE_MS = 600;
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_VISIBLE_MS) await new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_MS - elapsed));

      if (failures.length > 0) {
        toast.error(
          `${failures.length} of ${filesToUpload.length} PDFs failed to upload — click "Retry upload" to try just those again.`,
        );
      } else {
        toast.success(`${results.length} PDF${results.length === 1 ? "" : "s"} uploaded — review and create the batch below.`);
      }
    } finally {
      setUploadingPdfs(false);
      setUploadBatch([]);
      setBusy(false);
    }
  }

  async function handleCreateBatch() {
    if (!match || selectedMatched.length === 0) return;
    setBusy(true);
    try {
      const matchedRowsPayload = selectedMatched.map((m) => {
        const u = uploads.get(m.pdfFilename);
        return {
          empId: m.row.empId,
          firstName: m.row.firstName,
          lastName: m.row.lastName,
          mobile: m.row.mobile,
          pdfFilename: m.pdfFilename,
          blobUrl: u?.blobUrl,
          blobPathname: u?.blobPathname,
        };
      });

      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          label: label.trim() || undefined,
          unmatchedEmployeesCount: match.unmatchedEmployees.length,
          unmatchedPdfsCount: match.unmatchedPdfs.length,
          matchedRows: matchedRowsPayload,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't create this batch — please try again.");
        return;
      }
      toast.success(`${data.queued} employees queued — click "Send now" on the next page when you're ready.`);
      router.push(`/dashboard/companies/${clientId}/batches/${data.batch.id}`);
    } catch {
      toast.error("Network issue — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <StepNumber n={1} done={Boolean(rows)} />
            <div>
              <CardTitle>Upload your employee list</CardTitle>
              <CardDescription>An Excel file with columns for employee ID, name, and mobile number.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pl-[52px]">
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="batch-label">Name this batch (optional)</Label>
              <Input
                id="batch-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. August health checkup"
              />
            </div>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setExcelDragOver(true);
              }}
              onDragLeave={() => setExcelDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setExcelDragOver(false);
                handleExcelFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex w-fit cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors",
                excelDragOver ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
            >
              <FileSpreadsheet className="size-4 text-muted-foreground" />
              {excelBusy ? "Reading…" : rows ? "Choose a different file" : "Choose or drop an Excel file"}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => handleExcelFile(e.target.files?.[0])}
                className="hidden"
              />
            </label>
            {rows && (
              <p className="text-sm text-muted-foreground">
                <CheckCircle2 className="mr-1 inline size-3.5 text-chat" />
                {rows.length} employees found
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
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
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setPdfDragOver(true);
              }}
              onDragLeave={() => setPdfDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setPdfDragOver(false);
                handlePdfFiles(e.dataTransfer.files);
              }}
              className={cn(
                "flex w-fit cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm transition-colors",
                pdfDragOver ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
            >
              <FolderOpen className="size-4 text-muted-foreground" />
              {pdfFiles.length > 0 ? "Choose different PDF files" : "Choose or drop PDF files"}
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => handlePdfFiles(e.target.files)}
                className="hidden"
              />
            </label>
            {pdfFiles.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                <CheckCircle2 className="mr-1 inline size-3.5 text-chat" />
                {pdfFiles.length} PDFs found
              </p>
            )}
          </CardContent>
        </Card>

        {match && (
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-start gap-3 space-y-0">
              <StepNumber n={3} />
              <div>
                <CardTitle>Review before sending</CardTitle>
                <CardDescription>Nothing is sent until you confirm below.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pl-[52px]">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  icon={Users}
                  label="Selected to send"
                  value={`${selectedMatched.length}/${match.matched.length}`}
                  tone="success"
                />
                <StatCard icon={FileX} label="No PDF found" value={match.unmatchedEmployees.length} tone="warning" />
                <StatCard icon={FileWarning} label="PDF has no employee" value={match.unmatchedPdfs.length} tone="warning" />
                <StatCard icon={PhoneOff} label="Invalid mobile number" value={match.invalidMobiles.length} tone="destructive" />
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
                    <Table className="table-fixed" containerClassName="overflow-visible">
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="w-8">
                            <Checkbox
                              checked={allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false}
                              onCheckedChange={(checked) => toggleFiltered(checked === true)}
                              aria-label="Select all"
                            />
                          </TableHead>
                          <TableHead className="w-28">Employee ID</TableHead>
                          <TableHead className="w-40">Name</TableHead>
                          <TableHead className="w-32">Mobile</TableHead>
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
                            <TableCell className="truncate font-medium">{m.row.empId}</TableCell>
                            <TableCell className="truncate">
                              {m.row.firstName} {m.row.lastName}
                            </TableCell>
                            <TableCell className="truncate text-muted-foreground">{m.row.mobile}</TableCell>
                            <TableCell className="whitespace-normal break-words text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                {uploads.get(m.pdfFilename)?.status === "done" && (
                                  <CheckCircle2 className="size-3.5 shrink-0 text-chat" />
                                )}
                                {uploads.get(m.pdfFilename)?.status === "error" && (
                                  <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                                )}
                                {uploads.get(m.pdfFilename)?.status === "uploading" && (
                                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                                )}
                                {m.pdfFilename}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Tooltip>
                                <TooltipTrigger asChild>
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
                                </TooltipTrigger>
                                <TooltipContent>Preview PDF</TooltipContent>
                              </Tooltip>
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


              {(match.unmatchedEmployees.length > 0 || match.invalidMobiles.length > 0) && (
                <Accordion type="multiple" className="rounded-lg border px-3">
                  {match.unmatchedEmployees.length > 0 && (
                    <AccordionItem value="unmatched">
                      <AccordionTrigger className="text-amber-700 dark:text-amber-400">
                        {match.unmatchedEmployees.length} employees without a matching PDF — they won&apos;t be sent
                      </AccordionTrigger>
                      <AccordionContent>
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
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {match.invalidMobiles.length > 0 && (
                    <AccordionItem value="invalid-mobiles">
                      <AccordionTrigger className="text-destructive">
                        {match.invalidMobiles.length} employees with an invalid mobile number — they won&apos;t be
                        sent
                      </AccordionTrigger>
                      <AccordionContent>
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
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              )}

              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0" />
                Each report is sent as a private, unguessable link only WhatsApp can fetch — never a public URL.
              </div>

              <div className="space-y-2">
                {uploadingPdfs && (
                  <div className="w-1/2 min-w-[280px] space-y-1.5">
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Uploading PDFs…
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-full overflow-hidden rounded-full border border-border bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                          style={{
                            width: `${uploadBatch.length > 0 ? (uploadBatchDone / uploadBatch.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {uploadBatchDone}/{uploadBatch.length} files
                      </span>
                    </div>
                  </div>
                )}
                {allSelectedUploaded ? (
                  <Button onClick={handleCreateBatch} disabled={busy} size="lg">
                    <ListPlus />
                    {busy
                      ? "Creating batch…"
                      : `${selectedMatched.length} PDF${selectedMatched.length === 1 ? "" : "s"} uploaded — create batch`}
                  </Button>
                ) : (
                  <Button onClick={handleUploadClick} disabled={busy || selectedMatched.length === 0} size="lg">
                    <ListPlus />
                    {uploadingPdfs ? "Uploading…" : anySelectedFailed ? "Retry upload" : `Queue ${selectedMatched.length} employees`}
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">
                  {uploadingPdfs
                    ? "Uploading the matched PDFs — this can take a moment for a large batch."
                    : allSelectedUploaded
                      ? "PDFs are uploaded. Creating the batch adds them to the send queue — you'll click a separate \"Send now\" button on the next page whenever you're ready to actually notify them."
                      : anySelectedFailed
                        ? "Some PDFs failed to upload — retry uploads just those before creating the batch."
                        : "PDFs upload first, then you'll get a chance to create the batch."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

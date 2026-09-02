"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { Send, PartyPopper, Eye, RotateCw, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { humanizeError } from "@/lib/errorMessages";

interface MessageRow {
  id: string;
  status: string;
  error: string | null;
  attempts: number;
  sentAt: string | null;
  empId: string;
  firstName: string;
  lastName: string;
  mobile: string;
}

interface BatchDetail {
  batch: { id: string; sequence: number; label: string | null; totalMatched: number };
  messages: MessageRow[];
  summary: Record<string, number>;
}

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  sending: { label: "Sending", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  delivered: { label: "Delivered", variant: "default" },
  read: { label: "Read", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function BatchDetailPage({ params }: PageProps<"/dashboard/companies/[id]/batches/[batchId]">) {
  const { batchId } = use(params);
  const [data, setData] = useState<BatchDetail | null>(null);
  const [sending, setSending] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/batches/${batchId}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const res = await fetch(`/api/batches/${batchId}`);
      if (!cancelled && res.ok) setData(await res.json());
    }
    tick();
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [batchId]);

  async function handleSendNow() {
    setSending(true);
    try {
      const res = await fetch("/api/batches/send-now", { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "Couldn't send right now");
        return;
      }
      if (result.reason === "daily limit reached") {
        toast.info("Today's WhatsApp sending limit has been reached — the rest will go out tomorrow.");
      } else {
        const ok = result.results.filter((r: { ok: boolean }) => r.ok).length;
        toast.success(`Sent ${ok} of ${result.claimed} attempted`);
      }
      load();
    } finally {
      setSending(false);
    }
  }

  async function handleRetry(messageId: string) {
    setRetrying(messageId);
    try {
      const res = await fetch(`/api/messages/${messageId}/retry`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error ?? "Couldn't retry this message");
        return;
      }
      toast[result.ok ? "success" : "error"](result.ok ? "Sent successfully" : "Still failed — see the error below");
      load();
    } finally {
      setRetrying(null);
    }
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const total = data.batch.totalMatched;
  const done = (data.summary.sent ?? 0) + (data.summary.delivered ?? 0) + (data.summary.read ?? 0);
  const failed = data.summary.failed ?? 0;
  const pending = (data.summary.pending ?? 0) + (data.summary.sending ?? 0);
  const progressPct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
  const allDone = pending === 0 && total > 0;
  const notStartedYet = total > 0 && pending === total;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold">
          Batch #{data.batch.sequence}
          {data.batch.label && <span className="font-normal text-muted-foreground"> — {data.batch.label}</span>}
        </h2>
        <Button onClick={handleSendNow} disabled={sending || pending === 0} size={notStartedYet ? "lg" : "default"}>
          <Send />
          {sending ? "Sending…" : "Send now"}
        </Button>
      </div>

      {notStartedYet && (
        <Alert className="border-primary/30 bg-primary/5">
          <MousePointerClick />
          <AlertTitle>Ready to send</AlertTitle>
          <AlertDescription>
            {total} employee{total === 1 ? "" : "s"} queued and waiting. Nothing has been sent yet — click{" "}
            <strong>Send now</strong> above when you&apos;re ready to notify them.
          </AlertDescription>
        </Alert>
      )}

      {allDone && failed === 0 && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-600">
          <PartyPopper />
          <AlertTitle>All reports delivered</AlertTitle>
          <AlertDescription className="text-emerald-800">
            Every employee in this batch has received their report.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{progressPct}% complete</span>
              <span className="text-muted-foreground">{total} total employees</span>
            </div>
            <Progress value={progressPct} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-xl font-semibold text-emerald-600">{done}</div>
              <div className="text-xs text-muted-foreground">Sent</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xl font-semibold text-amber-600">{pending}</div>
              <div className="text-xs text-muted-foreground">Pending (daily cap applies)</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xl font-semibold text-destructive">{failed}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason (if failed)</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.messages.map((m) => {
                const badge = STATUS_BADGE[m.status] ?? { label: m.status, variant: "outline" as const };
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.empId} — {m.firstName} {m.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.mobile}</TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-destructive">
                      {m.status === "failed" ? humanizeError(m.error) : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="size-7" asChild>
                          <a href={`/api/messages/${m.id}/preview`} target="_blank" rel="noopener noreferrer">
                            <Eye className="size-3.5" />
                          </a>
                        </Button>
                        {m.status === "failed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={retrying === m.id}
                            onClick={() => handleRetry(m.id)}
                          >
                            <RotateCw className={`size-3.5 ${retrying === m.id ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

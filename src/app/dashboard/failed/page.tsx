"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle, Eye, RotateCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { humanizeError } from "@/lib/errorMessages";

interface FailedMessage {
  id: string;
  error: string | null;
  attempts: number;
  updatedAt: string;
  empId: string;
  firstName: string;
  lastName: string;
  mobile: string;
  companyId: string;
  companyName: string;
  batchId: string;
  batchSequence: number;
}

export default function FailedPage() {
  const [failed, setFailed] = useState<FailedMessage[] | null>(null);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/failed");
    if (res.ok) setFailed((await res.json()).failed);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/failed")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setFailed(data.failed);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!failed) return [];
    const q = search.trim().toLowerCase();
    if (!q) return failed;
    return failed.filter(
      (f) =>
        f.empId.toLowerCase().includes(q) ||
        f.firstName.toLowerCase().includes(q) ||
        f.lastName.toLowerCase().includes(q) ||
        f.companyName.toLowerCase().includes(q) ||
        f.mobile.includes(q),
    );
  }, [failed, search]);

  async function handleRetry(messageId: string) {
    setRetrying(messageId);
    try {
      const res = await fetch(`/api/messages/${messageId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't retry this message");
        return;
      }
      toast[data.ok ? "success" : "error"](data.ok ? "Sent successfully" : "Still failed — reason updated below");
      load();
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-8">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <AlertCircle className="size-5 text-destructive" />
          Failed messages
        </h1>
        <p className="text-sm text-muted-foreground">Every failed send, across every company, in one place.</p>
      </div>

      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-7" />
      </div>

      {failed === null ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <Card className="shadow-sm">
          <CardContent className="pt-6">
            {filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {failed.length === 0 ? "Nothing failed — everything sent is either delivered or on its way." : `No matches for "${search}"`}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <Link href={`/dashboard/companies/${f.companyId}/batches/${f.batchId}`} className="hover:underline">
                          {f.companyName}
                        </Link>
                        <div className="text-xs text-muted-foreground">Batch #{f.batchSequence}</div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {f.empId} — {f.firstName} {f.lastName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{f.mobile}</TableCell>
                      <TableCell className="max-w-[280px] text-xs text-destructive">{humanizeError(f.error)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="size-7" asChild>
                            <a href={`/api/messages/${f.id}/preview`} target="_blank" rel="noopener noreferrer">
                              <Eye className="size-3.5" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={retrying === f.id}
                            onClick={() => handleRetry(f.id)}
                          >
                            <RotateCw className={`size-3.5 ${retrying === f.id ? "animate-spin" : ""}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
      {failed && failed.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <Badge variant="destructive" className="mr-1">
            {failed.length}
          </Badge>
          total failed message{failed.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}

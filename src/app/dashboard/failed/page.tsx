"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, RotateCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CompanyAvatar } from "@/components/company-avatar";
import { PaginationBar } from "@/components/pagination-bar";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { humanizeError } from "@/lib/errorMessages";

const PAGE_SIZE = 50;

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

interface CompanyGroup {
  companyId: string;
  companyName: string;
  items: FailedMessage[];
}

export default function FailedPage() {
  const [failed, setFailed] = useState<FailedMessage[] | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/failed", { cache: "no-store" });
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

  const companyGroups = useMemo<CompanyGroup[]>(() => {
    if (!failed) return [];
    const byCompany = new Map<string, CompanyGroup>();
    for (const f of failed) {
      const group = byCompany.get(f.companyId);
      if (group) group.items.push(f);
      else byCompany.set(f.companyId, { companyId: f.companyId, companyName: f.companyName, items: [f] });
    }
    return [...byCompany.values()].sort((a, b) => b.items.length - a.items.length);
  }, [failed]);

  const filteredCompanyGroups = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return companyGroups;
    return companyGroups.filter((g) => g.companyName.toLowerCase().includes(q));
  }, [companyGroups, companySearch]);

  const selectedGroup = companyGroups.find((g) => g.companyId === selectedCompanyId) ?? null;

  const filtered = useMemo(() => {
    if (!selectedGroup) return [];
    const q = search.trim().toLowerCase();
    if (!q) return selectedGroup.items;
    return selectedGroup.items.filter(
      (f) =>
        f.empId.toLowerCase().includes(q) ||
        f.firstName.toLowerCase().includes(q) ||
        f.lastName.toLowerCase().includes(q) ||
        f.mobile.includes(q),
    );
  }, [selectedGroup, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  function openCompany(companyId: string) {
    setSelectedCompanyId(companyId);
    setSearch("");
    setPage(1);
  }

  function backToCompanies() {
    setSelectedCompanyId(null);
    setSearch("");
    setPage(1);
  }

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

  const totalFailed = failed?.length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-8">
      <PageHeader
        icon={AlertCircle}
        title="Failed messages"
        description={
          selectedGroup
            ? `Failed sends for ${selectedGroup.companyName}.`
            : "Every failed send, grouped by company — click a company to see the details."
        }
      />

      {failed === null ? (
        <Skeleton className="h-96 w-full" />
      ) : !selectedGroup ? (
        <>
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={companySearch}
              onChange={(e) => setCompanySearch(e.target.value)}
              placeholder="Search companies…"
              className="pl-7"
            />
          </div>

          {companyGroups.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent>
                <EmptyState
                  icon={CheckCircle2}
                  tone="success"
                  title="Nothing failed"
                  description="Everything sent is either delivered or on its way."
                />
              </CardContent>
            </Card>
          ) : filteredCompanyGroups.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No companies matching &quot;{companySearch}&quot;
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCompanyGroups.map((g) => (
                <button
                  key={g.companyId}
                  onClick={() => openCompany(g.companyId)}
                  className="text-left"
                >
                  <Card className="h-full border-none shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <CardContent className="flex items-center justify-between gap-3 pt-6">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <CompanyAvatar name={g.companyName} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{g.companyName}</div>
                          <div className="text-xs text-muted-foreground">
                            {g.items.length} failed message{g.items.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                      <Badge variant="destructive" className="shrink-0">
                        {g.items.length}
                      </Badge>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}

          {totalFailed > 0 && (
            <p className="text-xs text-muted-foreground">
              <Badge variant="destructive" className="mr-1">
                {totalFailed}
              </Badge>
              total failed message{totalFailed === 1 ? "" : "s"} across {companyGroups.length} compan
              {companyGroups.length === 1 ? "y" : "ies"}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="sm" onClick={backToCompanies}>
              <ArrowLeft className="size-3.5" />
              Back to companies
            </Button>
            <div className="relative w-72">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, ID, mobile…"
                className="pl-7"
              />
            </div>
          </div>

          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No matches for &quot;{search}&quot;
                </p>
              ) : (
                <div className="rounded-xl border">
                  <div className="max-h-[65vh] overflow-y-auto">
                    <Table className="table-fixed" containerClassName="overflow-visible">
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="w-28">Employee ID</TableHead>
                          <TableHead className="w-44">Name</TableHead>
                          <TableHead className="w-32">Mobile</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="w-24" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((f) => (
                          <TableRow key={f.id}>
                            <TableCell className="align-top font-medium">{f.empId}</TableCell>
                            <TableCell className="align-top whitespace-normal break-words">
                              {f.firstName} {f.lastName}
                            </TableCell>
                            <TableCell className="align-top text-muted-foreground">{f.mobile}</TableCell>
                            <TableCell className="align-top text-xs whitespace-normal break-words text-destructive">
                              {humanizeError(f.error)}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="size-7" asChild>
                                      <a href={`/api/messages/${f.id}/preview`} target="_blank" rel="noopener noreferrer">
                                        <Eye className="size-3.5" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Preview message</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-7"
                                      disabled={retrying === f.id}
                                      onClick={() => handleRetry(f.id)}
                                    >
                                      <RotateCw className={`size-3.5 ${retrying === f.id ? "animate-spin" : ""}`} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Retry send</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <PaginationBar page={page} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

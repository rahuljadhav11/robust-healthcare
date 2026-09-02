"use client";

import { use, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, RotateCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import type { EmployeeWithLatestStatus } from "@/lib/employeeStatus";
import { StatusBadge } from "@/components/status-badge";

export default function EmployeesPage({ params }: PageProps<"/dashboard/companies/[id]/employees">) {
  const { id } = use(params);
  const [employees, setEmployees] = useState<EmployeeWithLatestStatus[] | null>(null);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/companies/${id}/employees`);
    if (!res.ok) return;
    const data = await res.json();
    setEmployees(data.employees);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/companies/${id}/employees`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setEmployees(data.employees);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const filtered = useMemo(() => {
    if (!employees) return [];
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.emp_id.toLowerCase().includes(q) ||
        e.first_name.toLowerCase().includes(q) ||
        e.last_name.toLowerCase().includes(q) ||
        e.mobile.includes(q),
    );
  }, [employees, search]);

  async function handleRetry(messageId: string) {
    setRetrying(messageId);
    try {
      const res = await fetch(`/api/messages/${messageId}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't retry this message");
        return;
      }
      if (data.ok) toast.success("Sent successfully");
      else toast.error("Still failed — check the error again");
      load();
    } finally {
      setRetrying(null);
    }
  }

  if (!employees) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative w-72">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, ID, mobile…"
          className="pl-7"
        />
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Latest status</TableHead>
              <TableHead>Reason (if failed)</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((e) => {
              return (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.emp_id}</TableCell>
                  <TableCell>
                    {e.first_name} {e.last_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.mobile}</TableCell>
                  <TableCell>
                    {e.status ? <StatusBadge status={e.status} /> : <span className="text-muted-foreground text-xs">Never sent</span>}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate text-xs text-destructive">
                    {e.status === "failed" ? humanizeError(e.error) : ""}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {e.message_id && (
                        <Button variant="ghost" size="icon" className="size-7" asChild>
                          <a href={`/api/messages/${e.message_id}/preview`} target="_blank" rel="noopener noreferrer">
                            <Eye className="size-3.5" />
                          </a>
                        </Button>
                      )}
                      {e.status === "failed" && e.message_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={retrying === e.message_id}
                          onClick={() => handleRetry(e.message_id!)}
                        >
                          <RotateCw className={`size-3.5 ${retrying === e.message_id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {employees.length === 0 ? "No employees yet — send a batch to add some." : `No matches for "${search}"`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

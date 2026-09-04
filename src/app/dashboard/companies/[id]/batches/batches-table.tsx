"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";

const PAGE_SIZE = 50;

export interface BatchRow {
  id: string;
  sequence: number;
  label: string | null;
  totalMatched: number;
  createdAt: string;
  sent: number;
  failed: number;
  pending: number;
}

export function BatchesTable({ companyId, batches }: { companyId: string; batches: BatchRow[] }) {
  const [page, setPage] = useState(1);

  const paginated = useMemo(
    () => batches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [batches, page],
  );

  return (
    <div className="rounded-xl">
      <div className="max-h-[65vh] overflow-y-auto">
        <Table className="table-fixed" containerClassName="overflow-visible">
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Batch</TableHead>
              <TableHead className="w-36">Date</TableHead>
              <TableHead className="w-28">Employees</TableHead>
              <TableHead className="w-56 text-right">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((s) => (
              <TableRow key={s.id} className="hover:bg-muted/60">
                <TableCell className="align-top font-medium whitespace-normal break-words">
                  <Link href={`/dashboard/companies/${companyId}/batches/${s.id}`} className="hover:underline">
                    Batch #{s.sequence}
                    {s.label && <span className="font-normal text-muted-foreground"> — {s.label}</span>}
                  </Link>
                </TableCell>
                <TableCell className="align-top text-muted-foreground">
                  {new Date(s.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell className="align-top text-muted-foreground">{s.totalMatched}</TableCell>
                <TableCell className="align-top text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant="default">{s.sent} sent</Badge>
                    {s.pending > 0 && <Badge variant="secondary">{s.pending} pending</Badge>}
                    {s.failed > 0 && <Badge variant="destructive">{s.failed} failed</Badge>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationBar page={page} pageSize={PAGE_SIZE} totalItems={batches.length} onPageChange={setPage} />
    </div>
  );
}

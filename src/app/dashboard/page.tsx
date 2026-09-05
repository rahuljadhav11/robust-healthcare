import Link from "next/link";
import { AlertCircle, Building2, CheckCircle2, ChevronRight, Clock, Users } from "lucide-react";
import { getAllCompanyStats } from "@/lib/companyStats";
import { AddCompanySheet } from "@/components/add-company-sheet";
import { CompanyAvatar } from "@/components/company-avatar";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";

export default async function CompaniesPage() {
  const companies = await getAllCompanyStats();

  const totals = companies.reduce(
    (acc, c) => ({
      employees: acc.employees + c.employeeCount,
      delivered: acc.delivered + c.delivered,
      pending: acc.pending + c.pending,
      failed: acc.failed + c.failed,
    }),
    { employees: 0, delivered: 0, pending: 0, failed: 0 },
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <PageHeader
        title="Companies"
        description="Each company's employees, batches, and delivery status are kept completely separate."
        action={<AddCompanySheet />}
      />

      {companies.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Building2}
              title="No companies yet"
              description="Add the first company you're sending reports for."
              action={<AddCompanySheet />}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Building2} label="Companies" value={companies.length} tone="muted" />
            <StatCard icon={Users} label="Employees" value={totals.employees} tone="muted" />
            <StatCard icon={CheckCircle2} label="Delivered" value={totals.delivered} tone="success" />
            <StatCard icon={AlertCircle} label="Failed" value={totals.failed} tone="destructive" />
          </div>

          <div className="grid animate-in fade-in gap-4 duration-300 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => {
              const total = c.delivered + c.pending + c.failed;
              const deliveredPct = total > 0 ? (c.delivered / total) * 100 : 0;
              const failedPct = total > 0 ? (c.failed / total) * 100 : 0;
              return (
                <Link key={c.clientId} href={`/dashboard/companies/${c.clientId}`}>
                  <Card className="h-full border-none shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="flex min-w-0 items-center gap-2.5 text-base">
                        <CompanyAvatar name={c.name} />
                        <span className="truncate">{c.name}</span>
                      </CardTitle>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          {c.employeeCount} employee{c.employeeCount === 1 ? "" : "s"}
                        </span>
                        {c.lastSendAt && (
                          <span className="flex shrink-0 items-center gap-1 text-xs">
                            <Clock className="size-3" />
                            {timeAgo(c.lastSendAt)}
                          </span>
                        )}
                      </div>
                      {total > 0 ? (
                        <div className="space-y-2">
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            {deliveredPct > 0 && <div className="h-full bg-chat" style={{ width: `${deliveredPct}%` }} />}
                            {failedPct > 0 && <div className="h-full bg-destructive" style={{ width: `${failedPct}%` }} />}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="default">{c.delivered} sent</Badge>
                            {c.pending > 0 && <Badge variant="secondary">{c.pending} pending</Badge>}
                            {c.failed > 0 && <Badge variant="destructive">{c.failed} failed</Badge>}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No batches sent yet</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

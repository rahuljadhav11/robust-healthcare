import Link from "next/link";
import { Building2, ChevronRight, Users } from "lucide-react";
import { getAllCompanyStats } from "@/lib/companyStats";
import { AddCompanySheet } from "@/components/add-company-sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CompaniesPage() {
  const companies = await getAllCompanyStats();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Each company&apos;s employees, sends, and delivery status are kept completely separate.
          </p>
        </div>
        <AddCompanySheet />
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Building2 className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No companies yet</p>
              <p className="text-sm text-muted-foreground">Add the first company you&apos;re sending reports for.</p>
            </div>
            <AddCompanySheet />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((c) => (
            <Link key={c.clientId} href={`/dashboard/companies/${c.clientId}`}>
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-accent/30">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="size-4 text-muted-foreground" />
                    {c.name}
                  </CardTitle>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="size-3.5" />
                    {c.employeeCount} employee{c.employeeCount === 1 ? "" : "s"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="default">{c.delivered} sent</Badge>
                    {c.pending > 0 && <Badge variant="secondary">{c.pending} pending</Badge>}
                    {c.failed > 0 && <Badge variant="destructive">{c.failed} failed</Badge>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

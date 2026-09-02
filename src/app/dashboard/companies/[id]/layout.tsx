import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ChevronLeft, ListPlus } from "lucide-react";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { CompanyTabs } from "@/components/company-tabs";

export default async function CompanyLayout({ children, params }: LayoutProps<"/dashboard/companies/[id]">) {
  const { id } = await params;
  const db = getDb();
  const [company] = await db.select().from(clients).where(eq(clients.id, id));
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          Companies
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Building2 className="size-5 text-muted-foreground" />
            {company.name}
          </h1>
          <Button asChild>
            <Link href={`/dashboard/companies/${id}/new-batch`}>
              <ListPlus />
              New batch
            </Link>
          </Button>
        </div>
      </div>

      <CompanyTabs companyId={id} />

      {children}
    </div>
  );
}

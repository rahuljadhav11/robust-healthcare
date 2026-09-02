import Link from "next/link";
import { notFound } from "next/navigation";
import { ListPlus } from "lucide-react";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { CompanyTabs } from "@/components/company-tabs";
import { CompanyAvatar } from "@/components/company-avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export default async function CompanyLayout({ children, params }: LayoutProps<"/dashboard/companies/[id]">) {
  const { id } = await params;
  const db = getDb();
  const [company] = await db.select().from(clients).where(eq(clients.id, id));
  if (!company) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
      <div className="space-y-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard">Companies</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{company.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <CompanyAvatar name={company.name} size="lg" />
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

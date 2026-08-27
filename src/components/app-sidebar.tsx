"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, FileHeart, LayoutDashboard } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface ClientOption {
  id: string;
  name: string;
}

export function AppSidebar() {
  const pathname = usePathname();
  const [companies, setCompanies] = useState<ClientOption[]>([]);

  useEffect(() => {
    // Refetch on every navigation (cheap — a short list) so a newly added
    // company shows up without requiring a hard page refresh.
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setCompanies(d.clients ?? []));
  }, [pathname]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <FileHeart className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Report Sender</span>
                  <span className="truncate text-xs text-muted-foreground">Diagnostic reports via WhatsApp</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"} tooltip="Companies">
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    <span>Companies</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {companies.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Your companies</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {companies.map((c) => (
                  <SidebarMenuItem key={c.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname.startsWith(`/dashboard/companies/${c.id}`)}
                      tooltip={c.name}
                    >
                      <Link href={`/dashboard/companies/${c.id}`}>
                        <Building2 />
                        <span>{c.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}

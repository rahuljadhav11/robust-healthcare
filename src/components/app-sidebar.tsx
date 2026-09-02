"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertCircle, BarChart3, Building2, FileHeart, LayoutDashboard, MessageCircle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface ClientOption {
  id: string;
  name: string;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Companies", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/inbox", label: "Inbox", icon: MessageCircle },
  { href: "/dashboard/failed", label: "Failed", icon: AlertCircle },
  { href: "/dashboard/insights", label: "Insights", icon: BarChart3 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [companies, setCompanies] = useState<ClientOption[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Refetch on every navigation (cheap — a short list) so a newly added
    // company shows up without requiring a hard page refresh.
    fetch("/api/clients")
      .then((r) => r.json())
      .then((d) => setCompanies(d.clients ?? []));
    fetch("/api/failed")
      .then((r) => r.json())
      .then((d) => setFailedCount(d.failed?.length ?? 0));
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      fetch("/api/inbox")
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          const total = (d.conversations ?? []).reduce(
            (sum: number, c: { unread_count?: string | number }) => sum + Number(c.unread_count ?? 0),
            0,
          );
          setUnreadCount(total);
          if (typeof document !== "undefined") {
            document.title = total > 0 ? `(${total}) Report Sender` : "Report Sender";
          }
        })
        .catch(() => null);
    }
    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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
              {NAV_ITEMS.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.href === "/dashboard/failed" && failedCount > 0 && (
                      <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
                        {failedCount}
                      </SidebarMenuBadge>
                    )}
                    {item.href === "/dashboard/inbox" && unreadCount > 0 && (
                      <SidebarMenuBadge className="bg-chat text-chat-foreground">{unreadCount}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
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

import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { ShieldAlert } from "lucide-react";
import { getAuthStatus } from "@/lib/authz";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const status = await getAuthStatus();
  if (status === "unauthenticated") redirect("/sign-in");

  if (status === "unauthorized") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 px-4">
        <Card className="max-w-sm">
          <CardHeader className="items-center text-center">
            <ShieldAlert className="mb-2 size-8 text-destructive" />
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>
              This account isn&apos;t authorized to use Report Sender. Contact your administrator if you believe
              this is a mistake.
            </CardDescription>
          </CardHeader>
        </Card>
        <UserButton />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/60 px-4 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger />
              </TooltipTrigger>
              <TooltipContent>Toggle sidebar</TooltipContent>
            </Tooltip>
            <Separator orientation="vertical" className="h-4 self-center!" />
          </div>
          <UserButton
            appearance={{
              elements: { userButtonAvatarBox: "size-8 ring-2 ring-border" },
            }}
          />
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

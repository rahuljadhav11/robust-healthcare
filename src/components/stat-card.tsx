import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

const TONES = {
  default: { icon: "bg-primary/10 text-primary", value: "text-foreground" },
  muted: { icon: "bg-muted text-muted-foreground", value: "text-foreground" },
  success: { icon: "bg-chat/10 text-chat", value: "text-chat" },
  warning: { icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400", value: "text-amber-600 dark:text-amber-400" },
  destructive: { icon: "bg-destructive/10 text-destructive", value: "text-destructive" },
} as const;

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: keyof typeof TONES;
  className?: string;
}

/** Icon-in-tinted-circle + big number + caption — the pattern repeated by hand
 * across company overview, batch detail, and the new-batch review step. */
export function StatCard({ icon: Icon, label, value, tone = "default", className }: StatCardProps) {
  const t = TONES[tone];
  return (
    <Card className={cn("border-none shadow-sm", className)}>
      <CardContent className="flex items-center gap-3 py-4">
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", t.icon)}>
          <Icon className="size-4.5" />
        </div>
        <div className="min-w-0">
          <div className={cn("text-xl font-semibold leading-tight", t.value)}>{value}</div>
          <div className="truncate text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

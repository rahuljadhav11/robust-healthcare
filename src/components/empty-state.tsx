import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  muted: "bg-muted text-muted-foreground",
  success: "bg-chat/10 text-chat",
} as const;

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}

/** Icon-in-circle + title + description + optional action — a consistent
 * "nothing here yet" moment instead of each page hand-rolling its own. */
export function EmptyState({ icon: Icon, title, description, action, tone = "muted", className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-4 py-16 text-center", className)}>
      <div className={cn("flex size-12 items-center justify-center rounded-full", TONES[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

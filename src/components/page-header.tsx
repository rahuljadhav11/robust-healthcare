import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Icon + title + description + optional trailing action — the header
 * pattern repeated by hand at the top of every dashboard page. */
export function PageHeader({ icon: Icon, title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {Icon && <Icon className="size-5 text-muted-foreground" />}
          {title}
        </h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

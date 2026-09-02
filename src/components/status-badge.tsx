import { cn } from "@/lib/utils";

export const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  pending: { label: "Pending", dot: "bg-muted-foreground/50", text: "text-muted-foreground", bg: "bg-muted" },
  sending: { label: "Sending", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10" },
  sent: { label: "Sent", dot: "bg-primary", text: "text-primary", bg: "bg-primary/10" },
  delivered: { label: "Delivered", dot: "bg-chat", text: "text-chat", bg: "bg-chat/10" },
  read: { label: "Read", dot: "bg-chat", text: "text-chat", bg: "bg-chat/10" },
  received: { label: "Received", dot: "bg-chat", text: "text-chat", bg: "bg-chat/10" },
  failed: { label: "Failed", dot: "bg-destructive", text: "text-destructive", bg: "bg-destructive/10" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? { label: status, dot: "bg-muted-foreground/50", text: "text-muted-foreground", bg: "bg-muted" };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        meta.bg,
        meta.text,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

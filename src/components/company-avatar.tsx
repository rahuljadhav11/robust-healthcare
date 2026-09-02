import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Fixed hue steps (not randomly generated) so colors stay visually consistent
// and legible in both themes — same idea as a categorical chart palette.
const PALETTE = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
];

function hashToIndex(name: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return hash % mod;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

interface CompanyAvatarProps {
  name: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

/** Deterministic colored-initials avatar — same name always gets the same
 * color, so it doubles as a lightweight visual identity across pages. */
export function CompanyAvatar({ name, size = "default", className }: CompanyAvatarProps) {
  const color = PALETTE[hashToIndex(name, PALETTE.length)];
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className={cn("font-semibold", color)}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

import { Bookmark, Check, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecipeStatus } from "@/lib/user-meta";

interface StatusButtonsProps {
  value: RecipeStatus;
  onToggle: (status: Exclude<RecipeStatus, "nenhum">) => void;
  size?: "sm" | "md";
}

const items: { status: Exclude<RecipeStatus, "nenhum">; label: string; icon: typeof Heart }[] = [
  { status: "quero-testar", label: "Quero testar", icon: Bookmark },
  { status: "ja-fiz", label: "Já fiz", icon: Check },
  { status: "favorita", label: "Favorita", icon: Heart },
];

export function StatusButtons({ value, onToggle, size = "md" }: StatusButtonsProps) {
  return (
    <div
      role="group"
      aria-label="Status pessoal"
      className="inline-flex items-center gap-1.5 flex-wrap"
    >
      {items.map(({ status, label, icon: Icon }) => {
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(status)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-foreground/75 border-border hover:border-primary/50 hover:text-foreground",
            )}
          >
            <Icon
              size={size === "sm" ? 12 : 15}
              aria-hidden="true"
              className={cn(active && status === "favorita" && "fill-current")}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function StatusBadge({ status }: { status: RecipeStatus }) {
  if (status === "nenhum") return null;
  const item = items.find((i) => i.status === status)!;
  const Icon = item.icon;
  return (
    <span
      className="inline-flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-1 rounded-full shadow-sm"
      title={item.label}
    >
      <Icon size={11} aria-hidden="true" className={status === "favorita" ? "fill-current" : ""} />
      {item.label}
    </span>
  );
}

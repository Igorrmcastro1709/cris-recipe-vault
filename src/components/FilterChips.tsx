import { cn } from "@/lib/utils";

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  label: string;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function FilterChips({ label, options, value, onChange }: FilterChipsProps) {
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 px-1 overflow-x-auto scrollbar-thin">
      <div className="flex gap-2 min-w-max py-1">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground/75 border-border hover:border-primary/50 hover:text-foreground",
              )}
            >
              <span>{opt.label}</span>
              {typeof opt.count === "number" && (
                <span
                  className={cn(
                    "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full",
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

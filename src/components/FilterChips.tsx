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

export function FilterChips({ label, options, value, onChange, disabled }: FilterChipsProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "-mx-1 px-1 overflow-x-auto scrollbar-thin",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex gap-2 min-w-max py-1">
        {options.map((opt) => {
          const active = value === opt.value;
          const labelText =
            typeof opt.count === "number" ? `${opt.label} (${opt.count})` : opt.label;
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
              <span>{labelText}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

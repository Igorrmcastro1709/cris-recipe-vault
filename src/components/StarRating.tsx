import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
  label?: string;
}

export function StarRating({ value, onChange, size = 20, readOnly = false, label = "Avaliação" }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  if (readOnly) {
    return (
      <div className="inline-flex items-center gap-0.5" aria-label={`${label}: ${value} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={size}
            aria-hidden="true"
            className={cn(
              "transition-colors",
              n <= value ? "fill-primary text-primary" : "text-muted-foreground/40",
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const active = n <= display;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange?.(value === n ? 0 : n)}
            className="rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition motion-reduce:transition-none"
          >
            <Star
              size={size}
              aria-hidden="true"
              className={cn(
                "transition-colors",
                active ? "fill-primary text-primary" : "text-muted-foreground/40 hover:text-primary/60",
              )}
            />
          </button>
        );
      })}
      {value > 0 && (
        <button
          type="button"
          onClick={() => onChange?.(0)}
          className="ml-2 text-xs text-muted-foreground hover:text-foreground underline"
        >
          limpar
        </button>
      )}
    </div>
  );
}

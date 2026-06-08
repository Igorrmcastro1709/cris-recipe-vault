import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ChefHat, ImageOff } from "lucide-react";

const categoryVisuals = [
  {
    match: ["bolo", "doce", "sobremesa", "torta", "pudim"],
    gradient: "from-rose-100 via-orange-50 to-amber-100",
    accent: "text-rose-700/70",
  },
  {
    match: ["massa", "pão", "paes", "pizza", "macarrão"],
    gradient: "from-amber-100 via-orange-50 to-yellow-100",
    accent: "text-amber-800/70",
  },
  {
    match: ["salada", "legume", "vegetariano", "verdura"],
    gradient: "from-lime-100 via-emerald-50 to-teal-100",
    accent: "text-emerald-800/70",
  },
  {
    match: ["carne", "frango", "peixe", "principal"],
    gradient: "from-orange-100 via-red-50 to-stone-100",
    accent: "text-orange-800/70",
  },
];

type RecipeImageProps = {
  image?: string | null;
  title: string;
  category?: string;
  className?: string;
  imgClassName?: string;
  fallbackClassName?: string;
  showOverlay?: boolean;
  compact?: boolean;
  children?: ReactNode;
};

export function RecipeImage({
  image,
  title,
  category = "Receita",
  className = "",
  imgClassName = "",
  fallbackClassName = "",
  showOverlay = false,
  compact = false,
  children,
}: RecipeImageProps) {
  const [failed, setFailed] = useState(false);
  const cleanImage = image?.trim();
  const hasImage = Boolean(cleanImage) && !failed;
  const visual = useMemo(() => getCategoryVisual(category), [category]);

  useEffect(() => {
    setFailed(false);
  }, [cleanImage]);

  return (
    <div className={className}>
      {hasImage ? (
        <>
          <img
            src={cleanImage}
            alt={`Foto da receita: ${title}`}
            loading="lazy"
            onError={() => setFailed(true)}
            className={imgClassName}
          />
          {showOverlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          )}
        </>
      ) : (
        <div
          className={`w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br ${visual.gradient} ${fallbackClassName}`}
        >
          {failed ? (
            <ImageOff size={compact ? 28 : 40} className={visual.accent} aria-hidden="true" />
          ) : (
            <ChefHat size={compact ? 28 : 40} className={visual.accent} aria-hidden="true" />
          )}
          <span className="text-xs text-foreground/70 font-semibold tracking-wide text-center px-3">
            {failed ? "Imagem indisponível" : category}
          </span>
          {!compact && (
            <span className="text-[11px] text-muted-foreground text-center px-4">
              Adicione uma foto para deixar a receita mais fácil de reconhecer.
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function getCategoryVisual(category: string) {
  const normalized = category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return (
    categoryVisuals.find((visual) => visual.match.some((term) => normalized.includes(term))) ?? {
      gradient: "from-accent/70 via-muted to-muted/80",
      accent: "text-primary/50",
    }
  );
}

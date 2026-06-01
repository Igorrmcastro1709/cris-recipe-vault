import { Link } from "@tanstack/react-router";
import {
  Instagram,
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Clock,
  Star,
  ChefHat,
} from "lucide-react";
import type { Recipe } from "@/lib/recipes";
import { useRecipeMeta } from "@/lib/user-meta";
import { StatusBadge } from "@/components/StatusButtons";

const sourceMeta: Record<Recipe["source"], { label: string; icon: typeof Instagram }> = {
  instagram: { label: "Instagram", icon: Instagram },
  pdf: { label: "PDF", icon: FileText },
  video: { label: "Vídeo", icon: Video },
  image: { label: "Imagem", icon: ImageIcon },
  link: { label: "Link", icon: LinkIcon },
};

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { icon: Icon, label } = sourceMeta[recipe.source];
  const { meta } = useRecipeMeta(recipe.id);

  return (
    <Link
      to="/receita/$id"
      params={{ id: recipe.id }}
      aria-label={`Abrir receita ${recipe.title}`}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0 flex flex-col"
    >
      <div className="relative aspect-[4/3] sm:aspect-[5/4] overflow-hidden bg-muted">
        {recipe.image ? (
          <>
            <img
              src={recipe.image}
              alt={`Foto da receita: ${recipe.title}`}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition duration-500 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-accent/60 via-muted to-muted/80">
            <ChefHat size={36} className="text-primary/40" aria-hidden="true" />
            <span className="text-xs text-muted-foreground font-medium tracking-wide">
              {recipe.category}
            </span>
          </div>
        )}
        <span
          className="absolute top-3 left-3 inline-flex items-center gap-1 bg-background/90 backdrop-blur text-foreground/80 text-[11px] font-medium px-2 py-1 rounded-full"
          title={`Fonte: ${label}`}
        >
          <Icon size={11} aria-hidden="true" /> {label}
        </span>
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
          {!recipe.validated && (
            <span className="bg-accent text-accent-foreground text-[11px] font-semibold px-2 py-1 rounded-full">
              A validar
            </span>
          )}
          <StatusBadge status={meta.status} />
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <p className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-2">
          {recipe.category}
        </p>
        <h3 className="font-serif text-lg font-bold text-foreground leading-tight mb-3">
          {recipe.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden="true" /> {recipe.time}
          </span>
          <span aria-hidden="true">•</span>
          <span>{recipe.difficulty}</span>
          {meta.rating > 0 && (
            <>
              <span aria-hidden="true">•</span>
              <span
                className="inline-flex items-center gap-1 text-primary font-medium"
                aria-label={`Sua nota: ${meta.rating} de 5`}
              >
                <Star size={12} aria-hidden="true" className="fill-current" /> {meta.rating}
              </span>
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {recipe.tags.map((t) => (
            <span
              key={t}
              className="text-[11px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

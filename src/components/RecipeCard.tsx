import { Instagram, FileText, Video, Image as ImageIcon, Link as LinkIcon, Clock, Bookmark, Star } from "lucide-react";
import type { Recipe } from "@/lib/recipes";

const sourceMeta: Record<Recipe["source"], { label: string; icon: typeof Instagram }> = {
  instagram: { label: "Instagram", icon: Instagram },
  pdf: { label: "PDF", icon: FileText },
  video: { label: "Vídeo", icon: Video },
  image: { label: "Imagem", icon: ImageIcon },
  link: { label: "Link", icon: LinkIcon },
};

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const { icon: Icon, label } = sourceMeta[recipe.source];
  return (
    <article
      tabIndex={0}
      aria-label={`${recipe.title} — ${recipe.category}, fonte ${label}`}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <div className="relative aspect-[4/3] sm:aspect-[5/4] overflow-hidden bg-muted">
        <img
          src={recipe.image}
          alt={`Foto da receita: ${recipe.title}`}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition duration-500 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <span
          className="absolute top-3 left-3 inline-flex items-center gap-1 bg-background/90 backdrop-blur text-foreground/80 text-[11px] font-medium px-2 py-1 rounded-full"
          title={`Fonte: ${label}`}
        >
          <Icon size={11} aria-hidden="true" /> {label}
        </span>
        {!recipe.validated && (
          <span className="absolute top-3 right-3 bg-accent text-accent-foreground text-[11px] font-semibold px-2 py-1 rounded-full">
            A validar
          </span>
        )}
        <button
          type="button"
          aria-label={`Salvar ${recipe.title} para testar depois`}
          onClick={(e) => e.preventDefault()}
          className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-background/95 backdrop-blur text-foreground/70 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-primary transition motion-reduce:opacity-100"
        >
          <Bookmark size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="p-5">
        <p className="text-[11px] uppercase tracking-wider text-primary font-semibold mb-2">{recipe.category}</p>
        <h3 className="font-serif text-lg font-bold text-foreground leading-tight mb-3">{recipe.title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden="true" /> {recipe.time}
          </span>
          <span aria-hidden="true">•</span>
          <span>{recipe.difficulty}</span>
          <span aria-hidden="true">•</span>
          <span className="inline-flex items-center gap-1 text-muted-foreground/70" title="Avaliação em breve">
            <Star size={12} aria-hidden="true" /> —
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {recipe.tags.map((t) => (
            <span key={t} className="text-[11px] bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

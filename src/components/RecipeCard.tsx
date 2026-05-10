import { Instagram, FileText, Video, Image as ImageIcon, Link as LinkIcon, Clock } from "lucide-react";
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
    <article className="group bg-card rounded-2xl overflow-hidden border border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img src={recipe.image} alt={recipe.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
        <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-background/95 text-foreground text-xs font-medium px-2.5 py-1 rounded-full">
          <Icon size={12} /> {label}
        </span>
        {!recipe.validated && (
          <span className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs font-medium px-2.5 py-1 rounded-full">
            A validar
          </span>
        )}
      </div>
      <div className="p-5">
        <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">{recipe.category}</p>
        <h3 className="font-serif text-lg font-bold text-foreground leading-tight mb-3">{recipe.title}</h3>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Clock size={12} /> {recipe.time}</span>
          <span>•</span>
          <span>{recipe.difficulty}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {recipe.tags.map((t) => (
            <span key={t} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

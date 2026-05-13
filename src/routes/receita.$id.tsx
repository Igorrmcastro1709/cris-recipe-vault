import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  ChefHat,
  ExternalLink,
  Instagram,
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { StarRating } from "@/components/StarRating";
import { StatusButtons } from "@/components/StatusButtons";
import { fetchRecipeById, type Recipe } from "@/lib/recipes";
import { useRecipeMeta } from "@/lib/user-meta";

const sourceMeta: Record<Recipe["source"], { label: string; icon: typeof Instagram }> = {
  instagram: { label: "Instagram", icon: Instagram },
  pdf: { label: "PDF", icon: FileText },
  video: { label: "Vídeo", icon: Video },
  image: { label: "Imagem", icon: ImageIcon },
  link: { label: "Link", icon: LinkIcon },
};

export const Route = createFileRoute("/receita/$id")({
  head: () => ({
    meta: [
      { title: "Receita — Receitas da Cris" },
    ],
  }),
  component: RecipeDetail,
});

function RecipeDetail() {
  const { id } = Route.useParams();
  const { data: recipe, isLoading, error } = useQuery({
    queryKey: ["recipe", id],
    queryFn: () => fetchRecipeById(id),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando receita…
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="font-serif text-3xl font-bold mb-3">Receita não encontrada</h1>
          <p className="text-muted-foreground mb-6">Talvez ela ainda não tenha sido validada.</p>
          <Link to="/" className="text-primary font-medium hover:underline">← Voltar ao catálogo</Link>
        </div>
      </div>
    );
  }

  return <Detail recipe={recipe} />;
}

function Detail({ recipe }: { recipe: Recipe }) {
  const { meta, toggleStatus, setRating } = useRecipeMeta(recipe.id);
  const { icon: SourceIcon, label: sourceLabel } = sourceMeta[recipe.source];
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="max-w-5xl mx-auto px-6 pt-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft size={14} aria-hidden="true" /> Catálogo
        </Link>
      </div>

      <article className="max-w-5xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted shadow-md">
            {recipe.image ? (
              <img src={recipe.image} alt={`Foto da receita: ${recipe.title}`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sem imagem</div>
            )}
            {!recipe.validated && (
              <span className="absolute top-3 right-3 bg-accent text-accent-foreground text-xs font-semibold px-2.5 py-1 rounded-full">
                A validar
              </span>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">{recipe.category}</p>
            <h1 className="font-serif font-bold text-foreground leading-tight mt-2 text-[clamp(1.75rem,4vw,2.75rem)]">
              {recipe.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {recipe.time && <span className="inline-flex items-center gap-1.5"><Clock size={14} aria-hidden="true" /> {recipe.time}</span>}
              {recipe.difficulty && <span className="inline-flex items-center gap-1.5"><ChefHat size={14} aria-hidden="true" /> {recipe.difficulty}</span>}
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
              >
                <SourceIcon size={14} aria-hidden="true" /> {sourceLabel} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>

            {recipe.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {recipe.tags.map((t) => (
                  <span key={t} className="text-xs bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full">{t}</span>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-4 p-5 rounded-2xl bg-card border border-border/60">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Sua nota</p>
                <StarRating value={meta.rating} onChange={setRating} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Status</p>
                <StatusButtons value={meta.status} onToggle={toggleStatus} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-5 gap-10">
          <section className="md:col-span-2" aria-labelledby="ingredientes-heading">
            <h2 id="ingredientes-heading" className="font-serif text-2xl font-bold text-foreground mb-4">Ingredientes</h2>
            {recipe.ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem ingredientes cadastrados.</p>
            ) : (
              <ul className="space-y-2">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-3 group cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={!!checked[i]}
                        onChange={(e) => setChecked((prev) => ({ ...prev, [i]: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 rounded border-border accent-primary cursor-pointer"
                        aria-label={`Marcar ${ing}`}
                      />
                      <span className={checked[i] ? "line-through text-muted-foreground" : "text-foreground"}>{ing}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="md:col-span-3" aria-labelledby="passos-heading">
            <h2 id="passos-heading" className="font-serif text-2xl font-bold text-foreground mb-4">Passo a passo</h2>
            {recipe.steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda sem passo a passo cadastrado.</p>
            ) : (
              <ol className="space-y-4">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary font-serif font-bold flex items-center justify-center text-sm">
                      {i + 1}
                    </span>
                    <p className="text-foreground pt-1 leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {recipe.notes && (
          <section className="mt-10 p-5 rounded-2xl bg-card border border-border/60">
            <h2 className="font-serif text-xl font-bold text-foreground mb-2">Notas</h2>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{recipe.notes}</p>
          </section>
        )}
      </article>
    </div>
  );
}

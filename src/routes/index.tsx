import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Loader2 } from "lucide-react";
import { Header } from "@/components/Header";
import { RecipeCard } from "@/components/RecipeCard";
import { FilterChips, type ChipOption } from "@/components/FilterChips";
import { fetchRecipes, type Recipe, type SourceType } from "@/lib/recipes";
import { useAllUserMeta } from "@/lib/user-meta";
import { useAuth } from "@/lib/auth";

type StatusFilter = "all" | "favorita" | "quero-testar" | "ja-fiz" | "avaliadas";
type QualityFilter =
  | "all"
  | "pending"
  | "missing-ingredients"
  | "missing-steps"
  | "ai-extracted"
  | "needs-review";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Receitas da Cris — Catálogo de receitas" },
      {
        name: "description",
        content:
          "Catálogo online das receitas da Cris: salvas a partir de Instagram, PDFs, vídeos, imagens e links.",
      },
    ],
  }),
  component: Index,
});

const sourceLabels: Record<SourceType, string> = {
  instagram: "Instagram",
  pdf: "PDF",
  video: "Vídeo",
  image: "Imagem",
  link: "Link",
};

function Index() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [src, setSrc] = useState<SourceType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const userMeta = useAllUserMeta();
  const { user, isAdmin } = useAuth();

  const {
    data: recipes = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["recipes", isAdmin ? "all" : "validated"],
    queryFn: () => fetchRecipes(isAdmin ? undefined : { onlyValidated: true }),
  });

  const categoryOptions = useMemo<ChipOption[]>(() => {
    const counts = new Map<string, number>();
    recipes.forEach((r) => counts.set(r.category, (counts.get(r.category) ?? 0) + 1));
    return [
      { value: "all", label: "Todas", count: recipes.length },
      ...Array.from(counts.entries())
        .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
        .map(([value, count]) => ({ value, label: value, count })),
    ];
  }, [recipes]);

  const sourceOptions = useMemo<ChipOption[]>(() => {
    const counts = new Map<SourceType, number>();
    recipes.forEach((r) => counts.set(r.source, (counts.get(r.source) ?? 0) + 1));
    return [
      { value: "all", label: "Todas as fontes", count: recipes.length },
      ...(Object.keys(sourceLabels) as SourceType[])
        .filter((s) => counts.has(s))
        .map((s) => ({ value: s, label: sourceLabels[s], count: counts.get(s) ?? 0 })),
    ];
  }, [recipes]);

  const statusOptions = useMemo<ChipOption[]>(() => {
    const count = (predicate: (id: string) => boolean) =>
      recipes.filter((r) => predicate(r.id)).length;
    return [
      { value: "all", label: "Todas" },
      {
        value: "favorita",
        label: "Favoritas",
        count: count((id) => userMeta[id]?.status === "favorita"),
      },
      {
        value: "quero-testar",
        label: "Quero testar",
        count: count((id) => userMeta[id]?.status === "quero-testar"),
      },
      { value: "ja-fiz", label: "Já fiz", count: count((id) => userMeta[id]?.status === "ja-fiz") },
      {
        value: "avaliadas",
        label: "Avaliadas",
        count: count((id) => (userMeta[id]?.rating ?? 0) > 0),
      },
    ];
  }, [userMeta, recipes]);

  const qualityOptions = useMemo<ChipOption[]>(() => {
    const count = (predicate: (recipe: (typeof recipes)[number]) => boolean) =>
      recipes.filter(predicate).length;
    return [
      { value: "all", label: "Todas" },
      ...(isAdmin
        ? [{ value: "pending", label: "A validar", count: count((r) => !r.validated) }]
        : []),
      {
        value: "missing-ingredients",
        label: "Sem ingredientes",
        count: count((r) => r.ingredients.length === 0),
      },
      { value: "missing-steps", label: "Sem passos", count: count((r) => r.steps.length === 0) },
      {
        value: "ai-extracted",
        label: "Extraídas por IA",
        count: count((r) => r.extractionStatus !== "manual"),
      },
      {
        value: "needs-review",
        label: "Revisar IA",
        count: count(
          (r) => r.extractionStatus === "needs_review" || r.extractionWarnings.length > 0,
        ),
      },
    ];
  }, [recipes, isAdmin]);

  const filtered = useMemo(() => {
    const query = normalizeSearch(q);
    const queryTerms = query.split(" ").filter(Boolean);
    const list = recipes.filter((r) => {
      if (cat !== "all" && r.category !== cat) return false;
      if (src !== "all" && r.source !== src) return false;
      if (qualityFilter === "pending" && r.validated) return false;
      if (qualityFilter === "missing-ingredients" && r.ingredients.length > 0) return false;
      if (qualityFilter === "missing-steps" && r.steps.length > 0) return false;
      if (qualityFilter === "ai-extracted" && r.extractionStatus === "manual") return false;
      if (
        qualityFilter === "needs-review" &&
        r.extractionStatus !== "needs_review" &&
        r.extractionWarnings.length === 0
      ) {
        return false;
      }
      if (statusFilter !== "all") {
        const m = userMeta[r.id];
        if (statusFilter === "avaliadas") {
          if (!m || m.rating <= 0) return false;
        } else if (m?.status !== statusFilter) return false;
      }
      if (queryTerms.length === 0) return true;
      return recipeMatchesTerms(r, queryTerms);
    });
    if (statusFilter === "avaliadas") {
      return [...list].sort(
        (a, b) => (userMeta[b.id]?.rating ?? 0) - (userMeta[a.id]?.rating ?? 0),
      );
    }
    return list;
  }, [q, cat, src, qualityFilter, statusFilter, userMeta, recipes]);

  const hasActiveFilter =
    q.trim() !== "" ||
    cat !== "all" ||
    src !== "all" ||
    qualityFilter !== "all" ||
    statusFilter !== "all";
  const clearFilters = () => {
    setQ("");
    setCat("all");
    setSrc("all");
    setQualityFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/40 via-background to-background pointer-events-none" />
        {/* Decorative dot grid */}
        <svg
          className="absolute right-0 top-0 h-full w-1/2 text-primary opacity-[0.055] pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="hero-dots"
              x="0"
              y="0"
              width="22"
              height="22"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="2.5" cy="2.5" r="1.8" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hero-dots)" />
        </svg>
        <div className="relative max-w-6xl mx-auto px-6 pt-12 sm:pt-16 pb-16 sm:pb-20">
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">
              Livro online vivo
            </p>
            {recipes.length > 0 && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
                {recipes.length} receita{recipes.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <h1 className="font-serif font-bold text-foreground leading-[1.05] tracking-tight max-w-3xl text-[clamp(2.25rem,6vw,4.5rem)]">
            Receitas salvas, organizadas e prontas para cozinhar.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-xl">
            Centralize posts do Instagram, PDFs, vídeos e links em um catálogo pesquisável, com
            ingredientes, fontes e passo a passo.
          </p>
          <form
            role="search"
            aria-label="Busca rápida de receitas"
            className="mt-8 max-w-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <label
              htmlFor="quick-recipe-search"
              className="block text-xs uppercase tracking-[0.18em] text-primary font-semibold mb-2"
            >
              Busca rápida
            </label>
            <div className="relative">
              <Search
                size={20}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="quick-recipe-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Digite uma palavra-chave: fubá, frango, airfryer, bolo..."
                className="w-full pl-12 pr-12 py-4 bg-card rounded-2xl border border-border/70 shadow-sm focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring text-base"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Limpar busca rápida"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Busca por título, categoria, tags, ingredientes, passos, notas e link da fonte.
            </p>
          </form>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to={user ? "/adicionar" : "/login"}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-sm shadow-primary/20"
            >
              Começar agora <span aria-hidden="true">→</span>
            </Link>
            <button
              type="button"
              onClick={() =>
                document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex items-center gap-2 border border-input bg-background px-5 py-2.5 rounded-xl text-sm font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition"
            >
              Ver catálogo
            </button>
          </div>
        </div>
      </section>

      <search
        aria-label="Buscar e filtrar receitas"
        className="block max-w-6xl mx-auto px-6 -mt-8 relative"
      >
        <div className="bg-card border border-border/60 rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <label htmlFor="recipe-search" className="sr-only">
              Buscar receitas
            </label>
            <input
              id="recipe-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por palavra-chave..."
              className="w-full pl-11 pr-10 py-3 bg-background rounded-xl border border-border focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card text-sm"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Categoria
            </p>
            <FilterChips
              label="Filtrar por categoria"
              options={categoryOptions}
              value={cat}
              onChange={setCat}
              disabled={recipes.length === 0}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Fonte
            </p>
            <FilterChips
              label="Filtrar por fonte"
              options={sourceOptions}
              value={src}
              onChange={(v) => setSrc(v as SourceType | "all")}
              disabled={recipes.length === 0}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Minhas marcações
            </p>
            <FilterChips
              label="Filtrar pelas minhas marcações"
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Qualidade
            </p>
            <FilterChips
              label="Filtrar por qualidade e revisão"
              options={qualityOptions}
              value={qualityFilter}
              onChange={(v) => setQualityFilter(v as QualityFilter)}
              disabled={recipes.length === 0}
            />
          </div>
        </div>
      </search>

      <section id="catalogo" className="max-w-6xl mx-auto px-6 py-10 sm:py-12">
        <div className="flex items-baseline justify-between gap-3 mb-6 flex-wrap">
          <h2 className="font-serif text-2xl font-bold text-foreground">Catálogo</h2>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span aria-live="polite">
              {filtered.length} receita{filtered.length === 1 ? "" : "s"}
            </span>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                <X size={13} aria-hidden="true" /> Limpar filtros
              </button>
            )}
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando receitas…
          </div>
        ) : error ? (
          <div className="text-center py-16 border border-dashed border-destructive/40 rounded-2xl bg-destructive/5">
            <p className="text-destructive font-medium">Não consegui carregar o catálogo.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Tente recarregar a página em alguns instantes.
            </p>
          </div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-16 sm:py-20 border border-dashed border-border rounded-2xl bg-card/50">
            <div className="text-5xl mb-4" aria-hidden="true">
              🍳
            </div>
            <p className="font-serif text-xl font-bold text-foreground">Nenhuma receita ainda</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Adicione sua primeira receita para começar seu livro online.
            </p>
            <Link
              to={user ? "/adicionar" : "/login"}
              className="mt-5 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              Adicionar receita
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 sm:py-20 border border-dashed border-border rounded-2xl bg-card/50">
            <p className="font-serif text-xl font-bold text-foreground">
              Nada encontrado por aqui.
            </p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
              Tente outra palavra-chave ou ajuste os filtros para ver mais receitas.
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
              >
                <X size={14} aria-hidden="true" /> Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filtered.map((r) => (
              <RecipeCard key={r.id} recipe={r} />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Feito com carinho • Receitas da Cris
      </footer>
    </div>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function recipeMatchesTerms(recipe: Recipe, terms: string[]) {
  const searchableText = normalizeSearch(
    [
      recipe.title,
      recipe.category,
      recipe.source,
      recipe.sourceUrl,
      recipe.time,
      recipe.difficulty,
      recipe.tags.join(" "),
      recipe.ingredients.join(" "),
      recipe.steps.join(" "),
      recipe.notes ?? "",
    ].join(" "),
  );

  return terms.every((term) => searchableText.includes(term));
}

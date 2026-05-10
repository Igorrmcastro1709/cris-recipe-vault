import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Header } from "@/components/Header";
import { RecipeCard } from "@/components/RecipeCard";
import { recipes, type SourceType } from "@/lib/recipes";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Receitas da Cris — Catálogo de receitas" },
      { name: "description", content: "Catálogo online das receitas da Cris: salvas a partir de Instagram, PDFs, vídeos, imagens e links." },
    ],
  }),
  component: Index,
});

const sources: { value: SourceType | "all"; label: string }[] = [
  { value: "all", label: "Todas as fontes" },
  { value: "instagram", label: "Instagram" },
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Vídeo" },
  { value: "image", label: "Imagem" },
  { value: "link", label: "Link" },
];

function Index() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [src, setSrc] = useState<SourceType | "all">("all");

  const categories = useMemo(() => ["all", ...Array.from(new Set(recipes.map(r => r.category)))], []);

  const filtered = useMemo(() => {
    const query = q.toLowerCase().trim();
    return recipes.filter(r => {
      if (cat !== "all" && r.category !== cat) return false;
      if (src !== "all" && r.source !== src) return false;
      if (!query) return true;
      return (
        r.title.toLowerCase().includes(query) ||
        r.tags.some(t => t.toLowerCase().includes(query)) ||
        r.ingredients.some(i => i.toLowerCase().includes(query))
      );
    });
  }, [q, cat, src]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/40 via-background to-background pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-4">Livro online vivo</p>
          <h1 className="font-serif text-5xl md:text-7xl font-bold text-foreground leading-[1.05] tracking-tight max-w-3xl">
            Receitas salvas, organizadas e prontas para cozinhar.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Centralize posts do Instagram, PDFs, vídeos e links em um catálogo pesquisável, com ingredientes, fontes e passo a passo.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 -mt-8 relative">
        <div className="bg-card border border-border/60 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, tag ou ingrediente..."
              className="w-full pl-11 pr-4 py-3 bg-background rounded-xl border border-border focus:border-primary focus:outline-none text-sm"
            />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="px-4 py-3 bg-background rounded-xl border border-border focus:border-primary focus:outline-none text-sm">
            {categories.map(c => <option key={c} value={c}>{c === "all" ? "Todas as categorias" : c}</option>)}
          </select>
          <select value={src} onChange={(e) => setSrc(e.target.value as SourceType | "all")} className="px-4 py-3 bg-background rounded-xl border border-border focus:border-primary focus:outline-none text-sm">
            {sources.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold text-foreground">Catálogo</h2>
          <span className="text-sm text-muted-foreground">{filtered.length} receita{filtered.length === 1 ? "" : "s"}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">Nenhuma receita encontrada.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(r => <RecipeCard key={r.id} recipe={r} />)}
          </div>
        )}
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        Feito com carinho • Receitas da Cris
      </footer>
    </div>
  );
}

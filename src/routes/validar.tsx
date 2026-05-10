import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { Header } from "@/components/Header";
import { recipes } from "@/lib/recipes";

export const Route = createFileRoute("/validar")({
  head: () => ({
    meta: [
      { title: "Validar receitas — Receitas da Cris" },
      { name: "description", content: "Pré-visualize e valide receitas antes de publicá-las no catálogo." },
    ],
  }),
  component: Validar,
});

function Validar() {
  const pending = recipes.filter(r => !r.validated);
  const done = recipes.filter(r => r.validated);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">Preview & Validação</p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-3">Confira antes de publicar</h1>
        <p className="text-muted-foreground max-w-2xl">Revise ingredientes, passos e fontes. Receitas marcadas como "a validar" só vão para o catálogo final depois de aprovadas.</p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Stat label="Total" value={recipes.length} />
          <Stat label="Validadas" value={done.length} accent="primary" />
          <Stat label="Pendentes" value={pending.length} accent="accent" />
        </div>

        <h2 className="font-serif text-2xl font-bold mt-14 mb-5 flex items-center gap-2">
          <AlertCircle className="text-primary" size={22} /> A validar
        </h2>
        <div className="space-y-4">
          {pending.map(r => (
            <div key={r.id} className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col md:flex-row gap-5">
              <img src={r.image} alt={r.title} className="w-full md:w-40 h-32 object-cover rounded-xl" />
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold">{r.category} • {r.source}</p>
                <h3 className="font-serif text-xl font-bold mt-1">{r.title}</h3>
                <p className="text-sm text-muted-foreground mt-2"><strong className="text-foreground">Ingredientes:</strong> {r.ingredients.slice(0, 4).join(", ")}…</p>
                <p className="text-sm text-muted-foreground mt-1"><strong className="text-foreground">Passos:</strong> {r.steps.length} etapas</p>
                <a href={r.sourceUrl} className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-3 hover:underline">
                  Ver fonte <ExternalLink size={13} />
                </a>
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-muted-foreground">Tudo em dia.</p>}
        </div>

        <h2 className="font-serif text-2xl font-bold mt-14 mb-5 flex items-center gap-2">
          <CheckCircle2 className="text-primary" size={22} /> Já validadas
        </h2>
        <ul className="bg-card border border-border/60 rounded-2xl divide-y divide-border/60">
          {done.map(r => (
            <li key={r.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.category} • {r.source}</p>
              </div>
              <CheckCircle2 className="text-primary" size={18} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: "primary" | "accent" }) {
  return (
    <div className={`rounded-2xl p-5 border border-border/60 ${accent === "primary" ? "bg-primary/10" : accent === "accent" ? "bg-accent/40" : "bg-card"}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-3xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

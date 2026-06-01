import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle, ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { RequireAdmin } from "@/components/RequireAdmin";
import { fetchRecipes, setRecipeValidated, deleteRecipe } from "@/lib/recipes";

export const Route = createFileRoute("/validar")({
  head: () => ({
    meta: [
      { title: "Validar receitas — Receitas da Cris" },
      {
        name: "description",
        content: "Pré-visualize e valide receitas antes de publicá-las no catálogo.",
      },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <Validar />
    </RequireAdmin>
  ),
});

function Validar() {
  const qc = useQueryClient();
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes", "all"],
    queryFn: () => fetchRecipes(),
  });

  const validate = useMutation({
    mutationFn: (id: string) => setRecipeValidated(id, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  const pending = recipes.filter((r) => !r.validated);
  const done = recipes.filter((r) => r.validated);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
          Preview & Validação
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-3">
          Confira antes de publicar
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Revise ingredientes, passos e fontes. Receitas marcadas como "a validar" só vão para o
          catálogo final depois de aprovadas.
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando…
          </div>
        ) : (
          <>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <Stat label="Total" value={recipes.length} />
              <Stat label="Validadas" value={done.length} accent="primary" />
              <Stat label="Pendentes" value={pending.length} accent="accent" />
            </div>

            <h2 className="font-serif text-2xl font-bold mt-14 mb-5 flex items-center gap-2">
              <AlertCircle className="text-primary" size={22} /> A validar
            </h2>
            <div className="space-y-4">
              {pending.map((r) => (
                <div
                  key={r.id}
                  className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col md:flex-row gap-5"
                >
                  {r.image && (
                    <img
                      src={r.image}
                      alt={r.title}
                      className="w-full md:w-40 h-32 object-cover rounded-xl"
                    />
                  )}
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wider text-primary font-semibold">
                      {r.category} • {r.source}
                    </p>
                    <h3 className="font-serif text-xl font-bold mt-1">{r.title}</h3>
                    {r.ingredients.length > 0 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong className="text-foreground">Ingredientes:</strong>{" "}
                        {r.ingredients.slice(0, 4).join(", ")}…
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong className="text-foreground">Passos:</strong> {r.steps.length} etapas
                    </p>
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-3 hover:underline"
                    >
                      Ver fonte <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className="flex md:flex-col gap-2 md:justify-center">
                    <button
                      onClick={() => validate.mutate(r.id)}
                      disabled={validate.isPending}
                      className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60"
                    >
                      <CheckCircle2 size={15} aria-hidden="true" /> Validar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir "${r.title}"?`)) remove.mutate(r.id);
                      }}
                      className="inline-flex items-center gap-1.5 border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 px-4 py-2 rounded-xl text-sm font-medium transition"
                    >
                      <Trash2 size={15} aria-hidden="true" /> Excluir
                    </button>
                  </div>
                </div>
              ))}
              {pending.length === 0 && <p className="text-muted-foreground">Tudo em dia.</p>}
            </div>

            <h2 className="font-serif text-2xl font-bold mt-14 mb-5 flex items-center gap-2">
              <CheckCircle2 className="text-primary" size={22} /> Já validadas
            </h2>
            <ul className="bg-card border border-border/60 rounded-2xl divide-y divide-border/60">
              {done.map((r) => (
                <li key={r.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.category} • {r.source}
                    </p>
                  </div>
                  <button
                    onClick={() => validate.mutate(r.id) /* keeps validated true */}
                    className="hidden"
                    aria-hidden
                  />
                  <CheckCircle2 className="text-primary shrink-0" size={18} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "accent";
}) {
  return (
    <div
      className={`rounded-2xl p-5 border border-border/60 ${accent === "primary" ? "bg-primary/10" : accent === "accent" ? "bg-accent/40" : "bg-card"}`}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-serif text-3xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

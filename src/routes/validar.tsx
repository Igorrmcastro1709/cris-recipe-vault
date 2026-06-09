import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  Trash2,
  Pencil,
} from "lucide-react";
import { Header } from "@/components/Header";
import { RequireAdmin } from "@/components/RequireAdmin";
import { RecipeImage } from "@/components/RecipeImage";
import {
  fetchRecipes,
  setRecipeValidated,
  deleteRecipe,
  updateRecipe,
  type ExtractionStatus,
  type Recipe,
  type SourceType,
} from "@/lib/recipes";
import { getCatalogQualityIssues } from "@/lib/catalog";

const LOCAL_AI_BRIDGE_URL = "http://127.0.0.1:3877";

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
  const [enrichMessages, setEnrichMessages] = useState<Record<string, EnrichMessage>>({});
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

  const enrich = useMutation({
    mutationFn: enrichRecipeWithLocalAi,
    onMutate: (recipe) => {
      setEnrichMessages((current) => ({
        ...current,
        [recipe.id]: { type: "loading", text: "Lendo a fonte e organizando com IA local…" },
      }));
    },
    onSuccess: (recipe) => {
      setEnrichMessages((current) => ({
        ...current,
        [recipe.id]: {
          type: "success",
          text: "Rascunho atualizado. Revise ingredientes, passos, observações e imagem antes de validar.",
        },
      }));
      qc.invalidateQueries({ queryKey: ["recipes"] });
      qc.invalidateQueries({ queryKey: ["recipe", recipe.id] });
    },
    onError: (error, recipe) => {
      const message = error instanceof Error ? error.message : "Não consegui completar com IA.";
      setEnrichMessages((current) => ({
        ...current,
        [recipe.id]: { type: "error", text: message },
      }));
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
                <PendingRecipeCard
                  key={r.id}
                  recipe={r}
                  onValidate={() => validate.mutate(r.id)}
                  onDelete={() => {
                    if (confirm(`Excluir "${r.title}"?`)) remove.mutate(r.id);
                  }}
                  onEnrich={() => enrich.mutate(r)}
                  enriching={enrich.isPending && enrich.variables?.id === r.id}
                  enrichMessage={enrichMessages[r.id]}
                  validating={validate.isPending}
                />
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

function getQualityIssues(recipe: Recipe) {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (recipe.ingredients.length === 0) blockers.push("Sem ingredientes cadastrados.");
  if (recipe.steps.length === 0) blockers.push("Sem passo a passo cadastrado.");
  if (!recipe.image.trim()) {
    warnings.push("Sem imagem real. Adicione uma foto para deixar a receita mais reconhecível.");
  }
  if (recipe.extractionStatus === "needs_review") {
    warnings.push("Extração por IA precisa de revisão.");
  }
  warnings.push(...recipe.extractionWarnings);
  warnings.push(
    ...getCatalogQualityIssues(recipe).filter(
      (issue) => !["Sem ingredientes.", "Sem passo a passo.", "Sem imagem real."].includes(issue),
    ),
  );

  return { blockers, warnings: Array.from(new Set(warnings)) };
}

function PendingRecipeCard({
  recipe,
  onValidate,
  onDelete,
  onEnrich,
  enriching,
  enrichMessage,
  validating,
}: {
  recipe: Recipe;
  onValidate: () => void;
  onDelete: () => void;
  onEnrich: () => void;
  enriching: boolean;
  enrichMessage?: EnrichMessage;
  validating: boolean;
}) {
  const { blockers, warnings } = getQualityIssues(recipe);
  const canValidate = blockers.length === 0;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-5 flex flex-col md:flex-row gap-5">
      <RecipeImage
        image={recipe.image}
        title={recipe.title}
        category={recipe.category}
        className="w-full md:w-40 h-32 overflow-hidden rounded-xl shrink-0"
        imgClassName="w-full h-full object-cover"
        compact
      />
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-wider text-primary font-semibold">
            {recipe.category} • {recipe.source}
          </p>
          {recipe.extractionStatus !== "manual" && (
            <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">
              {recipe.extractionStatus === "needs_review" ? "Revisar IA" : "Extraída por IA"}
            </span>
          )}
        </div>
        <h3 className="font-serif text-xl font-bold mt-1">{recipe.title}</h3>
        {recipe.ingredients.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            <strong className="text-foreground">Ingredientes:</strong>{" "}
            {recipe.ingredients.slice(0, 4).join(", ")}…
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          <strong className="text-foreground">Passos:</strong> {recipe.steps.length} etapas
        </p>
        {(blockers.length > 0 || warnings.length > 0) && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80 space-y-1">
            {[...blockers, ...warnings].map((issue) => (
              <p key={issue}>• {issue}</p>
            ))}
          </div>
        )}
        {enrichMessage && (
          <p
            role="status"
            className={`mt-3 text-sm ${
              enrichMessage.type === "error"
                ? "text-destructive"
                : enrichMessage.type === "success"
                  ? "text-primary"
                  : "text-muted-foreground"
            }`}
          >
            {enrichMessage.text}
          </p>
        )}
        <a
          href={recipe.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary text-sm font-medium mt-3 hover:underline"
        >
          Ver fonte <ExternalLink size={13} />
        </a>
      </div>
      <div className="flex md:flex-col gap-2 md:justify-center">
        <Link
          to="/receita/$id/editar"
          params={{ id: recipe.id }}
          className="inline-flex items-center justify-center gap-1.5 border border-border bg-background text-foreground px-4 py-2 rounded-xl text-sm font-medium hover:border-primary/40 transition"
        >
          <Pencil size={15} aria-hidden="true" /> Editar
        </Link>
        <button
          onClick={onEnrich}
          disabled={enriching}
          title="Ler a fonte, traduzir e preencher ingredientes, passos, observações e imagem"
          className="inline-flex items-center gap-1.5 border border-primary/30 bg-primary/10 text-primary px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary/15 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {enriching ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles size={15} aria-hidden="true" />
          )}{" "}
          {enriching ? "Completando…" : "Completar com IA"}
        </button>
        <button
          onClick={onValidate}
          disabled={validating || !canValidate}
          title={canValidate ? "Publicar no catálogo" : "Complete ingredientes e passos antes"}
          className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle2 size={15} aria-hidden="true" /> {canValidate ? "Validar" : "Completar"}
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 px-4 py-2 rounded-xl text-sm font-medium transition"
        >
          <Trash2 size={15} aria-hidden="true" /> Excluir
        </button>
      </div>
    </div>
  );
}

type EnrichMessage = {
  type: "loading" | "success" | "error";
  text: string;
};

type ExtractedRecipe = {
  title?: string;
  category?: string;
  image?: string;
  time?: string;
  difficulty?: string;
  servings?: number | null;
  tags?: string[];
  ingredients?: string[];
  steps?: string[];
  notes?: string | null;
  confidence?: "high" | "medium" | "low";
  warnings?: string[];
};

async function enrichRecipeWithLocalAi(recipe: Recipe) {
  let res: Response;
  try {
    res = await fetch(`${LOCAL_AI_BRIDGE_URL}/extract-recipe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceType: recipe.source,
        sourceUrl: recipe.sourceUrl,
        rawText: recipe.rawSourceText || "",
      }),
    });
  } catch {
    throw new Error(
      "Serviço local indisponível. Rode npm run ai:local no Terminal e tente novamente.",
    );
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    const errorMessage = err.error ?? `Erro HTTP ${res.status}`;
    throw new Error(
      errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")
        ? "Serviço local indisponível. Rode npm run ai:local no Terminal e tente novamente."
        : errorMessage,
    );
  }

  const parsed = (await res.json()) as ExtractedRecipe;
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter(Boolean) : [];
  const confidence = parsed.confidence ?? "medium";
  const extractionStatus: ExtractionStatus =
    confidence === "high" && warnings.length === 0 ? "ai_extracted" : "needs_review";
  const source = recipe.source === "image" ? "image" : (recipe.source as SourceType);

  return updateRecipe(recipe.id, {
    title: parsed.title?.trim() || recipe.title,
    category: parsed.category?.trim() || recipe.category,
    source,
    sourceUrl: recipe.sourceUrl,
    image: parsed.image?.trim() || recipe.image,
    time: parsed.time?.trim() || recipe.time,
    difficulty: normalizeDifficulty(parsed.difficulty || recipe.difficulty),
    servings: parsed.servings ?? recipe.servings ?? null,
    tags: mergeUnique(recipe.tags, parsed.tags ?? []),
    ingredients:
      Array.isArray(parsed.ingredients) && parsed.ingredients.length
        ? parsed.ingredients.map(String)
        : recipe.ingredients,
    steps:
      Array.isArray(parsed.steps) && parsed.steps.length ? parsed.steps.map(String) : recipe.steps,
    notes: buildMergedNotes(recipe.notes, parsed.notes),
    extractionStatus,
    rawSourceText: recipe.rawSourceText,
    extractionWarnings: warnings,
    extractedAt: new Date().toISOString(),
  });
}

function normalizeDifficulty(value: string): "Fácil" | "Médio" | "Difícil" {
  if (value === "Médio" || value === "Difícil") return value;
  return "Fácil";
}

function mergeUnique(current: string[], incoming: string[]) {
  return Array.from(
    new Set([...current, ...incoming.map(String).map((item) => item.trim())]),
  ).filter(Boolean);
}

function buildMergedNotes(current?: string | null, incoming?: string | null) {
  const next = incoming?.trim();
  if (!next) return current ?? null;
  if (!current?.trim()) return next;
  if (current.includes(next)) return current;
  return `${current.trim()}\n\nObservações extraídas pela IA:\n${next}`;
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

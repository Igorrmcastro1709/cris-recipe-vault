import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Instagram,
  FileText,
  Video,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  Trash2,
  Check,
  GripVertical,
  Eye,
  Save,
  AlertCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { RecipeCard } from "@/components/RecipeCard";
import { RequireAdmin } from "@/components/RequireAdmin";
import {
  createRecipe,
  fetchRecipes,
  type ExtractionStatus,
  type Recipe,
  type SourceType,
} from "@/lib/recipes";

export const Route = createFileRoute("/adicionar")({
  head: () => ({
    meta: [
      { title: "Adicionar receita — Receitas da Cris" },
      {
        name: "description",
        content:
          "Cadastre uma receita completa: ingredientes, passo a passo, tempo, dificuldade e fonte original.",
      },
    ],
  }),
  component: () => (
    <RequireAdmin>
      <Adicionar />
    </RequireAdmin>
  ),
});

const AUTOSAVE_KEY = "receitas-da-cris:form-autosave";
const LOCAL_AI_BRIDGE_URL = "http://127.0.0.1:3877";

const sourceOptions: {
  value: SourceType;
  label: string;
  icon: typeof Instagram;
  placeholder: string;
  hint: string;
}[] = [
  {
    value: "instagram",
    label: "Instagram",
    icon: Instagram,
    placeholder: "https://www.instagram.com/p/...",
    hint: "Link do post ou Reel",
  },
  {
    value: "video",
    label: "Vídeo",
    icon: Video,
    placeholder: "https://youtube.com/watch?v=...",
    hint: "YouTube, TikTok ou outro",
  },
  {
    value: "link",
    label: "Link / Site",
    icon: LinkIcon,
    placeholder: "https://blogdereceitas.com/...",
    hint: "Blog, site ou artigo",
  },
  {
    value: "pdf",
    label: "PDF",
    icon: FileText,
    placeholder: "URL do PDF",
    hint: "Link público do arquivo",
  },
  {
    value: "image",
    label: "Imagem",
    icon: ImageIcon,
    placeholder: "URL da imagem",
    hint: "Foto da receita escrita",
  },
];

const sourceValues = sourceOptions.map((s) => s.value) as [SourceType, ...SourceType[]];
type ExtractSourceType = SourceType | "text";

const schema = z
  .object({
    mode: z.enum(["quick", "full"]),
    title: z.string().trim().min(1, "Dê um nome para a receita").max(120),
    category: z.string().trim().min(1, "Escolha ou crie uma categoria").max(60),
    source: z.enum(sourceValues),
    sourceUrl: z
      .string()
      .trim()
      .url("Cole um link válido (começando com http)")
      .or(z.literal(""))
      .optional()
      .default(""),
    image: z
      .string()
      .trim()
      .url("Use uma URL de imagem válida")
      .or(z.literal(""))
      .optional()
      .default(""),
    time: z.string().max(20).optional().default(""),
    difficulty: z.enum(["Fácil", "Médio", "Difícil"]).default("Fácil"),
    servings: z.coerce.number().int().min(1).max(50).optional(),
    tagsInput: z.string().max(200).optional().default(""),
    ingredients: z
      .array(z.object({ value: z.string().trim().min(1, "Ingrediente vazio") }))
      .default([]),
    steps: z.array(z.object({ value: z.string().trim().min(1, "Passo vazio") })).default([]),
    notes: z.string().max(1000).optional().default(""),
    extractionStatus: z
      .enum(["manual", "ai_extracted", "needs_review"])
      .optional()
      .default("manual"),
    rawSourceText: z.string().optional().default(""),
    extractionWarnings: z.array(z.string()).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.mode !== "full") return;
    if (!data.time?.trim())
      ctx.addIssue({ code: "custom", path: ["time"], message: "Informe o tempo (ex.: 30min)" });
    if (!data.ingredients.length)
      ctx.addIssue({
        code: "custom",
        path: ["ingredients"],
        message: "Adicione pelo menos um ingrediente",
      });
    if (!data.steps.length)
      ctx.addIssue({ code: "custom", path: ["steps"], message: "Adicione pelo menos um passo" });
  });

type FormValues = z.input<typeof schema>;

const PLACEHOLDER_IMG = "https://images.unsplash.com/photo-1495546200529-39e0e3825bdc?w=800";

function Adicionar() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);

  const { data: allRecipes = [] } = useQuery({
    queryKey: ["recipes", "all"],
    queryFn: () => fetchRecipes(),
  });

  const existingCategories = useMemo(
    () =>
      Array.from(new Set(allRecipes.map((r) => r.category))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [allRecipes],
  );

  const pendingRecipes = useMemo(
    () => allRecipes.filter((r) => !r.validated).slice(0, 8),
    [allRecipes],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    mode: "onBlur",
    defaultValues: {
      mode: "quick",
      title: "",
      category: "",
      source: "instagram",
      sourceUrl: "",
      image: "",
      time: "",
      difficulty: "Fácil",
      tagsInput: "",
      ingredients: [],
      steps: [],
      notes: "",
      extractionStatus: "manual",
      rawSourceText: "",
      extractionWarnings: [],
    },
  });

  const { control, register, handleSubmit, watch, reset, formState } = form;
  const values = watch();

  const ingredientsArray = useFieldArray({ control, name: "ingredients" as never });
  const stepsArray = useFieldArray({ control, name: "steps" as never });

  // Restore autosave on mount
  useEffect(() => {
    try {
      const auto = localStorage.getItem(AUTOSAVE_KEY);
      if (auto) {
        const parsed = JSON.parse(auto);
        reset(parsed.data);
        setMode(parsed.data.mode ?? "quick");
        setAutosavedAt(parsed.savedAt);
      }
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const payload = { savedAt: Date.now(), data: values };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
        setAutosavedAt(payload.savedAt);
      } catch {
        /* noop */
      }
    }, 600);
    return () => clearTimeout(id);
  }, [values]);

  // Switch mode: re-init defaults appropriate to the mode
  const switchMode = (next: "quick" | "full") => {
    setMode(next);
    const base = {
      mode: next,
      title: values.title ?? "",
      category: values.category ?? "",
      source: (values.source as SourceType) ?? "instagram",
      sourceUrl: values.sourceUrl ?? "",
      notes: values.notes ?? "",
      image: "",
      time: "",
      difficulty: "Fácil" as const,
      tagsInput: "",
      ingredients: next === "full" ? [{ value: "" }] : [],
      steps: next === "full" ? [{ value: "" }] : [],
      extractionStatus: "manual" as const,
      rawSourceText: "",
      extractionWarnings: [],
    };
    reset(base);
  };

  const submitMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const isFull = data.mode === "full";
      const tags = isFull
        ? (data.tagsInput ?? "")
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      return createRecipe({
        title: data.title.trim(),
        category: data.category.trim(),
        source: data.source as SourceType,
        sourceUrl: data.sourceUrl.trim(),
        image: isFull ? (data.image || "").trim() : "",
        time: isFull ? (data.time || "").trim() : "",
        difficulty: isFull ? data.difficulty : "Fácil",
        servings: isFull ? (data.servings ?? null) : null,
        tags,
        ingredients: isFull ? (data.ingredients ?? []).map((i) => i.value).filter(Boolean) : [],
        steps: isFull ? (data.steps ?? []).map((s) => s.value).filter(Boolean) : [],
        notes: (data.notes ?? "").trim() || null,
        extractionStatus: data.extractionStatus ?? "manual",
        rawSourceText: (data.rawSourceText ?? "").trim() || null,
        extractionWarnings: data.extractionWarnings ?? [],
        extractedAt:
          data.extractionStatus && data.extractionStatus !== "manual"
            ? new Date().toISOString()
            : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recipes"] });
      try {
        localStorage.removeItem(AUTOSAVE_KEY);
      } catch {
        /* noop */
      }
      setAutosavedAt(null);
      setSaved(true);
      setSubmitError(null);
      setTimeout(() => setSaved(false), 2800);
      switchMode(mode); // clean state
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : "Erro ao salvar receita");
    },
  });

  const onSubmit = (data: FormValues) => {
    setSubmitError(null);
    submitMutation.mutate(data);
  };

  const handleAiExtracted = (data: Partial<FormValues>) => {
    setMode("full");
    reset({
      mode: "full",
      title: data.title ?? "",
      category: data.category ?? "",
      source: (data.source as SourceType) ?? "link",
      sourceUrl: data.sourceUrl ?? "",
      image: data.image ?? "",
      time: data.time ?? "",
      difficulty: data.difficulty ?? "Fácil",
      servings: data.servings,
      tagsInput: data.tagsInput ?? "",
      ingredients: data.ingredients?.length ? data.ingredients : [{ value: "" }],
      steps: data.steps?.length ? data.steps : [{ value: "" }],
      notes: data.notes ?? "",
      extractionStatus: data.extractionStatus ?? "needs_review",
      rawSourceText: data.rawSourceText ?? "",
      extractionWarnings: data.extractionWarnings ?? [],
    });
  };

  const currentSource = sourceOptions.find((o) => o.value === values.source) ?? sourceOptions[0];

  // Build a preview Recipe from current values
  const previewRecipe: Recipe = useMemo(() => {
    const isFull = values.mode === "full";
    const tags = isFull
      ? (values.tagsInput ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    return {
      id: "preview",
      title: values.title?.trim() || "Título da receita",
      category: values.category?.trim() || "Categoria",
      source: (values.source as SourceType) ?? "link",
      sourceUrl: values.sourceUrl || "#",
      image: (isFull && values.image) || PLACEHOLDER_IMG,
      time: isFull ? values.time || "—" : "—",
      difficulty: isFull ? values.difficulty || "Fácil" : "—",
      tags,
      ingredients: isFull ? (values.ingredients ?? []).map((i) => i.value).filter(Boolean) : [],
      steps: isFull ? (values.steps ?? []).map((s) => s.value).filter(Boolean) : [],
      validated: false,
      extractionStatus: (values.extractionStatus ?? "manual") as ExtractionStatus,
      rawSourceText: values.rawSourceText ?? null,
      extractionWarnings: values.extractionWarnings ?? [],
      extractedAt: null,
    };
  }, [values]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
          Nova receita
        </p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-3">
          Adicionar receita
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Salve um link rápido ou cadastre a receita completa com ingredientes e passo a passo. Vai
          ficar como rascunho até ser{" "}
          <Link to="/validar" className="text-primary hover:underline">
            validada
          </Link>
          .
        </p>

        {/* Mode toggle */}
        <div
          role="tablist"
          aria-label="Modo de cadastro"
          className="mt-7 inline-flex p-1 bg-muted rounded-xl"
        >
          {(["quick", "full"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "quick" ? "Rascunho rápido" : "Receita completa"}
            </button>
          ))}
        </div>

        <AiExtract onExtracted={handleAiExtracted} />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,360px)] gap-8">
          {/* FORM */}
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="bg-card border border-border/60 rounded-2xl p-6 md:p-7 shadow-sm space-y-5"
          >
            <input type="hidden" {...register("mode")} value={mode} />

            {/* Source picker */}
            <Field label="Tipo de fonte" id="source">
              <Controller
                control={control}
                name="source"
                render={({ field }) => (
                  <div
                    role="radiogroup"
                    aria-label="Tipo de fonte"
                    className="grid grid-cols-2 sm:grid-cols-5 gap-2"
                  >
                    {sourceOptions.map((opt) => {
                      const Icon = opt.icon;
                      const active = field.value === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => field.onChange(opt.value)}
                          className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-foreground/70 hover:border-primary/40"
                          }`}
                        >
                          <Icon size={18} aria-hidden="true" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </Field>

            <Field
              label="Link ou URL da fonte"
              id="sourceUrl"
              hint={currentSource.hint}
              error={formState.errors.sourceUrl?.message}
            >
              <input
                id="sourceUrl"
                type="url"
                inputMode="url"
                placeholder={currentSource.placeholder}
                {...register("sourceUrl")}
                className={inputClass(!!formState.errors.sourceUrl)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Título" id="title" required error={formState.errors.title?.message}>
                <input
                  id="title"
                  type="text"
                  placeholder="Ex.: Bolo de fubá cremoso"
                  {...register("title")}
                  className={inputClass(!!formState.errors.title)}
                />
              </Field>
              <Field
                label="Categoria"
                id="category"
                required
                error={formState.errors.category?.message}
                hint="Escolha existente ou digite uma nova"
              >
                <input
                  id="category"
                  type="text"
                  list="category-suggestions"
                  placeholder="Ex.: Doces, Pães, Saladas..."
                  {...register("category")}
                  className={inputClass(!!formState.errors.category)}
                />
                <datalist id="category-suggestions">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>

            {mode === "full" && (
              <>
                <Field
                  label="Imagem (URL)"
                  id="image"
                  hint="Link da foto da receita (opcional)"
                  error={formState.errors.image?.message}
                >
                  <input
                    id="image"
                    type="url"
                    placeholder="https://..."
                    {...register("image")}
                    className={inputClass(!!formState.errors.image)}
                  />
                </Field>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <Field label="Tempo" id="time" required error={formState.errors.time?.message}>
                    <input
                      id="time"
                      type="text"
                      placeholder="30min"
                      {...register("time")}
                      className={inputClass(!!formState.errors.time)}
                    />
                  </Field>
                  <Field label="Dificuldade" id="difficulty">
                    <select
                      id="difficulty"
                      {...register("difficulty")}
                      className={inputClass(false)}
                    >
                      <option>Fácil</option>
                      <option>Médio</option>
                      <option>Difícil</option>
                    </select>
                  </Field>
                  <Field label="Porções" id="servings" hint="Opcional">
                    <input
                      id="servings"
                      type="number"
                      min={1}
                      max={50}
                      placeholder="Ex.: 4"
                      {...register("servings")}
                      className={inputClass(!!formState.errors.servings)}
                    />
                  </Field>
                </div>

                <Field
                  label="Tags"
                  id="tagsInput"
                  hint="Separe por vírgula (ex.: italiano, jantar)"
                >
                  <input
                    id="tagsInput"
                    type="text"
                    placeholder="vegano, rápido, festa..."
                    {...register("tagsInput")}
                    className={inputClass(false)}
                  />
                </Field>

                {/* Ingredients */}
                <DynamicList
                  legend="Ingredientes"
                  itemLabelPrefix="Ingrediente"
                  placeholder="Ex.: 2 xíc. de farinha"
                  items={ingredientsArray.fields}
                  errors={
                    formState.errors.ingredients as { value?: { message?: string } }[] | undefined
                  }
                  rootError={
                    typeof formState.errors.ingredients?.message === "string"
                      ? formState.errors.ingredients.message
                      : undefined
                  }
                  register={(i) => register(`ingredients.${i}.value` as const)}
                  onAdd={() => ingredientsArray.append({ value: "" })}
                  onRemove={(i) => ingredientsArray.remove(i)}
                />

                {/* Steps */}
                <DynamicList
                  legend="Passo a passo"
                  itemLabelPrefix="Passo"
                  placeholder="Descreva esta etapa..."
                  numbered
                  multiline
                  items={stepsArray.fields}
                  errors={formState.errors.steps as { value?: { message?: string } }[] | undefined}
                  rootError={
                    typeof formState.errors.steps?.message === "string"
                      ? formState.errors.steps.message
                      : undefined
                  }
                  register={(i) => register(`steps.${i}.value` as const)}
                  onAdd={() => stepsArray.append({ value: "" })}
                  onRemove={(i) => stepsArray.remove(i)}
                />
              </>
            )}

            <Field label="Notas" id="notes" hint="Adaptações, dicas ou lembretes (opcional)">
              <textarea
                id="notes"
                rows={3}
                placeholder="Observações..."
                {...register("notes")}
                className={`${inputClass(false)} resize-none`}
              />
            </Field>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                {saved ? (
                  <span className="inline-flex items-center gap-1 text-primary font-medium">
                    <Check size={14} aria-hidden="true" /> Receita enviada para validação
                  </span>
                ) : autosavedAt ? (
                  <>
                    <Save size={12} aria-hidden="true" /> Autosalvo às{" "}
                    {new Date(autosavedAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </>
                ) : (
                  "Suas alterações ficam salvas localmente até você enviar"
                )}
              </p>
              <div className="flex items-center gap-2">
                {mode === "quick" && (
                  <button
                    type="button"
                    onClick={() => switchMode("full")}
                    className="text-sm text-muted-foreground hover:text-foreground px-3 py-2"
                  >
                    Adicionar mais detalhes →
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60"
                >
                  <Plus size={16} aria-hidden="true" />{" "}
                  {submitMutation.isPending ? "Enviando…" : "Salvar receita"}
                </button>
              </div>
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-destructive inline-flex items-center gap-1.5">
                <AlertCircle size={14} aria-hidden="true" /> {submitError}
              </p>
            )}
          </form>

          {/* PREVIEW */}
          <aside aria-label="Pré-visualização" className="lg:sticky lg:top-6 self-start">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              <Eye size={13} aria-hidden="true" /> Pré-visualização
            </div>
            <RecipeCard recipe={previewRecipe} />
            {mode === "full" && previewRecipe.ingredients.length > 0 && (
              <div className="mt-4 bg-card border border-border/60 rounded-2xl p-4">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Ingredientes ({previewRecipe.ingredients.length})
                </p>
                <ul className="text-sm text-foreground/90 space-y-1 list-disc list-inside">
                  {previewRecipe.ingredients.slice(0, 6).map((i, idx) => (
                    <li key={idx}>{i}</li>
                  ))}
                  {previewRecipe.ingredients.length > 6 && (
                    <li className="text-muted-foreground list-none">
                      + {previewRecipe.ingredients.length - 6} outros
                    </li>
                  )}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {/* PENDING (recently submitted, awaiting validation) */}
        <section className="mt-14">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-2xl font-bold">Aguardando validação</h2>
            <Link to="/validar" className="text-sm text-primary hover:underline font-medium">
              Ir para validação →
            </Link>
          </div>
          {pendingRecipes.length === 0 ? (
            <p className="text-muted-foreground text-sm bg-card border border-dashed border-border rounded-2xl p-6 text-center">
              Nenhuma receita pendente. Cadastre a primeira acima.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {pendingRecipes.map((r) => {
                const opt = sourceOptions.find((o) => o.value === r.source)!;
                const Icon = opt.icon;
                return (
                  <li
                    key={r.id}
                    className="bg-card border border-border/60 rounded-2xl p-4 flex items-start gap-3"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon size={16} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.category} • {opt.label}
                      </p>
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {r.sourceUrl}
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ---------- AI extraction ---------- */

function AiExtract({ onExtracted }: { onExtracted: (data: Partial<FormValues>) => void }) {
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [sourceType, setSourceType] = useState<ExtractSourceType>("instagram");
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "success" | "error" | "warning";
    msg: string;
  }>({ type: "idle", msg: "" });
  const [open, setOpen] = useState(false);

  const extract = async () => {
    if (!url.trim() && !rawText.trim()) {
      setStatus({ type: "error", msg: "Cole uma URL ou o texto da receita." });
      return;
    }

    setStatus({ type: "loading", msg: "Conversando com a IA local no seu Mac…" });

    try {
      const res = await fetch(`${LOCAL_AI_BRIDGE_URL}/extract-recipe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceType,
          sourceUrl: url.trim(),
          rawText: rawText.trim(),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Erro HTTP ${res.status}`);
      }

      const parsed = (await res.json()) as {
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

      const validDiff = ["Fácil", "Médio", "Difícil"];
      const mappedSource: SourceType = sourceType === "text" ? "link" : sourceType;
      const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.filter(Boolean) : [];
      const confidence = parsed.confidence ?? "medium";
      const extracted: Partial<FormValues> = {
        title: parsed.title ?? "",
        category: parsed.category ?? "",
        source: mappedSource,
        sourceUrl: url.trim() || "",
        image: parsed.image ?? "",
        time: parsed.time ?? "",
        difficulty: validDiff.includes(parsed.difficulty ?? "")
          ? (parsed.difficulty as FormValues["difficulty"])
          : "Fácil",
        servings: parsed.servings ?? undefined,
        tagsInput: Array.isArray(parsed.tags) ? parsed.tags.join(", ") : "",
        ingredients:
          Array.isArray(parsed.ingredients) && parsed.ingredients.length
            ? parsed.ingredients.map((v) => ({ value: String(v) }))
            : [{ value: "" }],
        steps:
          Array.isArray(parsed.steps) && parsed.steps.length
            ? parsed.steps.map((v) => ({ value: String(v) }))
            : [{ value: "" }],
        notes: parsed.notes ?? "",
        extractionStatus:
          confidence === "high" && warnings.length === 0 ? "ai_extracted" : "needs_review",
        rawSourceText: rawText.trim(),
        extractionWarnings: warnings,
      };

      onExtracted(extracted);
      setStatus({
        type: warnings.length ? "warning" : "success",
        msg: `"${parsed.title ?? "Receita"}" extraída com sucesso! Revise os campos e salve.`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao processar a resposta da IA.";
      setStatus({
        type: "error",
        msg:
          message.includes("Failed to fetch") || message.includes("NetworkError")
            ? "Serviço local indisponível. Abra o Terminal na pasta do projeto e rode: npm run ai:local"
            : message,
      });
    }
  };

  return (
    <div className="mt-6 bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2.5 px-6 py-4 text-left hover:bg-muted/40 transition"
      >
        <Sparkles size={16} className="text-primary shrink-0" aria-hidden="true" />
        <span className="text-sm font-semibold text-foreground">Extrair receita com IA</span>
        <span className="ml-1 text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
          Beta
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-border/60 pt-5">
          <div>
            <label
              htmlFor="ai-source-type"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Tipo de conteúdo
            </label>
            <select
              id="ai-source-type"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as ExtractSourceType)}
              className={inputClass(false)}
            >
              <option value="instagram">Instagram</option>
              <option value="link">Link / Site</option>
              <option value="video">Vídeo</option>
              <option value="pdf">PDF</option>
              <option value="image">Imagem</option>
              <option value="text">Texto colado</option>
            </select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Para Instagram, cole o link e também a legenda ou transcrição. O app não acessa posts
              privados automaticamente.
            </p>
          </div>

          {/* URL */}
          <div>
            <label htmlFor="ai-url" className="block text-sm font-medium text-foreground mb-2">
              URL da receita
            </label>
            <input
              id="ai-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/... ou https://blogdereceitas.com/..."
              className={inputClass(false)}
            />
          </div>

          {/* Raw text fallback */}
          <div>
            <label htmlFor="ai-text" className="block text-sm font-medium text-foreground mb-2">
              Ou cole o texto da receita
            </label>
            <textarea
              id="ai-text"
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Cole aqui o texto completo da receita com ingredientes e modo de preparo…"
              className={`${inputClass(false)} resize-none`}
            />
          </div>

          {status.type !== "idle" && (
            <p
              role="status"
              className={`text-sm inline-flex items-center gap-1.5 ${
                status.type === "error"
                  ? "text-destructive"
                  : status.type === "warning"
                    ? "text-primary"
                    : status.type === "success"
                      ? "text-primary"
                      : "text-muted-foreground"
              }`}
            >
              {status.type === "loading" && (
                <Loader2 size={14} className="animate-spin shrink-0" aria-hidden="true" />
              )}
              {status.msg}
            </p>
          )}

          <button
            type="button"
            onClick={extract}
            disabled={status.type === "loading"}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {status.type === "loading" ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles size={16} aria-hidden="true" />
            )}
            {status.type === "loading" ? "Extraindo…" : "Extrair receita"}
          </button>
          <p className="text-xs text-muted-foreground">
            Antes de usar, mantenha a ponte local ligada no Mac com{" "}
            <code className="font-mono bg-muted px-1.5 py-0.5 rounded">npm run ai:local</code>. A IA
            preenche o formulário, mas a publicação continua passando pela validação.
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function inputClass(error: boolean) {
  return `w-full px-4 py-3 bg-background rounded-xl border text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition ${
    error ? "border-destructive" : "border-border focus:border-primary"
  }`;
}

function Field({
  label,
  id,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-2">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-destructive inline-flex items-center gap-1">
          <AlertCircle size={12} aria-hidden="true" /> {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function DynamicList({
  legend,
  itemLabelPrefix,
  placeholder,
  items,
  errors,
  rootError,
  register,
  onAdd,
  onRemove,
  numbered,
  multiline,
}: {
  legend: string;
  itemLabelPrefix: string;
  placeholder: string;
  items: { id: string }[];
  errors?: { value?: { message?: string } }[];
  rootError?: string;
  register: (i: number) => ReturnType<ReturnType<typeof useForm>["register"]>;
  onAdd: () => void;
  onRemove: (i: number) => void;
  numbered?: boolean;
  multiline?: boolean;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="block text-sm font-medium text-foreground mb-2">
        {legend} <span className="text-primary">*</span>
      </legend>
      <ul className="space-y-2">
        {items.map((field, i) => {
          const err = errors?.[i]?.value?.message;
          return (
            <li key={field.id} className="flex items-start gap-2">
              <span
                className="mt-3 text-muted-foreground shrink-0 w-6 text-center text-xs"
                aria-hidden="true"
              >
                {numbered ? `${i + 1}.` : <GripVertical size={14} className="mx-auto" />}
              </span>
              <div className="flex-1">
                {multiline ? (
                  <textarea
                    rows={2}
                    aria-label={`${itemLabelPrefix} ${i + 1}`}
                    placeholder={placeholder}
                    {...register(i)}
                    className={`${inputClass(!!err)} resize-none`}
                  />
                ) : (
                  <input
                    type="text"
                    aria-label={`${itemLabelPrefix} ${i + 1}`}
                    placeholder={placeholder}
                    {...register(i)}
                    className={inputClass(!!err)}
                  />
                )}
                {err && (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {err}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                disabled={items.length === 1}
                aria-label={`Remover ${itemLabelPrefix.toLowerCase()} ${i + 1}`}
                className="mt-2 p-2 text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground transition"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {rootError && (
        <p role="alert" className="text-xs text-destructive">
          {rootError}
        </p>
      )}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
      >
        <Plus size={14} aria-hidden="true" /> Adicionar {itemLabelPrefix.toLowerCase()}
      </button>
    </fieldset>
  );
}

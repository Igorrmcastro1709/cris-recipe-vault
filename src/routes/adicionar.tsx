import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
} from "lucide-react";
import { Header } from "@/components/Header";
import { RecipeCard } from "@/components/RecipeCard";
import { recipes, type Recipe, type SourceType } from "@/lib/recipes";

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
  component: Adicionar,
});

const STORAGE_KEY = "receitas-da-cris:drafts-v2";
const AUTOSAVE_KEY = "receitas-da-cris:form-autosave";

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

const schema = z
  .object({
    mode: z.enum(["quick", "full"]),
    title: z.string().trim().min(1, "Dê um nome para a receita").max(120),
    category: z.string().trim().min(1, "Escolha ou crie uma categoria").max(60),
    source: z.enum(sourceValues),
    sourceUrl: z.string().trim().url("Cole um link válido (começando com http)"),
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
    steps: z
      .array(z.object({ value: z.string().trim().min(1, "Passo vazio") }))
      .default([]),
    notes: z.string().max(1000).optional().default(""),
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

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1495546200529-39e0e3825bdc?w=800";

interface SavedDraft {
  id: string;
  createdAt: number;
  data: FormValues;
}

function Adicionar() {
  const [mode, setMode] = useState<"quick" | "full">("quick");
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [saved, setSaved] = useState(false);
  const [autosavedAt, setAutosavedAt] = useState<number | null>(null);

  const existingCategories = useMemo(
    () => Array.from(new Set(recipes.map((r) => r.category))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      mode: "quick",
      title: "",
      category: "",
      source: "instagram",
      sourceUrl: "",
      notes: "",
    } as FormValues,
  });

  const { control, register, handleSubmit, watch, reset, setValue, formState } = form;
  const values = watch();

  const ingredientsArray = useFieldArray({ control, name: "ingredients" as never });
  const stepsArray = useFieldArray({ control, name: "steps" as never });

  // Load drafts + autosave on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDrafts(JSON.parse(raw));
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
    if (next === "full") {
      reset({
        mode: "full",
        title: values.title ?? "",
        category: values.category ?? "",
        source: (values.source as SourceType) ?? "instagram",
        sourceUrl: values.sourceUrl ?? "",
        image: "",
        time: "",
        difficulty: "Fácil",
        servings: undefined,
        tagsInput: "",
        ingredients: [{ value: "" }],
        steps: [{ value: "" }],
        notes: values.notes ?? "",
      } as FormValues);
    } else {
      reset({
        mode: "quick",
        title: values.title ?? "",
        category: values.category ?? "",
        source: (values.source as SourceType) ?? "instagram",
        sourceUrl: values.sourceUrl ?? "",
        notes: values.notes ?? "",
      } as FormValues);
    }
  };

  const persist = (next: SavedDraft[]) => {
    setDrafts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* noop */
    }
  };

  const onSubmit = (data: FormValues) => {
    const draft: SavedDraft = { id: crypto.randomUUID(), createdAt: Date.now(), data };
    persist([draft, ...drafts]);
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      /* noop */
    }
    setAutosavedAt(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
    switchMode(mode); // reset to clean state in same mode
  };

  const removeDraft = (id: string) => persist(drafts.filter((d) => d.id !== id));

  const currentSource =
    sourceOptions.find((o) => o.value === values.source) ?? sourceOptions[0];

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
      ingredients: isFull
        ? (values.ingredients ?? []).map((i) => i.value).filter(Boolean)
        : [],
      steps: isFull ? (values.steps ?? []).map((s) => s.value).filter(Boolean) : [],
      validated: false,
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
              required
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
              <Field
                label="Título"
                id="title"
                required
                error={formState.errors.title?.message}
              >
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

            {mode === "full" && values.mode === "full" && (
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
                  <Field
                    label="Tempo"
                    id="time"
                    required
                    error={formState.errors.time?.message}
                  >
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
                  errors={formState.errors.ingredients as { value?: { message?: string } }[] | undefined}
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
                    <Check size={14} aria-hidden="true" /> Rascunho salvo
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
                  "Salvo localmente no seu navegador"
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
                  disabled={formState.isSubmitting}
                  className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60"
                >
                  <Plus size={16} aria-hidden="true" /> Salvar receita
                </button>
              </div>
            </div>
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

        {/* DRAFTS */}
        <section className="mt-14">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-2xl font-bold">Rascunhos</h2>
            <span className="text-sm text-muted-foreground">
              {drafts.length} item{drafts.length === 1 ? "" : "s"}
            </span>
          </div>
          {drafts.length === 0 ? (
            <p className="text-muted-foreground text-sm bg-card border border-dashed border-border rounded-2xl p-6 text-center">
              Nenhum rascunho ainda. Cadastre a primeira receita acima.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {drafts.map((d) => {
                const opt = sourceOptions.find((o) => o.value === d.data.source)!;
                const Icon = opt.icon;
                return (
                  <li
                    key={d.id}
                    className="bg-card border border-border/60 rounded-2xl p-4 flex items-start gap-3"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon size={16} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{d.data.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.data.category} • {opt.label}
                        {d.data.mode === "full" ? " • completa" : " • rápida"}
                      </p>
                      <a
                        href={d.data.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {d.data.sourceUrl}
                      </a>
                    </div>
                    <button
                      onClick={() => removeDraft(d.id)}
                      className="shrink-0 p-2 text-muted-foreground hover:text-destructive transition"
                      aria-label={`Remover rascunho ${d.data.title}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
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
        <p
          role="alert"
          className="mt-1.5 text-xs text-destructive inline-flex items-center gap-1"
        >
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

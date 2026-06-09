import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/Header";
import { RecipeCard } from "@/components/RecipeCard";
import { RequireAdmin } from "@/components/RequireAdmin";
import {
  deleteRecipe,
  fetchRecipeById,
  fetchRecipes,
  setRecipeValidated,
  updateRecipe,
  type Recipe,
  type SourceType,
} from "@/lib/recipes";
import {
  getCatalogQualityIssues,
  mergeCategoryOptions,
  normalizeCategoryLabel,
  normalizeTagList,
  STANDARD_TAGS,
} from "@/lib/catalog";

type EditableRecipe = {
  title: string;
  category: string;
  source: SourceType;
  sourceUrl: string;
  image: string;
  time: string;
  difficulty: string;
  servings: string;
  tagsInput: string;
  ingredients: string[];
  steps: string[];
  notes: string;
  validated: boolean;
};

const sourceOptions: { value: SourceType; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "video", label: "Vídeo" },
  { value: "link", label: "Link / Site" },
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Imagem" },
];

export const Route = createFileRoute("/receita/$id/editar")({
  head: () => ({
    meta: [{ title: "Editar receita — Receitas da Cris" }],
  }),
  component: () => (
    <RequireAdmin>
      <EditRecipe />
    </RequireAdmin>
  ),
});

function EditRecipe() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<EditableRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: allRecipes = [] } = useQuery({
    queryKey: ["recipes", "all"],
    queryFn: () => fetchRecipes(),
  });

  const recipeQuery = useQuery({
    queryKey: ["recipe", id, true],
    queryFn: () => fetchRecipeById(id, { includeDrafts: true }),
  });

  const recipe = recipeQuery.data;

  useEffect(() => {
    if (recipe) setForm(recipeToForm(recipe));
  }, [recipe]);

  const categoryOptions = useMemo(
    () => mergeCategoryOptions(allRecipes.map((recipeOption) => recipeOption.category)),
    [allRecipes],
  );

  const previewRecipe = useMemo(() => {
    if (!recipe || !form) return null;
    return formToRecipePreview(recipe, form);
  }, [recipe, form]);

  const qualityIssues = previewRecipe ? getCatalogQualityIssues(previewRecipe) : [];

  const saveMutation = useMutation({
    mutationFn: async (values: EditableRecipe) => {
      if (!recipe) throw new Error("Receita não carregada.");
      const tags = normalizeTagList(values.tagsInput.split(","));
      const updated = await updateRecipe(recipe.id, {
        title: values.title.trim(),
        category: normalizeCategoryLabel(values.category),
        source: values.source,
        sourceUrl: values.sourceUrl.trim(),
        image: values.image.trim(),
        time: values.time.trim(),
        difficulty: values.difficulty,
        servings: values.servings.trim() ? Number(values.servings) : null,
        tags,
        ingredients: values.ingredients.map((item) => item.trim()).filter(Boolean),
        steps: values.steps.map((item) => item.trim()).filter(Boolean),
        notes: values.notes.trim() || null,
        extractionStatus:
          recipe.extractionStatus === "needs_review" ? "ai_extracted" : recipe.extractionStatus,
      });
      if (values.validated !== recipe.validated) {
        await setRecipeValidated(recipe.id, values.validated);
      }
      return updated;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["recipes"] });
      await qc.invalidateQueries({ queryKey: ["recipe", id] });
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a receita.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!recipe) throw new Error("Receita não carregada.");
      await deleteRecipe(recipe.id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["recipes"] });
      await navigate({ to: "/" });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a receita.");
    },
  });

  const updateField = <Key extends keyof EditableRecipe>(key: Key, value: EditableRecipe[Key]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateListItem = (key: "ingredients" | "steps", index: number, value: string) => {
    setForm((current) => {
      if (!current) return current;
      const next = [...current[key]];
      next[index] = value;
      return { ...current, [key]: next };
    });
  };

  const addListItem = (key: "ingredients" | "steps") => {
    setForm((current) => (current ? { ...current, [key]: [...current[key], ""] } : current));
  };

  const removeListItem = (key: "ingredients" | "steps", index: number) => {
    setForm((current) => {
      if (!current) return current;
      const next = current[key].filter((_, itemIndex) => itemIndex !== index);
      return { ...current, [key]: next.length ? next : [""] };
    });
  };

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    if (!form.title.trim()) {
      setError("Informe um título para a receita.");
      return;
    }
    if (!form.category.trim()) {
      setError("Informe uma categoria para a receita.");
      return;
    }
    if (form.sourceUrl.trim() && form.sourceUrl.trim() !== "#") {
      try {
        new URL(form.sourceUrl.trim());
      } catch {
        setError("A URL da fonte precisa começar com http:// ou https://.");
        return;
      }
    }
    setError(null);
    saveMutation.mutate(form);
  };

  const handleDelete = () => {
    if (!recipe) return;
    const confirmed = window.confirm(
      `Excluir "${recipe.title}"? Essa ação remove a receita do catálogo e não pode ser desfeita.`,
    );
    if (confirmed) deleteMutation.mutate();
  };

  if (recipeQuery.isLoading || !form) {
    return (
      <PageShell>
        <div className="py-20 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
          <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando edição…
        </div>
      </PageShell>
    );
  }

  if (recipeQuery.error || !recipe) {
    return (
      <PageShell>
        <div className="py-20 text-center">
          <h1 className="font-serif text-3xl font-bold mb-3">Receita não encontrada</h1>
          <Link to="/" className="text-primary font-medium hover:underline">
            Voltar ao catálogo
          </Link>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <Link
            to="/receita/$id"
            params={{ id: recipe.id }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition mb-5"
          >
            <ArrowLeft size={14} aria-hidden="true" /> Voltar para receita
          </Link>
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
            Administração
          </p>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground">
            Editar receita
          </h1>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-60"
        >
          <Trash2 size={16} aria-hidden="true" />
          {deleteMutation.isPending ? "Excluindo…" : "Excluir receita"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,360px)] gap-8">
        <form
          onSubmit={handleSave}
          className="bg-card border border-border/60 rounded-2xl p-6 md:p-7 shadow-sm space-y-5"
        >
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Padrão de catálogo</h2>
            <p className="text-sm text-muted-foreground">
              Use categorias consistentes e tags curtas. Isso deixa a busca mais previsível quando
              houver muitas receitas salvas.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Tags sugeridas: {STANDARD_TAGS.slice(0, 8).join(", ")}.
            </p>
          </section>

          <div className="flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-4">
            <input
              id="validated"
              type="checkbox"
              checked={form.validated}
              onChange={(event) => updateField("validated", event.target.checked)}
              className="h-5 w-5 rounded-md border-border accent-primary"
            />
            <label htmlFor="validated" className="text-sm">
              <span className="font-semibold text-foreground">Publicada no catálogo</span>
              <span className="block text-muted-foreground">
                Desmarque para voltar a receita para validação.
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Título" required>
              <input
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                className={inputClass}
                placeholder="Ex.: Bolo de fubá cremoso"
              />
            </Field>
            <Field label="Categoria" required hint="Escolha uma sugestão ou mantenha uma nova">
              <input
                value={form.category}
                onChange={(event) => updateField("category", event.target.value)}
                onBlur={() => updateField("category", normalizeCategoryLabel(form.category))}
                list="edit-category-suggestions"
                className={inputClass}
                placeholder="Ex.: Sopas"
              />
              <datalist id="edit-category-suggestions">
                {categoryOptions.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Tipo de fonte">
              <select
                value={form.source}
                onChange={(event) => updateField("source", event.target.value as SourceType)}
                className={inputClass}
              >
                {sourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Link da fonte">
              <input
                value={form.sourceUrl}
                onChange={(event) => updateField("sourceUrl", event.target.value)}
                className={inputClass}
                placeholder="https://..."
                inputMode="url"
              />
            </Field>
          </div>

          <Field label="Imagem (URL)" hint="Foto real da receita, se disponível">
            <input
              value={form.image}
              onChange={(event) => updateField("image", event.target.value)}
              className={inputClass}
              placeholder="https://..."
              inputMode="url"
            />
          </Field>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Field label="Tempo">
              <input
                value={form.time}
                onChange={(event) => updateField("time", event.target.value)}
                className={inputClass}
                placeholder="Ex.: 45 min"
              />
            </Field>
            <Field label="Dificuldade">
              <select
                value={form.difficulty}
                onChange={(event) => updateField("difficulty", event.target.value)}
                className={inputClass}
              >
                <option>Fácil</option>
                <option>Médio</option>
                <option>Difícil</option>
              </select>
            </Field>
            <Field label="Porções">
              <input
                value={form.servings}
                onChange={(event) => updateField("servings", event.target.value)}
                className={inputClass}
                min={1}
                max={50}
                type="number"
                placeholder="Ex.: 4"
              />
            </Field>
          </div>

          <Field label="Tags" hint="Separe por vírgula">
            <input
              value={form.tagsInput}
              onChange={(event) => updateField("tagsInput", event.target.value)}
              className={inputClass}
              placeholder="rápido, jantar, forno..."
            />
          </Field>

          <DynamicTextList
            title="Ingredientes"
            items={form.ingredients}
            placeholder="Ex.: 2 xícaras de farinha"
            onChange={(index, value) => updateListItem("ingredients", index, value)}
            onAdd={() => addListItem("ingredients")}
            onRemove={(index) => removeListItem("ingredients", index)}
          />

          <DynamicTextList
            title="Passo a passo"
            items={form.steps}
            placeholder="Descreva esta etapa..."
            multiline
            numbered
            onChange={(index, value) => updateListItem("steps", index, value)}
            onAdd={() => addListItem("steps")}
            onRemove={(index) => removeListItem("steps", index)}
          />

          <Field label="Notas">
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className={`${inputClass} min-h-28 resize-y`}
              placeholder="Observações, adaptações, tradução, dicas..."
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm text-destructive inline-flex items-center gap-1.5">
              <AlertCircle size={14} aria-hidden="true" /> {error}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {saved ? (
                <span className="inline-flex items-center gap-1 text-primary font-semibold">
                  <Check size={14} aria-hidden="true" /> Alterações salvas
                </span>
              ) : (
                "Revise os campos antes de salvar."
              )}
            </p>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
            >
              <Save size={16} aria-hidden="true" />
              {saveMutation.isPending ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>

        <aside aria-label="Pré-visualização" className="lg:sticky lg:top-6 self-start space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">
              <Eye size={13} aria-hidden="true" /> Pré-visualização
            </div>
            {previewRecipe && <RecipeCard recipe={previewRecipe} />}
          </div>

          <section className="bg-card border border-border/60 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Checklist editorial</h2>
            {qualityIssues.length === 0 ? (
              <p className="text-sm text-primary inline-flex items-center gap-1.5">
                <Check size={14} aria-hidden="true" /> Receita completa para o catálogo.
              </p>
            ) : (
              <ul className="space-y-1 text-sm text-muted-foreground list-disc list-inside">
                {qualityIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}

function recipeToForm(recipe: Recipe): EditableRecipe {
  return {
    title: recipe.title,
    category: recipe.category,
    source: recipe.source,
    sourceUrl: recipe.sourceUrl === "#" ? "" : recipe.sourceUrl,
    image: recipe.image,
    time: recipe.time,
    difficulty: recipe.difficulty || "Fácil",
    servings: recipe.servings ? String(recipe.servings) : "",
    tagsInput: recipe.tags.join(", "),
    ingredients: recipe.ingredients.length ? recipe.ingredients : [""],
    steps: recipe.steps.length ? recipe.steps : [""],
    notes: recipe.notes ?? "",
    validated: recipe.validated,
  };
}

function formToRecipePreview(recipe: Recipe, form: EditableRecipe): Recipe {
  return {
    ...recipe,
    title: form.title.trim() || "Título da receita",
    category: normalizeCategoryLabel(form.category) || "Categoria",
    source: form.source,
    sourceUrl: form.sourceUrl.trim() || "#",
    image: form.image.trim(),
    time: form.time.trim(),
    difficulty: form.difficulty,
    servings: form.servings.trim() ? Number(form.servings) : null,
    tags: normalizeTagList(form.tagsInput.split(",")),
    ingredients: form.ingredients.map((item) => item.trim()).filter(Boolean),
    steps: form.steps.map((item) => item.trim()).filter(Boolean),
    notes: form.notes.trim() || null,
    validated: form.validated,
  };
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-foreground mb-2">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground mt-1.5">{hint}</span>}
    </label>
  );
}

function DynamicTextList({
  title,
  items,
  placeholder,
  multiline,
  numbered,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  placeholder: string;
  multiline?: boolean;
  numbered?: boolean;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-foreground">{title}</legend>
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="mt-3 text-muted-foreground" aria-hidden="true">
            {numbered ? index + 1 : <GripVertical size={16} />}
          </span>
          {multiline ? (
            <textarea
              value={item}
              onChange={(event) => onChange(index, event.target.value)}
              className={`${inputClass} min-h-24 resize-y`}
              placeholder={placeholder}
              aria-label={`${title} ${index + 1}`}
            />
          ) : (
            <input
              value={item}
              onChange={(event) => onChange(index, event.target.value)}
              className={inputClass}
              placeholder={placeholder}
              aria-label={`${title} ${index + 1}`}
            />
          )}
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="mt-2 inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remover ${title.toLocaleLowerCase("pt-BR")} ${index + 1}`}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary/40"
      >
        <Plus size={15} aria-hidden="true" /> Adicionar item
      </button>
    </fieldset>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20";

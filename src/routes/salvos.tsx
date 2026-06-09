import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  ExternalLink,
  Instagram,
  Loader2,
  RefreshCw,
  Save,
  WandSparkles,
} from "lucide-react";
import { Header } from "@/components/Header";
import { RequireAdmin } from "@/components/RequireAdmin";
import { RecipeImage } from "@/components/RecipeImage";
import {
  archiveInstagramSavedItem,
  convertInstagramSavedItemToRecipe,
  fetchInstagramSavedItems,
  updateInstagramSavedItem,
  type InstagramSavedItem,
  type InstagramSavedStatus,
} from "@/lib/instagram-saved";
import { STANDARD_TAGS } from "@/lib/catalog";

type StatusFilter =
  | "active"
  | "inbox"
  | "needs_text"
  | "ready_to_convert"
  | "converted"
  | "archived";

const filterOptions = (
  counts: Record<"active" | "inbox" | "needsText" | "ready" | "converted" | "archived", number>,
): { value: StatusFilter; label: string; count: number }[] => [
  { value: "active", label: "Ativos", count: counts.active },
  { value: "inbox", label: "Inbox", count: counts.inbox },
  { value: "needs_text", label: "Sem texto", count: counts.needsText },
  { value: "ready_to_convert", label: "Prontos", count: counts.ready },
  { value: "converted", label: "Convertidos", count: counts.converted },
  { value: "archived", label: "Arquivados", count: counts.archived },
];

export const Route = createFileRoute("/salvos")({
  head: () => ({
    meta: [{ title: "Salvos do Instagram — Receitas da Cris" }],
  }),
  component: () => (
    <RequireAdmin>
      <InstagramSavedInbox />
    </RequireAdmin>
  ),
});

function InstagramSavedInbox() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");

  const {
    data: items = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["instagram-saved-items"],
    queryFn: fetchInstagramSavedItems,
  });

  const filtered = useMemo(() => {
    if (statusFilter === "active") {
      return items.filter((item) => !["converted", "archived"].includes(item.status));
    }
    return items.filter((item) => item.status === statusFilter);
  }, [items, statusFilter]);

  const counts = useMemo(() => {
    const count = (status: InstagramSavedStatus) =>
      items.filter((item) => item.status === status).length;
    return {
      active: items.filter((item) => !["converted", "archived"].includes(item.status)).length,
      inbox: count("inbox"),
      needsText: count("needs_text"),
      ready: count("ready_to_convert"),
      converted: count("converted"),
      archived: count("archived"),
    };
  }, [items]);

  const updateMutation = useMutation({
    mutationFn: ({ item, values }: { item: InstagramSavedItem; values: EditableValues }) =>
      updateInstagramSavedItem(item.id, {
        title: values.title,
        category: values.category,
        image: values.image,
        rawText: values.rawText,
        notes: values.notes,
        tags: values.tagsInput
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        status: values.rawText.trim() ? "ready_to_convert" : "needs_text",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instagram-saved-items"] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveInstagramSavedItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instagram-saved-items"] }),
  });

  const convertMutation = useMutation({
    mutationFn: (item: InstagramSavedItem) => convertInstagramSavedItemToRecipe(item),
    onSuccess: async (recipe) => {
      await qc.invalidateQueries({ queryKey: ["instagram-saved-items"] });
      await qc.invalidateQueries({ queryKey: ["recipes"] });
      await navigate({ to: "/receita/$id/editar", params: { id: recipe.id } });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
              Caixa de entrada
            </p>
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground">
              Salvos do Instagram
            </h1>
            <p className="mt-3 text-muted-foreground max-w-2xl">
              Guarde links sem precisar completar tudo na hora. Depois você organiza, completa e
              transforma em receita.
            </p>
          </div>
          <Link
            to="/adicionar"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Instagram size={16} aria-hidden="true" /> Adicionar link
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Ativos" value={counts.active} />
          <Stat label="Sem texto" value={counts.needsText} />
          <Stat label="Prontos" value={counts.ready} />
          <Stat label="Convertidos" value={counts.converted} />
          <Stat label="Arquivados" value={counts.archived} />
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {filterOptions(counts).map(({ value, label, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted-foreground inline-flex items-center justify-center gap-2 w-full">
            <Loader2 size={18} className="animate-spin" aria-hidden="true" /> Carregando salvos…
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
            Não consegui carregar os salvos. Confirme se a migration foi aplicada no Supabase.
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <h2 className="font-serif text-2xl font-bold">Nenhum salvo por aqui</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cole um link do Instagram em Adicionar ou rode a importação em lote.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {filtered.map((item) => (
              <SavedItemCard
                key={item.id}
                item={item}
                saving={updateMutation.isPending && updateMutation.variables?.item.id === item.id}
                archiving={archiveMutation.isPending && archiveMutation.variables === item.id}
                converting={convertMutation.isPending && convertMutation.variables?.id === item.id}
                onSave={(values) => updateMutation.mutate({ item, values })}
                onArchive={() => archiveMutation.mutate(item.id)}
                onConvert={() => convertMutation.mutate(item)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

type EditableValues = {
  title: string;
  category: string;
  image: string;
  rawText: string;
  notes: string;
  tagsInput: string;
};

function SavedItemCard({
  item,
  saving,
  archiving,
  converting,
  onSave,
  onArchive,
  onConvert,
}: {
  item: InstagramSavedItem;
  saving: boolean;
  archiving: boolean;
  converting: boolean;
  onSave: (values: EditableValues) => void;
  onArchive: () => void;
  onConvert: () => void;
}) {
  const [values, setValues] = useState<EditableValues>({
    title: item.title,
    category: item.category,
    image: item.image,
    rawText: item.rawText ?? "",
    notes: item.notes ?? "",
    tagsInput: item.tags.join(", "),
  });

  const canConvert = item.status !== "converted" && item.status !== "archived";
  const hasText = values.rawText.trim().length > 0;

  const update = <Key extends keyof EditableValues>(key: Key, value: EditableValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  return (
    <article className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-5">
        <RecipeImage
          image={values.image}
          title={values.title}
          category={values.category}
          className="h-40 overflow-hidden rounded-xl"
          imgClassName="h-full w-full object-cover"
          compact
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              <Instagram size={13} aria-hidden="true" /> Instagram
            </span>
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
              {statusLabel(item.status)}
            </span>
            {item.collectionName && (
              <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
                {item.collectionName}
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Título">
              <input
                value={values.title}
                onChange={(event) => update("title", event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Categoria">
              <input
                value={values.category}
                onChange={(event) => update("category", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Imagem">
              <input
                value={values.image}
                onChange={(event) => update("image", event.target.value)}
                className={inputClass}
                placeholder="https://..."
              />
            </Field>
            <Field label="Tags" hint={`Sugestões: ${STANDARD_TAGS.slice(0, 4).join(", ")}`}>
              <input
                value={values.tagsInput}
                onChange={(event) => update("tagsInput", event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Legenda ou transcrição" hint="Cole aqui o texto do post/Reel quando tiver.">
            <textarea
              value={values.rawText}
              onChange={(event) => update("rawText", event.target.value)}
              className={`${inputClass} min-h-28 resize-y`}
              placeholder="Cole legenda, ingredientes, transcrição ou observações..."
            />
          </Field>

          <Field label="Notas">
            <textarea
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
              className={`${inputClass} min-h-20 resize-y`}
            />
          </Field>

          {item.warnings.length > 0 && (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/80">
              {item.warnings.slice(0, 3).map((warning) => (
                <p key={warning}>• {warning}</p>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:border-primary/40"
            >
              Abrir no Instagram <ExternalLink size={14} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => onSave(values)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/15 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              Salvar
            </button>
            <button
              type="button"
              onClick={onConvert}
              disabled={!canConvert || converting}
              title={
                hasText
                  ? "Criar uma receita para revisar e validar"
                  : "Você pode converter agora e completar depois na edição da receita"
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {converting ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <WandSparkles size={14} aria-hidden="true" />
              )}
              Transformar em receita
            </button>
            <button
              type="button"
              onClick={onArchive}
              disabled={archiving || item.status === "archived"}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
            >
              {archiving ? (
                <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Archive size={14} aria-hidden="true" />
              )}
              Arquivar
            </button>
            {item.recipeId && (
              <Link
                to="/receita/$id/editar"
                params={{ id: item.recipeId }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Check size={14} aria-hidden="true" /> Ver receita
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

function statusLabel(status: InstagramSavedStatus) {
  const labels: Record<InstagramSavedStatus, string> = {
    inbox: "Inbox",
    needs_text: "Precisa completar",
    ready_to_convert: "Pronto para converter",
    converted: "Convertido",
    archived: "Arquivado",
  };
  return labels[status];
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20";

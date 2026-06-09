import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { createRecipe, type Recipe } from "@/lib/recipes";
import { normalizeCategoryLabel, normalizeTagList } from "@/lib/catalog";

export type InstagramSavedStatus =
  | "inbox"
  | "needs_text"
  | "ready_to_convert"
  | "converted"
  | "archived";

export interface InstagramSavedItem {
  id: string;
  sourceUrl: string;
  externalSourceId: string;
  title: string;
  category: string;
  image: string;
  collectionName?: string | null;
  rawText?: string | null;
  notes?: string | null;
  tags: string[];
  status: InstagramSavedStatus;
  recipeId?: string | null;
  importBatchId?: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

type Row = Database["public"]["Tables"]["instagram_saved_items"]["Row"];

export interface NewInstagramSavedItemInput {
  sourceUrl: string;
  externalSourceId?: string;
  title?: string;
  category?: string;
  image?: string;
  collectionName?: string | null;
  rawText?: string | null;
  notes?: string | null;
  tags?: string[];
  status?: InstagramSavedStatus;
  importBatchId?: string | null;
  warnings?: string[];
}

export type UpdateInstagramSavedItemInput = Partial<
  Omit<NewInstagramSavedItemInput, "sourceUrl" | "externalSourceId" | "importBatchId">
> & {
  status?: InstagramSavedStatus;
};

export function mapInstagramSavedRow(row: Row): InstagramSavedItem {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    externalSourceId: row.external_source_id,
    title: row.title,
    category: row.category,
    image: row.image,
    collectionName: row.collection_name,
    rawText: row.raw_text,
    notes: row.notes,
    tags: row.tags ?? [],
    status: row.status as InstagramSavedStatus,
    recipeId: row.recipe_id,
    importBatchId: row.import_batch_id,
    warnings: row.warnings ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchInstagramSavedItems(): Promise<InstagramSavedItem[]> {
  const { data, error } = await supabase
    .from("instagram_saved_items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapInstagramSavedRow);
}

export async function createInstagramSavedItem(
  input: NewInstagramSavedItemInput,
): Promise<InstagramSavedItem> {
  const sourceUrl = normalizeInstagramUrl(input.sourceUrl);
  const externalSourceId = input.externalSourceId ?? stableExternalSourceId(sourceUrl);
  const { data, error } = await supabase
    .from("instagram_saved_items")
    .upsert(
      {
        source_url: sourceUrl,
        external_source_id: externalSourceId,
        title: input.title?.trim() || "Receita salva do Instagram",
        category: normalizeCategoryLabel(input.category ?? "") || "Sem categoria",
        image: input.image?.trim() || "",
        collection_name: input.collectionName?.trim() || null,
        raw_text: input.rawText?.trim() || null,
        notes:
          input.notes?.trim() ||
          "Link do Instagram salvo para organização. Complete antes de transformar em receita.",
        tags: normalizeTagList(input.tags ?? ["instagram", "importado"]),
        status: input.status ?? "inbox",
        import_batch_id: input.importBatchId ?? null,
        warnings: input.warnings ?? [
          "Item salvo do Instagram.",
          "Complete antes de transformar em receita.",
        ],
      },
      { onConflict: "source_url" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return mapInstagramSavedRow(data);
}

export async function updateInstagramSavedItem(
  id: string,
  input: UpdateInstagramSavedItemInput,
): Promise<InstagramSavedItem> {
  const changes: Database["public"]["Tables"]["instagram_saved_items"]["Update"] = {};
  if (input.title !== undefined) changes.title = input.title.trim() || "Receita salva do Instagram";
  if (input.category !== undefined) {
    changes.category = normalizeCategoryLabel(input.category) || "Sem categoria";
  }
  if (input.image !== undefined) changes.image = input.image.trim();
  if (input.collectionName !== undefined) changes.collection_name = input.collectionName || null;
  if (input.rawText !== undefined) changes.raw_text = input.rawText || null;
  if (input.notes !== undefined) changes.notes = input.notes || null;
  if (input.tags !== undefined) changes.tags = normalizeTagList(input.tags);
  if (input.status !== undefined) changes.status = input.status;
  if (input.warnings !== undefined) changes.warnings = input.warnings;

  const { data, error } = await supabase
    .from("instagram_saved_items")
    .update(changes)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapInstagramSavedRow(data);
}

export async function archiveInstagramSavedItem(id: string): Promise<void> {
  const { error } = await supabase
    .from("instagram_saved_items")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) throw error;
}

export async function convertInstagramSavedItemToRecipe(item: InstagramSavedItem): Promise<Recipe> {
  const recipe = await createRecipe({
    title: item.title,
    category: item.category,
    source: "instagram",
    sourceUrl: item.sourceUrl,
    image: item.image,
    tags: normalizeTagList([...item.tags, "instagram"]),
    ingredients: [],
    steps: [],
    notes:
      item.notes ||
      "Receita criada a partir de um item salvo do Instagram. Revise antes de validar.",
    extractionStatus: "needs_review",
    rawSourceText: item.rawText,
    extractionWarnings: Array.from(
      new Set([
        ...item.warnings,
        "Convertida de Salvos do Instagram.",
        "Complete ingredientes e passo a passo antes de validar.",
      ]),
    ),
    importBatchId: item.importBatchId,
    externalSourceId: item.externalSourceId,
    sourceCollection: item.collectionName,
  });

  const { error } = await supabase
    .from("instagram_saved_items")
    .update({ status: "converted", recipe_id: recipe.id })
    .eq("id", item.id);
  if (error) throw error;

  return recipe;
}

export function normalizeInstagramUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url.trim();
  }
}

export function stableExternalSourceId(sourceUrl: string) {
  const normalized = normalizeInstagramUrl(sourceUrl);
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return `ig_${hash.toString(16)}`;
}

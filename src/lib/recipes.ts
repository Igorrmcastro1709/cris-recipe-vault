import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type SourceType = "instagram" | "pdf" | "video" | "image" | "link";
export type ExtractionStatus = "manual" | "ai_extracted" | "needs_review";

export interface Recipe {
  id: string;
  title: string;
  category: string;
  source: SourceType;
  sourceUrl: string;
  image: string;
  time: string;
  difficulty: string;
  servings?: number | null;
  tags: string[];
  ingredients: string[];
  steps: string[];
  notes?: string | null;
  validated: boolean;
  extractionStatus: ExtractionStatus;
  rawSourceText?: string | null;
  extractionWarnings: string[];
  extractedAt?: string | null;
}

type Row = Database["public"]["Tables"]["recipes"]["Row"];

export function mapRow(r: Row): Recipe {
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    source: r.source as SourceType,
    sourceUrl: r.source_url,
    image: r.image,
    time: r.time,
    difficulty: r.difficulty,
    servings: r.servings,
    tags: r.tags ?? [],
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    notes: r.notes,
    validated: r.validated,
    extractionStatus: (r.extraction_status ?? "manual") as ExtractionStatus,
    rawSourceText: r.raw_source_text,
    extractionWarnings: r.extraction_warnings ?? [],
    extractedAt: r.extracted_at,
  };
}

export async function fetchRecipes(opts?: { onlyValidated?: boolean }): Promise<Recipe[]> {
  let q = supabase.from("recipes").select("*").order("created_at", { ascending: false });
  if (opts?.onlyValidated) q = q.eq("validated", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function fetchRecipeById(
  id: string,
  opts?: { includeDrafts?: boolean },
): Promise<Recipe | null> {
  let q = supabase.from("recipes").select("*").eq("id", id);
  if (!opts?.includeDrafts) q = q.eq("validated", true);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data ? mapRow(data) : null;
}

export interface NewRecipeInput {
  title: string;
  category: string;
  source: SourceType;
  sourceUrl: string;
  image?: string;
  time?: string;
  difficulty?: string;
  servings?: number | null;
  tags?: string[];
  ingredients?: string[];
  steps?: string[];
  notes?: string | null;
  extractionStatus?: ExtractionStatus;
  rawSourceText?: string | null;
  extractionWarnings?: string[];
  extractedAt?: string | null;
}

export async function createRecipe(input: NewRecipeInput): Promise<Recipe> {
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      title: input.title,
      category: input.category,
      source: input.source,
      source_url: input.sourceUrl || "#",
      image: input.image || "",
      time: input.time || "",
      difficulty: input.difficulty || "Fácil",
      servings: input.servings ?? null,
      tags: input.tags ?? [],
      ingredients: input.ingredients ?? [],
      steps: input.steps ?? [],
      notes: input.notes ?? null,
      validated: false,
      extraction_status: input.extractionStatus ?? "manual",
      raw_source_text: input.rawSourceText ?? null,
      extraction_warnings: input.extractionWarnings ?? [],
      extracted_at: input.extractedAt ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export type UpdateRecipeInput = Partial<NewRecipeInput>;

export async function updateRecipe(id: string, input: UpdateRecipeInput): Promise<Recipe> {
  const changes: Database["public"]["Tables"]["recipes"]["Update"] = {};

  if (input.title !== undefined) changes.title = input.title;
  if (input.category !== undefined) changes.category = input.category;
  if (input.source !== undefined) changes.source = input.source;
  if (input.sourceUrl !== undefined) changes.source_url = input.sourceUrl || "#";
  if (input.image !== undefined) changes.image = input.image || "";
  if (input.time !== undefined) changes.time = input.time || "";
  if (input.difficulty !== undefined) changes.difficulty = input.difficulty || "Fácil";
  if (input.servings !== undefined) changes.servings = input.servings ?? null;
  if (input.tags !== undefined) changes.tags = input.tags ?? [];
  if (input.ingredients !== undefined) changes.ingredients = input.ingredients ?? [];
  if (input.steps !== undefined) changes.steps = input.steps ?? [];
  if (input.notes !== undefined) changes.notes = input.notes ?? null;
  if (input.extractionStatus !== undefined) {
    changes.extraction_status = input.extractionStatus ?? "manual";
  }
  if (input.rawSourceText !== undefined) changes.raw_source_text = input.rawSourceText ?? null;
  if (input.extractionWarnings !== undefined) {
    changes.extraction_warnings = input.extractionWarnings ?? [];
  }
  if (input.extractedAt !== undefined) changes.extracted_at = input.extractedAt ?? null;

  const { data, error } = await supabase
    .from("recipes")
    .update(changes)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function setRecipeValidated(id: string, validated: boolean): Promise<void> {
  const { error } = await supabase.from("recipes").update({ validated }).eq("id", id);
  if (error) throw error;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw error;
}

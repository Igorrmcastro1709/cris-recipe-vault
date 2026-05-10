import data from "@/data/recipes.json";

export type SourceType = "instagram" | "pdf" | "video" | "image" | "link";

export interface Recipe {
  id: string;
  title: string;
  category: string;
  source: SourceType;
  sourceUrl: string;
  image: string;
  time: string;
  difficulty: string;
  tags: string[];
  ingredients: string[];
  steps: string[];
  validated: boolean;
}

export const recipes: Recipe[] = data as Recipe[];

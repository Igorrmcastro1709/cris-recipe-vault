import type { Recipe } from "@/lib/recipes";

export const STANDARD_CATEGORIES = [
  "Acompanhamentos",
  "Airfryer",
  "Bebidas",
  "Bolos",
  "Café da manhã",
  "Carnes",
  "Doces",
  "Frango",
  "Lanches",
  "Massas",
  "Molhos",
  "Pães",
  "Peixes",
  "Saladas",
  "Sopas",
  "Vegetariano",
] as const;

export const STANDARD_TAGS = [
  "almoço",
  "assado",
  "congelável",
  "fácil",
  "família",
  "forno",
  "jantar",
  "lanche",
  "panela",
  "rápido",
  "sem glúten",
  "sem lactose",
  "sobremesa",
  "vegano",
  "vegetariano",
] as const;

function comparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function uniqueByComparable(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = comparable(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeCategoryLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const match = STANDARD_CATEGORIES.find(
    (category) => comparable(category) === comparable(trimmed),
  );
  return match ?? trimmed;
}

export function normalizeTagList(tags: string[]) {
  return uniqueByComparable(
    tags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => {
        const match = STANDARD_TAGS.find((standard) => comparable(standard) === comparable(tag));
        return match ?? tag;
      }),
  );
}

export function mergeCategoryOptions(categories: string[]) {
  return uniqueByComparable([...STANDARD_CATEGORIES, ...categories])
    .map(normalizeCategoryLabel)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getCatalogQualityIssues(
  recipe: Pick<
    Recipe,
    | "category"
    | "image"
    | "ingredients"
    | "steps"
    | "time"
    | "extractionStatus"
    | "extractionWarnings"
  >,
) {
  const issues: string[] = [];

  if (
    !STANDARD_CATEGORIES.some((category) => comparable(category) === comparable(recipe.category))
  ) {
    issues.push("Categoria fora do padrão sugerido.");
  }
  if (!recipe.image?.trim()) issues.push("Sem imagem real.");
  if (!recipe.time?.trim()) issues.push("Sem tempo de preparo.");
  if (recipe.ingredients.length === 0) issues.push("Sem ingredientes.");
  if (recipe.steps.length === 0) issues.push("Sem passo a passo.");
  if (recipe.extractionStatus === "needs_review")
    issues.push("Extração por IA precisa de revisão.");
  if (recipe.extractionWarnings.length > 0) issues.push(...recipe.extractionWarnings);

  return issues;
}

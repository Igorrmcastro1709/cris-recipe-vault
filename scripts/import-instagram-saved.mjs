import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const RECIPE_COLLECTION_TERMS = [
  "receita",
  "receitas",
  "recipe",
  "recipes",
  "food",
  "comida",
  "cozinha",
  "culinaria",
  "culinária",
];

const CATEGORY_RULES = [
  ["Doces", /bolo|cake|doce|sobremesa|dessert|cookie|brownie|torta|brigadeiro/i],
  ["Frango", /frango|chicken|galinha/i],
  ["Carnes", /carne|beef|meat|porco|pork|costela|bife/i],
  ["Peixes", /peixe|fish|salmao|salmão|shrimp|camarao|camarão/i],
  ["Massas", /massa|pasta|macarrao|macarrão|lasanha|pizza|noodle/i],
  ["Sopas", /sopa|soup|caldo|broth/i],
  ["Saladas", /salada|salad/i],
  ["Pães", /pao|pão|bread|focaccia/i],
  ["Bebidas", /bebida|drink|suco|juice|smoothie|vitamina/i],
  ["Vegetariano", /vegetariano|vegetarian|vegano|vegan/i],
];

const args = parseArgs(process.argv.slice(2));

if (!args.inputPath) {
  printHelp();
  process.exit(1);
}

const inputPath = path.resolve(args.inputPath);
if (!existsSync(inputPath)) {
  console.error(`Pasta ou arquivo não encontrado: ${inputPath}`);
  process.exit(1);
}

const env = loadEnv();
const dryRun = args.dryRun;
const files = await listJsonFiles(inputPath);
const discovered = [];

for (const file of files) {
  try {
    const json = JSON.parse(await fs.readFile(file, "utf8"));
    scanForInstagramItems(json, {
      file,
      breadcrumbs: [path.relative(inputPath, file)],
      results: discovered,
    });
  } catch (error) {
    console.warn(`Não consegui ler ${file}: ${error instanceof Error ? error.message : error}`);
  }
}

const deduped = dedupeItems(discovered);
const recipeLike = deduped.filter((item) => isRecipeCollection(item.collection || item.context));
const selected = args.all || recipeLike.length === 0 ? deduped : recipeLike;
const limited = args.limit ? selected.slice(0, args.limit) : selected;

console.log(`Arquivos JSON analisados: ${files.length}`);
console.log(`Links do Instagram encontrados: ${discovered.length}`);
console.log(`Links únicos: ${deduped.length}`);
console.log(`Links selecionados para importar: ${limited.length}`);
if (!args.all && recipeLike.length > 0) {
  console.log(`Filtro aplicado: coleções/caminhos relacionados a receitas (${recipeLike.length}).`);
}
if (!args.all && recipeLike.length === 0) {
  console.log(
    "Nenhuma coleção claramente relacionada a receitas foi encontrada; usando todos os links.",
  );
}

if (dryRun) {
  console.log("\nPrévia dos primeiros itens:");
  for (const item of limited.slice(0, 10)) {
    console.log(
      `- ${item.title} | ${item.category} | ${item.collection || "sem coleção"} | ${item.url}`,
    );
  }
  process.exit(0);
}

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente ou em .env para importar.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: batch, error: batchError } = await supabase
  .from("recipe_import_batches")
  .insert({
    source: "instagram",
    source_name: "Instagram saved export",
    source_path: inputPath,
    total_found: deduped.length,
    total_imported: 0,
    total_skipped: 0,
    metadata: {
      selected: limited.length,
      filtered_to_recipe_collections: !args.all && recipeLike.length > 0,
      files: files.length,
    },
  })
  .select("id")
  .single();

if (batchError) {
  console.error(`Erro ao criar lote de importação: ${batchError.message}`);
  process.exit(1);
}

let imported = 0;
let skipped = 0;

for (const item of limited) {
  const exists = await recipeAlreadyExists(item);
  if (exists) {
    skipped += 1;
    continue;
  }

  const { error } = await supabase.from("recipes").insert({
    title: item.title,
    category: item.category,
    source: "instagram",
    source_url: item.url,
    image: item.image,
    time: "",
    difficulty: "Fácil",
    servings: null,
    tags: item.tags,
    ingredients: [],
    steps: [],
    notes: item.notes,
    validated: false,
    extraction_status: "needs_review",
    raw_source_text: item.rawText,
    extraction_warnings: item.warnings,
    extracted_at: new Date().toISOString(),
    import_batch_id: batch.id,
    external_source_id: item.externalSourceId,
    source_collection: item.collection || null,
  });

  if (error) {
    if (String(error.message).toLowerCase().includes("duplicate")) {
      skipped += 1;
      continue;
    }
    console.error(`Erro ao importar ${item.url}: ${error.message}`);
    skipped += 1;
    continue;
  }

  imported += 1;
}

await supabase
  .from("recipe_import_batches")
  .update({ total_imported: imported, total_skipped: skipped })
  .eq("id", batch.id);

console.log(`\nImportação concluída.`);
console.log(`Lote: ${batch.id}`);
console.log(`Importados: ${imported}`);
console.log(`Ignorados/duplicados: ${skipped}`);

async function recipeAlreadyExists(item) {
  const byExternalId = await supabase
    .from("recipes")
    .select("id")
    .eq("source", "instagram")
    .eq("external_source_id", item.externalSourceId)
    .limit(1);
  if (byExternalId.error) throw byExternalId.error;
  if ((byExternalId.data ?? []).length > 0) return true;

  const byUrl = await supabase
    .from("recipes")
    .select("id")
    .eq("source", "instagram")
    .eq("source_url", item.url)
    .limit(1);
  if (byUrl.error) throw byUrl.error;
  return (byUrl.data ?? []).length > 0;
}

function parseArgs(argv) {
  const parsed = { inputPath: "", dryRun: false, all: false, limit: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--all") parsed.all = true;
    else if (arg === "--limit") parsed.limit = Number(argv[++index] ?? 0);
    else if (!parsed.inputPath) parsed.inputPath = arg;
  }
  return parsed;
}

function printHelp() {
  console.log(`Uso:
  npm run import:instagram -- /caminho/para/exportacao-instagram
  npm run import:instagram -- /caminho/para/exportacao-instagram -- --dry-run
  npm run import:instagram -- /caminho/para/exportacao-instagram -- --all

Variáveis necessárias para gravar:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
}

function loadEnv() {
  const values = { ...process.env };
  const envPath = path.resolve(".env");
  if (!existsSync(envPath)) return values;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = rawValue.replace(/^["']|["']$/g, "");
  }
  return values;
}

async function listJsonFiles(targetPath) {
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) return targetPath.endsWith(".json") ? [targetPath] : [];

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) files.push(...(await listJsonFiles(fullPath)));
    if (entry.isFile() && entry.name.endsWith(".json")) files.push(fullPath);
  }
  return files;
}

function scanForInstagramItems(value, state) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanForInstagramItems(item, { ...state, breadcrumbs: [...state.breadcrumbs, String(index)] }),
    );
    return;
  }
  if (typeof value !== "object") return;

  const object = value;
  const objectText = collectText(object).join("\n");
  const urls = collectUrls(objectText).filter((url) => url.includes("instagram.com"));
  const collection = findCollectionName(object, state.breadcrumbs);
  const image = findImageUrl(objectText);

  for (const url of urls) {
    state.results.push(buildItem({ url, object, objectText, collection, image, state }));
  }

  for (const [key, child] of Object.entries(object)) {
    scanForInstagramItems(child, { ...state, breadcrumbs: [...state.breadcrumbs, key] });
  }
}

function buildItem({ url, object, objectText, collection, image, state }) {
  const normalizedUrl = normalizeInstagramUrl(url);
  const externalSourceId = hash(normalizedUrl);
  const title = estimateTitle(object, collection, objectText);
  const rawText = objectText.slice(0, 4000);
  const category = estimateCategory(`${title}\n${collection}\n${rawText}`);
  const tags = ["instagram", "importado"];
  if (collection) tags.push(slugTag(collection));

  return {
    url: normalizedUrl,
    externalSourceId,
    title,
    category,
    image,
    collection,
    context: state.breadcrumbs.join(" / "),
    rawText,
    tags: Array.from(new Set(tags.filter(Boolean))),
    notes: [
      "Item importado dos salvos do Instagram.",
      collection ? `Coleção original: ${collection}.` : "",
      "Abra a fonte para conferir legenda, ingredientes e modo de preparo antes de validar.",
    ]
      .filter(Boolean)
      .join("\n"),
    warnings: [
      "Importado do Instagram.",
      "Receita incompleta: revise antes de publicar.",
      "Ingredientes e passo a passo não foram encontrados na exportação.",
    ],
  };
}

function collectText(value, texts = []) {
  if (value == null) return texts;
  if (typeof value === "string") {
    texts.push(value);
    return texts;
  }
  if (typeof value === "number") {
    texts.push(String(value));
    return texts;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, texts));
    return texts;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      texts.push(key);
      collectText(child, texts);
    });
  }
  return texts;
}

function collectUrls(text) {
  return Array.from(
    new Set(
      String(text)
        .match(/https?:\/\/[^\s"'<>\\]+/g)
        ?.map((url) => url.trim()) ?? [],
    ),
  );
}

function findCollectionName(object, breadcrumbs) {
  const directCandidates = [
    object.name,
    object.title,
    object.collection_name,
    object.collection,
    object.saved_collection_name,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  const direct = directCandidates.find((candidate) => isRecipeCollection(candidate));
  if (direct) return direct;

  const pathCandidate = breadcrumbs
    .filter((part) => /receita|recipe|food|comida|cozinha|culin/i.test(part))
    .at(-1);
  return pathCandidate ?? "";
}

function estimateTitle(object, collection, objectText) {
  const candidates = [
    object.caption,
    object.description,
    firstUsefulText(objectText, collection),
    object.title,
    object.name,
    object.media_owner,
    object.username,
    collection,
  ]
    .map((value) => (typeof value === "string" ? cleanTitle(value) : ""))
    .filter(Boolean)
    .filter((value) => !value.includes("instagram.com"))
    .filter((value) => !/^saved on$/i.test(value));

  return candidates[0] || "Receita salva do Instagram";
}

function firstUsefulText(text, collection) {
  const ignored = new Set(
    [
      "title",
      "name",
      "caption",
      "value",
      "href",
      "timestamp",
      "string_map_data",
      "saved on",
      "media",
      collection,
    ]
      .filter(Boolean)
      .map((item) => String(item).toLowerCase()),
  );
  return (
    String(text)
      .split(/\n+/)
      .map(cleanTitle)
      .find((line) => {
        const normalized = line.toLowerCase();
        return (
          line.length >= 8 &&
          !line.includes("instagram.com") &&
          !ignored.has(normalized) &&
          !/^\d+$/.test(line)
        );
      }) ?? ""
  );
}

function cleanTitle(value) {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/^https?:\/\/\S+/i, "")
    .trim()
    .slice(0, 120);
}

function estimateCategory(text) {
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return "Sem categoria";
}

function findImageUrl(text) {
  return (
    collectUrls(text).find((url) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)) ??
    collectUrls(text).find((url) => /cdninstagram|fbcdn/i.test(url)) ??
    ""
  );
}

function normalizeInstagramUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function dedupeItems(items) {
  const seen = new Set();
  const deduped = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    deduped.push(item);
  }
  return deduped;
}

function isRecipeCollection(value) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  return RECIPE_COLLECTION_TERMS.some((term) =>
    normalized.includes(
      term
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase(),
    ),
  );
}

function slugTag(value) {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

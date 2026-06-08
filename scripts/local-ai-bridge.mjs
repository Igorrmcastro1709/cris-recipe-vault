import http from "node:http";

const PORT = Number(process.env.AI_BRIDGE_PORT ?? 3877);
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "phi3:latest";
const MAX_TEXT_CHARS = 14000;

const SOURCE_LABELS = {
  instagram: "Instagram",
  link: "link/site",
  video: "video",
  pdf: "PDF",
  image: "imagem",
  text: "texto colado",
};

function sendJson(res, status, body) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Payload muito grande."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function absoluteUrl(value, baseUrl) {
  if (!value) return "";
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return "";
  }
}

function readMetaContent(html, property) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`,
      "i",
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return "";
}

function extractJsonLdRecipes(html, baseUrl) {
  const recipes = [];
  const matches = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values.flatMap(expandJsonLdGraph)) {
        const type = value?.["@type"];
        const types = Array.isArray(type) ? type : [type];
        if (!types.some((item) => String(item).toLowerCase() === "recipe")) continue;
        recipes.push({
          title: value.name ? String(value.name) : "",
          image: normalizeJsonLdImage(value.image, baseUrl),
          ingredients: normalizeJsonLdList(value.recipeIngredient),
          steps: normalizeJsonLdInstructions(value.recipeInstructions),
          time: String(value.totalTime ?? value.cookTime ?? value.prepTime ?? ""),
          servings: parseServings(value.recipeYield),
          category: String(value.recipeCategory ?? ""),
          notes: normalizeJsonLdList(value.description).join("\n"),
        });
      }
    } catch {
      // Ignore malformed JSON-LD and let text extraction continue.
    }
  }
  return recipes;
}

function expandJsonLdGraph(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(expandJsonLdGraph);
  if (value["@graph"]) return [value, ...expandJsonLdGraph(value["@graph"])];
  return [value];
}

function normalizeJsonLdImage(value, baseUrl) {
  const image = Array.isArray(value) ? value[0] : value;
  if (!image) return "";
  if (typeof image === "string") return absoluteUrl(image, baseUrl);
  if (typeof image === "object") return absoluteUrl(image.url ?? image.contentUrl, baseUrl);
  return "";
}

function normalizeJsonLdList(value) {
  if (!value) return [];
  if (Array.isArray(value))
    return value.map((item) => String(item?.text ?? item ?? "").trim()).filter(Boolean);
  return [String(value?.text ?? value).trim()].filter(Boolean);
}

function normalizeJsonLdInstructions(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (item?.itemListElement) return normalizeJsonLdInstructions(item.itemListElement);
        return String(item?.text ?? item?.name ?? item ?? "").trim();
      })
      .filter(Boolean);
  }
  return [String(value?.text ?? value).trim()].filter(Boolean);
}

function parseServings(value) {
  if (typeof value === "number") return value;
  const match = String(value ?? "").match(/\d+/);
  return match ? Number(match[0]) : null;
}

function extractHtmlContext(html, url) {
  const jsonLdRecipe = extractJsonLdRecipes(html, url)[0];
  const title =
    jsonLdRecipe?.title ||
    readMetaContent(html, "og:title") ||
    readMetaContent(html, "twitter:title") ||
    decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description =
    readMetaContent(html, "og:description") ||
    readMetaContent(html, "twitter:description") ||
    readMetaContent(html, "description") ||
    jsonLdRecipe?.notes ||
    "";
  const image =
    jsonLdRecipe?.image ||
    absoluteUrl(readMetaContent(html, "og:image"), url) ||
    absoluteUrl(readMetaContent(html, "twitter:image"), url);

  const structured = jsonLdRecipe
    ? [
        jsonLdRecipe.title && `Titulo estruturado: ${jsonLdRecipe.title}`,
        jsonLdRecipe.category && `Categoria estruturada: ${jsonLdRecipe.category}`,
        jsonLdRecipe.time && `Tempo estruturado: ${jsonLdRecipe.time}`,
        jsonLdRecipe.servings && `Porcoes estruturadas: ${jsonLdRecipe.servings}`,
        jsonLdRecipe.ingredients.length &&
          `Ingredientes estruturados:\n${jsonLdRecipe.ingredients.map((item) => `- ${item}`).join("\n")}`,
        jsonLdRecipe.steps.length &&
          `Passos estruturados:\n${jsonLdRecipe.steps.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    : "";

  return {
    title,
    description,
    image,
    text: [structured, description && `Descricao da pagina: ${description}`, stripHtml(html)]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, MAX_TEXT_CHARS),
  };
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeDifficulty(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("dif")) return "Difícil";
  if (text.includes("méd") || text.includes("med")) return "Médio";
  return "Fácil";
}

function normalizeConfidence(value) {
  const text = String(value ?? "").toLowerCase();
  if (["high", "medium", "low"].includes(text)) return text;
  if (text.includes("alt")) return "high";
  if (text.includes("baix")) return "low";
  return "medium";
}

function extractJson(text) {
  const trimmed = String(text ?? "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("A IA nao retornou JSON.");
    return JSON.parse(match[0]);
  }
}

function normalizeRecipe(parsed) {
  const warnings = normalizeArray(parsed.warnings);
  const ingredients = normalizeArray(parsed.ingredients);
  const steps = normalizeArray(parsed.steps);

  if (!ingredients.length) warnings.push("Ingredientes nao foram encontrados com seguranca.");
  if (!steps.length) warnings.push("Passo a passo nao foi encontrado com seguranca.");

  return {
    title: String(parsed.title ?? "").trim(),
    category: String(parsed.category ?? "Sem categoria").trim() || "Sem categoria",
    image: String(parsed.image ?? "").trim(),
    time: String(parsed.time ?? "").trim(),
    difficulty: normalizeDifficulty(parsed.difficulty),
    servings:
      typeof parsed.servings === "number" && Number.isFinite(parsed.servings)
        ? parsed.servings
        : null,
    tags: normalizeArray(parsed.tags),
    ingredients,
    steps,
    notes: String(parsed.notes ?? "").trim(),
    confidence: normalizeConfidence(parsed.confidence),
    warnings: Array.from(new Set(warnings)),
  };
}

async function fetchUrlContext(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "ReceitasDaCrisLocalBridge/1.0",
    },
  });
  if (!response.ok) throw new Error(`Nao consegui acessar a URL (HTTP ${response.status}).`);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (contentType.includes("html")) return extractHtmlContext(body, url);
  return {
    title: "",
    description: "",
    image: "",
    text: body.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS),
  };
}

function buildPrompt({ sourceType, sourceUrl, content, pageTitle, pageDescription, pageImage }) {
  return `Voce e um assistente de extracao de receitas para um app brasileiro chamado Receitas da Cris.
Extraia uma receita do conteudo abaixo e responda SOMENTE com JSON valido, sem markdown e sem comentarios.

Regras:
- Sempre responda em portugues do Brasil, mesmo quando a pagina estiver em ingles ou outro idioma.
- Traduza ingredientes, passos, tags e notas para portugues do Brasil.
- Se algum campo estiver incerto, use string vazia, array vazio ou null.
- Nao invente ingredientes nem passos quando nao estiverem no texto.
- Use categorias curtas como Doces, Paes, Saladas, Massas, Sopas, Carnes, Frango, Peixes, Vegetariano ou Bebidas.
- "difficulty" deve ser exatamente "Fácil", "Médio" ou "Difícil".
- "confidence" deve ser "high", "medium" ou "low".
- Use "warnings" para avisos de revisao, principalmente quando o conteudo vier incompleto.
- Use "notes" para resumo de preparo, dicas importantes, adaptacoes e observacoes traduzidas. Nao repita a lista completa de ingredientes em notes.
- Se houver uma imagem de pagina confiavel abaixo, use-a em "image" quando a receita nao trouxer imagem melhor.

Schema:
{
  "title": "string",
  "category": "string",
  "image": "string",
  "time": "string",
  "difficulty": "Fácil | Médio | Difícil",
  "servings": 4,
  "tags": ["string"],
  "ingredients": ["string"],
  "steps": ["string"],
  "notes": "string",
  "confidence": "high | medium | low",
  "warnings": ["string"]
}

Fonte: ${SOURCE_LABELS[sourceType] ?? sourceType}
URL: ${sourceUrl || "nao informada"}
Titulo da pagina: ${pageTitle || "nao informado"}
Descricao da pagina: ${pageDescription || "nao informada"}
Imagem sugerida da pagina: ${pageImage || "nao informada"}

Conteudo:
${content.slice(0, MAX_TEXT_CHARS)}`;
}

async function callOllama(prompt) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.1 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama respondeu HTTP ${response.status}.`);
  const data = await response.json();
  return data.response ?? "";
}

async function handleExtract(req, res) {
  const body = await readBody(req);
  const payload = JSON.parse(body || "{}");
  const sourceType = String(payload.sourceType ?? "text");
  const sourceUrl = String(payload.sourceUrl ?? "").trim();
  let content = String(payload.rawText ?? "").trim();
  let pageTitle = "";
  let pageDescription = "";
  let pageImage = "";
  const warnings = [];

  if (!content && sourceUrl) {
    if (sourceType === "instagram") {
      sendJson(res, 422, {
        error:
          "Para Instagram nesta primeira versao, cole tambem a legenda ou transcricao da receita.",
      });
      return;
    }
    try {
      const page = await fetchUrlContext(sourceUrl);
      content = page.text;
      pageTitle = page.title;
      pageDescription = page.description;
      pageImage = page.image;
    } catch (error) {
      sendJson(res, 422, {
        error:
          error instanceof Error
            ? `${error.message} Cole o texto da receita para usar como fallback.`
            : "Nao consegui ler a URL. Cole o texto da receita para usar como fallback.",
      });
      return;
    }
  }

  if (!content) {
    sendJson(res, 422, { error: "Cole uma URL acessivel ou o texto da receita." });
    return;
  }

  const prompt = buildPrompt({
    sourceType,
    sourceUrl,
    content,
    pageTitle,
    pageDescription,
    pageImage,
  });
  const raw = await callOllama(prompt);
  const recipe = normalizeRecipe(extractJson(raw));
  if (!recipe.image && pageImage) recipe.image = pageImage;
  if (!recipe.title && pageTitle) recipe.title = pageTitle;

  if (sourceType === "instagram") {
    warnings.push(
      "Instagram foi tratado como link + texto colado. Revise se a legenda/transcricao esta completa.",
    );
  }

  sendJson(res, 200, {
    ...recipe,
    warnings: Array.from(new Set([...recipe.warnings, ...warnings])),
  });
}

async function ollamaReachable() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, {
        ok: true,
        model: MODEL,
        ollamaBaseUrl: OLLAMA_BASE_URL,
        ollamaReachable: await ollamaReachable(),
      });
      return;
    }
    if (req.method === "POST" && req.url === "/extract-recipe") {
      await handleExtract(req, res);
      return;
    }
    sendJson(res, 404, { error: "Endpoint nao encontrado." });
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Erro inesperado na ponte local de IA.",
    });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Local AI Bridge rodando em http://127.0.0.1:${PORT}`);
  console.log(`Modelo Ollama: ${MODEL}`);
});

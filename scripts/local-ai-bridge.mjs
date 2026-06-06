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

async function fetchUrlText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "ReceitasDaCrisLocalBridge/1.0",
    },
  });
  if (!response.ok) throw new Error(`Nao consegui acessar a URL (HTTP ${response.status}).`);
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  if (contentType.includes("html")) return stripHtml(body).slice(0, MAX_TEXT_CHARS);
  return body.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}

function buildPrompt({ sourceType, sourceUrl, content }) {
  return `Voce e um assistente de extracao de receitas para um app brasileiro chamado Receitas da Cris.
Extraia uma receita do conteudo abaixo e responda SOMENTE com JSON valido, sem markdown e sem comentarios.

Regras:
- Se algum campo estiver incerto, use string vazia, array vazio ou null.
- Nao invente ingredientes nem passos quando nao estiverem no texto.
- Use categorias curtas como Doces, Paes, Saladas, Massas, Sopas, Carnes, Frango, Peixes, Vegetariano ou Bebidas.
- "difficulty" deve ser exatamente "Fácil", "Médio" ou "Difícil".
- "confidence" deve ser "high", "medium" ou "low".
- Use "warnings" para avisos de revisao, principalmente quando o conteudo vier incompleto.

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
      content = await fetchUrlText(sourceUrl);
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

  const prompt = buildPrompt({ sourceType, sourceUrl, content });
  const raw = await callOllama(prompt);
  const recipe = normalizeRecipe(extractJson(raw));

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

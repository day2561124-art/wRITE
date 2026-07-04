import http from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberFrom(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integerFrom(value, fallback) {
  const parsed = numberFrom(value, fallback);
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function normalizeEndpoint(value) {
  const endpoint = text(value);
  if (!endpoint) return null;
  return endpoint;
}

export function resolveLocalGenerationProviderConfig(env = process.env, overrides = {}) {
  const endpoint = normalizeEndpoint(
    overrides.upstreamEndpoint
      ?? env.WRITER_LOCAL_GENERATION_UPSTREAM_ENDPOINT
  );

  return {
    host: text(overrides.host) ?? text(env.WRITER_LOCAL_GENERATION_HOST) ?? "127.0.0.1",
    port: integerFrom(overrides.port ?? env.WRITER_LOCAL_GENERATION_PORT, 8799),
    path: text(overrides.path) ?? text(env.WRITER_LOCAL_GENERATION_PATH) ?? "/writer",
    upstreamEndpoint: endpoint,
    apiKey: text(overrides.apiKey) ?? text(env.WRITER_LOCAL_GENERATION_API_KEY) ?? text(env.OPENAI_API_KEY),
    model: text(overrides.model) ?? text(env.WRITER_LOCAL_GENERATION_MODEL) ?? text(env.OPENAI_MODEL) ?? "local-generation-model",
    providerId: text(overrides.providerId) ?? text(env.WRITER_LOCAL_GENERATION_PROVIDER_ID) ?? "local-generation-provider",
    modelVersion: text(overrides.modelVersion) ?? text(env.WRITER_LOCAL_GENERATION_MODEL_VERSION) ?? "openai-compatible-1",
    timeoutMs: integerFrom(overrides.timeoutMs ?? env.WRITER_LOCAL_GENERATION_TIMEOUT_MS, 120000),
    maxTokens: integerFrom(overrides.maxTokens ?? env.WRITER_LOCAL_GENERATION_MAX_TOKENS, 4096),
    temperature: numberFrom(overrides.temperature ?? env.WRITER_LOCAL_GENERATION_TEMPERATURE, 0.7),
    promptMaxChars: integerFrom(overrides.promptMaxChars ?? env.WRITER_LOCAL_GENERATION_PROMPT_MAX_CHARS, 120000)
  };
}

function clipText(value, maxChars) {
  const str = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (str.length <= maxChars) return str;
  return `${str.slice(0, maxChars)}\n\n[TRUNCATED ${str.length - maxChars} chars]`;
}

function asJsonBlock(label, value, maxChars) {
  if (value === undefined || value === null) return `${label}: null`;
  return `${label}:\n${clipText(value, maxChars)}`;
}

export function buildOpenAICompatibleMessages(writerRequest, config) {
  const requestType = text(writerRequest?.request_type) ?? text(writerRequest?.requestType) ?? "generation";
  const maxChars = config.promptMaxChars;

  const system = [
    "You are the backend generation provider for Writer Workbench.",
    "Return only the requested final prose text.",
    "Do not return JSON.",
    "Do not wrap the answer in markdown fences.",
    "Do not explain the pipeline.",
    "Preserve the user's requested language and style constraints.",
    "If the request is revision, revise the supplied draft instead of starting over."
  ].join("\n");

  const user = [
    `request_type: ${requestType}`,
    "",
    asJsonBlock("task_prompt", writerRequest?.task_prompt ?? writerRequest?.taskPrompt ?? "", maxChars),
    "",
    asJsonBlock("generation_context", writerRequest?.generation_context ?? writerRequest?.generationContext ?? {}, maxChars),
    "",
    asJsonBlock("retrieval_context", writerRequest?.retrieval_context ?? writerRequest?.retrievalContext ?? {}, maxChars),
    "",
    asJsonBlock("draft_text", writerRequest?.draft_text ?? writerRequest?.draftText ?? writerRequest?.current_text ?? writerRequest?.currentText ?? "", maxChars),
    "",
    asJsonBlock("revision_instruction", writerRequest?.revision_instruction ?? writerRequest?.revisionInstruction ?? "", maxChars)
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

function extractContentPart(content) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part.text === "string") return part.text;
        if (part && typeof part.content === "string") return part.content;
        return "";
      })
      .join("");
  }

  return "";
}

export function extractOpenAICompatibleText(payload) {
  const direct = text(payload?.text) ?? text(payload?.output_text);
  if (direct) return direct;

  const choice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  const messageText = extractContentPart(choice?.message?.content);
  if (text(messageText)) return messageText.trim();

  const legacyText = text(choice?.text);
  if (legacyText) return legacyText;

  return "";
}

async function readJsonRequest(req, maxBytes = 16 * 1024 * 1024) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw, "utf8") > maxBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      error.code = "request_too_large";
      throw error;
    }
  }

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    error.code = "invalid_json";
    throw error;
  }
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function callOpenAICompatibleEndpoint(writerRequest, config) {
  if (!config.upstreamEndpoint) {
    const error = new Error("WRITER_LOCAL_GENERATION_UPSTREAM_ENDPOINT is required.");
    error.statusCode = 500;
    error.code = "upstream_endpoint_required";
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  const payload = {
    model: config.model,
    messages: buildOpenAICompatibleMessages(writerRequest, config),
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    stream: false
  };

  const headers = {
    "content-type": "application/json"
  };

  if (config.apiKey) {
    headers.authorization = `Bearer ${config.apiKey}`;
  }

  let response;
  try {
    response = await fetch(config.upstreamEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    const wrapped = new Error(error?.name === "AbortError"
      ? "OpenAI-compatible upstream request timed out."
      : `OpenAI-compatible upstream request failed: ${error?.message ?? error}`);
    wrapped.statusCode = 502;
    wrapped.code = error?.name === "AbortError" ? "upstream_timeout" : "upstream_request_failed";
    throw wrapped;
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  let parsed = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    const error = new Error("OpenAI-compatible upstream returned invalid JSON.");
    error.statusCode = 502;
    error.code = "upstream_invalid_json";
    error.upstreamStatus = response.status;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(`OpenAI-compatible upstream returned HTTP ${response.status}.`);
    error.statusCode = 502;
    error.code = "upstream_http_error";
    error.upstreamStatus = response.status;
    error.upstreamError = parsed?.error ?? parsed;
    throw error;
  }

  const outputText = extractOpenAICompatibleText(parsed);
  if (!text(outputText)) {
    const error = new Error("OpenAI-compatible upstream returned no text.");
    error.statusCode = 502;
    error.code = "upstream_empty_text";
    throw error;
  }

  return {
    text: outputText.trim(),
    model_name: parsed?.model ?? config.model,
    model_version: config.modelVersion,
    provider_trace_id: `local-generation-${randomUUID()}`,
    warnings: [],
    usage: parsed?.usage ?? {}
  };
}

export async function handleWriterProviderRequest(writerRequest, config) {
  return callOpenAICompatibleEndpoint(writerRequest, config);
}

export function createLocalGenerationProviderServer(inputConfig = {}) {
  const config = resolveLocalGenerationProviderConfig(process.env, inputConfig);

  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    if (req.method !== "POST" || url.pathname !== config.path) {
      sendJson(res, 404, {
        error: "not_found",
        message: `Use POST ${config.path}.`
      });
      return;
    }

    try {
      const writerRequest = await readJsonRequest(req);
      const result = await handleWriterProviderRequest(writerRequest, config);
      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, error?.statusCode ?? 500, {
        error: error?.code ?? "local_generation_provider_error",
        message: error?.message ?? String(error),
        upstream_status: error?.upstreamStatus ?? undefined,
        upstream_error: error?.upstreamError ?? undefined
      });
    }
  });
}

export async function startLocalGenerationProvider(env = process.env) {
  const config = resolveLocalGenerationProviderConfig(env);

  if (!config.upstreamEndpoint) {
    throw new Error("WRITER_LOCAL_GENERATION_UPSTREAM_ENDPOINT is required.");
  }

  const server = createLocalGenerationProviderServer(config);

  await new Promise((resolve) => {
    server.listen(config.port, config.host, resolve);
  });

  console.log(`local generation provider listening on http://${config.host}:${config.port}${config.path}`);
  console.log(`upstream endpoint: ${config.upstreamEndpoint}`);
  console.log(`model: ${config.model}`);

  return server;
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  startLocalGenerationProvider().catch((error) => {
    console.error(`[local-generation-provider] ${error?.message ?? error}`);
    process.exit(1);
  });
}

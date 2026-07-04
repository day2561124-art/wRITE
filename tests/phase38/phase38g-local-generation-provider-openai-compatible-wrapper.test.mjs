import assert from "node:assert/strict";
import http from "node:http";
import {
  buildOpenAICompatibleMessages,
  createLocalGenerationProviderServer,
  extractOpenAICompatibleText
} from "../../server/src/local-generation-provider.mjs";

async function listen(server, host = "127.0.0.1") {
  await new Promise((resolve) => server.listen(0, host, resolve));
  return server.address().port;
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  const payload = await response.json();
  return { status: response.status, payload };
}

const messages = buildOpenAICompatibleMessages({
  request_type: "generation",
  task_prompt: "Phase38G message build smoke.",
  generation_context: { chapter_mode: "next_chapter" },
  retrieval_context: { active_engine_excerpt: "fixture" }
}, {
  promptMaxChars: 120000
});

assert.equal(messages.length, 2);
assert.equal(messages[0].role, "system");
assert.equal(messages[1].role, "user");
assert(messages[1].content.includes("Phase38G message build smoke."));
assert(messages[1].content.includes("active_engine_excerpt"));

assert.equal(extractOpenAICompatibleText({
  choices: [{ message: { content: "hello" } }]
}), "hello");

assert.equal(extractOpenAICompatibleText({
  choices: [{ message: { content: [{ type: "text", text: "he" }, { type: "text", text: "llo" }] } }]
}), "hello");

const upstreamRequests = [];

const upstream = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  const body = await readJson(req);
  upstreamRequests.push({
    url: req.url,
    authorization: req.headers.authorization ?? "",
    body
  });

  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({
    id: "phase38g-upstream-response",
    model: body.model,
    choices: [
      {
        message: {
          role: "assistant",
          content: "第零正式章　local generation provider wrapper 測試\n\n這段文字來自 OpenAI-compatible mock upstream。"
        }
      }
    ],
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    }
  }));
});

const upstreamPort = await listen(upstream);
const provider = createLocalGenerationProviderServer({
  upstreamEndpoint: `http://127.0.0.1:${upstreamPort}/v1/chat/completions`,
  apiKey: "phase38g-test-token",
  model: "phase38g-openai-compatible-model",
  providerId: "phase38g-local-generation-provider",
  modelVersion: "phase38g-test",
  timeoutMs: 5000,
  maxTokens: 2048,
  temperature: 0.2
});

const providerPort = await listen(provider);

try {
  const result = await postJson(`http://127.0.0.1:${providerPort}/writer`, {
    request_type: "generation",
    task_prompt: "Phase38G local generation provider wrapper E2E.",
    generation_context: {
      chapter_mode: "next_chapter",
      phase: "38G"
    },
    retrieval_context: {
      active_engine_excerpt: "Phase38G fixture.",
      registered_project_sources: ["active_engine", "writing_card", "longline"]
    }
  });

  assert.equal(result.status, 200);
  assert(result.payload.text.includes("local generation provider wrapper 測試"));
  assert.equal(result.payload.model_name, "phase38g-openai-compatible-model");
  assert.equal(result.payload.model_version, "phase38g-test");
  assert(result.payload.provider_trace_id.startsWith("local-generation-"));
  assert.deepEqual(result.payload.usage, {
    prompt_tokens: 10,
    completion_tokens: 20,
    total_tokens: 30
  });

  assert.equal(upstreamRequests.length, 1);
  assert.equal(upstreamRequests[0].url, "/v1/chat/completions");
  assert.equal(upstreamRequests[0].authorization, "Bearer phase38g-test-token");
  assert.equal(upstreamRequests[0].body.model, "phase38g-openai-compatible-model");
  assert.equal(upstreamRequests[0].body.stream, false);
  assert.equal(upstreamRequests[0].body.max_tokens, 2048);
  assert.equal(upstreamRequests[0].body.temperature, 0.2);
  assert(upstreamRequests[0].body.messages[1].content.includes("Phase38G local generation provider wrapper E2E."));

  const notFound = await postJson(`http://127.0.0.1:${providerPort}/wrong`, {});
  assert.equal(notFound.status, 404);
  assert.equal(notFound.payload.error, "not_found");
} finally {
  await close(provider);
  await close(upstream);
}

console.log("Phase38G local generation provider OpenAI-compatible wrapper tests passed.");

const providerSecrets = new WeakMap();

const PROVIDER_TYPES = new Set([
  "disabled",
  "deterministic_test",
  "local_http",
  "remote_http",
]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function timeout(value, fallback = 60_000) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 100 && parsed <= 600_000
    ? parsed
    : fallback;
}

function providerError(status, message, details = {}) {
  const error = new Error(message);
  error.name = "BackendGenerationProviderError";
  error.status = status;
  error.provider_status = status;
  Object.assign(error, details);
  return error;
}

function deterministicText(requestType) {
  if (requestType === "revision") {
    return [
      "走廊的警示燈閃了兩次，千夜把受傷的手藏到背後，仍按下終端。",
      "九逃將止痛貼推到桌角。「先處理傷口，再決定要不要追。」",
      "螢幕跳出新的候場通知：順序提前，她們只剩十分鐘。",
      "千夜抓起外套，門外同時響起第二次集合鈴。",
    ].join("\n\n");
  }
  return [
    "走廊的燈閃了兩次，千夜停在門前，把受傷的手藏到背後。",
    "九逃沒有追問，只把止痛貼放在桌角。「妳自己選。現在回去，或跟我去看終端。」",
    "千夜按下螢幕。新的通知跳出來：候場順序提前，她們只剩十分鐘。",
    "她抓起外套，門外已響起第二次集合鈴。",
  ].join("\n\n");
}

export function resolveBackendGenerationProvider(input = {}, options = {}) {
  const env = object(options.env ?? process.env);
  const supplied = object(options.provider);
  const requestedType = text(
    supplied.provider_type
      ?? input.provider_type
      ?? input.providerType
      ?? env.WRITER_BACKEND_GENERATION_PROVIDER,
  ).toLowerCase() || "disabled";
  const providerType = PROVIDER_TYPES.has(requestedType) ? requestedType : "disabled";
  const source = Object.keys(supplied).length
    ? (options.providerSource ?? "options")
    : (text(input.provider_type ?? input.providerType) ? "options"
      : (text(env.WRITER_BACKEND_GENERATION_PROVIDER) ? "env" : "none"));
  const endpointUrl = text(
    supplied.endpoint_url
      ?? options.endpointUrl
      ?? env.WRITER_BACKEND_GENERATION_ENDPOINT,
  );
  const tokenEnvName = text(
    supplied.token_env_name
      ?? options.tokenEnvName
      ?? env.WRITER_BACKEND_GENERATION_TOKEN_ENV,
  );
  const tokenValue = tokenEnvName ? text(env[tokenEnvName]) : "";
  const requiresSecret = supplied.requires_secret === true
    || options.requiresSecret === true
    || providerType === "remote_http";
  const warnings = [];
  let status = "generation_provider_required";
  let available = false;

  if (requestedType && !PROVIDER_TYPES.has(requestedType)) {
    warnings.push("backend_generation_provider_type_invalid");
  } else if (providerType === "deterministic_test") {
    const allowed = env.NODE_ENV === "test"
      || options.allowDeterministicTestProvider === true;
    available = allowed;
    status = allowed ? "available" : "generation_provider_required";
    if (!allowed) warnings.push("deterministic_test_provider_not_allowed");
  } else if (providerType === "local_http" || providerType === "remote_http") {
    if (!endpointUrl) {
      warnings.push("backend_generation_endpoint_missing");
    } else if (requiresSecret && !tokenValue) {
      status = "generation_provider_secret_missing";
      warnings.push(tokenEnvName
        ? "backend_generation_secret_missing"
        : "backend_generation_token_env_missing");
    } else {
      available = true;
      status = "available";
    }
  } else if (providerType === "disabled") {
    warnings.push("backend_generation_provider_disabled");
  }

  const provider = {
    available,
    provider_id: text(
      supplied.provider_id
        ?? input.provider_id
        ?? input.providerId
        ?? env.WRITER_BACKEND_GENERATION_PROVIDER_ID,
    ) || providerType,
    provider_type: providerType,
    source,
    generation_available: available,
    revision_available: available,
    requires_secret: requiresSecret,
    endpoint_url_present: Boolean(endpointUrl),
    token_env_name: tokenEnvName || null,
    token_present: Boolean(tokenValue),
    model_name: text(
      supplied.model_name
        ?? input.model_name
        ?? input.modelName
        ?? env.WRITER_BACKEND_GENERATION_MODEL,
    ) || null,
    model_version: text(
      supplied.model_version
        ?? input.model_version
        ?? input.modelVersion
        ?? env.WRITER_BACKEND_GENERATION_VERSION,
    ) || null,
    timeout_ms: timeout(
      supplied.timeout_ms
        ?? options.timeoutMs
        ?? env.WRITER_BACKEND_GENERATION_TIMEOUT_MS,
    ),
    status,
    warnings,
  };
  providerSecrets.set(provider, { endpointUrl, tokenValue });
  return provider;
}

export async function callBackendGenerationProvider(provider, request, options = {}) {
  if (!provider?.available) {
    throw providerError(
      provider?.status ?? "generation_provider_required",
      "Backend generation provider is unavailable.",
    );
  }
  const requestType = request?.request_type === "revision" ? "revision" : "generation";
  if (provider.provider_type === "deterministic_test") {
    return {
      text: deterministicText(requestType),
      model_name: provider.model_name ?? "deterministic-test",
      model_version: provider.model_version ?? "1",
      warnings: [],
      usage: {},
      provider_trace_id: `deterministic-${requestType}-trace`,
      provider_type: provider.provider_type,
      provider_id: provider.provider_id,
    };
  }

  const secret = providerSecrets.get(provider) ?? {};
  const endpointUrl = text(options.endpointUrl ?? secret.endpointUrl);
  const tokenValue = text(options.token ?? secret.tokenValue);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), provider.timeout_ms);
  let response;
  try {
    response = await (options.fetch ?? globalThis.fetch)(endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(tokenValue ? { authorization: `Bearer ${tokenValue}` } : {}),
        "x-writer-provider-id": provider.provider_id,
        "x-writer-request-type": requestType,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw providerError("provider_timeout", "Backend generation provider timed out.");
    }
    throw providerError("provider_http_error", "Backend generation provider request failed.", {
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw providerError("provider_http_error", `Backend generation provider returned HTTP ${response.status}.`, {
      http_status: response.status,
    });
  }
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    throw providerError("provider_invalid_response", "Backend generation provider returned invalid JSON.", {
      cause: error,
    });
  }
  const normalized = object(payload);
  const outputText = text(normalized.text ?? normalized.output_text);
  if (!outputText) {
    throw providerError("provider_empty_text", "Backend generation provider returned no text.");
  }
  return {
    text: outputText,
    model_name: text(normalized.model_name) || provider.model_name,
    model_version: text(normalized.model_version) || provider.model_version,
    warnings: Array.isArray(normalized.warnings) ? normalized.warnings : [],
    usage: object(normalized.usage),
    provider_trace_id: text(normalized.provider_trace_id) || null,
    provider_type: provider.provider_type,
    provider_id: provider.provider_id,
  };
}

function buildRequest(requestType, payload = {}) {
  return {
    request_type: requestType,
    task_prompt: text(payload.task_prompt),
    generation_context: object(payload.generation_context),
    retrieval_context: object(payload.retrieval_context),
    writing_context: object(payload.writing_context),
    neural_pre_generation_report: object(payload.neural_pre_generation_report),
    critique: object(payload.critique),
    revision_plan: object(payload.revision_plan),
    previous_draft_text: text(payload.previous_draft_text ?? payload.draft_text),
    max_chars: Number.isInteger(payload.max_chars) ? payload.max_chars : null,
    output_language: text(payload.output_language) || "zh-TW",
    style_contract: object(payload.style_contract),
    safety_contract: {
      candidate_only: true,
      no_canon_update: true,
      no_active_engine_update: true,
      no_adoption: true,
    },
  };
}

export function buildGenerationAdapterFromProvider(provider, options = {}) {
  return async function backendGenerationProviderAdapter(payload = {}) {
    return callBackendGenerationProvider(
      provider,
      buildRequest("generation", payload),
      options,
    );
  };
}

export function buildRevisionAdapterFromProvider(provider, options = {}) {
  return async function backendRevisionProviderAdapter(payload = {}) {
    return callBackendGenerationProvider(
      provider,
      buildRequest("revision", payload),
      options,
    );
  };
}

import { createHash } from "node:crypto";

const contentKeyPattern =
  /(?:content|summary|text|excerpt|context|prompt|material|event|state|relationship|pending|consequence|entry|rule|result)/iu;

export function normalizeContextBlockText(value) {
  return String(value ?? "")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

export function normalizedContextBlockHash(value) {
  return createHash("sha256")
    .update(normalizeContextBlockText(value))
    .digest("hex");
}

export function splitContextTextBlocks(value) {
  const normalized = normalizeContextBlockText(value);
  if (!normalized) return [];
  return normalized
    .split(/\n[ \t]*\n+/gu)
    .map(normalizeContextBlockText)
    .filter(Boolean);
}

function shouldDeduplicateString(path, value) {
  const normalized = normalizeContextBlockText(value);
  if (!normalized) return false;
  const key = path.at(-1) ?? "";
  return normalized.includes("\n")
    || normalized.length >= 80
    || contentKeyPattern.test(key);
}

function cloneAndComposeStrings(value, source, state, path = []) {
  if (typeof value === "string") {
    if (!shouldDeduplicateString(path, value)) {
      const normalized = normalizeContextBlockText(value);
      state.totalBefore += normalized.length;
      state.totalAfter += normalized.length;
      return value;
    }
    const retained = [];
    for (const [index, block] of splitContextTextBlocks(value).entries()) {
      const normalizedHash = normalizedContextBlockHash(block);
      const blockSource = `${source}.${path.join(".") || "text"}#${index}`;
      state.totalBefore += block.length;
      const duplicateOf = state.seen.get(normalizedHash);
      if (duplicateOf) {
        state.duplicateChars += block.length;
        state.duplicates.push({
          source: blockSource,
          normalized_hash: normalizedHash,
          duplicate_of: duplicateOf,
          dropped_character_count: block.length,
        });
        continue;
      }
      state.seen.set(normalizedHash, blockSource);
      retained.push(block);
      state.totalAfter += block.length;
    }
    return retained.join("\n\n");
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => (
      cloneAndComposeStrings(item, source, state, [...path, String(index)])
    ));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneAndComposeStrings(item, source, state, [...path, key]),
      ]),
    );
  }
  return value;
}

export function composeWritingContextSources({
  taskPrompt = "",
  taskPromptSource = "explicit_task_prompt",
  continuityOverlay = "",
  generationContext = {},
  retrievalContext = {},
} = {}) {
  const state = {
    seen: new Map(),
    totalBefore: 0,
    totalAfter: 0,
    duplicateChars: 0,
    duplicates: [],
  };
  let composedTaskPrompt;
  let composedContinuityOverlay;
  let composedGenerationContext;
  let composedRetrievalContext;
  const composeTask = () => {
    composedTaskPrompt = cloneAndComposeStrings(
      String(taskPrompt ?? ""),
      taskPromptSource === "old_generated_inputs"
        ? "old_generated_inputs.task_prompt"
        : "task_prompt",
      state,
    );
  };
  const composeContinuity = () => {
    composedContinuityOverlay = cloneAndComposeStrings(
      String(continuityOverlay ?? ""),
      "latest_continuity_overlay",
      state,
      ["summary_text"],
    );
  };
  const composeGeneration = () => {
    composedGenerationContext = cloneAndComposeStrings(
      generationContext,
      "generation_context",
      state,
    );
  };
  const composeRetrieval = () => {
    composedRetrievalContext = cloneAndComposeStrings(
      retrievalContext,
      "retrieval_context",
      state,
    );
  };

  if (taskPromptSource === "old_generated_inputs") {
    composeContinuity();
    composeGeneration();
    composeRetrieval();
    composeTask();
  } else {
    composeTask();
    composeContinuity();
    composeGeneration();
    composeRetrieval();
  }

  return {
    task_prompt: composedTaskPrompt,
    continuity_overlay: composedContinuityOverlay,
    generation_context: composedGenerationContext,
    retrieval_context: composedRetrievalContext,
    metadata: {
      total_chars_before_dedup: state.totalBefore,
      total_chars_after_dedup: state.totalAfter,
      duplicate_chars_removed: state.duplicateChars,
      duplicate_sources: state.duplicates,
    },
  };
}

export function truncateContextTextAtBlockBoundaries(
  value,
  maxChars,
  source = "text",
) {
  const normalized = normalizeContextBlockText(value);
  const originalChars = normalized.length;
  if (originalChars <= maxChars) {
    return {
      text: normalized,
      truncated: false,
      source,
      original_chars: originalChars,
      actual_chars: originalChars,
      budget_chars: maxChars,
    };
  }

  const retained = [];
  let actualChars = 0;
  for (const block of splitContextTextBlocks(normalized)) {
    const separatorChars = retained.length > 0 ? 2 : 0;
    if (actualChars + separatorChars + block.length > maxChars) break;
    retained.push(block);
    actualChars += separatorChars + block.length;
  }
  const text = retained.join("\n\n");
  return {
    text,
    truncated: true,
    source,
    original_chars: originalChars,
    actual_chars: text.length,
    budget_chars: maxChars,
  };
}

function serialized(value) {
  return JSON.stringify(value, null, 2);
}

function prioritizedEntries(value) {
  return Object.entries(value).sort(([left], [right]) => {
    const leftContent = contentKeyPattern.test(left) ? 0 : 1;
    const rightContent = contentKeyPattern.test(right) ? 0 : 1;
    return leftContent - rightContent;
  });
}

function truncateStructuredValue(value, maxChars, source, path, truncatedPaths) {
  if (serialized(value).length <= maxChars) return value;
  const publicPath = [source, ...path].join(".");
  truncatedPaths.add(publicPath);

  if (typeof value === "string") {
    return truncateContextTextAtBlockBoundaries(
      value,
      Math.max(0, maxChars - 2),
      publicPath,
    ).text;
  }
  if (Array.isArray(value)) {
    const output = [];
    for (let index = 0; index < value.length; index += 1) {
      const candidate = [...output, value[index]];
      if (serialized(candidate).length <= maxChars) {
        output.push(value[index]);
        continue;
      }
      const remaining = Math.max(0, maxChars - serialized(output).length - 4);
      if (remaining > 2) {
        const partial = truncateStructuredValue(
          value[index],
          remaining,
          source,
          [...path, String(index)],
          truncatedPaths,
        );
        const partialCandidate = [...output, partial];
        if (serialized(partialCandidate).length <= maxChars) output.push(partial);
      }
      break;
    }
    return output;
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of prioritizedEntries(value)) {
      const candidate = { ...output, [key]: item };
      if (serialized(candidate).length <= maxChars) {
        output[key] = item;
        continue;
      }
      const remaining = Math.max(0, maxChars - serialized(output).length - key.length - 8);
      if (remaining > 2) {
        const partial = truncateStructuredValue(
          item,
          remaining,
          source,
          [...path, key],
          truncatedPaths,
        );
        const partialCandidate = { ...output, [key]: partial };
        if (serialized(partialCandidate).length <= maxChars) output[key] = partial;
      }
    }
    return output;
  }
  return null;
}

export function truncateStructuredContextAtBoundaries(
  value,
  maxChars,
  source = "context",
) {
  const originalText = serialized(value);
  if (maxChars < 2) {
    return {
      value: {},
      text: "",
      truncated: originalText.length > 0,
      source,
      original_chars: originalText.length,
      actual_chars: 0,
      budget_chars: maxChars,
      truncated_paths: [source],
    };
  }
  if (originalText.length <= maxChars) {
    return {
      value,
      text: originalText,
      truncated: false,
      source,
      original_chars: originalText.length,
      actual_chars: originalText.length,
      budget_chars: maxChars,
      truncated_paths: [],
    };
  }

  const truncatedPaths = new Set();
  const boundedValue = truncateStructuredValue(
    value,
    Math.max(2, maxChars),
    source,
    [],
    truncatedPaths,
  );
  const boundedText = serialized(boundedValue);
  return {
    value: boundedValue,
    text: boundedText,
    truncated: true,
    source,
    original_chars: originalText.length,
    actual_chars: boundedText.length,
    budget_chars: maxChars,
    truncated_paths: [...truncatedPaths],
  };
}

export function countActiveEngineRetrievalChars(value, inherited = false) {
  if (typeof value === "string") {
    return inherited ? normalizeContextBlockText(value).length : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce(
      (total, item) => total + countActiveEngineRetrievalChars(item, inherited),
      0,
    );
  }
  if (!value || typeof value !== "object") return 0;

  const sourceMarker = [
    value.source,
    value.source_path,
    value.path,
    value.reference,
    value.source_file,
  ].filter(Boolean).join(" ");
  const active = inherited || /active_engine(?:\.md)?/iu.test(sourceMarker);
  return Object.values(value).reduce(
    (total, item) => total + countActiveEngineRetrievalChars(item, active),
    0,
  );
}

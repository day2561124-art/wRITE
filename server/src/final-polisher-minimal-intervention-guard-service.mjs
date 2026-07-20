import { createHash } from "node:crypto";

export const finalPolisherMinimalInterventionGuardVersion =
  "phase50d-final-polisher-minimal-intervention-v1";

const prosePayloadKeys = new Set([
  "polishedtext",
  "revisedtext",
  "rewrittentext",
  "revisiontext",
  "replacementtext",
  "finaltext",
  "finalprose",
  "storytext",
  "rawstorytext",
  "storybody",
  "outputtext",
  "candidatetext",
  "finalcandidatetext",
  "revisedstorytext",
  "suggestedtext",
  "proposedtext",
  "correctedtext",
  "newtext",
  "revisedline",
  "replacement",
  "rewrite",
]);

function isProsePayloadKey(key) {
  const normalized = String(key ?? "")
    .replace(/[^a-z0-9]/giu, "")
    .toLowerCase();
  return prosePayloadKeys.has(normalized);
}


function sha256(value) {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex");
}

function isObject(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value);
}

function collectProsePayloads(value, path = [], seen = new WeakSet()) {
  if (!value || typeof value !== "object") return [];
  if (seen.has(value)) return [];
  seen.add(value);

  const output = [];
  for (const [key, item] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (isProsePayloadKey(key) && typeof item === "string") {
      output.push({
        path: nextPath.join("."),
        key,
        text: item,
      });
      continue;
    }
    if (Array.isArray(item)) {
      for (let index = 0; index < item.length; index += 1) {
        output.push(...collectProsePayloads(
          item[index],
          [...nextPath, String(index)],
          seen,
        ));
      }
      continue;
    }
    if (isObject(item)) {
      output.push(...collectProsePayloads(item, nextPath, seen));
    }
  }
  return output;
}

function stripProsePayloads(value, seen = new WeakMap()) {
  if (Array.isArray(value)) {
    return value.map((item) => stripProsePayloads(item, seen));
  }
  if (!isObject(value)) return value;
  if (seen.has(value)) return seen.get(value);

  const output = {};
  seen.set(value, output);
  for (const [key, item] of Object.entries(value)) {
    if (isProsePayloadKey(key) && typeof item === "string") continue;
    output[key] = stripProsePayloads(item, seen);
  }
  return output;
}

function changedWindow(originalText, candidateText) {
  const original = [...String(originalText ?? "")];
  const candidate = [...String(candidateText ?? "")];
  let prefix = 0;
  while (
    prefix < original.length
    && prefix < candidate.length
    && original[prefix] === candidate[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < original.length - prefix
    && suffix < candidate.length - prefix
    && original[original.length - 1 - suffix]
      === candidate[candidate.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  return candidate
    .slice(prefix, candidate.length - suffix)
    .join("");
}

function countDialogueSignals(text) {
  const value = String(text ?? "");
  const quotePairs = value.match(/[「『“"][^」』”"\n]{1,240}[」』”"]/gu) ?? [];
  const speakerLines = value.match(/(?:^|\n)\s*[^\n：:]{1,24}[：:][「『“"]/gu) ?? [];
  return quotePairs.length + speakerLines.length;
}

function classifyMutation(rawStoryText, candidateText) {
  const window = changedWindow(rawStoryText, candidateText);
  const dialogueAdded =
    countDialogueSignals(candidateText) > countDialogueSignals(rawStoryText)
    || /[「『“"][^」』”"\n]{1,240}[」』”"]/u.test(window);
  const psychologyAdded = /(?:心裡|心中|內心|心想|想著|覺得|感到|意識到|終於明白|終於懂了|他知道|她知道|其實害怕|不願承認|realized|thought|felt|knew)/iu.test(window);
  const causalExplanationAdded = /(?:因為|所以|因此|於是|由於|導致|這表示|這意味著|也就是|正因如此|because|therefore|which meant|so that)/iu.test(window);
  const candidateHasNewSilenceExplanation =
    /(?:沉默|沒有回答|沒回答|沒有開口|沒開口|不說話|沒說話|不作聲|靜默|無言)[^。！？\n]{0,60}(?:因為|是因為|其實|表示|意味著|不願|害怕|知道|明白)/iu.test(candidateText)
    && !/(?:沉默|沒有回答|沒回答|沒有開口|沒開口|不說話|沒說話|不作聲|靜默|無言)[^。！？\n]{0,60}(?:因為|是因為|其實|表示|意味著|不願|害怕|知道|明白)/iu.test(rawStoryText);

  return {
    dialogue_added: dialogueAdded,
    psychology_added: psychologyAdded,
    causal_explanation_added: causalExplanationAdded,
    silence_explanation_added: candidateHasNewSilenceExplanation,
  };
}

function publicPayloadRecord(payload, rawStoryText) {
  const exactIdentity = payload.text === rawStoryText;
  return {
    path: payload.path,
    key: payload.key,
    sha256: sha256(payload.text),
    exact_raw_story_identity: exactIdentity,
    ...(exactIdentity ? {} : {
      mutation_categories: classifyMutation(rawStoryText, payload.text),
    }),
  };
}

export function enforceFinalPolisherMinimalIntervention({
  raw_story_text: rawStoryText,
  capability_output: capabilityOutput,
} = {}) {
  if (typeof rawStoryText !== "string" || rawStoryText.length === 0) {
    throw new Error("raw_story_text is required for final-polisher minimal-intervention guard.");
  }

  const normalizedOutput = isObject(capabilityOutput)
    ? capabilityOutput
    : {};
  const prosePayloads = collectProsePayloads(normalizedOutput);
  const payloadRecords = prosePayloads.map((payload) => (
    publicPayloadRecord(payload, rawStoryText)
  ));
  const changedPayloads = payloadRecords.filter(
    (payload) => payload.exact_raw_story_identity !== true,
  );
  const categories = changedPayloads.reduce((accumulator, payload) => {
    for (const [key, active] of Object.entries(payload.mutation_categories ?? {})) {
      if (active === true) accumulator[key] = true;
    }
    return accumulator;
  }, {
    dialogue_added: false,
    psychology_added: false,
    causal_explanation_added: false,
    silence_explanation_added: false,
  });
  const violations = [];
  const declaredRawStorySha256 = typeof normalizedOutput.raw_story_sha256 === "string"
    ? normalizedOutput.raw_story_sha256
    : null;
  const declaredReleaseStorySha256 = typeof normalizedOutput.release_story_sha256 === "string"
    ? normalizedOutput.release_story_sha256
    : null;
  if (declaredRawStorySha256 && declaredRawStorySha256 !== sha256(rawStoryText)) {
    violations.push("raw_story_sha256_mismatch");
  }
  if (declaredReleaseStorySha256 && declaredReleaseStorySha256 !== sha256(rawStoryText)) {
    violations.push("release_story_sha256_mismatch");
  }
  if (changedPayloads.length > 0) {
    violations.push("changed_prose_payload_forbidden");
  }
  if (categories.dialogue_added) violations.push("added_dialogue_forbidden");
  if (categories.psychology_added) violations.push("added_psychology_forbidden");
  if (categories.causal_explanation_added) violations.push("added_causal_explanation_forbidden");
  if (categories.silence_explanation_added) violations.push("silence_explanation_forbidden");

  const accepted = violations.length === 0;
  const rawStorySha256 = sha256(rawStoryText);
  const safeCapabilityOutput = accepted
    ? normalizedOutput
    : stripProsePayloads(normalizedOutput);

  return {
    accepted,
    capability_output: safeCapabilityOutput,
    public_guard: {
      guard_version: finalPolisherMinimalInterventionGuardVersion,
      status: accepted
        ? "passed_exact_identity_or_report_only"
        : "blocked_changed_prose_payload",
      raw_story_sha256: rawStorySha256,
      release_story_sha256: rawStorySha256,
      exact_release_identity_required: true,
      text_identity_preserved: accepted,
      prose_payload_count: prosePayloads.length,
      changed_prose_payload_count: changedPayloads.length,
      prose_payloads: payloadRecords,
      violations,
      forbidden_additions: {
        dialogue: true,
        psychology: true,
        causal_explanation: true,
        silence_explanation: true,
      },
      detected_additions: categories,
      writer_workbench_generated_replacement_prose: false,
      release_action: accepted
        ? "release_original_text"
        : "block_and_return_report_without_replacement_prose",
    },
  };
}

export default enforceFinalPolisherMinimalIntervention;

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { projectPaths } from "./project-paths.mjs";

const sourceType = "read_only_derived_index";
const authority = "below_canon_db";
const severityRank = { none: 0, low: 1, medium: 2, high: 3 };

const characterAliases = new Map([
  ["朝日奈千夜", ["朝日奈千夜", "千夜"]],
  ["九逃", ["九逃"]],
  ["貓狼", ["貓狼"]],
  ["雪弟", ["雪弟"]],
  ["夜安晴", ["夜安晴", "小晴"]],
  ["夜文澤", ["夜文澤", "小澤"]],
  ["宇天", ["宇天"]],
  ["千函", ["千函"]],
  ["拉芙蒂・里德斯特", ["拉芙蒂・里德斯特", "拉芙蒂", "拉芙蒂・里德ス特"]],
  ["莉莉絲", ["莉莉絲"]],
  ["鹿梅", ["鹿梅"]],
  ["莊", ["莊"]],
  ["夜", ["夜老師"]],
]);

const distinctPairs = [
  ["朝日奈千夜", "九逃"],
  ["貓狼", "雪弟"],
  ["夜安晴", "夜文澤"],
  ["宇天", "千函"],
  ["拉芙蒂・里德斯特", "莉莉絲"],
  ["鹿梅", "莊"],
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function excerpt(text, index, length = 120) {
  const start = Math.max(0, index - 30);
  return text.slice(start, Math.min(text.length, index + length)).replace(/\s+/gu, " ").trim();
}

function aliasesFor(character) {
  return characterAliases.get(character) ?? [character];
}

function characterPattern(character) {
  return aliasesFor(character).map(escapeRegExp).join("|");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function characterWindows(text, character, radius = 180) {
  const windows = [];
  for (const alias of aliasesFor(character)) {
    let offset = 0;
    while (offset < text.length) {
      const index = text.indexOf(alias, offset);
      if (index < 0) break;
      windows.push({
        alias,
        index,
        text: text.slice(Math.max(0, index - 40), Math.min(text.length, index + radius)),
      });
      offset = index + alias.length;
    }
  }
  return windows;
}

function dialogueFor(text, character) {
  const pattern = new RegExp(
    `(?:${characterPattern(character)})[^\\n「」]{0,80}「([^」]{1,240})」`,
    "gu",
  );
  return [...text.matchAll(pattern)].map((match) => ({
    dialogue: match[1].trim(),
    evidence: excerpt(text, match.index ?? 0),
  }));
}

function normalizeDialogue(value) {
  return value
    .replace(/[，。！？、；：「」『』…\s]/gu, "")
    .replace(/(我|你|妳|他|她|我們|你們|妳們)/gu, "")
    .trim();
}

function finding(code, severity, characters, message, evidence, recommendation) {
  return { code, severity, characters, message, evidence, recommendation };
}

function addPatternFinding(findings, text, {
  code,
  severity,
  characters,
  pattern,
  message,
  recommendation,
}) {
  const match = pattern.exec(text);
  if (!match) return;
  findings.push(finding(
    code,
    severity,
    characters,
    message,
    excerpt(text, match.index),
    recommendation,
  ));
}

async function resolveRegistry(contextBundle, options) {
  const bundleContent = contextBundle?.content?.character_voice_registry_content;
  if (
    contextBundle?.character_voice_registry_loaded === true
    && typeof bundleContent === "string"
    && bundleContent.trim()
  ) {
    return {
      loaded: true,
      content: bundleContent,
      hash: contextBundle.character_voice_registry_hash_sha256 || sha256(bundleContent),
      source_type: contextBundle.character_voice_registry_source_type || sourceType,
      authority: contextBundle.character_voice_registry_authority || authority,
      source: "writing_context",
      expected_but_not_loaded: false,
    };
  }

  const expectedButNotLoaded = Boolean(contextBundle)
    && contextBundle.character_voice_registry_loaded !== true;
  const registryPath = options.characterVoiceRegistryPath ?? projectPaths.characterVoiceRegistry;
  try {
    const content = await readFile(registryPath, "utf8");
    if (!content.trim()) {
      return {
        loaded: false,
        content: "",
        hash: null,
        source_type: sourceType,
        authority,
        source: "fallback",
        expected_but_not_loaded: expectedButNotLoaded,
      };
    }
    return {
      loaded: true,
      content,
      hash: sha256(content),
      source_type: sourceType,
      authority,
      source: "fallback",
      expected_but_not_loaded: expectedButNotLoaded,
    };
  } catch {
    return {
      loaded: false,
      content: "",
      hash: null,
      source_type: sourceType,
      authority,
      source: "fallback",
      expected_but_not_loaded: expectedButNotLoaded,
    };
  }
}

function detectPairConflation(text, findings) {
  for (const [left, right] of distinctPairs) {
    const leftDialogue = dialogueFor(text, left);
    const rightDialogue = dialogueFor(text, right);
    if (!leftDialogue.length || !rightDialogue.length) continue;

    const match = leftDialogue.find((leftLine) => {
      const normalizedLeft = normalizeDialogue(leftLine.dialogue);
      if (normalizedLeft.length < 4) return false;
      return rightDialogue.some((rightLine) => {
        const normalizedRight = normalizeDialogue(rightLine.dialogue);
        return normalizedLeft === normalizedRight;
      });
    });
    if (!match) continue;

    findings.push(finding(
      "voice_pair_conflation",
      "medium",
      [left, right],
      `${left} and ${right} use materially identical dialogue despite distinct registry guidance.`,
      match.evidence,
      "Differentiate sentence rhythm, initiative, emotional display, and decision behavior for this pair.",
    ));
  }
}

function detectTraitContradictions(text, findings) {
  addPatternFinding(findings, text, {
    code: "voice_trait_contradiction",
    severity: "medium",
    characters: ["雪弟"],
    pattern: new RegExp(
      `(?:${characterPattern("雪弟")})[^\\n]{0,100}(?:興奮地大喊|激動地尖叫|手舞足蹈|放聲大笑|滔滔不絕)`,
      "u",
    ),
    message: "雪弟 is written with strongly expressive behavior that contradicts his low-display, short, direct voice.",
    recommendation: "Reduce emotional display and use short direct speech; preserve focused detail around dolls when relevant.",
  });
  addPatternFinding(findings, text, {
    code: "voice_trait_contradiction",
    severity: "medium",
    characters: ["莊"],
    pattern: new RegExp(
      `(?:${characterPattern("莊")})[^\\n]{0,120}(?:愚蠢|是個笨蛋|笨得什麼都不懂|腦袋空空|完全沒有思考能力)`,
      "u",
    ),
    message: "莊 is reduced to stupidity, contradicting the registry's smart but naturally airheaded distinction.",
    recommendation: "Keep her intelligence visible; let mistakes come from an unusual or absent-minded action angle.",
  });
  addPatternFinding(findings, text, {
    code: "voice_trait_contradiction",
    severity: "medium",
    characters: ["朝日奈千夜"],
    pattern: new RegExp(
      `(?:${characterPattern("朝日奈千夜")})[^\\n]{0,140}(?:完全沒有主見|什麼都不敢決定|只能永遠服從|從不做選擇)`,
      "u",
    ),
    message: "千夜 is explicitly denied agency, contradicting the registry requirement that gentleness must not erase judgment.",
    recommendation: "Retain a choice, boundary, or considered preference even when her delivery is shy or gentle.",
  });
  addPatternFinding(findings, text, {
    code: "voice_trait_contradiction",
    severity: "medium",
    characters: ["千函"],
    pattern: new RegExp(
      `(?:${characterPattern("千函")})[^\\n]{0,140}(?:完全沒有主見|從不自行判斷|哥哥說什麼就做什麼|只能盲從)`,
      "u",
    ),
    message: "千函 is written as having no judgment, contradicting her calm, reserved but independent reasoning.",
    recommendation: "She may follow 宇天's rhythm, but show her own technical or practical judgment.",
  });
}

function detectRoleReduction(text, findings) {
  addPatternFinding(findings, text, {
    code: "role_reduction",
    severity: "medium",
    characters: ["九逃"],
    pattern: new RegExp(
      `(?:${characterPattern("九逃")})[^\\n]{0,160}(?:萬能補師|一鍵治好所有|瞬間治好所有|所有問題都能治好|任何傷勢都能立刻治癒)`,
      "u",
    ),
    message: "九逃 is reduced to an omnipotent healer function.",
    recommendation: "Preserve her warmth, care, boundaries, injuries, and competitive drive; do not make healing solve every problem.",
  });
  addPatternFinding(findings, text, {
    code: "role_reduction",
    severity: "medium",
    characters: ["雪弟"],
    pattern: new RegExp(
      `(?:${characterPattern("雪弟")})[^\\n]{0,150}(?:只是操作人偶的工具|只負責操縱人偶|除了人偶什麼都不是)`,
      "u",
    ),
    message: "雪弟 is reduced to a silent doll-operation tool.",
    recommendation: "Keep his low-display voice while allowing observation, choice, and focused personal attention.",
  });
}

function detectChildVoiceSafety(text, findings) {
  for (const character of ["夜安晴", "夜文澤"]) {
    addPatternFinding(findings, text, {
      code: "child_voice_safety",
      severity: "high",
      characters: [character],
      pattern: new RegExp(
        `(?:${characterPattern(character)})[^\\n]{0,180}(?:擔任戰術總指揮|決定處決|下令擊殺|獨自指揮成人部隊|作為成人級主戰力)`,
        "u",
      ),
      message: `${character} is assigned adult-level combat authority or an adult main-combat role.`,
      recommendation: "Keep the child character's agency age-appropriate and do not assign adult command or execution authority.",
    });
  }
}

function detectSupportTooling(text, findings) {
  for (const character of ["莉莉絲", "九逃", "宇月", "夜"]) {
    addPatternFinding(findings, text, {
      code: "support_character_tooling",
      severity: "medium",
      characters: [character],
      pattern: new RegExp(
        `(?:${characterPattern(character)})[^\\n]{0,150}(?:只是推動劇情的工具|只是提供答案的裝置|沒有自己的選擇|純粹是功能角色)`,
        "u",
      ),
      message: `${character} is explicitly reduced to a support device rather than a person.`,
      recommendation: "Give the character a bounded perspective, choice, or interpersonal response beyond the support function.",
    });
  }
}

function detectOverConfidentInference(text, findings) {
  addPatternFinding(findings, text, {
    code: "over_confident_inference",
    severity: "low",
    characters: [],
    pattern: /(?:正式設定為|天生就是|從出生起就|一直以來必然)(?:[^。\n]{0,80})(?:性格|人格|個性)/u,
    message: "The candidate asserts a broad personality fact as established without showing registry or Canon support.",
    recommendation: "Present unsupported personality interpretation as scene behavior, not a permanent factual declaration.",
  });
}

function detectColdOfficialConflation(text, findings) {
  const leftWindows = characterWindows(text, "拉芙蒂・里德斯特");
  const rightWindows = characterWindows(text, "莉莉絲");
  const coldOfficial = /(?:冷冰冰|毫無情緒|公文口吻|官腔|像機器一樣)/u;
  const left = leftWindows.find((entry) => coldOfficial.test(entry.text));
  const right = rightWindows.find((entry) => coldOfficial.test(entry.text));
  if (!left || !right) return;
  findings.push(finding(
    "voice_pair_conflation",
    "medium",
    ["拉芙蒂・里德斯特", "莉莉絲"],
    "拉芙蒂 and 莉莉絲 are both flattened into the same cold official voice.",
    `${excerpt(text, left.index)} / ${excerpt(text, right.index)}`,
    "Differentiate reflective record-keeping from composed foresight and pre-emptive guidance.",
  ));
}

function summarize(registry, findings) {
  let severity = "none";
  for (const item of findings) {
    if (severityRank[item.severity] > severityRank[severity]) severity = item.severity;
  }
  const verdict = severity === "none" ? "pass" : severity === "high" ? "fail" : "warn";
  return {
    character_voice_guard_used: true,
    character_voice_registry_loaded: registry.loaded,
    character_voice_registry_hash_sha256: registry.hash,
    character_voice_registry_source_type: registry.source_type,
    character_voice_registry_authority: registry.authority,
    character_voice_guard_verdict: verdict,
    character_voice_guard_severity: severity,
    character_voice_guard_findings_count: findings.length,
    verdict,
    severity,
    findings,
  };
}

export function characterVoiceGuardMetadata(result) {
  return {
    character_voice_guard_used: result.character_voice_guard_used,
    character_voice_registry_loaded: result.character_voice_registry_loaded,
    character_voice_registry_hash_sha256: result.character_voice_registry_hash_sha256,
    character_voice_registry_source_type: result.character_voice_registry_source_type,
    character_voice_registry_authority: result.character_voice_registry_authority,
    character_voice_guard_verdict: result.character_voice_guard_verdict,
    character_voice_guard_severity: result.character_voice_guard_severity,
    character_voice_guard_findings_count: result.character_voice_guard_findings_count,
    character_voice_guard: result,
  };
}

export async function evaluateCharacterVoiceDrift(rawInput = {}, options = {}) {
  const candidateText = typeof rawInput.candidate_text === "string"
    ? rawInput.candidate_text
    : typeof rawInput.candidateText === "string"
      ? rawInput.candidateText
      : "";
  const contextBundle = rawInput.context_bundle ?? rawInput.contextBundle ?? null;
  const registry = await resolveRegistry(contextBundle, options);
  const findings = [];

  if (registry.expected_but_not_loaded) {
    findings.push(finding(
      "voice_registry_missing",
      "low",
      [],
      "The writing context expected the Character Voice Registry but did not load it.",
      "character_voice_registry_loaded=false",
      "Rebuild the writing context with the read-only Character Voice Registry available.",
    ));
  }
  if (!registry.loaded || !registry.content.trim()) {
    findings.push(finding(
      "voice_registry_unavailable",
      "medium",
      [],
      "The Character Voice Registry is unavailable or empty; voice drift checks are incomplete.",
      "No readable registry content was available.",
      "Restore read-only registry access and rerun proofing; do not infer missing character traits.",
    ));
    return summarize(registry, findings);
  }

  detectPairConflation(candidateText, findings);
  detectColdOfficialConflation(candidateText, findings);
  detectTraitContradictions(candidateText, findings);
  detectRoleReduction(candidateText, findings);
  detectChildVoiceSafety(candidateText, findings);
  detectSupportTooling(candidateText, findings);
  detectOverConfidentInference(candidateText, findings);
  return summarize(registry, findings);
}

export default {
  evaluateCharacterVoiceDrift,
  characterVoiceGuardMetadata,
};

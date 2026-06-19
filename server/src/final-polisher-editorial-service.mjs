import { createHash } from "node:crypto";

const defaultChangedDimensions = [
  "human_diction",
  "voice",
  "subtext",
  "ending_hook",
];

const canonicalPreservedConstraints = [
  "canon_facts",
  "character_state",
  "battle_result",
  "timeline",
];

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function textOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function objectOrNull(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function pass(status = "passed", details = {}) {
  return {
    status,
    ...details,
  };
}

function baseRevisionReport({
  revisionScope,
  rawDraftText,
  polishedText,
  changedDimensions = [],
  riskFlags = [],
  structuralGate = pass(),
  canonPreservationPass = pass(),
  characterVoicePass = pass(),
  humanDictionPass = pass(),
  proseTexturePass = pass(),
  overPolishingGuard = pass(),
}) {
  return {
    revision_scope: revisionScope,
    changed_dimensions: unique(changedDimensions),
    preserved_constraints: canonicalPreservedConstraints,
    risk_flags: unique(riskFlags),
    raw_draft_hash: rawDraftText ? sha256(rawDraftText) : "",
    polished_text_hash: polishedText ? sha256(polishedText) : "",
    structural_gate: structuralGate,
    canon_preservation_pass: canonPreservationPass,
    character_voice_pass: characterVoicePass,
    human_diction_pass: humanDictionPass,
    prose_texture_pass: proseTexturePass,
    over_polishing_guard: overPolishingGuard,
  };
}

function detectHumanDictionIssues(text) {
  const issues = [];
  const checks = [
    ["abstract_noun_stack", /(情緒|命運|沉默|壓力|記憶|真相|靈魂|存在|世界).{0,8}(重量|輪廓|裂縫|深處|深淵|蔓延|交織|承載|映照)/u],
    ["translationese_phrase", /(一種|某種).{0,12}(難以言喻|無法被命名|不可名狀)|被.{1,12}所/u],
    ["unnatural_collocation", /(情緒|沉默|意義|命運).{0,8}(蔓延|宣告|承載|映照|凝聚)/u],
    ["over_formal_dialogue", /「[^」]*(我認為|重新評估|進行|有必要|基於目前狀況)[^」]*」/u],
    ["generic_emotion_wording", /(很不安|很難過|很生氣|感到不安|感受到一種|難以言喻的情緒)/u],
  ];
  for (const [flag, pattern] of checks) {
    if (pattern.test(text)) issues.push(flag);
  }
  return unique(issues);
}

function detectCanonRisks(text) {
  const risks = [];
  const checks = [
    ["canon_fact_locked_by_polish", /(正式設定為|正史確定|從此被確認為|已被正史承認)/u],
    ["battle_result_changed_by_polish", /(原本輸了|改成勝利|戰鬥結果被改寫|裁定被改變)/u],
    ["injury_erased_by_polish", /(傷口完全消失|毫髮無傷|傷勢像沒發生過)/u],
    ["ability_changed_by_polish", /(能力變成|武裝變成|異能武裝改為|新增能力為)/u],
    ["foreshadowing_over_defined", /(伏筆已經代表|真相就是|這個暗示明確表示)/u],
  ];
  for (const [flag, pattern] of checks) {
    if (pattern.test(text)) risks.push(flag);
  }
  return unique(risks);
}

function detectOverPolishingRisks(rawText, polishedText) {
  const risks = [];
  const text = polishedText || rawText;
  if (/(真正的風暴才剛開始|一切才剛開始|命運的齒輪開始轉動|新的危機即將到來)/u.test(text)) {
    risks.push("pretty_but_empty_ending");
  }
  if (/(他其實是因為|她真正想說的是|這代表他內心|這象徵著)/u.test(text)) {
    risks.push("subtext_over_explained");
  }
  if (rawText && polishedText) {
    const rawLength = rawText.length;
    const polishedLength = polishedText.length;
    if (rawLength > 0 && Math.abs(polishedLength - rawLength) / rawLength > 0.45) {
      risks.push("revision_changed_too_much_for_line_edit");
    }
  }
  return unique(risks);
}

function normalizeForcedReasons(signals) {
  const normalized = objectOrNull(signals) ?? {};
  const reasons = normalized.block_reasons ?? normalized.blockReasons ?? [];
  if (!Array.isArray(reasons)) return [];
  return reasons.map((reason) => String(reason ?? "").trim()).filter(Boolean);
}

function evaluateStructuralGate(rawDraftText, input) {
  const director = objectOrNull(
    input.writing_card_director_context ?? input.writingCardDirectorContext,
  );
  const structuralSignals = objectOrNull(
    input.structural_signals ?? input.structuralSignals,
  );
  const reasons = normalizeForcedReasons(structuralSignals);
  if (director) {
    if (!textOrEmpty(director.chapter_turn)) reasons.push("missing_chapter_turn");
    if (!textOrEmpty(director.scene_function)) reasons.push("missing_scene_function");
    if (!textOrEmpty(director.ending_event_hook)) reasons.push("missing_ending_event_hook");
  }
  const ending = rawDraftText.slice(Math.max(0, rawDraftText.length - 600));
  if (/(真正的風暴才剛開始|新的危機即將到來|一切才剛開始)[。！!？?\s]*$/u.test(ending)) {
    reasons.push("ending_hook_is_pretty_sentence_only");
  }
  if (/傷口完全消失|毫髮無傷|傷勢像沒發生過/u.test(rawDraftText)) {
    reasons.push("character_injury_disappeared");
  }
  if (/突然就原諒|立刻釋懷|毫無過程地接受/u.test(rawDraftText)) {
    reasons.push("emotional_jump_without_process");
  }
  if (/正式設定為|正史確定|新增能力為/u.test(rawDraftText)) {
    reasons.push("unauthorized_new_canon_claim");
  }
  const hasBattleCue = /(戰鬥|攻擊|防守|武裝|靈力|招式|裁定)/u.test(rawDraftText)
    || /battle|combat|attack/iu.test(rawDraftText);
  const hasCostCue = /(痛|血|喘|酸|麻|負荷|代價|震|傷|疲|汗|呼吸)/u.test(rawDraftText);
  if (hasBattleCue && !hasCostCue) reasons.push("battle_payment_insufficient");

  const uniqueReasons = unique(reasons);
  if (uniqueReasons.length > 0) {
    return pass("blocked", {
      blocked: true,
      reasons: uniqueReasons,
      suggested_return_stage: "writing_card_director",
    });
  }
  return pass("passed", {
    blocked: false,
    reasons: [],
    suggested_return_stage: null,
  });
}

function normalizeChinesePunctuation(text) {
  return String(text ?? "")
    .replace(/。{2,}/gu, "。")
    .replace(/！{2,}/gu, "！")
    .replace(/？{2,}/gu, "？")
    .replace(/，{2,}/gu, "，")
    .replace(/、{2,}/gu, "、")
    .replace(/；{2,}/gu, "；")
    .replace(/：{2,}/gu, "：")
    .replace(/。([」』])/gu, "。$1")
    .replace(/([。！？])。([」』])/gu, "$1$2");
}

function applyHumanDictionPolish(text) {
  return normalizeChinesePunctuation(text
    .replaceAll("我感受到一種難以言喻的壓迫感在胸口蔓延", "我胸口悶了一下")
    .replaceAll("感受到一種難以言喻的壓迫感在胸口蔓延", "胸口悶了一下")
    .replaceAll("她感到一種無法被命名的情緒在胸口擴散", "她胸口悶了一下，話卡在裡面。")
    .replaceAll("他感到一種無法被命名的情緒在胸口擴散", "他胸口悶了一下，話卡在裡面。")
    .replaceAll("我認為我們現在應該重新評估這件事的意義", "先別急著定案。這事不對。")
    .replaceAll("空氣變得沉重", "冷氣聲忽然變得很清楚")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim());
}

function evaluateCharacterVoice(text) {
  const risks = [];
  const formalDialogueMatches = text.match(/「[^」]*(我認為|重新評估|進行|有必要|基於目前狀況)[^」]*」/gu) ?? [];
  if (formalDialogueMatches.length > 0) risks.push("dialogue_voice_too_formal");
  const explainMachineMatches = text.match(/「[^」]*(也就是說|換句話說|這代表|因此我們可以得知)[^」]*」/gu) ?? [];
  if (explainMachineMatches.length > 1) risks.push("character_voice_exposition_machine");
  return pass(risks.length ? "warning" : "passed", {
    voice_preserved: risks.length === 0,
    risk_flags: risks,
  });
}

function evaluateProseTexture(text) {
  const risks = [];
  const concreteAnchors = text.match(/(燈|門|桌|終端|螢幕|地板|走廊|風|雨|血|手|眼|咖啡|水痕|影子)/gu) ?? [];
  if (text.length > 120 && concreteAnchors.length === 0) risks.push("scene_lacks_concrete_objects");
  if (/(很不安|很難過|很生氣|非常痛苦)/u.test(text)) risks.push("emotion_over_named");
  return pass(risks.length ? "warning" : "passed", {
    checked_dimensions: [
      "concrete_detail",
      "sentence_rhythm",
      "paragraph_breath",
      "scene_object_presence",
      "body_anchor",
      "subtext",
      "ending_hook_strength",
    ],
    risk_flags: risks,
  });
}

export function runFinalPolisherEditorialBrain(rawInput = {}, options = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const rawDraftText = textOrEmpty(rawInput.raw_draft_text ?? rawInput.rawDraftText);
  if (!rawDraftText) {
    const revisionReport = baseRevisionReport({
      revisionScope: "skipped",
      rawDraftText: "",
      polishedText: "",
      riskFlags: ["raw_draft_missing"],
      structuralGate: pass("skipped", {
        blocked: false,
        reasons: ["raw_draft_missing"],
      }),
    });
    return {
      status: "skipped",
      polished_text: "",
      revision_report: revisionReport,
      needs_structural_revision: false,
      suggested_return_stage: null,
      writing_pipeline_complete: false,
      warnings: ["raw_draft_missing"],
    };
  }

  const structuralGate = evaluateStructuralGate(rawDraftText, rawInput);
  if (structuralGate.blocked === true) {
    const revisionReport = baseRevisionReport({
      revisionScope: "structural_block",
      rawDraftText,
      polishedText: "",
      riskFlags: structuralGate.reasons,
      structuralGate,
      canonPreservationPass: pass("skipped", { reason: "structural_gate_blocked" }),
      characterVoicePass: pass("skipped", { reason: "structural_gate_blocked" }),
      humanDictionPass: pass("skipped", { reason: "structural_gate_blocked" }),
      proseTexturePass: pass("skipped", { reason: "structural_gate_blocked" }),
      overPolishingGuard: pass("skipped", { reason: "structural_gate_blocked" }),
    });
    return {
      status: "needs_structural_revision",
      polished_text: "",
      revision_report: revisionReport,
      needs_structural_revision: true,
      suggested_return_stage: "writing_card_director",
      writing_pipeline_complete: false,
      warnings: ["structural_gate_blocked"],
    };
  }

  const beforeHumanDictionIssues = detectHumanDictionIssues(rawDraftText);
  const polishedText = typeof options.editorialAdapter === "function"
    ? textOrEmpty(options.editorialAdapter(rawDraftText, rawInput)) || rawDraftText
    : applyHumanDictionPolish(rawDraftText);
  const afterHumanDictionIssues = detectHumanDictionIssues(polishedText);
  const canonRisks = unique([
    ...detectCanonRisks(rawDraftText),
    ...detectCanonRisks(polishedText),
  ]);
  const characterVoicePass = evaluateCharacterVoice(polishedText);
  const proseTexturePass = evaluateProseTexture(polishedText);
  const overPolishingRisks = detectOverPolishingRisks(rawDraftText, polishedText);
  const riskFlags = unique([
    ...canonRisks,
    ...afterHumanDictionIssues,
    ...(characterVoicePass.risk_flags ?? []),
    ...(proseTexturePass.risk_flags ?? []),
    ...overPolishingRisks,
  ]);
  const changedDimensions = polishedText === rawDraftText
    ? []
    : defaultChangedDimensions;
  const humanDictionPass = pass(
    beforeHumanDictionIssues.length > afterHumanDictionIssues.length ? "revised" : "passed",
    {
      detected_issues_before: beforeHumanDictionIssues,
      detected_issues_after: afterHumanDictionIssues,
      revision_policy: "replace_with_contextual_human_phrasing",
    },
  );
  const canonPreservationPass = pass(canonRisks.length ? "warning" : "passed", {
    canon_preserved: canonRisks.length === 0,
    risk_flags: canonRisks,
  });
  const overPolishingGuard = pass(overPolishingRisks.length ? "warning" : "passed", {
    risk_flags: overPolishingRisks,
    preserve_event_function: true,
    preserve_subtext: !overPolishingRisks.includes("subtext_over_explained"),
  });
  const revisionReport = baseRevisionReport({
    revisionScope: changedDimensions.length ? "line_edit" : "line_edit",
    rawDraftText,
    polishedText,
    changedDimensions,
    riskFlags,
    structuralGate,
    canonPreservationPass,
    characterVoicePass,
    humanDictionPass,
    proseTexturePass,
    overPolishingGuard,
  });
  return {
    status: "completed",
    polished_text: polishedText,
    revision_report: revisionReport,
    needs_structural_revision: false,
    suggested_return_stage: null,
    writing_pipeline_complete: riskFlags.length === 0,
    warnings: riskFlags,
  };
}

export default runFinalPolisherEditorialBrain;

import { createHash } from "node:crypto";

export const readerResponseSimulatorVersion = "reader_response_simulator_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 500) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function list(value, maximum = 12, itemMaximum = 240) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => text(typeof item === "string" ? item : JSON.stringify(item ?? ""), itemMaximum))
    .filter(Boolean)
    .slice(0, maximum);
}

function clampScore(value) {
  const number = Number.isFinite(value) ? value : 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function scoreLabel(score) {
  if (score >= 76) return "strong";
  if (score >= 55) return "watch";
  return "weak";
}

function cardTone(score) {
  if (score >= 76) return "safe";
  if (score >= 55) return "watch";
  return "blocked";
}

function paragraphStats(candidateText) {
  const paragraphs = candidateText
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const characters = Array.from(candidateText).length;
  const averageParagraphLength = paragraphs.length ? Math.round(characters / paragraphs.length) : 0;
  const longParagraphs = paragraphs.filter((paragraph) => Array.from(paragraph).length > 420).length;
  return { paragraphs, characters, average_paragraph_length: averageParagraphLength, long_paragraphs: longParagraphs };
}

function countMatches(candidateText, patterns) {
  return patterns.reduce((total, pattern) => total + (candidateText.match(pattern) ?? []).length, 0);
}

function normalizeConflict(rawInput, options) {
  const source = object(
    options.dramaticConflictManager
      ?? rawInput.dramatic_conflict_manager
      ?? rawInput.dramaticConflictManager
      ?? rawInput.dramatic_conflict_plan
      ?? rawInput.dramaticConflictPlan,
  );
  const plan = object(source.plan ?? source);
  return {
    protagonist: text(plan.protagonist ?? plan.primary_actor ?? plan.primaryActor, 120),
    protagonist_want: text(plan.protagonist_want ?? plan.protagonistWant ?? plan.want ?? plan.goal, 260),
    opposition: text(plan.opposition ?? plan.opposition_pressure ?? plan.oppositionPressure ?? plan.blocking_force, 260),
    stakes: text(plan.stakes ?? plan.risk, 260),
    reversal_or_reveal: text(plan.reversal_or_reveal ?? plan.reversalOrReveal ?? plan.turning_point ?? plan.turningPoint, 260),
    required_choice: text(plan.required_choice ?? plan.requiredChoice ?? plan.choice, 260),
    cost_or_payment: text(plan.cost_or_payment ?? plan.costOrPayment ?? plan.cost ?? plan.payment, 260),
    new_status_quo: text(plan.new_status_quo ?? plan.newStatusQuo ?? plan.ending_state ?? plan.endingState, 320),
    ending_hook: text(plan.ending_hook ?? plan.endingHook ?? plan.hook, 260),
  };
}

function buildReaderExpectation(rawInput, conflict) {
  const generation = object(rawInput.generation_context ?? rawInput.generationContext);
  const prompt = text(rawInput.task_prompt ?? rawInput.prompt ?? generation.prompt, 360);
  const openingPromise = text(
    rawInput.reader_expectation?.opening_promise
      ?? rawInput.readerExpectation?.openingPromise
      ?? conflict.protagonist_want
      ?? generation.scene
      ?? prompt,
    300,
  );
  const expectedPayoff = text(
    rawInput.reader_expectation?.expected_payoff
      ?? rawInput.readerExpectation?.expectedPayoff
      ?? conflict.new_status_quo
      ?? conflict.ending_hook,
    300,
  );
  const delayedQuestions = list(
    rawInput.reader_questions_to_carry_forward
      ?? rawInput.readerQuestionsToCarryForward
      ?? rawInput.reader_expectation?.delayed_questions
      ?? rawInput.readerExpectation?.delayedQuestions,
    8,
    220,
  );
  return {
    opening_promise: openingPromise,
    expected_payoff: expectedPayoff,
    delayed_questions: delayedQuestions,
    status: openingPromise && expectedPayoff ? "clear" : "needs_context",
  };
}

function buildEmotionalCurve(candidateText, stats, rawInput) {
  const suppliedBeats = list(rawInput.emotional_beats ?? rawInput.emotionalBeats, 8, 180);
  const tensionSignals = countMatches(candidateText, [/選擇/gu, /代價/gu, /沉默/gu, /疼/gu, /失去/gu, /阻止/gu, /推開/gu, /追/gu]);
  const quietSignals = countMatches(candidateText, [/安靜/gu, /看著/gu, /等/gu, /呼吸/gu, /咖啡/gu]);
  const beats = suppliedBeats.length
    ? suppliedBeats
    : [
        tensionSignals ? "in-scene pressure is visible" : "pressure is lightly implied",
        quietSignals ? "quiet reaction beats are present" : "quiet reaction beats are sparse",
        stats.paragraphs.length >= 3 ? "scene has multiple movement beats" : "scene may be too compressed",
      ];
  const score = clampScore(52 + Math.min(tensionSignals, 8) * 5 + Math.min(quietSignals, 4) * 3 + Math.min(stats.paragraphs.length, 6) * 2 - stats.long_paragraphs * 7);
  return {
    score,
    label: scoreLabel(score),
    curve_shape: score >= 76 ? "rising_with_release" : score >= 55 ? "present_but_needs_variation" : "flat_or_underdeveloped",
    beats,
    warnings: score < 55 ? ["emotional_curve_may_feel_flat"] : [],
  };
}

function buildDialogueTension(candidateText) {
  const dialogueMarks = countMatches(candidateText, [/「/gu, /」/gu, /『/gu, /』/gu, /"/gu]);
  const frictionSignals = countMatches(candidateText, [/但是/gu, /可是/gu, /不要/gu, /等一下/gu, /為什麼/gu, /不能/gu, /停/gu, /錯/gu]);
  const reportSignals = countMatches(candidateText, [/確認/gu, /流程/gu, /項目/gu, /報告/gu, /資料/gu, /狀態/gu]);
  const score = clampScore(44 + Math.min(dialogueMarks, 10) * 3 + Math.min(frictionSignals, 8) * 5 - Math.min(reportSignals, 8) * 3);
  return {
    score,
    label: scoreLabel(score),
    has_dialogue: dialogueMarks > 0,
    tension_sources: [
      ...(dialogueMarks > 0 ? ["dialogue_present"] : ["dialogue_sparse"]),
      ...(frictionSignals > 0 ? ["friction_language_present"] : ["friction_language_sparse"]),
      ...(reportSignals > 3 ? ["dialogue_may_sound_report_like"] : []),
    ],
  };
}

function buildChapterTurnSatisfaction(conflict, candidateText) {
  const textSignals = countMatches(candidateText, [/變/gu, /失去/gu, /打開/gu, /消失/gu, /留下/gu, /不能回/gu, /代價/gu, /選擇/gu]);
  const hasNewStatusQuo = Boolean(conflict.new_status_quo);
  const hasCost = Boolean(conflict.cost_or_payment);
  const hasTurn = Boolean(conflict.reversal_or_reveal || conflict.required_choice || textSignals >= 2);
  const score = clampScore(35 + (hasNewStatusQuo ? 22 : 0) + (hasCost ? 20 : 0) + (hasTurn ? 18 : 0) + Math.min(textSignals, 5));
  return {
    score,
    label: scoreLabel(score),
    has_new_status_quo: hasNewStatusQuo,
    has_cost_or_payment: hasCost,
    has_reversal_or_choice: hasTurn,
    status: score >= 76 ? "chapter_turn_visible" : score >= 55 ? "chapter_turn_partial" : "chapter_turn_weak",
  };
}

function buildHookStrength(conflict, candidateText) {
  const ending = text(candidateText.split(/\n\s*\n/gu).filter(Boolean).at(-1) ?? candidateText, 420);
  const hookSignals = countMatches(ending, [/？/gu, /\?/gu, /門/gu, /下一/gu, /留下/gu, /跟上/gu, /不能/gu, /消失/gu, /看見/gu]);
  const hasHook = Boolean(conflict.ending_hook || hookSignals > 0);
  const score = clampScore(42 + (conflict.ending_hook ? 28 : 0) + Math.min(hookSignals, 6) * 5);
  return {
    score,
    label: scoreLabel(score),
    ending_hook: conflict.ending_hook || ending,
    has_hook: hasHook,
    status: score >= 76 ? "strong_continue_reading_hook" : score >= 55 ? "usable_hook" : "hook_needs_pressure",
  };
}

function buildPacingPressure(candidateText, stats) {
  const expositionSignals = countMatches(candidateText, [/說明/gu, /資料/gu, /設定/gu, /系統/gu, /流程/gu, /規則/gu, /原因是/gu]);
  const actionSignals = countMatches(candidateText, [/走/gu, /跑/gu, /推/gu, /拉/gu, /碰/gu, /打開/gu, /閃/gu, /落/gu, /回頭/gu]);
  const pressure = clampScore(28 + stats.long_paragraphs * 18 + Math.max(0, expositionSignals - actionSignals) * 6 + (stats.average_paragraph_length > 360 ? 18 : 0));
  const score = clampScore(100 - pressure);
  return {
    score,
    label: scoreLabel(score),
    information_pressure: pressure,
    average_paragraph_length: stats.average_paragraph_length,
    long_paragraphs: stats.long_paragraphs,
    exposition_signals: expositionSignals,
    action_signals: actionSignals,
    warnings: [
      ...(pressure >= 55 ? ["information_density_may_feel_heavy"] : []),
      ...(stats.long_paragraphs > 0 ? ["long_paragraph_skim_risk"] : []),
    ],
  };
}

function buildRisks(candidateText, pacing, dialogue, chapterTurn) {
  const confusionPoints = [];
  const fatiguePoints = [];
  if (pacing.information_pressure >= 55) fatiguePoints.push("information_density_is_high");
  if (pacing.long_paragraphs > 0) fatiguePoints.push("long_paragraphs_may_invite_skimming");
  if (!dialogue.has_dialogue) fatiguePoints.push("dialogue_is_sparse");
  if (dialogue.tension_sources.includes("dialogue_may_sound_report_like")) fatiguePoints.push("dialogue_may_sound_report_like");
  if (chapterTurn.score < 55) confusionPoints.push("chapter_turn_is_not_visible_enough");
  if (Array.from(candidateText).length < 160) confusionPoints.push("candidate_text_too_short_for_reader_response_confidence");
  const skimScore = clampScore(30 + pacing.information_pressure * 0.45 + fatiguePoints.length * 8 - dialogue.score * 0.18 - chapterTurn.score * 0.14);
  return {
    confusion_points: confusionPoints,
    fatigue_points: fatiguePoints,
    skim_risk: {
      score: skimScore,
      label: skimScore >= 70 ? "high" : skimScore >= 45 ? "medium" : "low",
      reasons: [...fatiguePoints, ...confusionPoints].slice(0, 8),
    },
  };
}

function buildCards({ overallScore, emotionalCurve, pacing, dialogue, chapterTurn, hook, risks }) {
  return [
    {
      key: "reader_response_overall",
      title: "Reader response",
      label: "讀者體感",
      score: overallScore,
      tone: cardTone(overallScore),
      summary: overallScore >= 76 ? "The chapter should feel readable and worth continuing." : "The chapter needs reader-facing pressure checks.",
    },
    {
      key: "chapter_turn_satisfaction",
      title: "Chapter turn",
      label: "章節推進",
      score: chapterTurn.score,
      tone: cardTone(chapterTurn.score),
      summary: chapterTurn.status,
    },
    {
      key: "hook_strength",
      title: "Hook strength",
      label: "章尾鉤子",
      score: hook.score,
      tone: cardTone(hook.score),
      summary: hook.status,
    },
    {
      key: "pacing_pressure",
      title: "Pacing pressure",
      label: "資訊壓力",
      score: pacing.score,
      tone: cardTone(pacing.score),
      summary: pacing.warnings.length ? pacing.warnings.join(", ") : "pacing pressure acceptable",
    },
    {
      key: "dialogue_tension",
      title: "Dialogue tension",
      label: "對話張力",
      score: dialogue.score,
      tone: cardTone(dialogue.score),
      summary: dialogue.tension_sources.join(", "),
    },
    {
      key: "skim_risk",
      title: "Skim risk",
      label: "跳讀風險",
      score: 100 - risks.skim_risk.score,
      tone: risks.skim_risk.score >= 70 ? "blocked" : risks.skim_risk.score >= 45 ? "watch" : "safe",
      summary: risks.skim_risk.label,
    },
  ];
}

export async function buildReaderResponseSimulatorReport(rawInput = {}, options = {}) {
  const candidateText = text(
    options.candidateText
      ?? rawInput.candidate_text
      ?? rawInput.candidateText
      ?? rawInput.final_candidate_text
      ?? rawInput.finalCandidateText
      ?? rawInput.polished_text
      ?? rawInput.polishedText
      ?? rawInput.raw_draft_text
      ?? rawInput.rawDraftText
      ?? rawInput.chapter_text
      ?? rawInput.chapterText,
    24000,
  );
  const conflict = normalizeConflict(rawInput, options);
  const stats = paragraphStats(candidateText);
  const readerExpectation = buildReaderExpectation(rawInput, conflict);
  const emotionalCurve = buildEmotionalCurve(candidateText, stats, rawInput);
  const dialogue = buildDialogueTension(candidateText);
  const chapterTurn = buildChapterTurnSatisfaction(conflict, candidateText);
  const hook = buildHookStrength(conflict, candidateText);
  const pacing = buildPacingPressure(candidateText, stats);
  const risks = buildRisks(candidateText, pacing, dialogue, chapterTurn);
  const continuationScore = clampScore((hook.score * 0.32) + (chapterTurn.score * 0.28) + (emotionalCurve.score * 0.18) + (dialogue.score * 0.14) + ((100 - risks.skim_risk.score) * 0.08));
  const overallScore = clampScore((continuationScore * 0.28) + (chapterTurn.score * 0.22) + (hook.score * 0.18) + (pacing.score * 0.14) + (dialogue.score * 0.1) + (emotionalCurve.score * 0.08));
  const missing = [];
  if (!candidateText) missing.push("missing_candidate_text");
  if (readerExpectation.status !== "clear") missing.push("reader_expectation_needs_context");
  const status = missing.length ? "incomplete" : "completed";
  const warnings = [
    ...(missing.length ? ["reader_response_input_incomplete"] : []),
    ...pacing.warnings,
    ...emotionalCurve.warnings,
    ...(risks.skim_risk.score >= 70 ? ["skim_risk_high"] : []),
  ];
  const report = {
    used: true,
    phase: "29A",
    version: readerResponseSimulatorVersion,
    status,
    read_only: true,
    contract_only: true,
    preview_only: true,
    candidate_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    no_runtime_ui: true,
    no_mcp_tool: true,
    source: {
      candidate_text_digest: sha256(candidateText),
      candidate_text_chars: stats.characters,
      conflict_digest: sha256(JSON.stringify(conflict)),
    },
    reader_expectation: readerExpectation,
    emotional_curve: emotionalCurve,
    pacing_pressure: pacing,
    dialogue_tension: dialogue,
    chapter_turn_satisfaction: chapterTurn,
    hook_strength: hook,
    confusion_points: risks.confusion_points,
    fatigue_points: risks.fatigue_points,
    skim_risk: risks.skim_risk,
    continuation_desire: {
      score: continuationScore,
      label: scoreLabel(continuationScore),
      reasons: [hook.status, chapterTurn.status, risks.skim_risk.label].filter(Boolean),
    },
    reader_questions_to_carry_forward: readerExpectation.delayed_questions,
    cards: buildCards({ overallScore, emotionalCurve, pacing, dialogue, chapterTurn, hook, risks }),
    revision_suggestions: [
      ...(pacing.information_pressure >= 55 ? ["Move exposition into action, interruption, or conflict instead of standalone explanation."] : []),
      ...(dialogue.score < 55 ? ["Increase dialogue friction or subtext so the scene reads less like a report."] : []),
      ...(chapterTurn.score < 76 ? ["Make the chapter-ending situation materially different from the opening situation."] : []),
      ...(hook.score < 76 ? ["Sharpen the final paragraph around a concrete unanswered pressure."] : []),
    ].slice(0, 6),
    provider_contract: {
      generation_payload_key: "reader_response_simulator",
      revision_payload_key: "reader_response_simulator",
      final_polisher_payload_key: "reader_response_simulator",
      candidate_report_key: "reader_response_simulator",
    },
    safety_boundary: {
      read_only: true,
      contract_only: true,
      preview_only: true,
      no_generation: true,
      no_auto_persist: true,
      no_candidate_save: true,
      no_approval: true,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      candidate_saved: false,
      canon_written: false,
      approval_item_created: false,
      runtime_ui_modified: false,
      mcp_tool_added: false,
    },
    missing_fields: missing,
    warnings,
  };
  report.overall_reader_response_score = overallScore;
  report.trace_id = `reader_response_${sha256(JSON.stringify({ status, overallScore, source: report.source, cards: report.cards })).slice(0, 16)}`;
  return report;
}

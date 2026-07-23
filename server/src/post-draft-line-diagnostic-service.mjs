import { createHash } from "node:crypto";

export const postDraftLineDiagnosticVersion =
  "phase50c-post-draft-line-diagnostic-v1";

const MAX_FINDINGS = 12;
const MAX_QUOTE_CHARS = 180;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactText(value, maxChars = 360) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxChars) : null;
}

function stringArray(value, maxItems = 16, maxChars = 240) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => compactText(item, maxChars))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function draftText(capabilityInput = {}) {
  const value = capabilityInput.draft_text ?? capabilityInput.raw_draft_text;
  if (typeof value !== "string" || !value.trim()) return null;
  if (value.length > 250000) {
    throw new RangeError("draft_text exceeds the 250000 character diagnostic limit.");
  }
  return value;
}

function draftLines(draft) {
  return String(draft ?? "")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((text, index) => ({ number: index + 1, text }));
}

function quoteFor(text, matchText = null) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return "";
  if (!matchText || trimmed.length <= MAX_QUOTE_CHARS) {
    return trimmed.slice(0, MAX_QUOTE_CHARS);
  }
  const index = trimmed.indexOf(matchText);
  if (index < 0) return trimmed.slice(0, MAX_QUOTE_CHARS);
  const padding = 48;
  const start = Math.max(0, index - padding);
  const end = Math.min(trimmed.length, index + matchText.length + padding);
  return `${start > 0 ? "…" : ""}${trimmed.slice(start, end)}${end < trimmed.length ? "…" : ""}`;
}

function dialogueCharacter(text) {
  const match = String(text ?? "").match(/^\s*([^：:\s「『“"]{1,24})\s*[：:]\s*[「『“"]/u);
  return match?.[1]?.trim() ?? null;
}

function lineEvidence(line, matchText = null) {
  const raw = String(line.text ?? "");
  const matchIndex = matchText ? raw.indexOf(matchText) : -1;
  const firstNonSpace = raw.search(/\S/u);
  const columnStart = matchIndex >= 0
    ? matchIndex + 1
    : Math.max(1, firstNonSpace + 1);
  const evidenceLength = Math.max(1, String(matchText ?? raw.trim()).length);
  return {
    line_start: line.number,
    line_end: line.number,
    line_reference: `L${line.number}`,
    column_start: columnStart,
    column_end: columnStart + evidenceLength - 1,
    quote: quoteFor(raw, matchText),
  };
}

function findingKey(finding) {
  return [
    finding.issue_type,
    finding.line_start,
    finding.line_end,
    finding.character ?? "",
    finding.quote,
  ].join("\u0000");
}

function pushFinding(output, seen, finding) {
  if (output.length >= MAX_FINDINGS) return;
  const key = findingKey(finding);
  if (seen.has(key)) return;
  seen.add(key);
  output.push({
    finding_id: `F${String(output.length + 1).padStart(2, "0")}`,
    ...finding,
  });
}

function exactMatchFindings(lines, constraints, output, seen) {
  for (const constraint of constraints) {
    if (output.length >= MAX_FINDINGS) break;
    if (!isObject(constraint)) continue;
    const match = compactText(
      constraint.match ?? constraint.forbidden_text ?? constraint.phrase,
      240,
    );
    if (!match || match.length < 2) continue;
    for (const line of lines) {
      if (!line.text.includes(match)) continue;
      pushFinding(output, seen, {
        ...lineEvidence(line, match),
        issue_type: compactText(constraint.issue_type, 80)
          ?? "explicit_constraint_conflict",
        severity: compactText(constraint.severity, 24) ?? "hard",
        character: compactText(constraint.character, 80)
          ?? dialogueCharacter(line.text),
        reason: compactText(constraint.reason, 420)
          ?? "The exact draft text conflicts with an explicit supplied constraint.",
        must_fix: constraint.must_fix !== false,
        minimal_direction: compactText(constraint.minimal_direction, 360)
          ?? "Remove or minimally replace only the conflicting wording; preserve the surrounding action and cadence.",
        confidence: "exact_match",
      });
    }
  }
}

function forbiddenPhrasesFromPrompt(taskPrompt, capabilityInput) {
  const direct = [
    ...stringArray(capabilityInput.forbidden_content),
    ...stringArray(capabilityInput.prohibited_phrases),
    ...stringArray(capabilityInput.do_not_include),
  ];
  const prompt = String(taskPrompt ?? "");
  const quotedDirectivePattern = /(?:禁止|不得|不可|不要|避免)\s*[：:]?\s*[「『“"]([^」』”"]{2,40})[」』”"]/gu;
  for (const match of prompt.matchAll(quotedDirectivePattern)) {
    const phrase = compactText(match[1], 40);
    if (phrase) direct.push(phrase);
  }
  const directivePattern = /(?:禁止|不得|不可|不要|避免)\s*[：:]?\s*([^，。；;\n]{2,40})/gu;
  for (const match of prompt.matchAll(directivePattern)) {
    let phrase = compactText(match[1], 40);
    if (!phrase) continue;
    phrase = phrase
      .replace(/(?:這類|相關)?術語(?:進入|出現在)?正文.*$/u, "")
      .replace(/(?:進入|出現在)正文.*$/u, "")
      .trim();
    if (phrase.length >= 2) direct.push(phrase);
  }
  return [...new Set(direct)].slice(0, 20);
}

function turnStates(capabilityInput) {
  const values = capabilityInput.character_turn_states
    ?? capabilityInput.generation_card?.character_turn_states
    ?? capabilityInput.character_states;
  if (Array.isArray(values)) return values.filter(isObject).slice(0, 12);
  if (isObject(values)) return [values];
  if (isObject(capabilityInput.character_state)) return [capabilityInput.character_state];
  return [];
}

function dialogueLinesForCharacter(lines, character) {
  if (!character) return [];
  return lines.filter((line) => dialogueCharacter(line.text) === character);
}

function boundaryFindings(lines, capabilityInput, output, seen) {
  for (const state of turnStates(capabilityInput)) {
    if (output.length >= MAX_FINDINGS) break;
    const character = compactText(state.character, 80);
    if (!character) continue;
    const characterDialogue = dialogueLinesForCharacter(lines, character);
    const guessed = stringArray(state.guessed);
    const withheld = stringArray(state.refuses_to_admit);
    const forbiddenSpeech = [
      ...stringArray(state.forbidden_speech),
      ...stringArray(state.speech_ceiling?.forbidden_content),
    ];
    const speechCeiling = typeof state.speech_ceiling === "string"
      ? state.speech_ceiling
      : null;
    if (speechCeiling) {
      const ceilingMatch = speechCeiling.match(/(?:不能說|不可說|不得說|避免說出|不會承認)\s*[：:]?\s*([^，。；;\n]{2,40})/u);
      if (ceilingMatch?.[1]) forbiddenSpeech.push(ceilingMatch[1].trim());
    }

    for (const phrase of withheld) {
      for (const line of characterDialogue) {
        if (!line.text.includes(phrase)) continue;
        pushFinding(output, seen, {
          ...lineEvidence(line, phrase),
          issue_type: "admission_boundary_violation",
          severity: "hard",
          character,
          reason: "The character says content explicitly marked as something they refuse to admit in this turn.",
          must_fix: true,
          minimal_direction: "Keep the refusal intact. Replace only the revealing words with a shorter dodge, pause, or visible action.",
          confidence: "exact_match",
        });
      }
    }

    for (const phrase of guessed) {
      for (const line of characterDialogue) {
        if (!line.text.includes(phrase)) continue;
        pushFinding(output, seen, {
          ...lineEvidence(line, phrase),
          issue_type: "knowledge_boundary_violation",
          severity: "hard",
          character,
          reason: "A guess is spoken as settled knowledge without new evidence in the supplied turn state.",
          must_fix: true,
          minimal_direction: "Restore uncertainty in only this line, or make the character test the guess instead of asserting it.",
          confidence: "exact_match",
        });
      }
    }

    for (const phrase of [...new Set(forbiddenSpeech)]) {
      if (!phrase || phrase.length < 2) continue;
      for (const line of characterDialogue) {
        if (!line.text.includes(phrase)) continue;
        pushFinding(output, seen, {
          ...lineEvidence(line, phrase),
          issue_type: "speech_ceiling_violation",
          severity: "hard",
          character,
          reason: "The dialogue crosses the supplied speech ceiling for this single turn.",
          must_fix: true,
          minimal_direction: "Cut the disclosure at the ceiling. Preserve the character's immediate goal and leave the omitted part unspoken.",
          confidence: "exact_match",
        });
      }
    }
  }
}

function canonIdentityFindings(lines, characterHardFacts, output, seen) {
  const facts = Array.isArray(characterHardFacts) ? characterHardFacts : [];
  for (const fact of facts.slice(0, 16)) {
    if (output.length >= MAX_FINDINGS) break;
    const name = compactText(fact?.canonical_name, 80);
    const gender = compactText(fact?.gender, 40)?.toLowerCase();
    if (!name || !gender) continue;
    const wrongPronoun = /(?:female|woman|girl|女性|女)/u.test(gender)
      ? "他"
      : /(?:male|man|boy|男性|男)/u.test(gender)
        ? "她"
        : null;
    if (!wrongPronoun) continue;
    const patternA = `${name}${wrongPronoun}`;
    const patternB = `${wrongPronoun}${name}`;
    for (const line of lines) {
      const matched = line.text.includes(patternA)
        ? patternA
        : line.text.includes(patternB)
          ? patternB
          : null;
      if (!matched) continue;
      pushFinding(output, seen, {
        ...lineEvidence(line, matched),
        issue_type: "canon_identity_conflict",
        severity: "hard",
        character: name,
        reason: "The pronoun in this exact line conflicts with the supplied Canon identity fact.",
        must_fix: true,
        minimal_direction: "Correct only the conflicting pronoun or reference. Do not rewrite the surrounding sentence.",
        confidence: "exact_match",
      });
    }
  }
}

function hardConstraintFindings(lines, capabilityInput, output, seen) {
  const structured = [
    ...(Array.isArray(capabilityInput.exact_conflicts)
      ? capabilityInput.exact_conflicts
      : []),
    ...(Array.isArray(capabilityInput.hard_constraints)
      ? capabilityInput.hard_constraints.filter(isObject)
      : []),
  ];
  exactMatchFindings(lines, structured, output, seen);
}

const canonCompatibilityIssueTypes = new Set([
  "character_affiliation_conflict",
  "location_access_conflict",
  "unexplained_cross_organization_presence",
  "timeline_presence_conflict",
  "character_status_presence_conflict",
  "misidentified_organization_membership",
  "ability_or_weapon_ownership_conflict",
  "exclusive_organization_role_conflict",
  "exclusive_relationship_conflict",
  "closed_historical_event_participation_conflict",
]);

function structuredCanonCompatibilityFindings(
  lines,
  capabilityInput,
  output,
  seen,
) {
  const sceneFindings = Array.isArray(
    capabilityInput.scene_compatibility?.findings,
  )
    ? capabilityInput.scene_compatibility.findings
    : [];
  const candidates = [
    ...sceneFindings,
    ...(Array.isArray(capabilityInput.structured_hard_conflict_candidates)
      ? capabilityInput.structured_hard_conflict_candidates
      : []),
  ];
  for (const candidate of candidates) {
    if (!isObject(candidate) || output.length >= MAX_FINDINGS) break;
    if (!["requires_justification", "hard_conflict"].includes(candidate.status)) {
      continue;
    }
    const issueType = canonCompatibilityIssueTypes.has(candidate.issue_type)
      ? candidate.issue_type
      : candidate.status === "requires_justification"
        ? "unexplained_cross_organization_presence"
        : "character_affiliation_conflict";
    const character = compactText(
      candidate.character_name ?? candidate.character,
      80,
    );
    const suppliedEvidence = Array.isArray(candidate.exact_line_evidence)
      ? candidate.exact_line_evidence[0]
      : null;
    const suppliedLine = Number.isInteger(suppliedEvidence?.line_start)
      ? lines[suppliedEvidence.line_start - 1]
      : null;
    const matchingLine = suppliedLine
      ?? lines.find((line) => (
        character && line.text.includes(character)
      ));
    if (!matchingLine) continue;
    const severity = candidate.issue_type === "timeline_presence_conflict"
      ? "P0"
      : "P1";
    pushFinding(output, seen, {
      ...lineEvidence(matchingLine, character),
      issue_type: issueType,
      severity,
      character,
      affiliation: compactText(candidate.affiliation, 120),
      scene_location: compactText(candidate.scene_location, 160),
      access_level: compactText(candidate.access_level, 40),
      reason: compactText(candidate.reason, 420)
        ?? "The structured Canon compatibility audit found a location, affiliation, timeline, status, or ownership conflict.",
      must_fix: true,
      minimal_direction: candidate.status === "requires_justification"
        ? "Add or establish a valid access or cross-organization basis without changing the selected character or scene."
        : "Correct only the conflicting Canon identity, access, timeline, status, or ownership assertion.",
      confidence: candidate.status === "hard_conflict"
        ? "structured_canon_conflict"
        : "structured_grounding_missing",
      canon_evidence: Array.isArray(candidate.canon_evidence)
        ? candidate.canon_evidence.slice(0, 12)
        : [],
    });
  }
}

function explicitRequirementFindings(lines, taskPrompt, capabilityInput, output, seen) {
  const phrases = forbiddenPhrasesFromPrompt(taskPrompt, capabilityInput);
  exactMatchFindings(
    lines,
    phrases.map((phrase) => ({
      match: phrase,
      issue_type: "explicit_user_requirement_violation",
      severity: "hard",
      reason: "The exact wording appears in the draft despite an explicit prohibition supplied for this writing task.",
      must_fix: true,
      minimal_direction: "Remove only the prohibited element while preserving the event, character intent, and local rhythm.",
    })),
    output,
    seen,
  );
}

function summary(findings) {
  return {
    finding_count: findings.length,
    must_fix_count: findings.filter((finding) => finding.must_fix).length,
    advisory_count: findings.filter((finding) => !finding.must_fix).length,
    exact_line_evidence_only: true,
  };
}

function inactiveResult(resultType, extra = {}) {
  return {
    result_type: resultType,
    status: "inactive",
    diagnostic_version: postDraftLineDiagnosticVersion,
    analysis_phase: "pre_generation_compatibility",
    analysis_status: "inactive_without_draft_evidence",
    draft_evidence_status: "not_available_pre_generation",
    findings: [],
    summary: summary([]),
    release_recommendation: "no_post_draft_judgment_without_draft",
    evidence_only: true,
    ...extra,
  };
}

export function buildPostDraftNeuralCritique({
  taskPrompt = "",
  capabilityInput = {},
  characterHardFacts = [],
} = {}) {
  const draft = draftText(capabilityInput);
  if (!draft) {
    return inactiveResult("neural_critique", {
      hard_risks: [],
      hard_risk_scope: [
        "canon",
        "causality",
        "identity",
        "character_state",
        "timeline",
        "explicit_user_requirement",
      ],
    });
  }

  const lines = draftLines(draft);
  const findings = [];
  const seen = new Set();
  hardConstraintFindings(lines, capabilityInput, findings, seen);
  structuredCanonCompatibilityFindings(
    lines,
    capabilityInput,
    findings,
    seen,
  );
  explicitRequirementFindings(lines, taskPrompt, capabilityInput, findings, seen);
  boundaryFindings(lines, capabilityInput, findings, seen);
  canonIdentityFindings(
    lines,
    capabilityInput.character_hard_facts ?? characterHardFacts,
    findings,
    seen,
  );
  const diagnosticSummary = summary(findings);
  return {
    result_type: "neural_critique",
    diagnostic_version: postDraftLineDiagnosticVersion,
    analysis_phase: "post_generation_diagnostic",
    analysis_status: "exact_line_review_complete",
    draft_evidence_status: "draft_available",
    draft_sha256: sha256(draft),
    draft_line_count: lines.length,
    findings,
    draft_entity_audit:
      capabilityInput.draft_entity_audit ?? null,
    draft_canon_coverage:
      capabilityInput.draft_canon_coverage ?? null,
    scene_compatibility:
      capabilityInput.scene_compatibility ?? null,
    post_draft_diagnostic_composition:
      capabilityInput.post_draft_diagnostic_composition ?? null,
    hard_risks: findings.filter((finding) => finding.must_fix).map((finding) => ({
      finding_id: finding.finding_id,
      line_reference: finding.line_reference,
      issue_type: finding.issue_type,
    })),
    summary: diagnosticSummary,
    release_recommendation: diagnosticSummary.must_fix_count > 0
      ? "minimal_targeted_revision_required"
      : "release_as_is_from_hard_risk_review",
    evidence_only: true,
    hard_risk_scope: [
      "canon",
      "causality",
      "identity",
      "character_state",
      "timeline",
      "explicit_user_requirement",
    ],
  };
}

const workflowLeakPattern = /(?:Writer\s*Workbench|active_engine|compressed_rules|approval\s*queue|candidate|settlement|Canon\s*資料庫|主核對表|神經模組|治理契約|候選流程|結算流程)/iu;
const subtextExplanationPattern = /(?:真正想說的是|沒有說出口的是|這意味著|那代表著|其實他想表達|其實她想表達|這正是[^，。]{0,20}的意義)/u;
const genericEmotionPattern = /(?:感到|感覺到|心中(?:湧起|泛起)|內心充滿)(?:一陣|一股|些許|無比)?(?:悲傷|難過|憤怒|生氣|緊張|害怕|安心|幸福|感動|不安|寂寞)/u;
const thesisPattern = /(?:這證明了|由此可見|說到底|歸根究柢|這就是[^，。]{0,24}的意義|他終於明白了人生|她終於明白了人生)/u;
const tidyEndingPattern = /(?:一切才剛開始|未來仍然漫長|他們終於找到了答案|她們終於找到了答案|這段旅程也終於畫下句點|新的篇章就此展開)[。！？!?]?$/u;
const abstractTerms = [
  "意義", "本質", "關係", "情緒", "感情", "命運", "人生", "成長", "選擇", "答案", "未來", "靈魂",
];

function styleFinding(output, seen, line, detail) {
  pushFinding(output, seen, {
    ...lineEvidence(line, detail.matchText ?? null),
    issue_type: detail.issueType,
    severity: detail.severity ?? "advisory",
    character: dialogueCharacter(line.text),
    reason: detail.reason,
    must_fix: detail.mustFix === true,
    minimal_direction: detail.minimalDirection,
    confidence: detail.confidence ?? "pattern_evidence",
  });
}

function repeatedOpeningFindings(lines, output, seen) {
  const nonEmpty = lines.filter((line) => line.text.trim().length >= 4);
  for (let index = 0; index <= nonEmpty.length - 3; index += 1) {
    const group = nonEmpty.slice(index, index + 3);
    const openings = group.map((line) => line.text.trim().slice(0, 2));
    if (!openings[0] || !openings.every((opening) => opening === openings[0])) continue;
    const line = group[1];
    styleFinding(output, seen, line, {
      matchText: openings[0],
      issueType: "repeated_sentence_opening",
      reason: "Three consecutive non-empty lines begin with the same wording, creating a visible template rhythm.",
      minimalDirection: "Change only one opening or merge one beat. Keep the underlying actions and order intact.",
    });
  }
}

function stylePatternFindings(lines, output, seen) {
  for (const line of lines) {
    if (output.length >= MAX_FINDINGS) break;
    const text = line.text.trim();
    if (!text) continue;
    const workflow = text.match(workflowLeakPattern)?.[0];
    if (workflow) {
      styleFinding(output, seen, line, {
        matchText: workflow,
        issueType: "workflow_language_leak",
        severity: "hard",
        reason: "Control-plane or Writer Workbench terminology appears inside story prose.",
        mustFix: true,
        minimalDirection: "Delete only the workflow terminology or replace it with the concrete in-world action it was trying to describe.",
        confidence: "exact_match",
      });
    }
    const subtext = text.match(subtextExplanationPattern)?.[0];
    if (subtext) {
      styleFinding(output, seen, line, {
        matchText: subtext,
        issueType: "subtext_explicitly_explained",
        reason: "The narration states the hidden meaning instead of letting the line, pause, or action carry it.",
        minimalDirection: "Remove the explanatory clause only. Keep the observable gesture, dialogue, or silence that already carries the meaning.",
      });
    }
    const emotion = text.match(genericEmotionPattern)?.[0];
    if (emotion) {
      styleFinding(output, seen, line, {
        matchText: emotion,
        issueType: "generic_emotion_label",
        reason: "The sentence names an emotion generically where the surrounding physical or verbal evidence can carry it.",
        minimalDirection: "Replace only the generic label with one concrete bodily, spatial, or behavioral consequence already plausible in the scene.",
      });
    }
    const thesis = text.match(thesisPattern)?.[0];
    if (thesis) {
      styleFinding(output, seen, line, {
        matchText: thesis,
        issueType: "authorial_thesis_intrusion",
        reason: "The sentence closes interpretation for the reader in proposition-like language.",
        minimalDirection: "Cut the thesis statement and end on the nearest concrete event, image, or unfinished reaction.",
      });
    }
    const abstractCount = abstractTerms.filter((term) => text.includes(term)).length;
    if (abstractCount >= 3 && text.length >= 28) {
      styleFinding(output, seen, line, {
        issueType: "abstract_explanation_cluster",
        reason: "Several abstract concepts accumulate in one line, pulling the prose away from the characters' immediate lived event.",
        minimalDirection: "Keep at most one necessary abstract term and anchor the rest in one concrete action or sensory consequence.",
      });
    }
  }
}

function endingFinding(lines, output, seen) {
  const last = [...lines].reverse().find((line) => line.text.trim());
  if (!last) return;
  const matched = last.text.trim().match(tidyEndingPattern)?.[0];
  if (!matched) return;
  styleFinding(output, seen, last, {
    matchText: matched,
    issueType: "meaning_closed_ending",
    reason: "The final line announces closure or uplift instead of ending on the chapter's last concrete change.",
    minimalDirection: "Remove the announced meaning and stop on the nearest concrete action, consequence, or unresolved response.",
  });
}

export function buildPostDraftStyleDriftReport({
  taskPrompt = "",
  capabilityInput = {},
} = {}) {
  const draft = draftText(capabilityInput);
  if (!draft) {
    return inactiveResult("style_drift_report", {
      pre_generation_status: "inactive_without_draft_evidence",
    });
  }
  const lines = draftLines(draft);
  const findings = [];
  const seen = new Set();
  stylePatternFindings(lines, findings, seen);
  repeatedOpeningFindings(lines, findings, seen);
  endingFinding(lines, findings, seen);
  const diagnosticSummary = summary(findings);
  return {
    result_type: "style_drift_report",
    diagnostic_version: postDraftLineDiagnosticVersion,
    analysis_phase: "post_generation_diagnostic",
    analysis_status: "exact_line_review_complete",
    draft_evidence_status: "draft_available",
    pre_generation_status: "draft_evidence_supplied",
    draft_sha256: sha256(draft),
    draft_line_count: lines.length,
    findings,
    summary: diagnosticSummary,
    release_recommendation: diagnosticSummary.must_fix_count > 0
      ? "minimal_targeted_revision_required"
      : diagnosticSummary.finding_count > 0
        ? "advisory_minimal_revision_only"
        : "release_as_is_from_style_review",
    evidence_only: true,
  };
}

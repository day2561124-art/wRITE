import { createHash } from "node:crypto";

const canonicalPreservedConstraints = [
  "canon_facts",
  "causal_continuity",
  "character_identity_and_state",
  "battle_result",
  "timeline",
  "explicit_user_requirements",
];

function sha256(value) {
  return createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex");
}

function objectOrNull(value) {
  return value
    && typeof value === "object"
    && !Array.isArray(value)
      ? value
      : null;
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
}) {
  return {
    revision_scope: revisionScope,
    changed_dimensions: unique(changedDimensions),
    preserved_constraints: canonicalPreservedConstraints,
    risk_flags: unique(riskFlags),
    raw_draft_hash:
      rawDraftText ? sha256(rawDraftText) : "",
    polished_text_hash:
      polishedText ? sha256(polishedText) : "",
    structural_gate: structuralGate,
    canon_preservation_pass: pass(),
    character_voice_pass: pass("not_evaluated"),
    human_diction_pass: pass("not_evaluated"),
    prose_texture_pass: pass("not_evaluated"),
    over_polishing_guard: pass("not_evaluated"),
  };
}

function normalizeForcedReasons(signals) {
  const normalized = objectOrNull(signals) ?? {};
  const reasons =
    normalized.block_reasons
    ?? normalized.blockReasons
    ?? [];

  if (!Array.isArray(reasons)) {
    return [];
  }

  return reasons
    .map((reason) => String(reason ?? "").trim())
    .filter(Boolean);
}

function evaluateStructuralGate(rawDraftText, input) {
  const structuralSignals = objectOrNull(
    input.structural_signals
    ?? input.structuralSignals,
  );
  const reasons =
    normalizeForcedReasons(structuralSignals);

  const techniqueOnlyReasons = new Set([
    "missing_chapter_turn",
    "missing_scene_function",
    "missing_ending_event_hook",
    "ending_hook_is_pretty_sentence_only",
    "battle_payment_insufficient",
  ]);

  const hardReasons = reasons.filter(
    (reason) => !techniqueOnlyReasons.has(reason),
  );

  const hasExplicitCanonDeclaration =
    /(?:this chapter|this text|canon)[^.!?\n]{0,40}(?:sets?|defines?|declares?)[^.!?\n]{0,40}(?:new|gains?|awakens?|becomes?)[^.!?\n]{0,40}(?:ability|identity|bloodline|relationship|world rule)/iu.test(
      rawDraftText,
    )
    || /(?:\u9019\u4e00\u7ae0|\u672c\u7ae0|\u672c\u6587|\u6b64\u7ae0|\u6b63\u53f2|canon)[^\u3002\uff01\uff1f\n]{0,40}(?:\u6b63\u5f0f)?(?:\u8a2d\u5b9a|\u5b9a\u7fa9|\u5ba3\u544a)[^\u3002\uff01\uff1f\n]{0,40}(?:\u65b0\u589e|\u7372\u5f97|\u89ba\u9192|\u64c1\u6709|\u6539\u70ba|\u6210\u70ba)[^\u3002\uff01\uff1f\n]{0,40}(?:\u80fd\u529b|\u7570\u80fd\u6b66\u88dd|\u8eab\u5206|\u8840\u7d71|\u95dc\u4fc2|\u4e16\u754c\u898f\u5247)/iu.test(
      rawDraftText,
    )
    || /(?:\u6b63\u5f0f\u8a2d\u5b9a\u70ba|\u6b63\u53f2\u8a2d\u5b9a\u70ba|canon\s*[:\uff1a])[^\u3002\uff01\uff1f\n]{0,80}/iu.test(
      rawDraftText,
    );

  if (hasExplicitCanonDeclaration) {
    hardReasons.push("unauthorized_new_canon_claim");
  }

  const uniqueReasons = unique(hardReasons);

  if (uniqueReasons.length > 0) {
    return pass("blocked", {
      blocked: true,
      reasons: uniqueReasons,
      suggested_return_stage:
        "writing_card_director",
    });
  }

  return pass("passed", {
    blocked: false,
    reasons: [],
    suggested_return_stage: null,
  });
}

export function runFinalPolisherEditorialBrain(
  rawInput = {},
  options = {},
) {
  if (
    !rawInput
    || typeof rawInput !== "object"
    || Array.isArray(rawInput)
  ) {
    throw new Error("input must be an object.");
  }

  const rawDraftValue =
    rawInput.raw_draft_text ?? rawInput.rawDraftText;
  const rawDraftText =
    typeof rawDraftValue === "string"
      ? rawDraftValue
      : "";

  if (!rawDraftText.trim()) {
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

  const structuralGate =
    evaluateStructuralGate(rawDraftText, rawInput);

  if (structuralGate.blocked === true) {
    const revisionReport = baseRevisionReport({
      revisionScope: "structural_block",
      rawDraftText,
      polishedText: "",
      riskFlags: structuralGate.reasons,
      structuralGate,
    });

    return {
      status: "needs_structural_revision",
      polished_text: "",
      revision_report: revisionReport,
      needs_structural_revision: true,
      suggested_return_stage:
        "writing_card_director",
      writing_pipeline_complete: false,
      warnings: structuralGate.reasons,
    };
  }

  const polishedText = rawDraftText;
  const changedDimensions = [];

  const revisionReport = baseRevisionReport({
    revisionScope: "line_edit",
    rawDraftText,
    polishedText,
    changedDimensions,
    riskFlags: [],
    structuralGate,
  });

  return {
    status: "completed",
    polished_text: polishedText,
    revision_report: revisionReport,
    needs_structural_revision: false,
    suggested_return_stage: null,
    writing_pipeline_complete: true,
    warnings:
      typeof options.editorialAdapter === "function"
        ? ["editorial_adapter_prose_ignored_to_preserve_exact_hash"]
        : [],
  };
}

export default runFinalPolisherEditorialBrain;

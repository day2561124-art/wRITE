import { createHash } from "node:crypto";

export const neuralWritingBrainRequiredModulesContractVersion =
  "neural_writing_brain_required_modules_contract_v1";

export const neuralWritingBrainRequiredModulesDiagnosticsVersion =
  "neural_writing_brain_required_modules_diagnostics_v1";

export const requiredNeuralWritingBrainModules = Object.freeze([
  "one_click_writing_orchestrator",
  "recursive_self_rewrite_loop",
  "character_psychological_state_tracker",
  "dramatic_conflict_tension_manager",
  "reader_experience_simulator",
  "foreshadowing_causality_graph",
  "long_term_aesthetic_memory",
]);

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function sha256Json(value) {
  return createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasObjectEvidence(value) {
  return isObject(value) && Object.keys(value).length > 0;
}

function surfaceStatus(value) {
  if (!isObject(value)) return "";
  return text(
    value.status
    ?? value.final_status
    ?? value.acceptance_status
    ?? value.state
    ?? value.result
    ?? value.outcome
    ?? "",
  );
}

function isDisabledSurface(value) {
  if (!isObject(value)) return false;

  if (value.used === false) return true;
  if (value.enabled === false) return true;
  if (value.included === false) return true;

  const status = surfaceStatus(value);
  if (!status) return false;

  return /disabled|skipped|omitted|not_requested|not_enabled|bypassed|unavailable/iu
    .test(status);
}

function surfaceLoaded(value) {
  return hasObjectEvidence(value) && !isDisabledSurface(value);
}

function surfaceUsed(value) {
  if (!surfaceLoaded(value)) return false;

  if (value.used === true) return true;
  if (value.used === false) return false;

  if (value.ok === true) return true;
  if (value.completed === true) return true;
  if (value.contract_valid === true) return true;

  const status = surfaceStatus(value);
  if (status.length > 0) return true;

  return Object.keys(value).some((key) => {
    if (["used", "enabled", "included"].includes(key)) return false;
    return value[key] !== null && value[key] !== undefined;
  });
}

function surfaceHasEvidence(value) {
  if (!surfaceLoaded(value)) return false;

  const status = surfaceStatus(value);
  if (status.length > 0) return true;

  return Object.keys(value).some((key) => {
    if (["used", "enabled", "included"].includes(key)) return false;
    return value[key] !== null && value[key] !== undefined;
  });
}

function compactEvidence(value) {
  if (!isObject(value)) return null;
  return {
    used: value.used ?? null,
    phase: value.phase ?? null,
    version: value.version ?? null,
    status: value.status ?? value.final_status ?? value.acceptance_status ?? null,
    read_only: value.read_only ?? null,
    candidate_only: value.candidate_only ?? null,
    no_auto_persist: value.no_auto_persist ?? null,
    no_canon_update: value.no_canon_update ?? null,
    no_active_engine_update: value.no_active_engine_update ?? null,
    trace_id: value.trace_id ?? null,
    warnings_count: Array.isArray(value.warnings) ? value.warnings.length : 0,
  };
}

function moduleEntry({
  key,
  label,
  phase,
  source,
  loaded,
  used,
  evidence,
  linkedToFinalCandidate,
  evidenceSurface = null,
}) {
  const missingReasons = [];

  if (loaded !== true) missingReasons.push("not_loaded");
  if (used !== true) missingReasons.push("not_used");
  if (evidence !== true) missingReasons.push("evidence_missing");
  if (linkedToFinalCandidate !== true) missingReasons.push("not_linked_to_final_candidate");

  return {
    key,
    label,
    phase,
    source,
    loaded: loaded === true,
    used: used === true,
    evidence: evidence === true,
    linked_to_final_candidate: linkedToFinalCandidate === true,
    contract_valid:
      loaded === true
      && used === true
      && evidence === true
      && linkedToFinalCandidate === true,
    missing_reasons: missingReasons,
    evidence_hash: evidence === true ? sha256Json(evidenceSurface) : null,
    evidence_summary: evidence === true ? compactEvidence(evidenceSurface) : null,
  };
}

function buildValidationErrors(entries, finalCandidateAvailable) {
  const errors = [];

  if (entries.length !== requiredNeuralWritingBrainModules.length) {
    errors.push("required_brain_modules_count_mismatch");
  }

  if (!finalCandidateAvailable) {
    errors.push("final_candidate_missing_for_brain_contract");
  }

  for (const required of requiredNeuralWritingBrainModules) {
    const entry = entries.find((item) => item.key === required);
    if (!entry) {
      errors.push(`required_brain_module_missing:${required}`);
      continue;
    }

    for (const reason of entry.missing_reasons) {
      errors.push(`required_brain_module_${reason}:${required}`);
    }
  }

  return errors;
}


const missingReasonRequirementLabels = Object.freeze({
  not_loaded: "loaded",
  not_used: "used",
  evidence_missing: "evidence",
  not_linked_to_final_candidate: "linked_to_final_candidate",
});

function missingRequirementLabels(missingReasons = []) {
  return Array.from(new Set(
    missingReasons
      .map((reason) => missingReasonRequirementLabels[reason] ?? reason)
      .filter(Boolean),
  ));
}

function diagnosticActionFor(entry) {
  const key = entry?.key ?? "unknown_module";
  const missing = Array.isArray(entry?.missing_reasons) ? entry.missing_reasons : [];

  if (missing.includes("not_loaded")) {
    return `Enable and load ${key} before rerunning the full neural writing pipeline.`;
  }

  if (missing.includes("not_used")) {
    return `Rerun the full neural writing pipeline with ${key} actively used by the final candidate path.`;
  }

  if (missing.includes("evidence_missing")) {
    return `Attach deterministic evidence for ${key}, then rerun the full neural writing pipeline.`;
  }

  if (missing.includes("not_linked_to_final_candidate")) {
    return `Link ${key} evidence to the final candidate decision before allowing chat output.`;
  }

  return `Inspect ${key} required brain module evidence before rerunning.`;
}

function diagnosticStatusFor(contractValid) {
  return contractValid
    ? "required_brain_modules_diagnostics_clear"
    : "blocked_required_brain_modules_diagnostics_available";
}

export function buildNeuralWritingBrainRequiredModulesDiagnostics(contract = {}) {
  const entries = Array.isArray(contract.required_brain_module_entries)
    ? contract.required_brain_module_entries
    : [];
  const validationErrors = Array.isArray(contract.validation_errors)
    ? contract.validation_errors
    : [];
  const missingRequiredBrainModules = Array.isArray(contract.missing_required_brain_modules)
    ? contract.missing_required_brain_modules
    : [];

  const blockedModuleDiagnostics = entries
    .filter((entry) => entry?.contract_valid !== true)
    .map((entry) => {
      const missingReasons = Array.isArray(entry.missing_reasons)
        ? entry.missing_reasons
        : [];
      const missingRequirements = missingRequirementLabels(missingReasons);

      return {
        key: entry.key,
        label: entry.label,
        phase: entry.phase,
        source: entry.source,
        loaded: entry.loaded === true,
        used: entry.used === true,
        evidence: entry.evidence === true,
        linked_to_final_candidate: entry.linked_to_final_candidate === true,
        missing_reasons: missingReasons,
        missing_requirements: missingRequirements,
        readable_issue:
          `${entry.key} is missing required contract fields: ${missingRequirements.join(", ") || "unknown"}.`,
        recommended_operator_action: diagnosticActionFor(entry),
        evidence_hash: entry.evidence_hash ?? null,
        evidence_summary: entry.evidence_summary ?? null,
      };
    });

  const contractValid = contract.contract_valid === true;
  const blockedModuleCount = blockedModuleDiagnostics.length;
  const finalCandidateAvailable = contract.final_candidate_available === true;

  const checklist = contractValid
    ? [
      "All seven required brain modules are loaded.",
      "All seven required brain modules are used.",
      "All seven required brain modules have deterministic evidence.",
      "All seven required brain modules are linked to the final candidate.",
      "Final candidate output may be emitted exactly as provided.",
    ]
    : [
      "Do not output final_candidate_text.",
      "Inspect blocked_module_diagnostics.",
      "Enable or repair every missing required brain module.",
      "Rerun the full neural writing pipeline.",
      "Only emit final_candidate_text after diagnostics report zero blocked modules.",
    ];

  const missingText = missingRequiredBrainModules.length
    ? missingRequiredBrainModules.join(", ")
    : "none";

  const reasonText = blockedModuleDiagnostics
    .flatMap((item) => item.missing_reasons.map((reason) => `${item.key}:${reason}`))
    .join(", ");

  const summaryForChat = contractValid
    ? "Neural writing brain required modules diagnostics clear. All seven required brain modules are loaded, used, evidenced, and linked to the final candidate."
    : `Neural writing brain required modules contract invalid. ChatGPT must not output story text. Missing/invalid required brain modules: ${missingText}. Failing checks: ${reasonText || validationErrors.join(", ") || "unknown"}.`;

  const summaryForOperator = contractValid
    ? "Phase36B diagnostics found no blocked required brain modules."
    : `Phase36B diagnostics found ${blockedModuleCount} blocked required brain module(s). Repair every blocked module before final output.`;

  return {
    used: true,
    phase: "36B",
    surface_kind: "neural_writing_brain_required_modules_operator_diagnostics",
    version: neuralWritingBrainRequiredModulesDiagnosticsVersion,
    status: diagnosticStatusFor(contractValid),
    contract_valid: contractValid,
    diagnostics_valid: true,
    can_emit_final_output: contractValid,
    can_output_to_chat: contractValid,
    may_output_story_text: contractValid,
    must_block_final_output_when_invalid: true,
    blocked: !contractValid,
    blocked_reason: contractValid ? null : "required_brain_modules_contract_invalid",

    summary_for_chat: summaryForChat,
    summary_for_operator: summaryForOperator,
    first_operator_action: contractValid
      ? null
      : blockedModuleDiagnostics[0]?.recommended_operator_action
        ?? "Inspect neural writing brain required modules diagnostics before rerunning.",

    required_brain_modules_count:
      Number.isInteger(contract.required_brain_modules_count)
        ? contract.required_brain_modules_count
        : requiredNeuralWritingBrainModules.length,
    missing_required_brain_modules: missingRequiredBrainModules,
    validation_errors: validationErrors,
    blocked_module_count: blockedModuleCount,
    blocked_module_diagnostics: blockedModuleDiagnostics,
    diagnostic_checklist_for_operator: checklist,

    final_candidate_available: finalCandidateAvailable,
    final_candidate_hash: contract.final_candidate_hash ?? null,
    final_candidate_decision: contract.final_candidate_decision ?? null,
    final_candidate_decision_source: contract.final_candidate_decision_source ?? null,

    safety: {
      candidate_only: true,
      no_candidate_save: true,
      no_approval: true,
      no_adoption: true,
      no_canon_update: true,
      no_active_engine_update: true,
      can_modify_active_engine: false,
      can_update_canon: false,
      can_confirm_adoption: false,
    },
  };
}

export function buildNeuralWritingBrainRequiredModulesContract(payload = {}) {
  const pipeline = payload.pipeline_result ?? payload.pipelineResult ?? {};
  const readerResponse = payload.reader_response_simulator ?? payload.readerResponseSimulator ?? {};
  const aestheticMemory = payload.aesthetic_memory_context ?? payload.aestheticMemoryContext ?? {};
  const workflow = payload.workflow ?? {};
  const finalCandidateText = text(payload.final_candidate_text ?? payload.finalCandidateText ?? pipeline.final_candidate_text);
  const finalCandidateHash = text(payload.final_candidate_hash ?? payload.finalCandidateHash ?? pipeline.final_candidate_hash);
  const finalCandidateAvailable = finalCandidateText.length > 0 && finalCandidateHash.length > 0;
  const linkedToFinalCandidate = finalCandidateAvailable;

  const recursiveRevision = pipeline.recursive_revision ?? {};
  const recursiveRevisionStatus = surfaceStatus(recursiveRevision);
  const recursiveRevisionUsed =
    surfaceUsed(recursiveRevision)
    || ["not_needed", "revised", "failed", "completed"].includes(recursiveRevisionStatus)
    || Number.isInteger(recursiveRevision.rounds_attempted);
  const recursiveRevisionLoaded =
    hasObjectEvidence(recursiveRevision)
    && recursiveRevisionStatus.length > 0
    && !["disabled", "not_started"].includes(recursiveRevisionStatus);
  const recursiveRevisionEvidence =
    recursiveRevisionLoaded
    && (
      surfaceHasEvidence(recursiveRevision)
      || ["not_needed", "revised", "completed", "failed"].includes(recursiveRevisionStatus)
      || Number.isInteger(recursiveRevision.rounds_attempted)
    );

  const oneClickEvidence = {
    used: payload.single_entry_bridge === true || payload.one_click_writing_orchestrator_used === true,
    phase: "34A-36A",
    version: payload.single_entry_bridge_version ?? null,
    status: payload.single_entry_status ?? pipeline.status ?? null,
    workflow,
    pipeline_stage: pipeline.pipeline_stage ?? null,
  };

  const entries = [
    moduleEntry({
      key: "one_click_writing_orchestrator",
      label: "完整一鍵寫作總控",
      phase: "34A-36A",
      source: "runFullNeuralWritingPipelineSingleEntryBridge",
      loaded: true,
      used: payload.single_entry_bridge === true || payload.one_click_writing_orchestrator_used === true,
      evidence: hasObjectEvidence(workflow),
      linkedToFinalCandidate,
      evidenceSurface: oneClickEvidence,
    }),
    moduleEntry({
      key: "recursive_self_rewrite_loop",
      label: "多輪自我重寫迴路",
      phase: "24A-36A",
      source: "pipeline_result.recursive_revision",
      loaded: recursiveRevisionLoaded,
      used: recursiveRevisionUsed,
      evidence: recursiveRevisionEvidence,
      linkedToFinalCandidate,
      evidenceSurface: recursiveRevision,
    }),
    moduleEntry({
      key: "character_psychological_state_tracker",
      label: "角色心理狀態持續追蹤",
      phase: "25A-36A",
      source: "pipeline_result.character_mind_state_ledger",
      loaded: surfaceLoaded(pipeline.character_mind_state_ledger),
      used: surfaceUsed(pipeline.character_mind_state_ledger),
      evidence: surfaceHasEvidence(pipeline.character_mind_state_ledger),
      linkedToFinalCandidate,
      evidenceSurface: pipeline.character_mind_state_ledger,
    }),
    moduleEntry({
      key: "dramatic_conflict_tension_manager",
      label: "戲劇衝突與章節張力管理器",
      phase: "26A-36A",
      source: "pipeline_result.dramatic_conflict_manager",
      loaded: surfaceLoaded(pipeline.dramatic_conflict_manager),
      used: surfaceUsed(pipeline.dramatic_conflict_manager),
      evidence: surfaceHasEvidence(pipeline.dramatic_conflict_manager),
      linkedToFinalCandidate,
      evidenceSurface: pipeline.dramatic_conflict_manager,
    }),
    moduleEntry({
      key: "reader_experience_simulator",
      label: "讀者體感模擬器",
      phase: "29A-36A",
      source: "reader_response_simulator",
      loaded: surfaceLoaded(readerResponse),
      used: surfaceUsed(readerResponse),
      evidence: surfaceHasEvidence(readerResponse),
      linkedToFinalCandidate,
      evidenceSurface: readerResponse,
    }),
    moduleEntry({
      key: "foreshadowing_causality_graph",
      label: "伏筆與因果圖",
      phase: "27A-36A",
      source: "pipeline_result.foreshadowing_causal_graph",
      loaded: surfaceLoaded(pipeline.foreshadowing_causal_graph),
      used: surfaceUsed(pipeline.foreshadowing_causal_graph),
      evidence: surfaceHasEvidence(pipeline.foreshadowing_causal_graph),
      linkedToFinalCandidate,
      evidenceSurface: pipeline.foreshadowing_causal_graph,
    }),
    moduleEntry({
      key: "long_term_aesthetic_memory",
      label: "長期審美記憶",
      phase: "30A-33J-36A",
      source: "aesthetic_memory_context",
      loaded: surfaceLoaded(aestheticMemory),
      used: surfaceUsed(aestheticMemory),
      evidence: surfaceHasEvidence(aestheticMemory),
      linkedToFinalCandidate,
      evidenceSurface: aestheticMemory,
    }),
  ];

  const validationErrors = buildValidationErrors(entries, finalCandidateAvailable);
  const missingRequiredBrainModules = entries
    .filter((entry) => entry.contract_valid !== true)
    .map((entry) => entry.key);

  const allRequiredBrainModulesLoaded = entries.every((entry) => entry.loaded === true);
  const allRequiredBrainModulesUsed = entries.every((entry) => entry.used === true);
  const allRequiredBrainModulesHaveEvidence = entries.every((entry) => entry.evidence === true);
  const allRequiredBrainModulesLinkedToFinalCandidate = entries.every((entry) => entry.linked_to_final_candidate === true);
  const contractValid =
    finalCandidateAvailable
    && entries.length === requiredNeuralWritingBrainModules.length
    && allRequiredBrainModulesLoaded
    && allRequiredBrainModulesUsed
    && allRequiredBrainModulesHaveEvidence
    && allRequiredBrainModulesLinkedToFinalCandidate;

  return {
    used: true,
    phase: "36A",
    surface_kind: "neural_writing_brain_required_modules_contract",
    version: neuralWritingBrainRequiredModulesContractVersion,
    contract_valid: contractValid,
    validation_errors: validationErrors,
    status: contractValid
      ? "required_brain_modules_contract_valid"
      : "blocked_required_brain_modules_contract_invalid",
    response_kind: contractValid
      ? "required_brain_modules_contract_reference"
      : "required_brain_modules_contract_invalid_reference",

    required_brain_modules_count: requiredNeuralWritingBrainModules.length,
    required_brain_modules: requiredNeuralWritingBrainModules,
    required_brain_module_entries: entries,

    all_required_brain_modules_loaded: allRequiredBrainModulesLoaded,
    all_required_brain_modules_used: allRequiredBrainModulesUsed,
    all_required_brain_modules_have_evidence: allRequiredBrainModulesHaveEvidence,
    all_required_brain_modules_linked_to_final_candidate: allRequiredBrainModulesLinkedToFinalCandidate,
    missing_required_brain_modules: missingRequiredBrainModules,

    final_candidate_available: finalCandidateAvailable,
    final_candidate_hash: finalCandidateAvailable ? finalCandidateHash : null,
    final_candidate_decision: payload.final_candidate_decision ?? payload.finalCandidateDecision ?? null,
    final_candidate_decision_source: payload.final_candidate_decision_source ?? payload.finalCandidateDecisionSource ?? null,

    can_emit_final_output: contractValid,
    can_output_to_chat: contractValid,
    may_output_story_text: contractValid,
    must_block_final_output_when_invalid: true,
    block_reason_when_invalid: contractValid ? null : "required_brain_modules_contract_invalid",
    operator_action_when_invalid: contractValid
      ? null
      : "inspect_neural_writing_brain_required_modules_contract",

    operator_diagnostics: buildNeuralWritingBrainRequiredModulesDiagnostics({
      contract_valid: contractValid,
      validation_errors: validationErrors,
      required_brain_modules_count: requiredNeuralWritingBrainModules.length,
      required_brain_modules: requiredNeuralWritingBrainModules,
      required_brain_module_entries: entries,
      missing_required_brain_modules: missingRequiredBrainModules,
      final_candidate_available: finalCandidateAvailable,
      final_candidate_hash: finalCandidateAvailable ? finalCandidateHash : null,
      final_candidate_decision: payload.final_candidate_decision ?? payload.finalCandidateDecision ?? null,
      final_candidate_decision_source: payload.final_candidate_decision_source ?? payload.finalCandidateDecisionSource ?? null,
      can_emit_final_output: contractValid,
      can_output_to_chat: contractValid,
      may_output_story_text: contractValid,
    }),
    readable_diagnostics: buildNeuralWritingBrainRequiredModulesDiagnostics({
      contract_valid: contractValid,
      validation_errors: validationErrors,
      required_brain_modules_count: requiredNeuralWritingBrainModules.length,
      required_brain_modules: requiredNeuralWritingBrainModules,
      required_brain_module_entries: entries,
      missing_required_brain_modules: missingRequiredBrainModules,
      final_candidate_available: finalCandidateAvailable,
      final_candidate_hash: finalCandidateAvailable ? finalCandidateHash : null,
      final_candidate_decision: payload.final_candidate_decision ?? payload.finalCandidateDecision ?? null,
      final_candidate_decision_source: payload.final_candidate_decision_source ?? payload.finalCandidateDecisionSource ?? null,
      can_emit_final_output: contractValid,
      can_output_to_chat: contractValid,
      may_output_story_text: contractValid,
    }),

    safety: {
      candidate_only: true,
      no_candidate_save: true,
      no_approval: true,
      no_adoption: true,
      no_canon_update: true,
      no_active_engine_update: true,
      can_modify_active_engine: false,
      can_update_canon: false,
      can_confirm_adoption: false,
    },
  };
}
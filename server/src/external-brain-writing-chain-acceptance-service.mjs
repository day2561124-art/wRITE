import { createHash } from "node:crypto";

export const externalBrainWritingChainAcceptanceVersion =
  "phase50e-external-brain-writing-chain-acceptance-v1";

export const externalBrainWritingChainRequiredPreGenerationCapabilities = [
  "scene_planner",
  "character_simulator",
  "neural_critic",
  "style_drift_detector",
  "over_governance_detector",
  "writing_card_director",
];

export const externalBrainWritingChainRequiredPostDraftDiagnostics = [
  "neural_critic",
  "style_drift_detector",
];

const mutationGuardKeys = [
  "candidate_created",
  "canon_updated",
  "active_engine_updated",
  "adopted",
  "settled",
];

function sha256(value) {
  return createHash("sha256")
    .update(typeof value === "string" || Buffer.isBuffer(value)
      ? value
      : canonicalJson(value))
    .digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function responseCapabilityName(response) {
  return String(response?.capability_name ?? "").replace(/^run_/u, "");
}

function guardState(response) {
  return Object.fromEntries(mutationGuardKeys.map((key) => [
    key,
    response?.[key] === false && response?.mutation_guards?.[key] === false,
  ]));
}

function allMutationGuardsClosed(responses) {
  return responses.every((response) => (
    mutationGuardKeys.every((key) => (
      response?.[key] === false
      && response?.mutation_guards?.[key] === false
    ))
  ));
}

function exactLineFinding(finding) {
  return isObject(finding)
    && /^F\d{2}$/u.test(String(finding.finding_id ?? ""))
    && Number.isInteger(finding.line_start)
    && Number.isInteger(finding.line_end)
    && /^L\d+(?:-L\d+)?$/u.test(String(finding.line_reference ?? ""))
    && Number.isInteger(finding.column_start)
    && Number.isInteger(finding.column_end)
    && typeof finding.issue_type === "string"
    && finding.issue_type.length > 0
    && typeof finding.quote === "string"
    && finding.quote.length > 0
    && typeof finding.reason === "string"
    && finding.reason.length > 0
    && typeof finding.must_fix === "boolean"
    && typeof finding.minimal_direction === "string"
    && finding.minimal_direction.length > 0;
}

function diagnosticsSummary(response, expectedDraftSha256) {
  const findings = Array.isArray(response?.capability_output?.findings)
    ? response.capability_output.findings
    : [];
  const visible = JSON.stringify(response?.capability_output ?? {});
  return {
    capability: responseCapabilityName(response),
    ok: response?.ok === true,
    generation_boundary: response?.generation_boundary ?? null,
    analysis_status: response?.capability_output?.analysis_status ?? null,
    draft_sha256_matches: response?.capability_output?.draft_sha256
      === expectedDraftSha256,
    findings_have_exact_line_evidence:
      findings.length > 0 && findings.every((finding) => exactLineFinding(finding)),
    finding_issue_types: findings.map((finding) => finding.issue_type),
    must_fix_count: findings.filter((finding) => finding.must_fix === true).length,
    full_draft_not_echoed:
      !Object.hasOwn(response?.capability_output ?? {}, "draft_text")
      && !Object.hasOwn(response?.capability_output ?? {}, "raw_draft_text"),
    control_plane_not_leaked:
      !visible.includes("story_material_cognition")
      && !visible.includes("grounded_material")
      && !visible.includes("source_cognition_manifest"),
  };
}

function snapshotsEqual(before, after) {
  return canonicalJson(before ?? {}) === canonicalJson(after ?? {});
}

function hashesUnchanged(before, after, expected = {}) {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
    ...Object.keys(expected ?? {}),
  ]);
  return [...keys].every((key) => (
    typeof before?.[key] === "string"
    && before[key] === after?.[key]
    && (expected?.[key] === undefined || before[key] === expected[key])
  ));
}

function addViolation(violations, condition, code) {
  if (!condition) violations.push(code);
}

export function buildExternalBrainWritingChainAcceptanceSeal({
  bootstrap_response: bootstrapResponse,
  pre_generation_responses: preGenerationResponses = [],
  pre_generation_diagnostic_responses: preGenerationDiagnosticResponses = [],
  problem_draft_text: problemDraftText,
  problem_draft_diagnostic_responses: problemDraftDiagnosticResponses = [],
  release_story_text: releaseStoryText,
  release_diagnostic_responses: releaseDiagnosticResponses = [],
  sealed_handoff_response: sealedHandoffResponse,
  final_polisher_response: finalPolisherResponse,
  protected_hashes_before: protectedHashesBefore = {},
  protected_hashes_after: protectedHashesAfter = {},
  expected_protected_hashes: expectedProtectedHashes = {},
  mutation_snapshots_before: mutationSnapshotsBefore = {},
  mutation_snapshots_after: mutationSnapshotsAfter = {},
  raw_story_persisted: rawStoryPersisted = false,
} = {}) {
  if (typeof problemDraftText !== "string" || problemDraftText.length === 0) {
    throw new Error("problem_draft_text is required for Phase50E acceptance.");
  }
  if (typeof releaseStoryText !== "string" || releaseStoryText.length === 0) {
    throw new Error("release_story_text is required for Phase50E acceptance.");
  }

  const problemDraftSha256 = sha256(problemDraftText);
  const releaseStorySha256 = sha256(releaseStoryText);
  const preGenerationNames = preGenerationResponses.map(responseCapabilityName);
  const allResponses = [
    bootstrapResponse,
    ...preGenerationResponses,
    ...preGenerationDiagnosticResponses,
    ...problemDraftDiagnosticResponses,
    ...releaseDiagnosticResponses,
    sealedHandoffResponse,
    finalPolisherResponse,
  ].filter(Boolean);
  const problemDiagnostics = problemDraftDiagnosticResponses.map((response) => (
    diagnosticsSummary(response, problemDraftSha256)
  ));
  const releaseDiagnostics = releaseDiagnosticResponses.map((response) => (
    diagnosticsSummary(response, releaseStorySha256)
  ));
  const violations = [];

  addViolation(
    violations,
    bootstrapResponse?.ok === true
      && bootstrapResponse?.architecture_route === "chatgpt_owned_external_brain"
      && bootstrapResponse?.orchestration_owner === "ChatGPT"
      && bootstrapResponse?.prose_generator === "ChatGPT",
    "bootstrap_ownership_boundary_failed",
  );
  addViolation(
    violations,
    canonicalJson(bootstrapResponse?.next_capabilities ?? [])
      === canonicalJson(externalBrainWritingChainRequiredPreGenerationCapabilities),
    "bootstrap_capability_order_mismatch",
  );
  addViolation(
    violations,
    canonicalJson(bootstrapResponse?.post_draft_diagnostics ?? [])
      === canonicalJson(externalBrainWritingChainRequiredPostDraftDiagnostics),
    "bootstrap_post_draft_diagnostics_mismatch",
  );
  addViolation(
    violations,
    canonicalJson(preGenerationNames)
      === canonicalJson(externalBrainWritingChainRequiredPreGenerationCapabilities),
    "pre_generation_capability_order_mismatch",
  );
  addViolation(
    violations,
    preGenerationResponses.every((response) => (
      response?.ok === true
      && response?.trace?.status === "success"
      && response?.generation_surface?.used === true
      && response?.generation_surface?.full_cognition_retained === true
      && response?.generation_surface?.control_plane_excluded_from_capability_output === true
    )),
    "pre_generation_compact_surface_failed",
  );
  addViolation(
    violations,
    preGenerationDiagnosticResponses.every((response) => (
      response?.ok === true
      && response?.generation_boundary === "pre_generation"
      && response?.capability_output?.analysis_status
        === "inactive_without_draft_evidence"
    )),
    "pre_generation_diagnostic_activation_failed",
  );
  addViolation(
    violations,
    problemDiagnostics.length === 2
      && problemDiagnostics.every((item) => (
        item.ok
        && item.generation_boundary === "post_generation_diagnostic"
        && item.analysis_status === "exact_line_review_complete"
        && item.draft_sha256_matches
        && item.findings_have_exact_line_evidence
        && item.full_draft_not_echoed
        && item.control_plane_not_leaked
      )),
    "problem_draft_exact_line_diagnostics_failed",
  );
  addViolation(
    violations,
    problemDiagnostics.some((item) => (
      item.finding_issue_types.includes("admission_boundary_violation")
    )),
    "problem_draft_admission_boundary_not_detected",
  );
  addViolation(
    violations,
    problemDiagnostics.some((item) => (
      item.finding_issue_types.includes("workflow_language_leak")
    )),
    "problem_draft_workflow_leak_not_detected",
  );
  addViolation(
    violations,
    problemDiagnostics.some((item) => (
      item.finding_issue_types.includes("subtext_explicitly_explained")
      || item.finding_issue_types.includes("abstract_explanation_cluster")
    )),
    "problem_draft_explanation_drift_not_detected",
  );
  addViolation(
    violations,
    releaseDiagnostics.length === 2
      && releaseDiagnostics.every((item) => (
        item.ok
        && item.generation_boundary === "post_generation_diagnostic"
        && item.analysis_status === "exact_line_review_complete"
        && item.draft_sha256_matches
        && item.full_draft_not_echoed
        && item.control_plane_not_leaked
        && item.must_fix_count === 0
      )),
    "release_story_diagnostics_failed",
  );
  addViolation(
    violations,
    sealedHandoffResponse?.ok === true
      && sealedHandoffResponse?.handoff_route === "single_ingress_immutable_seal"
      && sealedHandoffResponse?.raw_story_sha256 === releaseStorySha256
      && sealedHandoffResponse?.seal_ingress_raw_story_sha256 === releaseStorySha256
      && sealedHandoffResponse?.parent_broker_received_raw_story_sha256
        === releaseStorySha256
      && sealedHandoffResponse?.internal_payload_continuity_exact_match === true,
    "sealed_handoff_exact_identity_failed",
  );
  addViolation(
    violations,
    finalPolisherResponse?.ok === true
      && finalPolisherResponse?.handoff_route === "single_ingress_immutable_seal"
      && finalPolisherResponse?.raw_story_sha256 === releaseStorySha256
      && finalPolisherResponse?.raw_story_integrity?.triple_hash_exact_match === true
      && finalPolisherResponse?.final_polisher_minimal_intervention_guard
        ?.text_identity_preserved === true
      && finalPolisherResponse?.final_polisher_minimal_intervention_guard
        ?.release_story_sha256 === releaseStorySha256
      && finalPolisherResponse?.final_polisher_minimal_intervention_guard
        ?.changed_prose_payload_count === 0
      && finalPolisherResponse?.agent_run_status === "success"
      && finalPolisherResponse?.session_lifecycle_status === "COMPLETED",
    "final_polisher_exact_release_failed",
  );
  addViolation(
    violations,
    allMutationGuardsClosed(allResponses),
    "mutation_guard_opened",
  );
  addViolation(
    violations,
    hashesUnchanged(
      protectedHashesBefore,
      protectedHashesAfter,
      expectedProtectedHashes,
    ),
    "protected_file_hash_changed",
  );
  addViolation(
    violations,
    snapshotsEqual(mutationSnapshotsBefore, mutationSnapshotsAfter),
    "forbidden_workflow_state_changed",
  );
  addViolation(
    violations,
    rawStoryPersisted === false,
    "raw_story_persisted_outside_ephemeral_handoff",
  );

  const accepted = violations.length === 0;
  const sealPayload = {
    acceptance_version: externalBrainWritingChainAcceptanceVersion,
    accepted,
    architecture_route: bootstrapResponse?.architecture_route ?? null,
    orchestration_owner: bootstrapResponse?.orchestration_owner ?? null,
    prose_generator: bootstrapResponse?.prose_generator ?? null,
    required_pre_generation_capabilities:
      externalBrainWritingChainRequiredPreGenerationCapabilities,
    completed_pre_generation_capabilities: preGenerationNames,
    pre_generation_diagnostics_inactive_without_draft:
      preGenerationDiagnosticResponses.every((response) => (
        response?.capability_output?.analysis_status
          === "inactive_without_draft_evidence"
      )),
    problem_draft_sha256: problemDraftSha256,
    problem_draft_exact_line_diagnostics: problemDiagnostics,
    release_story_sha256: releaseStorySha256,
    release_story_diagnostics: releaseDiagnostics,
    revision_owner: "ChatGPT",
    final_polisher_generated_replacement_prose: false,
    handoff_route: sealedHandoffResponse?.handoff_route ?? null,
    triple_hash_exact_match:
      finalPolisherResponse?.raw_story_integrity?.triple_hash_exact_match === true,
    final_polisher_text_identity_preserved:
      finalPolisherResponse?.final_polisher_minimal_intervention_guard
        ?.text_identity_preserved === true,
    final_polisher_release_story_sha256:
      finalPolisherResponse?.final_polisher_minimal_intervention_guard
        ?.release_story_sha256 ?? null,
    session_completed:
      finalPolisherResponse?.agent_run_status === "success"
      && finalPolisherResponse?.session_lifecycle_status === "COMPLETED",
    mutation_guards_closed: allMutationGuardsClosed(allResponses),
    protected_hashes_unchanged: hashesUnchanged(
      protectedHashesBefore,
      protectedHashesAfter,
      expectedProtectedHashes,
    ),
    forbidden_workflow_state_unchanged: snapshotsEqual(
      mutationSnapshotsBefore,
      mutationSnapshotsAfter,
    ),
    raw_story_persisted: rawStoryPersisted,
    response_guard_states: allResponses.map((response) => ({
      tool_name: response?.tool_name ?? "unknown",
      guards: guardState(response),
    })),
    violations,
  };

  return {
    accepted,
    violations,
    seal: sealPayload,
    deterministic_digest: sha256(sealPayload),
  };
}

export default buildExternalBrainWritingChainAcceptanceSeal;

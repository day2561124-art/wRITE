import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { listApprovalItems } from "./approval-queue-service.mjs";
import { listAdoptedChapters } from "./writing-workflow-service.mjs";
import { listGptWritingContextBundles } from "./gpt-writing-context-service.mjs";
import {
  getWritingCandidateDetail,
  listWritingCandidates,
} from "./chat-output-candidate-service.mjs";
import { listProofReports } from "./candidate-proof-report-service.mjs";
import { listSettlementReports } from "./adopted-writing-settlement-service.mjs";
import {
  activeEngineStatus,
  getPendingCandidate,
  listPendingCandidates,
} from "./engine-candidate-service.mjs";
import { projectPaths, projectRoot } from "./project-paths.mjs";
import { formatGuardReportForDisplay } from "./guard-report-display.mjs";

const fixturePattern = /(?:^|[_\-\s])(ui[_-]?test|e2e|fixture|demo)(?:$|[_\-\s])/iu;
const invalidCandidateStatuses = new Set([
  "activated", "rejected", "rolled_back", "deprecated", "archived",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function fileState(filePath) {
  try {
    const info = await stat(filePath);
    return { status: "loaded", exists: true, bytes: info.size };
  } catch (error) {
    if (error.code === "ENOENT") return { status: "missing", exists: false, bytes: 0 };
    return { status: "failed", exists: false, bytes: 0, reason: error.message };
  }
}

function isFixture(record = {}) {
  return fixturePattern.test([
    record.candidate_id,
    record.bundle_id,
    record.title,
    record.chapter_label,
    record.source,
    record.task_prompt,
  ].filter(Boolean).join(" "));
}

function approvalStatus(item) {
  return item?.status?.status ?? item?.status ?? null;
}

function step(key, label, status, extras = {}) {
  return {
    key,
    label,
    status,
    entity_id: extras.entity_id ?? null,
    blocked_reason: extras.blocked_reason ?? null,
    next_action: extras.next_action ?? null,
    requires_approval: extras.requires_approval === true,
    risk_level: extras.risk_level ?? "low",
  };
}

function findLinkedApproval(approvals, actionType, ids) {
  return approvals.find((item) => {
    if (item.action_type !== actionType) return false;
    const linked = [
      item.target_id,
      item.candidate_id,
      item.proof_report_id,
      item.links?.candidate_id,
      item.links?.proof_report_id,
      item.links?.adopted_chapter_id,
      item.details?.settlement_report_id,
    ];
    return ids.some((id) => id && linked.includes(id));
  }) ?? null;
}

async function resolvePendingCandidate(settlementReportId) {
  if (!settlementReportId) return null;
  for (const summary of await listPendingCandidates()) {
    if (invalidCandidateStatuses.has(summary.status)) continue;
    try {
      const detail = await getPendingCandidate(summary.candidate_id);
      if (invalidCandidateStatuses.has(detail.status?.status)) continue;
      if (detail.metadata?.settlement_report_id === settlementReportId) {
        return detail;
      }
    } catch {
      // Ignore incomplete candidates.
    }
  }
  return null;
}

function action(key, label, endpoint, enabled, reason = "") {
  return {
    key,
    label,
    enabled,
    disabled_reason: enabled ? null : reason,
    requires_approval: key.includes("approval") || key.includes("adoption"),
    risk_level: key.includes("approval") ? "P0" : "low",
    endpoint,
  };
}

export async function buildWriterWorkbenchState() {
  const [active, bundles, candidates, proofs, adopted, settlements, approvals] = await Promise.all([
    activeEngineStatus(),
    listGptWritingContextBundles({ limit: 100 }),
    listWritingCandidates({ limit: 100 }),
    listProofReports({ limit: 100 }),
    listAdoptedChapters(),
    listSettlementReports({ limit: 100 }),
    listApprovalItems(),
  ]);

  const bundle = bundles.find((item) => !isFixture(item)) ?? null;
  const workflowRunId = bundle?.bundle_id ?? null;
  const candidateSummary = workflowRunId
    ? candidates.find((item) => item.source_bundle_id === workflowRunId && !isFixture(item)) ?? null
    : null;
  const candidateDetail = candidateSummary
    ? await getWritingCandidateDetail(candidateSummary.candidate_id)
    : null;
  const candidate = candidateDetail?.metadata ?? null;
  const candidateGuardReport = candidate?.guard_report ?? [];
  const candidateGuardReportDisplay = candidateDetail?.guard_report_display
    ?? formatGuardReportForDisplay(candidateGuardReport);
  const fullNeuralReport = candidate?.full_neural_orchestration_report ?? null;
  const fullNeural = {
    used: Boolean(
      fullNeuralReport
      || candidate?.full_neural_orchestrator_version
      || candidate?.full_neural_pipeline_stage,
    ),
    orchestrator_version:
      candidate?.full_neural_orchestrator_version
      ?? fullNeuralReport?.orchestration_version
      ?? null,
    pipeline_stage:
      candidate?.full_neural_pipeline_stage
      ?? fullNeuralReport?.pipeline_stage
      ?? null,
    context_bundle_id:
      fullNeuralReport?.context_bundle_id
      ?? candidate?.source_bundle_id
      ?? null,
    writing_pipeline_complete: fullNeuralReport?.writing_pipeline_complete ?? null,
    candidate_only: fullNeuralReport?.candidate_only ?? candidate?.canon_status === "candidate_only",
    active_engine_update_allowed: fullNeuralReport?.active_engine_update_allowed ?? false,
    canon_update_allowed: fullNeuralReport?.canon_update_allowed ?? false,
  };
  const proof = candidate
    ? proofs.find((item) => item.candidate_id === candidate.candidate_id && !isFixture(item)) ?? null
    : null;
  const adoptedChapter = candidate
    ? adopted.find((item) => (
      item.candidate_id === candidate.candidate_id
      || item.adoption?.candidate_id === candidate.candidate_id
      || item.metadata?.candidate_id === candidate.candidate_id
    )) ?? null
    : null;
  const adoptedChapterId = adoptedChapter?.adopted_chapter_id
    ?? adoptedChapter?.chapter_id
    ?? adoptedChapter?.adoption?.adopted_chapter_id
    ?? null;
  const settlement = adoptedChapterId
    ? settlements.find((item) => (
      item.adopted_chapter_id === adoptedChapterId
      || item.candidate_id === candidate?.candidate_id
    )) ?? null
    : null;
  const settlementReportId = settlement?.settlement_report_id ?? settlement?.report_id ?? null;
  const pending = await resolvePendingCandidate(settlementReportId);
  const pendingId = pending?.metadata?.candidate_id ?? null;
  const adoptionApproval = findLinkedApproval(
    approvals,
    "adopt_writing_candidate",
    [candidate?.candidate_id, proof?.proof_report_id],
  );
  const activationApproval = findLinkedApproval(
    approvals,
    "activate_engine_candidate",
    [pendingId, settlementReportId],
  );

  const missingLineage = [];
  if (candidate && !workflowRunId) missingLineage.push("workflow_run_id");
  if (proof && proof.candidate_id !== candidate?.candidate_id) missingLineage.push("proof_report_id");
  if (settlement && !adoptedChapterId) missingLineage.push("adopted_chapter_id");
  if (pending && !settlementReportId) missingLineage.push("settlement_report_id");

  const outputPaths = {
    generation_context: path.join(projectRoot, "data", "outputs", "generation_context.md"),
    retrieval_context: path.join(projectRoot, "data", "outputs", "retrieval_context.md"),
    task_prompt: path.join(projectRoot, "data", "outputs", "task_prompt.md"),
    current_prompt: path.join(projectRoot, "data", "outputs", "current_prompt.md"),
  };
  const [outputEntries, promptEntries, compressedRules] = await Promise.all([
    Promise.all(Object.entries(outputPaths).map(async ([key, filePath]) => [key, await fileState(filePath)])),
    Promise.all([
      "generate_chapter.md",
      "proofread_draft.md",
      "settle_chapter.md",
      "compress_errors.md",
      "rewrite_by_errors.md",
    ].map((name) => fileState(path.join(projectRoot, "prompts", name)))),
    readFile(projectPaths.compressedRules),
  ]);
  const outputs = Object.fromEntries(outputEntries);
  const outputsComplete = Object.values(outputs).every((item) => item.exists);
  const promptsComplete = promptEntries.every((item) => item.exists);

  const steps = [
    step("load_data", "讀取資料", outputsComplete && promptsComplete ? "completed" : "blocked", {
      blocked_reason: outputsComplete && promptsComplete ? null : "prompts 或 outputs 缺失。",
      next_action: "refresh",
    }),
    step("generate_candidate", "生成正文候選", candidate ? "completed" : workflowRunId ? "ready" : "not_started", {
      entity_id: workflowRunId,
      blocked_reason: workflowRunId ? null : "尚未建立本輪寫作 context。",
      next_action: "compose",
    }),
    step("save_candidate", "保存候選", candidate ? "completed" : workflowRunId ? "ready" : "blocked", {
      entity_id: candidate?.candidate_id,
      blocked_reason: workflowRunId ? null : "尚無正文候選，無法保存。",
      next_action: "save_chat_output_candidate",
      full_neural: fullNeural,
    }),
    step("proofread", "驗稿 / 校對", proof ? "completed" : candidate ? "ready" : "blocked", {
      entity_id: proof?.proof_report_id,
      blocked_reason: candidate ? null : "尚未保存候選，無法送去驗稿。",
      next_action: "review",
    }),
    step("queue_adoption", "加入待我確認", adoptionApproval ? "completed" : proof ? "ready" : "blocked", {
      entity_id: adoptionApproval?.approval_item_id,
      blocked_reason: proof ? null : "尚未完成驗稿，無法加入待確認。",
      next_action: "request_adoption",
      requires_approval: true,
    }),
    step("settlement", "章節結算", settlement ? "completed" : adoptedChapter ? "ready" : "blocked", {
      entity_id: settlementReportId,
      blocked_reason: adoptedChapter ? null : "正文尚未經人工採納。",
      next_action: "settlement",
    }),
    step("canon_candidate", "建立正史更新候選", pending ? "completed" : settlement ? "ready" : "blocked", {
      entity_id: pendingId,
      blocked_reason: settlement ? null : "尚無 settlement report。",
      next_action: "create_pending_engine_candidate",
    }),
    step("manual_approval", "等待人工確認", activationApproval ? "ready" : pending ? "ready" : "not_started", {
      entity_id: activationApproval?.approval_item_id,
      next_action: "approval",
      requires_approval: true,
      risk_level: "P0",
    }),
  ];
  const legacySteps = [
    ["writing_context", "Writing Context", "load_data"],
    ["chat_output_candidate", "Chat Output Candidate", "save_candidate"],
    ["proof_report", "Proof Report", "proofread"],
    ["adoption_request", "Adoption Request", "queue_adoption"],
    ["settlement_report", "Settlement Report", "settlement"],
    ["pending_engine_candidate", "Pending Engine Candidate", "canon_candidate"],
    ["engine_candidate_review", "Engine Candidate Review", "canon_candidate"],
    ["activation_request", "Activation Request", "manual_approval"],
  ].map(([key, label, sourceKey]) => {
    const source = steps.find((item) => item.key === sourceKey);
    return { ...source, key, label, compatibility_alias: true };
  });
  if (missingLineage.length) {
    steps[0] = step("load_data", "讀取資料", "blocked", {
      blocked_reason: `流程資料不完整：缺少 ${missingLineage.join(", ")}`,
      next_action: "refresh",
    });
  }

  const nextStep = steps.find((item) => !["completed"].includes(item.status)) ?? steps.at(-1);
  const pendingApprovals = approvals.filter((item) => ["pending", "deferred"].includes(approvalStatus(item)));
  return {
    active_engine: active,
    lineage: {
      workflow_run_id: workflowRunId,
      chapter_id: candidate?.chapter_id ?? candidate?.chapter_label ?? null,
      candidate_id: candidate?.candidate_id ?? null,
      proof_report_id: proof?.proof_report_id ?? null,
      adopted_chapter_id: adoptedChapterId,
      settlement_context_id: settlement?.settlement_context_id ?? null,
      settlement_report_id: settlementReportId,
      pending_engine_candidate_id: pendingId,
      approval_queue_item_id:
        activationApproval?.approval_item_id ?? adoptionApproval?.approval_item_id ?? null,
      activation_request_id: activationApproval?.approval_item_id ?? null,
      complete: missingLineage.length === 0,
      missing_fields: missingLineage,
    },
    chapter: {
      title: candidate?.title || candidate?.chapter_label || "尚未建立本輪章節",
      chapter_id: candidate?.chapter_id ?? candidate?.chapter_label ?? null,
      workflow_run_id: workflowRunId,
      candidate_id: candidate?.candidate_id ?? null,
      candidate_status: candidate?.canon_status ?? "not_started",
      has_proof_report: Boolean(proof),
      in_approval_queue: Boolean(adoptionApproval),
      has_settlement_report: Boolean(settlement),
      has_pending_engine_candidate: Boolean(pending),
      guard_report: candidateGuardReport,
      guard_report_display: candidateGuardReportDisplay,
      full_neural: fullNeural,
      full_neural_orchestrator_used: fullNeural.used,
    },
    workflow: {
      current_step: nextStep.key,
      overall_status: steps.some((item) => item.status === "blocked") ? "blocked" : "ready",
      steps: [...steps, ...legacySteps],
    },
    blocked: {
      is_blocked: steps.some((item) => item.status === "blocked"),
      blocked_step: steps.find((item) => item.status === "blocked")?.key ?? null,
      reason: steps.find((item) => item.status === "blocked")?.blocked_reason ?? null,
      missing_lineage_fields: missingLineage,
    },
    next_step: {
      key: nextStep.key,
      label: nextStep.label,
      status: nextStep.status,
      route: ["queue_adoption", "manual_approval"].includes(nextStep.key)
        ? "#approval"
        : nextStep.key === "proofread"
          ? "#review"
          : nextStep.key === "settlement" || nextStep.key === "canon_candidate"
            ? "#settlement"
            : "#compose",
      reason: nextStep.blocked_reason,
    },
    next_actions: [
      action("refresh", "讀取最新資料", "/api/writer-workbench/state", true),
      action(
        "save_chat_output_candidate",
        "保存正文候選",
        "/api/writer-workbench/save-chat-output-candidate",
        Boolean(workflowRunId) && !candidate,
        workflowRunId ? "本輪已有已保存候選。" : "尚未建立本輪寫作 context。",
      ),
      action(
        "go_to_approval_queue",
        "前往待我確認",
        "#approval",
        pendingApprovals.length > 0,
        "目前沒有待確認項目。",
      ),
    ],
    health: {
      chatgpt_bridge: "not_connected",
      canon: active?.exists === false ? "failed" : "loaded",
      writing_rules: "loaded",
      retrieval_memory: outputs.retrieval_context.status,
      prompts: promptsComplete ? "complete" : "missing",
      outputs: outputsComplete ? "complete" : "missing",
      outputs_detail: outputs,
      approval_queue_pending: pendingApprovals.length,
      active_engine_hash: active?.sha256 ?? active?.hash ?? null,
      compressed_rules_hash: sha256(compressedRules),
      full_neural_orchestrator: fullNeural.used
        ? fullNeural.pipeline_stage ?? "used"
        : "not_used",
      full_neural_orchestrator_version: fullNeural.orchestrator_version,
      not_ready_reasons: [
        ...(!outputsComplete ? ["outputs 缺失"] : []),
        ...(!promptsComplete ? ["prompts 缺失"] : []),
        ...(missingLineage.length ? [`流程資料不完整：${missingLineage.join(", ")}`] : []),
      ],
    },
    approval_queue: {
      pending_count: pendingApprovals.length,
      items: pendingApprovals,
    },
    risk: {
      candidate_guard_report: candidateGuardReport,
      candidate_guard_report_display: candidateGuardReportDisplay,
      activation_requires_approval: true,
      direct_activation_allowed: false,
      direct_canon_mutation_allowed: false,
    },
    safety: {
      local_generation_allowed: false,
      direct_activation_allowed: false,
      direct_canon_mutation_allowed: false,
      approval_required_for_adoption: true,
      approval_required_for_activation: true,
      rollback_requires_approval: true,
      proposal_only_setting_changes: true,
      approval_queue_is_high_risk_entrypoint: true,
    },
    generatedAt: new Date().toISOString(),
  };
}

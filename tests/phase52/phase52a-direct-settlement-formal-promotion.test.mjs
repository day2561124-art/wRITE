import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  activatePendingCandidate,
  getPendingCandidate,
  rollbackActiveEngine,
} from "../../server/src/engine-candidate-service.mjs";
import {
  confirmApprovalItem,
  getApprovalItem,
} from "../../server/src/approval-queue-service.mjs";
import {
  buildPendingEngineCandidateReview,
  requestPendingEngineCandidateActivation,
} from "../../server/src/pending-engine-candidate-review-service.mjs";
import {
  directSettlementEnvelopeMarkers,
  chatgpt_bridge_save_settlement_report,
} from "../../server/src/mcp-direct-pasted-chapter-settlement-wrapper.mjs";
import {
  buildGptWritingContext,
} from "../../server/src/gpt-writing-context-service.mjs";
import {
  projectPaths,
} from "../../server/src/project-paths.mjs";

await mkdir(projectPaths.outputs, { recursive: true });
await mkdir(projectPaths.canonDb, { recursive: true });
await mkdir(projectPaths.approvalQueue, { recursive: true });
await mkdir(projectPaths.engineCandidateReviews, { recursive: true });

const outputFixture = await mkdtemp(path.join(
  projectPaths.outputs,
  "phase52a-direct-settlement-promotion-",
));
const canonFixture = await mkdtemp(path.join(
  projectPaths.canonDb,
  "phase52a-direct-settlement-promotion-",
));
const activeEnginePath = path.join(canonFixture, "active_engine.md");
const pendingEngineCandidates = path.join(
  canonFixture,
  "pending_engine_candidates",
);
const engineSnapshots = path.join(canonFixture, "engine_snapshots");
const engineArchive = path.join(canonFixture, "archive");
const activationLog = path.join(
  canonFixture,
  "activation_logs",
  "activation_log.jsonl",
);
const rollbackIndex = path.join(
  canonFixture,
  "rollback",
  "rollback_index.json",
);
const settlementReports = path.join(outputFixture, "settlement_reports");
const gptWritingContexts = path.join(outputFixture, "gpt_writing_contexts");
const engineCandidateReviews = await mkdtemp(path.join(
  projectPaths.engineCandidateReviews,
  "phase52a-direct-settlement-promotion-",
));
const approvalQueue = await mkdtemp(path.join(
  projectPaths.approvalQueue,
  "phase52a-direct-settlement-promotion-",
));

const options = {
  outputs: outputFixture,
  settlementReports,
  gptWritingContexts,
  engineCandidateReviews,
  approvalQueue,
  activeEnginePath,
  pendingEngineCandidates,
  engineSnapshots,
  engineArchive,
  activationLog,
  rollbackIndex,
};

const activeEngineText = [
  "# AI 專用單檔創作引擎 v5.0.12｜第十九章〈第一聲鈴〉正式承接",
  "",
  "正史止於第十九章〈第一聲鈴〉完成結算。",
  "新版第一章至第十九章均已正式採用並完成結算。",
  "",
  "## 硬設定",
  "",
  "異能武裝是靈魂延伸，不得當成日常工具。",
].join("\n");
const oldInputs = {
  task_prompt: "依第十九章〈第一聲鈴〉結尾續寫。\n",
  generation_context: "# Generation Context\n\nlatest chapter: 第十九章\n",
  retrieval_context: "# Retrieval Context\n\ncanon head: 第十九章\n",
};
const summaryText = [
  "# 第二十章〈不能沾水〉結算",
  "",
  "## 已發生",
  "九逃與朝日奈千夜已完成醫療處置。九逃左前臂清創縫合，左肩包紮；千夜右手腕固定。",
  "",
  "## 角色狀態",
  "兩人暫時禁止傷口沾水、出力及碰異能武裝。隔日複查為千夜 07:20、九逃 07:35。",
  "",
  "## 關係與立場變化",
  "兩人能互相協助，但尚未正式和解。九逃沒有抽回正在一起處理防水護套的手。",
  "",
  "## 待承接",
  "複查、換藥約定與未完成的對話仍須保留。",
  "",
  "## 下一章銜接判斷",
  "不必承接防水護套動作的下一秒。可以合理轉場、切換視角或開啟新場景。",
].join("\n");

try {
  await mkdir(outputFixture, { recursive: true });
  await writeFile(activeEnginePath, activeEngineText, "utf8");
  await Promise.all(Object.entries(oldInputs).map(([label, content]) => (
    writeFile(
      path.join(outputFixture, `${label}.md`),
      content,
      "utf8",
    )
  )));

  const result = await chatgpt_bridge_save_settlement_report({
    adoptedChapterId: "adopted_chapter_00000000-000000-00000000",
    settlementContextId: "settlement_ctx_00000000-000000-00000000",
    settlementReportText:
      `${directSettlementEnvelopeMarkers.summary}\n${summaryText}`,
    chapter: "第二十章",
    heading: "不能沾水",
    source: "chatgpt",
  }, options);

  assert.equal(result.continuity_handoff_saved, true);
  assert.equal(result.chapter, "第二十章");
  assert.equal(result.chapter_number, 20);
  assert.equal(result.heading, "不能沾水");
  assert.equal(result.pending_engine_candidate_created, true);
  assert.equal(result.current_input_refresh_prepared, true);
  assert.equal(result.active_engine_modified, false);

  const activeBeforeApproval = await readFile(activeEnginePath, "utf8");
  assert.equal(activeBeforeApproval, activeEngineText);

  const reportMetadata = JSON.parse(await readFile(
    path.join(
      settlementReports,
      result.settlement_report_id,
      "settlement_report.json",
    ),
    "utf8",
  ));
  assert.equal(reportMetadata.chapter, "第二十章");
  assert.equal(reportMetadata.chapter_number, 20);
  assert.equal(reportMetadata.heading, "不能沾水");
  assert.equal(
    reportMetadata.canon_status,
    "settlement_candidate_pending_review",
  );

  const candidate = await getPendingCandidate(
    result.pending_engine_candidate_id,
    options,
  );
  assert.equal(candidate.status.status, "candidate");
  assert.notEqual(candidate.risk_report.risk_level, "critical");
  assert.equal(
    candidate.metadata.candidate_kind,
    "direct_chapter_settlement_promotion",
  );
  assert.equal(
    candidate.metadata.current_input_refresh.chapter,
    "第二十章",
  );
  assert.match(candidate.candidate_preview, /v5\.0\.13/u);
  assert.match(
    candidate.candidate_preview,
    /第二十章〈不能沾水〉正式承接/u,
  );
  assert.match(
    candidate.candidate_preview,
    /LATEST_DIRECT_SETTLED_CANON:BEGIN/u,
  );

  const context = await buildGptWritingContext({
    task_prompt: oldInputs.task_prompt,
    generation_context: { content: oldInputs.generation_context },
    retrieval_context: { content: oldInputs.retrieval_context },
    chapter_mode: "next_chapter",
    include_visual_references: false,
  }, options);
  assert.equal(context.bundle.latest_settled_continuity.loaded, true);
  assert.equal(
    context.bundle.content.chapter_anchor.chapter,
    "第二十章",
  );
  assert.equal(
    context.bundle.content.chapter_anchor
      .latest_settled_continuity_applied,
    true,
  );

  await assert.rejects(
    activatePendingCandidate(
      result.pending_engine_candidate_id,
      { confirm: false },
      options,
    ),
    /User confirmation is required/u,
  );
  assert.equal(await readFile(activeEnginePath, "utf8"), activeEngineText);

  const review = await buildPendingEngineCandidateReview({
    pendingEngineCandidateId: result.pending_engine_candidate_id,
    includeSettlementReport: true,
  }, options);
  const activationRequest = await requestPendingEngineCandidateActivation({
    pendingEngineCandidateId: result.pending_engine_candidate_id,
    reviewId: review.review.review_id,
    reason: "Phase52 formal chapter settlement promotion test.",
  }, options);
  assert.equal(activationRequest.approval_item_created, true);
  assert.equal(activationRequest.active_engine_modified, false);
  const activationApproval = await getApprovalItem(
    activationRequest.approval_item_id,
    options,
  );
  assert.deepEqual(
    activationApproval.impact.will_modify,
    [
      "data/canon_db/active_engine.md",
      "data/outputs/task_prompt.md",
      "data/outputs/generation_context.md",
      "data/outputs/retrieval_context.md",
      reportMetadata.metadata_path,
    ],
  );

  const approved = await confirmApprovalItem(
    activationRequest.approval_item_id,
    {
      confirm: true,
      secondConfirm: true,
      approvalText: "確認啟用",
      approvedBy: "phase52-test",
    },
    options,
  );
  const activated = approved.result;
  assert.equal(activated.active_engine_modified, true);
  assert.equal(activated.current_inputs_refreshed, true);

  const activeAfter = await readFile(activeEnginePath, "utf8");
  assert.match(activeAfter, /v5\.0\.13/u);
  assert.match(activeAfter, /第二十章〈不能沾水〉正式承接/u);
  assert.doesNotMatch(
    activeAfter,
    /正史止於第十九章〈第一聲鈴〉完成結算/u,
  );
  assert.match(
    activeAfter,
    /正史止於第二十章〈不能沾水〉完成結算/u,
  );
  assert.match(
    await readFile(path.join(outputFixture, "task_prompt.md"), "utf8"),
    /effective_canon_head: 第二十章〈不能沾水〉/u,
  );
  assert.match(
    await readFile(path.join(outputFixture, "generation_context.md"), "utf8"),
    /continuity_rollback: forbidden/u,
  );
  assert.match(
    await readFile(path.join(outputFixture, "retrieval_context.md"), "utf8"),
    /第二十章〈不能沾水〉/u,
  );
  const activatedReportMetadata = JSON.parse(await readFile(
    path.join(
      settlementReports,
      result.settlement_report_id,
      "settlement_report.json",
    ),
    "utf8",
  ));
  assert.equal(
    activatedReportMetadata.canon_status,
    "formal_canon_activated",
  );
  assert.equal(activatedReportMetadata.formal_canon_activated, true);

  const rolledBack = await rollbackActiveEngine(
    activated.snapshot_id,
    {
      confirm: true,
      approvedBy: "phase52-test",
    },
    options,
  );
  assert.equal(rolledBack.current_inputs_restored, true);
  assert.equal(await readFile(activeEnginePath, "utf8"), activeEngineText);
  assert.equal(
    await readFile(path.join(outputFixture, "task_prompt.md"), "utf8"),
    oldInputs.task_prompt,
  );
  assert.equal(
    await readFile(path.join(outputFixture, "generation_context.md"), "utf8"),
    oldInputs.generation_context,
  );
  assert.equal(
    await readFile(path.join(outputFixture, "retrieval_context.md"), "utf8"),
    oldInputs.retrieval_context,
  );
  const rolledBackReportMetadata = JSON.parse(await readFile(
    path.join(
      settlementReports,
      result.settlement_report_id,
      "settlement_report.json",
    ),
    "utf8",
  ));
  assert.equal(
    rolledBackReportMetadata.canon_status,
    "settlement_candidate_pending_review",
  );

  console.log(
    "Phase52A direct settlement formal promotion test passed.",
  );
} finally {
  await Promise.all([
    rm(outputFixture, { recursive: true, force: true }),
    rm(canonFixture, { recursive: true, force: true }),
    rm(engineCandidateReviews, { recursive: true, force: true }),
    rm(approvalQueue, { recursive: true, force: true }),
  ]);
}

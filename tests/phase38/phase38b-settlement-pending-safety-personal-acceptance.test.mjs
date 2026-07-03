import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adoptCandidateDraft,
  saveCandidateDraft,
} from "../../server/src/writing-workflow-service.mjs";
import {
  buildSettlementContext,
  createPendingCandidateFromSettlementReport,
  getSettlementContext,
  getSettlementReport,
  saveSettlementReport,
} from "../../server/src/settlement-workflow-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const root = process.cwd();

const protectedFiles = [
  projectPaths.activeEngine,
  path.join(root, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(root, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(root, "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
];

const protectedRuntimeRoots = [
  projectPaths.pendingEngineCandidates,
  projectPaths.engineSnapshots,
  projectPaths.engineArchive,
  projectPaths.activationLogs,
];

const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNew(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

function assertSameSet(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
}

function settlement(candidateText) {
  return `# Phase38B 章節結算個人安全驗收

## 新版完整創作引擎候選

\`\`\`md
${candidateText}
\`\`\`

## 需人工確認項

- 新角色：只進 pending / review，不得直接入正史。
- 新異能武裝：只進 pending / review，不得直接入正史。
- 新世界實體：只進 pending / review，不得直接入正史。
- 本報告不得直接更新 Canon。
- 本報告不得直接更新 active_engine。
`;
}

async function createAdoptedChapter(label, options) {
  const draft = await saveCandidateDraft({
    draftText: [
      `${label} 正文。`,
      "",
      "門禁燈變紅後，朝日奈千夜與九逃在舊訓練場外側發現有人用靈力粉塵折返撤離線。",
      "她們沒有把門硬闖開，而是把敲擊聲、終端倒數與地面粉塵記成同一條線索。",
      "章尾出現一名只留下聲音的陌生人，並讓千夜意識到對方知道她們的行動節奏。",
    ].join("\n"),
    sourceChapter: label,
  }, options);

  const adopted = await adoptCandidateDraft(draft.metadata.draft_id, {
    confirm: true,
    adoptedBy: "phase38b_personal_acceptance",
  }, options);

  return { draft, adopted };
}

const productionProtectedBefore = new Map();
for (const file of protectedFiles) {
  productionProtectedBefore.set(file, sha256(await readFile(file, "utf8")));
}

const productionRuntimeBefore = new Map();
for (const directory of protectedRuntimeRoots) {
  productionRuntimeBefore.set(directory, await names(directory));
}

const transactionsBefore = await names(transactionDir);

const fixtureRoot = path.join(projectPaths.writingWorkflow, ".phase38b-personal-acceptance-test");
const fixtureActive = path.join(root, "data", "canon_db", ".phase38b-active-engine-test.md");
const fixturePending = path.join(root, "data", "canon_db", ".phase38b-pending-engine-candidates-test");

const activeText = [
  "# 完整創作引擎 Phase38B 個人安全驗收",
  "",
  "## 既有正史",
  "",
  "- 朝日奈千夜與九逃已在門禁折返陷阱事件中確認敵人能預判路線。",
  "- 章節結算只能同步 adopted chapter 已成立內容。",
  "- 新增角色、新異能武裝、新世界實體必須先進 pending / review。",
  "- Canon 與 active_engine 不得被結算流程直接更新。",
  "",
  "## 既有角色",
  "",
  "- 朝日奈千夜：核心主角群。",
  "- 九逃：核心主角群。",
].join("\n");

const candidateText = [
  activeText,
  "",
  "## Phase38B 章節結算新增項目",
  "",
  "### 新角色",
  "",
  "- 鳴瀨燈佳：只在門禁折返陷阱事件後作為待審角色記錄；目前不得直接寫入正式正史名錄。",
  "",
  "### 新異能武裝",
  "",
  "- 《回聲針盤》：與敲擊聲、終端倒數、撤離線折返相關的待審異能武裝記錄；目前不得直接寫入正式武裝索引。",
  "",
  "### 新世界實體",
  "",
  "- 舊訓練場外側門禁折返節點：只作為待審世界實體記錄；目前不得直接寫入正式世界實體索引。",
  "",
  "## Phase38B 安全邊界",
  "",
  "- 以上新增項目全部只能作為 pending_engine_candidate 的 review material。",
  "- 不得直接更新 Canon DB。",
  "- 不得直接更新 active_engine。",
].join("\n");

const options = {
  writingWorkflow: fixtureRoot,
  activeEnginePath: fixtureActive,
  pendingEngineCandidates: fixturePending,
};

try {
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(fixturePending, { recursive: true, force: true });
  await rm(fixtureActive, { force: true });
  await mkdir(path.dirname(fixtureActive), { recursive: true });
  await writeFile(fixtureActive, `${activeText}\n`, "utf8");

  const fixtureActiveBeforeHash = sha256(await readFile(fixtureActive, "utf8"));
  const fixturePendingBefore = await names(fixturePending);

  const { draft, adopted } = await createAdoptedChapter("Phase38B 個人結算章", options);

  assert.equal(draft.metadata.source_chapter, "Phase38B 個人結算章");
  assert.equal(adopted.status.status, "accepted_pending_settlement");

  const context = await buildSettlementContext(adopted.metadata.adopted_chapter_id, {
    note: "Phase38B personal pending safety context",
  }, options);

  assert.equal(context.status.status, "ready");
  assert.equal(context.status.can_save_settlement_report, true);
  assert.equal(context.metadata.active_engine_hash, fixtureActiveBeforeHash);
  assert.equal(context.metadata.source_candidate_id, draft.metadata.draft_id);
  assert.equal(context.settlement_context_text.includes("不得直接啟用 active_engine"), true);
  assert.equal(context.settlement_context_text.includes("只產生 settlement_report 與 pending_engine_candidate"), true);

  const report = await saveSettlementReport({
    settlementContextId: context.metadata.settlement_context_id,
    settlementText: settlement(candidateText),
    sourceChapter: "Phase38B 個人結算章",
    note: "新增角色/異能武裝/世界實體全部只進 pending review",
  }, options);

  assert.equal(report.status.status, "settlement_report_saved");
  assert.equal(report.status.can_create_pending_candidate, true);
  assert.equal(report.status.pending_candidate_id, null);
  assert.equal(report.metadata.canon_status, "settlement_report");
  assert.equal(report.metadata.active_engine_hash_at_settlement, fixtureActiveBeforeHash);
  assert.equal(report.metadata.source_candidate_id, draft.metadata.draft_id);
  assert.equal(report.settlement_text.includes("鳴瀨燈佳"), true);
  assert.equal(report.settlement_text.includes("《回聲針盤》"), true);
  assert.equal(report.settlement_text.includes("舊訓練場外側門禁折返節點"), true);
  assert.equal(report.settlement_text.includes("不得直接更新 active_engine"), true);

  assert.equal(sha256(await readFile(fixtureActive, "utf8")), fixtureActiveBeforeHash);

  const created = await createPendingCandidateFromSettlementReport(report.metadata.settlement_report_id, {
    sourceChapter: "Phase38B 個人結算章",
    note: "Phase38B pending-only personal acceptance",
  }, options);

  const pending = created.pending_candidate;
  const pendingCandidateId = pending.metadata.candidate_id;

  assert.match(pendingCandidateId, /^engine_candidate_\d{8}-\d{6}-[a-f0-9]{8}$/u);
  assert.equal(pending.metadata.canon_status, "pending");
  assert.equal(pending.metadata.requires_user_confirmation, true);
  assert.equal(pending.metadata.source_chapter, "Phase38B 個人結算章");
  assert.equal(pending.status.can_activate, false);
  assert.equal(pending.status.phase, "phase_2_pending_only");
  assert.equal(["candidate", "blocked"].includes(pending.status.status), true);
  assert.equal(pending.candidate_preview.includes("鳴瀨燈佳"), true);
  assert.equal(pending.candidate_preview.includes("《回聲針盤》"), true);
  assert.equal(pending.candidate_preview.includes("舊訓練場外側門禁折返節點"), true);
  assert.equal(pending.diff.summary.added_count > 0, true);
  assert.equal(pending.risk_report.risk_level.length > 0, true);
  assert.equal(pending.metadata.blocking_warnings.includes("missing_settlement_neural_trace"), true);

  assert.equal(created.settlement_report.status.status, "pending_candidate_created");
  assert.equal(created.settlement_report.status.pending_candidate_id, pendingCandidateId);
  assert.equal(created.settlement_report.status.can_create_pending_candidate, false);
  assert.equal(created.adopted_chapter.status.status, "settlement_candidate_created");
  assert.equal(created.adopted_chapter.status.settlement_candidate_id, pendingCandidateId);
  assert.equal(created.adopted_chapter.status.can_create_settlement, false);

  const fetchedContext = await getSettlementContext(context.metadata.settlement_context_id, options);
  const fetchedReport = await getSettlementReport(report.metadata.settlement_report_id, options);
  assert.equal(fetchedContext.status.status, "ready");
  assert.equal(fetchedReport.status.status, "pending_candidate_created");

  assert.equal(sha256(await readFile(fixtureActive, "utf8")), fixtureActiveBeforeHash);
  const fixturePendingAfter = await names(fixturePending);
  assert.equal(fixturePendingAfter.size, fixturePendingBefore.size + 1);
  assert.equal(fixturePendingAfter.has(pendingCandidateId), true);

  for (const file of protectedFiles) {
    assert.equal(
      sha256(await readFile(file, "utf8")),
      productionProtectedBefore.get(file),
      file + " production protected file changed.",
    );
  }

  for (const directory of protectedRuntimeRoots) {
    assertSameSet(
      await names(directory),
      productionRuntimeBefore.get(directory),
      directory + " production runtime root changed.",
    );
  }

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase38a = "tests/phase38/phase38a-chatgpt-bridge-personal-live-writing-acceptance-smoke.test.mjs";
  const phase38b = "tests/phase38/phase38b-settlement-pending-safety-personal-acceptance.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase38a), "run-all missing Phase38A predecessor.");
  assert(runAllText.includes(phase38b), "run-all missing Phase38B registration.");
  assert(runAllText.includes(daily), "run-all missing Daily scripts registration.");
  assert(runAllText.indexOf(phase38a) < runAllText.indexOf(phase38b), "Phase38B should run after Phase38A.");
  assert(runAllText.indexOf(phase38b) < runAllText.indexOf(daily), "Phase38B should run before Daily scripts.");

  console.log("Phase38B settlement pending safety personal acceptance passed.");
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(fixtureActive, { force: true });
  await rm(fixturePending, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);

  for (const file of protectedFiles) {
    assert.equal(
      sha256(await readFile(file, "utf8")),
      productionProtectedBefore.get(file),
      file + " cleanup changed production protected file.",
    );
  }

  for (const directory of protectedRuntimeRoots) {
    assertSameSet(
      await names(directory),
      productionRuntimeBefore.get(directory),
      directory + " cleanup changed production runtime root.",
    );
  }
}
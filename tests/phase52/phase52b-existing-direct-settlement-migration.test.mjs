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
  saveDirectChapterSettlementSummary,
} from "../../server/src/direct-chapter-settlement-summary-service.mjs";
import {
  getPendingCandidate,
} from "../../server/src/engine-candidate-service.mjs";
import {
  projectPaths,
} from "../../server/src/project-paths.mjs";

await mkdir(projectPaths.outputs, { recursive: true });
await mkdir(projectPaths.canonDb, { recursive: true });

const outputFixture = await mkdtemp(path.join(
  projectPaths.outputs,
  "phase52b-existing-settlement-migration-",
));
const canonFixture = await mkdtemp(path.join(
  projectPaths.canonDb,
  "phase52b-existing-settlement-migration-",
));
const activeEnginePath = path.join(canonFixture, "active_engine.md");
const pendingEngineCandidates = path.join(
  canonFixture,
  "pending_engine_candidates",
);
const settlementReports = path.join(outputFixture, "settlement_reports");

const activeEngineText = [
  "# AI 專用單檔創作引擎 v5.0.12｜第十九章〈第一聲鈴〉正式承接",
  "",
  "正史止於第十九章〈第一聲鈴〉完成結算。",
  "新版第一章至第十九章均已正式採用並完成結算。",
  "",
  "## 硬設定",
  "異能武裝是靈魂延伸。",
].join("\n");
const summaryText = [
  "## 已發生",
  "九逃左前臂已清創縫合，左肩已包紮；千夜右腕已固定。",
  "",
  "## 角色狀態",
  "兩人當晚不得讓傷口沾水，也不得碰異能武裝。",
  "",
  "## 關係與立場變化",
  "兩人能互相協助，但尚未正式和解。",
  "",
  "## 待承接",
  "隔日上午七點二十與七點三十五的複查安排仍須保留。",
  "",
  "## 下一章銜接判斷",
  "可以合理轉場，不必承接上一幕下一秒。",
].join("\n");

const options = {
  outputs: outputFixture,
  settlementReports,
  activeEnginePath,
  pendingEngineCandidates,
};

try {
  await mkdir(path.dirname(activeEnginePath), { recursive: true });
  await writeFile(activeEnginePath, activeEngineText, "utf8");

  const legacy = await saveDirectChapterSettlementSummary({
    settlement_summary_text: summaryText,
    source: "chatgpt",
    create_pending_engine_candidate: false,
  }, options);
  assert.equal(legacy.settlement_report_created, true);
  assert.equal(legacy.chapter, null);
  assert.equal(legacy.heading, null);
  assert.equal(legacy.pending_engine_candidate_created, false);

  const migrated = await saveDirectChapterSettlementSummary({
    settlement_summary_text: summaryText,
    source: "chatgpt",
    chapter: "20",
    heading: "不能沾水",
    create_pending_engine_candidate: true,
  }, options);
  assert.equal(migrated.settlement_report_reused, true);
  assert.equal(migrated.settlement_report_id, legacy.settlement_report_id);
  assert.equal(migrated.chapter, "第二十章");
  assert.equal(migrated.chapter_number, 20);
  assert.equal(migrated.heading, "不能沾水");
  assert.equal(migrated.pending_engine_candidate_created, true);
  assert.equal(migrated.active_engine_modified, false);

  const metadata = JSON.parse(await readFile(
    path.join(
      settlementReports,
      legacy.settlement_report_id,
      "settlement_report.json",
    ),
    "utf8",
  ));
  assert.equal(metadata.chapter, "第二十章");
  assert.equal(metadata.chapter_number, 20);
  assert.equal(metadata.heading, "不能沾水");
  assert.equal(
    metadata.canon_status,
    "settlement_candidate_pending_review",
  );

  const candidate = await getPendingCandidate(
    migrated.pending_engine_candidate_id,
    options,
  );
  assert.equal(candidate.status.status, "candidate");
  assert.equal(
    candidate.metadata.settlement_report_id,
    legacy.settlement_report_id,
  );
  assert.equal(await readFile(activeEnginePath, "utf8"), activeEngineText);

  console.log(
    "Phase52B existing direct settlement migration test passed.",
  );
} finally {
  await Promise.all([
    rm(outputFixture, { recursive: true, force: true }),
    rm(canonFixture, { recursive: true, force: true }),
  ]);
}

import assert from "node:assert/strict";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  directSettlementEnvelopeMarkers,
} from "../../server/src/mcp-direct-pasted-chapter-settlement-wrapper.mjs";
import {
  chatgptBridgeTools,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import {
  getSettlementReportDetail,
  listSettlementReports,
} from "../../server/src/adopted-writing-settlement-service.mjs";
import {
  projectPaths,
  projectRoot,
} from "../../server/src/project-paths.mjs";

await mkdir(projectPaths.outputs, { recursive: true });
await mkdir(projectPaths.canonDb, { recursive: true });

const fixtureRoot = await mkdtemp(path.join(
  projectPaths.outputs,
  "phase49a-direct-chapter-summary-",
));
const canonFixture = await mkdtemp(path.join(
  projectPaths.canonDb,
  "phase49a-direct-chapter-summary-",
));
const activeEnginePath = path.join(canonFixture, "active_engine.md");
const pendingEngineCandidates = path.join(
  canonFixture,
  "pending_engine_candidates",
);

const options = {
  settlementReports: path.join(
    fixtureRoot,
    "settlement_reports",
  ),
  adoptedWritings: path.join(
    fixtureRoot,
    "adopted_writings",
  ),
  outputs: fixtureRoot,
  activeEnginePath,
  pendingEngineCandidates,
};

const summaryText = [
  "# 第二十章結算",
  "",
  "## 已發生",
  "千夜與九逃的選拔賽結束，九逃獲勝。千夜公開承認判決正確。",
  "",
  "## 角色狀態",
  "千夜右腕、右膝與左肋受傷；九逃左前臂與左肩受傷。兩人暫時不得碰水或使用武裝。",
  "",
  "## 關係與立場變化",
  "兩人尚未正式和解，但已恢復互相照顧。九逃不接受千夜把一切理解成補償。",
  "",
  "## 待承接",
  "隔日上午複診；千夜已提出陪九逃換藥。",
  "",
  "## 下一章銜接判斷",
  "不必承接防水護套動作的下一秒。可跳至複診、切換視角，或開啟新場景；若切走，傷勢、禁用武裝與換藥約定仍須保留。",
].join("\n");

const fullChapterSentinel =
  "這是一段不應被保存的完整章節正文標記。";

await writeFile(activeEnginePath, [
  "# AI 專用單檔創作引擎 v5.0.12｜第十九章〈第一聲鈴〉正式承接",
  "",
  "正史止於第十九章〈第一聲鈴〉完成結算。",
  "新版第一章至第十九章均已正式採用並完成結算。",
].join("\n"), "utf8");

const activeBefore = await readFile(
  activeEnginePath,
  "utf8",
);

try {
  const response =
    await chatgptBridgeTools.chatgpt_bridge_save_settlement_report({
      adoptedChapterId:
        "adopted_chapter_00000000-000000-00000000",
      settlementContextId:
        "settlement_ctx_00000000-000000-00000000",
      settlementReportText:
        `${directSettlementEnvelopeMarkers.summary}\n${summaryText}`,
      chapter: "第二十章",
      heading: "不能沾水",
      source: "chatgpt",
    }, options);

  assert.equal(
    response.ok,
    true,
  );

  const result = response.result;

  assert.equal(
    result.direct_settlement_envelope_mode,
    "summary",
  );

  assert.equal(
    result.continuity_handoff_saved,
    true,
  );

  assert.equal(
    result.full_chapter_persisted,
    false,
  );

  assert.equal(
    result.adopted_chapter_created,
    false,
  );

  assert.equal(
    result.writing_candidate_created,
    false,
  );

  assert.equal(
    result.proof_report_created,
    false,
  );

  assert.equal(
    result.adoption_requested,
    false,
  );

  assert.equal(
    result.pending_engine_candidate_created,
    true,
  );

  assert.match(
    result.pending_engine_candidate_id,
    /^engine_candidate_/u,
  );

  assert.equal(
    result.active_engine_modified,
    false,
  );

  assert.equal(
    result.engine_activation_requested,
    false,
  );

  assert.equal(
    result.safety.can_confirm_adoption,
    false,
  );

  assert.equal(
    result.safety
      .direct_chapter_summary_settlement_allowed,
    true,
  );

  assert.equal(
    result.safety
      .pending_engine_candidate_creation_allowed,
    true,
  );

  const detail = await getSettlementReportDetail(
    result.settlement_report_id,
    {
      ...options,
      includeContent: true,
      maxContentChars: 10_000,
    },
  );

  assert.equal(
    detail.metadata.report_kind,
    "direct_chapter_continuity_handoff",
  );

  assert.equal(
    detail.metadata.adopted_chapter_id,
    null,
  );

  assert.equal(
    detail.metadata.full_chapter_persisted,
    false,
  );

  assert.equal(
    detail.metadata.pending_engine_candidate_created,
    true,
  );

  assert.equal(detail.metadata.chapter, "第二十章");
  assert.equal(detail.metadata.chapter_number, 20);
  assert.equal(detail.metadata.heading, "不能沾水");
  assert.equal(
    detail.metadata.pending_engine_candidate_id,
    result.pending_engine_candidate_id,
  );
  const persistedSummaryText = await readFile(
    path.resolve(
      projectRoot,
      result.settlement_report_path,
    ),
    "utf8",
  );

  assert.equal(
    persistedSummaryText.includes(summaryText),
    true,
  );

  assert.equal(
    persistedSummaryText.includes(
      fullChapterSentinel,
    ),
    false,
  );

  const reports = await listSettlementReports(
    {},
    options,
  );

  assert.equal(
    reports.some(
      (report) =>
        report.settlement_report_id
          === result.settlement_report_id
        && report.report_kind
          === "direct_chapter_continuity_handoff",
    ),
    true,
  );

  await assert.rejects(
    access(options.adoptedWritings),
    (error) => error?.code === "ENOENT",
  );

  const activeAfter = await readFile(
    activeEnginePath,
    "utf8",
  );

  assert.equal(
    activeAfter,
    activeBefore,
  );

  const mcpServerSource = await readFile(
    path.join(
      projectRoot,
      "server",
      "src",
      "mcp-server.mjs",
    ),
    "utf8",
  );

  assert.equal(
    mcpServerSource.includes(
      "[[DIRECT_CHAPTER_SETTLEMENT_SUMMARY]]",
    ),
    true,
  );

  assert.equal(
    mcpServerSource.includes(
      "Do not include or persist the full chapter text.",
    ),
    true,
  );

  console.log(
    "Phase49A direct chapter settlement summary contract test passed.",
  );
} finally {
  await Promise.all([
    rm(fixtureRoot, { recursive: true, force: true }),
    rm(canonFixture, { recursive: true, force: true }),
  ]);
}
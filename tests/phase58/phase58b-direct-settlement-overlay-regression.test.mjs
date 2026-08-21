import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  buildGptWritingContext,
} from "../../server/src/gpt-writing-context-service.mjs";
import {
  getLatestSettledContinuityOverlay,
} from "../../server/src/latest-settled-continuity-service.mjs";
import {
  chatgpt_bridge_save_settlement_report,
  directSettlementEnvelopeMarkers,
  directSettlementSentinelIds,
} from "../../server/src/mcp-direct-pasted-chapter-settlement-wrapper.mjs";
import {
  projectPaths,
} from "../../server/src/project-paths.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function summary(chapter, event) {
  return [
    `# ${chapter}結算`,
    "",
    "## 已發生",
    event,
    "",
    "## 角色狀態",
    `${event}後的狀態已記錄。`,
    "",
    "## 關係變化",
    "既有關係不變。",
    "",
    "## 待承接",
    `${event}之後的承接尚待處理。`,
    "",
    "## 下一章銜接判斷",
    `下一次寫作必須從${event}之後開始。`,
  ].join("\n");
}

async function writeStoredReport(root, {
  id,
  text,
  createdAt,
  metadata = {},
  recordedHash = sha256(text.trim()),
}) {
  const directory = path.join(root, id);
  await mkdir(directory, { recursive: true });
  const base = {
    settlement_report_id: id,
    report_kind: "direct_chapter_continuity_handoff",
    created_at: createdAt,
    source: "chatgpt",
    settlement_report_hash: recordedHash,
    chapter: metadata.chapter ?? null,
    chapter_number: metadata.chapter_number ?? null,
    heading: metadata.heading ?? null,
    continuity_handoff: true,
    full_chapter_persisted: false,
    canon_status: "settlement_report_only",
    settlement_status: "continuity_handoff_saved",
    ...metadata,
  };
  await Promise.all([
    writeFile(path.join(directory, "settlement_report.md"), `${text}\n`, "utf8"),
    writeFile(
      path.join(directory, "settlement_report.json"),
      `${JSON.stringify(base, null, 2)}\n`,
      "utf8",
    ),
  ]);
}

async function expectMissing(target) {
  await assert.rejects(
    access(target),
    (error) => error?.code === "ENOENT",
  );
}

await mkdir(projectPaths.outputs, { recursive: true });
await mkdir(projectPaths.canonDb, { recursive: true });

const outputFixture = await mkdtemp(path.join(
  projectPaths.outputs,
  "phase58b-direct-overlay-",
));
const canonFixture = await mkdtemp(path.join(
  projectPaths.canonDb,
  "phase58b-direct-overlay-",
));
const settlementReports = path.join(outputFixture, "settlement_reports");
const settlementContexts = path.join(outputFixture, "settlement_contexts");
const adoptedWritings = path.join(outputFixture, "adopted_writings");
const gptWritingContexts = path.join(outputFixture, "gpt_writing_contexts");
const activeEnginePath = path.join(canonFixture, "active_engine.md");
const pendingEngineCandidates = path.join(
  canonFixture,
  "pending_engine_candidates",
);
const options = {
  outputs: outputFixture,
  settlementReports,
  settlementContexts,
  adoptedWritings,
  gptWritingContexts,
  activeEnginePath,
  pendingEngineCandidates,
  engineComponentsStatusProvider: async () => ({
    ok: true,
    issues: [],
    components: { neural_pipeline: { modules: [] } },
  }),
};

const activeEngineText = [
  "# 測試用正式母本 v1.0.0",
  "",
  "正史進度仍停在較舊章節。",
].join("\n");
const oldTaskPrompt = "沿用較舊 generated input 的章節進度。";

try {
  await Promise.all([
    mkdir(settlementReports, { recursive: true }),
    writeFile(activeEnginePath, activeEngineText, "utf8"),
    writeFile(path.join(outputFixture, "task_prompt.md"), oldTaskPrompt, "utf8"),
    writeFile(
      path.join(outputFixture, "generation_context.md"),
      "latest chapter: OLD_GENERATED_N\n",
      "utf8",
    ),
    writeFile(
      path.join(outputFixture, "retrieval_context.md"),
      "continuity: OLD_GENERATED_N\n",
      "utf8",
    ),
  ]);

  const noDirect = await getLatestSettledContinuityOverlay(options);
  assert.equal(noDirect.loaded, false);

  const firstId = "settlement_report_20260101-000000-00000001";
  const secondId = "settlement_report_20260102-000000-00000002";
  await writeStoredReport(settlementReports, {
    id: firstId,
    text: summary("第一百章", "VALID_N_PLUS_1"),
    createdAt: "2026-01-01T00:00:00.000Z",
    metadata: { chapter: "第一百章", chapter_number: 100 },
  });
  assert.equal(
    (await getLatestSettledContinuityOverlay(options)).report_id,
    firstId,
  );

  await writeStoredReport(settlementReports, {
    id: secondId,
    text: summary("第一百零一章", "VALID_N_PLUS_2"),
    createdAt: "2026-01-02T00:00:00.000Z",
    metadata: { chapter: "第一百零一章", chapter_number: 101 },
  });
  let latest = await getLatestSettledContinuityOverlay(options);
  assert.equal(latest.report_id, secondId);
  assert.match(latest.summary_text, /VALID_N_PLUS_2/u);
  assert.doesNotMatch(latest.summary_text, /VALID_N_PLUS_1/u);

  await writeStoredReport(settlementReports, {
    id: "settlement_report_20990101-000000-00000003",
    text: summary("第九百章", "MALFORMED_HASH_MUST_NOT_WIN"),
    createdAt: "2099-01-01T00:00:00.000Z",
    recordedHash: "0".repeat(64),
  });
  await writeStoredReport(settlementReports, {
    id: "settlement_report_20990102-000000-00000004",
    text: summary("第九百零一章", "DELETED_MUST_NOT_WIN"),
    createdAt: "2099-01-02T00:00:00.000Z",
    metadata: { deleted: true },
  });
  await writeStoredReport(settlementReports, {
    id: "settlement_report_20990103-000000-00000005",
    text: summary("第九百零二章", "CANDIDATE_ONLY_MUST_NOT_WIN"),
    createdAt: "2099-01-03T00:00:00.000Z",
    metadata: { settlement_status: "candidate_only" },
  });
  latest = await getLatestSettledContinuityOverlay(options);
  assert.equal(latest.report_id, secondId);
  assert(latest.warnings.some((warning) => /hash mismatch/u.test(warning)));

  const crlfResult = await chatgpt_bridge_save_settlement_report({
    adoptedChapterId: directSettlementSentinelIds.adoptedChapterId,
    settlementContextId: directSettlementSentinelIds.settlementContextId,
    settlementReportText:
      `${directSettlementEnvelopeMarkers.summary}\r\n${summary("第一百零二章", "CRLF_DIRECT_N_PLUS_3")}`,
    chapter: "第一百零二章",
    heading: "CRLF direct",
    createPendingEngineCandidate: false,
  }, options);
  assert.equal(crlfResult.continuity_handoff_saved, true);
  await expectMissing(settlementContexts);
  await expectMissing(adoptedWritings);
  latest = await getLatestSettledContinuityOverlay(options);
  assert.equal(latest.report_id, crlfResult.settlement_report_id);
  assert.match(latest.summary_text, /CRLF_DIRECT_N_PLUS_3/u);

  await assert.rejects(
    chatgpt_bridge_save_settlement_report({
      adoptedChapterId: "adopted_chapter_11111111-111111-11111111",
      settlementContextId: directSettlementSentinelIds.settlementContextId,
      settlementReportText:
        `${directSettlementEnvelopeMarkers.summary}\n${summary("第一百零三章", "WRONG_SENTINEL")}`,
    }, options),
    /sentinel IDs/u,
  );
  await assert.rejects(
    chatgpt_bridge_save_settlement_report({
      adoptedChapterId: directSettlementSentinelIds.adoptedChapterId,
      settlementContextId: directSettlementSentinelIds.settlementContextId,
      settlementReportText: "ordinary settlement route remains validated",
    }, options),
  );

  await new Promise((resolve) => setTimeout(resolve, 20));
  const pendingResult = await chatgpt_bridge_save_settlement_report({
    adoptedChapterId: directSettlementSentinelIds.adoptedChapterId,
    settlementContextId: directSettlementSentinelIds.settlementContextId,
    settlementReportText:
      `${directSettlementEnvelopeMarkers.summary}\n${summary("第一百零三章", "PENDING_NOT_ACTIVATED_N_PLUS_4")}`,
    chapter: "第一百零三章",
    heading: "pending overlay",
  }, options);
  assert.equal(pendingResult.pending_engine_candidate_created, true);
  assert.equal(await readFile(activeEnginePath, "utf8"), activeEngineText);
  latest = await getLatestSettledContinuityOverlay(options);
  assert.equal(latest.report_id, pendingResult.settlement_report_id);

  const beforeNewWrite = latest.report_id;
  await new Promise((resolve) => setTimeout(resolve, 20));
  const newestResult = await chatgpt_bridge_save_settlement_report({
    adoptedChapterId: directSettlementSentinelIds.adoptedChapterId,
    settlementContextId: directSettlementSentinelIds.settlementContextId,
    settlementReportText:
      `${directSettlementEnvelopeMarkers.summary}\n${summary("第一百零四章", "NEWEST_AFTER_REREAD_N_PLUS_5")}`,
    chapter: "第一百零四章",
    heading: "fresh reread",
    createPendingEngineCandidate: false,
  }, options);
  latest = await getLatestSettledContinuityOverlay(options);
  assert.notEqual(latest.report_id, beforeNewWrite);
  assert.equal(latest.report_id, newestResult.settlement_report_id);

  const built = await buildGptWritingContext({
    task_prompt: oldTaskPrompt,
    generation_context: {
      content: "latest chapter: OLD_GENERATED_N",
      latest_settled_continuity: { report_id: firstId },
    },
    retrieval_context: {
      content: "continuity: OLD_GENERATED_N",
      latest_settled_continuity: { report_id: secondId },
    },
    chapter_mode: "next_chapter",
    include_visual_references: false,
    max_context_chars: 48_000,
  }, options);
  assert.equal(
    built.bundle.latest_settled_continuity.report_id,
    newestResult.settlement_report_id,
  );
  assert.equal(
    built.bundle.inputs.generation_context.latest_settled_continuity.report_id,
    newestResult.settlement_report_id,
  );
  assert.equal(
    built.bundle.inputs.retrieval_context.latest_settled_continuity.report_id,
    newestResult.settlement_report_id,
  );
  assert.match(built.bundle.task_prompt, /LATEST_SETTLED_CONTINUITY_OVERRIDE/u);
  assert.match(
    built.bundle.latest_settled_continuity.summary_text,
    /NEWEST_AFTER_REREAD_N_PLUS_5/u,
  );
  assert.equal(await readFile(activeEnginePath, "utf8"), activeEngineText);

  console.log("Phase58B direct settlement overlay regression test passed.");
} finally {
  await Promise.all([
    rm(outputFixture, { recursive: true, force: true }),
    rm(canonFixture, { recursive: true, force: true }),
  ]);
}

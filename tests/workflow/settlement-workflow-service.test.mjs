import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  adoptCandidateDraft,
  saveCandidateDraft,
  updateCandidateDraftStatus,
} from "../../server/src/writing-workflow-service.mjs";
import {
  buildSettlementContext,
  createPendingCandidateFromSettlementReport,
  getSettlementContext,
  getSettlementReport,
  listSettlementContexts,
  listSettlementReports,
  saveSettlementReport,
} from "../../server/src/settlement-workflow-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureRoot = path.join(projectPaths.writingWorkflow, ".settlement-workflow-test");
const fixtureActive = path.join(projectPaths.canonDb, ".settlement-workflow-active-test.md");
const fixturePending = path.join(projectPaths.canonDb, ".settlement-workflow-pending-test");
const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function names(dirPath) {
  try {
    return new Set(await readdir(dirPath));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNew(dirPath, before) {
  for (const name of await names(dirPath)) {
    if (!before.has(name)) await rm(path.join(dirPath, name), { recursive: true, force: true });
  }
}

async function expectReject(action, message) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(message);
}

function settlement(candidateText) {
  return `## 新版完整創作引擎候選\n\n\`\`\`md\n${candidateText}\n\`\`\`\n`;
}

async function createAdoptedChapter(label, options) {
  const draft = await saveCandidateDraft({
    draftText: `${label} 正文。\n\n只包含已成立內容。`,
    sourceChapter: label,
  }, options);
  const adopted = await adoptCandidateDraft(draft.metadata.draft_id, {
    confirm: true,
    adoptedBy: "settlement_workflow_test",
  }, options);
  return { draft, adopted };
}

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine);
  const productionHash = hash(productionActive);
  const pendingBefore = await names(projectPaths.pendingEngineCandidates);
  const snapshotsBefore = await names(projectPaths.engineSnapshots);
  const archiveBefore = await names(projectPaths.engineArchive);
  const activationLogsBefore = await names(projectPaths.activationLogs);
  const transactionsBefore = await names(transactionDir);
  const activeText = [
    "# 完整創作引擎 settlement-workflow-test",
    ...Array.from({ length: 40 }, (_, index) => `規則 ${index + 1}：維持既有設定。`),
  ].join("\n");
  const options = {
    writingWorkflow: fixtureRoot,
    activeEnginePath: fixtureActive,
    pendingEngineCandidates: fixturePending,
  };
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(fixturePending, { recursive: true, force: true });
  await writeFile(fixtureActive, `${activeText}\n`, "utf8");

  try {
    const { adopted } = await createAdoptedChapter("第二十一章", options);
    const adoptedId = adopted.metadata.adopted_chapter_id;
    const context = await buildSettlementContext(adoptedId, {
      note: "Phase 4B context",
    }, options);
    const contextId = context.metadata.settlement_context_id;
    assert(context.status.status === "ready", "Settlement context was not ready.");
    assert(context.metadata.active_engine_hash === hash(`${activeText}\n`), "Active hash was wrong.");
    assert(
      context.source_manifest.sources.some(
        (source) => source.label === "adopted_chapter" && source.exists,
      ),
      "Settlement context omitted adopted chapter source.",
    );
    for (const file of [
      "settlement_context.md",
      "adopted_chapter.md",
      "source_manifest.json",
      "metadata.json",
      "status.json",
    ]) {
      assert(
        await readFile(path.join(
          fixtureRoot,
          "settlements",
          "contexts",
          contextId,
          file,
        )),
        `Settlement context file missing: ${file}`,
      );
    }
    assert(
      (await listSettlementContexts(options)).some(
        (item) => item.settlement_context_id === contextId,
      ),
      "Settlement context list omitted context.",
    );
    assert(
      (await getSettlementContext(contextId, options)).settlement_context_text
        .includes("不得直接啟用 active_engine"),
      "Settlement context omitted activation boundary.",
    );

    const candidateText = `${activeText}\n新增規則：保留第二十一章已成立結果。`;
    const report = await saveSettlementReport({
      settlementContextId: contextId,
      settlementText: settlement(candidateText),
      sourceChapter: "第二十一章",
      note: "Phase 4B report",
    }, options);
    const reportId = report.metadata.settlement_report_id;
    assert(
      report.status.status === "settlement_report_saved",
      "Settlement report status was wrong.",
    );
    assert(report.neural_usage.used_neural_network === false, "Text created neural success.");
    assert(
      report.metadata.source_candidate_id === adopted.metadata.draft_id,
      "Settlement report lost source candidate id.",
    );
    assert(report.metadata.source_engine_first === false, "Untraced source claimed engine-first.");
    assert(
      report.metadata.source_pipeline_status === "incomplete_engine_pipeline"
        && report.metadata.source_neural_trace_complete === false,
      "Settlement report lost incomplete source pipeline state.",
    );
    assert(
      report.metadata.blocking_warnings.includes("incomplete_source_pipeline"),
      "Settlement report omitted incomplete source warning.",
    );
    assert(report.metadata.settlement_neural_pipeline_required === true, "Settlement neural pipeline was optional.");
    
      assert(
        report.metadata.settlement_required_neural_modules.length === 6,
        "Settlement required neural wrapper list was incomplete.",
      );
    assert(
      report.metadata.settlement_pipeline_status === "incomplete_engine_pipeline"
        && report.metadata.settlement_neural_trace_complete === false,
      "Missing settlement traces were not marked incomplete.",
    );
    assert(
      (await listSettlementReports(options)).some(
        (item) => item.settlement_report_id === reportId,
      ),
      "Settlement report list omitted report.",
    );
    assert(
      (await getSettlementReport(reportId, options)).settlement_text.includes(candidateText),
      "Settlement report returned wrong text.",
    );
    assert(hash(await readFile(fixtureActive)) === hash(`${activeText}\n`), "Report changed active engine.");

    const created = await createPendingCandidateFromSettlementReport(reportId, {}, options);
    const candidateId = created.pending_candidate.metadata.candidate_id;
    assert(
      created.pending_candidate.status.status === "candidate",
      "Phase 2 did not create candidate status.",
    );
    assert(created.pending_candidate.diff, "Pending candidate did not contain diff.");
    assert(created.pending_candidate.risk_report, "Pending candidate did not contain risk report.");
    assert(
      created.pending_candidate.metadata.requires_neural_modules === true
        && created.pending_candidate.metadata.blocking_warnings.includes(
          "missing_settlement_neural_trace",
        ),
      "Pending candidate ignored settlement neural blocking warnings.",
    );
    assert(
      created.settlement_report.status.status === "pending_candidate_created"
        && created.settlement_report.status.pending_candidate_id === candidateId,
      "Settlement report was not linked to pending candidate.",
    );
    assert(
      created.adopted_chapter.status.status === "settlement_candidate_created"
        && created.adopted_chapter.status.settlement_candidate_id === candidateId,
      "Adopted chapter was not linked to pending candidate.",
    );
    assert(hash(await readFile(fixtureActive)) === hash(`${activeText}\n`), "Candidate import changed active.");

    for (const invalidStatus of ["rejected", "archived", "blocked"]) {
      const invalid = await createAdoptedChapter(`Invalid ${invalidStatus}`, options);
      await updateCandidateDraftStatus(invalid.draft.metadata.draft_id, {
        status: invalidStatus,
      }, options);
      await expectReject(
        () => buildSettlementContext(invalid.adopted.metadata.adopted_chapter_id, {}, options),
        `${invalidStatus} draft created settlement context.`,
      );
    }

    const missingActive = await createAdoptedChapter("Missing active", options);
    await rm(fixtureActive, { force: true });
    const blockedContext = await buildSettlementContext(
      missingActive.adopted.metadata.adopted_chapter_id,
      {},
      options,
    );
    assert(blockedContext.status.status === "blocked", "Missing active context was not blocked.");
    assert(
      blockedContext.status.blocked_reason === "active_engine.md 不存在",
      "Missing active blocked reason was wrong.",
    );
    await expectReject(
      () => saveSettlementReport({
        settlementContextId: blockedContext.metadata.settlement_context_id,
        settlementText: settlement(candidateText),
      }, options),
      "Blocked context saved settlement report.",
    );
    await writeFile(fixtureActive, `${activeText}\n`, "utf8");

    const blockedReportPath = path.join(
      fixtureRoot,
      "settlements",
      "reports",
      reportId,
      "status.json",
    );
    const linkedStatus = JSON.parse(await readFile(blockedReportPath, "utf8"));
    await writeFile(blockedReportPath, `${JSON.stringify({
      ...linkedStatus,
      status: "blocked",
      blocked_reason: "fixture",
      can_create_pending_candidate: false,
    }, null, 2)}\n`, "utf8");
    await expectReject(
      () => createPendingCandidateFromSettlementReport(reportId, {}, options),
      "Blocked settlement report created pending candidate.",
    );

    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Production active changed.");
    assert(
      JSON.stringify([...await names(projectPaths.pendingEngineCandidates)].sort())
        === JSON.stringify([...pendingBefore].sort()),
      "Phase 4B polluted production pending candidates.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.engineSnapshots)].sort())
        === JSON.stringify([...snapshotsBefore].sort()),
      "Phase 4B changed snapshots.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.engineArchive)].sort())
        === JSON.stringify([...archiveBefore].sort()),
      "Phase 4B changed archive.",
    );
    assert(
      JSON.stringify([...await names(projectPaths.activationLogs)].sort())
        === JSON.stringify([...activationLogsBefore].sort()),
      "Phase 4B changed activation logs.",
    );
    console.log("Settlement workflow service test passed.");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
    await rm(fixtureActive, { force: true });
    await rm(fixturePending, { recursive: true, force: true });
    await removeNew(transactionDir, transactionsBefore);
    assert(hash(await readFile(projectPaths.activeEngine)) === productionHash, "Cleanup changed active.");
  }
}

main().catch((error) => {
  console.error(`Settlement workflow service test failed: ${error.message}`);
  process.exitCode = 1;
});

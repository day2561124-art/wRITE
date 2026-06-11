import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  activatePendingCandidate,
  detectRiskChanges,
  generateEngineDiff,
  importSettlementResult,
  listActivationLogs,
  listPendingCandidates,
  listSnapshots,
  parseEngineCandidate,
  rejectPendingCandidate,
  reparsePendingCandidate,
  rollbackActiveEngine,
} from "../../server/src/engine-candidate-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const fixtureRoot = path.join(rootDir, "data", "canon_db", ".engine-candidate-test");
const fixturePending = path.join(fixtureRoot, "pending");
const fixtureActive = path.join(fixtureRoot, "active_engine.md");
const missingActive = path.join(fixtureRoot, "missing_active_engine.md");
const fixtureSnapshots = path.join(fixtureRoot, "engine_snapshots");
const fixtureArchive = path.join(fixtureRoot, "archive");
const fixtureActivationLog = path.join(fixtureRoot, "activation_logs", "activation_log.jsonl");
const fixtureRollbackIndex = path.join(fixtureRoot, "rollback", "rollback_index.json");
const productionActive = path.join(rootDir, "data", "canon_db", "active_engine.md");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function settlement(candidateText, heading = "新版完整創作引擎候選") {
  return `## ${heading}\n\n\`\`\`md\n${candidateText}\n\`\`\`\n`;
}

async function main() {
  const productionBefore = await readFile(productionActive);
  const activeText = [
    "# 完整創作引擎 v-test",
    ...Array.from({ length: 40 }, (_, index) => `規則 ${index + 1}：維持既有設定。`),
  ].join("\n");
  await rm(fixtureRoot, { recursive: true, force: true });
  await mkdir(fixturePending, { recursive: true });
  await writeFile(fixtureActive, `${activeText}\n`, "utf8");
  const options = {
    activeEnginePath: fixtureActive,
    pendingEngineCandidates: fixturePending,
    engineSnapshots: fixtureSnapshots,
    engineArchive: fixtureArchive,
    activationLog: fixtureActivationLog,
    rollbackIndex: fixtureRollbackIndex,
  };

  try {
    const parsed = parseEngineCandidate(settlement(activeText));
    assert(parsed.ok, "Fenced candidate block was not parsed.");
    assert(parsed.candidateText === activeText, "Parsed candidate content changed unexpectedly.");
    assert(
      !parseEngineCandidate("## 檢核結果\n\n已通過").ok,
      "Excluded result heading was incorrectly parsed as an engine.",
    );

    const successCandidate = `${activeText}\n新增規則：保持場景承接一致。`;
    const imported = await importSettlementResult({
      rawText: settlement(successCandidate),
      sourceChapter: "第十九章｜第一聲鈴",
      note: "service test",
      outputPath: productionActive,
    }, options);
    const candidateId = imported.metadata.candidate_id;
    const candidateDir = path.join(fixturePending, candidateId);
    const files = new Set(await readdir(candidateDir));
    for (const required of [
      "raw_import.txt",
      "candidate_engine.md",
      "metadata.json",
      "diff.json",
      "risk_report.json",
      "status.json",
    ]) {
      assert(files.has(required), `Successful import did not create ${required}.`);
    }
    assert(imported.status.status === "candidate", "Successful import was not a candidate.");
    assert(imported.status.can_activate === false, "Phase 2 candidate can_activate was not false.");
    assert(imported.diff.summary.added_count === 1, "Added line count was incorrect.");
    assert(
      path.dirname(candidateDir) === fixturePending,
      "Caller-controlled output path changed the candidate destination.",
    );

    const parseFailure = await importSettlementResult({
      rawText: "## 完成狀態\n\n不通過，沒有完整引擎區塊。",
    }, options);
    assert(parseFailure.status.status === "blocked", "Parse failure was not blocked.");
    assert(parseFailure.status.blocked_reason, "Parse failure did not preserve a blocked reason.");
    assert(parseFailure.status.can_activate === false, "Blocked candidate can_activate was not false.");

    const beforeBlankCount = (await readdir(fixturePending)).length;
    let blankRejected = false;
    try {
      await importSettlementResult({ rawText: "   " }, options);
    } catch {
      blankRejected = true;
    }
    assert(blankRejected, "Blank raw settlement text was accepted.");
    assert(
      (await readdir(fixturePending)).length === beforeBlankCount,
      "Blank import created a candidate directory.",
    );

    const missingResult = await importSettlementResult({
      rawText: settlement(activeText),
    }, {
      ...options,
      activeEnginePath: missingActive,
    });
    assert(missingResult.status.status === "blocked", "Missing active engine was not blocked.");
    assert(
      missingResult.status.blocked_reason.includes("active_engine.md"),
      "Missing active engine reason was not reported.",
    );

    const emptyResult = await importSettlementResult({
      rawText: "## 新版完整創作引擎候選\n\n```md\n\n```\n",
    }, options);
    assert(emptyResult.status.status === "blocked", "Empty candidate block was not blocked.");

    const directDiff = generateEngineDiff("a\nb\nc", "a\nB\nc\nd");
    assert(directDiff.summary.modified_count === 1, "Modified line count was incorrect.");
    assert(directDiff.summary.added_count === 1, "Direct diff added line count was incorrect.");
    assert(directDiff.raw_unified_diff.includes("--- active_engine.md"), "Unified diff header missing.");

    const highText = `${activeText}\n本章確認角色死亡、長期失能、能力突破、代表資格變更與暗線核心真相。`;
    const highDiff = generateEngineDiff(activeText, highText);
    const highRisk = detectRiskChanges(highText, highDiff, activeText);
    assert(highRisk.risk_level === "high", "High-risk changes were not classified as high.");
    assert(highRisk.requires_second_confirmation, "High-risk changes did not require confirmation.");

    const contaminatedText = `${activeText}\nunknown rejected candidate 候選 未確認 未採用 退稿 外部研究 推論`;
    const contaminatedDiff = generateEngineDiff(activeText, contaminatedText);
    const contaminatedRisk = detectRiskChanges(contaminatedText, contaminatedDiff, activeText);
    assert(contaminatedRisk.risk_level === "critical", "Contamination was not critical.");
    assert(contaminatedRisk.blocked_terms.length >= 9, "Contamination terms were not recorded.");
    const contaminatedImport = await importSettlementResult({
      rawText: settlement(contaminatedText),
    }, options);
    assert(contaminatedImport.status.status === "blocked", "Contaminated import was not blocked.");

    const shortenedText = activeText.split("\n").slice(0, 5).join("\n");
    const shortenedImport = await importSettlementResult({
      rawText: settlement(shortenedText),
    }, options);
    assert(shortenedImport.risk_report.risk_level === "critical", "Large deletion was not critical.");
    assert(shortenedImport.status.status === "blocked", "Large deletion was not blocked.");

    const activationCandidateText = `${activeText}\n啟用測試規則：保持交易完整。`;
    const activationCandidate = await importSettlementResult({
      rawText: settlement(activationCandidateText),
      sourceChapter: "第二十章",
    }, options);
    const activationCandidateId = activationCandidate.metadata.candidate_id;
    let unconfirmedBlocked = false;
    try {
      await activatePendingCandidate(activationCandidateId, {}, options);
    } catch {
      unconfirmedBlocked = true;
    }
    assert(unconfirmedBlocked, "Candidate activated without user confirmation.");
    assert(
      hash(await readFile(fixtureActive)) === hash(`${activeText}\n`),
      "Unconfirmed activation changed active_engine.md.",
    );

    for (const [label, failAfter] of [
      ["snapshot", 1],
      ["archive", 3],
      ["active engine", 5],
    ]) {
      process.env.FILE_TRANSACTION_TEST_MODE = "1";
      let failed = false;
      try {
        await activatePendingCandidate(
          activationCandidateId,
          { confirm: true },
          { ...options, testFailAfterCommits: failAfter },
        );
      } catch {
        failed = true;
      } finally {
        delete process.env.FILE_TRANSACTION_TEST_MODE;
      }
      assert(failed, `${label} failure injection did not fail activation.`);
      assert(
        hash(await readFile(fixtureActive)) === hash(`${activeText}\n`),
        `${label} failure changed active_engine.md.`,
      );
      assert(
        (await readdir(fixtureSnapshots).catch(() => [])).length === 0,
        `${label} failure left a snapshot behind.`,
      );
      assert(
        (await readdir(fixtureArchive).catch(() => [])).length === 0,
        `${label} failure left an archive behind.`,
      );
    }

    const activated = await activatePendingCandidate(
      activationCandidateId,
      { confirm: true, approvedBy: "service_test" },
      options,
    );
    assert(
      await readFile(fixtureActive, "utf8") === `${activationCandidateText}\n`,
      "Activated active_engine.md does not equal candidate_engine.md.",
    );
    const activationStatus = JSON.parse(await readFile(
      path.join(fixturePending, activationCandidateId, "status.json"),
      "utf8",
    ));
    assert(activationStatus.status === "activated", "Candidate status was not activated.");
    assert(
      await readFile(
        path.join(fixtureSnapshots, activated.snapshot_id, "active_engine_before_activation.md"),
        "utf8",
      ) === `${activeText}\n`,
      "Activation snapshot did not preserve the previous active engine.",
    );
    assert(
      await readFile(
        path.join(fixtureArchive, activated.archive_id, "archived_active_engine.md"),
        "utf8",
      ) === `${activeText}\n`,
      "Activation archive did not preserve the previous active engine.",
    );
    assert(
      (await listActivationLogs(options)).some(
        (entry) => entry.event === "activate_pending_engine_candidate"
          && entry.candidate_id === activationCandidateId,
      ),
      "Activation log did not record activation.",
    );
    assert(
      (await listSnapshots(options)).some((entry) => entry.snapshot_id === activated.snapshot_id),
      "Snapshot list omitted the activation snapshot.",
    );
    assert(
      JSON.parse(await readFile(fixtureRollbackIndex, "utf8")).activations.length === 1,
      "Rollback index did not record activation.",
    );
    let activatedAgainBlocked = false;
    try {
      await activatePendingCandidate(activationCandidateId, { confirm: true }, options);
    } catch {
      activatedAgainBlocked = true;
    }
    assert(activatedAgainBlocked, "Activated candidate was activated twice.");

    for (const invalidCandidate of [parseFailure, contaminatedImport, shortenedImport]) {
      let blocked = false;
      try {
        await activatePendingCandidate(
          invalidCandidate.metadata.candidate_id,
          { confirm: true, secondConfirm: true },
          options,
        );
      } catch {
        blocked = true;
      }
      assert(blocked, `${invalidCandidate.status.status} candidate was activated.`);
    }

    const rejectedCandidate = await importSettlementResult({
      rawText: settlement(`${activationCandidateText}\n放棄候選測試。`),
    }, options);
    await rejectPendingCandidate(rejectedCandidate.metadata.candidate_id, { reason: "reject test" }, options);
    let rejectedActivationBlocked = false;
    try {
      await activatePendingCandidate(
        rejectedCandidate.metadata.candidate_id,
        { confirm: true },
        options,
      );
    } catch {
      rejectedActivationBlocked = true;
    }
    assert(rejectedActivationBlocked, "Rejected candidate was activated.");

    const highBase = (await readFile(fixtureActive, "utf8")).trimEnd();
    const highCandidateText = `${highBase}\n本章確認角色死亡、能力突破與暗線核心真相。`;
    const highCandidate = await importSettlementResult({
      rawText: settlement(highCandidateText),
      sourceChapter: "高風險章",
    }, options);
    assert(highCandidate.risk_report.risk_level === "high", "High-risk import was not high.");
    let missingSecondBlocked = false;
    try {
      await activatePendingCandidate(
        highCandidate.metadata.candidate_id,
        { confirm: true, secondConfirm: false },
        options,
      );
    } catch {
      missingSecondBlocked = true;
    }
    assert(missingSecondBlocked, "High-risk candidate activated without second confirmation.");
    const highActivated = await activatePendingCandidate(
      highCandidate.metadata.candidate_id,
      { confirm: true, secondConfirm: true },
      options,
    );
    const highArchiveMetadata = JSON.parse(await readFile(
      path.join(fixtureArchive, highActivated.archive_id, "metadata.json"),
      "utf8",
    ));
    assert(highArchiveMetadata.retention === "high_risk", "High-risk archive retention was wrong.");

    const neuralBase = (await readFile(fixtureActive, "utf8")).trimEnd();
    const fakeRunId = "agent_run_20260611-120000-a1b2c3d4";
    const neuralCandidate = await importSettlementResult({
      rawText: settlement(`${neuralBase}\n神經證據檢查規則。`),
      runId: fakeRunId,
      requiresNeuralModules: true,
      neuralModulesUsedPath: `data/agent_runs/${fakeRunId}/neural_modules_used.json`,
    }, options);
    let neuralBlocked = false;
    try {
      await activatePendingCandidate(
        neuralCandidate.metadata.candidate_id,
        { confirm: true },
        options,
      );
    } catch (error) {
      neuralBlocked = error.message.includes("neural_trace_missing");
    }
    assert(neuralBlocked, "Missing required neural trace did not block activation.");

    const beforeFailedRollback = await readFile(fixtureActive);
    process.env.FILE_TRANSACTION_TEST_MODE = "1";
    let rollbackFailed = false;
    try {
      await rollbackActiveEngine(
        activated.snapshot_id,
        { confirm: true },
        { ...options, testFailAfterCommits: 3 },
      );
    } catch {
      rollbackFailed = true;
    } finally {
      delete process.env.FILE_TRANSACTION_TEST_MODE;
    }
    assert(rollbackFailed, "Rollback failure injection did not fail.");
    assert(
      hash(await readFile(fixtureActive)) === hash(beforeFailedRollback),
      "Failed rollback changed active_engine.md.",
    );

    let rollbackWithoutConfirmBlocked = false;
    try {
      await rollbackActiveEngine(activated.snapshot_id, {}, options);
    } catch {
      rollbackWithoutConfirmBlocked = true;
    }
    assert(rollbackWithoutConfirmBlocked, "Rollback succeeded without confirmation.");
    const rolledBack = await rollbackActiveEngine(
      activated.snapshot_id,
      { confirm: true, approvedBy: "service_test" },
      options,
    );
    assert(
      await readFile(fixtureActive, "utf8") === `${activeText}\n`,
      "Rollback did not restore snapshot content.",
    );
    assert(
      (await listSnapshots(options)).some(
        (entry) => entry.snapshot_id === rolledBack.safety_snapshot_id,
      ),
      "Rollback did not create a safety snapshot.",
    );
    assert(
      (await listActivationLogs(options)).some(
        (entry) => entry.event === "rollback_active_engine"
          && entry.target_snapshot_id === activated.snapshot_id,
      ),
      "Activation log did not record rollback.",
    );

    const rejected = await rejectPendingCandidate(candidateId, { reason: "不採用此版本" }, options);
    assert(rejected.status.status === "rejected", "Candidate was not rejected.");
    assert(rejected.status.rejected_at, "Rejected candidate has no rejected_at.");
    assert(rejected.status.rejection_reason === "不採用此版本", "Rejection reason was not saved.");
    let rejectedReparseBlocked = false;
    try {
      await reparsePendingCandidate(candidateId, options);
    } catch {
      rejectedReparseBlocked = true;
    }
    assert(rejectedReparseBlocked, "Rejected candidate was reparsed in place.");

    const reparsed = await reparsePendingCandidate(
      parseFailure.metadata.candidate_id,
      options,
    );
    assert(reparsed.status.status === "blocked", "Blocked candidate reparse changed invalid raw input.");
    assert(reparsed.metadata.reparsed_at, "Reparse timestamp was not saved.");

    const listed = await listPendingCandidates(options);
    assert(listed.length >= 10, "Pending candidate list omitted test records.");
    assert(
      hash(await readFile(fixtureActive)) === hash(`${activeText}\n`),
      "Fixture active engine changed during Phase 2 operations.",
    );
    assert(
      hash(await readFile(productionActive)) === hash(productionBefore),
      "Production active_engine.md changed during service tests.",
    );
    console.log("Engine candidate service test passed.");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
    const productionAfter = await readFile(productionActive);
    assert(
      hash(productionAfter) === hash(productionBefore),
      "Production active_engine.md changed after service test cleanup.",
    );
  }
}

main().catch((error) => {
  console.error(`Engine candidate service test failed: ${error.message}`);
  process.exitCode = 1;
});

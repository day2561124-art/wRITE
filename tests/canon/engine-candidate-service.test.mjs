import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectRiskChanges,
  generateEngineDiff,
  importSettlementResult,
  listPendingCandidates,
  parseEngineCandidate,
  rejectPendingCandidate,
  reparsePendingCandidate,
} from "../../server/src/engine-candidate-service.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const fixtureRoot = path.join(rootDir, "data", "canon_db", ".engine-candidate-test");
const fixturePending = path.join(fixtureRoot, "pending");
const fixtureActive = path.join(fixtureRoot, "active_engine.md");
const missingActive = path.join(fixtureRoot, "missing_active_engine.md");
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
    assert(listed.length >= 6, "Pending candidate list omitted test records.");
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

import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateCandidateAgainstAnchor } from "../../server/src/chapter-anchor-guard.mjs";
import { formatGuardReportForDisplay } from "../../server/src/guard-report-display.mjs";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const bundleId = "gptctx_20260618-000000-abcdef12";
const candidateText = [
  "朝日奈千夜與九逃在醫療後座確認九逃勝，裁定中止沒有改變。",
  "新生名叫霧島澪，轉學生叫做白川遙，旁聽者代號是雨宮。",
  "青峰老師和黑川醫師被臨時叫進處置室。",
].join("\n");

function makeBundle() {
  return {
    bundle_id: bundleId,
    created_at: "2026-06-18T00:00:00.000Z",
    content: {
      chapter_anchor: {
        locked_result: "九逃勝",
        required_core_characters: ["朝日奈千夜", "九逃"],
        allowed_supporting_characters: [],
        forbidden_characters: ["江止澄", "蒼藤嵐", "周念今", "安岫", "建瑞凰"],
      },
    },
    anchor_confidence: "high",
    sources: {
      active_engine: { hash: "phase22p-test-active-engine" },
    },
  };
}

{
  const result = evaluateCandidateAgainstAnchor(makeBundle(), candidateText);
  const display = formatGuardReportForDisplay(result.guard_report);
  assert.equal(display.count, 1, "Display should summarize one P1 guard entry.");
  assert.equal(display.blocking_count, 0, "P1 display must remain non-blocking.");
  assert.equal(display.warning_count, 1, "P1 display should be counted as warning.");
  assert.ok(display.text.includes("疑似新增角色過多"), "Display text should expose a readable P1 title.");
  assert.ok(display.text.includes("明確命名語境"), "Display text should translate explicit_introduction.");
  assert.ok(display.text.includes("角色稱謂語境"), "Display text should translate role_suffix.");
  assert.ok(display.text.includes("證據「青峰老師」"), "Display text should include evidence.");
  assert.ok(display.text.includes("不在目前短名白名單中"), "Display text should include whitelist status.");
}

{
  const result = evaluateCandidateAgainstAnchor(makeBundle(), "朝日奈千夜勝。九逃敗。這場比賽結果改寫為千夜勝。");
  const display = formatGuardReportForDisplay(result.guard_report);
  assert.equal(display.has_blocking_errors, true, "P0 display should preserve blocking classification.");
  assert.ok(display.text.includes("結果與 locked_result 衝突"), "P0 display should expose a readable title.");
  assert.ok(display.text.includes("P0 會阻擋後續採用"), "P0 display should include blocking action guidance.");
}

{
  const fixtureRoot = path.join(projectPaths.outputs, ".phase22p-guard-report-display-polish");
  const gptWritingContexts = path.join(fixtureRoot, "gpt_writing_contexts");
  const writingCandidates = path.join(fixtureRoot, "writing_candidates");
  const bundleDir = path.join(gptWritingContexts, bundleId);
  await rm(fixtureRoot, { recursive: true, force: true });
  await mkdir(bundleDir, { recursive: true });
  await writeFile(path.join(bundleDir, "context_bundle.json"), `${JSON.stringify(makeBundle(), null, 2)}\n`);
  await writeFile(path.join(bundleDir, "context_for_chat.md"), "# Phase22P fixture\n");

  try {
    const saved = await saveChatOutputAsWritingCandidate({
      sourceBundleId: bundleId,
      chatOutputText: candidateText,
      title: "Phase22P fixture",
      chapterLabel: "Phase22P",
    }, { gptWritingContexts, writingCandidates });
    assert.equal(saved.candidate_created, true, "Candidate should be saved.");
    assert.equal(saved.canon_status, "candidate_only", "Candidate should remain candidate-only.");
    assert.ok(Array.isArray(saved.guard_report), "Saved result should preserve raw guard_report.");
    assert.ok(saved.guard_report_display?.text?.includes("疑似新增角色過多"), "Saved result should expose readable guard display.");

    const detail = await getWritingCandidateDetail(saved.candidate_id, { writingCandidates });
    assert.ok(detail.metadata.guard_report_display?.text?.includes("明確命名語境"), "Metadata should persist display text for UI consumers.");
    assert.ok(detail.guard_report_display?.entries?.[0]?.details?.some((line) => line.includes("證據「青峰老師」")), "Detail should expose readable guard details.");
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}

console.log("Phase22P guard report display polish tests passed.");

import { readFile, writeFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { chatgptBridgeTools } from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { buildApprovalQueueReadinessReport } from "../../server/src/approval-queue-readiness-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const suffix = ".phase22b-test";
const options = {
  gptWritingContexts: path.join(projectPaths.gptWritingContexts, suffix),
  writingCandidates: path.join(projectPaths.writingCandidates, suffix),
  proofingContexts: path.join(projectPaths.proofingContexts, suffix),
  proofReports: path.join(projectPaths.proofReports, suffix),
  approvalQueue: path.join(projectPaths.approvalQueue, suffix),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await Promise.all(Object.values(options).map((d) => rm(d, { recursive: true, force: true })));

  // Build writing context with explicit generation_context that includes chapter anchor hints
  const writing = (await chatgptBridgeTools.chatgpt_bridge_build_writing_context({
    task_prompt: "Phase22B anchor test",
    generation_context: { note: "第十九章〈第一聲鈴〉正式結算後 朝日奈千夜 九逃 九逃勝 裁定中止 醫療後座" },
    include_active_engine: false,
  }, options)).result;

  // 1) Negative test: candidate containing forbidden character must be blocked
  const badText = "這段候選包含錯誤人物：江止澄 出現於場景中。";
  const badCandidate = (await chatgptBridgeTools.chatgpt_bridge_save_candidate({
    source_bundle_id: writing.bundle.bundle_id,
    chat_output_text: badText,
    title: "Bad Candidate",
  }, options)).result;

  assert(badCandidate.candidate_created === true, "bad candidate should be created");
  // The save operation should succeed but metadata should record the guard report and blocked status
  assert(Array.isArray(badCandidate.guard_report) && badCandidate.guard_report.some((r) => r.code === "P0_FORBIDDEN_CHARACTER"), "guard_report must include P0_FORBIDDEN_CHARACTER");
  const metaPath = path.join(options.writingCandidates, badCandidate.candidate_id, "candidate.json");
  const meta = JSON.parse(await readFile(metaPath, "utf8"));
  assert(meta.canon_status === "blocked", "candidate metadata canon_status must be 'blocked' when P0 guard triggers");

  // 2) Positive test: candidate with required core characters and allowed scope should not be P0 blocked
  const goodText = "朝日奈千夜 感受著場內的寂靜。九逃 在比賽中倒在場上，九逃勝，裁定中止。醫療後座與短期限制正在安排。青峰老師在旁邊觀察。";
  const goodCandidate = (await chatgptBridgeTools.chatgpt_bridge_save_candidate({
    source_bundle_id: writing.bundle.bundle_id,
    chat_output_text: goodText,
    title: "Good Candidate",
  }, options)).result;

  assert(goodCandidate.candidate_created === true, "good candidate should be created");
  // good candidate should not have P0 guard entries
  assert(!(Array.isArray(goodCandidate.guard_report) && goodCandidate.guard_report.some((r) => r.code && r.code.startsWith("P0"))), "good candidate must not have P0 guard entries");

  console.log("Phase22B wrong-cast tests passed.");
}

main().catch((err) => {
  console.error(`Phase22B test failed: ${err.message}`);
  process.exitCode = 1;
});

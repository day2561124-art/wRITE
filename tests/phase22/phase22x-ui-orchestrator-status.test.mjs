import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import { saveChatOutputAsWritingCandidate } from "../../server/src/chat-output-candidate-service.mjs";
import { buildWriterWorkbenchState } from "../../server/src/writer-workbench-state-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const transactionDir = path.join(projectPaths.outputLogs, "transactions");

function hash(value) {
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
    if (!before.has(name)) await rm(path.join(directory, name), { recursive: true, force: true });
  }
}

const rawDraft = `
第〇章　夜裡的測試

走廊只剩下冷氣聲。

千夜站在販賣機前，我感受到一種難以言喻的壓迫感在胸口蔓延。
九逃看了她一眼，沒有立刻說話。

「我認為我們現在應該重新評估這件事的意義。」

空氣變得沉重。

下一秒，千夜的終端亮了。
螢幕上只有一行字。

——不要回宿舍。
`.trim();

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine, "utf8");
  const productionHash = hash(productionActive);
  const contextsBefore = await names(projectPaths.gptWritingContexts);
  const candidatesBefore = await names(projectPaths.writingCandidates);
  const transactionsBefore = await names(transactionDir);

  try {
    const context = await buildGptWritingContext({
      taskPrompt: "Phase22X: UI status for full neural orchestrator.",
      generation_context: {
        current_scene: "夜間走廊",
        expected_turn: "終端警告逼角色重新選擇",
      },
      retrieval_context: {
        canon_hint: "candidate only; do not update canon",
      },
      include_active_engine: false,
    });

    const saved = await saveChatOutputAsWritingCandidate({
      source_bundle_id: context.bundle.bundle_id,
      chat_output_text: rawDraft,
      raw_draft_text: rawDraft,
      title: "Phase22X UI candidate",
    });

    assert.equal(saved.candidate_created, true);
    assert(saved.full_neural_orchestration_report);

    const state = await buildWriterWorkbenchState();

    assert.equal(state.lineage.workflow_run_id, context.bundle.bundle_id);
    assert.equal(state.lineage.candidate_id, saved.candidate_id);
    assert.equal(state.chapter.full_neural_orchestrator_used, true);
    assert.equal(state.chapter.full_neural.used, true);
    assert.equal(state.chapter.full_neural.orchestrator_version, "phase22u-lite-v1");
    assert.equal(state.chapter.full_neural.pipeline_stage, "final_candidate_ready");
    assert.equal(state.chapter.full_neural.context_bundle_id, context.bundle.bundle_id);
    assert.equal(state.chapter.full_neural.candidate_only, true);
    assert.equal(state.chapter.full_neural.active_engine_update_allowed, false);
    assert.equal(state.chapter.full_neural.canon_update_allowed, false);
    assert.equal(state.health.full_neural_orchestrator, "final_candidate_ready");
    assert.equal(state.health.full_neural_orchestrator_version, "phase22u-lite-v1");

    const repoRoot = process.cwd();
    const uiServerSource = await readFile(path.join(repoRoot, "server", "src", "ui-server.mjs"), "utf8");
    const uiAppSource = await readFile(path.join(repoRoot, "server", "ui", "app.js"), "utf8");

    assert(uiServerSource.includes("rawDraftText:"));
    assert(uiAppSource.includes("rawDraftText"));
    assert(
      uiAppSource.includes("rawDraftText: chatOutputText")
      || uiAppSource.includes("rawDraftText: draftText"),
    );
    assert(uiAppSource.includes("workbench-neural-status"));
    assert(uiAppSource.includes("Full Neural Orchestrator"));

    assert.equal(hash(await readFile(projectPaths.activeEngine, "utf8")), productionHash);
    console.log("Phase22X UI orchestrator status tests passed.");
  } finally {
    await Promise.all([
      removeNew(projectPaths.gptWritingContexts, contextsBefore),
      removeNew(projectPaths.writingCandidates, candidatesBefore),
      removeNew(transactionDir, transactionsBefore),
    ]);
  }
}

main().catch((error) => {
  console.error(`Phase22X UI orchestrator status test failed: ${error.message}`);
  process.exitCode = 1;
});

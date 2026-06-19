import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  chatgpt_bridge_build_writing_context,
  chatgpt_bridge_save_candidate,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import {
  save_chat_output_as_writing_candidate,
} from "../../server/src/mcp-chat-output-candidate-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".phase22w-bridge-orchestrator-surface-test");
const fixtureContexts = path.join(projectPaths.gptWritingContexts, ".phase22w-bridge-orchestrator-surface-test");
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

function resultOf(toolResponse) {
  assert.equal(toolResponse.ok, true);
  assert.equal(toolResponse.blocked, false);
  return toolResponse.result;
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
  const transactionsBefore = await names(transactionDir);

  await Promise.all([
    rm(fixtureCandidates, { recursive: true, force: true }),
    rm(fixtureContexts, { recursive: true, force: true }),
  ]);

  try {
    const contextToolResponse = await chatgpt_bridge_build_writing_context({
      taskPrompt: "Phase22W: bridge surface for orchestrator-backed save.",
      generationContext: {
        current_scene: "夜間走廊",
        expected_turn: "終端警告逼角色重新選擇",
      },
      retrievalContext: {
        canon_hint: "candidate only; do not update canon",
      },
      includeActiveEngine: false,
    }, {
      gptWritingContexts: fixtureContexts,
    });

    const context = resultOf(contextToolResponse);

    const bridgeResponse = await chatgpt_bridge_save_candidate({
      sourceBundleId: context.bundle.bundle_id,
      chatOutputText: rawDraft,
      rawDraftText: rawDraft,
      title: "Phase22W bridge candidate",
      taskPrompt: "Phase22W: save via bridge surface.",
    }, {
      writingCandidates: fixtureCandidates,
      gptWritingContexts: fixtureContexts,
    });

    const bridgeResult = resultOf(bridgeResponse);


    assert.equal(bridgeResult.candidate_created, true);
    assert.equal(bridgeResponse.full_neural_orchestrator_used, true);
    assert(bridgeResponse.full_neural_orchestration_summary);
    assert.equal(
      bridgeResponse.full_neural_orchestration_summary.orchestrator_version,
      "phase22u-lite-v1",
    );
    assert.equal(
      bridgeResponse.full_neural_orchestration_summary.pipeline_stage,
      "final_candidate_ready",
    );
    assert.equal(bridgeResponse.created.length, 1);
    assert.equal(bridgeResponse.created[0].full_neural_orchestrator_used, true);
    assert.equal(bridgeResponse.created[0].full_neural_orchestrator_version, "phase22u-lite-v1");
    assert.equal(bridgeResponse.created[0].full_neural_pipeline_stage, "final_candidate_ready");
    assert.equal(bridgeResult.full_neural_orchestrator_used, true);
    assert.equal(bridgeResult.full_neural_orchestrator_version, "phase22u-lite-v1");
    assert.equal(bridgeResult.full_neural_pipeline_stage, "final_candidate_ready");
    assert(bridgeResult.full_neural_orchestration_summary);
    assert.equal(bridgeResult.candidate_only, true);
    assert.equal(
      bridgeResponse.full_neural_orchestration_summary.active_engine_update_allowed,
      false,
    );
    assert.equal(
      bridgeResponse.full_neural_orchestration_summary.canon_update_allowed,
      false,
    );

    const directResponse = await save_chat_output_as_writing_candidate({
      source_bundle_id: context.bundle.bundle_id,
      chat_output_text: rawDraft,
      raw_draft_text: rawDraft,
      title: "Phase22W low-level candidate",
    }, {
      writingCandidates: fixtureCandidates,
      gptWritingContexts: fixtureContexts,
    });

    const directResult = resultOf(directResponse);

    assert.equal(directResult.candidate_created, true);
    assert.equal(directResponse.full_neural_orchestrator_used, true);
    assert(directResponse.full_neural_orchestration_summary);
    assert.equal(
      directResponse.full_neural_orchestration_summary.pipeline_stage,
      "final_candidate_ready",
    );
    assert.equal(directResponse.created[0].full_neural_orchestrator_used, true);
    assert.equal(directResponse.created[0].full_neural_orchestrator_version, "phase22u-lite-v1");
    assert.equal(directResponse.created[0].full_neural_pipeline_stage, "final_candidate_ready");

    assert.equal(hash(await readFile(projectPaths.activeEngine, "utf8")), productionHash);
    console.log("Phase22W bridge orchestrator surface tests passed.");
  } finally {
    await Promise.all([
      rm(fixtureCandidates, { recursive: true, force: true }),
      rm(fixtureContexts, { recursive: true, force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Phase22W bridge orchestrator surface test failed: ${error.message}`);
  process.exitCode = 1;
});

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { buildFullNeuralWritingOrchestration } from "../../server/src/full-neural-writing-orchestrator-service.mjs";

const projectRoot = process.cwd();

async function withTempRoot(fn) {
  const tempRoot = await mkdtemp(path.join(
    projectRoot,
    "data",
    "outputs",
    ".phase22u-orchestrator-test-",
  ));
  try {
    return await fn(tempRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function contextOptions(tempRoot) {
  return {
    gptWritingContexts: path.join(tempRoot, "gpt_writing_contexts"),
  };
}

const baseInput = {
  task_prompt: "Phase22U test: build full neural writing orchestration.",
  generation_context: {
    current_scene: "夜間走廊",
    expected_turn: "終端警告推動下一幕",
  },
  retrieval_context: {
    canon_hint: "candidate only; do not update canon",
  },
};

await withTempRoot(async (tempRoot) => {
  const result = await buildFullNeuralWritingOrchestration({
    ...baseInput,
  }, contextOptions(tempRoot));

  assert.equal(result.pipeline_stage, "pre_generation_ready");
  assert.equal(result.pre_generation.status, "context_ready");
  assert.equal(result.raw_generation.status, "waiting_for_gpt_raw_draft");
  assert.equal(result.post_generation.status, "waiting_for_raw_draft");
  assert.equal(result.candidate_output.ready, false);
  assert.equal(result.candidate_output.active_engine_update_allowed, false);
  assert.equal(result.candidate_output.canon_update_allowed, false);
  assert.equal(result.orchestration_report.engine_first, true);
  assert.equal(result.orchestration_report.candidate_only, true);
  assert(result.pre_generation.context_bundle_path.includes("data/outputs/"));
  assert(result.pre_generation.writing_card_director_context_present);
});

await withTempRoot(async (tempRoot) => {
  const rawDraftText = `
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

  const result = await buildFullNeuralWritingOrchestration({
    ...baseInput,
    raw_draft_text: rawDraftText,
  }, contextOptions(tempRoot));

  assert.equal(result.pipeline_stage, "final_candidate_ready");
  assert.equal(result.raw_generation.status, "raw_draft_received");
  assert.equal(result.post_generation.status, "completed");
  assert.equal(result.candidate_output.ready, true);
  assert(result.candidate_output.final_candidate_text.includes("我胸口悶了一下"));
  assert(result.candidate_output.final_candidate_text.includes("先別急著定案。這事不對。"));
  assert(!result.candidate_output.final_candidate_text.includes("難以言喻的壓迫感"));
  assert(!/[。！？]{2,}/u.test(result.candidate_output.final_candidate_text));
  assert.equal(result.candidate_output.canon_status, "candidate_only");
  assert.equal(result.candidate_output.active_engine_update_allowed, false);
  assert.equal(result.candidate_output.canon_update_allowed, false);
  assert.equal(result.orchestration_report.writing_pipeline_complete, true);
  assert.equal(result.orchestration_report.raw_draft_hash, result.raw_generation.raw_draft_hash);
  assert.equal(result.orchestration_report.final_candidate_hash, result.candidate_output.final_candidate_hash);
  assert(result.post_generation.final_polisher_revision_report);
  assert.equal(
    result.post_generation.final_polisher_revision_report.structural_gate.status,
    "passed",
  );
});

await withTempRoot(async (tempRoot) => {
  const blocked = await buildFullNeuralWritingOrchestration({
    ...baseInput,
    raw_draft_text: "這一章正式設定為千夜新增能力為絕對支配。故事結束。",
  }, contextOptions(tempRoot));

  assert.equal(blocked.pipeline_stage, "structural_revision_required");
  assert.equal(blocked.candidate_output.ready, false);
  assert.equal(blocked.post_generation.needs_structural_revision, true);
  assert.equal(blocked.post_generation.suggested_return_stage, "writing_card_director");
  assert.equal(blocked.orchestration_report.writing_pipeline_complete, false);
});

console.log("Phase22U full neural writing orchestrator tests passed.");

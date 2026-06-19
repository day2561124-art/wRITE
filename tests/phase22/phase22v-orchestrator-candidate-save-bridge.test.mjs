import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildGptWritingContext } from "../../server/src/gpt-writing-context-service.mjs";
import {
  getWritingCandidateDetail,
  saveChatOutputAsWritingCandidate,
} from "../../server/src/chat-output-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const fixtureCandidates = path.join(projectPaths.writingCandidates, ".phase22v-orchestrator-candidate-save-test");
const fixtureContexts = path.join(projectPaths.gptWritingContexts, ".phase22v-orchestrator-candidate-save-test");
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

async function main() {
  const productionActive = await readFile(projectPaths.activeEngine, "utf8");
  const productionHash = hash(productionActive);
  const transactionsBefore = await names(transactionDir);

  await Promise.all([
    rm(fixtureCandidates, { recursive: true, force: true }),
    rm(fixtureContexts, { recursive: true, force: true }),
  ]);

  try {
    const context = await buildGptWritingContext({
      taskPrompt: "Phase22V: orchestrator-backed candidate save.",
      generation_context: {
        current_scene: "夜間走廊",
        expected_turn: "終端警告逼角色重新選擇",
      },
      retrieval_context: {
        canon_hint: "candidate only; do not update canon",
      },
      include_active_engine: false,
    }, {
      gptWritingContexts: fixtureContexts,
    });

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

    const saved = await saveChatOutputAsWritingCandidate({
      source_bundle_id: context.bundle.bundle_id,
      raw_draft_text: rawDraft,
      title: "Phase22V candidate",
      task_prompt: "Phase22V: save via full neural writing orchestrator.",
    }, {
      writingCandidates: fixtureCandidates,
      gptWritingContexts: fixtureContexts,
    });

    assert.equal(saved.candidate_created, true);
    assert.equal(saved.final_polisher_result.status, "completed");
    assert(saved.full_neural_orchestration_report);
    assert.equal(
      saved.full_neural_orchestration_report.orchestration_version,
      "phase22u-lite-v1",
    );
    assert.equal(
      saved.full_neural_orchestration_report.pipeline_stage,
      "final_candidate_ready",
    );
    assert.equal(
      saved.full_neural_orchestration_report.context_bundle_id,
      context.bundle.bundle_id,
    );

    const detail = await getWritingCandidateDetail(saved.candidate_id, {
      writingCandidates: fixtureCandidates,
      includeContent: true,
      maxContentChars: 2000,
    });

    assert(detail.content.includes("我胸口悶了一下"));
    assert(detail.content.includes("先別急著定案。這事不對。"));
    assert(!detail.content.includes("難以言喻的壓迫感"));
    assert(!/[。！？]{2,}/u.test(detail.content));

    assert.equal(detail.metadata.full_neural_orchestrator_version, "phase22u-lite-v1");
    assert.equal(detail.metadata.full_neural_pipeline_stage, "final_candidate_ready");
    assert(detail.metadata.full_neural_orchestration_report);
    assert.equal(
      detail.metadata.full_neural_orchestration_report.context_bundle_id,
      context.bundle.bundle_id,
    );
    assert.equal(detail.metadata.raw_draft_hash, hash(rawDraft));
    assert.equal(detail.metadata.polished_text_hash, saved.candidate_hash);
    assert.equal(detail.metadata.canon_status, "candidate_only");
    assert.equal(detail.metadata.active_engine_update_allowed, false);
    assert.equal(detail.metadata.canon_update_allowed, false);

    const blocked = await saveChatOutputAsWritingCandidate({
      source_bundle_id: context.bundle.bundle_id,
      raw_draft_text: "這一章正式設定為千夜新增能力為絕對支配。故事結束。",
    }, {
      writingCandidates: fixtureCandidates,
      gptWritingContexts: fixtureContexts,
    });

    assert.equal(blocked.candidate_created, false);
    assert.equal(blocked.needs_structural_revision, true);
    assert.equal(blocked.suggested_return_stage, "writing_card_director");
    assert(blocked.full_neural_orchestration_report);
    assert.equal(
      blocked.full_neural_orchestration_report.pipeline_stage,
      "structural_revision_required",
    );

    assert.equal(hash(await readFile(projectPaths.activeEngine, "utf8")), productionHash);
    console.log("Phase22V orchestrator candidate save bridge tests passed.");
  } finally {
    await Promise.all([
      rm(fixtureCandidates, { recursive: true, force: true }),
      rm(fixtureContexts, { recursive: true, force: true }),
    ]);
    await removeNew(transactionDir, transactionsBefore);
  }
}

main().catch((error) => {
  console.error(`Phase22V orchestrator candidate save bridge test failed: ${error.message}`);
  process.exitCode = 1;
});

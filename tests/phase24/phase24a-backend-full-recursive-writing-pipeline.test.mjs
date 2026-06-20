import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";
import {
  chatgpt_bridge_run_full_recursive_writing_pipeline,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

const root = process.cwd();
const protectedFiles = [
  projectPaths.activeEngine,
  path.join(root, "data", "writing_policy_db", "active_writing_card.md"),
  path.join(root, "data", "proofing_policy_db", "active_proofing_card.md"),
  path.join(root, "data", "longline_db", "active_longline.md"),
  projectPaths.compressedRules,
];
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
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

const completeText = `
走廊的燈閃了兩次，千夜停在門前，把受傷的手藏到背後。

九逃沒有追問，只把止痛貼放在桌角。「妳自己選。現在回去，或跟我去看終端。」

千夜按下螢幕。新的通知跳出來：候場順序提前，她們只剩十分鐘。
她抓起外套，門外已響起第二次集合鈴。
`.trim();

const blockedText = "這一章正式設定為千夜新增能力為絕對支配。故事結束。";

const baseInput = {
  task_prompt: "Phase24A deterministic backend writing test.",
  generation_context: { scene: "night corridor" },
  retrieval_context: { scope: "candidate only" },
  save_candidate: false,
};

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file)));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase24a-"));
const options = {
  gptWritingContexts: path.join(tempRoot, "contexts"),
  writingCandidates: path.join(tempRoot, "candidates"),
};

try {
  const missingProvider = await runFullRecursiveWritingPipeline(baseInput, options);
  assert.equal(missingProvider.status, "failed");
  assert.equal(missingProvider.stop_reason, "generation_provider_required");
  assert.equal(missingProvider.final_candidate_text, "");
  assert.equal(missingProvider.candidate_created, false);

  const noRevision = await runFullRecursiveWritingPipeline(baseInput, {
    ...options,
    generationAdapter: async () => ({
      text: completeText,
      model_name: "deterministic",
      model_version: "1",
    }),
  });
  assert.equal(noRevision.status, "completed");
  assert.equal(noRevision.pipeline_stage, "final_candidate_ready");
  assert(noRevision.final_candidate_text);
  assert.equal(noRevision.recursive_revision.status, "not_needed");
  assert.equal(noRevision.final_candidate_source, "backend_generation");
  assert.equal(noRevision.candidate_created, false);

  const revised = await runFullRecursiveWritingPipeline(baseInput, {
    ...options,
    generationAdapter: async () => ({ text: blockedText }),
    revisionAdapter: async () => ({ text: completeText }),
  });
  assert.equal(revised.status, "completed");
  assert.equal(revised.pipeline_stage, "final_candidate_ready_after_revision");
  assert.equal(revised.recursive_revision.status, "revised");
  assert.equal(revised.recursive_revision.rounds_attempted, 1);
  assert.equal(revised.final_candidate_source, "backend_recursive_revision");
  assert(revised.final_candidate_text.includes("集合鈴"));

  const exhausted = await runFullRecursiveWritingPipeline({
    ...baseInput,
    max_revision_rounds: 2,
  }, {
    ...options,
    generationAdapter: async () => ({ text: blockedText }),
    revisionAdapter: async () => ({ text: blockedText }),
  });
  assert.equal(exhausted.status, "failed");
  assert.equal(exhausted.pipeline_stage, "structural_revision_required");
  assert.equal(exhausted.stop_reason, "max_revision_rounds_exhausted");
  assert.equal(exhausted.recursive_revision.status, "failed");
  assert.equal(exhausted.recursive_revision.rounds_attempted, 2);
  assert.equal(exhausted.final_candidate_text, "");
  assert.equal(exhausted.candidate_created, false);

  const voiceBlocked = await runFullRecursiveWritingPipeline(baseInput, {
    ...options,
    generationAdapter: async () => ({ text: completeText }),
    characterVoiceGuardAdapter: async () => ({
      character_voice_guard_used: true,
      character_voice_registry_loaded: true,
      character_voice_guard_verdict: "fail",
      character_voice_guard_severity: "high",
      character_voice_guard_findings_count: 1,
      verdict: "fail",
      severity: "high",
      findings: [],
    }),
  });
  assert.equal(voiceBlocked.status, "completed");
  assert(voiceBlocked.final_candidate_text);
  assert.equal(voiceBlocked.character_voice_guard.display.blocking, true);
  assert.equal(voiceBlocked.direct_adoption_allowed, false);
  assert.equal(voiceBlocked.adoption_requires_approval_queue, true);
  assert.equal(voiceBlocked.final_text_can_be_displayed, true);

  const candidatesBeforePreview = await names(options.writingCandidates);
  await runFullRecursiveWritingPipeline(baseInput, {
    ...options,
    generationAdapter: async () => ({ text: completeText }),
  });
  assert.deepEqual(await names(options.writingCandidates), candidatesBeforePreview);

  const saved = await runFullRecursiveWritingPipeline({
    ...baseInput,
    save_candidate: true,
  }, {
    ...options,
    generationAdapter: async () => ({ text: completeText }),
  });
  assert.equal(saved.candidate_created, true);
  assert(saved.candidate_id);
  assert.equal(saved.canon_status, "candidate_only");
  assert.equal(saved.adopted, false);
  assert.equal(saved.settled, false);
  assert.equal(saved.active_engine_update_allowed, false);
  assert.equal(saved.canon_update_allowed, false);

  const bridge = await chatgpt_bridge_run_full_recursive_writing_pipeline(baseInput, {
    ...options,
    generationAdapter: async () => ({ text: completeText }),
  });
  assert.equal(bridge.ok, true);
  assert(bridge.result.final_candidate_text);
  assert.equal(bridge.result.output_mode, "chat_text");
  assert.equal(bridge.result.next_action, "output_final_candidate_text_to_chat");

  const failedBridge = await chatgpt_bridge_run_full_recursive_writing_pipeline(
    baseInput,
    options,
  );
  assert.equal(failedBridge.ok, true);
  assert.equal(failedBridge.result.final_candidate_text, "");
  assert.equal(failedBridge.result.stop_reason, "generation_provider_required");
  assert.equal(failedBridge.result.next_action, "configure_backend_generation_provider");

  const serverSource = await readFile(
    path.join(root, "server", "src", "mcp-server.mjs"),
    "utf8",
  );
  assert(serverSource.includes("chatgpt_bridge_run_full_recursive_writing_pipeline"));
  assert(serverSource.includes("save_candidate"));
  assert(serverSource.includes("max_revision_rounds"));
  assert(serverSource.includes("task_prompt"));

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file)), protectedBefore.get(file));
  }
  console.log("Phase24A backend full recursive writing pipeline tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildDramaticConflictManagerContext } from "../../server/src/dramatic-conflict-manager-service.mjs";
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
  projectPaths.entityRegistryData,
  projectPaths.entityRegistryIndex,
  projectPaths.entityRegistryBuildReport,
  projectPaths.entityRegistryConflictReport,
  projectPaths.entityRegistryProvenance,
];

const weakText = "Chiya waits. Kuto says nothing.";
const finalText = [
  "Chiya reaches the door first and keeps her hand on the reader long enough for the red light to blink twice.",
  "Kuto asks her to stop, not because he doubts her, but because the route behind that door will lock after one entry.",
  "She chooses the entry anyway. The cost is immediate: the old return path disappears from the terminal map.",
  "When the door opens, the team has not won. They have only changed the field, and now Kuto has to follow her into it.",
].join("\n\n");

const conflictPlan = {
  scene_function: "force the doorway decision into an irreversible route change",
  protagonist: "Chiya",
  protagonist_want: "enter the locked route before the opposition can seal it",
  opposition: "Kuto and the route lock",
  opposition_pressure: "Kuto wants her to wait, while the door system will close the return path",
  stakes: "if she waits, the next route is lost; if she enters, the old retreat path disappears",
  ticking_clock: "the red reader blinks twice before route lock",
  escalation_steps: [
    "reader rejects the first touch",
    "Kuto warns that the old route will vanish",
    "Chiya confirms anyway",
  ],
  reversal_or_reveal: "the confirmation does not open safety; it removes the old path",
  required_choice: "Chiya must choose between waiting for support and forcing entry",
  cost_or_payment: "the return path disappears from the terminal map",
  winner: "Chiya",
  loser: "the old safe route",
  new_status_quo: "the team must continue through the locked route with no clean retreat",
  ending_hook: "Kuto has to follow her into the changed field",
  must_not_resolve: ["do not turn this into a total victory"],
};

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

function finalPolisherAdapter({ raw_draft_text: draft, dramatic_conflict_manager: conflict }) {
  assert.equal(conflict.used, true);
  assert.equal(conflict.candidate_only, true);
  assert.equal(conflict.plan.protagonist, "Chiya");
  if (draft === weakText) {
    return {
      status: "completed",
      polished_text: draft,
      needs_structural_revision: true,
      suggested_return_stage: "draft_revision",
      revision_report: {
        structural_gate: {
          reasons: ["missing_scene_function", "missing_ending_event_hook"],
        },
        risk_flags: ["scene_lacks_concrete_objects"],
      },
      warnings: [],
    };
  }
  return {
    status: "completed",
    polished_text: draft,
    needs_structural_revision: false,
    warnings: [],
  };
}

const protectedBefore = new Map();
for (const file of protectedFiles) {
  protectedBefore.set(file, hash(await readFile(file)));
}
const candidatesBefore = await names(projectPaths.writingCandidates);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase26a-"));
const generationPayloads = [];
const revisionPayloads = [];

try {
  const conflict = await buildDramaticConflictManagerContext({
    characters: ["Chiya", "Kuto"],
    generation_context: { scene: "locked doorway conflict smoke" },
    retrieval_context: { scope: "candidate only" },
    dramatic_conflict_plan: conflictPlan,
  });

  assert.equal(conflict.used, true);
  assert.equal(conflict.phase, "26A");
  assert.equal(conflict.status, "completed");
  assert.equal(conflict.read_only, true);
  assert.equal(conflict.candidate_only, true);
  assert.equal(conflict.no_auto_persist, true);
  assert.equal(conflict.no_canon_update, true);
  assert.equal(conflict.no_active_engine_update, true);
  assert.equal(conflict.plan.protagonist, "Chiya");
  assert.equal(conflict.plan.protagonist_want, "enter the locked route before the opposition can seal it");
  assert.equal(conflict.plan.cost_or_payment, "the return path disappears from the terminal map");
  assert.equal(conflict.one_chapter_one_change_contract.chapter_must_change, true);
  assert.equal(conflict.provider_contract.generation_payload_key, "dramatic_conflict_manager");
  assert.deepEqual(conflict.missing_fields, []);

  const incomplete = await buildDramaticConflictManagerContext({
    dramatic_conflict_plan: { protagonist: "Chiya" },
  });
  assert.equal(incomplete.status, "incomplete");
  assert(incomplete.missing_fields.includes("missing_protagonist_want"));
  assert(incomplete.warnings.includes("dramatic_conflict_plan_incomplete"));

  const commonOptions = {
    dramaticConflictPlan: conflictPlan,
    gptWritingContexts: path.join(tempRoot, "contexts"),
    writingCandidates: path.join(tempRoot, "candidates"),
    generationAdapter: async (payload) => {
      generationPayloads.push(payload);
      assert.equal(payload.dramatic_conflict_manager.used, true);
      assert.equal(payload.dramatic_conflict_manager.plan.protagonist, "Chiya");
      assert.equal(payload.dramatic_conflict_manager.plan.new_status_quo, conflictPlan.new_status_quo);
      return { text: weakText, provider_trace_id: "phase26a-generation" };
    },
    revisionAdapter: async (payload) => {
      revisionPayloads.push(payload);
      assert.equal(payload.dramatic_conflict_manager.used, true);
      assert.equal(
        payload.dramatic_conflict_manager.one_chapter_one_change_contract.chapter_must_change,
        true,
      );
      assert.equal(payload.revision_plan.strengthen_scene_function, false);
      return { text: finalText, provider_trace_id: "phase26a-revision" };
    },
    finalPolisherAdapter,
    characterVoiceGuardAdapter: async () => ({
      verdict: "pass",
      severity: "none",
      findings: [],
    }),
  };

  const result = await runFullRecursiveWritingPipeline({
    task_prompt: "Phase26A dramatic conflict manager pipeline test.",
    generation_context: {
      scene: "locked doorway conflict smoke",
      characters: ["Chiya", "Kuto"],
    },
    retrieval_context: { scope: "candidate only" },
    save_candidate: false,
    max_revision_rounds: 2,
  }, commonOptions);

  assert.equal(result.status, "completed");
  assert.equal(result.final_candidate_text, finalText);
  assert.equal(result.dramatic_conflict_manager.used, true);
  assert.equal(result.dramatic_conflict_manager.phase, "26A");
  assert.equal(result.dramatic_conflict_manager.candidate_only, true);
  assert.equal(result.dramatic_conflict_manager.no_auto_persist, true);
  assert.equal(result.dramatic_conflict_manager.no_canon_update, true);
  assert.equal(result.dramatic_conflict_manager.no_active_engine_update, true);
  assert.equal(result.dramatic_conflict_manager.plan.cost_or_payment, conflictPlan.cost_or_payment);
  assert.equal(result.report.dramatic_conflict_manager_used, true);
  assert.equal(result.report.dramatic_conflict_manager_status, "completed");
  assert(result.report.trace_ids.includes(result.dramatic_conflict_manager.trace_id));
  assert.equal(generationPayloads.length, 1);
  assert.equal(revisionPayloads.length, 1);
  assert.equal(result.save_candidate_requested, false);
  assert.equal(result.candidate_created, false);
  assert.equal(result.active_engine_update_allowed, false);
  assert.equal(result.canon_update_allowed, false);

  const bridge = await chatgpt_bridge_run_full_recursive_writing_pipeline({
    task_prompt: "Phase26A bridge output path dramatic conflict test.",
    generation_context: {
      scene: "locked doorway bridge smoke",
      characters: ["Chiya"],
    },
    retrieval_context: { scope: "candidate only" },
    save_candidate: false,
    max_revision_rounds: 2,
  }, commonOptions);

  assert.equal(bridge.ok, true);
  assert.equal(bridge.result.can_output_to_chat, true);
  assert.equal(bridge.result.next_action, "output_final_candidate_text_to_chat");
  assert.equal(bridge.result.dramatic_conflict_manager.used, true);
  assert.equal(bridge.result.dramatic_conflict_manager.plan.protagonist, "Chiya");
  assert.equal(JSON.stringify(bridge).includes("active_engine_update_allowed\":true"), false);

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file)), protectedBefore.get(file), `${file} changed`);
  }
  assert.deepEqual(await names(projectPaths.writingCandidates), candidatesBefore);
  console.log("Phase26A dramatic conflict manager tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildRecursiveRevisionPolicy,
  recursiveRevisionPolicyVersion,
} from "../../server/src/recursive-revision-policy-service.mjs";
import { runFullRecursiveWritingPipeline } from "../../server/src/full-recursive-writing-pipeline-service.mjs";
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

function assertPolicySafety(policy) {
  assert.equal(policy.read_only, true);
  assert.equal(policy.candidate_only, true);
  assert.equal(policy.no_generation, true);
  assert.equal(policy.no_auto_persist, true);
  assert.equal(policy.no_candidate_save, true);
  assert.equal(policy.no_approval, true);
  assert.equal(policy.no_adoption, true);
  assert.equal(policy.no_canon_update, true);
  assert.equal(policy.no_active_engine_update, true);
  assert.equal(policy.no_compressed_rules_update, true);
  assert.equal(policy.no_mutation_snapshot.active_engine_modified, false);
  assert.equal(policy.no_mutation_snapshot.canon_written, false);
  assert.equal(policy.no_mutation_snapshot.candidate_saved, false);
}

function assertPolicy(input, expectedType, expectedStage) {
  const policy = buildRecursiveRevisionPolicy(input);
  assert.equal(policy.used, true);
  assert.equal(policy.phase, "34B");
  assert.equal(policy.version, recursiveRevisionPolicyVersion);
  assert.equal(policy.revision_type, expectedType);
  assert.equal(policy.return_stage, expectedStage);
  assert.equal(policy.revision_required, expectedType !== "none");
  assert(Array.isArray(policy.rewrite_targets));
  assert(Array.isArray(policy.preserve_constraints));
  assert(Array.isArray(policy.stop_conditions));
  assert(policy.preserve_constraints.includes("preserve_canon_facts"));
  assert(policy.stop_conditions.includes("needs_structural_revision_false"));
  assertPolicySafety(policy);
  return policy;
}

const completeText = [
  "走廊的燈閃了兩次，千夜停在門前，把受傷的手藏到背後。",
  "九逃沒有追問，只把止痛貼放在桌角。「妳自己選。現在回去，或跟我去看終端。」",
  "千夜按下螢幕。新的通知跳出來：候場順序提前，她們只剩十分鐘。",
  "她抓起外套，門外已響起第二次集合鈴。",
].join("\n\n");

const blockedText = "這一章正式設定為千夜新增能力為絕對支配。故事結束。";

const deterministicFinalPolisherAdapter = async ({ raw_draft_text }) => {
  if (String(raw_draft_text).includes("絕對支配")) {
    return {
      status: "completed",
      polished_text: raw_draft_text,
      needs_structural_revision: true,
      suggested_return_stage: "scene_planner",
      revision_report: {
        structural_gate: {
          reasons: ["missing_scene_function", "battle_payment_insufficient"],
          suggested_return_stage: "scene_planner",
        },
        risk_flags: ["scene_lacks_concrete_objects"],
      },
      warnings: ["phase34b_deterministic_revision_required"],
    };
  }

  return {
    status: "completed",
    polished_text: raw_draft_text,
    needs_structural_revision: false,
    suggested_return_stage: null,
    revision_report: {
      structural_gate: {
        reasons: [],
        suggested_return_stage: null,
      },
      risk_flags: [],
    },
    warnings: [],
  };
};


const baseInput = {
  task_prompt: "Phase34B recursive revision policy hardening smoke.",
  generation_context: {
    scene: "night corridor",
    chapter_turn: "terminal warning forces a visible decision",
  },
  retrieval_context: {
    scope: "candidate only",
  },
  save_candidate: false,
  max_revision_rounds: 2,
  enable_character_voice_guard: false,
  include_character_mind_state_ledger: false,
  include_dramatic_conflict_manager: false,
  include_foreshadowing_causal_graph: false,
  include_foreshadowing_payoff_guard: false,
  include_foreshadowing_payoff_repair_planner: false,
  include_foreshadowing_payoff_acceptance_gate: false,
  include_foreshadowing_settlement_diff_preview: false,
};

assert.equal(recursiveRevisionPolicyVersion, "recursive_revision_policy_v1");

assertPolicy({
  critique: {
    structural_reasons: ["missing_scene_function"],
    risk_flags: [],
    missing_scene_function: true,
  },
}, "structural_scene_rewrite", "scene_planner");

assertPolicy({
  critique: {
    structural_reasons: [],
    risk_flags: ["subtext_over_explained"],
    over_explained_subtext: true,
  },
}, "dialogue_rewrite", "raw_generation");

assertPolicy({
  critique: {
    structural_reasons: ["missing_ending_event_hook"],
    risk_flags: ["pretty_but_empty_ending"],
    weak_ending_hook: true,
  },
}, "ending_cleanup", "raw_generation");

assertPolicy({
  critique: {
    structural_reasons: ["missing_conflict"],
    risk_flags: [],
    conflict_missing: true,
  },
}, "conflict_reframe", "dramatic_conflict_manager");

assertPolicy({
  critique: {
    structural_reasons: [],
    risk_flags: ["minor_style_drift"],
  },
}, "style_polish_only", "final_polisher");

const maxed = assertPolicy({
  round: 2,
  max_revision_rounds: 2,
  critique: {
    structural_reasons: ["missing_scene_function"],
    risk_flags: [],
    missing_scene_function: true,
  },
}, "structural_scene_rewrite", "scene_planner");
assert.equal(maxed.retry_allowed, false);
assert.equal(maxed.escalation_reason, "max_revision_round_reached");

const repairPolicy = assertPolicy({
  critique: { structural_reasons: [], risk_flags: [] },
  foreshadowing_payoff_repair_planner: {
    revision_required: true,
    repair_tasks: ["make the payoff visible before claiming it is paid"],
  },
}, "foreshadowing_payoff_repair", "foreshadowing_payoff_repair");
assert(repairPolicy.rewrite_targets.includes("make the payoff visible before claiming it is paid"));

const protectedBefore = new Map();
for (const file of protectedFiles) protectedBefore.set(file, hash(await readFile(file, "utf8")));
const transactionsBefore = await names(transactionDir);
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase34b-"));

const options = {
  gptWritingContexts: path.join(tempRoot, "contexts"),
  writingCandidates: path.join(tempRoot, "candidates"),
};

try {
  let adapterSawPolicy = false;
  let capturedRevisionPayload = null;
  const revised = await runFullRecursiveWritingPipeline(baseInput, {
    ...options,
    generationAdapter: async () => ({ text: blockedText }),
    finalPolisherAdapter: deterministicFinalPolisherAdapter,
    revisionAdapter: async (payload) => {
      adapterSawPolicy = true;
      capturedRevisionPayload = payload;
      return { text: completeText };
    },
  });

  assert.equal(adapterSawPolicy, true);
  assert(capturedRevisionPayload, "revision adapter payload should be captured.");
  assert.equal(capturedRevisionPayload.round, 1);
  const capturedPolicy = capturedRevisionPayload.recursive_revision_policy;
  assert(capturedPolicy, "revision adapter payload should include top-level recursive_revision_policy.");
  assert.equal(capturedPolicy.phase, "34B");
  assert.equal(capturedPolicy.version, "recursive_revision_policy_v1");
  assert.equal(capturedPolicy.revision_required, true);
  assert(capturedPolicy.rewrite_targets.length > 0);
  assert(capturedPolicy.preserve_constraints.includes("preserve_canon_facts"));
  assert(capturedPolicy.stop_conditions.includes("polished_text_non_empty"));
  assert.equal(
    capturedRevisionPayload.revision_plan.recursive_revision_policy.version,
    "recursive_revision_policy_v1",
  );
  assert.equal(
    capturedRevisionPayload.revision_plan.revision_type,
    capturedPolicy.revision_type,
  );
    assert.deepEqual(
    capturedRevisionPayload.revision_plan.rewrite_targets,
    [
      "missing_scene_function",
      "battle_payment_insufficient",
    ],
  );
  assert(revised.recursive_revision.rounds_attempted >= 1);
  assert(revised.recursive_revision.rounds.length >= 1);
  assert.equal(revised.recursive_revision.rounds[0].recursive_revision_policy.phase, "34B");
  assert.equal(
    revised.recursive_revision.rounds[0].revision_plan.recursive_revision_policy.version,
    "recursive_revision_policy_v1",
  );
  assert.equal(revised.recursive_revision.rounds[0].revision_plan.revision_type, revised.recursive_revision.rounds[0].recursive_revision_policy.revision_type);
  assert.deepEqual(
    revised.recursive_revision.rounds[0].revision_plan.rewrite_targets,
    [
      "missing_scene_function",
      "battle_payment_insufficient",
    ],
  );
  assert.equal(revised.candidate_created, false);
  assert.equal(revised.active_engine_update_allowed, false);
  assert.equal(revised.canon_update_allowed, false);

  const exhausted = await runFullRecursiveWritingPipeline({
    ...baseInput,
    max_revision_rounds: 1,
  }, {
    ...options,
    generationAdapter: async () => ({ text: blockedText }),
    finalPolisherAdapter: deterministicFinalPolisherAdapter,
    revisionAdapter: async () => ({ text: blockedText }),
  });

  assert.equal(exhausted.status, "failed");
  assert.equal(exhausted.pipeline_stage, "structural_revision_required");
  assert.equal(exhausted.stop_reason, "max_revision_rounds_exhausted");
  assert.equal(exhausted.recursive_revision.rounds_attempted, 1);
  assert.equal(exhausted.recursive_revision.rounds[0].recursive_revision_policy.phase, "34B");
  assert.equal(exhausted.recursive_revision.rounds[0].recursive_revision_policy.retry_allowed, false);
  assert.equal(
    exhausted.recursive_revision.rounds[0].recursive_revision_policy.escalation_reason,
    "max_revision_round_reached",
  );
  assert.equal(exhausted.final_candidate_text, "");
  assert.equal(exhausted.candidate_created, false);

  const runAllText = await readFile(path.join(root, "tests", "run-all.mjs"), "utf8");
  const phase34a = "tests/phase34/phase34a-full-neural-writing-pipeline-single-entry-bridge.test.mjs";
  const phase34b = "tests/phase34/phase34b-recursive-revision-policy-hardening.test.mjs";
  const daily = "tests/scripts/daily-scripts.test.mjs";
  assert(runAllText.includes(phase34a), "run-all missing Phase34A predecessor.");
  assert(runAllText.includes(phase34b), "run-all missing Phase34B registration.");
  assert(runAllText.indexOf(phase34a) < runAllText.indexOf(phase34b), "Phase34B should run after Phase34A.");
  assert(runAllText.indexOf(phase34b) < runAllText.indexOf(daily), "Phase34B should run before Daily scripts.");

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file, "utf8")), protectedBefore.get(file));
  }

  console.log("Phase34B recursive revision policy hardening tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
  await removeNew(transactionDir, transactionsBefore);
}
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildForeshadowingCausalGraphContext } from "../../server/src/foreshadowing-causal-graph-service.mjs";
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

const weakText = "Chiya opens the door. The old warning is mentioned.";
const finalText = [
  "The red reader blinked twice before Chiya understood what the old warning had really meant.",
  "It was not warning her away from the door. It was warning her that every confirmed entry erased a return path.",
  "She pressed confirm anyway, and the terminal map folded the previous corridor into grey static.",
  "The promise was not paid in explanation. It was paid by losing the way back.",
].join("\n\n");

const graphFixture = {
  version: "phase27a-test-graph",
  updated_at: "2026-06-21T00:00:00.000Z",
  debts: [
    {
      id: "door_warning",
      label: "old door warning",
      status: "payoff_ready",
      promise: "the red reader warning must eventually cost the team a route",
      payoff_requirements: ["pay through route loss", "do not resolve as harmless flavor"],
      risk_if_ignored: "reader promise becomes decorative",
      evidence_refs: ["fixture:door-warning"],
    },
    {
      id: "sealed_return_path",
      label: "sealed return path",
      status: "open",
      promise: "the team must later deal with not having a clean retreat",
      payoff_requirements: ["keep open after this chapter"],
    },
  ],
  causal_edges: [
    {
      id: "confirm_erases_return",
      from: "door_warning",
      to: "sealed_return_path",
      relation: "causes",
      reason: "confirming the route changes the available retreat path",
    },
  ],
  chapter_promises: [
    {
      id: "pay_door_warning",
      promise: "this chapter should pay the door warning through consequence",
      expected_motion: "warning becomes route loss",
      current_status: "open",
      must_not_fake_payoff: true,
    },
  ],
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

function finalPolisherAdapter({ raw_draft_text: draft, foreshadowing_causal_graph: graph }) {
  assert.equal(graph.used, true);
  assert.equal(graph.candidate_only, true);
  assert.equal(graph.graph.payable_now_debt_ids.includes("door_warning"), true);
  if (draft === weakText) {
    return {
      status: "completed",
      polished_text: draft,
      needs_structural_revision: true,
      suggested_return_stage: "draft_revision",
      revision_report: {
        structural_gate: {
          reasons: ["missing_ending_event_hook"],
        },
        risk_flags: ["pretty_but_empty_ending"],
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase27a-"));
const generationPayloads = [];
const revisionPayloads = [];

try {
  const graph = await buildForeshadowingCausalGraphContext({}, {
    foreshadowingCausalGraph: graphFixture,
  });

  assert.equal(graph.used, true);
  assert.equal(graph.phase, "27A");
  assert.equal(graph.status, "completed");
  assert.equal(graph.read_only, true);
  assert.equal(graph.candidate_only, true);
  assert.equal(graph.no_auto_persist, true);
  assert.equal(graph.no_canon_update, true);
  assert.equal(graph.no_active_engine_update, true);
  assert.equal(graph.graph.payable_now_debt_ids[0], "door_warning");
  assert.equal(graph.graph.causal_edges[0].from, "door_warning");
  assert.equal(graph.provider_contract.generation_payload_key, "foreshadowing_causal_graph");
  assert(graph.warnings.includes("foreshadowing_debts_open"));
  assert(graph.warnings.includes("chapter_promises_unresolved"));

  const empty = await buildForeshadowingCausalGraphContext({});
  assert.equal(empty.status, "empty");
  assert(empty.warnings.includes("foreshadowing_causal_graph_empty"));

  const commonOptions = {
    foreshadowingCausalGraph: graphFixture,
    gptWritingContexts: path.join(tempRoot, "contexts"),
    writingCandidates: path.join(tempRoot, "candidates"),
    generationAdapter: async (payload) => {
      generationPayloads.push(payload);
      assert.equal(payload.foreshadowing_causal_graph.used, true);
      assert.equal(payload.foreshadowing_causal_graph.graph.payable_now_debt_ids[0], "door_warning");
      return { text: weakText, provider_trace_id: "phase27a-generation" };
    },
    revisionAdapter: async (payload) => {
      revisionPayloads.push(payload);
      assert.equal(payload.foreshadowing_causal_graph.used, true);
      assert.equal(payload.foreshadowing_causal_graph.provider_guidance.must_not_do.includes("Do not mark debts as paid automatically."), true);
      assert.equal(payload.revision_plan.strengthen_ending_event_hook, false);
      assert.equal(payload.revision_plan.remove_pretty_or_forced_ending, true);
      return { text: finalText, provider_trace_id: "phase27a-revision" };
    },
    finalPolisherAdapter,
    characterVoiceGuardAdapter: async () => ({
      verdict: "pass",
      severity: "none",
      findings: [],
    }),
  };

  const result = await runFullRecursiveWritingPipeline({
    task_prompt: "Phase27A foreshadowing causal graph pipeline test.",
    generation_context: {
      scene: "route warning payoff smoke",
      characters: ["Chiya", "Kuto"],
    },
    retrieval_context: { scope: "candidate only" },
    save_candidate: false,
    max_revision_rounds: 2,
  }, commonOptions);

  assert.equal(result.status, "completed");
  assert.equal(result.final_candidate_text, finalText);
  assert.equal(result.foreshadowing_causal_graph.used, true);
  assert.equal(result.foreshadowing_causal_graph.phase, "27A");
  assert.equal(result.foreshadowing_causal_graph.candidate_only, true);
  assert.equal(result.foreshadowing_causal_graph.no_auto_persist, true);
  assert.equal(result.foreshadowing_causal_graph.no_canon_update, true);
  assert.equal(result.foreshadowing_causal_graph.no_active_engine_update, true);
  assert.equal(result.foreshadowing_causal_graph.graph.open_debt_ids.includes("sealed_return_path"), true);
  assert.equal(result.report.foreshadowing_causal_graph_used, true);
  assert.equal(result.report.foreshadowing_causal_graph_status, "completed");
  assert(result.report.trace_ids.includes(result.foreshadowing_causal_graph.trace_id));
  assert.equal(generationPayloads.length, 1);
  assert.equal(revisionPayloads.length, 1);
  assert.equal(result.save_candidate_requested, false);
  assert.equal(result.candidate_created, false);
  assert.equal(result.active_engine_update_allowed, false);
  assert.equal(result.canon_update_allowed, false);

  const bridge = await chatgpt_bridge_run_full_recursive_writing_pipeline({
    task_prompt: "Phase27A bridge output path foreshadowing causal graph test.",
    generation_context: {
      scene: "route warning bridge smoke",
      characters: ["Chiya"],
    },
    retrieval_context: { scope: "candidate only" },
    save_candidate: false,
    max_revision_rounds: 2,
  }, commonOptions);

  assert.equal(bridge.ok, true);
  assert.equal(bridge.result.can_output_to_chat, true);
  assert.equal(bridge.result.next_action, "output_final_candidate_text_to_chat");
  assert.equal(bridge.result.foreshadowing_causal_graph.used, true);
  assert.equal(bridge.result.foreshadowing_causal_graph.graph.payable_now_debt_ids[0], "door_warning");
  assert.equal(JSON.stringify(bridge).includes("active_engine_update_allowed\":true"), false);

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file)), protectedBefore.get(file), `${file} changed`);
  }
  assert.deepEqual(await names(projectPaths.writingCandidates), candidatesBefore);
  console.log("Phase27A foreshadowing causal graph tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

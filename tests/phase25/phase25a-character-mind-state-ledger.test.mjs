import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildCharacterMindStateLedgerContext } from "../../server/src/character-mind-state-ledger-service.mjs";
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

const weakText = "Chiya stands before the door. Kuto watches her.";
const finalText = [
  "The door handle trembles under Chiya's palm, but she does not open it yet.",
  "The scrape on her left hand is still hot. She pulls the sleeve lower and touches the terminal to the reader first.",
  "Kuto stands half a step away and lowers his voice. You can still back out. That would not be shameful.",
  "Chiya does not answer. She presses confirm, hears the second assembly bell behind the door, and finally looks up.",
].join("\n\n");

const ledgerFixture = {
  version: "phase25a-test-ledger",
  updated_at: "2026-06-21T00:00:00.000Z",
  characters: [
    {
      character_name: "Chiya",
      character_id: "character.chiya",
      current_emotion: "calm and tired, but still trying to keep judgment in her own hands",
      body_state: "left hand scraped, shoulders stiff, still able to move",
      unspoken_pressure: "does not want Kuto to treat her as someone who only needs protection",
      recent_event_traces: ["just escaped a corridor pursuit and a waiting-room route change"],
      relationship_attitudes: {
        Kuto: "trusts Kuto's judgment but resists being directly protected",
      },
      visible_reactions_allowed: ["handle the terminal and door lock first, then admit the injury"],
      hidden_reactions_reserved: ["hide fear inside silence"],
      continuity_constraints: ["must not suddenly become uninjured or pressure-free"],
      last_updated_chapter: "phase25a-fixture",
      evidence_refs: ["fixture:phase25a"],
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

function finalPolisherAdapter({ raw_draft_text: draft, character_mind_state_ledger: ledger }) {
  assert.equal(ledger.used, true);
  assert.equal(ledger.candidate_only, true);
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
const tempRoot = await mkdtemp(path.join(root, "data", "outputs", ".phase25a-"));
const generationPayloads = [];
const revisionPayloads = [];

try {
  const ledger = await buildCharacterMindStateLedgerContext({
    character_names: ["Chiya", "Kuto"],
    generation_context: { scene: "doorway continuity smoke" },
    retrieval_context: { scope: "candidate only" },
  }, {
    characterMindStateLedger: ledgerFixture,
  });

  assert.equal(ledger.used, true);
  assert.equal(ledger.phase, "25A");
  assert.equal(ledger.status, "completed");
  assert.equal(ledger.read_only, true);
  assert.equal(ledger.candidate_only, true);
  assert.equal(ledger.no_auto_persist, true);
  assert.equal(ledger.no_canon_update, true);
  assert.equal(ledger.no_active_engine_update, true);
  assert.equal(ledger.matched_characters, 1);
  assert.deepEqual(ledger.missing_character_names, ["Kuto"]);
  assert.equal(ledger.characters[0].character_name, "Chiya");
  assert.equal(
    ledger.characters[0].relationship_attitudes.Kuto,
    "trusts Kuto's judgment but resists being directly protected",
  );
  assert.equal(ledger.provider_contract.generation_payload_key, "character_mind_state_ledger");

  const commonOptions = {
    characterMindStateLedger: ledgerFixture,
    gptWritingContexts: path.join(tempRoot, "contexts"),
    writingCandidates: path.join(tempRoot, "candidates"),
    generationAdapter: async (payload) => {
      generationPayloads.push(payload);
      assert.equal(payload.character_mind_state_ledger.used, true);
      assert.equal(payload.character_mind_state_ledger.characters[0].character_name, "Chiya");
      assert.equal(payload.character_mind_state_ledger.no_auto_persist, true);
      return { text: weakText, provider_trace_id: "phase25a-generation" };
    },
    revisionAdapter: async (payload) => {
      revisionPayloads.push(payload);
      assert.equal(payload.character_mind_state_ledger.used, true);
      assert.equal(
        payload.character_mind_state_ledger.characters[0].current_emotion,
        "calm and tired, but still trying to keep judgment in her own hands",
      );
      return { text: finalText, provider_trace_id: "phase25a-revision" };
    },
    finalPolisherAdapter,
    characterVoiceGuardAdapter: async () => ({
      verdict: "pass",
      severity: "none",
      findings: [],
    }),
  };

  const result = await runFullRecursiveWritingPipeline({
    task_prompt: "Phase25A character mind-state ledger pipeline test.",
    generation_context: {
      scene: "doorway continuity smoke",
      characters: ["Chiya", "Kuto"],
    },
    retrieval_context: { scope: "candidate only" },
    save_candidate: false,
    max_revision_rounds: 2,
  }, commonOptions);

  assert.equal(result.status, "completed");
  assert.equal(result.final_candidate_text, finalText);
  assert.equal(result.character_mind_state_ledger.used, true);
  assert.equal(result.character_mind_state_ledger.phase, "25A");
  assert.equal(result.character_mind_state_ledger.candidate_only, true);
  assert.equal(result.character_mind_state_ledger.no_auto_persist, true);
  assert.equal(result.character_mind_state_ledger.no_canon_update, true);
  assert.equal(result.character_mind_state_ledger.no_active_engine_update, true);
  assert.equal(result.character_mind_state_ledger.matched_characters, 1);
  assert.deepEqual(result.character_mind_state_ledger.missing_character_names, ["Kuto"]);
  assert.equal(result.report.character_mind_state_ledger_used, true);
  assert.equal(result.report.character_mind_state_ledger_status, "completed");
  assert(result.report.trace_ids.includes(result.character_mind_state_ledger.trace_id));
  assert.equal(generationPayloads.length, 1);
  assert.equal(revisionPayloads.length, 1);
  assert.equal(result.save_candidate_requested, false);
  assert.equal(result.candidate_created, false);
  assert.equal(result.active_engine_update_allowed, false);
  assert.equal(result.canon_update_allowed, false);

  const bridge = await chatgpt_bridge_run_full_recursive_writing_pipeline({
    task_prompt: "Phase25A bridge output path mind-state ledger test.",
    generation_context: {
      scene: "doorway continuity bridge smoke",
      characters: ["Chiya"],
    },
    retrieval_context: { scope: "candidate only" },
    save_candidate: false,
    max_revision_rounds: 2,
  }, commonOptions);

  assert.equal(bridge.ok, true);
  assert.equal(bridge.result.can_output_to_chat, true);
  assert.equal(bridge.result.next_action, "output_final_candidate_text_to_chat");
  assert.equal(bridge.result.character_mind_state_ledger.used, true);
  assert.equal(bridge.result.character_mind_state_ledger.characters[0].character_name, "Chiya");
  assert.equal(JSON.stringify(bridge).includes("active_engine_update_allowed\":true"), false);

  for (const file of protectedFiles) {
    assert.equal(hash(await readFile(file)), protectedBefore.get(file), `${file} changed`);
  }
  assert.deepEqual(await names(projectPaths.writingCandidates), candidatesBefore);
  console.log("Phase25A character mind-state ledger tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

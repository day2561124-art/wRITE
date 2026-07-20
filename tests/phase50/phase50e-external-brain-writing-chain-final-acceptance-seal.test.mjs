import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  access,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import path from "node:path";

import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_seal_raw_story_handoff,
  chatgpt_bridge_use_character_simulator,
  chatgpt_bridge_use_final_polisher,
  chatgpt_bridge_use_neural_critic,
  chatgpt_bridge_use_over_governance_detector,
  chatgpt_bridge_use_scene_planner,
  chatgpt_bridge_use_style_drift_detector,
  chatgpt_bridge_use_writing_card_director,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import {
  buildExternalBrainWritingChainAcceptanceSeal,
  canonicalJson,
  externalBrainWritingChainAcceptanceVersion,
  externalBrainWritingChainRequiredPostDraftDiagnostics,
  externalBrainWritingChainRequiredPreGenerationCapabilities,
} from "../../server/src/external-brain-writing-chain-acceptance-service.mjs";
import {
  getRawStoryHandoffReceipt,
} from "../../server/src/raw-story-handoff-seal-service.mjs";
import { projectPaths, projectRoot } from "../../server/src/project-paths.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const contractPath = path.join(
  projectRoot,
  "config",
  "phase50e-external-brain-writing-chain-final-acceptance-seal.json",
);
const cleanupRoots = [
  projectPaths.agentRuns,
  projectPaths.neuralTraces,
  projectPaths.neuralModuleOutputs,
  projectPaths.gptWritingContexts,
  path.join(projectPaths.outputLogs, "transactions"),
];
const forbiddenMutationRoots = {
  writing_candidates: projectPaths.writingCandidates,
  workflow_candidate_drafts: projectPaths.candidateDrafts,
  adopted_writings: projectPaths.adoptedWritings,
  adopted_chapters: projectPaths.adoptedChapters,
  settlement_contexts: projectPaths.settlementContexts,
  settlement_reports: projectPaths.settlementReports,
  settlement_proposals: projectPaths.settlementProposals,
  approval_items: projectPaths.approvalItems,
  pending_engine_candidates: projectPaths.pendingEngineCandidates,
  compressed_rule_candidates: projectPaths.compressedRuleCandidates,
};
const protectedFiles = {
  active_engine: projectPaths.activeEngine,
  compressed_rules: projectPaths.compressedRules,
};
const expectedProtectedHashes = {
  active_engine: "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb",
  compressed_rules: "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db",
};
const problemDraft = [
  "甲：「你看見訊息了嗎？」",
  "乙：「我其實看見了。」",
  "Writer Workbench 規則要求他停下。",
  "這意味著乙的沉默其實是在害怕甲離開。",
].join("\n");
const releaseStory = [
  "甲：「你看見訊息了嗎？」",
  "乙把濕傘靠在鞋櫃旁。",
  "「手機沒電。」",
  "甲把門往內拉了一點。",
].join("\n");
const characterTurnState = {
  character: "乙",
  known: ["甲昨天傳過訊息", "自己沒有回覆"],
  guessed: ["甲可能在等道歉"],
  felt: ["疲憊", "些微心虛"],
  refuses_to_admit: ["其實看見了", "已經讀過訊息"],
  immediate_goal: "先避開追問",
  speech_ceiling: "最多說手機沒電，不能承認已讀",
  next_turn_reaction: {
    impulse: "先處理濕傘",
    likely_action: "把傘靠到鞋櫃旁",
  },
  uncertainty: ["甲會不會繼續追問"],
};

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function names(directory) {
  try {
    return new Set(await readdir(directory));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

async function removeNewEntries(directory, before) {
  for (const name of await names(directory)) {
    if (!before.has(name)) {
      await rm(path.join(directory, name), { recursive: true, force: true });
    }
  }
}

async function snapshotTree(root) {
  const snapshot = {};
  async function visit(current, relative = "") {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries.sort((left, right) => (
      left.name.localeCompare(right.name)
    ))) {
      const absolute = path.join(current, entry.name);
      const childRelative = path.join(relative, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        await visit(absolute, childRelative);
      } else if (entry.isFile()) {
        const metadata = await stat(absolute);
        snapshot[childRelative] = `${metadata.size}:${sha256(await readFile(absolute))}`;
      }
    }
  }
  await visit(root);
  return snapshot;
}

async function snapshotNamedTrees(roots) {
  return Object.fromEntries(await Promise.all(
    Object.entries(roots).map(async ([name, root]) => [name, await snapshotTree(root)]),
  ));
}

async function protectedHashes() {
  const output = {};
  for (const [name, filePath] of Object.entries(protectedFiles)) {
    if (await exists(filePath)) {
      output[name] = sha256(await readFile(filePath));
      assert.equal(output[name], expectedProtectedHashes[name]);
    }
  }
  assert.equal(output.active_engine, expectedProtectedHashes.active_engine);
  return output;
}

async function containsExactText(root, text) {
  const needle = Buffer.from(text, "utf8");
  async function visit(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return false;
      if (error.code === "ENOTDIR") {
        return (await readFile(current)).includes(needle);
      }
      throw error;
    }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (await visit(absolute)) return true;
      } else if (entry.isFile()) {
        if ((await readFile(absolute)).includes(needle)) return true;
      }
    }
    return false;
  }
  return visit(root);
}

function assertMutationGuards(response) {
  for (const key of [
    "candidate_created",
    "canon_updated",
    "active_engine_updated",
    "adopted",
    "settled",
  ]) {
    assert.equal(response[key], false, key);
    assert.equal(response.mutation_guards[key], false, `mutation_guards.${key}`);
  }
}

function finding(response, issueType) {
  return response.capability_output.findings.find((item) => (
    item.issue_type === issueType
  ));
}

const cleanupBaselines = new Map(await Promise.all(
  cleanupRoots.map(async (root) => [root, await names(root)]),
));
const mutationBefore = await snapshotNamedTrees(forbiddenMutationRoots);
const protectedBefore = await protectedHashes();

try {
  const rawContract = await readFile(contractPath, "utf8");
  const contract = JSON.parse(rawContract);
  assert.equal(
    rawContract.replaceAll("\r\n", "\n"),
    `${JSON.stringify(contract, null, 2)}\n`,
    "Phase50E contract must use canonical LF JSON serialization",
  );
  assert.equal(contract.schema_version, 1);
  assert.equal(contract.phase, "50E");
  assert.equal(contract.base_commit, "37c6a13bdf73f0648192f7ccafcf82f2eb4ae399");
  assert.equal(contract.acceptance_version, externalBrainWritingChainAcceptanceVersion);
  assert.deepEqual(
    contract.required_pre_generation_capabilities,
    externalBrainWritingChainRequiredPreGenerationCapabilities,
  );
  assert.deepEqual(
    contract.required_post_draft_diagnostics,
    externalBrainWritingChainRequiredPostDraftDiagnostics,
  );
  assert.equal(contract.fixture.problem_draft_sha256, sha256(problemDraft));
  assert.equal(contract.fixture.release_story_sha256, sha256(releaseStory));
  assert.deepEqual(contract.protected_hashes, expectedProtectedHashes);

  const bootstrap = await chatgpt_bridge_begin_external_brain_writing_session({
    task_prompt:
      "寫雨夜玄關的四行短場景。乙不願承認已讀，只能在下一回合處理濕傘並用最少的話避開追問。不要替沉默解釋。",
    chapter_mode: "specific_scene",
    generation_context: {
      active_characters: ["甲", "乙"],
      scene_now: "乙淋雨回來，甲站在玄關問他是否看過訊息",
      immediate_pressure: "乙不願承認已讀，甲沒有讓開門口",
      next_natural_turn: "乙先處理濕傘，再以一句話避開追問",
      do_not_resolve: ["不要和解", "不要說明完整原因"],
    },
    retrieval_context: {
      immediate_scene_only: true,
      unrelated_archive_excluded: true,
    },
  });
  assert.equal(bootstrap.ok, true);
  assert.deepEqual(
    bootstrap.next_capabilities,
    externalBrainWritingChainRequiredPreGenerationCapabilities,
  );
  assert.deepEqual(
    bootstrap.post_draft_diagnostics,
    externalBrainWritingChainRequiredPostDraftDiagnostics,
  );
  assert(
    Buffer.byteLength(JSON.stringify(bootstrap), "utf8") < 4 * 1024,
  );
  assertMutationGuards(bootstrap);

  const common = {
    external_brain_session_id: bootstrap.external_brain_session_id,
    writing_context_bundle_id: bootstrap.writing_context_bundle_id,
  };
  const scene = await chatgpt_bridge_use_scene_planner({
    ...common,
    capability_input: {
      active_characters: ["甲", "乙"],
      scene_now: "乙淋雨回來，甲站在玄關問他是否看過訊息",
      immediate_pressure: "乙不願承認已讀",
      next_natural_turn: "乙先把濕傘靠到鞋櫃旁",
      do_not_resolve: ["不要完成和解", "不要補完整原因"],
    },
  });
  const character = await chatgpt_bridge_use_character_simulator({
    ...common,
    capability_input: characterTurnState,
  });
  const preCritic = await chatgpt_bridge_use_neural_critic(common);
  const preStyle = await chatgpt_bridge_use_style_drift_detector(common);
  const governance = await chatgpt_bridge_use_over_governance_detector({
    ...common,
    capability_input: {
      keep_diagnostics_out_of_prose: true,
      avoid_rule_recitation: true,
    },
  });
  const director = await chatgpt_bridge_use_writing_card_director({
    ...common,
    capability_input: {
      target_length: "四行",
      desired_texture: "停頓留在動作裡",
    },
  });
  const preGenerationResponses = [
    scene,
    character,
    preCritic,
    preStyle,
    governance,
    director,
  ];
  for (const response of preGenerationResponses) {
    assert.equal(response.ok, true);
    assert.equal(response.trace.status, "success");
    assert.equal(response.generation_surface.used, true);
    assertMutationGuards(response);
    assert(
      Buffer.byteLength(JSON.stringify(response), "utf8") < 20 * 1024,
    );
  }
  assert.equal(character.capability_output.character, "乙");
  assert.deepEqual(character.capability_output.known, characterTurnState.known);
  assert.deepEqual(character.capability_output.guessed, characterTurnState.guessed);
  assert.deepEqual(
    character.capability_output.refuses_to_admit,
    characterTurnState.refuses_to_admit,
  );
  assert.equal(
    character.capability_output.next_turn_reaction.likely_action,
    "把傘靠到鞋櫃旁",
  );
  assert.equal(
    preCritic.capability_output.analysis_status,
    "inactive_without_draft_evidence",
  );
  assert.equal(
    preStyle.capability_output.analysis_status,
    "inactive_without_draft_evidence",
  );

  const problemCritic = await chatgpt_bridge_use_neural_critic({
    ...common,
    capability_input: {
      draft_text: problemDraft,
      character_turn_states: [characterTurnState],
      forbidden_content: ["Writer Workbench"],
    },
  });
  const problemStyle = await chatgpt_bridge_use_style_drift_detector({
    ...common,
    capability_input: { draft_text: problemDraft },
  });
  assert.equal(problemCritic.ok, true);
  assert.equal(problemStyle.ok, true);
  assert.equal(
    finding(problemCritic, "admission_boundary_violation").line_reference,
    "L2",
  );
  assert.equal(
    finding(problemStyle, "workflow_language_leak").line_reference,
    "L3",
  );
  assert(
    finding(problemStyle, "subtext_explicitly_explained")
      || finding(problemStyle, "abstract_explanation_cluster"),
  );

  const releaseCritic = await chatgpt_bridge_use_neural_critic({
    ...common,
    capability_input: {
      draft_text: releaseStory,
      character_turn_states: [characterTurnState],
      forbidden_content: ["Writer Workbench"],
    },
  });
  const releaseStyle = await chatgpt_bridge_use_style_drift_detector({
    ...common,
    capability_input: { draft_text: releaseStory },
  });
  for (const response of [
    problemCritic,
    problemStyle,
    releaseCritic,
    releaseStyle,
  ]) {
    assert.equal(response.ok, true);
    assert.equal(response.generation_boundary, "post_generation_diagnostic");
    assertMutationGuards(response);
    assert.equal(
      JSON.stringify(response.capability_output).includes(problemDraft),
      false,
    );
    assert.equal(
      JSON.stringify(response.capability_output).includes(releaseStory),
      false,
    );
  }
  assert.equal(
    (releaseCritic.capability_output.findings ?? []).some((item) => item.must_fix),
    false,
  );
  assert.equal(
    (releaseStyle.capability_output.findings ?? []).some((item) => item.must_fix),
    false,
  );

  const sealed = await chatgpt_bridge_seal_raw_story_handoff({
    ...common,
    raw_story_text: releaseStory,
  });
  assert.equal(sealed.ok, true);
  assert.equal(sealed.handoff_route, "single_ingress_immutable_seal");
  assert.equal(sealed.raw_story_sha256, sha256(releaseStory));
  assertMutationGuards(sealed);

  const finalPolisher = await chatgpt_bridge_use_final_polisher({
    ...common,
    raw_story_handoff_id: sealed.raw_story_handoff_id,
  });
  assert.equal(finalPolisher.ok, true);
  assert.equal(finalPolisher.trace.status, "success");
  assert.equal(finalPolisher.agent_run_status, "success");
  assert.equal(finalPolisher.session_lifecycle_status, "COMPLETED");
  assert.equal(
    finalPolisher.final_polisher_minimal_intervention_guard
      .text_identity_preserved,
    true,
  );
  assert.equal(
    finalPolisher.final_polisher_minimal_intervention_guard
      .release_story_sha256,
    sha256(releaseStory),
  );
  assert.equal(
    finalPolisher.final_polisher_minimal_intervention_guard
      .changed_prose_payload_count,
    0,
  );
  assertMutationGuards(finalPolisher);

  const receipt = getRawStoryHandoffReceipt(sealed.raw_story_handoff_id);
  assert.equal(receipt.status, "consumed");
  assert.equal(receipt.payload_reference_active, false);

  const protectedAfter = await protectedHashes();
  const mutationAfter = await snapshotNamedTrees(forbiddenMutationRoots);
  const rawStoryPersistenceChecks = await Promise.all([
    containsExactText(
      path.join(projectPaths.agentRuns, bootstrap.external_brain_session_id),
      releaseStory,
    ),
    containsExactText(
      path.join(
        projectPaths.neuralModuleOutputs,
        bootstrap.external_brain_session_id,
      ),
      releaseStory,
    ),
    containsExactText(
      path.join(
        projectPaths.gptWritingContexts,
        bootstrap.writing_context_bundle_id,
      ),
      releaseStory,
    ),
  ]);
  const rawStoryPersisted = rawStoryPersistenceChecks.some(Boolean);
  assert.equal(rawStoryPersisted, false);

  const acceptanceInput = {
    bootstrap_response: bootstrap,
    pre_generation_responses: preGenerationResponses,
    pre_generation_diagnostic_responses: [preCritic, preStyle],
    problem_draft_text: problemDraft,
    problem_draft_diagnostic_responses: [problemCritic, problemStyle],
    release_story_text: releaseStory,
    release_diagnostic_responses: [releaseCritic, releaseStyle],
    sealed_handoff_response: sealed,
    final_polisher_response: finalPolisher,
    protected_hashes_before: protectedBefore,
    protected_hashes_after: protectedAfter,
    expected_protected_hashes: Object.fromEntries(
      Object.keys(protectedBefore).map((name) => [
        name,
        expectedProtectedHashes[name],
      ]),
    ),
    mutation_snapshots_before: mutationBefore,
    mutation_snapshots_after: mutationAfter,
    raw_story_persisted: rawStoryPersisted,
  };
  const acceptance = buildExternalBrainWritingChainAcceptanceSeal(
    acceptanceInput,
  );
  assert.equal(acceptance.accepted, true, acceptance.violations.join(", "));
  assert.deepEqual(acceptance.violations, []);
  assert.equal(acceptance.seal.revision_owner, "ChatGPT");
  assert.equal(acceptance.seal.final_polisher_generated_replacement_prose, false);
  assert.equal(acceptance.seal.triple_hash_exact_match, true);
  assert.equal(acceptance.seal.final_polisher_text_identity_preserved, true);
  assert.equal(acceptance.seal.protected_hashes_unchanged, true);
  assert.equal(acceptance.seal.forbidden_workflow_state_unchanged, true);
  assert.equal(acceptance.seal.raw_story_persisted, false);
  assert.equal(
    acceptance.deterministic_digest,
    contract.expected_deterministic_digest,
  );
  assert.equal(
    sha256(canonicalJson(acceptance.seal)),
    contract.expected_deterministic_digest,
  );

  const tamperedMutationSeal = buildExternalBrainWritingChainAcceptanceSeal({
    ...acceptanceInput,
    mutation_snapshots_after: {
      ...mutationAfter,
      approval_items: {
        ...(mutationAfter.approval_items ?? {}),
        "phase50e-forbidden-item.json": "1:tampered",
      },
    },
  });
  assert.equal(tamperedMutationSeal.accepted, false);
  assert(
    tamperedMutationSeal.violations.includes(
      "forbidden_workflow_state_changed",
    ),
  );

  console.log(
    `Phase50E external-brain writing-chain final acceptance seal PASS: ${acceptance.deterministic_digest}`,
  );
} finally {
  for (const root of cleanupRoots.toReversed()) {
    await removeNewEntries(root, cleanupBaselines.get(root));
  }
}

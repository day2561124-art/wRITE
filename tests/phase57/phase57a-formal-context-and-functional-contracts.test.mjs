import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  rm,
} from "node:fs/promises";
import path from "node:path";

import {
  beginChatgptOwnedExternalBrainWritingSession,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  getGptWritingContextBundle,
} from "../../server/src/gpt-writing-context-service.mjs";
import {
  buildNeuralModuleContractRegistry,
} from "../../server/src/neural-module-service.mjs";
import {
  buildPostDraftNeuralCritique,
  buildPostDraftStyleDriftReport,
} from "../../server/src/post-draft-line-diagnostic-service.mjs";
import runFinalPolisher from "../../server/src/final-polisher-service.mjs";
import {
  projectPaths,
  projectRoot,
} from "../../server/src/project-paths.mjs";

const protectedRelativePaths = [
  "data/canon_db/active_engine.md",
  "data/error_report_db/compressed_rules.md",
  "data/writing_policy_db/active_writing_card.md",
  "data/proofing_policy_db/active_proofing_card.md",
  "data/longline_db/active_longline.md",
  "data/outputs/task_prompt.md",
  "data/outputs/generation_context.md",
  "data/outputs/retrieval_context.md",
];

const expectedModules = [
  "scene_planner",
  "character_simulator",
  "over_governance_detector",
  "writing_card_director",
  "neural_critic",
  "style_drift_detector",
  "final_polisher",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function protectedHashes() {
  return Object.fromEntries(await Promise.all(
    protectedRelativePaths.map(async (relativePath) => [
      relativePath,
      sha256(await readFile(path.join(projectRoot, relativePath))),
    ]),
  ));
}

function containsExactText(value, target, seen = new Set()) {
  if (typeof value === "string") return value.includes(target);
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => (
    containsExactText(item, target, seen)
  ));
}

const hashesBefore = await protectedHashes();
const activeEngineText = await readFile(
  path.join(projectRoot, "data", "canon_db", "active_engine.md"),
  "utf8",
);
const fixtureRoot = path.join(
  projectRoot,
  "tests",
  ".tmp",
  "phase57a-formal-context-and-functional-contracts",
);
const settlementReports = path.join(
  projectPaths.outputs,
  ".phase57a-empty-settlement-reports",
);

try {
  await rm(fixtureRoot, { recursive: true, force: true });
  await rm(settlementReports, { recursive: true, force: true });
  await Promise.all([
    mkdir(fixtureRoot, { recursive: true }),
    mkdir(settlementReports, { recursive: true }),
  ]);

  const session =
    await beginChatgptOwnedExternalBrainWritingSession({
      task_prompt: "承接最新正式進度，自由創作下一章。",
      generation_context: {
        current_event: "對戰結束後回到學院。",
        injury_state: "右大腿縫合後仍限制活動。",
        unresolved_items: ["未分類靈力殘痕仍待比對。"],
      },
      retrieval_context: {},
      includeActiveEngine: true,
      max_context_chars: 48_000,
    }, {
      fixtureRoot,
      settlementReports,
    });
  assert.equal(session.ok, true);
  assert.equal(session.creative_authority.owner, "ChatGPT");
  assert.equal(
    session.creative_authority.level,
    "highest_within_canon",
  );
  assert.equal(
    session.creative_authority.chatgpt_decides_narrative,
    true,
  );
  assert.equal(session.external_research.authority, "reference_only");
  assert.equal(session.external_research.may_override_canon, false);
  assert.equal(session.external_research.may_mutate_canon, false);

  const stored = await getGptWritingContextBundle(
    session.writing_context_bundle_id,
    { fixtureRoot },
  );
  const { bundle } = stored;
  const composition = bundle.context_composition;
  assert.equal(composition.active_engine_text_requested, false);
  assert.equal(composition.active_engine_full_text_included, false);
  assert(
    composition.active_engine_retrieval_chars >= 0
      && composition.active_engine_retrieval_chars <= 12_000,
  );
  assert.equal(composition.proofing_card_included, false);
  assert(
    composition.total_chars_after_budget <= 48_000,
  );
  assert.equal(
    composition.total_chars_after_budget,
    JSON.stringify(bundle.formal_context, null, 2).length,
  );
  assert.equal(
    containsExactText(bundle.formal_context, activeEngineText.trim()),
    false,
  );
  assert.equal(
    bundle.formal_context.active_engine_metadata.sha256,
    hashesBefore["data/canon_db/active_engine.md"],
  );
  assert.equal(
    bundle.formal_context.active_engine_metadata.full_text_included,
    false,
  );
  assert.equal(
    Object.hasOwn(
      bundle.formal_context,
      "proofing_card_excerpt_or_reference",
    ),
    false,
  );

  const registry = buildNeuralModuleContractRegistry();
  assert.deepEqual(
    Object.keys(registry.modules).sort(),
    [...expectedModules].sort(),
  );
  const registryText = JSON.stringify(registry);
  assert.equal(
    registryText.split('"generate_final_prose"').length - 1,
    1,
  );
  for (const removedPromptStructure of [
    "cognition_tasks",
    "storyMaterialProfiles",
    "storyMaterialGuardrails",
    "output_boundary",
    "complete emotional arc",
    "symbol chain",
    "chapter-title meaning",
  ]) {
    assert.equal(
      registryText.includes(removedPromptStructure),
      false,
    );
  }
  for (const moduleName of expectedModules) {
    assert.deepEqual(
      Object.keys(registry.modules[moduleName]),
      [
        "module",
        "purpose",
        "activation",
        "required_inputs",
        "optional_inputs",
        "returns",
        "permissions",
      ],
    );
  }

  const critic = buildPostDraftNeuralCritique({});
  const style = buildPostDraftStyleDriftReport({});
  assert.equal(critic.status, "inactive");
  assert.equal(style.status, "inactive");

  const skippedPolisher = runFinalPolisher({});
  assert.equal(skippedPolisher.status, "skipped");
  const draft = "她把檔案闔上，沒有替沉默補一句解釋。";
  const identityPolisher = runFinalPolisher({
    candidate_text: draft,
  });
  assert.equal(identityPolisher.polished_text, draft);
  assert.equal(identityPolisher.text_identity_preserved, true);
  assert.equal(
    identityPolisher.input_hash_sha256,
    identityPolisher.output_hash_sha256,
  );

  const formalRouteSource = await readFile(
    path.join(
      projectRoot,
      "server",
      "src",
      "chatgpt-owned-external-brain-service.mjs",
    ),
    "utf8",
  );
  const beginFunction = formalRouteSource.slice(
    formalRouteSource.indexOf(
      "export async function beginChatgptOwnedExternalBrainWritingSession",
    ),
    formalRouteSource.indexOf(
      "async function missingPreGenerationCapabilities",
    ),
  );
  assert.match(beginFunction, /include_active_engine:\s*false/u);
  assert.doesNotMatch(
    beginFunction,
    /\bfetch\s*\(|https?:\/\/|node:https|node:http/u,
  );

  assert.deepEqual(await protectedHashes(), hashesBefore);

  console.log(
    JSON.stringify({
      active_engine_full_text_included:
        composition.active_engine_full_text_included,
      active_engine_text_requested:
        composition.active_engine_text_requested,
      active_engine_retrieval_chars:
        composition.active_engine_retrieval_chars,
      total_chars_after_budget:
        composition.total_chars_after_budget,
      critic_status: critic.status,
      style_status: style.status,
      final_polisher_without_draft: skippedPolisher.status,
      final_polisher_identity:
        identityPolisher.text_identity_preserved,
    }),
  );
  console.log(
    "Phase57A formal context and functional contracts test passed.",
  );
} finally {
  await Promise.all([
    rm(fixtureRoot, { recursive: true, force: true }),
    rm(settlementReports, { recursive: true, force: true }),
  ]);
}

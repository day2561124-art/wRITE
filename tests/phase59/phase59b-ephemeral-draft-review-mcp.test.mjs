import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import {
  chatgpt_bridge_review_draft_ephemeral,
  chatgptBridgeToolMetadata,
  chatgptBridgeTools,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
import {
  buildNeuralModuleContractRegistry,
} from "../../server/src/neural-module-service.mjs";
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
const taskPrompt =
  "建立下一章草稿的唯讀 Canon、continuity 與 logic hard-risk 診斷上下文。";

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

async function writingContextDirectoryCount() {
  const entries = await readdir(
    projectPaths.gptWritingContexts,
    { withFileTypes: true },
  );
  return entries.filter((entry) => entry.isDirectory()).length;
}

function review(draftText, extra = {}) {
  return chatgpt_bridge_review_draft_ephemeral({
    task_prompt: taskPrompt,
    draft_text: draftText,
    max_context_chars: 48_000,
    ...extra,
  });
}

function assertReadOnlyResult(result) {
  assert.equal(result.ok, true);
  assert.equal(result.status, "ephemeral_draft_review_complete");
  assert.equal(result.external_brain_session_id, null);
  assert.equal(result.writing_context_bundle_id, null);
  assert.equal(result.neural_critic.status, "completed");
  assert.equal(result.neural_critic.trace_persisted, false);
  assert.equal(result.context_composition.formal_context_chars, (
    JSON.stringify(result.formal_context, null, 2).length
  ));
  assert(
    result.context_composition.formal_context_chars
      <= result.context_composition.max_context_chars,
  );
  assert(result.context_composition.relevant_canon_chars <= 18_000);
  assert(
    result.context_composition.active_engine_retrieval_chars
      <= 12_000,
  );
  assert.equal(
    result.context_composition.active_engine_full_text_included,
    false,
  );
  assert.equal(
    result.context_composition.full_active_engine_fallback_allowed,
    false,
  );
  assert.equal(
    result.context_composition.full_active_engine_fallback_used,
    false,
  );
  assert.deepEqual(result.mutation_guards, {
    writing_context_record_created: false,
    candidate_created: false,
    canon_updated: false,
    active_engine_updated: false,
    adopted: false,
    settled: false,
    approval_created: false,
    activation_requested: false,
  });
}

function runStdioSession(profile, requests) {
  const serverPath = path.join(
    projectRoot,
    "server",
    "src",
    "mcp-server.mjs",
  );
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverPath], {
      cwd: projectRoot,
      env: {
        ...process.env,
        MCP_TOOL_PROFILE: profile,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with ${code}: ${stderr}`));
        return;
      }
      resolve(
        stdout
          .split(/\r?\n/u)
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      );
    });
    for (const request of requests) {
      child.stdin.write(`${JSON.stringify(request)}\n`);
    }
    child.stdin.end();
  });
}

const hashesBefore = await protectedHashes();
const writingContextsBefore = await writingContextDirectoryCount();
const activeEngineText = await readFile(projectPaths.activeEngine, "utf8");

const validationResult =
  await chatgpt_bridge_review_draft_ephemeral({
    task_prompt: taskPrompt,
  });
assert.equal(validationResult.ok, false);
assert.equal(validationResult.status, "validation_error");
assert.match(
  validationResult.validation_error.message,
  /draft_text is required and must not be blank/u,
);
assert.notEqual(
  validationResult.neural_critic.status,
  "inactive",
);

const restrictedDraft =
  "千函站在夜星學院限制檢測室的警戒線外，直接參與御先的檢測。";
const restricted = await review(restrictedDraft);
assertReadOnlyResult(restricted);
assert.equal(
  JSON.stringify(restricted.formal_context)
    .includes(activeEngineText.trim()),
  false,
);
assert.deepEqual(
  restricted.diagnostic_modules_executed,
  ["neural_critic"],
);
assert.deepEqual(
  restricted.diagnostic_modules_not_executed,
  ["style_drift_detector", "final_polisher"],
);
const qianhanLate = restricted.draft_entity_audit
  .late_added_entities.find(
    (entry) => entry.canonical_name === "千函",
  );
assert(qianhanLate);
assert.equal(qianhanLate.entity_id, "CHAR-千函-7361D94E7D");
const qianhanHydrated = restricted.draft_entity_audit
  .hydrated_late_entities.find(
    (entry) => entry.canonical_name === "千函",
  );
assert.equal(qianhanHydrated.affiliation, "白樞軌道實習校");
assert.match(qianhanHydrated.grade_or_role, /一年級/u);
assert.match(qianhanHydrated.grade_or_role, /通訊導覽科/u);
assert.equal(restricted.scene_location.access_level, "restricted");
const restrictedCompatibility =
  restricted.scene_compatibility.find(
    (entry) => entry.character_name === "千函",
  );
assert.equal(
  restrictedCompatibility.status,
  "requires_justification",
);
const restrictedFinding =
  restricted.neural_critic.exact_line_evidence.find(
    (entry) => (
      entry.issue_type
        === "unexplained_cross_organization_presence"
    ),
  );
assert(restrictedFinding);
assert.equal(restrictedFinding.severity, "P1");
assert.equal(restrictedFinding.must_fix, true);
assert.equal(restrictedFinding.line_reference, "L1");
assert.equal(
  restricted.neural_critic.hard_conflicts.some(
    (entry) => entry.finding_id === restrictedFinding.finding_id,
  ),
  true,
);

const justifiedDraft =
  "千函持跨校協查通行牌進入夜星學院限制檢測室，協助御先完成檢測。";
const justified = await review(justifiedDraft);
assertReadOnlyResult(justified);
assert.equal(
  justified.scene_compatibility.find(
    (entry) => entry.character_name === "千函",
  ).status,
  "compatible",
);
assert.equal(
  justified.neural_critic.exact_line_evidence.some(
    (entry) => (
      entry.issue_type
        === "unexplained_cross_organization_presence"
    ),
  ),
  false,
);
assert.deepEqual(justified.neural_critic.hard_conflicts, []);

const originalCharacterDraft =
  "朝日奈美咲是夜星學院的新生，站在公開大廳等人。";
const originalCharacter = await review(originalCharacterDraft);
assertReadOnlyResult(originalCharacter);
const misaki = originalCharacter.draft_entity_audit
  .original_candidates.find(
    (entry) => entry.name === "朝日奈美咲",
  );
assert(misaki);
assert.equal(misaki.status, "original_candidate");
assert.equal(misaki.allowed, true);
assert.equal(misaki.canon_hydration_required, false);
assert.equal(
  originalCharacter.draft_entity_audit.detected_entities.some(
    (entry) => entry.canonical_name === "朝日奈千夜",
  ),
  false,
);
assert.deepEqual(
  originalCharacter.neural_critic.hard_conflicts,
  [],
);

const originalWeaponDraft =
  "朝日奈美咲召喚自己的異能武裝《流星結羽》。";
const originalWeapon = await review(originalWeaponDraft);
assertReadOnlyResult(originalWeapon);
const meteorWeapon = originalWeapon.draft_entity_audit
  .original_candidates.find(
    (entry) => entry.name === "流星結羽",
  );
assert(meteorWeapon);
assert.equal(meteorWeapon.status, "original_candidate");
assert.equal(meteorWeapon.allowed, true);
assert.equal(meteorWeapon.canon_hydration_required, false);
assert.deepEqual(
  meteorWeapon.validation_scope,
  ["general_world_rules"],
);
const originalWeaponRules =
  originalWeapon.formal_context.materials.relevant_canon.world_rules;
assert(
  originalWeaponRules.some(
    (entry) => /異能武裝|召喚與維持準則/u.test(entry.name),
  ),
);
assert(
  originalWeaponRules.some(
    (entry) => /能力體系/u.test(entry.name),
  ),
);
assert(
  originalWeaponRules.every(
    (entry) => /異能武裝|召喚與維持準則|能力體系/u.test(entry.name),
  ),
);
assert.deepEqual(
  originalWeapon.formal_context.materials.relevant_canon
    .abilities_and_weapons,
  [],
);
assert.equal(
  originalWeapon.neural_critic.exact_line_evidence.some(
    (entry) => (
      entry.issue_type
        === "ability_or_weapon_ownership_conflict"
    ),
  ),
  false,
);
assert.deepEqual(originalWeapon.neural_critic.hard_conflicts, []);

const exclusiveWeaponDraft =
  "朝日奈美咲召喚《函星折箋》。";
const exclusiveWeapon = await review(exclusiveWeaponDraft);
assertReadOnlyResult(exclusiveWeapon);
const ownershipConflict =
  exclusiveWeapon.neural_critic.exact_line_evidence.find(
    (entry) => (
      entry.issue_type
        === "ability_or_weapon_ownership_conflict"
    ),
  );
assert(ownershipConflict);
assert.equal(ownershipConflict.severity, "P1");
assert.equal(ownershipConflict.must_fix, true);
assert.equal(ownershipConflict.line_reference, "L1");

const noConflict = await review(
  "御先站在夜星學院公開大廳等人。",
);
assertReadOnlyResult(noConflict);
assert.equal(noConflict.neural_critic.status, "completed");
assert.deepEqual(
  noConflict.neural_critic.exact_line_evidence,
  [],
);
assert.deepEqual(noConflict.neural_critic.hard_conflicts, []);

assert.equal(
  Object.keys(buildNeuralModuleContractRegistry().modules).length,
  7,
);
assert.equal(
  typeof chatgptBridgeTools.chatgpt_bridge_review_draft_ephemeral,
  "function",
);
assert.equal(
  chatgptBridgeToolMetadata
    .chatgpt_bridge_review_draft_ephemeral.permission,
  "read_only",
);
assert.equal(
  chatgptBridgeToolMetadata
    .chatgpt_bridge_review_draft_ephemeral.writes_files,
  false,
);

const listRequest = {
  jsonrpc: "2.0",
  id: "list",
  method: "tools/list",
  params: {},
};
const fullResponses = await runStdioSession("full", [listRequest]);
const fullTool = fullResponses[0].result.tools.find(
  (tool) => tool.name === "chatgpt_bridge_review_draft_ephemeral",
);
assert(fullTool);
const publicResponses = await runStdioSession("chatgpt_public", [
  listRequest,
  {
    jsonrpc: "2.0",
    id: "review",
    method: "tools/call",
    params: {
      name: "chatgpt_bridge_review_draft_ephemeral",
      arguments: {
        task_prompt: taskPrompt,
        draft_text: "御先站在夜星學院公開大廳等人。",
      },
    },
  },
]);
const publicTool = publicResponses[0].result.tools.find(
  (tool) => tool.name === "chatgpt_bridge_review_draft_ephemeral",
);
assert(publicTool);
assert.equal(publicTool.annotations.readOnlyHint, true);
assert.deepEqual(
  [...publicTool.inputSchema.required].sort(),
  ["draft_text", "task_prompt"],
);
for (const forbiddenField of [
  "persist_context",
  "external_brain_session_id",
  "writing_context_bundle_id",
]) {
  assert.equal(
    Object.hasOwn(publicTool.inputSchema.properties, forbiddenField),
    false,
  );
}
const mcpReview = JSON.parse(
  publicResponses.find(
    (response) => response.id === "review",
  ).result.content[0].text,
);
assertReadOnlyResult(mcpReview);
assert.deepEqual(
  mcpReview.neural_critic.exact_line_evidence,
  [],
);

const hashesAfter = await protectedHashes();
const writingContextsAfter = await writingContextDirectoryCount();
assert.deepEqual(hashesAfter, hashesBefore);
assert.equal(writingContextsAfter, writingContextsBefore);

console.log(JSON.stringify({
  tool_name: restricted.tool_name,
  validation_status: validationResult.status,
  restricted_case: {
    late_added_entity_id: qianhanLate.entity_id,
    scene_status: restrictedCompatibility.status,
    issue_type: restrictedFinding.issue_type,
    severity: restrictedFinding.severity,
    line_reference: restrictedFinding.line_reference,
  },
  justified_case: {
    scene_status: justified.scene_compatibility.find(
      (entry) => entry.character_name === "千函",
    ).status,
    hard_conflicts: justified.neural_critic.hard_conflicts.length,
  },
  original_character: {
    status: misaki.status,
    allowed: misaki.allowed,
    canon_hydration_required: misaki.canon_hydration_required,
  },
  original_weapon: {
    status: meteorWeapon.status,
    world_rule_ids: originalWeaponRules.map(
      (entry) => entry.entity_id,
    ),
    hard_conflicts:
      originalWeapon.neural_critic.hard_conflicts.length,
  },
  exclusive_weapon: {
    issue_type: ownershipConflict.issue_type,
    severity: ownershipConflict.severity,
    line_reference: ownershipConflict.line_reference,
  },
  no_conflict_critic_status: noConflict.neural_critic.status,
  formal_context_chars: restricted.context_composition.formal_context_chars,
  post_draft_diagnostic_chars:
    restricted.context_composition.post_draft_diagnostic_chars,
  active_engine_retrieval_chars:
    restricted.context_composition.active_engine_retrieval_chars,
  writing_contexts_before: writingContextsBefore,
  writing_contexts_after: writingContextsAfter,
  neural_module_count:
    Object.keys(buildNeuralModuleContractRegistry().modules).length,
}));

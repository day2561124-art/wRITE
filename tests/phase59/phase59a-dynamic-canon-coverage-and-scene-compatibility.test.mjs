import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  evaluateSceneCompatibility,
} from "../../server/src/canon-logic-compatibility-service.mjs";
import {
  beginChatgptOwnedExternalBrainWritingSession,
} from "../../server/src/chatgpt-owned-external-brain-service.mjs";
import {
  buildDraftEntityAudit,
} from "../../server/src/draft-entity-audit-service.mjs";
import {
  buildNeuralModuleContractRegistry,
} from "../../server/src/neural-module-service.mjs";
import {
  buildPostDraftNeuralCritique,
} from "../../server/src/post-draft-line-diagnostic-service.mjs";
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

async function directoryCount(root) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).length;
}

function criticFor(draft, audit) {
  return buildPostDraftNeuralCritique({
    capabilityInput: {
      draft_text: draft,
      draft_entity_audit: audit.draft_entity_audit,
      draft_canon_coverage: audit.draft_canon_coverage,
      scene_compatibility: audit.scene_compatibility,
      structured_hard_conflict_candidates:
        audit.scene_compatibility.findings,
      post_draft_diagnostic_composition:
        audit.post_draft_diagnostic_composition,
    },
  });
}

const hashesBefore = await protectedHashes();
const writingContextsBefore = await directoryCount(
  projectPaths.gptWritingContexts,
);
const activeEngineText = await readFile(projectPaths.activeEngine, "utf8");

const plannedSession = await beginChatgptOwnedExternalBrainWritingSession({
  task_prompt: "建立下一章正式寫作上下文。",
  planned_entity_manifest: {
    characters: ["千函"],
    locations: [{
      name: "夜星學院限制檢測室",
      organization: "夜星武裝學院",
      access_level: "restricted",
    }],
  },
  max_context_chars: 48_000,
  ephemeral: true,
  persist_context: false,
});

assert.equal(plannedSession.ok, true);
assert.equal(plannedSession.context_persisted, false);
const formal = plannedSession.formal_context;
const materials = formal.materials;
const hydration = materials.planned_entity_hydration;
const qianhan = hydration.resolved_entities.find(
  (entry) => entry.canonical_name === "千函",
);
assert(qianhan);
assert.equal(qianhan.entity_id, "CHAR-千函-7361D94E7D");
assert.equal(qianhan.affiliation, "白樞軌道實習校");
assert.match(qianhan.grade_or_role, /一年級/u);
assert.match(qianhan.grade_or_role, /通訊導覽科/u);
assert(qianhan.related_weapons.includes("函星折箋"));
assert(qianhan.related_abilities.some(
  (entry) => /訊息封存|安全通訊|防誤導/u.test(entry),
));
const declaredLocation = hydration.original_candidates.find(
  (entry) => entry.name === "夜星學院限制檢測室",
);
assert.equal(declaredLocation.organization, "夜星武裝學院");
assert.equal(declaredLocation.access_level, "restricted");
assert.match(declaredLocation.location_id, /^SCENE-LOC-/u);
assert(materials.relevant_canon.characters.some(
  (entry) => entry.entity_id === "CHAR-千函-7361D94E7D",
));
assert(materials.relevant_canon.abilities_and_weapons.some(
  (entry) => entry.entity_id === "WEAPON-函星折箋-B3A3A93564",
));
assert(materials.relevant_canon.organizations_and_locations.some(
  (entry) => entry.name === "白樞軌道實習校",
));
assert.equal(materials.planned_canon_coverage.named_canon_entities, 1);
assert.equal(materials.planned_canon_coverage.hydrated_entities, 1);
assert.equal(materials.planned_canon_coverage.unresolved_entities, 0);
assert.equal(materials.planned_canon_coverage.coverage_complete, true);
assert.equal(
  JSON.stringify(formal, null, 2).length,
  plannedSession.context_composition.total_chars_after_budget,
);
assert(plannedSession.context_composition.total_chars_after_budget <= 48_000);
assert(plannedSession.context_composition.relevant_canon_chars <= 18_000);
assert(
  plannedSession.context_composition.active_engine_retrieval_chars
  <= 12_000,
);
assert.equal(
  JSON.stringify(formal).includes(activeEngineText.trim()),
  false,
);

const restrictedDraft =
  "夜星學院限制檢測室裡，千函按住門邊的感應板。";
const restrictedAudit = await buildDraftEntityAudit({
  draftText: restrictedDraft,
});
assert(restrictedAudit.draft_entity_audit.late_added_entities.some(
  (entry) => entry.canonical_name === "千函",
));
assert(restrictedAudit.draft_entity_audit.hydrated_late_entities.some(
  (entry) => entry.canonical_name === "千函"
    && entry.affiliation === "白樞軌道實習校",
));
assert.equal(restrictedAudit.draft_canon_coverage.coverage_complete, true);
const restrictedCompatibility =
  restrictedAudit.scene_compatibility.findings.find(
    (entry) => entry.character_name === "千函",
  );
assert.equal(restrictedCompatibility.status, "requires_justification");
assert.equal(
  restrictedCompatibility.issue_type,
  "unexplained_cross_organization_presence",
);
const restrictedCritic = criticFor(restrictedDraft, restrictedAudit);
const restrictedFinding = restrictedCritic.findings.find(
  (entry) => entry.character === "千函",
);
assert.equal(
  restrictedFinding.issue_type,
  "unexplained_cross_organization_presence",
);
assert.equal(restrictedFinding.affiliation, "白樞軌道實習校");
assert.equal(restrictedFinding.scene_location, "夜星學院限制檢測室");
assert.equal(restrictedFinding.severity, "P1");
assert.equal(restrictedFinding.must_fix, true);
assert.equal(restrictedFinding.line_reference, "L1");

const justifiedDraft =
  "受夜星學院跨校交流任務邀請，千函持合法通行牌進入夜星學院限制檢測室。";
const justifiedAudit = await buildDraftEntityAudit({
  draftText: justifiedDraft,
});
assert.equal(
  justifiedAudit.scene_compatibility.findings.find(
    (entry) => entry.character_name === "千函",
  ).status,
  "compatible",
);
assert.equal(
  criticFor(justifiedDraft, justifiedAudit).findings.some(
    (entry) => entry.character === "千函",
  ),
  false,
);

const publicDraft = "千函站在夜星學院公開大廳等候御先。";
const publicAudit = await buildDraftEntityAudit({
  draftText: publicDraft,
});
assert.equal(
  publicAudit.scene_compatibility.findings.find(
    (entry) => entry.character_name === "千函",
  ).status,
  "compatible",
);

const wrongMembershipDraft =
  "身為夜星學生，千函走進夜星學院限制檢測室。";
const wrongMembershipAudit = await buildDraftEntityAudit({
  draftText: wrongMembershipDraft,
});
assert.equal(
  wrongMembershipAudit.scene_compatibility.findings.find(
    (entry) => entry.character_name === "千函",
  ).status,
  "hard_conflict",
);
assert(criticFor(
  wrongMembershipDraft,
  wrongMembershipAudit,
).findings.some(
  (entry) => (
    entry.issue_type === "misidentified_organization_membership"
    && entry.severity === "P1"
  ),
));

const timelineConflict = evaluateSceneCompatibility({
  characters: [qianhan],
  sceneLocation: "夜星學院限制檢測室",
  draftText:
    "千函持合法通行牌進入夜星學院限制檢測室。",
  timelineConstraints: [{
    character_name: "千函",
    exclusivity: "cannot_leave",
    location: "白樞軌道實習校",
    canon_evidence: "fixture-current-timeline",
  }],
});
assert.equal(timelineConflict.findings[0].status, "hard_conflict");
assert.equal(
  timelineConflict.findings[0].issue_type,
  "timeline_presence_conflict",
);

const originalDraft = "林沫：「我來送表單。」";
const originalAudit = await buildDraftEntityAudit({
  draftText: originalDraft,
});
assert(originalAudit.draft_entity_audit.original_candidates.some(
  (entry) => entry.name === "林沫"
    && entry.blocks_writing === false
    && entry.canon_missing === false,
));
assert.equal(originalAudit.draft_canon_coverage.coverage_complete, true);
assert.equal(criticFor(originalDraft, originalAudit).findings.length, 0);

const fullNameOriginalSession =
  await beginChatgptOwnedExternalBrainWritingSession({
    task_prompt: "建立下一章正式寫作上下文。",
    planned_entity_manifest: {
      characters: ["千函美咲"],
    },
    max_context_chars: 48_000,
    ephemeral: true,
    persist_context: false,
  });
assert.equal(
  fullNameOriginalSession.planned_entity_hydration.resolved_entities.some(
    (entry) => entry.canonical_name === "千函",
  ),
  false,
);
const plannedFullNameOriginal =
  fullNameOriginalSession.planned_entity_hydration.original_candidates.find(
    (entry) => entry.name === "千函美咲",
  );
assert.equal(plannedFullNameOriginal.status, "original_candidate");
assert.equal(plannedFullNameOriginal.allowed, true);
assert.equal(plannedFullNameOriginal.canon_hydration_required, false);

const fullNameDraft = "千函美咲：「我來送新生資料。」";
const fullNameAudit = await buildDraftEntityAudit({
  draftText: fullNameDraft,
});
assert.equal(fullNameAudit.draft_entity_audit.detected_entities.some(
  (entry) => entry.canonical_name === "千函",
), false);
const fullNameCandidate =
  fullNameAudit.draft_entity_audit.original_candidates.find(
    (entry) => entry.name === "千函美咲",
  );
assert.equal(fullNameCandidate.status, "original_candidate");
assert.equal(fullNameCandidate.allowed, true);
assert.equal(fullNameCandidate.canon_hydration_required, false);

const sharedSurnameDraft = "朝日奈美咲：「我是新來的交換生。」";
const sharedSurnameAudit = await buildDraftEntityAudit({
  draftText: sharedSurnameDraft,
});
assert.equal(sharedSurnameAudit.draft_entity_audit.detected_entities.some(
  (entry) => entry.canonical_name === "朝日奈千夜",
), false);
assert(sharedSurnameAudit.draft_entity_audit.original_candidates.some(
  (entry) => entry.name === "朝日奈美咲"
    && entry.status === "original_candidate"
    && entry.allowed === true
    && entry.canon_hydration_required === false,
));

const originalStudentDraft =
  "朝日奈美咲是夜星學院的新學生，抱著入學資料站在走廊。";
const originalStudentAudit = await buildDraftEntityAudit({
  draftText: originalStudentDraft,
});
assert(originalStudentAudit.draft_entity_audit.original_candidates.some(
  (entry) => entry.name === "朝日奈美咲"
    && entry.allowed === true
    && entry.canon_hydration_required === false,
));
assert.equal(
  originalStudentAudit.scene_compatibility.findings.some(
    (entry) => entry.status === "hard_conflict",
  ),
  false,
);
assert.equal(
  criticFor(originalStudentDraft, originalStudentAudit).findings.length,
  0,
);

const originalWeaponDraft =
  "朝日奈美咲召喚《流星結羽》，靈力沿著刀脊亮起。";
const originalWeaponAudit = await buildDraftEntityAudit({
  draftText: originalWeaponDraft,
});
const originalWeapon =
  originalWeaponAudit.draft_entity_audit.original_candidates.find(
    (entry) => entry.name === "流星結羽",
  );
assert.equal(originalWeapon.category, "weapons");
assert.equal(originalWeapon.allowed, true);
assert.equal(originalWeapon.canon_hydration_required, false);
assert.deepEqual(originalWeapon.validation_scope, ["general_world_rules"]);
assert.equal(
  originalWeaponAudit.scene_compatibility.findings.some(
    (entry) => entry.issue_type === "ability_or_weapon_ownership_conflict",
  ),
  false,
);

const originalOwnershipDraft =
  "林沫展開《函星折箋》，說要代替千函處理通訊。";
const originalOwnershipAudit = await buildDraftEntityAudit({
  draftText: originalOwnershipDraft,
});
assert(originalOwnershipAudit.scene_compatibility.findings.some(
  (entry) => (
    entry.character_name === "林沫"
    && entry.issue_type === "ability_or_weapon_ownership_conflict"
    && entry.status === "hard_conflict"
  ),
));
assert(criticFor(
  originalOwnershipDraft,
  originalOwnershipAudit,
).findings.some(
  (entry) => (
    entry.character === "林沫"
    && entry.issue_type === "ability_or_weapon_ownership_conflict"
  ),
));

assert.equal(
  restrictedAudit.post_draft_diagnostic_composition
    .active_engine_full_text_included,
  false,
);
assert.equal(
  restrictedAudit.post_draft_diagnostic_composition
    .full_active_engine_fallback_used,
  false,
);
assert(
  restrictedAudit.post_draft_diagnostic_composition
    .active_engine_retrieval_chars <= 12_000,
);
assert.equal(
  JSON.stringify(restrictedAudit).includes(activeEngineText.trim()),
  false,
);

const contracts = buildNeuralModuleContractRegistry();
assert.equal(Object.keys(contracts.modules).length, 7);
assert.deepEqual(Object.keys(contracts.modules).sort(), [
  "character_simulator",
  "final_polisher",
  "neural_critic",
  "over_governance_detector",
  "scene_planner",
  "style_drift_detector",
  "writing_card_director",
]);
assert.equal(
  JSON.stringify(formal).split('"creative_authority":').length - 1,
  1,
);
for (const removedPromptSurface of [
  "storyMaterialProfiles",
  "storyMaterialGuardrails",
  "cognition_tasks",
  "output_boundary",
]) {
  assert.equal(JSON.stringify(formal).includes(removedPromptSurface), false);
}
assert.equal(
  buildPostDraftNeuralCritique({}).status,
  "inactive",
);

assert.deepEqual(await protectedHashes(), hashesBefore);
const writingContextsAfter = await directoryCount(
  projectPaths.gptWritingContexts,
);
assert.equal(writingContextsAfter, writingContextsBefore);
for (const guard of [
  "candidate_created",
  "canon_updated",
  "active_engine_updated",
  "adopted",
  "settled",
]) {
  assert.equal(plannedSession[guard], false);
}
for (const guard of [
  "can_modify_active_engine",
  "can_approve",
  "can_confirm_adoption",
  "can_update_canon",
]) {
  assert.equal(plannedSession[guard], false);
}

console.log(JSON.stringify({
  planned_canon_coverage: materials.planned_canon_coverage,
  draft_canon_coverage: restrictedAudit.draft_canon_coverage,
  formal_context_chars:
    plannedSession.context_composition.total_chars_after_budget,
  post_draft_diagnostic_chars:
    restrictedAudit.post_draft_diagnostic_composition.total_chars,
  active_engine_retrieval_chars:
    plannedSession.context_composition.active_engine_retrieval_chars,
  post_draft_active_engine_retrieval_chars:
    restrictedAudit.post_draft_diagnostic_composition
      .active_engine_retrieval_chars,
  writing_contexts_before: writingContextsBefore,
  writing_contexts_after: writingContextsAfter,
}));
console.log(
  "Phase59A dynamic Canon coverage and scene compatibility passed.",
);

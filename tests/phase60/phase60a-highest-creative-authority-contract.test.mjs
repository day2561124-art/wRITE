import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  readdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";

import {
  buildDraftEntityAudit,
} from "../../server/src/draft-entity-audit-service.mjs";
import {
  chatgpt_bridge_begin_external_brain_writing_session,
  chatgpt_bridge_review_draft_ephemeral,
} from "../../server/src/mcp-chatgpt-bridge-tools.mjs";
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

const expectedModules = [
  "scene_planner",
  "character_simulator",
  "over_governance_detector",
  "writing_card_director",
  "neural_critic",
  "style_drift_detector",
  "final_polisher",
];

const mutationGuardNames = [
  "candidate_created",
  "canon_updated",
  "active_engine_updated",
  "adopted",
  "settled",
  "approval_created",
  "activation_requested",
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

async function writingContextDirectoryCount() {
  try {
    return (await readdir(projectPaths.gptWritingContexts, {
      withFileTypes: true,
    })).filter((entry) => entry.isDirectory()).length;
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
}

function serializedChars(value) {
  return JSON.stringify(value, null, 2).length;
}

function originalCandidate(result, name, category = "characters") {
  return result.draft_entity_audit.original_candidates.find(
    (entry) => entry.name === name && entry.category === category,
  );
}

function assertOriginalCandidate(candidate) {
  assert(candidate);
  assert.equal(candidate.status, "original_candidate");
  assert.equal(candidate.allowed, true);
  assert.equal(candidate.blocks_writing, false);
  assert.equal(candidate.canon_hydration_required, false);
  assert.equal(candidate.requires_prior_canon_registration, false);
  assert.equal(candidate.allowed_to_appear_before_registration, true);
}

function assertNoHardOriginalityFinding(review) {
  assert.equal(
    review.neural_critic.exact_line_evidence.some(
      (finding) => /canon_(?:missing|not_found)|original_candidate_missing/u
        .test(finding.issue_type ?? ""),
    ),
    false,
  );
  assert.deepEqual(review.neural_critic.hard_conflicts, []);
}

async function review(draftText, extra = {}) {
  const result = await chatgpt_bridge_review_draft_ephemeral({
    task_prompt: "依正式 Canon 與最新 continuity 自由創作下一章。",
    draft_text: draftText,
    ...extra,
  });
  assert.equal(result.ok, true);
  assert.equal(result.writing_context_bundle_id, null);
  assert.equal(result.external_brain_session_id, null);
  assert.equal(result.neural_critic.status, "completed");
  for (const guard of mutationGuardNames) {
    assert.equal(result.mutation_guards[guard], false);
  }
  return result;
}

const hashesBefore = await protectedHashes();
const writingContextsBefore = await writingContextDirectoryCount();

const session = await chatgpt_bridge_begin_external_brain_writing_session({
  task_prompt: "依正式 Canon 與最新 continuity 自由創作下一章。",
  planned_entity_manifest: {
    characters: ["朝日奈美咲"],
    organizations: ["灰庭議會"],
  },
  max_context_chars: 48_000,
  ephemeral: true,
  persist_context: false,
});
assert.equal(session.ok, true);
assert.equal(session.context_persisted, false);
assert.equal(session.writing_context_record_created, false);
for (const guard of mutationGuardNames) {
  assert.equal(session[guard], false);
}

const formal = session.formal_context;
const authority = formal.creative_authority;
for (const permission of [
  "may_create_original_named_characters",
  "may_create_named_supporting_characters",
  "may_create_antagonists",
  "may_create_hostile_factions",
  "may_create_original_organizations",
  "may_create_original_abilities",
  "may_create_original_soul_weapons",
]) {
  assert.equal(authority[permission], true);
}
for (const boundary of [
  "must_preserve_canon",
  "must_preserve_continuity",
  "must_follow_explicit_user_request",
  "must_follow_world_rules",
  "must_respect_user_reserved_unknowns",
  "must_not_invent_unpublished_hard_facts_for_existing_canon_entities",
  "must_not_overwrite_existing_canon_relationships",
  "must_not_reassign_canon_affiliation",
  "must_not_reassign_canon_ability_or_weapon_ownership",
  "must_not_create_timeline_contradictions",
]) {
  assert.equal(authority[boundary], true);
}
assert.equal(
  formal.creative_authority_summary,
  "Canon defines established facts and boundaries; ChatGPT owns all remaining creative decisions.",
);

const creativeSpace = formal.creative_space_policy;
assert.equal(creativeSpace.established_hard_fact.authority, "Canon");
assert.equal(
  creativeSpace.established_hard_fact.chatgpt_may_override,
  false,
);
assert.equal(
  creativeSpace.explicit_user_constraint.chatgpt_may_override,
  false,
);
assert.equal(
  creativeSpace.latest_continuity_fact.chatgpt_may_override,
  false,
);
assert.equal(
  creativeSpace.reserved_or_unpublished_canon_field
    .chatgpt_may_define_as_hard_fact,
  false,
);
assert.equal(
  creativeSpace.undefined_world_space.chatgpt_may_create,
  true,
);
assert.equal(
  creativeSpace.original_entity_intrinsic_details.chatgpt_may_define,
  true,
);
assert.equal(
  creativeSpace.original_entity_canon_contact_points.validation_required,
  true,
);

const originalPolicy = formal.original_candidate_policy;
assert.equal(originalPolicy.enabled, true);
assert.deepEqual(
  originalPolicy.identity_resolution.canon_identity_requires,
  [
    "same_category_exact_full_name",
    "registered_alias_exact",
    "explicit_entity_id",
  ],
);
for (const signal of [
  "fuzzy_match_is_identity_proof",
  "surname_similarity_is_identity_proof",
  "phonetic_similarity_is_identity_proof",
  "character_overlap_is_identity_proof",
  "appearance_similarity_is_identity_proof",
  "role_similarity_is_identity_proof",
]) {
  assert.equal(originalPolicy.identity_resolution[signal], false);
}
const originalDefault =
  originalPolicy.default_when_no_canon_identity_match;
assert.equal(originalDefault.status, "original_candidate");
assert.equal(originalDefault.allowed, true);
assert.equal(originalDefault.blocks_writing, false);
assert.equal(originalDefault.canon_hydration_required, false);
assert.equal(originalDefault.requires_prior_canon_registration, false);
assert.equal(originalDefault.allowed_to_appear_before_registration, true);
assert.equal(originalPolicy.canon_status.is_canon, false);
assert.equal(originalPolicy.canon_status.is_candidate_record, false);
assert.equal(originalPolicy.canon_status.is_persisted, false);
assert.equal(
  originalPolicy.canon_status
    .requires_explicit_candidate_workflow_to_persist,
  true,
);

for (const value of Object.values(formal.backend_authority)) {
  assert.equal(value, false);
}

const plannedMisaki =
  session.planned_entity_hydration.original_candidates.find(
    (entry) => entry.name === "朝日奈美咲",
  );
const plannedFaction =
  session.planned_entity_hydration.original_candidates.find(
    (entry) => entry.name === "灰庭議會",
  );
assertOriginalCandidate(plannedMisaki);
assertOriginalCandidate(plannedFaction);
assert.equal(
  session.planned_entity_hydration.resolved_entities.some(
    (entry) => entry.canonical_name === "朝日奈千夜",
  ),
  false,
);

const supporting = await review(
  "朝日奈美咲：「我來送新生資料。」她留著褐色短髮，語氣沉著，為了查明失蹤貨單而入學；她能使用能力「星痕定位」，並召喚自己的異能武裝《流星結羽》。",
);
const misaki = originalCandidate(supporting, "朝日奈美咲");
assertOriginalCandidate(misaki);
assert.equal(
  supporting.draft_entity_audit.detected_entities.some(
    (entry) => entry.canonical_name === "朝日奈千夜",
  ),
  false,
);
assertOriginalCandidate(
  originalCandidate(supporting, "星痕定位", "abilities"),
);
assertOriginalCandidate(
  originalCandidate(supporting, "流星結羽", "weapons"),
);
assertNoHardOriginalityFinding(supporting);

const surnameCases = [
  ["朝日奈美咲", "朝日奈千夜"],
  ["白瀨真冬", "白瀨零夜"],
  ["香坂由理", "香坂汐里"],
];
for (const [originalName, canonName] of surnameCases) {
  const audit = await buildDraftEntityAudit({
    draftText: `${originalName}：「我是新來的交換生。」`,
  });
  assertOriginalCandidate(originalCandidate(audit, originalName));
  assert.equal(
    audit.draft_entity_audit.detected_entities.some(
      (entry) => entry.canonical_name === canonName,
    ),
    false,
  );
}

const antagonist = await review(
  "新反派「黑澤伊織」以追回被奪走的研究成果為當前動機；他使用新能力「黯潮折射」，並召喚自己的異能武裝《逆潮刻槍》。",
);
const antagonistCandidate = originalCandidate(
  antagonist,
  "黑澤伊織",
);
assertOriginalCandidate(antagonistCandidate);
assert.equal(antagonistCandidate.story_role, "antagonist");
assert.equal(antagonistCandidate.original_entity_type, "antagonist");
assertOriginalCandidate(
  originalCandidate(antagonist, "黯潮折射", "abilities"),
);
assertOriginalCandidate(
  originalCandidate(antagonist, "逆潮刻槍", "weapons"),
);
assertNoHardOriginalityFinding(antagonist);

const hostileFaction = await review(
  "敵對組織「灰庭議會」在城南建立臨時情報網，但沒有冒用既有組織的名稱或權限。",
);
const factionCandidate = originalCandidate(
  hostileFaction,
  "灰庭議會",
  "organizations",
);
assertOriginalCandidate(factionCandidate);
assert.equal(factionCandidate.original_entity_type, "hostile_faction");
assertNoHardOriginalityFinding(hostileFaction);

const exclusiveWeapon = await review(
  "朝日奈美咲召喚《函星折箋》。",
);
const weaponConflict =
  exclusiveWeapon.neural_critic.exact_line_evidence.find(
    (finding) => (
      finding.issue_type === "ability_or_weapon_ownership_conflict"
    ),
  );
assert(weaponConflict);
assert.equal(weaponConflict.line_reference, "L1");
assertOriginalCandidate(
  originalCandidate(exclusiveWeapon, "朝日奈美咲"),
);

const exclusiveRole = await review(
  "望月朔夜是夜星武裝學院院長，今天主持校務會議。",
);
const roleConflict =
  exclusiveRole.neural_critic.exact_line_evidence.find(
    (finding) => (
      finding.issue_type === "exclusive_organization_role_conflict"
    ),
  );
assert(roleConflict);
assert.equal(roleConflict.line_reference, "L1");
assertOriginalCandidate(
  originalCandidate(exclusiveRole, "望月朔夜"),
);

const relationshipAudit = await buildDraftEntityAudit({
  draftText: "朝日奈美咲自稱是千函的姊姊。",
  canonContactConstraints: {
    exclusive_relationships: [{
      canon_entity_name: "千函",
      relationship_type: "siblings",
      allowed_names: ["宇天"],
      explicitly_closed: true,
      canon_evidence: "fixture-explicit-sibling-roster",
    }],
  },
});
const relationshipConflict =
  relationshipAudit.scene_compatibility.findings.find(
    (finding) => finding.issue_type === "exclusive_relationship_conflict",
  );
assert(relationshipConflict);
assert.equal(
  relationshipConflict.exact_line_evidence[0].line_reference,
  "L1",
);
assertOriginalCandidate(
  originalCandidate(relationshipAudit, "朝日奈美咲"),
);

const historyAudit = await buildDraftEntityAudit({
  draftText: "朝日奈美咲聲稱參與霧港封鎖事件。",
  canonContactConstraints: {
    closed_historical_events: [{
      event_name: "霧港封鎖事件",
      participant_names: ["夜星"],
      participant_list_closed: true,
      canon_evidence: "fixture-closed-participant-roster",
    }],
  },
});
const historyConflict = historyAudit.scene_compatibility.findings.find(
  (finding) => (
    finding.issue_type
      === "closed_historical_event_participation_conflict"
  ),
);
assert(historyConflict);
assert.equal(historyConflict.exact_line_evidence[0].line_reference, "L1");
assertOriginalCandidate(
  originalCandidate(historyAudit, "朝日奈美咲"),
);

const firstMeeting = await review(
  "朝日奈美咲第一次遇見朝日奈千夜，兩人在夜星學院公開大廳交換姓名。",
);
assertOriginalCandidate(
  originalCandidate(firstMeeting, "朝日奈美咲"),
);
assertNoHardOriginalityFinding(firstMeeting);

const restricted = await review(
  "千函進入夜星學院限制檢測室，協助御先完成檢測。",
);
assert(
  restricted.neural_critic.exact_line_evidence.some(
    (finding) => (
      finding.issue_type === "unexplained_cross_organization_presence"
      && finding.severity === "P1"
    ),
  ),
);
const justified = await review(
  "千函持跨校協查通行牌進入夜星學院限制檢測室，協助御先完成檢測。",
);
assertNoHardOriginalityFinding(justified);

const contracts = buildNeuralModuleContractRegistry();
assert.deepEqual(
  Object.keys(contracts.modules),
  expectedModules,
);
for (const permission of [
  "decide_story_direction",
  "choose_cast",
  "create_or_reject_story_direction",
  "remove_original_entities",
  "replace_original_entities",
  "force_reuse_of_existing_canon_entities",
  "require_prior_canon_registration",
  "persist_original_entities_without_explicit_request",
  "convert_original_candidate_to_canon",
]) {
  assert.equal(
    contracts.common_neural_module_permissions[permission],
    false,
  );
}
assert.equal(buildPostDraftNeuralCritique({}).status, "inactive");

const contractReview = await review(
  "御先站在夜星學院公開大廳等人。",
);
for (const key of [
  "creative_authority",
  "creative_space_policy",
  "original_candidate_policy",
  "backend_authority",
]) {
  assert.deepEqual(contractReview.formal_context[key], formal[key]);
}

const formalText = JSON.stringify(formal);
for (const key of [
  "creative_authority",
  "creative_space_policy",
  "original_candidate_policy",
  "backend_authority",
]) {
  assert.equal(
    formalText.split(`"${key}":`).length - 1,
    1,
  );
}
assert.equal(
  formalText.split(formal.creative_authority_summary).length - 1,
  1,
);
assert(serializedChars(formal) <= 48_000);
assert(
  session.context_composition.relevant_canon_chars <= 18_000,
);
assert(
  session.context_composition.active_engine_retrieval_chars <= 12_000,
);
assert.equal(
  session.context_composition.active_engine_full_text_included,
  false,
);
assert.equal(
  contractReview.context_composition.full_active_engine_fallback_used,
  false,
);

assert.deepEqual(await protectedHashes(), hashesBefore);
const writingContextsAfter = await writingContextDirectoryCount();
assert.equal(writingContextsAfter, writingContextsBefore);

console.log(JSON.stringify({
  creative_authority_owner: authority.owner,
  named_supporting_character: {
    name: misaki.name,
    status: misaki.status,
    allowed: misaki.allowed,
    requires_prior_canon_registration:
      misaki.requires_prior_canon_registration,
  },
  surname_cases: surnameCases.map(([name]) => name),
  antagonist: {
    name: antagonistCandidate.name,
    status: antagonistCandidate.status,
  },
  hostile_faction: {
    name: factionCandidate.name,
    status: factionCandidate.status,
  },
  contact_conflicts: [
    weaponConflict.issue_type,
    roleConflict.issue_type,
    relationshipConflict.issue_type,
    historyConflict.issue_type,
  ],
  legal_first_meeting_hard_conflicts:
    firstMeeting.neural_critic.hard_conflicts.length,
  restricted_qianhan_issue:
    restricted.neural_critic.exact_line_evidence[0]?.issue_type,
  justified_qianhan_hard_conflicts:
    justified.neural_critic.hard_conflicts.length,
  neural_module_count: Object.keys(contracts.modules).length,
  formal_context_chars: serializedChars(formal),
  relevant_canon_chars:
    session.context_composition.relevant_canon_chars,
  active_engine_retrieval_chars:
    session.context_composition.active_engine_retrieval_chars,
  writing_contexts_before: writingContextsBefore,
  writing_contexts_after: writingContextsAfter,
}));
console.log(
  "Phase60A highest creative authority contract test passed.",
);

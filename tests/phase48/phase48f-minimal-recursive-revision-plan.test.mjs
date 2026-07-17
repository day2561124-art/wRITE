import assert from "node:assert/strict";
import {
  buildRevisionPlan,
} from "../../server/src/full-recursive-writing-pipeline-service.mjs";

const softReaderResponsePolicy = buildRevisionPlan(
  {
    structural_reasons: [],
    risk_flags: [
      "pretty_but_empty_ending",
      "subtext_over_explained",
      "scene_lacks_concrete_objects",
    ],
    weak_ending_hook: true,
    pretty_but_empty_ending: true,
    over_explained_subtext: true,
    missing_concrete_action_or_cost: true,
  },
  {
    revision_required: true,
    revision_type: "structural_scene_rewrite",
    return_stage: "scene_planner",
    rewrite_targets: [
      "increase concrete action beats",
      "raise reader-facing pressure",
      "add visible emotional pressure",
      "replace soft closing with an event hook",
    ],
    preserve_constraints: [
      "preserve Canon facts",
      "preserve candidate-only scope",
      "increase dialogue friction",
    ],
    stop_conditions: [
      "canon_status_candidate_only",
      "active_engine_update_allowed_false",
      "overall_reader_response_score_at_least_60",
    ],
    escalation_reason:
      "overall_reader_response_weak",
  },
);

assert.equal(
  softReaderResponsePolicy.strengthen_scene_function,
  false,
);

assert.equal(
  softReaderResponsePolicy.add_concrete_action_or_cost,
  false,
);

assert.equal(
  softReaderResponsePolicy.strengthen_ending_event_hook,
  false,
);

assert.equal(
  softReaderResponsePolicy.remove_pretty_or_forced_ending,
  false,
);

assert.equal(
  softReaderResponsePolicy.keep_dialogue_natural,
  false,
);

assert.equal(
  softReaderResponsePolicy.avoid_administrative_prose,
  false,
);

assert.equal(
  softReaderResponsePolicy.recursive_revision_policy,
  null,
);

assert.equal(
  softReaderResponsePolicy.revision_type,
  null,
);

assert.equal(
  softReaderResponsePolicy.return_stage,
  null,
);

assert.deepEqual(
  softReaderResponsePolicy.rewrite_targets,
  [],
);

assert.deepEqual(
  softReaderResponsePolicy.preserve_constraints,
  [
    "preserve Canon facts",
    "preserve candidate-only scope",
  ],
);

assert.deepEqual(
  softReaderResponsePolicy.stop_conditions,
  [
    "canon_status_candidate_only",
    "active_engine_update_allowed_false",
  ],
);

const explicitCanonCorrection = buildRevisionPlan(
  {
    structural_reasons: [
      "unauthorized_new_canon_claim",
    ],
    suggested_return_stage:
      "writing_card_director",
  },
  {
    version: "recursive_revision_policy_v1",
    phase: "34B",
    status: "revision_required",
    used: true,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_canon_update: true,
    no_active_engine_update: true,
    safety_boundary: {
      can_write_canon: false,
      can_update_active_engine: false,
    },
    no_mutation_snapshot: {
      canon_written: false,
      active_engine_modified: false,
    },
    revision_required: true,
    revision_type: "structural_scene_rewrite",
    return_stage: "writing_card_director",
    rewrite_targets: [
      "increase pressure",
      "add a stronger ending",
    ],
    preserve_constraints: [
      "preserve Canon facts",
      "preserve character state",
      "preserve timeline",
      "preserve candidate-only scope",
      "add emotional pressure",
    ],
    stop_conditions: [
      "canon_status_candidate_only",
      "active_engine_update_allowed_false",
      "increase_hook_strength",
    ],
    escalation_reason:
      "unauthorized_new_canon_claim",
  },
);

assert.equal(
  explicitCanonCorrection.revision_type,
  "structural_scene_rewrite",
);

assert.equal(
  explicitCanonCorrection.return_stage,
  "writing_card_director",
);

assert.deepEqual(
  explicitCanonCorrection.fix_structural_reasons,
  [
    "unauthorized_new_canon_claim",
  ],
);

assert.deepEqual(
  explicitCanonCorrection.rewrite_targets,
  [
    "unauthorized_new_canon_claim",
  ],
);

assert.deepEqual(
  explicitCanonCorrection
    .recursive_revision_policy
    .rewrite_targets,
  [
    "unauthorized_new_canon_claim",
  ],
);

assert.equal(
  explicitCanonCorrection
    .recursive_revision_policy
    .version,
  "recursive_revision_policy_v1",
);

assert.equal(
  explicitCanonCorrection
    .recursive_revision_policy
    .policy_version,
  "recursive_revision_policy_v1",
);

assert.equal(
  explicitCanonCorrection
    .recursive_revision_policy
    .phase,
  "34B",
);

assert.equal(
  explicitCanonCorrection
    .recursive_revision_policy
    .read_only,
  true,
);

assert.equal(
  explicitCanonCorrection
    .recursive_revision_policy
    .candidate_only,
  true,
);

assert.equal(
  explicitCanonCorrection
    .recursive_revision_policy
    .safety_boundary
    .can_write_canon,
  false,
);

assert.equal(
  explicitCanonCorrection
    .recursive_revision_policy
    .no_mutation_snapshot
    .active_engine_modified,
  false,
);

assert.deepEqual(
  explicitCanonCorrection.preserve_constraints,
  [
    "preserve Canon facts",
    "preserve character state",
    "preserve timeline",
    "preserve candidate-only scope",
  ],
);

assert(
  !explicitCanonCorrection.preserve_constraints.includes(
    "add emotional pressure",
  ),
);

assert(
  !explicitCanonCorrection.stop_conditions.includes(
    "increase_hook_strength",
  ),
);

console.log(
  "Phase48F minimal recursive revision plan tests passed.",
);
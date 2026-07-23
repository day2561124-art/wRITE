function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function cloneContract(value) {
  return JSON.parse(JSON.stringify(value));
}

export const creativeAuthority = deepFreeze({
  owner: "ChatGPT",
  level: "highest_within_canon",
  canon_defines_facts: true,
  chatgpt_decides_narrative: true,
  may_choose_viewpoint: true,
  may_choose_scene_entry: true,
  may_choose_cast: true,
  may_create_events: true,
  may_create_supporting_details: true,
  may_create_original_named_characters: true,
  may_create_named_supporting_characters: true,
  may_create_antagonists: true,
  may_create_hostile_factions: true,
  may_create_original_organizations: true,
  may_create_original_locations: true,
  may_define_original_character_identity: true,
  may_define_original_character_name: true,
  may_define_original_character_appearance: true,
  may_define_original_character_personality: true,
  may_define_original_character_background: true,
  may_define_original_character_motivation: true,
  may_define_original_character_current_goals: true,
  may_define_original_character_voice: true,
  may_create_original_abilities: true,
  may_create_original_soul_weapons: true,
  may_define_original_ability_costs_and_limits: true,
  may_create_current_encounters_with_canon_entities: true,
  may_create_new_conflicts_within_world_rules: true,
  may_determine_pacing: true,
  may_determine_dialogue: true,
  may_determine_chapter_structure: true,
  must_preserve_canon: true,
  must_preserve_continuity: true,
  must_follow_explicit_user_request: true,
  must_follow_world_rules: true,
  must_respect_user_reserved_unknowns: true,
  must_not_invent_unpublished_hard_facts: true,
  must_not_invent_unpublished_hard_facts_for_existing_canon_entities: true,
  must_not_overwrite_existing_canon_relationships: true,
  must_not_reassign_canon_affiliation: true,
  must_not_reassign_canon_ability_or_weapon_ownership: true,
  must_not_create_timeline_contradictions: true,
  does_not_imply_canon_persistence: true,
  does_not_imply_candidate_creation: true,
  does_not_imply_adoption_or_settlement: true,
});

export const creativeAuthoritySummary =
  "Canon defines established facts and boundaries; ChatGPT owns all remaining creative decisions.";

export const creativeSpacePolicy = deepFreeze({
  established_hard_fact: {
    authority: "Canon",
    chatgpt_may_override: false,
  },
  explicit_user_constraint: {
    authority: "User",
    chatgpt_may_override: false,
  },
  latest_continuity_fact: {
    authority: "Continuity",
    chatgpt_may_override: false,
  },
  reserved_or_unpublished_canon_field: {
    authority: "Reserved",
    chatgpt_may_define_as_hard_fact: false,
  },
  undefined_world_space: {
    authority: "ChatGPT",
    chatgpt_may_create: true,
  },
  original_entity_intrinsic_details: {
    authority: "ChatGPT",
    chatgpt_may_define: true,
  },
  original_entity_canon_contact_points: {
    authority: "CanonValidation",
    validation_required: true,
  },
});

export const originalCandidatePolicy = deepFreeze({
  enabled: true,
  identity_resolution: {
    canon_identity_requires: [
      "same_category_exact_full_name",
      "registered_alias_exact",
      "explicit_entity_id",
    ],
    fuzzy_match_is_identity_proof: false,
    surname_similarity_is_identity_proof: false,
    phonetic_similarity_is_identity_proof: false,
    character_overlap_is_identity_proof: false,
    appearance_similarity_is_identity_proof: false,
    role_similarity_is_identity_proof: false,
  },
  default_when_no_canon_identity_match: {
    status: "original_candidate",
    allowed: true,
    blocks_writing: false,
    canon_hydration_required: false,
    requires_prior_canon_registration: false,
    allowed_to_appear_before_registration: true,
  },
  canon_status: {
    is_canon: false,
    is_candidate_record: false,
    is_persisted: false,
    requires_explicit_candidate_workflow_to_persist: true,
  },
  validation_scope: [
    "general_world_rules",
    "existing_canon_contact_points",
    "timeline_contact_points",
    "exclusive_roles",
    "exclusive_relationships",
    "exclusive_weapon_ownership",
  ],
});

export const backendAuthority = deepFreeze({
  may_choose_cast: false,
  may_create_or_reject_story_direction: false,
  may_remove_original_entities: false,
  may_replace_original_entities: false,
  may_force_reuse_of_existing_canon_entities: false,
  may_require_prior_canon_registration: false,
  may_persist_original_entities_without_explicit_request: false,
  may_convert_original_candidate_to_canon: false,
});

export function originalCandidateStatus(overrides = {}) {
  return {
    ...cloneContract(
      originalCandidatePolicy.default_when_no_canon_identity_match,
    ),
    ...overrides,
  };
}

export const externalResearch = Object.freeze({
  allowed: true,
  trigger: "when_current_or_specialized_reference_is_materially_useful",
  decision_owner: "ChatGPT",
  authority: "reference_only",
  may_override_canon: false,
  may_mutate_canon: false,
  may_mutate_active_engine: false,
  may_create_candidate: false,
  requires_story_transformation: true,
});

export function formalWritingAuthorityContract() {
  return {
    creative_authority: cloneContract(creativeAuthority),
    creative_authority_summary: creativeAuthoritySummary,
    creative_space_policy: cloneContract(creativeSpacePolicy),
    original_candidate_policy: cloneContract(originalCandidatePolicy),
    backend_authority: cloneContract(backendAuthority),
    external_research: cloneContract(externalResearch),
  };
}

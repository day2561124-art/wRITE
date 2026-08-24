import {
  hashAgentRunValue,
} from "./agent-run-service.mjs";

export const worldSimulationMemoryAccessibilityVersion = "phase63b-cue-dependent-memory-accessibility-v2";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function object(value) {
  return isObject(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function finiteNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number > 0 ? number : fallback;
}

function unitNumber(value, fallback = null) {
  const number = finiteNumber(value, fallback);
  return number !== null && number >= 0 && number <= 1 ? number : fallback;
}

function positiveInteger(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function nonNegativeInteger(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function characterMapValue(map, character) {
  if (!isObject(map)) return undefined;
  if (Object.hasOwn(map, character)) return map[character];
  const normalized = String(character ?? "").trim().toLocaleLowerCase("zh-Hant-TW");
  for (const [key, value] of Object.entries(map)) {
    if (String(key).trim().toLocaleLowerCase("zh-Hant-TW") === normalized) return value;
  }
  return undefined;
}

function profileFor(context) {
  if (isObject(context.memory_retrieval_profile)) return object(context.memory_retrieval_profile);
  const worldState = object(context.world_state);
  const character = nonEmptyString(context.character);
  const characterState = object(characterMapValue(worldState.characters, character));
  const characterMemoryProfile = object(characterState.memory_profile);
  const worldRules = object(worldState.world_rules ?? worldState.rules);
  const worldMemoryProfile = object(worldRules.memory_profile);
  return object(
    characterState.memory_retrieval_profile
      ?? characterMemoryProfile.retrieval
      ?? worldRules.memory_retrieval_profile
      ?? worldMemoryProfile.retrieval,
  );
}

const memoryAccessibilityModelModes =
  Object.freeze({
    LEGACY_UNFILTERED:
      "legacy_unfiltered_eligibility",

    LEGACY_V1_WEIGHTED:
      "legacy_v1_weighted_compatibility",

    NATIVE_V2:
      "cue_dependent_v2",
  });

function profileModelMode(profile) {
  const source =
    object(profile);

  if (source.enabled !== true) {
    return memoryAccessibilityModelModes
      .LEGACY_UNFILTERED;
  }

  const explicitMode =
    nonEmptyString(
      source.model_mode
      ?? object(source.accessibility_model).mode,
    )?.toLowerCase()
    ?? null;

  if (
    explicitMode === "cue_dependent_v2"
    || explicitMode === "cue-dependent-v2"
    || explicitMode === "phase63b_v2"
  ) {
    return memoryAccessibilityModelModes
      .NATIVE_V2;
  }

  if (
    explicitMode === "legacy_v1_weighted_compatibility"
    || explicitMode === "legacy_v1_weighted"
    || explicitMode === "phase63b_v1"
  ) {
    return memoryAccessibilityModelModes
      .LEGACY_V1_WEIGHTED;
  }

  if (explicitMode !== null) {
    const error = new Error(
      `Unsupported Phase63B memory accessibility model_mode: ${explicitMode}`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_MODEL_MODE_UNSUPPORTED";

    error.model_mode =
      explicitMode;

    throw error;
  }

  // Existing pre-v2 profiles did not declare model_mode.
  // Preserve those profiles as legacy v1 compatibility.
  //
  // Any newly declared explicit mode must be recognized above;
  // unknown explicit modes fail closed rather than silently
  // inheriting the legacy weighted formula.
  return memoryAccessibilityModelModes
    .LEGACY_V1_WEIGHTED;
}

function engineRetrievalEligibility(record) {
  if (!isObject(record)) {
    return {
      eligible:
        false,

      policy_eligible:
        false,

      suppressed:
        false,

      source:
        "invalid_record",
    };
  }

  const hasNativeEligibility =
    Object.hasOwn(
      record,
      "retrieval_eligible",
    );

  const hasLegacyAccessibility =
    Object.hasOwn(
      record,
      "accessible",
    );

  const policyEligible =
    hasNativeEligibility
      ? record.retrieval_eligible !== false
      : record.accessible !== false;

  const suppressed =
    record.suppressed === true;

  return {
    eligible:
      policyEligible
      && !suppressed,

    policy_eligible:
      policyEligible,

    suppressed,

    source:
      hasNativeEligibility
        ? "retrieval_eligible"
        : hasLegacyAccessibility
          ? "legacy_accessible"
          : "default_eligible",
  };
}

function timestampMs(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function elapsedHours(now, then) {
  const nowMs = timestampMs(now);
  const thenMs = timestampMs(then);
  if (nowMs === null || thenMs === null) return null;
  return Math.max(0, (nowMs - thenMs) / 3_600_000);
}

function decayAccessibility(ageHours, config) {
  if (ageHours === null) return null;
  const mode = nonEmptyString(config?.mode)?.toLowerCase() ?? null;
  if (!mode) return null;
  if (mode === "none") return 1;
  const scaleHours = positiveNumber(config?.scale_hours);
  if (scaleHours === null) return null;
  const ratio = ageHours / scaleHours;
  if (mode === "hyperbolic") return 1 / (1 + ratio);
  if (mode === "exponential") return Math.exp(-ratio);
  if (mode === "power") {
    const exponent = positiveNumber(config?.exponent);
    return exponent === null ? null : (1 + ratio) ** (-exponent);
  }
  return null;
}

function explicitSuccessfulRetrievalHistoryEntry(
  entry,
) {
  if (!isObject(entry)) {
    return false;
  }

  if (entry.success === true) {
    return true;
  }

  const outcome =
    nonEmptyString(
      entry.outcome
      ?? entry.result
      ?? entry.status,
    )
      ?.toLowerCase()
    ?? null;

  return [
    "success",
    "successful",
    "successful_recall",
    "successful_retrieval",
  ].includes(
    outcome,
  );
}

function retrievalHistoryEntries(
  record,
) {
  return array(
    record?.retrieval_history,
  );
}

function successfulRetrievalHistoryEntries(
  record,
) {
  return retrievalHistoryEntries(
    record,
  ).filter(
    explicitSuccessfulRetrievalHistoryEntry,
  );
}

function legacyRecallHistorySource(
  record,
) {
  if (
    retrievalHistoryEntries(
      record,
    ).length
  ) {
    return "retrieval_history";
  }

  if (
    nonNegativeInteger(
      record?.recall_count,
    ) !== null
    || timestampMs(
      record?.last_recalled_at,
    ) !== null
  ) {
    return "legacy_summary_fallback";
  }

  return "unspecified";
}

function recallCount(record) {
  const history =
    retrievalHistoryEntries(
      record,
    );

  if (history.length) {
    return successfulRetrievalHistoryEntries(
      record,
    ).length;
  }

  return nonNegativeInteger(
    record?.recall_count,
  );
}

function successfulRetrievalHistoryTimestamp(
  entry,
) {
  if (
    !explicitSuccessfulRetrievalHistoryEntry(
      entry,
    )
  ) {
    return null;
  }

  return timestampMs(
    entry.occurred_at
    ?? entry.recalled_at
    ?? entry.retrieved_at
    ?? entry.timestamp
    ?? entry.at,
  );
}

function lastSuccessfulRecallAt(
  record,
) {
  const history =
    retrievalHistoryEntries(
      record,
    );

  if (history.length) {
    let latest =
      null;

    for (
      const entry
      of history
    ) {
      const timestamp =
        successfulRetrievalHistoryTimestamp(
          entry,
        );

      if (
        timestamp !== null
        && (
          latest === null
          || timestamp > latest
        )
      ) {
        latest =
          timestamp;
      }
    }

    return latest;
  }

  return record?.last_recalled_at
    ?? null;
}

function recallFrequencyAccessibility(record, config) {
  const count = recallCount(record);
  const saturationCount = positiveInteger(config?.saturation_count);
  if (count === null || saturationCount === null) return null;
  return Math.min(1, count / saturationCount);
}

function primitiveCueValues(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item) => ["string", "number", "boolean"].includes(typeof item))
    .map((item) => typeof item === "string" ? item.trim().toLocaleLowerCase("zh-Hant-TW") : item)
    .filter((item) => item !== "");
}

const nativeRetrievalCueKinds =
  new Set([
    "spatial_context",
    "perceptual_modality",
    "observation_kind",
    "memory_type",
    "subjective_episode",
    "entity",
    "semantic",
    "source",
    "temporal",
    "task",
    "goal",
    "internally_reinstated",
  ]);

function normalizeNativeCueKind(
  value,
  options = {},
) {
  const raw =
    nonEmptyString(value)
      ?.toLowerCase()
    ?? null;

  if (!raw) return null;

  const aliases = {
    scene:
      "spatial_context",

    scene_id:
      "spatial_context",

    location:
      "spatial_context",

    location_id:
      "spatial_context",

    sense:
      "perceptual_modality",

    sensory_modality:
      "perceptual_modality",

    subjective_episode_id:
      "subjective_episode",
  };

  const normalized =
    aliases[raw]
    ?? raw;

  if (
    nativeRetrievalCueKinds
      .has(normalized)
  ) {
    return normalized;
  }

  if (
    options.fail_on_unknown
    === true
  ) {
    const error = new Error(
      `Unsupported Phase63B v2 retrieval cue kind: ${raw}`,
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_CUE_KIND_UNSUPPORTED";

    error.cue_kind =
      raw;

    throw error;
  }

  return null;
}

function normalizeNativeCueValue(
  value,
) {
  if (
    ![
      "string",
      "number",
      "boolean",
    ].includes(typeof value)
  ) {
    return null;
  }

  if (typeof value === "string") {
    const normalized =
      value
        .trim()
        .toLocaleLowerCase(
          "zh-Hant-TW",
        );

    return normalized || null;
  }

  return value;
}

function nativeCueIdentity(
  cue,
) {
  return JSON.stringify([
    cue.kind,
    cue.value,
  ]);
}

function nativeCue(
  kind,
  value,
  source,
  extra = {},
  options = {},
) {
  const normalizedKind =
    normalizeNativeCueKind(
      kind,
      options,
    );

  const normalizedValue =
    normalizeNativeCueValue(
      value,
    );

  if (
    !normalizedKind
    || normalizedValue === null
  ) {
    return null;
  }

  return {
    kind:
      normalizedKind,

    value:
      normalizedValue,

    source:
      nonEmptyString(source)
      ?? null,

    ...cloneJson(
      object(extra),
    ),
  };
}

function pushUniqueNativeCue(
  target,
  seen,
  cue,
) {
  if (!cue) return;

  const identity =
    nativeCueIdentity(cue);

  const cueSources =
    [
      ...array(
        cue.sources,
      ),

      cue.source,
    ]
      .filter(
        (value) =>
          nonEmptyString(value),
      )
      .map(
        (value) =>
          nonEmptyString(value),
      );

  if (seen.has(identity)) {
    const existing =
      target[
        seen.get(identity)
      ];

    const mergedSources =
      [
        ...new Set([
          ...array(
            existing.sources,
          ),

          existing.source,

          ...cueSources,
        ].filter(Boolean)),
      ];

    existing.sources =
      mergedSources;

    if (
      !existing.source
      && mergedSources.length
    ) {
      existing.source =
        mergedSources[0];
    }

    return;
  }

  const normalizedCue = {
    ...cue,

    sources:
      [
        ...new Set(
          cueSources,
        ),
      ],
  };

  seen.set(
    identity,
    target.length,
  );

  target.push(
    normalizedCue,
  );
}

function appendExplicitNativeCues(
  target,
  seen,
  values,
  defaultSource,
) {
  if (
    values !== null
    && values !== undefined
    && !Array.isArray(values)
  ) {
    const error = new Error(
      "Phase63B v2 explicit retrieval cue collections must be arrays.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_CUE_LIST_INVALID";

    throw error;
  }

  for (
    const raw
    of array(values)
  ) {
    if (!isObject(raw)) {
      const error = new Error(
        "Phase63B v2 active retrieval cues must be structured objects.",
      );

      error.code =
        "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_CUE_INVALID";

      throw error;
    }

    const cue =
      nativeCue(
        raw.kind,
        raw.value,
        raw.source
          ?? defaultSource,
        {},
        {
          fail_on_unknown:
            true,
        },
      );

    if (!cue) {
      const error = new Error(
        "Phase63B v2 retrieval cue requires a supported kind and primitive value.",
      );

      error.code =
        "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_CUE_INVALID";

      throw error;
    }

    pushUniqueNativeCue(
      target,
      seen,
      cue,
    );
  }
}

function nativeActiveRetrievalCues(
  context,
  currentContext,
) {
  const result = [];
  const seen = new Map();

  pushUniqueNativeCue(
    result,
    seen,
    nativeCue(
      "spatial_context",
      currentContext.scene_id,
      "current_environment",
    ),
  );

  for (
    const sense
    of array(currentContext.senses)
  ) {
    pushUniqueNativeCue(
      result,
      seen,
      nativeCue(
        "perceptual_modality",
        sense,
        "bounded_perception",
      ),
    );
  }

  for (
    const kind
    of array(
      currentContext
        .observation_kinds,
    )
  ) {
    pushUniqueNativeCue(
      result,
      seen,
      nativeCue(
        "observation_kind",
        kind,
        "bounded_perception",
      ),
    );
  }

  for (
    const [
      rawKey,
      rawValue,
    ]
    of Object.entries(
      object(
        context.context_cues,
      ),
    )
  ) {
    const kind =
      normalizeNativeCueKind(
        rawKey,
      );

    if (!kind) continue;

    for (
      const value
      of primitiveCueValues(
        rawValue,
      )
    ) {
      pushUniqueNativeCue(
        result,
        seen,
        nativeCue(
          kind,
          value,
          "explicit_context_cue",
        ),
      );
    }
  }

  const retrievalContext =
    object(
      context.retrieval_context,
    );

  appendExplicitNativeCues(
    result,
    seen,
    retrievalContext.active_cues,
    "explicit_retrieval_context",
  );

  appendExplicitNativeCues(
    result,
    seen,
    retrievalContext
      .recent_retrieved_cues,
    "prior_retrieval_context",
  );

  const retrievalGoal =
    retrievalContext
      .retrieval_goal;

  if (
    [
      "string",
      "number",
      "boolean",
    ].includes(
      typeof retrievalGoal,
    )
  ) {
    pushUniqueNativeCue(
      result,
      seen,
      nativeCue(
        "goal",
        retrievalGoal,
        "explicit_retrieval_goal",
      ),
    );
  } else if (
    isObject(retrievalGoal)
    && Object.hasOwn(
      retrievalGoal,
      "value",
    )
  ) {
    const goalCue =
      nativeCue(
        "goal",
        retrievalGoal.value,
        retrievalGoal.source
          ?? "explicit_retrieval_goal",
      );

    if (!goalCue) {
      const error = new Error(
        "Phase63B v2 retrieval_goal requires a primitive non-empty value.",
      );

      error.code =
        "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_RETRIEVAL_GOAL_INVALID";

      throw error;
    }

    pushUniqueNativeCue(
      result,
      seen,
      goalCue,
    );
  } else if (
    retrievalGoal !== null
    && retrievalGoal !== undefined
  ) {
    const error = new Error(
      "Phase63B v2 retrieval_goal must be a primitive value or an object with value.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_RETRIEVAL_GOAL_INVALID";

    throw error;
  }

  return result;
}

function nativeMemoryCueLinks(
  record,
) {
  const result = [];

  const explicitLinks =
    record
      ?.retrieval_cue_links;

  if (
    explicitLinks !== null
    && explicitLinks !== undefined
    && !Array.isArray(
      explicitLinks,
    )
  ) {
    const error = new Error(
      "Phase63B v2 retrieval_cue_links must be an array when present.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_MEMORY_CUE_LINKS_INVALID";

    throw error;
  }

  for (
    const raw
    of array(
      explicitLinks,
    )
  ) {
    if (!isObject(raw)) continue;

    const cue =
      nativeCue(
        raw.kind,
        raw.value,
        raw.source
          ?? "explicit_memory_cue_link",
        {
          association_evidence:
            cloneJson(
              raw.association_evidence
              ?? null,
            ),

          association_strength:
            unitNumber(
              raw.association_strength,
            ),
        },
      );

    if (cue) {
      // Memory-side cue associations are intentionally NOT
      // deduplicated by kind/value.
      //
      // Several independent encoding/binding relations may point
      // to the same retrieval cue, and later phases must retain
      // their distinct provenance/evidence.
      result.push(
        cue,
      );
    }
  }

  const retrievalCues =
    object(
      record?.retrieval_cues,
    );

  const machineCueMappings = [
    [
      "scene_id",
      "spatial_context",
    ],
    [
      "sense",
      "perceptual_modality",
    ],
    [
      "observation_kind",
      "observation_kind",
    ],
    [
      "memory_type",
      "memory_type",
    ],
    [
      "subjective_episode_id",
      "subjective_episode",
    ],
  ];

  for (
    const [
      field,
      kind,
    ]
    of machineCueMappings
  ) {
    for (
      const value
      of primitiveCueValues(
        retrievalCues[field],
      )
    ) {
      const cue =
        nativeCue(
          kind,
          value,
          "encoded_retrieval_cue",
        );

      if (cue) {
        result.push(
          cue,
        );
      }
    }
  }

  const episodeId =
    nonEmptyString(
      record
        ?.episodic_binding
        ?.subjective_episode_id,
    );

  const episodeCue =
    nativeCue(
      "subjective_episode",
      episodeId,
      "explicit_subjective_episode_binding",
    );

  if (episodeCue) {
    result.push(
      episodeCue,
    );
  }

  return result;
}

function nativeCueRelations(
  record,
  activeCues,
) {
  const memoryCues =
    nativeMemoryCueLinks(
      record,
    );

  const byKind =
    new Map();

  for (
    const cue
    of memoryCues
  ) {
    if (!byKind.has(cue.kind)) {
      byKind.set(
        cue.kind,
        [],
      );
    }

    byKind
      .get(cue.kind)
      .push(cue);
  }

  const matches = [];
  const mismatches = [];
  const unmatchedActiveCues = [];

  for (
    const activeCue
    of activeCues
  ) {
    const sameKind =
      byKind.get(
        activeCue.kind,
      )
      ?? [];

    const exact =
      sameKind.filter(
        (memoryCue) =>
          nativeCueIdentity(
            memoryCue,
          )
          === nativeCueIdentity(
            activeCue,
          ),
      );

    if (exact.length) {
      matches.push({
        cue_identity:
          nativeCueIdentity(
            activeCue,
          ),

        kind:
          activeCue.kind,

        value:
          activeCue.value,

        active_source:
          activeCue.source,

        active_sources:
          cloneJson(
            array(
              activeCue.sources,
            ),
          ),

        memory_sources:
          [
            ...new Set(
              exact
                .map(
                  (item) =>
                    item.source,
                )
                .filter(Boolean),
            ),
          ],

        association_strengths:
          exact
            .map(
              (item) =>
                item
                  .association_strength
                ?? null,
            ),
      });

      continue;
    }

    if (sameKind.length) {
      mismatches.push({
        kind:
          activeCue.kind,

        active_value:
          activeCue.value,

        active_source:
          activeCue.source,

        memory_values:
          sameKind.map(
            (item) =>
              item.value,
          ),
      });

      continue;
    }

    unmatchedActiveCues.push({
      kind:
        activeCue.kind,

      value:
        activeCue.value,

      source:
        activeCue.source,
    });
  }

  return {
    memory_cue_links:
      memoryCues,

    cue_matches:
      matches,

    cue_mismatches:
      mismatches,

    unmatched_active_cues:
      unmatchedActiveCues,

    active_cue_count:
      activeCues.length,

    cue_match_count:
      matches.length,

    cue_evidence_required:
      activeCues.length > 0,

    has_candidate_cue_evidence:
      activeCues.length === 0
      || matches.length > 0,
  };
}

function evaluateNativeCueMemory(
  record,
  originalIndex,
  context,
  activeCues,
) {
  const eligibility =
    engineRetrievalEligibility(
      record,
    );

  const cueRelations =
    nativeCueRelations(
      record,
      activeCues,
    );

  const candidateEligible =
    eligibility.eligible
    && cueRelations
      .has_candidate_cue_evidence;

  const exclusionReasons = [];

  if (!eligibility.policy_eligible) {
    exclusionReasons.push(
      "engine_retrieval_ineligible",
    );
  }

  if (eligibility.suppressed) {
    exclusionReasons.push(
      "memory_suppressed",
    );
  }

  if (
    eligibility.eligible
    && !cueRelations
      .has_candidate_cue_evidence
  ) {
    exclusionReasons.push(
      "no_active_cue_match",
    );
  }

  return {
    memory_id:
      record?.memory_id
      ?? record?.id
      ?? null,

    original_index:
      originalIndex,

    engine_retrieval_eligible:
      eligibility.eligible,

    engine_retrieval_eligibility_source:
      eligibility.source,

    candidate_selection_threshold:
      null,

    candidate_selection_threshold_passed:
      true,

    candidate_eligible:
      candidateEligible,

    exclusion_reasons:
      exclusionReasons,

    active_cue_count:
      cueRelations
        .active_cue_count,

    memory_cue_links:
      cueRelations
        .memory_cue_links,

    cue_matches:
      cueRelations
        .cue_matches,

    cue_mismatches:
      cueRelations
        .cue_mismatches,

    unmatched_active_cues:
      cueRelations
        .unmatched_active_cues,

    cue_match_count:
      cueRelations
        .cue_match_count,

    cue_competition: [],

    storage_strength:
      unitNumber(
        record?.storage_strength,
      ),

    storage_strength_used_as_native_accessibility_bonus:
      false,

    retrieval_history_entry_count:
      retrievalHistoryEntries(
        record,
      ).length,

    retrieval_history_effects_modeled:
      false,

    retrieval_history_effect_owner:
      "Phase63C",

    legacy_recall_summary_used_in_native_v2:
      false,

    same_cycle_retrieval_history_effect_used:
      false,

    accessibility_score:
      null,

    accessibility_score_origin:
      "native_v2_no_scalar_model",

    age_hours:
      elapsedHours(
        context.simulation_time
        ?? context.world_state
          ?.simulation_time
        ?? null,

        record?.encoded_at
        ?? record?.remembered_at,
      ),

    // Deprecated v1 diagnostics remain shape-compatible.
    accessible_by_record:
      eligibility.eligible,

    threshold_passed:
      true,

    retrievable:
      candidateEligible,

    retrieval_strength:
      null,

    retrieval_threshold:
      null,

    context_match:
      null,

    context_match_details: {},

    interference_competitor_count:
      null,

    interference_penalty:
      null,

    components: {},
  };
}

function attachNativeCueCompetition(
  evaluations,
) {
  const fanOut =
    new Map();

  for (
    const evaluation
    of evaluations
  ) {
    if (
      !evaluation
        .engine_retrieval_eligible
    ) {
      continue;
    }

    for (
      const match
      of array(
        evaluation.cue_matches,
      )
    ) {
      const identity =
        match.cue_identity;

      if (!fanOut.has(identity)) {
        fanOut.set(
          identity,
          [],
        );
      }

      fanOut
        .get(identity)
        .push(
          evaluation.memory_id,
        );
    }
  }

  for (
    const evaluation
    of evaluations
  ) {
    evaluation.cue_competition =
      array(
        evaluation.cue_matches,
      )
        .map((match) => {
          const candidateIds =
            fanOut.get(
              match.cue_identity,
            )
            ?? [];

          const competingIds =
            candidateIds.filter(
              (memoryId) =>
                String(memoryId)
                !== String(
                  evaluation.memory_id,
                ),
            );

          return {
            cue_identity:
              match.cue_identity,

            kind:
              match.kind,

            value:
              match.value,

            candidate_fan_out:
              candidateIds.length,

            competing_candidate_count:
              competingIds.length,

            competing_memory_ids:
              cloneJson(
                competingIds,
              ),

            diagnosticity:
              candidateIds.length <= 1
                ? "unique_within_current_query"
                : "shared_within_current_query",

            numeric_penalty_applied:
              false,
          };
        });
  }

  return evaluations;
}

function assertNativeV2ProfileBoundary(
  profile,
) {
  const forbiddenLegacyFields = [
    "component_weights",
    "context_cue_weights",
    "interference",
    "retrieval_threshold",
    "age_accessibility",
    "recall_recency",
    "recall_frequency",
  ];

  const present =
    forbiddenLegacyFields.filter(
      (field) =>
        Object.hasOwn(
          profile,
          field,
        ),
    );

  if (present.length) {
    const error = new Error(
      "Phase63B native v2 cue accessibility cannot mix legacy weighted-model components.",
    );

    error.code =
      "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_NATIVE_V2_LEGACY_COMPONENTS_UNSUPPORTED";

    error.legacy_fields =
      present;

    throw error;
  }
}

function cuesOverlap(left, right) {
  const leftValues = primitiveCueValues(left);
  const rightValues = primitiveCueValues(right);
  if (!leftValues.length || !rightValues.length) return null;
  const rightSet = new Set(rightValues.map((item) => JSON.stringify(item)));
  return leftValues.some((item) => rightSet.has(JSON.stringify(item)));
}

function memoryCue(record, key) {
  const source = object(record?.source);
  const content = object(record?.content ?? record?.memory ?? record?.summary);
  const retrievalCues = object(record?.retrieval_cues);
  if (Object.hasOwn(retrievalCues, key)) return retrievalCues[key];
  if (key === "scene_id") return source.scene_id ?? record?.source_scene_id ?? null;
  if (key === "sense") return source.sense ?? record?.source_sense ?? null;
  if (key === "observation_kind") return content.kind ?? null;
  if (key === "memory_type") return record?.memory_type ?? null;
  return null;
}

function currentCue(currentContext, key) {
  const context = object(currentContext);
  const cues = object(context.cues);
  if (Object.hasOwn(cues, key)) return cues[key];
  if (key === "scene_id") return context.scene_id ?? null;
  if (key === "sense") return context.senses ?? context.sense ?? null;
  if (key === "observation_kind") return context.observation_kinds ?? null;
  if (key === "memory_type") return context.memory_types ?? null;
  return null;
}

function contextMatch(record, currentContext, cueWeights) {
  let weightedMatch = 0;
  let comparableWeight = 0;
  const details = {};
  for (const [key, rawWeight] of Object.entries(object(cueWeights))) {
    const weight = positiveNumber(rawWeight);
    if (weight === null) continue;
    const memoryValue = memoryCue(record, key);
    const currentValue = currentCue(currentContext, key);
    const match = cuesOverlap(memoryValue, currentValue);
    if (match === null) continue;
    comparableWeight += weight;
    if (match) weightedMatch += weight;
    details[key] = {
      comparable: true,
      matched: match,
      weight,
    };
  }
  if (comparableWeight <= 0) return { value: null, details };
  return {
    value: weightedMatch / comparableWeight,
    details,
  };
}

function interferenceKeys(record) {
  return primitiveCueValues(record?.interference_keys);
}

function interferenceFor(record, candidates, config) {
  const perCompetitorPenalty = unitNumber(config?.per_competitor_penalty);
  if (config?.enabled !== true || perCompetitorPenalty === null || perCompetitorPenalty <= 0) {
    return { competitor_count: 0, penalty: 0 };
  }
  const keys = interferenceKeys(record);
  if (!keys.length) return { competitor_count: 0, penalty: 0 };
  const ownId = String(record?.memory_id ?? record?.id ?? "");
  const keySet = new Set(keys.map((item) => JSON.stringify(item)));
  let competitorCount = 0;
  for (const other of candidates) {
    if (other === record) continue;
    const otherId = String(other?.memory_id ?? other?.id ?? "");
    if (ownId && otherId && ownId === otherId) continue;
    const otherKeys = interferenceKeys(other);
    if (otherKeys.some((item) => keySet.has(JSON.stringify(item)))) competitorCount += 1;
  }
  const uncapped = competitorCount * perCompetitorPenalty;
  const configuredCap = unitNumber(config?.max_penalty);
  const penalty = configuredCap === null
    ? Math.min(1, uncapped)
    : Math.min(configuredCap, uncapped);
  return { competitor_count: competitorCount, penalty };
}

function perceptionContext(context) {
  const perception = object(context.perception);
  const senses = new Set();
  const kinds = new Set();
  const collect = (sense, values) => {
    for (const value of array(values)) {
      senses.add(sense);
      if (isObject(value) && nonEmptyString(value.kind)) kinds.add(nonEmptyString(value.kind));
    }
  };
  collect("visual", perception.observed);
  collect("auditory", perception.audible);
  for (const value of array(perception.other_senses)) {
    const sense = isObject(value) ? nonEmptyString(value.sense) : null;
    if (sense) senses.add(sense);
    if (isObject(value) && nonEmptyString(value.kind)) kinds.add(nonEmptyString(value.kind));
  }
  return {
    scene_id: context.scene_id ?? perception.scene_id ?? null,
    senses: [...senses],
    observation_kinds: [...kinds],
    cues: cloneJson(object(context.context_cues)),
  };
}

function componentValue(record, component, context, profile, currentContext) {
  const now = context.simulation_time ?? context.world_state?.simulation_time ?? null;
  if (component === "storage_strength") return unitNumber(record?.storage_strength);
  if (component === "encoding_retrieval_strength") {
    return unitNumber(record?.retrieval_strength_at_encoding ?? record?.initial_retrieval_strength);
  }
  if (component === "age_accessibility") {
    const ageHours = elapsedHours(now, record?.encoded_at ?? record?.remembered_at);
    return decayAccessibility(ageHours, object(profile.age_accessibility));
  }
  if (component === "recall_recency") {
    const recallAgeHours =
      elapsedHours(
        now,
        lastSuccessfulRecallAt(
          record,
        ),
      );

    return decayAccessibility(
      recallAgeHours,
      object(
        profile.recall_recency,
      ),
    );
  }
  if (component === "recall_frequency") {
    return recallFrequencyAccessibility(record, object(profile.recall_frequency));
  }
  if (component === "context_match") {
    return contextMatch(record, currentContext, object(profile.context_cue_weights)).value;
  }
  return null;
}

function evaluateMemory(record, originalIndex, candidates, context, profile, currentContext) {
  const componentWeights = object(profile.component_weights);
  const components = {};
  let weightedValue = 0;
  let totalWeight = 0;

  for (const [component, rawWeight] of Object.entries(componentWeights)) {
    const weight = positiveNumber(rawWeight);
    if (weight === null) continue;
    const value = unitNumber(componentValue(record, component, context, profile, currentContext));
    components[component] = {
      value,
      weight,
      used: value !== null,
    };
    if (value === null) continue;
    weightedValue += value * weight;
    totalWeight += weight;
  }

  const baseScore = totalWeight > 0 ? weightedValue / totalWeight : null;
  const interference = interferenceFor(record, candidates, object(profile.interference));
  const retrievalStrength = baseScore === null
    ? null
    : Math.max(0, Math.min(1, baseScore - interference.penalty));

  const threshold =
    unitNumber(
      profile.retrieval_threshold,
    );

  const eligibility =
    engineRetrievalEligibility(
      record,
    );

  const thresholdPassed =
    retrievalStrength === null
    || threshold === null
    || retrievalStrength >= threshold;

  const candidateEligible =
    eligibility.eligible
    && thresholdPassed;

  const exclusionReasons = [];

  if (!eligibility.policy_eligible) {
    exclusionReasons.push(
      "engine_retrieval_ineligible",
    );
  }

  if (eligibility.suppressed) {
    exclusionReasons.push(
      "memory_suppressed",
    );
  }

  if (!thresholdPassed) {
    exclusionReasons.push(
      "legacy_selection_threshold_not_passed",
    );
  }

  const currentContextMatch =
    contextMatch(
      record,
      currentContext,
      object(profile.context_cue_weights),
    );

  return {
    memory_id:
      record?.memory_id
      ?? record?.id
      ?? null,

    original_index:
      originalIndex,

    engine_retrieval_eligible:
      eligibility.eligible,

    engine_retrieval_eligibility_source:
      eligibility.source,

    candidate_selection_threshold:
      threshold,

    candidate_selection_threshold_passed:
      thresholdPassed,

    candidate_eligible:
      candidateEligible,

    exclusion_reasons:
      exclusionReasons,

    // Deprecated Phase63B-v1 diagnostic aliases.
    accessible_by_record:
      eligibility.eligible,

    threshold_passed:
      thresholdPassed,

    retrievable:
      candidateEligible,

    storage_strength:
      unitNumber(
        record?.storage_strength,
      ),

    // During Step 1, enabled legacy v1 profiles still use their
    // old weighted scalar. The v2 name deliberately describes
    // this as a simulator accessibility score rather than a
    // literal human Retrieval Strength measurement.
    accessibility_score:
      retrievalStrength,

    accessibility_score_origin:
      profile.enabled === true
        ? "legacy_v1_weighted_compatibility"
        : "unspecified",

    // Deprecated v1 diagnostic aliases.
    retrieval_strength:
      retrievalStrength,

    retrieval_threshold:
      threshold,
    age_hours: elapsedHours(
      context.simulation_time ?? context.world_state?.simulation_time ?? null,
      record?.encoded_at ?? record?.remembered_at,
    ),
    recall_age_hours:
      elapsedHours(
        context.simulation_time
        ?? context.world_state
          ?.simulation_time
        ?? null,

        lastSuccessfulRecallAt(
          record,
        ),
      ),

    recall_count:
      recallCount(
        record,
      ),

    recall_history_source:
      legacyRecallHistorySource(
        record,
      ),

    retrieval_history_entry_count:
      retrievalHistoryEntries(
        record,
      ).length,

    explicit_successful_retrieval_history_count:
      successfulRetrievalHistoryEntries(
        record,
      ).length,

    legacy_recall_count_summary:
      nonNegativeInteger(
        record?.recall_count,
      ),

    legacy_last_recalled_at_summary:
      record?.last_recalled_at
      ?? null,
    context_match: currentContextMatch.value,
    context_match_details: currentContextMatch.details,
    interference_competitor_count: interference.competitor_count,
    interference_penalty: interference.penalty,
    components,
  };
}

function stableRank(evaluations) {
  return [...evaluations].sort((left, right) => {
    const leftScore = left.retrieval_strength;
    const rightScore = right.retrieval_strength;
    if (leftScore !== null && rightScore !== null && Math.abs(leftScore - rightScore) > 1e-12) {
      return rightScore - leftScore;
    }
    if (leftScore !== null && rightScore === null) return -1;
    if (leftScore === null && rightScore !== null) return 1;
    return left.original_index - right.original_index;
  });
}

function solveMemoryAccessibility(context) {
  const records = array(context.memory_records);
  const profile =
    profileFor(context);

  const modelMode =
    profileModelMode(profile);

  const nativeV2 =
    modelMode
    === memoryAccessibilityModelModes
      .NATIVE_V2;

  if (nativeV2) {
    assertNativeV2ProfileBoundary(
      profile,
    );
  }

  const configured =
    profile.enabled === true;

  const currentContext =
    perceptionContext(context);

  const activeRetrievalCues =
    nativeV2
      ? nativeActiveRetrievalCues(
        context,
        currentContext,
      )
      : [];

  const candidates =
    records.filter(
      (record) =>
        isObject(record),
    );

  const evaluations =
    nativeV2
      ? attachNativeCueCompetition(
        candidates.map(
          (
            record,
            index,
          ) =>
            evaluateNativeCueMemory(
              record,

              records.indexOf(record) >= 0
                ? records.indexOf(record)
                : index,

              context,

              activeRetrievalCues,
            ),
        ),
      )
      : candidates.map(
        (
          record,
          index,
        ) =>
          evaluateMemory(
            record,

            records.indexOf(record) >= 0
              ? records.indexOf(record)
              : index,

            candidates,
            context,
            profile,
            currentContext,
          ),
      );

  const byId = new Map();
  const byIndex = new Map();
  for (const evaluation of evaluations) {
    if (evaluation.memory_id !== null && evaluation.memory_id !== undefined) {
      byId.set(String(evaluation.memory_id), evaluation);
    }
    byIndex.set(evaluation.original_index, evaluation);
  }

  const rankedEvaluations =
    configured
      ? stableRank(
        evaluations.filter(
          (item) =>
            item.candidate_eligible,
        ),
      )
      : evaluations.filter(
        (item) =>
          item.engine_retrieval_eligible,
      );

  const rankedRecords = [];

  for (const evaluation of rankedEvaluations) {
    const record =
      records[
        evaluation.original_index
      ];

    if (isObject(record)) {
      rankedRecords.push(
        cloneJson(record),
      );
    }
  }

  // Step 1 separates the semantic candidate set from the old
  // max_items projection behavior without changing the current
  // world-loop behavior yet.
  const candidateRecords =
    rankedRecords
      .map(cloneJson);

  const maxItems =
    positiveInteger(
      profile.max_items,
    );

  const legacyProjectedRecords =
    maxItems === null
      ? rankedRecords
      : rankedRecords.slice(
        0,
        Math.min(32, maxItems),
      );

  return {
    status:
      configured
        ? "programmatic_memory_accessibility_applied"
        : "legacy_memory_accessibility_preserved",

    version:
      worldSimulationMemoryAccessibilityVersion,

    character:
      nonEmptyString(
        context.character,
      ),

    model_mode:
      modelMode,

    accessibility_enforced:
      configured,

    current_context:
      currentContext,

    active_retrieval_cues:
      nativeV2
        ? cloneJson(
          activeRetrievalCues,
        )
        : [],

    candidate_selection_threshold:
      nativeV2
        ? null
        : unitNumber(
          profile.retrieval_threshold,
        ),

    evaluated_memory_count:
      evaluations.length,

    candidate_memory_count:
      candidateRecords.length,

    candidate_memory_records:
      candidateRecords,

    candidate_evaluations:
      evaluations.map(
        (evaluation) =>
          cloneJson(evaluation),
      ),

    candidate_ranking:
      rankedEvaluations.map(
        (
          evaluation,
          rankIndex,
        ) => ({
          rank:
            rankIndex + 1,

          memory_id:
            evaluation.memory_id,

          accessibility_score:
            evaluation
              .accessibility_score,

          original_index:
            evaluation
              .original_index,
        }),
      ),

    // Deprecated Phase63B-v1 compatibility aliases.
    //
    // The world loop still consumes these during Step 1.
    retrieval_threshold:
      nativeV2
        ? null
        : unitNumber(
          profile.retrieval_threshold,
        ),

    configured_max_items:
      maxItems === null
        ? null
        : Math.min(32, maxItems),

    legacy_projection_max_items:
      maxItems === null
        ? null
        : Math.min(32, maxItems),

    retrievable_memory_count:
      legacyProjectedRecords.length,

    retrievable_memory_records:
      legacyProjectedRecords
        .map(cloneJson),

    evaluations:
      evaluations.map(
        (evaluation) =>
          cloneJson(evaluation),
      ),

    ranking:
      rankedEvaluations.map(
        (
          evaluation,
          rankIndex,
        ) => ({
          rank:
            rankIndex + 1,

          memory_id:
            evaluation.memory_id,

          retrieval_strength:
            evaluation
              .retrieval_strength,

          original_index:
            evaluation
              .original_index,
        }),
      ),
    accessibility_boundary: {
      current_accessibility_is_not_successful_retrieval:
        true,

      candidate_terminology_is_canonical:
        true,

      legacy_retrievable_records_compatibility_output_emitted:
        true,

      native_v2_cue_schema_reserved:
        false,

      native_v2_cue_algorithm_modeled:
        true,

      native_v2_cue_algorithm_owner:
        "phase63b_cue_dependent_evaluator",

      typed_active_retrieval_cues_supported:
        true,

      duplicate_active_cue_sources_preserved:
        true,

      independent_memory_cue_associations_preserved:
        true,

      malformed_explicit_cue_structures_rejected:
        true,

      encoding_linked_memory_cues_supported:
        true,

      subjective_episode_cues_supported:
        true,

      query_relative_cue_competition_modeled:
        true,

      fixed_per_competitor_penalty_in_native_v2:
        false,

      native_accessibility_score_defaults_to_null:
        true,

      native_storage_strength_direct_bonus:
        false,

      native_legacy_component_mixing_rejected:
        true,

      hidden_temporal_context_vector_modeled:
        false,

      universal_context_drift_assumed:
        false,

      random_retrieval_sampling_used:
        false,

      native_v2_retrieval_history_effects_modeled:
        false,

      retrieval_event_schema_installed:
        false,

      retrieval_event_schema_owner:
        "Phase63C",

      retrieval_history_mutation_owner:
        "Phase63C",

      same_cycle_retrieval_history_feedback_allowed:
        false,

      projected_memory_context_counts_as_successful_retrieval:
        false,

      legacy_retrieval_history_precedes_summary_fields:
        true,

      legacy_retrieval_history_requires_explicit_success:
        true,

      failed_or_ambiguous_history_entries_count_as_successful_recall:
        false,

      unknown_explicit_model_mode_rejected:
        true,

      legacy_v1_weighted_model_still_available:
        true,

      scalar_accessibility_score_is_simulator_diagnostic:
        true,

      scalar_accessibility_score_is_literal_human_psychometric_measurement:
        false,

      engine_retrieval_eligibility_is_not_psychological_retrievability:
        true,

      projection_budget_is_not_cognitive_capacity:
        true,

      legacy_max_items_still_applied_to_legacy_projection_alias:
        true,

      actual_retrieval_outcome_owned_by_phase63c:
        true,

      storage_strength_and_retrieval_strength_are_separate: true,
      time_passage_does_not_rewrite_persistent_memory_records: true,
      forgetting_does_not_delete_memory_records: true,
      confidence_and_clarity_are_not_rewritten_by_accessibility: true,
      no_universal_forgetting_curve_is_assumed: true,
      time_decay_mode_and_parameters_require_explicit_configuration: true,
      context_matching_uses_only_explicit_machine_readable_cues: true,
      interference_requires_explicit_memory_interference_keys: true,
      free_text_semantic_similarity_modeled: false,
      recall_history_is_read_only_in_this_phase: true,
      recall_reinforcement_modeled: false,
      source_confusion_or_memory_distortion_modeled: false,
      consolidation_or_semanticization_modeled: false,
      retrieval_strength_scores_are_diagnostics_not_character_brain_inputs: true,
      character_brain_decides_memory_accessibility: false,
    },
  };
}

export function buildWorldSimulationMemoryCueLinks(record = {}) {
  const snapshot = cloneJson(record);
  return deepFreeze(
    cloneJson(
      nativeMemoryCueLinks(snapshot),
    ),
  );
}

export function queryWorldSimulationMemoryAccessibility(input = {}) {
  const context = cloneJson({
    world_state: object(input.world_state),
    character: input.character ?? null,
    memory_records: array(input.memory_records),
    memory_retrieval_profile: isObject(input.memory_retrieval_profile)
      ? input.memory_retrieval_profile
      : undefined,
    simulation_time: input.simulation_time ?? input.world_state?.simulation_time ?? null,
    scene_id: input.scene_id ?? input.perception?.scene_id ?? null,
    perception: object(input.perception),
    context_cues:
      object(
        input.context_cues,
      ),

    retrieval_context:
      object(
        input.retrieval_context,
      ),
  });
  const inputHashBefore = hashAgentRunValue(context);
  const runOnce = () => solveMemoryAccessibility(deepFreeze(cloneJson(context)));
  const first = cloneJson(runOnce());
  const second = input.verify_determinism === false ? first : cloneJson(runOnce());
  const firstHash = hashAgentRunValue(first);
  const secondHash = hashAgentRunValue(second);
  if (firstHash !== secondHash) {
    const error = new Error("Memory accessibility query produced non-deterministic output for identical input.");
    error.code = "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_NONDETERMINISTIC";
    error.first_output_hash = firstHash;
    error.second_output_hash = secondHash;
    throw error;
  }
  if (hashAgentRunValue(context) !== inputHashBefore) {
    const error = new Error("Memory accessibility query mutated its input context.");
    error.code = "WORLD_SIMULATION_MEMORY_ACCESSIBILITY_INPUT_MUTATION";
    throw error;
  }
  const audit = {
    version: worldSimulationMemoryAccessibilityVersion,
    character: nonEmptyString(input.character),
    input_context_hash: inputHashBefore,
    result_hash: firstHash,
    input_context_immutable: true,
    deterministic_replay_verified: input.verify_determinism !== false,
    read_only_memory_accessibility_query: true,
    query_output_contains_world_state: false,
    query_output_contains_mutation_proposals: false,
    persistent_memory_records_mutated: false,
    character_brain_decides_memory_accessibility: false,
  };
  audit.audit_hash = hashAgentRunValue(audit);
  return {
    memory_accessibility_version: worldSimulationMemoryAccessibilityVersion,
    result: first,
    audit,
  };
}

export function buildWorldSimulationMemoryAccessibilityContract() {
  return {
    version: worldSimulationMemoryAccessibilityVersion,
    owner: "programmatic_subjective_memory_retrieval",
    read_only: true,
    immutable_input_context: true,
    deterministic_replay_required: true,
    current_accessibility_is_not_successful_retrieval:
      true,

    candidate_terminology_supported:
      true,

    candidate_memory_records_are_not_asserted_successfully_retrieved:
      true,

    native_v2_cue_schema_reserved:
      false,

    native_v2_cue_algorithm_modeled:
      true,

    native_v2_cue_algorithm_owner:
      "phase63b_cue_dependent_evaluator",

    typed_active_retrieval_cues_supported:
      true,

    duplicate_active_cue_sources_preserved:
      true,

    independent_memory_cue_associations_preserved:
      true,

    malformed_explicit_cue_structures_rejected:
      true,

    encoding_linked_memory_cues_supported:
      true,

    subjective_episode_cues_supported:
      true,

    canonical_memory_cue_links_exported_for_phase63c:
      true,

    cue_link_export_is_read_only:
      true,

    query_relative_cue_competition_modeled:
      true,

    fixed_per_competitor_penalty_in_native_v2:
      false,

    native_accessibility_score_defaults_to_null:
      true,

    native_storage_strength_direct_bonus:
      false,

    native_legacy_component_mixing_rejected:
      true,

    hidden_temporal_context_vector_modeled:
      false,

    universal_context_drift_assumed:
      false,

    random_retrieval_sampling_used:
      false,

    native_v2_retrieval_history_effects_modeled:
      false,

    retrieval_event_schema_installed:
      false,

    retrieval_event_schema_owner:
      "Phase63C",

    retrieval_history_mutation_owner:
      "Phase63C",

    same_cycle_retrieval_history_feedback_allowed:
      false,

    projected_memory_context_counts_as_successful_retrieval:
      false,

    legacy_retrieval_history_precedes_summary_fields:
      true,

    legacy_retrieval_history_requires_explicit_success:
      true,

    failed_or_ambiguous_history_entries_count_as_successful_recall:
      false,

    unknown_explicit_model_mode_rejected:
      true,

    legacy_v1_weighted_compatibility_supported:
      true,

    scalar_accessibility_score_is_simulator_decision_variable:
      true,

    scalar_accessibility_score_is_literal_human_psychometric_measurement:
      false,

    native_scalar_accessibility_requires_explicit_model:
      true,

    engine_retrieval_eligibility_supported:
      true,

    legacy_accessible_field_supported_as_eligibility_alias:
      true,

    engine_retrieval_eligibility_is_not_psychological_retrievability:
      true,

    projection_budget_is_not_cognitive_capacity:
      true,

    actual_retrieval_outcome_owned_by_phase63c:
      true,

    storage_strength_and_retrieval_strength_separate: true,
    persistent_memory_decay_writes_allowed: false,
    forgetting_deletes_memory_records: false,
    explicit_profile_required_for_programmatic_filtering: true,
    universal_forgetting_curve_assumed: false,
    supported_explicit_age_functions: ["none", "hyperbolic", "exponential", "power"],
    recency_frequency_context_and_interference_components_supported: true,
    explicit_context_cues_only: true,
    explicit_interference_keys_only: true,
    free_text_semantic_similarity_modeled: false,
    recall_reinforcement_modeled: false,
    source_confusion_or_distortion_modeled: false,
    consolidation_or_semanticization_modeled: false,
    retrieval_strength_scores_forwarded_to_character_brain: false,
    world_state_mutation_allowed: false,
    mutation_proposal_output_allowed: false,
    character_brain_decides_memory_accessibility: false,
  };
}

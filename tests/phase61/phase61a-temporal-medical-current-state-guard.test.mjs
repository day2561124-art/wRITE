import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildMedicalContinuitySnapshot,
  deriveMedicalTemporalContext,
  loadMedicalContinuityConfig,
  resolveInjuryStatus,
} from "../../server/src/medical-continuity-service.mjs";
import {
  buildFormalRelevantCanon,
  classifyContinuityMedicalFact,
} from "../../server/src/formal-relevant-canon-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import {
  buildPostDraftNeuralCritique,
} from "../../server/src/post-draft-line-diagnostic-service.mjs";
import {
  boundRelevantCanonForFormalContext,
  buildBoundedFormalContext,
} from "../../server/src/gpt-writing-context-service.mjs";


const oversizedRelevantCanon = {
  schema_version: "phase61-fixture",
  characters: Array.from({ length: 24 }, (_, index) => ({
    entity_id: `character-${index}`,
    content: `角色資料-${index}-` + "甲".repeat(1_200),
  })),
  current_status: [],
  abilities_and_weapons: [],
  organizations_and_locations: [],
  world_rules: [],
  timeline_and_events: [],
  continuity_facts: [],
  provenance: [{
    source: "structured_canon_entity_registry",
    freshness: "current",
    hard_fact_authority: true,
  }],
  retrieval_diagnostics: {
    registry_stale: false,
    medical_history_and_current_state_separated: true,
  },
  medical_temporal_resolution: {
    recomputed_for_story_time: true,
    clearance_axes_independent: true,
  },
  active_engine_retrieval_chars: 0,
};
const boundedOversizedRelevantCanon = boundRelevantCanonForFormalContext(
  oversizedRelevantCanon,
  18_000,
);
assert.equal(boundedOversizedRelevantCanon.truncated, true);
assert(
  JSON.stringify(boundedOversizedRelevantCanon.value, null, 2).length
    <= 18_000,
);
assert.equal(
  boundedOversizedRelevantCanon.value.provenance[0].source,
  "structured_canon_entity_registry",
  "formal relevant Canon budget truncation removed critical provenance",
);
assert.equal(
  boundedOversizedRelevantCanon.value.retrieval_diagnostics
    .medical_history_and_current_state_separated,
  true,
);
assert.equal(
  boundedOversizedRelevantCanon.value.medical_temporal_resolution
    .clearance_axes_independent,
  true,
);

for (const collectionKey of [
  "characters",
  "current_status",
  "abilities_and_weapons",
  "organizations_and_locations",
  "world_rules",
  "timeline_and_events",
  "continuity_facts",
]) {
  assert(
    Array.isArray(boundedOversizedRelevantCanon.value[collectionKey]),
    `bounded relevant Canon omitted required array: ${collectionKey}`,
  );
}

const outerBudgetFixture = {
  ...oversizedRelevantCanon,
  characters: [{
    entity_id: "character-九逃",
    name: "九逃",
    content: "九逃角色資料",
  }],
  current_status: [{
    entity_id: "status-九逃",
    category: "status_effect",
    name: "九逃",
    content: [
      "角色：九逃",
      "當前肉體狀態：recovered_stable",
      "歷史證據錨點（僅供追溯，不代表目前仍有限制）：",
      "左前臂裂傷、左肩外側切創；當日不得再進訓練場；左臂當晚不能沾水",
    ].join("\n"),
  }],
};
const outerBounded = buildBoundedFormalContext({
  sources: {
    active_engine: {
      path: "data/canon_db/active_engine.md",
      hash: "fixture-active-engine",
      exists: true,
      authority_level: "active_hard_canon",
    },
  },
  original_task_prompt: "九逃目前傷勢與異能武裝使用限制。",
  task_prompt: "九逃目前傷勢與異能武裝使用限制。",
  relevant_canon: outerBudgetFixture,
  retrieval_plan: {
    characters: ["九逃"],
    status_effects: ["九逃目前傷勢"],
    world_rules: ["高科技靈力醫療與治療限制"],
  },
  planned_entity_manifest: {},
  planned_entity_hydration: {},
  planned_canon_coverage: {},
  latest_settled_continuity: {},
  content: {
    chapter_anchor: {},
    writing_card_director_context: null,
  },
  inputs: {
    generation_context: {
      oversized: "乙".repeat(22_000),
    },
    retrieval_context: {
      oversized: "丙".repeat(22_000),
    },
  },
}, 48_000);
const outerRelevantCanon = outerBounded.value.materials.relevant_canon;
assert(Array.isArray(outerRelevantCanon.current_status));
assert.match(
  outerRelevantCanon.current_status
    .map((record) => record.content)
    .join("\n"),
  /九逃[^]*左前臂裂傷、左肩外側切創/u,
  "outer formal materials budget removed requested medical evidence",
);
assert.equal(
  outerRelevantCanon.provenance[0].source,
  "structured_canon_entity_registry",
  "outer formal materials budget removed relevant Canon provenance",
);


const realisticPhase58BudgetFixture = {
  schema_version: "phase58-realistic-budget-fixture",
  characters: [
    {
      entity_id: "character-九逃",
      name: "九逃",
      content: "九逃角色資料" + "甲".repeat(700),
    },
    {
      entity_id: "character-御先",
      name: "御先",
      content: "御先角色資料" + "乙".repeat(700),
    },
  ],
  current_status: [
    {
      entity_id: "status-九逃",
      category: "status_effect",
      name: "九逃",
      content: [
        "角色：九逃",
        "當前肉體狀態：recovered_stable",
        "歷史傷勢：第十九章｜sutured_laceration｜左前臂、左肩外側｜過去限制（已失效）：左臂當晚不能沾水、當日不得再進訓練場",
        "歷史證據錨點（僅供追溯，不代表目前仍有限制）：九逃成立左前臂裂傷、左肩外側切創",
      ].join("\n"),
      structured_status: {
        state_model_version: "medical-continuity-v1",
        status_id: "status-九逃",
        current_physical_status: "recovered_stable",
        current_spiritual_status: "stable",
        active_restrictions: [],
        daily_activity_clearance: "cleared",
        low_load_training_clearance: "not_recorded",
        training_clearance: "not_recorded",
        competition_clearance: "not_recorded",
        weapon_summon_clearance: "not_recorded",
        high_load_manifestation_clearance: "not_recorded",
        last_confirmed_evidence: Array.from({ length: 16 }, (_, index) => ({
          match: `九逃歷史證據-${index}-` + "丙".repeat(140),
        })),
        temporal_resolution: {
          evaluated_at_story_time: "120h_after_latest_settled_continuity",
          evidence: "丁".repeat(1_600),
        },
        evaluated_at_story_time: "120h_after_latest_settled_continuity",
        resolution_basis: "ordinary_recovery_policy",
        clearance_independent: true,
      },
    },
    {
      entity_id: "status-御先",
      category: "status_effect",
      name: "御先",
      content: [
        "角色：御先",
        "當前靈力狀態：unresolved_unclassified_weapon_release_residue",
        "歷史證據錨點（僅供追溯，不代表目前仍有限制）：御先於武裝解除末段留下未分類靈力殘痕",
      ].join("\n"),
      structured_status: {
        state_model_version: "medical-continuity-v1",
        status_id: "status-御先",
        current_physical_status: "normal_on_latest_exam",
        current_spiritual_status:
          "unresolved_unclassified_weapon_release_residue",
        active_restrictions: [],
        daily_activity_clearance: "cleared",
        low_load_training_clearance: "deferred",
        training_clearance: "deferred",
        competition_clearance: "deferred",
        weapon_summon_clearance: "deferred",
        high_load_manifestation_clearance: "deferred",
        last_confirmed_evidence: Array.from({ length: 16 }, (_, index) => ({
          match: `御先殘痕證據-${index}-` + "戊".repeat(140),
        })),
        temporal_resolution: {
          evaluated_at_story_time: "current_continuity_head",
          evidence: "己".repeat(1_600),
        },
        evaluated_at_story_time: "current_continuity_head",
        resolution_basis: "special_injury_not_auto_resolved",
        clearance_independent: true,
      },
    },
  ],
  abilities_and_weapons: [
    {
      entity_id: "weapon-聖星法典",
      name: "聖星法典",
      content: "九逃《聖星法典》治療、防護、淨化與結界。",
    },
    {
      entity_id: "weapon-星紋守願",
      name: "星紋守願",
      content: "御先《星紋守願》反轉限制。" + "庚".repeat(3_200),
    },
  ],
  organizations_and_locations: [],
  world_rules: [
    {
      entity_id: "rule-weapon",
      name: "異能武裝靈魂內收納、召喚與維持準則",
      content: "異能武裝規則" + "辛".repeat(900),
    },
    {
      entity_id: "rule-ability",
      name: "能力體系",
      content: "能力體系規則" + "壬".repeat(900),
    },
    {
      entity_id: "rule-medical",
      name: "高科技靈力醫療、治療型武裝與生命復歸",
      content: "高科技醫療規則" + "癸".repeat(900),
    },
  ],
  timeline_and_events: [{
    entity_id: "timeline#timeline",
    category: "timeline_event",
    name: "第二十八章",
    content: "第二十八章時間線",
    source: { kind: "latest_settled_continuity_overlay" },
  }],
  continuity_facts: Array.from({ length: 12 }, (_, index) => ({
    entity_id: `continuity-${index}`,
    content: `次要承接-${index}-` + "子".repeat(500),
  })),
  provenance: [{
    source: "structured_canon_entity_registry",
    freshness: "current",
    hard_fact_authority: true,
  }],
  retrieval_diagnostics: {
    registry_stale: false,
    medical_history_and_current_state_separated: true,
    details: "丑".repeat(600),
  },
  medical_temporal_resolution: {
    recomputed_for_story_time: true,
    clearance_axes_independent: true,
  },
  active_engine_retrieval_chars: 7_500,
};
const realisticPhase58Bound = boundRelevantCanonForFormalContext(
  realisticPhase58BudgetFixture,
  18_000,
);
const realisticPhase58Content = [
  ...realisticPhase58Bound.value.characters,
  ...realisticPhase58Bound.value.current_status,
  ...realisticPhase58Bound.value.abilities_and_weapons,
  ...realisticPhase58Bound.value.world_rules,
  ...realisticPhase58Bound.value.timeline_and_events,
].map((record) => record.content).join("\n");
assert(
  JSON.stringify(realisticPhase58Bound.value, null, 2).length <= 18_000,
);
assert.match(realisticPhase58Content, /九逃[^]*左前臂裂傷/u);
assert.match(realisticPhase58Content, /左肩外側切創/u);
assert.match(
  realisticPhase58Content,
  /當日不得再進訓練場|左臂當晚不能沾水/u,
);
assert.match(realisticPhase58Content, /御先[^]*未分類靈力殘痕/u);
assert.match(realisticPhase58Content, /武裝解除末段/u);
assert(realisticPhase58Bound.value.abilities_and_weapons.some(
  (record) => record.name === "聖星法典",
));
assert(
  realisticPhase58Bound.value.world_rules.length >= 3,
  "optional weapon records displaced the minimum formal world-rule contract",
);
for (const requiredRule of [
  "異能武裝靈魂內收納、召喚與維持準則",
  "能力體系",
  "高科技靈力醫療、治療型武裝與生命復歸",
]) {
  assert(realisticPhase58Bound.value.world_rules.some(
    (record) => record.name === requiredRule,
  ));
}
assert(realisticPhase58Bound.value.timeline_and_events.some(
  (record) => record.entity_id.endsWith("#timeline"),
));
assert.equal(
  Object.hasOwn(
    realisticPhase58Bound.value.current_status[0].structured_status,
    "last_confirmed_evidence",
  ),
  false,
  "bounded medical status retained redundant raw evidence instead of its compact content anchor",
);

const latestContinuity = {
  loaded: true,
  report_id: "settlement_report_20260726-000000-1234abcd",
  chapter: "第二十八章",
  chapter_number: 28,
  display_heading: "第二十八章",
};

const temporal = deriveMedicalTemporalContext({
  taskPrompt: "第二十九章安排在第二十八章的五天後。",
  latestContinuity,
});
assert.equal(temporal.timeAnchorAvailable, true);
assert.equal(temporal.elapsedHours, 120);
assert.equal(temporal.elapsedHoursLowerBound, true);
assert.equal(temporal.latestContinuityChapterNumber, 28);
assert.equal(temporal.asOfChapter, "第二十九章");

const snapshot = await buildMedicalContinuitySnapshot({
  activeEngineText: "",
  temporalContext: temporal,
});
const byCharacter = Object.fromEntries(
  snapshot.character_statuses.map((status) => [status.character, status]),
);

for (const character of ["貓狼", "雪弟"]) {
  assert.equal(
    byCharacter[character].current_physical_status,
    "recovered_stable",
    `${character} was not recomputed as recovered after the explicit five-day jump`,
  );
  assert.equal(byCharacter[character].daily_activity_clearance, "cleared");
  assert.equal(byCharacter[character].active_restrictions.length, 0);
  assert.equal(byCharacter[character].competition_clearance, "not_recorded");
  assert.equal(
    byCharacter[character].temporal_resolution.evaluated_at_story_time,
    "120h_after_latest_settled_continuity",
  );
}
assert.equal(
  byCharacter.貓狼.resolved_recovery_class,
  "sutured_laceration",
  "compound expected recovery window did not choose the conservative configured class",
);
assert.equal(
  byCharacter.雪弟.resolved_recovery_class,
  "moderate_muscle_tear",
);

const noAnchor = deriveMedicalTemporalContext({
  taskPrompt: "正式續寫下一章。",
  latestContinuity,
});
const noAnchorSnapshot = await buildMedicalContinuitySnapshot({
  activeEngineText: "",
  temporalContext: noAnchor,
});
const noAnchorByCharacter = Object.fromEntries(
  noAnchorSnapshot.character_statuses.map((status) => [status.character, status]),
);
assert.equal(
  noAnchorByCharacter.貓狼.current_physical_status,
  "treated_recovery_status_not_recorded",
  "missing time anchor guessed a resolved or active state",
);
assert.equal(noAnchorByCharacter.貓狼.daily_activity_clearance, "unknown");
assert.equal(
  noAnchorByCharacter.九逃.current_physical_status,
  "recovered_stable",
  "a missing new time anchor rolled back an already resolved status",
);

const { config } = await loadMedicalContinuityConfig();
const policy = config.recovery_policy;
const ordinary = {
  injury_history: [{ event_id: "fixture", injury_class: "sutured_laceration" }],
  injury_class: "ordinary_treated_laceration_history",
  expected_recovery_window: "sutured_laceration",
  treatment_completed: true,
  current_physical_status: "treated_recovering",
  active_restrictions: [{
    restriction_id: "fixture-short-term",
    scope: "不得跑動",
    status: "active",
    expiry_kind: "short_term",
  }],
  daily_activity_clearance: "unknown",
  competition_clearance: "not_recorded",
};
const activeOverlay = resolveInjuryStatus(ordinary, {
  timeAnchorAvailable: true,
  elapsedHours: 999,
  continuityOverlay: {
    explicitly_active: true,
    current_physical_status: "treated_recovering",
    active_restrictions: ["正式新證據仍要求固定"],
  },
}, policy);
assert.equal(activeOverlay.exception_reason, "active_continuity_overlay");
assert(activeOverlay.active_restrictions.length >= 1);

const special = resolveInjuryStatus({
  ...ordinary,
  injury_class: "source_damage",
  expected_recovery_window: "not_applicable",
}, {
  timeAnchorAvailable: true,
  elapsedHours: 9999,
}, policy);
assert.notEqual(special.current_physical_status, "recovered_stable");
assert.equal(special.active_restrictions.length, 1);

await mkdir(projectPaths.entityRegistry, { recursive: true });
const registryRoot = await mkdtemp(path.join(
  projectPaths.entityRegistry,
  ".phase61a-temporal-medical-",
));
try {
  const emptyRegistry = {
    provenance: { active_engine_hash: null },
    characters: [],
    abilities: [],
    weapons: [],
    timeline_events: [],
    world_rules: [],
    organizations: [],
    locations: [],
    chapter_events: [],
    relationships: [],
    status_effects: [],
  };
  await Promise.all([
    writeFile(
      path.join(registryRoot, "entity_registry.json"),
      JSON.stringify(emptyRegistry),
      "utf8",
    ),
    writeFile(path.join(registryRoot, "entity_registry.index.json"), "{}", "utf8"),
    writeFile(path.join(registryRoot, "entity_registry_build_report.json"), "{}", "utf8"),
    writeFile(path.join(registryRoot, "conflict_report.json"), "{}", "utf8"),
    writeFile(path.join(registryRoot, "provenance.json"), "{}", "utf8"),
  ]);

  const formal = await buildFormalRelevantCanon({
    taskPrompt: "第二十九章安排在第二十八章的五天後。",
    latestContinuity: {
      ...latestContinuity,
      summary_text: [
        "# 第二十八章結算",
        "",
        "## 已發生",
        "- 貓狼左腳踝割傷、右腕與左臂有勒傷，已接受治療。",
        "- 雪弟大腿撕裂傷與肩部挫傷已接受治療。",
        "",
        "## 角色狀態",
        "- 貓狼與雪弟完成當日醫療處置。",
      ].join("\n"),
      settlement_report_hash: "fixture-settlement-hash",
    },
    plannedEntityManifest: {
      characters: ["貓狼", "雪弟"],
    },
    activeEngineContent: "# fixture active engine\n",
  }, {
    entityRegistryOptions: { registryRoot },
  });
  const formalStatuses = formal.relevant_canon.current_status.filter((record) => (
    record.structured_status?.state_model_version === "medical-continuity-v1"
  ));
  assert.deepEqual(
    formalStatuses.map((record) => record.name).sort(),
    ["貓狼", "雪弟"].sort(),
    "formal relevant Canon did not hydrate planned characters' temporal medical states",
  );
  assert(formalStatuses.every((record) => (
    record.structured_status.current_physical_status === "recovered_stable"
    && record.structured_status.daily_activity_clearance === "cleared"
    && record.structured_status.competition_clearance === "not_recorded"
  )));
  assert(formal.relevant_canon.continuity_facts.some((record) => (
    record.temporal_classification === "historical_injury_event"
    && /不得當作目前仍受傷/u.test(record.content)
  )));
  assert.equal(
    formal.relevant_canon.medical_temporal_resolution
      .recomputed_for_story_time,
    true,
  );

  const jiutaoFormal = await buildFormalRelevantCanon({
    taskPrompt: "九逃目前傷勢與異能武裝使用限制。",
    plannedEntityManifest: {
      characters: ["九逃"],
    },
    activeEngineContent: "# fixture active engine\n",
  }, {
    entityRegistryOptions: { registryRoot },
  });
  const jiutaoMedicalRecord = jiutaoFormal.relevant_canon.current_status.find(
    (record) => record.name === "九逃"
      && record.source?.kind === "derived_temporal_medical_status",
  );
  assert(jiutaoMedicalRecord, "九逃動態醫療狀態未進入 relevant Canon");
  assert.match(
    jiutaoMedicalRecord.content,
    /九逃[^]*左前臂裂傷、左肩外側切創/u,
    "歷史傷勢證據在壓縮狀態中遺失",
  );
  assert.match(
    jiutaoMedicalRecord.content,
    /僅供追溯，不代表目前仍有限制/u,
    "歷史傷勢證據沒有與目前有效限制分離",
  );
} finally {
  await rm(registryRoot, { recursive: true, force: true });
}

const historicalClassification = classifyContinuityMedicalFact(
  "貓狼左腳踝割傷、右腕與左臂有勒傷，已接受治療。",
  [byCharacter.貓狼],
);
assert.equal(
  historicalClassification.temporal_classification,
  "historical_injury_event",
);
assert.match(
  historicalClassification.content,
  /不得當作目前仍受傷或日常活動受限/u,
);

const ambiguousClassification = classifyContinuityMedicalFact(
  "貓狼左腳踝割傷、右腕與左臂有勒傷，已接受治療。",
  [noAnchorByCharacter.貓狼],
);
assert.equal(
  ambiguousClassification.temporal_classification,
  "medical_state_ambiguous",
);
assert.match(ambiguousClassification.content, /不得補寫/u);

function medicalRecord(status) {
  return {
    entity_id: status.status_id,
    name: status.character,
    structured_status: {
      ...status,
      state_model_version: "medical-continuity-v1",
    },
  };
}

const staleDraftReview = buildPostDraftNeuralCritique({
  taskPrompt: "續寫第二十九章。",
  capabilityInput: {
    draft_text: "貓狼的右手腕仍貼著固定膜，醫生交代她不能追車。",
    relevant_canon: {
      current_status: [medicalRecord(byCharacter.貓狼)],
    },
  },
});
assert(staleDraftReview.findings.some((finding) => (
  finding.issue_type === "stale_medical_state_conflict"
  && finding.character === "貓狼"
  && finding.must_fix === true
)));

const clearanceDraftReview = buildPostDraftNeuralCritique({
  taskPrompt: "續寫第二十九章。",
  capabilityInput: {
    draft_text: "貓狼因為競技許可尚未下來，所以不能跑去追車。",
    relevant_canon: {
      current_status: [medicalRecord(byCharacter.貓狼)],
    },
  },
});
assert(clearanceDraftReview.findings.some((finding) => (
  finding.issue_type === "medical_clearance_axis_conflation"
  && finding.must_fix === true
)));

const ambiguousDraftReview = buildPostDraftNeuralCritique({
  taskPrompt: "續寫目前時間點。",
  capabilityInput: {
    draft_text: "貓狼的傷已經完全好了。",
    relevant_canon: {
      current_status: [medicalRecord(noAnchorByCharacter.貓狼)],
    },
  },
});
assert(ambiguousDraftReview.findings.some((finding) => (
  finding.issue_type === "unsupported_medical_state_assertion"
  && finding.must_fix === true
)));

console.log(JSON.stringify({
  temporal_context: temporal,
  recovered_characters: [
    byCharacter.貓狼.character,
    byCharacter.雪弟.character,
  ],
  stale_state_findings: staleDraftReview.findings.length,
  clearance_findings: clearanceDraftReview.findings.length,
  ambiguous_findings: ambiguousDraftReview.findings.length,
}, null, 2));
console.log("Phase61A temporal medical current-state guard test passed.");

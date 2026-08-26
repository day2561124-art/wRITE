import { createHash } from "node:crypto";
import {
  getStructuredEntityRegistry,
} from "./structured-canon-entity-registry-service.mjs";
import {
  buildMedicalContinuitySnapshot,
  deriveMedicalTemporalContext,
} from "./medical-continuity-service.mjs";

const categoryBuckets = Object.freeze({
  character: "characters",
  ability: "abilities",
  weapon: "weapons",
  organization: "organizations",
  location: "locations",
  timeline_event: "timeline_events",
  world_rule: "world_rules",
  chapter_event: "chapter_events",
  status_effect: "status_effects",
});

const relevantCanonCollections = Object.freeze([
  "characters",
  "current_status",
  "abilities_and_weapons",
  "organizations_and_locations",
  "world_rules",
  "timeline_and_events",
  "continuity_facts",
]);

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function serialized(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))];
}

function includesMention(source, value) {
  const text = String(source ?? "");
  const target = String(value ?? "").trim();
  return Boolean(target && text.includes(target));
}

function registryEntities(registry, category) {
  return registry?.[categoryBuckets[category]] ?? [];
}


function plannedCharacterNames(plannedEntityManifest = {}) {
  const values = Array.isArray(plannedEntityManifest?.characters)
    ? plannedEntityManifest.characters
    : [];
  return uniqueStrings(values.map((item) => (
    typeof item === "string"
      ? item
      : item?.name
        ?? item?.canonical_name
        ?? item?.title
        ?? ""
  )));
}

function exactCharacterNames(source, registry, generationContext, retrievalContext) {
  const explicit = [
    ...(Array.isArray(generationContext?.focus_characters)
      ? generationContext.focus_characters
      : []),
    ...(Array.isArray(retrievalContext?.focus_characters)
      ? retrievalContext.focus_characters
      : []),
  ];
  const matches = [];
  for (const record of registryEntities(registry, "character")) {
    const canonical = String(record.canonical_name ?? "").trim();
    if (!canonical || [...canonical].length > 24) continue;
    const aliases = Array.isArray(record.aliases)
      ? record.aliases.map((alias) => String(alias ?? "").trim()).filter(Boolean)
      : [];
    const explicitMatch = explicit.includes(canonical)
      || aliases.some((alias) => explicit.includes(alias));
    const mentionPositions = [canonical, ...aliases]
      .map((value) => source.indexOf(value))
      .filter((index) => index >= 0);
    if (!explicitMatch && mentionPositions.length === 0) continue;
    matches.push({
      canonical,
      canonical_length: [...canonical].length,
      mention_rank: mentionPositions.length
        ? Math.min(...mentionPositions)
        : source.length + 1,
    });
  }
  matches.sort((left, right) => (
    left.mention_rank - right.mention_rank
    || right.canonical_length - left.canonical_length
    || left.canonical.localeCompare(right.canonical, "zh-Hant")
  ));
  return uniqueStrings([
    ...explicit,
    ...matches.map((item) => item.canonical),
  ]);
}

export function buildFormalRetrievalPlan({
  taskPrompt = "",
  generationContext = {},
  retrievalContext = {},
  latestContinuity = {},
  plannedEntityManifest = {},
  registry = {},
} = {}) {
  const source = [
    taskPrompt,
    serialized(generationContext),
    serialized(retrievalContext),
  ].join("\n");
  const characters = uniqueStrings([
    ...plannedCharacterNames(plannedEntityManifest),
    ...exactCharacterNames(
      source,
      registry,
      generationContext,
      retrievalContext,
    ),
  ]);
  const statusEffects = [];
  for (const character of characters) {
    const escapedCharacter = character.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    if (
      includesMention(source, `${character}目前傷勢`)
      || new RegExp(
        `${escapedCharacter}[^、，。；;\\n]{0,12}(?:傷勢|受傷|裂傷|切創|負荷|治療|醫療|後座)`,
        "u",
      ).test(source)
    ) {
      statusEffects.push(`${character}目前傷勢`);
    }
    if (
      includesMention(source, `${character}尚未解決`)
      || new RegExp(
        `${escapedCharacter}[^、，。；;\\n]{0,16}(?:殘留狀態|殘痕|未分類|尚未解決|未解決)`,
        "u",
      ).test(source)
    ) {
      statusEffects.push(`${character}尚未解決的殘留狀態`);
    }
  }
  const hasWeaponSystemRequest =
    /(?:異能武裝|武裝召喚|武裝維持|本體顯現|投影顯現|能力使用限制)/u.test(source);
  const hasMedicalRequest =
    /(?:傷勢|受傷|裂傷|切創|負荷|治療|醫療|後座)/u.test(source);
  const worldRules = [];
  if (hasWeaponSystemRequest) {
    worldRules.push(
      "異能武裝召喚與維持準則",
      "能力體系",
    );
  }
  if (hasMedicalRequest) worldRules.push("高科技靈力醫療與治療限制");
  if (/(?:本體顯現|投影顯現)/u.test(source)) {
    worldRules.push("投影顯現與本體顯現裁定");
  }
  return {
    characters,
    abilities: hasWeaponSystemRequest ? [...characters] : [],
    weapons: hasWeaponSystemRequest ? [...characters] : [],
    status_effects: uniqueStrings(statusEffects),
    world_rules: uniqueStrings(worldRules),
    timeline_events: latestContinuity?.loaded === true
      ? [latestContinuity.report_id]
      : [],
    chapter_events: latestContinuity?.loaded === true
      ? [latestContinuity.display_heading ?? latestContinuity.chapter]
      : [],
    organizations: [],
    locations: [],
    match_policy: {
      exact_name_before_alias: true,
      alias_before_fuzzy: true,
      category_scoped: true,
      ambiguity_requires_same_category_equal_rank: true,
      preserve_ambiguous_candidates: true,
    },
  };
}

function splitMarkdownSections(markdown) {
  const sections = {};
  let current = "preamble";
  for (const line of String(markdown ?? "").split(/\r?\n/u)) {
    const heading = /^##\s+(.+?)\s*$/u.exec(line);
    if (heading) {
      current = heading[1].trim();
      sections[current] = [];
      continue;
    }
    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }
  return Object.fromEntries(
    Object.entries(sections).map(([heading, lines]) => [
      heading,
      lines.join("\n").trim(),
    ]),
  );
}

function bulletLines(value) {
  return String(value ?? "")
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*-\s*/u, "").trim())
    .filter(Boolean);
}

export function splitLatestContinuityForFormalContext(latestContinuity = {}) {
  if (latestContinuity.loaded !== true) {
    return {
      continuity_facts: [],
      unresolved_state: [],
      transition_suggestion: [],
      transition_suggestion_included: false,
    };
  }
  const sections = splitMarkdownSections(latestContinuity.summary_text);
  return {
    continuity_facts: uniqueStrings([
      ...bulletLines(sections["已發生"]),
      ...bulletLines(sections["角色狀態"]),
      ...bulletLines(sections["關係變化"]),
    ]),
    unresolved_state: uniqueStrings(
      bulletLines(
        sections["待承接／未收事項"]
        ?? sections["待承接/未收事項"]
        ?? sections["未解決事項"],
      ),
    ),
    transition_suggestion: uniqueStrings(
      bulletLines(
        sections["下一章銜接判斷"]
        ?? sections["轉場建議"],
      ),
    ),
    transition_suggestion_included: false,
  };
}

function normalizeEvidence(value) {
  return String(value ?? "")
    .replace(/\r\n?/gu, "\n")
    .trim();
}

function currentEngineContains(activeEngineContent, excerpt) {
  const target = normalizeEvidence(excerpt);
  return Boolean(target && normalizeEvidence(activeEngineContent).includes(target));
}

function currentSectionExcerpt(activeEngineContent, sourceSection, maxChars = 1_800) {
  const expected = String(sourceSection ?? "").trim();
  if (!expected) return "";
  const lines = String(activeEngineContent ?? "").split(/\r?\n/u);
  const start = lines.findIndex((line) => {
    const heading = /^#{1,6}\s+(.+?)\s*$/u.exec(line);
    return heading?.[1]?.trim() === expected;
  });
  if (start < 0) return "";
  const retained = [];
  let chars = 0;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s+/u.test(lines[index])) break;
    const line = lines[index].trimEnd();
    const added = line.length + (retained.length ? 1 : 0);
    if (chars + added > maxChars) break;
    retained.push(line);
    chars += added;
  }
  return retained.join("\n").trim();
}

function entityRecord({
  entity,
  category,
  activeEngineContent,
  currentActiveEngineHash,
  registryActiveEngineHash,
  activeEnginePath,
  registryStale,
}) {
  const exactExcerptCurrent = currentEngineContains(
    activeEngineContent,
    entity.source_excerpt,
  );
  const boundedCurrentSection = exactExcerptCurrent
    ? ""
    : currentSectionExcerpt(
      activeEngineContent,
      entity.source_section,
    );
  const corroborated = exactExcerptCurrent || Boolean(boundedCurrentSection);
  if (registryStale && !corroborated) return null;
  const factualContent = normalizeEvidence(
    entity.state_model_version
      ? entity.description
      : exactExcerptCurrent
        ? entity.source_excerpt
        : boundedCurrentSection || entity.source_excerpt,
  );
  if (!factualContent) return null;
  const record = {
    entity_id: entity.entity_id,
    category,
    name: entity.canonical_name,
    content: factualContent,
    source: {
      kind: entity.state_model_version
        ? "active_engine_derived_medical_status"
        : "active_engine_bounded_retrieval",
      path: activeEnginePath,
      section: entity.source_section ?? null,
      anchor: entity.source_anchor ?? null,
    },
    source_hash: currentActiveEngineHash,
    freshness: "current",
    character_count: factualContent.length,
    provenance: [
      {
        source: "structured_canon_entity_registry",
        source_hash: registryActiveEngineHash,
        freshness: registryStale ? "stale" : "current",
        corroborated_by_current_active_engine: corroborated,
        corroboration_method: exactExcerptCurrent
          ? "exact_excerpt"
          : boundedCurrentSection
            ? "matching_section"
            : null,
      },
    ],
  };
  if (entity.state_model_version) {
    record.structured_status = Object.fromEntries([
      "state_model_version",
      "status_id",
      "injury_history",
      "current_physical_status",
      "current_spiritual_status",
      "injury_class",
      "affected_body_parts",
      "severity",
      "treatment_completed",
      "treatment_method",
      "active_restrictions",
      "follow_up_required",
      "follow_up_result",
      "daily_activity_clearance",
      "low_load_training_clearance",
      "training_clearance",
      "competition_clearance",
      "weapon_summon_clearance",
      "high_load_manifestation_clearance",
      "weapon_control_impact",
      "expected_recovery_window",
      "special_interference",
      "exception_reason",
      "status_as_of_chapter",
      "last_confirmed_evidence",
      "resolved_at",
      "resolution_basis",
      "historical_consequences",
    ].map((field) => [field, entity[field]]));
    record.provenance.push({
      source: entity.normalization_provenance?.config_path
        ?? "config/medical-continuity.json",
      source_hash: entity.normalization_provenance?.config_hash_sha256 ?? null,
      freshness: "current",
      authority: "derived_medical_continuity_normalization",
      direct_canon_write_allowed: false,
    });
  }
  return record;
}


const structuredMedicalFields = Object.freeze([
  "state_model_version",
  "status_id",
  "current_physical_status",
  "current_spiritual_status",
  "active_restrictions",
  "daily_activity_clearance",
  "low_load_training_clearance",
  "training_clearance",
  "competition_clearance",
  "weapon_summon_clearance",
  "high_load_manifestation_clearance",
  "exception_reason",
  "status_as_of_chapter",
  "last_confirmed_evidence",
  "resolved_at",
  "resolution_basis",
  "resolved_recovery_class",
  "evaluated_at_story_time",
  "temporal_resolution",
]);

function compactMedicalStatusSummary(status = {}) {
  const restrictions = Array.isArray(status.active_restrictions)
    && status.active_restrictions.length
    ? status.active_restrictions.map((item) => (
      typeof item === "string" ? item : item?.scope
    )).filter(Boolean).join("；")
    : "無目前有效限制";
  const historicalEvents = Array.isArray(status.injury_history)
    ? status.injury_history
    : [];
  const history = historicalEvents.map((item) => {
    const bodyParts = Array.isArray(item?.affected_body_parts)
      ? item.affected_body_parts.join("、")
      : "";
    const pastRestrictions = Array.isArray(item?.historical_restrictions)
      ? item.historical_restrictions.join("、")
      : "";
    return [
      item?.chapter,
      item?.injury_class,
      bodyParts,
      pastRestrictions ? `過去限制（已失效）：${pastRestrictions}` : "",
    ].filter(Boolean).join("｜");
  });
  const evidenceAnchors = [...new Set(
    (Array.isArray(status.last_confirmed_evidence)
      ? status.last_confirmed_evidence
      : [])
      .map((item) => String(item?.match ?? "").trim())
      .filter(Boolean),
  )].slice(0, 4);
  return [
    `角色：${status.character}`,
    `當前肉體狀態：${status.current_physical_status}`,
    `當前靈力狀態：${status.current_spiritual_status}`,
    `目前有效限制：${restrictions}`,
    `日常活動許可：${status.daily_activity_clearance}`,
    `訓練許可：${status.training_clearance}`,
    `競技許可：${status.competition_clearance}`,
    `武裝召喚許可：${status.weapon_summon_clearance}`,
    `高負荷顯現許可：${status.high_load_manifestation_clearance}`,
    `評估時間：${status.evaluated_at_story_time
      ?? status.temporal_resolution?.evaluated_at_story_time
      ?? "not_recorded"}`,
    `歷史傷勢：${history.length ? history.join("；") : "無"}`,
    `歷史證據錨點（僅供追溯，不代表目前仍有限制）：${
      evidenceAnchors.length ? evidenceAnchors.join("；") : "無"
    }`,
  ].join("\n");
}

function dynamicMedicalStatusRecord(
  status,
  activeEnginePath,
  activeEngineHash,
  medicalSnapshot,
) {
  const content = compactMedicalStatusSummary(status);
  return {
    entity_id: status.status_id,
    category: "status_effect",
    name: status.character,
    content,
    source: {
      kind: "derived_temporal_medical_status",
      path: medicalSnapshot.provenance.config_path,
      section: "medical_continuity_current_state",
      anchor: status.status_id,
    },
    source_hash: medicalSnapshot.provenance.config_hash_sha256,
    freshness: "current",
    character_count: content.length,
    structured_status: {
      ...Object.fromEntries(
        structuredMedicalFields.map((field) => [field, status[field]]),
      ),
      injury_history_count: Array.isArray(status.injury_history)
        ? status.injury_history.length
        : 0,
      injury_history_retained_in_snapshot: true,
      active_restrictions_current_only: true,
      clearance_independent: true,
    },
    provenance: [
      {
        source: medicalSnapshot.provenance.config_path,
        source_hash: medicalSnapshot.provenance.config_hash_sha256,
        freshness: "current",
        authority: "derived_temporal_medical_status",
        direct_canon_write_allowed: false,
      },
      {
        source: activeEnginePath,
        source_hash: activeEngineHash,
        freshness: "current",
        authority: "active_hard_canon_evidence",
        full_text_included: false,
      },
    ],
  };
}

function medicalDisposition(status = {}) {
  const restrictions = Array.isArray(status.active_restrictions)
    ? status.active_restrictions
    : [];
  if (restrictions.length > 0) return "active";
  if (
    status.daily_activity_clearance === "cleared"
    && /(?:recovered|no_active|stable_without_active|normal_on_latest_exam)/u.test(
      String(status.current_physical_status ?? ""),
    )
  ) {
    return "resolved";
  }
  return "ambiguous";
}

const medicalFactPattern =
  /(?:傷勢|受傷|裂傷|切創|挫傷|扭傷|撕裂|骨折|包紮|繃帶|固定膜|醫囑|治療|復原|康復|痊癒|輪椅|拐杖|不能出力|不得訓練)/u;

export function classifyContinuityMedicalFact(
  content,
  medicalStatuses = [],
) {
  const source = String(content ?? "").trim();
  if (!source || !medicalFactPattern.test(source)) {
    return {
      content: source,
      temporal_classification: "not_medical",
      character: null,
      status_id: null,
    };
  }
  const status = medicalStatuses.find((item) => (
    source.includes(item.character)
  ));
  if (!status) {
    return {
      content: source,
      temporal_classification: "medical_without_resolved_character",
      character: null,
      status_id: null,
    };
  }
  const disposition = medicalDisposition(status);
  if (disposition === "resolved") {
    return {
      content:
        `歷史傷勢事件（不得當作目前仍受傷或日常活動受限）：${source}`,
      temporal_classification: "historical_injury_event",
      character: status.character,
      status_id: status.status_id,
    };
  }
  if (disposition === "ambiguous") {
    return {
      content:
        `恢復狀態未有足夠時間錨點（不得補寫成仍受傷或已完全痊癒）：${source}`,
      temporal_classification: "medical_state_ambiguous",
      character: status.character,
      status_id: status.status_id,
    };
  }
  return {
    content: source,
    temporal_classification: "current_medical_state",
    character: status.character,
    status_id: status.status_id,
  };
}

function exactEntity(records, name) {
  return records.find((entity) => entity.canonical_name === name)
    ?? records.find((entity) => (
      Array.isArray(entity.aliases)
      && entity.aliases.includes(name)
    ))
    ?? null;
}

function statusScore(entity, character, query) {
  if (
    entity.state_model_version
    && !entity.related_characters?.includes(character)
  ) {
    return -1;
  }
  const text = [
    entity.canonical_name,
    entity.source_section,
    entity.source_excerpt,
  ].join("\n");
  if (!text.includes(character)) return -1;
  let score = 0;
  if (entity.state_model_version === "medical-continuity-v1") score += 500;
  if (entity.resolved === false) score += 80;
  if (/現行已成立狀態|目前|當前/u.test(text)) score += 80;
  if (/傷勢|受傷|裂傷|切創|醫療|清創|縫合/u.test(query)) {
    if (!/裂傷|切創|清創|縫合|傷勢|醫療/u.test(text)) return -1;
    score += 100;
  }
  if (/殘留|殘痕|未分類|尚未解決/u.test(query)) {
    if (!/殘留|殘痕|未分類|尚未解決/u.test(text)) return -1;
    score += 120;
  }
  if (entity.resolved === true) score -= 160;
  if (/全章正式進度索引/u.test(entity.source_section ?? "")) score -= 20;
  return score;
}

function ruleMatchesPlan(entity, ruleQueries) {
  const title = String(entity.canonical_name ?? "");
  return ruleQueries.some((query) => {
    if (query === "異能武裝召喚與維持準則") {
      return /異能武裝靈魂內收納|召喚與維持準則/u.test(title);
    }
    if (query === "能力體系") return /能力體系/u.test(title);
    if (query === "高科技靈力醫療與治療限制") {
      return /高科技靈力醫療|治療型武裝與生命復歸/u.test(title);
    }
    if (query === "投影顯現與本體顯現裁定") {
      return /投影顯現.*本體顯現|本體顯現.*投影顯現/u.test(title);
    }
    return title.includes(query);
  });
}

function relatedAbilityOrWeapon(entity, characters) {
  const text = [
    entity.canonical_name,
    entity.source_excerpt,
    ...(entity.related_characters ?? []),
  ].join("\n");
  return characters.some((character) => text.includes(character));
}

function deduplicateRecords(records) {
  const output = [];
  const seenContent = new Set();
  const seenIds = new Set();
  for (const record of records.filter(Boolean)) {
    const contentHash = sha256(normalizeEvidence(record.content));
    if (seenIds.has(record.entity_id) || seenContent.has(contentHash)) continue;
    seenIds.add(record.entity_id);
    seenContent.add(contentHash);
    output.push(record);
  }
  return output;
}

function relevantContinuityRecords(
  latestContinuity,
  split,
  plan,
  medicalStatuses = [],
) {
  if (latestContinuity.loaded !== true) return [];
  const names = plan.characters;
  const relevant = uniqueStrings([
    ...split.continuity_facts,
    ...split.unresolved_state,
  ]).filter((fact) => (
    names.some((name) => fact.includes(name))
    || (
      plan.status_effects.some((query) => /(?:殘留|殘痕|未分類)/u.test(query))
      && /追加比對/u.test(fact)
    )
  ));
  return relevant.map((originalContent, index) => {
    const classified = classifyContinuityMedicalFact(
      originalContent,
      medicalStatuses,
    );
    const unresolved = split.unresolved_state.includes(originalContent);
    return {
      entity_id: `${latestContinuity.report_id}#continuity-${index + 1}`,
      category: unresolved
        ? "unresolved_state"
        : "continuity_fact",
      name: latestContinuity.display_heading
        ?? latestContinuity.chapter
        ?? latestContinuity.report_id,
      content: classified.content,
      original_content: originalContent,
      temporal_classification: classified.temporal_classification,
      medical_character: classified.character,
      medical_status_id: classified.status_id,
      source: {
        kind: "latest_settled_continuity_overlay",
        path: latestContinuity.content_path ?? null,
        section: unresolved
          ? "待承接／未收事項"
          : "已發生／角色狀態",
        anchor: latestContinuity.report_id,
      },
      source_hash: latestContinuity.settlement_report_hash ?? null,
      freshness: "current",
      character_count: classified.content.length,
      provenance: [{
        source: latestContinuity.report_id,
        source_hash: latestContinuity.settlement_report_hash ?? null,
        freshness: "current",
        authority: "latest_settled_continuity_overlay",
      }],
    };
  });
}

export function countRelevantCanonActiveEngineChars(relevantCanon = {}) {
  const seen = new Set();
  let total = 0;
  for (const collection of relevantCanonCollections) {
    for (const record of relevantCanon[collection] ?? []) {
      if (record?.source?.kind !== "active_engine_bounded_retrieval") continue;
      const content = normalizeEvidence(record.content);
      const key = sha256(content);
      if (!content || seen.has(key)) continue;
      seen.add(key);
      total += content.length;
    }
  }
  return total;
}

export async function buildFormalRelevantCanon({
  taskPrompt = "",
  generationContext = {},
  retrievalContext = {},
  latestContinuity = {},
  plannedEntityManifest = {},
  activeEngineContent = "",
  activeEnginePath = "data/canon_db/active_engine.md",
  activeEngineHash = null,
} = {}, options = {}) {
  const { registry, provenance } = await getStructuredEntityRegistry(
    options.entityRegistryOptions ?? {},
  );
  const currentActiveEngineHash =
    activeEngineHash ?? sha256(activeEngineContent);
  const registryActiveEngineHash =
    registry?.provenance?.active_engine_hash
    ?? provenance?.active_engine_hash
    ?? null;
  const registryStale = Boolean(
    registryActiveEngineHash
    && currentActiveEngineHash
    && registryActiveEngineHash !== currentActiveEngineHash,
  );
  const retrievalPlan = buildFormalRetrievalPlan({
    taskPrompt,
    generationContext,
    retrievalContext,
    latestContinuity,
    plannedEntityManifest,
    registry,
  });
  const continuity = splitLatestContinuityForFormalContext(
    latestContinuity,
  );
  const medicalTemporalContext = deriveMedicalTemporalContext({
    taskPrompt,
    generationContext,
    retrievalContext,
    latestContinuity,
  });
  const medicalSnapshot = await buildMedicalContinuitySnapshot({
    ...(options.medicalContinuityOptions ?? {}),
    activeEngineText: activeEngineContent,
    activeEnginePath,
    temporalContext: medicalTemporalContext,
  });
  const relevantMedicalStatuses = medicalSnapshot.character_statuses.filter(
    (status) => retrievalPlan.characters.includes(status.character),
  );
  const medicalStatusRecords = relevantMedicalStatuses.map((status) => (
    dynamicMedicalStatusRecord(
      status,
      activeEnginePath,
      currentActiveEngineHash,
      medicalSnapshot,
    )
  ));
  const recordOptions = {
    currentActiveEngineHash,
    registryActiveEngineHash,
    activeEnginePath,
    registryStale,
  };
  const characters = retrievalPlan.characters
    .map((name) => exactEntity(registryEntities(registry, "character"), name))
    .filter(Boolean)
    .map((entity) => entityRecord({
      entity,
      category: "character",
      activeEngineContent,
      ...recordOptions,
    }));
  const statusRecords = [];
  for (const query of retrievalPlan.status_effects) {
    const character = retrievalPlan.characters.find((name) => query.includes(name));
    if (!character) continue;
    const ranked = registryEntities(registry, "status_effect")
      .map((entity) => ({ entity, score: statusScore(entity, character, query) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => (
        right.score - left.score
        || String(left.entity.entity_id).localeCompare(String(right.entity.entity_id))
      ));
    if (
      ranked[0]
      && ranked[0].entity.state_model_version !== "medical-continuity-v1"
    ) {
      statusRecords.push(entityRecord({
        entity: ranked[0].entity,
        category: "status_effect",
        activeEngineContent,
        ...recordOptions,
      }));
    }
  }
  const abilityAndWeaponRecords = [];
  for (const category of ["weapon", "ability"]) {
    for (const character of retrievalPlan.characters) {
      const matches = registryEntities(registry, category)
        .filter((entity) => relatedAbilityOrWeapon(entity, [character]))
        .sort((left, right) => (
          String(left.entity_id).localeCompare(String(right.entity_id))
        ));
      if (matches[0]) {
        abilityAndWeaponRecords.push(entityRecord({
          entity: matches[0],
          category,
          activeEngineContent,
          ...recordOptions,
        }));
      }
    }
  }
  const worldRules = registryEntities(registry, "world_rule")
    .filter((entity) => ruleMatchesPlan(entity, retrievalPlan.world_rules))
    .map((entity) => entityRecord({
      entity,
      category: "world_rule",
      activeEngineContent,
      ...recordOptions,
    }));
  const continuityRecords = relevantContinuityRecords(
    latestContinuity,
    continuity,
    retrievalPlan,
    relevantMedicalStatuses,
  );
  const timelineAndEvents = latestContinuity.loaded === true
    ? [{
      entity_id: `${latestContinuity.report_id}#timeline`,
      category: "timeline_event",
      name: latestContinuity.display_heading
        ?? latestContinuity.chapter
        ?? latestContinuity.report_id,
      content: latestContinuity.continuity_head
        ?? latestContinuity.display_heading
        ?? latestContinuity.chapter,
      source: {
        kind: "latest_settled_continuity_overlay",
        path: latestContinuity.content_path ?? null,
        section: "chapter_identity",
        anchor: latestContinuity.report_id,
      },
      source_hash: latestContinuity.settlement_report_hash ?? null,
      freshness: "current",
      character_count: String(
        latestContinuity.continuity_head
        ?? latestContinuity.display_heading
        ?? latestContinuity.chapter
        ?? "",
      ).length,
      provenance: [{
        source: latestContinuity.report_id,
        source_hash: latestContinuity.settlement_report_hash ?? null,
        freshness: "current",
        authority: "latest_settled_continuity_overlay",
      }],
    }]
    : [];
  const currentStatus = deduplicateRecords([
    ...medicalStatusRecords,
    ...statusRecords,
    ...continuityRecords.filter((record) => record.category === "unresolved_state"),
  ]);
  const relevantCanon = {
    schema_version: "phase58-formal-relevant-canon-v1",
    characters: deduplicateRecords(characters),
    current_status: currentStatus,
    abilities_and_weapons: deduplicateRecords(abilityAndWeaponRecords),
    organizations_and_locations: [],
    world_rules: deduplicateRecords(worldRules),
    timeline_and_events: timelineAndEvents,
    continuity_facts: deduplicateRecords(
      continuityRecords.filter((record) => record.category === "continuity_fact"),
    ),
    medical_temporal_resolution: {
      context: medicalTemporalContext,
      relevant_status_count: relevantMedicalStatuses.length,
      recomputed_for_story_time:
        medicalTemporalContext.timeAnchorAvailable === true,
      stale_history_not_current_restriction: true,
      clearance_axes_independent: true,
    },
    provenance: [
      {
        source: latestContinuity.report_id ?? "latest_settled_continuity",
        source_hash: latestContinuity.settlement_report_hash ?? null,
        freshness: latestContinuity.loaded === true ? "current" : "unknown",
        authority: "latest_settled_continuity_overlay",
      },
      {
        source: "structured_canon_entity_registry",
        source_hash: registryActiveEngineHash,
        freshness: registryStale ? "stale" : "current",
        hard_fact_authority: !registryStale,
        supplemental_candidates_only: registryStale,
      },
      {
        source: activeEnginePath,
        source_hash: currentActiveEngineHash,
        freshness: "current",
        authority: "active_hard_canon",
        bounded_selective_retrieval: true,
        full_text_included: false,
      },
    ],
    retrieval_diagnostics: {
      registry_stale: registryStale,
      registry_active_engine_hash: registryActiveEngineHash,
      current_active_engine_hash: currentActiveEngineHash,
      stale_records_require_current_corroboration: true,
      stale_uncorroborated_records_excluded: true,
      medical_temporal_recomputation_applied:
        medicalTemporalContext.timeAnchorAvailable === true,
      medical_temporal_anchor_source:
        medicalTemporalContext.anchorSource,
      medical_history_and_current_state_separated: true,
      full_active_engine_fallback_allowed: false,
    },
  };
  relevantCanon.active_engine_retrieval_chars =
    countRelevantCanonActiveEngineChars(relevantCanon);
  return {
    retrieval_plan: retrievalPlan,
    relevant_canon: relevantCanon,
    continuity,
  };
}

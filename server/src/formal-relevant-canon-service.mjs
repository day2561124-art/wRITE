import { createHash } from "node:crypto";
import {
  getStructuredEntityRegistry,
} from "./structured-canon-entity-registry-service.mjs";

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

function exactCharacterNames(source, registry, generationContext, retrievalContext) {
  const explicit = [
    ...(Array.isArray(generationContext?.focus_characters)
      ? generationContext.focus_characters
      : []),
    ...(Array.isArray(retrievalContext?.focus_characters)
      ? retrievalContext.focus_characters
      : []),
  ];
  const names = [];
  const records = registryEntities(registry, "character")
    .filter((record) => {
      const canonical = String(record.canonical_name ?? "").trim();
      return canonical && [...canonical].length <= 24;
    })
    .sort((left, right) => (
      [...String(right.canonical_name)].length
      - [...String(left.canonical_name)].length
    ));
  for (const record of records) {
    const canonical = String(record.canonical_name ?? "").trim();
    const aliases = Array.isArray(record.aliases) ? record.aliases : [];
    if (
      explicit.includes(canonical)
      || includesMention(source, canonical)
      || aliases.some((alias) => explicit.includes(alias) || includesMention(source, alias))
    ) {
      names.push(canonical);
    }
  }
  return uniqueStrings([...explicit, ...names]);
}

export function buildFormalRetrievalPlan({
  taskPrompt = "",
  generationContext = {},
  retrievalContext = {},
  latestContinuity = {},
  registry = {},
} = {}) {
  const source = [
    taskPrompt,
    serialized(generationContext),
    serialized(retrievalContext),
  ].join("\n");
  const characters = exactCharacterNames(
    source,
    registry,
    generationContext,
    retrievalContext,
  );
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
    exactExcerptCurrent
      ? entity.source_excerpt
      : boundedCurrentSection || entity.source_excerpt,
  );
  if (!factualContent) return null;
  return {
    entity_id: entity.entity_id,
    category,
    name: entity.canonical_name,
    content: factualContent,
    source: {
      kind: "active_engine_bounded_retrieval",
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
  const text = [
    entity.canonical_name,
    entity.source_section,
    entity.source_excerpt,
  ].join("\n");
  if (!text.includes(character)) return -1;
  let score = 0;
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

function relevantContinuityRecords(latestContinuity, split, plan) {
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
  return relevant.map((content, index) => ({
    entity_id: `${latestContinuity.report_id}#continuity-${index + 1}`,
    category: split.unresolved_state.includes(content)
      ? "unresolved_state"
      : "continuity_fact",
    name: latestContinuity.display_heading
      ?? latestContinuity.chapter
      ?? latestContinuity.report_id,
    content,
    source: {
      kind: "latest_settled_continuity_overlay",
      path: latestContinuity.content_path ?? null,
      section: split.unresolved_state.includes(content)
        ? "待承接／未收事項"
        : "已發生／角色狀態",
      anchor: latestContinuity.report_id,
    },
    source_hash: latestContinuity.settlement_report_hash ?? null,
    freshness: "current",
    character_count: content.length,
    provenance: [{
      source: latestContinuity.report_id,
      source_hash: latestContinuity.settlement_report_hash ?? null,
      freshness: "current",
      authority: "latest_settled_continuity_overlay",
    }],
  }));
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
    registry,
  });
  const continuity = splitLatestContinuityForFormalContext(
    latestContinuity,
  );
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
    if (ranked[0]) {
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

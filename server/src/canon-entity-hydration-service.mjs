import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  assertPathInside,
  projectPaths,
} from "./project-paths.mjs";
import {
  getStructuredEntityRegistry,
} from "./structured-canon-entity-registry-service.mjs";
import {
  describeSceneLocation,
} from "./canon-logic-compatibility-service.mjs";
import {
  originalCandidateStatus,
} from "./formal-writing-contracts.mjs";
import {
  parseActiveEngineCharacterRecords,
} from "./character-canon-grounding-service.mjs";
import {
  loadCharacterVoiceRegistry,
  parseAuthoritativeCoreProtagonistNames,
  resolveCharacterVoiceProfile,
} from "./character-voice-registry-service.mjs";

export const plannedEntityManifestCategories = Object.freeze([
  "characters",
  "organizations",
  "locations",
  "abilities",
  "weapons",
  "status_effects",
  "timeline_events",
  "chapter_events",
]);

export const relevantCanonEntityCollections = Object.freeze([
  "characters",
  "current_status",
  "abilities_and_weapons",
  "organizations_and_locations",
  "world_rules",
  "timeline_and_events",
  "continuity_facts",
]);

const categoryToRegistry = Object.freeze({
  characters: "characters",
  organizations: "organizations",
  locations: "locations",
  abilities: "abilities",
  weapons: "weapons",
  status_effects: "status_effects",
  timeline_events: "timeline_events",
  chapter_events: "chapter_events",
});

const categoryToEntityType = Object.freeze({
  characters: "character",
  organizations: "organization",
  locations: "location",
  abilities: "ability",
  weapons: "weapon",
  status_effects: "status_effect",
  timeline_events: "timeline_event",
  chapter_events: "chapter_event",
});

const categoryToRelevantCanon = Object.freeze({
  characters: "characters",
  organizations: "organizations_and_locations",
  locations: "organizations_and_locations",
  abilities: "abilities_and_weapons",
  weapons: "abilities_and_weapons",
  status_effects: "current_status",
  timeline_events: "timeline_and_events",
  chapter_events: "timeline_and_events",
});

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function normalizedText(value) {
  return String(value ?? "").replace(/\r\n?/gu, "\n").trim();
}

function uniqueStrings(values) {
  return [...new Set(
    values.map((value) => String(value ?? "").trim()).filter(Boolean),
  )];
}

function normalizeManifestItem(value) {
  if (typeof value === "string") {
    const name = value.trim();
    return name ? { name, canon_expected: null } : null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = String(
    value.name
      ?? value.canonical_name
      ?? value.title
      ?? value.entity_id
      ?? "",
  ).trim();
  if (!name) return null;
  return {
    name,
    ...(value.entity_id ? { entity_id: String(value.entity_id).trim() } : {}),
    ...(typeof value.canon_expected === "boolean"
      ? { canon_expected: value.canon_expected }
      : { canon_expected: null }),
    ...(value.organization
      ? { organization: String(value.organization).trim() }
      : {}),
    ...(value.access_level
      ? { access_level: String(value.access_level).trim() }
      : {}),
  };
}

export function normalizePlannedEntityManifest(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  return Object.fromEntries(plannedEntityManifestCategories.map((category) => {
    const input = Array.isArray(source[category]) ? source[category] : [];
    const seen = new Set();
    const output = [];
    for (const rawItem of input.slice(0, 40)) {
      const item = normalizeManifestItem(rawItem);
      if (!item) continue;
      const key = `${item.entity_id ?? ""}\u0000${item.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(item);
    }
    return [category, output];
  }));
}

export function flattenPlannedEntityManifest(manifest = {}) {
  return plannedEntityManifestCategories.flatMap((category) => (
    (manifest[category] ?? []).map((item) => ({
      category,
      entity_type: categoryToEntityType[category],
      requested_name: item.name,
      ...item,
    }))
  ));
}

function registryRecords(registry, category) {
  return registry?.[categoryToRegistry[category]] ?? [];
}

export function resolveRegistryEntity(records, request, category) {
  if (request.entity_id) {
    const byId = records.find((record) => record.entity_id === request.entity_id);
    if (byId) return { status: "resolved", match_type: "entity_id", entity: byId };
  }
  const exact = records.filter(
    (record) => String(record.canonical_name ?? "").trim() === request.name,
  );
  if (exact.length === 1) {
    return { status: "resolved", match_type: "exact", entity: exact[0] };
  }
  if (exact.length > 1) {
    return { status: "ambiguous", match_type: "exact", candidates: exact };
  }
  const aliases = records.filter((record) => (
    Array.isArray(record.aliases)
    && record.aliases.some((alias) => String(alias).trim() === request.name)
  ));
  if (aliases.length === 1) {
    return { status: "resolved", match_type: "alias", entity: aliases[0] };
  }
  if (aliases.length > 1) {
    return { status: "ambiguous", match_type: "alias", candidates: aliases };
  }
  return {
    status: "not_found",
    match_type: null,
    candidates: [],
    fuzzy_match_forbidden: true,
    category,
  };
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

async function currentEntityRecord({
  entity,
  entityType,
  activeEngineContent,
  activeEngineHash,
  activeEnginePath,
  registryHash,
  registryStale,
}) {
  const isFormalCanonSource = entity.source_file
    && entity.source_file !== activeEnginePath
    && entity.provenance?.formal_canon_source === true;
  if (isFormalCanonSource) {
    const sourcePath = assertPathInside(
      entity.source_file,
      projectPaths.canonSources,
      "formal Canon entity source",
    );
    const sourceContent = await readFile(sourcePath, "utf8").catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (sourceContent === null) return null;
    const sourceHash = sha256(sourceContent);
    if (
      entity.provenance?.source_hash
      && entity.provenance.source_hash !== sourceHash
    ) {
      return null;
    }
    const exactExcerpt = normalizedText(entity.source_excerpt);
    const exactCurrent = Boolean(
      exactExcerpt && normalizedText(sourceContent).includes(exactExcerpt),
    );
    const boundedSection = exactCurrent
      ? ""
      : currentSectionExcerpt(sourceContent, entity.source_section, 12_000);
    const content = exactCurrent
      ? exactExcerpt
      : normalizedText(boundedSection);
    if (!content) return null;
    return {
      entity_id: entity.entity_id,
      category: entityType,
      name: entity.canonical_name,
      content,
      content_hash: sha256(content),
      source: {
        kind: "canon_source_bounded_retrieval",
        path: entity.source_file,
        section: entity.source_section ?? null,
        anchor: entity.source_anchor ?? null,
      },
      source_hash: sourceHash,
      freshness: "current",
      character_count: content.length,
      provenance: [{
        source: "structured_canon_entity_registry",
        source_hash: registryHash,
        freshness: registryStale ? "active_engine_changed_source_current" : "current",
        formal_canon_source_hash: sourceHash,
        formal_canon_source_current: true,
        corroborated_by_current_active_engine: false,
        corroboration_method: exactCurrent
          ? "exact_formal_source_excerpt"
          : "matching_formal_source_section",
      }],
    };
  }
  const exactExcerpt = normalizedText(entity.source_excerpt);
  const exactCurrent = Boolean(
    exactExcerpt && normalizedText(activeEngineContent).includes(exactExcerpt),
  );
  const boundedSection = exactCurrent
    ? ""
    : currentSectionExcerpt(activeEngineContent, entity.source_section);
  const corroborated = exactCurrent || Boolean(boundedSection);
  if (registryStale && !corroborated) return null;
  const content = exactCurrent
    ? exactExcerpt
    : normalizedText(boundedSection || entity.source_excerpt);
  if (!content) return null;
  return {
    entity_id: entity.entity_id,
    category: entityType,
    name: entity.canonical_name,
    content,
    content_hash: sha256(content),
    source: {
      kind: "active_engine_bounded_retrieval",
      path: activeEnginePath,
      section: entity.source_section ?? null,
      anchor: entity.source_anchor ?? null,
    },
    source_hash: activeEngineHash,
    freshness: "current",
    character_count: content.length,
    provenance: [{
      source: "structured_canon_entity_registry",
      source_hash: registryHash,
      freshness: registryStale ? "stale" : "current",
      corroborated_by_current_active_engine: corroborated,
      corroboration_method: exactCurrent
        ? "exact_excerpt"
        : boundedSection
          ? "matching_section"
          : null,
    }],
  };
}

function precedingHeading(lines, lineIndex) {
  for (let index = lineIndex; index >= 0; index -= 1) {
    const heading = /^#{1,6}\s+(.+?)\s*$/u.exec(lines[index]);
    if (heading) return heading[1].trim();
  }
  return null;
}

function exactLineRecord({
  name,
  entityType,
  activeEngineContent,
  activeEngineHash,
  activeEnginePath,
}) {
  const lines = String(activeEngineContent ?? "").split(/\r?\n/u);
  const lineIndex = lines.findIndex((line) => (
    line.includes(`| ${name} |`)
    || line.includes(`|${name}|`)
  ));
  if (lineIndex < 0) return null;
  const content = lines[lineIndex].trim();
  return {
    entity_id: `${entityType.toUpperCase()}-${name}-${sha256(
      `${entityType}|${name}|${content}`,
    ).slice(0, 10).toUpperCase()}`,
    category: entityType,
    name,
    content,
    content_hash: sha256(content),
    source: {
      kind: "active_engine_bounded_retrieval",
      path: activeEnginePath,
      section: precedingHeading(lines, lineIndex),
      anchor: `L${lineIndex + 1}`,
    },
    source_hash: activeEngineHash,
    freshness: "current",
    character_count: content.length,
    provenance: [{
      source: activeEnginePath,
      source_hash: activeEngineHash,
      freshness: "current",
      match_type: "exact_table_row",
    }],
  };
}

function characterRow(entity) {
  const cells = String(entity?.source_excerpt ?? "")
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);
  if (cells.length < 4) return {};
  const role = cells[2] ?? null;
  const explicitAffiliation = cells.slice(2, 5).find((cell) => (
    /(?:學院|實習校|巡禮局|夜星家)/u.test(cell)
  )) ?? null;
  const roleAffiliation = String(role ?? "").match(
    /(?:夜星武裝學院|白樞軌道實習校|晨紋工學院|青岫生命學院|畫環映裝學院|緋棘庭園學院|璃灣藝裝學院|星蝕巡禮局)/u,
  )?.[0] ?? null;
  const affiliation = /(?:學院|實習校|巡禮局|夜星家)/u.test(
    explicitAffiliation ?? "",
  )
    ? explicitAffiliation
    : roleAffiliation;
  const weaponIndex = cells.findIndex((cell) => /《[^》]+》/u.test(cell));
  return {
    formal_name: cells[0] ?? entity.canonical_name,
    gender: cells[1] ?? null,
    grade_or_role: role,
    affiliation,
    weapon_text: weaponIndex >= 0 ? cells[weaponIndex] : null,
    ability_text: weaponIndex >= 0 ? cells[weaponIndex + 1] ?? null : null,
    current_status: weaponIndex >= 0 ? cells[weaponIndex + 2] ?? null : null,
    timeline_or_identity_constraints:
      weaponIndex >= 0 ? cells.slice(weaponIndex + 3).join("；") || null : null,
  };
}

function weaponNames(value) {
  const matches = [...String(value ?? "").matchAll(/《([^》]+)》/gu)]
    .map((match) => match[1].trim());
  return uniqueStrings(matches);
}

function relatedWeaponEntities(registry, characterName, parsed) {
  const names = uniqueStrings([
    ...weaponNames(parsed.weapon_text),
    ...(parsed.weapon_names ?? []),
  ]);
  return registryRecords(registry, "weapons").filter((entity) => (
    names.includes(entity.canonical_name)
    || String(entity.source_excerpt ?? "").includes(`| ${characterName} |`)
    || (entity.related_characters ?? []).includes(characterName)
    || (parsed.weapon_ids ?? []).includes(entity.entity_id)
  ));
}

function relatedAbilityEntities(registry, characterName, parsed) {
  return registryRecords(registry, "abilities").filter((entity) => (
    (entity.related_characters ?? []).includes(characterName)
    || (parsed.ability_ids ?? []).includes(entity.entity_id)
  ));
}

function compactResolvedEntity({
  request,
  category,
  entity,
  matchType,
  recordIds,
  parsed = {},
  linkedWeapons = [],
  linkedAbilities = [],
  characterCanon = null,
}) {
  const location = category === "locations"
    ? describeSceneLocation({
      name: entity.canonical_name,
      location_id: entity.entity_id,
      organization: request.organization,
      access_level: request.access_level,
      source: "current_canon_bounded_retrieval",
      canon_status: "canon",
    })
    : null;
  return {
    requested_name: request.name,
    category,
    entity_type: categoryToEntityType[category],
    entity_id: entity.entity_id,
    canonical_name: entity.canonical_name,
    match_type: matchType,
    formal_name: parsed.formal_name ?? entity.formal_name ?? entity.canonical_name,
    affiliation: parsed.affiliation ?? entity.affiliation ?? null,
    grade_or_role: parsed.grade_or_role ?? entity.grade_or_role ?? entity.position ?? null,
    current_status: (parsed.current_status ?? entity.current_status)
      ? [parsed.current_status ?? entity.current_status]
      : [],
    timeline_constraints: parsed.timeline_or_identity_constraints
      ? [parsed.timeline_or_identity_constraints]
      : [],
    related_abilities: uniqueStrings([
      ...(parsed.ability_text ? [parsed.ability_text] : []),
      ...linkedAbilities.map((ability) => ability.essence || ability.canonical_name),
    ]),
    related_weapons: uniqueStrings([
      ...weaponNames(parsed.weapon_text),
      ...(parsed.weapon_names ?? []),
      ...linkedWeapons.map((weapon) => weapon.canonical_name),
    ]),
    weapon_details: linkedWeapons.map((weapon) => ({
      entity_id: weapon.entity_id,
      canonical_name: weapon.canonical_name,
      formal_name: weapon.formal_name ?? `《${weapon.canonical_name}》`,
      core_ability: weapon.core_ability ?? null,
      confirmed_limits: weapon.confirmed_limits ?? [],
      forbidden_expansions: weapon.forbidden_expansions ?? [],
    })),
    ability_details: linkedAbilities.map((ability) => ({
      entity_id: ability.entity_id,
      canonical_name: ability.canonical_name,
      essence: ability.essence ?? null,
      activation_conditions: ability.activation_conditions ?? [],
      confirmed_limits: ability.confirmed_limits ?? [],
      forbidden_normalizations: ability.forbidden_normalizations ?? [],
    })),
    character_canon:
      characterCanon ?? entity.canon_character_grounding ?? null,
    relevant_canon_record_ids: uniqueStrings(recordIds),
    ...(location ? {
      location_id: location.location_id,
      organization: location.organization,
      location_type: location.location_type,
      access_level: location.access_level,
    } : {}),
  };
}

function recordKey(record) {
  return record?.entity_id
    || record?.content_hash
    || sha256(normalizedText(record?.content));
}

function deduplicateRecords(records) {
  const output = [];
  const seenIds = new Set();
  const seenContent = new Set();
  for (const record of records.filter(Boolean)) {
    const contentHash = record.content_hash
      ?? sha256(normalizedText(record.content));
    if (
      seenIds.has(recordKey(record))
      || (record.content && seenContent.has(contentHash))
    ) {
      continue;
    }
    seenIds.add(recordKey(record));
    if (record.content) seenContent.add(contentHash);
    output.push(record);
  }
  return output;
}

function deduplicateProvenance(records) {
  const output = [];
  const seen = new Set();
  for (const record of records.filter(Boolean)) {
    const key = sha256(JSON.stringify(record));
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}

function enforceActiveEngineRetrievalBudget(
  relevantCanon,
  maxChars = 12_000,
) {
  let used = 0;
  const seen = new Set();
  for (const collection of relevantCanonEntityCollections) {
    relevantCanon[collection] = (relevantCanon[collection] ?? []).filter(
      (record) => {
        if (record?.source?.kind !== "active_engine_bounded_retrieval") {
          return true;
        }
        const content = normalizedText(record.content);
        const hash = sha256(content);
        if (!content || seen.has(hash)) return false;
        if (used + content.length > maxChars) return false;
        seen.add(hash);
        used += content.length;
        return true;
      },
    );
  }
  return relevantCanon;
}

function enforceRelevantCanonBudget(relevantCanon, maxChars = 18_000) {
  const removalOrder = [
    "world_rules",
    "abilities_and_weapons",
    "continuity_facts",
    "timeline_and_events",
    "current_status",
    "organizations_and_locations",
    "characters",
  ];
  let guard = 0;
  while (
    JSON.stringify(relevantCanon, null, 2).length > maxChars
    && guard < 1_000
  ) {
    guard += 1;
    const collection = removalOrder.find(
      (key) => (relevantCanon[key] ?? []).length > 0,
    );
    if (collection) {
      relevantCanon[collection].pop();
      continue;
    }
    if ((relevantCanon.provenance ?? []).length > 1) {
      relevantCanon.provenance.pop();
      continue;
    }
    break;
  }
  return relevantCanon;
}

export function mergeRelevantCanon(base = {}, delta = {}) {
  const merged = {
    ...base,
    schema_version: "phase59-dynamic-canon-coverage-v1",
  };
  for (const collection of relevantCanonEntityCollections) {
    merged[collection] = deduplicateRecords([
      ...(delta[collection] ?? []),
      ...(base[collection] ?? []),
    ]);
  }
  merged.provenance = deduplicateProvenance([
    ...(base.provenance ?? []),
    ...(delta.provenance ?? []),
  ]);
  merged.retrieval_diagnostics = {
    ...(base.retrieval_diagnostics ?? {}),
    planned_entity_hydration_used: true,
    full_active_engine_fallback_allowed: false,
  };
  const bounded = enforceRelevantCanonBudget(
    enforceActiveEngineRetrievalBudget(merged),
  );
  bounded.active_engine_retrieval_chars =
    countHydratedActiveEngineChars(bounded);
  return bounded;
}

export function countHydratedActiveEngineChars(relevantCanon = {}) {
  const seen = new Set();
  let total = 0;
  for (const collection of relevantCanonEntityCollections) {
    for (const record of relevantCanon[collection] ?? []) {
      if (record?.source?.kind !== "active_engine_bounded_retrieval") continue;
      const content = normalizedText(record.content);
      const hash = sha256(content);
      if (!content || seen.has(hash)) continue;
      seen.add(hash);
      total += content.length;
    }
  }
  return total;
}

export async function hydratePlannedEntityManifest({
  plannedEntityManifest = {},
  relevantCanon = {},
  activeEngineContent = null,
  activeEnginePath = "data/canon_db/active_engine.md",
  activeEngineHash = null,
} = {}, options = {}) {
  const manifest = normalizePlannedEntityManifest(plannedEntityManifest);
  const requestedEntities = flattenPlannedEntityManifest(manifest);
  const currentEngine = activeEngineContent ?? await readFile(
    options.activeEnginePath ?? projectPaths.activeEngine,
    "utf8",
  );
  const currentHash = activeEngineHash ?? sha256(currentEngine);
  const activeCharacterRecords = new Map(
    parseActiveEngineCharacterRecords(currentEngine).map((record) => [
      record.canonical_name,
      record,
    ]),
  );
  const { registry, provenance } = await getStructuredEntityRegistry(
    options.entityRegistryOptions ?? {},
  );
  const voiceRegistry = await loadCharacterVoiceRegistry(options);
  const coreProtagonists = new Set(
    parseAuthoritativeCoreProtagonistNames(currentEngine),
  );
  const registryHash =
    registry?.provenance?.active_engine_hash
    ?? provenance?.active_engine_hash
    ?? null;
  const registryStale = Boolean(
    registryHash && currentHash && registryHash !== currentHash,
  );
  const delta = Object.fromEntries(
    relevantCanonEntityCollections.map((collection) => [collection, []]),
  );
  delta.provenance = [];
  const resolvedEntities = [];
  const unresolvedEntities = [];
  const originalCandidates = [];
  const characterVoiceDiagnostics = [];

  for (const request of requestedEntities) {
    const records = registryRecords(registry, request.category);
    const requestedVoiceResolution = request.category === "characters"
      ? resolveCharacterVoiceProfile(voiceRegistry.entries, request.name)
      : null;
    const registryRequest = requestedVoiceResolution?.status === "resolved"
      ? { ...request, name: requestedVoiceResolution.canonical_name }
      : request;
    const resolution = resolveRegistryEntity(
      records,
      registryRequest,
      request.category,
    );
    if (resolution.status === "ambiguous") {
      unresolvedEntities.push({
        requested_name: request.name,
        category: request.category,
        reason: "same_category_equal_rank_candidates",
        candidates: resolution.candidates.map((candidate) => ({
          entity_id: candidate.entity_id,
          canonical_name: candidate.canonical_name,
        })),
      });
      continue;
    }
    if (resolution.status === "not_found") {
      const direct = ["organizations", "locations"].includes(request.category)
        ? exactLineRecord({
          name: request.name,
          entityType: categoryToEntityType[request.category],
          activeEngineContent: currentEngine,
          activeEngineHash: currentHash,
          activeEnginePath,
        })
        : null;
      if (direct) {
        delta[categoryToRelevantCanon[request.category]].push(direct);
        resolvedEntities.push({
          requested_name: request.name,
          category: request.category,
          entity_type: categoryToEntityType[request.category],
          entity_id: direct.entity_id,
          canonical_name: direct.name,
          match_type: "current_active_engine_exact_row",
          relevant_canon_record_ids: [direct.entity_id],
        });
      } else if (
        request.canon_expected === true
        || (
          request.category === "characters"
          && coreProtagonists.has(request.name)
        )
      ) {
        if (
          request.category === "characters"
          && coreProtagonists.has(request.name)
        ) {
          characterVoiceDiagnostics.push({
            code: "CHARACTER_VOICE_HYDRATION_FAILED",
            canonical_name: request.name,
            entity_id: request.entity_id ?? null,
            failure_stage: "planned_entity_manifest_character_lookup",
            voice_registry_status: resolveCharacterVoiceProfile(
              voiceRegistry.entries,
              request.name,
            ).status,
            fallback_used: false,
          });
        }
        unresolvedEntities.push({
          requested_name: request.name,
          category: request.category,
          reason: "canon_expected_but_not_resolved",
          candidates: [],
        });
      } else {
        const declaredLocation = request.category === "locations"
          ? describeSceneLocation({
            name: request.name,
            organization: request.organization,
            access_level: request.access_level,
            source: "planned_entity_manifest",
            canon_status: "original_candidate",
          })
          : null;
        originalCandidates.push({
          name: request.name,
          category: request.category,
          ...originalCandidateStatus(),
          validation_scope: request.category === "weapons"
            || request.category === "abilities"
            ? ["general_world_rules"]
            : [
              "general_world_rules",
              "existing_canon_contact_points",
            ],
          ...(declaredLocation ? {
            location_id: declaredLocation.location_id,
            organization: declaredLocation.organization,
            location_type: declaredLocation.location_type,
            access_level: declaredLocation.access_level,
          } : {}),
        });
      }
      continue;
    }

    const entity = resolution.entity;
    const voiceResolution = request.category === "characters"
      ? resolveCharacterVoiceProfile(
        voiceRegistry.entries,
        entity.canonical_name,
      )
      : null;
    if (
      request.category === "characters"
      && coreProtagonists.has(entity.canonical_name)
      && voiceResolution?.status !== "resolved"
    ) {
      characterVoiceDiagnostics.push({
        code: "CHARACTER_VOICE_HYDRATION_FAILED",
        canonical_name: entity.canonical_name,
        entity_id: entity.entity_id ?? null,
        failure_stage: "planned_entity_manifest_voice_lookup",
        voice_registry_status: voiceResolution?.status ?? "not_found",
        fallback_used: false,
      });
      unresolvedEntities.push({
        requested_name: request.name,
        category: request.category,
        reason: "character_voice_hydration_failed",
        candidates: [{
          entity_id: entity.entity_id,
          canonical_name: entity.canonical_name,
        }],
      });
      continue;
    }
    const record = await currentEntityRecord({
      entity,
      entityType: categoryToEntityType[request.category],
      activeEngineContent: currentEngine,
      activeEngineHash: currentHash,
      activeEnginePath,
      registryHash,
      registryStale,
    });
    if (!record) {
      unresolvedEntities.push({
        requested_name: request.name,
        category: request.category,
        reason: "stale_registry_record_not_corroborated_by_current_active_engine",
        candidates: [{
          entity_id: entity.entity_id,
          canonical_name: entity.canonical_name,
          freshness: "stale",
        }],
      });
      continue;
    }
    delta[categoryToRelevantCanon[request.category]].push(record);
    const linkedRecordIds = [record.entity_id];
    let parsed = {};
    let linkedWeapons = [];
    let linkedAbilities = [];
    if (request.category === "characters") {
      parsed = entity.canon_character_grounding
        ? {
          ...entity,
          formal_name: entity.formal_name ?? entity.canonical_name,
          weapon_names: entity.weapon_names ?? [],
        }
        : characterRow(entity);
      linkedWeapons = relatedWeaponEntities(
        registry,
        entity.canonical_name,
        parsed,
      );
      for (const linkedEntity of linkedWeapons) {
        const linkedRecord = await currentEntityRecord({
          entity: linkedEntity,
          entityType: "weapon",
          activeEngineContent: currentEngine,
          activeEngineHash: currentHash,
          activeEnginePath,
          registryHash,
          registryStale,
        });
        if (linkedRecord) {
          delta.abilities_and_weapons.push(linkedRecord);
          linkedRecordIds.push(linkedRecord.entity_id);
        }
      }
      linkedAbilities = relatedAbilityEntities(
        registry,
        entity.canonical_name,
        parsed,
      );
      for (const linkedEntity of linkedAbilities) {
        const linkedRecord = await currentEntityRecord({
          entity: linkedEntity,
          entityType: "ability",
          activeEngineContent: currentEngine,
          activeEngineHash: currentHash,
          activeEnginePath,
          registryHash,
          registryStale,
        });
        if (linkedRecord) {
          delta.abilities_and_weapons.push(linkedRecord);
          linkedRecordIds.push(linkedRecord.entity_id);
        }
      }
      if (parsed.affiliation) {
        const organizationEntity = registryRecords(registry, "organizations")
          .find((candidate) => candidate.canonical_name === parsed.affiliation);
        const organizationRecord = organizationEntity
          ? await currentEntityRecord({
            entity: organizationEntity,
            entityType: "organization",
            activeEngineContent: currentEngine,
            activeEngineHash: currentHash,
            activeEnginePath,
            registryHash,
            registryStale,
          })
          : exactLineRecord({
            name: parsed.affiliation,
            entityType: "organization",
            activeEngineContent: currentEngine,
            activeEngineHash: currentHash,
            activeEnginePath,
          });
        if (organizationRecord) {
          delta.organizations_and_locations.push(organizationRecord);
          linkedRecordIds.push(organizationRecord.entity_id);
        }
      }
    }
    const compact = compactResolvedEntity({
      request,
      category: request.category,
      entity,
      matchType: resolution.match_type,
      recordIds: linkedRecordIds,
      parsed,
      linkedWeapons,
      linkedAbilities,
      characterCanon: request.category === "characters"
        ? activeCharacterRecords.get(entity.canonical_name) ?? null
        : null,
    });
    if (requestedVoiceResolution?.match_type === "registered_alias") {
      compact.match_type = "registered_alias_then_exact_canonical_name";
    }
    resolvedEntities.push({
      ...compact,
      ...(voiceResolution ? {
        character_voice_registry_status: voiceResolution.status,
        character_voice_profile: voiceResolution.status === "resolved"
          ? voiceResolution.profile
          : null,
      } : {}),
    });
  }

  for (const collection of relevantCanonEntityCollections) {
    delta[collection] = deduplicateRecords(delta[collection]);
  }
  delta.provenance = requestedEntities.length ? [{
    source: "planned_entity_manifest",
    source_hash: sha256(JSON.stringify(manifest)),
    freshness: "current_request",
    authority: "selection_by_chatgpt_owned_orchestration",
  }] : [];
  const mergedRelevantCanon = requestedEntities.length
    ? mergeRelevantCanon(relevantCanon, delta)
    : relevantCanon;
  const retainedRecordIds = new Set(
    relevantCanonEntityCollections.flatMap((collection) => (
      (mergedRelevantCanon[collection] ?? []).map((record) => record.entity_id)
    )),
  );
  const budgetExcluded = resolvedEntities.filter(
    (entry) => !retainedRecordIds.has(entry.entity_id),
  );
  if (budgetExcluded.length) {
    unresolvedEntities.push(...budgetExcluded.map((entry) => ({
      requested_name: entry.requested_name,
      category: entry.category,
      reason: "active_engine_retrieval_budget_excluded_required_record",
      candidates: [{
        entity_id: entry.entity_id,
        canonical_name: entry.canonical_name,
        freshness: "current",
      }],
    })));
    const retainedResolved = resolvedEntities.filter(
      (entry) => retainedRecordIds.has(entry.entity_id),
    );
    resolvedEntities.splice(0, resolvedEntities.length, ...retainedResolved);
  }
  const namedCanonEntities = resolvedEntities.length + unresolvedEntities.length;
  const plannedCanonCoverage = {
    named_canon_entities: namedCanonEntities,
    hydrated_entities: resolvedEntities.length,
    unresolved_entities: unresolvedEntities.length,
    coverage_complete: unresolvedEntities.length === 0,
    original_candidates: originalCandidates.length,
  };
  const hydration = {
    schema_version: "phase59-planned-entity-hydration-v1",
    requested_entities: requestedEntities,
    resolved_entities: resolvedEntities,
    unresolved_entities: unresolvedEntities,
    original_candidates: originalCandidates,
    character_voice_diagnostics: characterVoiceDiagnostics,
    character_voice_hydration_failed:
      characterVoiceDiagnostics.length > 0,
    fallback_used: false,
    canon_coverage_complete: plannedCanonCoverage.coverage_complete,
    character_count: resolvedEntities.filter(
      (entry) => entry.category === "characters",
    ).length,
    relevant_canon_record_ids: uniqueStrings(
      relevantCanonEntityCollections.flatMap((collection) => (
        delta[collection].map((record) => record.entity_id)
      )).filter((entityId) => retainedRecordIds.has(entityId)),
    ),
    retrieval_diagnostics: {
      registry_freshness: registryStale ? "stale" : "current",
      registry_active_engine_hash: registryHash,
      current_active_engine_hash: currentHash,
      identity_match_rules: [
        "same_category_exact_full_name",
        "registered_alias_exact",
        "explicit_entity_id",
      ],
      category_scoped_ambiguity: true,
      character_identity_match_rules: [
        "same_category_exact_full_name",
        "registered_alias_exact",
        "explicit_entity_id",
      ],
      fuzzy_matching_allowed: false,
      full_active_engine_fallback_allowed: false,
    },
  };
  return {
    planned_entity_manifest: manifest,
    planned_entity_hydration: hydration,
    planned_canon_coverage: plannedCanonCoverage,
    relevant_canon_delta: delta,
    relevant_canon: mergedRelevantCanon,
    composition: {
      planned_entity_hydration_chars:
        JSON.stringify(hydration, null, 2).length,
      relevant_canon_chars:
        JSON.stringify(mergedRelevantCanon, null, 2).length,
      relevant_canon_budget_chars: 18_000,
      active_engine_retrieval_chars:
        countHydratedActiveEngineChars(mergedRelevantCanon),
      active_engine_full_text_included: false,
      full_active_engine_fallback_used: false,
    },
  };
}

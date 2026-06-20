import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

export const characterMindStateLedgerVersion = "character_mind_state_ledger_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function text(value, maximum = 400) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function list(value, maximum = 8, itemMaximum = 240) {
  const raw = Array.isArray(value) ? value : [];
  return raw
    .map((item) => text(
      typeof item === "string" ? item : JSON.stringify(item ?? ""),
      itemMaximum,
    ))
    .filter(Boolean)
    .slice(0, maximum);
}

function stringMap(value, maximum = 12, itemMaximum = 220) {
  const result = {};
  for (const [key, raw] of Object.entries(object(value)).slice(0, maximum)) {
    const cleanKey = text(key, 120);
    const cleanValue = text(
      typeof raw === "string" ? raw : JSON.stringify(raw ?? ""),
      itemMaximum,
    );
    if (cleanKey && cleanValue) result[cleanKey] = cleanValue;
  }
  return result;
}

function normalizedName(value) {
  return text(value, 120).replace(/\s+/gu, " ");
}

function lowerKey(value) {
  return normalizedName(value).toLocaleLowerCase("zh-Hant-TW");
}

function uniqueNames(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const name = normalizedName(value);
    const key = lowerKey(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

function namesFromValue(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return [item];
      const entry = object(item);
      return [
        entry.character_name,
        entry.characterName,
        entry.canonical_name,
        entry.name,
      ].filter(Boolean);
    });
  }
  return [];
}

function collectRequestedNames(input) {
  const generation = object(input.generation_context ?? input.generationContext);
  const retrieval = object(input.retrieval_context ?? input.retrievalContext);
  const sourceBundle = object(input.source_bundle ?? input.sourceBundle);
  const bundleContent = object(sourceBundle.content);
  const entityRegistryContext = object(
    input.entity_registry_context
      ?? input.entityRegistryContext
      ?? sourceBundle.entity_registry_context
      ?? bundleContent.entity_registry_context,
  );
  const entityNames = Array.isArray(entityRegistryContext.entities)
    ? entityRegistryContext.entities
      .filter((entity) => ["character", "characters"].includes(entity?.category ?? entity?.entity_type))
      .flatMap((entity) => [entity.name, entity.canonical_name, entity.character_name])
    : [];

  return uniqueNames([
    ...namesFromValue(input.character_names ?? input.characterNames ?? input.characters),
    ...namesFromValue(generation.character_names ?? generation.characterNames ?? generation.characters),
    ...namesFromValue(generation.focus_characters ?? generation.focusCharacters),
    ...namesFromValue(generation.pov_characters ?? generation.povCharacters),
    ...namesFromValue(retrieval.character_names ?? retrieval.characterNames ?? retrieval.characters),
    ...entityNames,
  ]).slice(0, 24);
}

function normalizeEntry(rawEntry, fallbackName = "") {
  const entry = object(rawEntry);
  const characterName = normalizedName(
    entry.character_name
      ?? entry.characterName
      ?? entry.canonical_name
      ?? entry.name
      ?? fallbackName,
  );
  if (!characterName) return null;
  return {
    character_name: characterName,
    character_id: text(entry.character_id ?? entry.characterId ?? entry.id, 160) || null,
    status: "known_in_ledger",
    current_emotion: text(entry.current_emotion ?? entry.currentEmotion ?? entry.emotion, 240),
    body_state: text(entry.body_state ?? entry.bodyState ?? entry.physical_state, 240),
    unspoken_pressure: text(entry.unspoken_pressure ?? entry.unspokenPressure, 320),
    recent_event_traces: list(entry.recent_event_traces ?? entry.recentEventTraces ?? entry.recent_events, 6, 260),
    relationship_attitudes: stringMap(
      entry.relationship_attitudes ?? entry.relationshipAttitudes ?? entry.relationships,
      16,
      240,
    ),
    visible_reactions_allowed: list(
      entry.visible_reactions_allowed ?? entry.visibleReactionsAllowed,
      8,
      220,
    ),
    hidden_reactions_reserved: list(
      entry.hidden_reactions_reserved ?? entry.hiddenReactionsReserved,
      8,
      220,
    ),
    continuity_constraints: list(
      entry.continuity_constraints ?? entry.continuityConstraints ?? entry.chapter_constraints,
      8,
      240,
    ),
    last_updated_chapter: text(entry.last_updated_chapter ?? entry.lastUpdatedChapter, 120) || null,
    evidence_refs: list(entry.evidence_refs ?? entry.evidenceRefs, 8, 200),
  };
}

function normalizeLedger(rawLedger) {
  const ledger = object(rawLedger);
  const rawCharacters = Array.isArray(ledger.characters)
    ? ledger.characters.map((entry) => normalizeEntry(entry)).filter(Boolean)
    : Object.entries(object(ledger.characters)).map(([name, entry]) => normalizeEntry(entry, name)).filter(Boolean);
  const byName = new Map();
  for (const character of rawCharacters) {
    byName.set(lowerKey(character.character_name), character);
  }
  return {
    version: text(ledger.version, 120) || null,
    updated_at: text(ledger.updated_at ?? ledger.updatedAt, 120) || null,
    characters: rawCharacters,
    byName,
  };
}

async function loadLedger(options = {}) {
  if (options.characterMindStateLedger) {
    return {
      status: "loaded_from_options",
      source: "options.characterMindStateLedger",
      source_path: null,
      ledger: normalizeLedger(options.characterMindStateLedger),
      warnings: [],
    };
  }
  const ledgerPath = options.characterMindStateLedgerPath
    ? assertPathInside(
      options.characterMindStateLedgerPath,
      projectPaths.characterProfileDb,
      "characterMindStateLedgerPath",
    )
    : path.join(projectPaths.characterProfileDb, "active_character_mind_state_ledger.json");
  try {
    const raw = await readFile(ledgerPath, "utf8");
    return {
      status: "loaded_from_file",
      source: "character_profile_db",
      source_path: normalizeProjectPath(ledgerPath),
      ledger: normalizeLedger(JSON.parse(raw)),
      warnings: [],
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        status: "missing",
        source: "character_profile_db",
        source_path: normalizeProjectPath(ledgerPath),
        ledger: normalizeLedger({ characters: [] }),
        warnings: ["character_mind_state_ledger_missing"],
      };
    }
    return {
      status: "unreadable",
      source: "character_profile_db",
      source_path: normalizeProjectPath(ledgerPath),
      ledger: normalizeLedger({ characters: [] }),
      warnings: ["character_mind_state_ledger_unreadable"],
    };
  }
}

function placeholder(name) {
  return {
    character_name: name,
    character_id: null,
    status: "missing_from_ledger",
    current_emotion: "",
    body_state: "",
    unspoken_pressure: "",
    recent_event_traces: [],
    relationship_attitudes: {},
    visible_reactions_allowed: [],
    hidden_reactions_reserved: [],
    continuity_constraints: ["Do not invent settled mind-state facts; infer only as candidate prose."],
    last_updated_chapter: null,
    evidence_refs: [],
  };
}

function buildStateDeltaGuidance() {
  return {
    purpose: "Use this only as candidate-writing continuity guidance; do not persist it automatically.",
    expected_delta_fields: [
      "current_emotion_delta",
      "body_state_delta",
      "unspoken_pressure_delta",
      "relationship_attitude_delta",
      "recent_event_trace",
      "visible_reaction_used",
      "hidden_reaction_reserved",
      "continuity_constraint_observed",
    ],
    adoption_policy: "Mind-state updates require adopted writing, settlement/proof review, and explicit user confirmation before any long-term ledger update.",
  };
}

export async function buildCharacterMindStateLedgerContext(rawInput = {}, options = {}) {
  const requestedNames = collectRequestedNames(rawInput);
  const loaded = await loadLedger(options);
  const maxCharacters = Number.isInteger(options.characterMindStateLedgerLimit)
    ? Math.max(1, Math.min(options.characterMindStateLedgerLimit, 24))
    : 12;
  const fallbackNames = loaded.ledger.characters
    .slice(0, maxCharacters)
    .map((entry) => entry.character_name);
  const selectedNames = (requestedNames.length ? requestedNames : fallbackNames).slice(0, maxCharacters);
  const characters = selectedNames.map((name) => loaded.ledger.byName.get(lowerKey(name)) ?? placeholder(name));
  const missingCharacterNames = characters
    .filter((entry) => entry.status === "missing_from_ledger")
    .map((entry) => entry.character_name);
  const status = loaded.status === "missing"
    ? "ledger_missing"
    : loaded.status === "unreadable"
      ? "ledger_unreadable"
      : "completed";
  const warnings = [
    ...loaded.warnings,
    ...(missingCharacterNames.length ? ["requested_characters_missing_from_mind_state_ledger"] : []),
  ];
  const context = {
    used: true,
    phase: "25A",
    version: characterMindStateLedgerVersion,
    status,
    source: loaded.source,
    source_path: loaded.source_path,
    source_version: loaded.ledger.version,
    source_updated_at: loaded.ledger.updated_at,
    read_only: true,
    candidate_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    requested_character_names: requestedNames,
    matched_characters: characters.length - missingCharacterNames.length,
    missing_character_names: missingCharacterNames,
    characters,
    state_delta_guidance: buildStateDeltaGuidance(),
    provider_contract: {
      generation_payload_key: "character_mind_state_ledger",
      revision_payload_key: "character_mind_state_ledger",
      final_polisher_payload_key: "character_mind_state_ledger",
    },
    warnings,
  };
  context.trace_id = `mind_state_ledger_${sha256(JSON.stringify({
    names: selectedNames,
    status: context.status,
    characters,
  })).slice(0, 16)}`;
  return context;
}

export default buildCharacterMindStateLedgerContext;

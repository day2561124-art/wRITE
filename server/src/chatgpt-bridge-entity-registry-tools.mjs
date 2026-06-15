import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectPaths, normalizeProjectPath } from "./project-paths.mjs";

function clampLimit(limit, def = 20, max = 50) {
  if (limit === undefined || limit === null || limit === "") return def;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("limit must be a positive integer");
  if (limit > max) return { value: max, clamped: true };
  return { value: limit, clamped: false };
}

function normalizeStringArg(value, maxLength = 120, name = "q") {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${name} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) throw new Error(`${name} length must be <= ${maxLength}`);
  return trimmed;
}

function normalizeEntitySearchText(value) {
  return String(value ?? "")
    .toLocaleLowerCase("zh-Hant")
    .replace(/[\s｜|、，,。；;：:（）()[\]【】「」『』《》<>]+/gu, " ")
    .trim();
}

function entitySearchTokens(query) {
  const normalized = normalizeEntitySearchText(query);
  if (!normalized) return [];
  return [...new Set(normalized.split(/\s+/u).filter(Boolean))];
}

function entitySearchHaystack(meta = {}, full = {}) {
  return normalizeEntitySearchText([
    full.canonical_name,
    meta.canonical_name,
    meta.entity_id,
    ...(Array.isArray(full.aliases) ? full.aliases : []),
    full.source_excerpt,
    full.source_section,
    ...(Array.isArray(full.related_chapters) ? full.related_chapters : []),
    ...(Array.isArray(full.related_characters) ? full.related_characters : []),
    ...(Array.isArray(full.related_entities) ? full.related_entities : []),
  ].filter(Boolean).join("\n"));
}

function entitySearchScore(meta = {}, full = {}, query = "") {
  const tokens = entitySearchTokens(query);
  if (tokens.length === 0) return 0;

  const canonical = normalizeEntitySearchText(full.canonical_name ?? meta.canonical_name);
  const metaCanonical = normalizeEntitySearchText(meta.canonical_name);
  const entityId = normalizeEntitySearchText(meta.entity_id);
  const aliases = (Array.isArray(full.aliases) ? full.aliases : []).map((item) => normalizeEntitySearchText(item));
  const haystack = entitySearchHaystack(meta, full);

  let score = 0;

  for (const token of tokens) {
    if (!token) continue;

    if (canonical === token) score += 180;
    else if (metaCanonical === token) score += 160;
    else if (aliases.includes(token)) score += 150;
    else if (canonical.includes(token)) score += 80;
    else if (metaCanonical.includes(token)) score += 70;
    else if (aliases.some((alias) => alias.includes(token))) score += 65;
    else if (entityId.includes(token)) score += 40;
    else if (haystack.includes(token)) score += 10;
  }

  if (tokens.length === 1) {
    const token = tokens[0];
    const isExactCanonical = canonical === token || metaCanonical === token;
    const isExactAlias = aliases.includes(token);

    if (meta.entity_type === "character" && (isExactCanonical || isExactAlias)) {
      score += 1000;
    } else if (isExactCanonical || isExactAlias) {
      score += 200;
    }
  }

  return score;
}

function assertUnknownArgs(args, allowed = []) {
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) throw new Error(`Unknown argument for entity registry tool: ${key}.`);
  }
}

async function loadJson(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return JSON.parse(text);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function chatgpt_bridge_get_entity_registry_summary(input = {}) {
  assertUnknownArgs(input, [
    "include_counts_by_status",
    "include_counts_by_type",
    "include_conflict_summary",
    "include_provenance",
  ]);
  const include_counts_by_status = input.include_counts_by_status !== false;
  const include_counts_by_type = input.include_counts_by_type !== false;
  const include_conflict_summary = input.include_conflict_summary !== false;
  const include_provenance = input.include_provenance !== false;

  const registry = await loadJson(projectPaths.entityRegistryData);
  const index = await loadJson(projectPaths.entityRegistryIndex);
  const buildReport = await loadJson(projectPaths.entityRegistryBuildReport);
  const conflictReport = await loadJson(projectPaths.entityRegistryConflictReport);
  const provenance = await loadJson(projectPaths.entityRegistryProvenance);

  const total_entities = index?.entity_count ?? (registry ? Object.values(registry).flat().length : 0);

  const counts_by_type = include_counts_by_type ? (buildReport?.entity_counts_by_type ?? {}) : undefined;
  const counts_by_status = include_counts_by_status ? (buildReport?.status_counts ?? {}) : undefined;
  const conflict_summary = include_conflict_summary ? ({ total: conflictReport?.conflict_count ?? 0, bySeverity: buildReport?.conflict_counts ?? {} }) : undefined;

  return {
    ok: registry !== null,
    registry_status: registry ? "available" : "missing",
    build_status: buildReport?.status ?? null,
    total_entities,
    counts_by_type,
    counts_by_status,
    conflict_summary,
    last_build_time: provenance?.built_at ?? null,
    provenance: include_provenance ? provenance ?? null : null,
    active_engine_hash_at_build: provenance?.active_engine_hash ?? null,
    canon_db_hash_at_build: provenance?.canon_db_hash ?? null,
    compressed_rules_hash_at_build: provenance?.compressed_rules_hash ?? null,
    warnings: buildReport?.warnings ?? provenance?.build_warnings ?? [],
  };
}

export async function chatgpt_bridge_search_canon_entities(input = {}) {
  assertUnknownArgs(input, ["q", "type", "status", "risk_level", "related_chapter", "related_character", "limit", "include_excerpt", "include_related_entities"]);
  const q = normalizeStringArg(input.q ?? "", 120, "q");
  const type = normalizeStringArg(input.type ?? "", 64, "type");
  const status = normalizeStringArg(input.status ?? "", 32, "status");
  const risk_level = normalizeStringArg(input.risk_level ?? "", 8, "risk_level");
  const related_chapter = normalizeStringArg(input.related_chapter ?? "", 120, "related_chapter");
  const related_character = normalizeStringArg(input.related_character ?? "", 120, "related_character");
  const include_excerpt = input.include_excerpt !== false;
  const include_related_entities = input.include_related_entities === true;

  const limitSpec = clampLimit(input.limit, 20, 50);
  const limit = typeof limitSpec === "object" ? limitSpec.value : limitSpec;
  const clamped = typeof limitSpec === "object" ? limitSpec.clamped : false;

  const index = await loadJson(projectPaths.entityRegistryIndex);
  const registry = await loadJson(projectPaths.entityRegistryData);
  const provenance = await loadJson(projectPaths.entityRegistryProvenance);
  if (!index || !registry) return { ok: false, warnings: ["entity registry not available"], entities: [], provenance: provenance ?? null };

  let entries = Object.entries(index.by_id).map(([id, meta]) => ({ entity_id: id, ...meta }));

  if (type) entries = entries.filter((e) => e.entity_type === type);
  if (status) entries = entries.filter((e) => e.status === status);
  if (risk_level) entries = entries.filter((e) => String(e.risk_level) === risk_level);
  const fullForMeta = (meta) => (
    (registry[`${meta.entity_type}s`] || []).find((it) => it.entity_id === meta.entity_id) ?? {}
  );
  const queryScores = new Map();

  if (q) {
    entries = entries.filter((e) => {
      const full = fullForMeta(e);
      const score = entitySearchScore(e, full, q);
      if (score <= 0) return false;
      queryScores.set(e.entity_id, score);
      return true;
    });
  }
  if (related_chapter || related_character) {
    // need to consult full registry
    entries = entries.filter((e) => {
      const full = fullForMeta(e);
      if (!full) return false;
      if (related_chapter && !(full.related_chapters || []).some((c) => c.includes(related_chapter))) return false;
      if (related_character && !(full.related_characters || []).some((c) => c.includes(related_character))) return false;
      return true;
    });
  }

  // stable deterministic sort: status (canon first), exact name match, confidence desc, entity_type, canonical_name, entity_id
  const statusOrder = { canon: 0, candidate: 1, pending: 2, deprecated: 3, conflict: 4, unknown: 5 };
  entries.sort((a, b) => (
    (statusOrder[a.status] - statusOrder[b.status])
    || ((queryScores.get(b.entity_id) ?? 0) - (queryScores.get(a.entity_id) ?? 0))
    || ((a.canonical_name === b.canonical_name) ? 0 : ((a.canonical_name === (q || "")) ? -1 : (b.canonical_name === (q || "")) ? 1 : 0))
    || ((b.confidence || 0) - (a.confidence || 0))
    || a.entity_type.localeCompare(b.entity_type)
    || (a.canonical_name || "").localeCompare(b.canonical_name || "")
    || a.entity_id.localeCompare(b.entity_id)
  ));

  const returned = Math.min(entries.length, limit);
  const slice = entries.slice(0, limit);
  const entities = slice.map((meta) => {
    const full = fullForMeta(meta);
    return {
      entity_id: meta.entity_id,
      entity_type: meta.entity_type,
      canonical_name: meta.canonical_name ?? full.canonical_name ?? null,
      aliases: full.aliases ?? [],
      status: meta.status,
      risk_level: meta.risk_level ?? full.risk_level ?? null,
      confidence: full.confidence ?? null,
      source_tier: full.source_tier ?? null,
      source_section: full.source_section ?? null,
      source_excerpt: include_excerpt ? (full.source_excerpt ?? null) : undefined,
      related_chapters: full.related_chapters ?? [],
      related_characters: full.related_characters ?? [],
      related_entities: include_related_entities ? (full.related_entities ?? []) : undefined,
      provenance: full.provenance ?? null,
    };
  });

  const warnings = [];
  if (clamped) warnings.push("limit clamped to 50");

  return {
    ok: true,
    query: q,
    filters: { type: type || null, status: status || null, risk_level: risk_level || null },
    limit,
    total_matches: entries.length,
    returned,
    entities,
    provenance: provenance ?? null,
    warnings,
  };
}

export async function chatgpt_bridge_get_canon_entity_detail(input = {}) {
  assertUnknownArgs(input, ["entity_id", "include_related_entities", "include_source_excerpt", "include_provenance"]);
  const entity_id = normalizeStringArg(input.entity_id ?? "", 256, "entity_id");
  if (!entity_id) throw new Error("entity_id is required");
  const include_related_entities = input.include_related_entities !== false;
  const include_source_excerpt = input.include_source_excerpt !== false;
  const include_provenance = input.include_provenance !== false;

  const registry = await loadJson(projectPaths.entityRegistryData);
  const provenance = await loadJson(projectPaths.entityRegistryProvenance);
  if (!registry) return { ok: false, warnings: ["entity registry missing"] };

  const allTypes = Object.keys(registry).filter((k) => k !== "provenance");
  for (const type of allTypes) {
    const list = registry[type] || [];
    const found = list.find((it) => it.entity_id === entity_id);
    if (found) {
      const related = include_related_entities ? (found.related_entities || []) : undefined;
      const detail = {
        ...found,
        source_excerpt: include_source_excerpt ? found.source_excerpt : undefined,
        related_entities: related,
      };
      return { ok: true, entity: detail, provenance: include_provenance ? provenance ?? null : null };
    }
  }
  return { ok: false, isError: true, message: "entity not found" };
}

export async function chatgpt_bridge_get_entity_conflicts(input = {}) {
  assertUnknownArgs(input, ["severity", "conflict_type", "entity_id", "requires_human_review", "limit", "include_evidence", "include_recommended_action"]);
  const severity = normalizeStringArg(input.severity ?? "", 4, "severity");
  const conflict_type = normalizeStringArg(input.conflict_type ?? "", 120, "conflict_type");
  const entity_id = normalizeStringArg(input.entity_id ?? "", 256, "entity_id");
  const requires_human_review = input.requires_human_review === true;
  const include_evidence = input.include_evidence !== false;
  const include_recommended_action = input.include_recommended_action !== false;

  const limitSpec = clampLimit(input.limit, 20, 50);
  const limit = typeof limitSpec === "object" ? limitSpec.value : limitSpec;
  const clamped = typeof limitSpec === "object" ? limitSpec.clamped : false;

  const conflictReport = await loadJson(projectPaths.entityRegistryConflictReport);
  const provenance = await loadJson(projectPaths.entityRegistryProvenance);
  const conflicts = (conflictReport?.conflicts ?? []).filter((c) => {
    if (severity && c.severity !== severity) return false;
    if (conflict_type && c.conflict_type !== conflict_type) return false;
    if (entity_id && !(c.involved_entity_ids || []).includes(entity_id)) return false;
    if (requires_human_review && !c.requires_human_review) return false;
    return true;
  });

  const slice = conflicts.slice(0, limit).map((c) => ({
    conflict_id: c.conflict_id,
    conflict_type: c.conflict_type,
    severity: c.severity,
    involved_entity_ids: c.involved_entity_ids,
    summary: c.summary,
    evidence: include_evidence ? c.evidence ?? [] : undefined,
    recommended_action: include_recommended_action ? c.recommended_action ?? null : undefined,
    requires_human_review: !!c.requires_human_review,
  }));

  const warnings = [];
  if (clamped) warnings.push("limit clamped to 50");

  return {
    ok: true,
    total_conflicts: conflicts.length,
    returned: slice.length,
    conflicts: slice,
    provenance: provenance ?? null,
    warnings,
  };
}

export async function chatgpt_bridge_get_entity_registry_provenance(input = {}) {
  assertUnknownArgs(input, ["include_source_files", "include_build_report", "include_warnings"]);
  const include_source_files = input.include_source_files !== false;
  const include_build_report = input.include_build_report !== false;
  const include_warnings = input.include_warnings !== false;

  const provenance = await loadJson(projectPaths.entityRegistryProvenance);
  const buildReport = await loadJson(projectPaths.entityRegistryBuildReport);
  if (!provenance) return { ok: false, warnings: ["provenance missing"] };

  return {
    ok: true,
    registry_version: provenance?.registry_version ?? null,
    build_status: buildReport?.status ?? null,
    build_time: provenance?.built_at ?? null,
    source_files: include_source_files ? (provenance?.source_files ?? []) : undefined,
    active_engine_hash_at_build: provenance?.active_engine_hash ?? null,
    canon_db_hash_at_build: provenance?.canon_db_hash ?? null,
    compressed_rules_hash_at_build: provenance?.compressed_rules_hash ?? null,
    entity_counts: buildReport?.entity_counts_by_type ?? null,
    warnings: include_warnings ? (provenance?.build_warnings ?? buildReport?.warnings ?? []) : [],
    build_report_summary: include_build_report ? (buildReport ?? null) : undefined,
  };
}

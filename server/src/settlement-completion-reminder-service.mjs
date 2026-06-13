import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot, resolveProjectPath, normalizeProjectPath } from "./project-paths.mjs";
import { buildEntityRegistryPreview } from "./entity-registry-preview-service.mjs";
import { buildEntityIntakePreview } from "./entity-intake-service.mjs";

const configPathDefault = path.join(projectRoot, "config", "settlement-completion-reminders.json");

function normalizeLf(value) {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function sha256Lf(value) {
  return createHash("sha256").update(normalizeLf(value), "utf8").digest("hex").toUpperCase();
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  return value.trim();
}

export function validateSettlementCompletionReminderConfig(config) {
  requireObject(config, "settlement completion reminders config");
  if (config.schema_version !== 1) throw new Error("config schema_version must be 1.");
  if (config.mode !== "read_only_preview") throw new Error("mode must be read_only_preview.");
  requireString(config.source_entity_registry_config, "source_entity_registry_config");
  requireString(config.source_entity_intake_config, "source_entity_intake_config");
  requireString(config.source_engine_path, "source_engine_path");
  const expected = requireString(config.expected_engine_sha256_lf, "expected_engine_sha256_lf");
  if (!/^[A-F0-9]{64}$/u.test(expected)) throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  if (config.canon_write_allowed !== false) throw new Error("canon_write_allowed must be false.");
  if (config.approval_required_for_canon_change !== true) throw new Error("approval_required_for_canon_change must be true.");
  return config;
}

export async function loadSettlementCompletionReminderConfig(options = {}) {
  if (options.config) {
    return { config: validateSettlementCompletionReminderConfig(structuredClone(options.config)), config_path: null };
  }
  const configPath = options.configPath ? resolveProjectPath(options.configPath, "settlement completion reminders config") : configPathDefault;
  const config = JSON.parse(await readFile(configPath, "utf8"));
  return { config: validateSettlementCompletionReminderConfig(config), config_path: normalizeProjectPath(configPath) };
}

function normalizeDisplayName(name) {
  if (!name) return "";
  return String(name).replaceAll("\u3000", " ").replaceAll("\t", " ").replace(/^《(.*)》$/u, "$1").replace(/\s+/gu, " ").trim();
}

function makeReminderId(kind, normalizedDisplayName, evidenceHash, sourceType) {
  const seed = `${kind}|${normalizedDisplayName}|${evidenceHash}|${sourceType}`;
  const hash = createHash("sha256").update(seed, "utf8").digest("hex");
  return `reminder_${hash.slice(0,12)}`;
}

function detectNamePattern(names) {
  // conservative naming diversity: detect common prefix/suffix among >=3 names
  if (!Array.isArray(names) || names.length < 3) return { diversity: 1.0, warnings: [] };
  const warnings = [];
  // compute longest common prefix
  const minLen = Math.min(...names.map((n) => n.length));
  let prefix = "";
  for (let i = 0; i < minLen; i++) {
    const ch = names[0][i];
    if (names.every((s) => s[i] === ch)) prefix += ch; else break;
  }
  // compute longest common suffix
  let suffix = "";
  for (let i = 1; i <= minLen; i++) {
    const ch = names[0][names[0].length - i];
    if (names.every((s) => s[s.length - i] === ch)) suffix = ch + suffix; else break;
  }
  if (prefix.length >= 2) warnings.push("shared_prefix_without_family_or_system_reason");
  if (suffix.length >= 2) warnings.push("shared_suffix_without_family_or_system_reason");
  const diversity = warnings.length ? 0.2 : 1.0;
  return { diversity, warnings, prefix, suffix };
}

export async function buildSettlementCompletionReminderPreview(options = {}) {
  const { config } = await loadSettlementCompletionReminderConfig(options);

  // build registry and intake previews
  const registryPreview = await buildEntityRegistryPreview();
  const intakePreview = await buildEntityIntakePreview(options);

  // validate engine hash
  const engineSha = registryPreview.source_sha256_lf;
  if (engineSha !== config.expected_engine_sha256_lf) {
    throw new Error(`engine hash mismatch: expected ${config.expected_engine_sha256_lf} got ${engineSha}`);
  }

  // obtain source text
  let sourceText = "";
  let sourcePath = null;
  let sourceSha = null;
  const sourceType = options.source_type || "manual";
  const sourceLabel = options.source_label || null;
  if (options.source_text) {
    sourceText = String(options.source_text);
  } else if (options.source_path) {
    sourcePath = resolveProjectPath(options.source_path, "settlement reminder source path");
    sourceText = await readFile(sourcePath, "utf8");
    sourceSha = sha256Lf(sourceText);
  } else {
    sourceText = "";
  }

  const lines = normalizeLf(sourceText).split("\n");

  const reminders = [];
  const reminderById = new Map();
  const seenEvidence = new Map();

  function addOrMergeReminder(candidate) {
    const id = candidate.reminder_id;
    const existing = reminderById.get(id);
    const sourceRec = {
      source_type: candidate.source_type,
      source_label: candidate.source_label,
      source_path: candidate.source_path,
      source_sha256_lf: candidate.source_sha256_lf,
      source_line_start: candidate.source_line_start,
      source_line_end: candidate.source_line_end,
      evidence_text: candidate.evidence_text,
      evidence_hash: candidate.evidence_hash,
      extraction_rule: candidate.extraction_rule,
    };
    if (!existing) {
      const withSources = { ...candidate, sources: [sourceRec] };
      reminders.push(withSources);
      reminderById.set(id, withSources);
      return { added: true };
    }
    const hashes = new Set(existing.sources.map((s) => s.evidence_hash));
    if (!hashes.has(sourceRec.evidence_hash)) {
      existing.sources.push(sourceRec);
      existing._warnings = existing._warnings || [];
      if (!existing._warnings.includes("duplicate_reminder_evidence_merged")) existing._warnings.push("duplicate_reminder_evidence_merged");
    }
    return { merged: true };
  }

  // build map of existing names to entity objects
  const existingNames = new Map();
  for (const e of registryPreview.entities) {
    if (!existingNames.has(e.display_name)) existingNames.set(e.display_name, e);
  }

  // markers for various kinds
  const markerRe = /^(新角色|新角色候選|新異能武裝|新武裝|新武裝候選|新能力|新能力候選|新組織|新都市|新國家|新島嶼|新村落|新地點|新設施|新校區|新據點|新特殊空間)\s*[:：]?\s*(.+)$/u;
  const ownerLinkRe = /^(.+?)\s*｜\s*(?:異能武裝[:：]?\s*)?《(.+?)》/u;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const m = line.match(markerRe);
    if (m) {
      const kindToken = m[1];
      const val = m[2].trim();
      let reminderKind = null;
      let entityKind = null;
      let worldSubtype = null;
      // map tokens to reminder kinds
      if (/新角色|新角色候選/u.test(kindToken)) { reminderKind = "character_completion_reminder"; entityKind = "character"; }
      else if (/新異能武裝|新武裝|新武裝候選/u.test(kindToken)) { reminderKind = "weapon_completion_reminder"; entityKind = "weapon"; }
      else if (/新能力|新能力候選/u.test(kindToken)) { reminderKind = "ability_completion_reminder"; entityKind = "ability"; }
      else if (/新組織/u.test(kindToken)) { reminderKind = "organization_completion_reminder"; entityKind = "organization"; }
      else if (/新都市/u.test(kindToken)) { reminderKind = "world_entity_completion_reminder"; entityKind = "location"; worldSubtype = "city"; }
      else if (/新國家/u.test(kindToken)) { reminderKind = "world_entity_completion_reminder"; entityKind = "location"; worldSubtype = "country"; }
      else if (/新島嶼/u.test(kindToken)) { reminderKind = "world_entity_completion_reminder"; entityKind = "location"; worldSubtype = "island"; }
      else if (/新村落/u.test(kindToken)) { reminderKind = "world_entity_completion_reminder"; entityKind = "location"; worldSubtype = "village"; }
      else if (/新特殊空間/u.test(kindToken)) { reminderKind = "world_entity_completion_reminder"; entityKind = "location"; worldSubtype = "special_space"; }
      else if (/新設施/u.test(kindToken)) { reminderKind = "world_entity_completion_reminder"; entityKind = "location"; worldSubtype = "facility"; }
      else if (/新校區/u.test(kindToken)) { reminderKind = "world_entity_completion_reminder"; entityKind = "location"; worldSubtype = "campus"; }
      else if (/新據點/u.test(kindToken)) { reminderKind = "world_entity_completion_reminder"; entityKind = "location"; worldSubtype = "base"; }
      else if (/新地點/u.test(kindToken)) { reminderKind = "location_completion_reminder"; entityKind = "location"; }
      if (!reminderKind) continue;
      // for weapons and world entities prefer bracketed 《》 for weapons
      let display = normalizeDisplayName(val.replace(/^《|》$/gu, ""));
      const evidenceText = line;
      const evidenceHash = sha256Lf(evidenceText);
      const reminderId = makeReminderId(reminderKind, display, evidenceHash, sourceType);
      const isExisting = existingNames.has(display);
      const status = isExisting ? "existing_entity_reference" : "reminder_candidate";
      const missingFields = [];
      // populate minimal missing fields conservatively
      if (reminderKind === "character_completion_reminder") {
        missingFields.push("role_or_school_context","first_evidence_context","relationship_context","ability_or_weapon_status","naming_review");
      } else if (reminderKind === "weapon_completion_reminder") {
        missingFields.push("owner","ability_nature","activation_boundary","limitation_or_cost","first_evidence_context","naming_review");
      } else if (reminderKind === "ability_completion_reminder") {
        missingFields.push("owner","ability_nature","activation_condition","limitation_or_cost","relation_to_weapon","first_evidence_context","naming_review");
      } else if (reminderKind === "organization_completion_reminder") {
        missingFields.push("organization_type","affiliation_or_opposition","first_evidence_context","narrative_function","canon_status_boundary","naming_review");
      } else if (reminderKind === "location_completion_reminder" || reminderKind === "world_entity_completion_reminder") {
        missingFields.push("world_entity_subtype","geographic_relation","governance_or_affiliation","first_evidence_context","narrative_function","canon_status_boundary","naming_review");
      }

      const candidate = {
        reminder_id: reminderId,
        reminder_kind: reminderKind,
        status,
        display_name: display,
        normalized_display_name: display,
        entity_kind: entityKind,
        world_entity_subtype: worldSubtype || null,
        matched_existing_entity_id: isExisting ? existingNames.get(display).entity_id : null,
        source_type: sourceType,
        source_label: sourceLabel,
        source_path: sourcePath || registryPreview.source_path,
        source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
        source_line_start: i + 1,
        source_line_end: i + 1,
        evidence_text: evidenceText,
        evidence_hash: evidenceHash,
        extraction_rule: "marker",
        confidence: isExisting ? 0.95 : 0.5,
        missing_fields: isExisting ? [] : missingFields,
        completion_required: !isExisting,
        risk_level: "low",
        naming_review_required: true,
        name_pattern_diversity: 1.0,
        possible_name_pattern_collision: null,
        allowed_shared_pattern_reason: null,
        naming_warnings: [],
        canon_write_allowed: false,
        approval_required_for_canon_change: true,
        creates_patch_candidate: false,
        creates_formal_card: false,
        warnings: [],
      };
      if (!seenEvidence.has(evidenceHash)) {
        seenEvidence.set(evidenceHash, reminderId);
        addOrMergeReminder(candidate);
      }
      continue;
    }

    // owner link -> character_weapon link, similar to intake but produce reminder
    const lm = line.match(ownerLinkRe);
    if (lm) {
      const charName = normalizeDisplayName(lm[1]);
      const weaponName = normalizeDisplayName(lm[2]);
      const evidenceText = line;
      const evidenceHash = sha256Lf(evidenceText);
      const reminderKind = "character_weapon_link_completion_reminder";
      const reminderId = makeReminderId(reminderKind, `${charName}|${weaponName}`, evidenceHash, sourceType);
      const charExisting = existingNames.get(charName);
      const weaponExisting = existingNames.get(weaponName);
      const status = (charExisting || weaponExisting) ? "existing_entity_reference" : "reminder_candidate";
      const candidate = {
        reminder_id: reminderId,
        reminder_kind: reminderKind,
        status,
        display_name: `${charName}｜${weaponName}`,
        normalized_display_name: `${charName}|${weaponName}`,
        entity_kind: "character_weapon_link",
        world_entity_subtype: null,
        matched_existing_entity_id: null,
        character_display_name: charName,
        weapon_display_name: weaponName,
        character_existing_entity_id: charExisting ? charExisting.entity_id : null,
        weapon_existing_entity_id: weaponExisting ? weaponExisting.entity_id : null,
        source_type: sourceType,
        source_label: sourceLabel,
        source_path: sourcePath || registryPreview.source_path,
        source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
        source_line_start: i + 1,
        source_line_end: i + 1,
        evidence_text: evidenceText,
        evidence_hash: evidenceHash,
        extraction_rule: "owner_link",
        confidence: 0.6,
        missing_fields: [],
        completion_required: true,
        risk_level: "low",
        naming_review_required: false,
        name_pattern_diversity: 1.0,
        possible_name_pattern_collision: null,
        allowed_shared_pattern_reason: null,
        naming_warnings: [],
        canon_write_allowed: false,
        approval_required_for_canon_change: true,
        creates_patch_candidate: false,
        creates_formal_card: false,
        warnings: [],
      };
      if (!seenEvidence.has(evidenceHash)) {
        seenEvidence.set(evidenceHash, reminderId);
        addOrMergeReminder(candidate);
      }
      continue;
    }
  }

  // table parsing for explicit rows like intake
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].trim().match(/^\|?\s*-+\s*\|/u)) {
      const header = line;
      const rows = [];
      let j = i + 2;
      for (; j < lines.length; j++) {
        const r = lines[j];
        if (!r.includes("|")) break;
        rows.push(r);
      }
      const cols = header.split("|").map((c) => c.trim().toLowerCase());
      const typeIdx = cols.findIndex((c) => /類型|type/u.test(c));
      const nameIdx = cols.findIndex((c) => /名稱|name/u.test(c));
      if (typeIdx !== -1 && nameIdx !== -1) {
        for (let k = 0; k < rows.length; k++) {
          const parts = rows[k].split("|").map((p) => p.trim());
          const t = parts[typeIdx] || "";
          const n = parts[nameIdx] || "";
          if (/新角色/u.test(t)) {
            const display = normalizeDisplayName(n);
            const evidenceText = rows[k];
            const evidenceHash = sha256Lf(evidenceText);
            const reminderKind = "character_completion_reminder";
            const reminderId = makeReminderId(reminderKind, display, evidenceHash, sourceType);
            const isExisting = existingNames.has(display);
            const candidate = {
              reminder_id: reminderId,
              reminder_kind: reminderKind,
              status: isExisting ? "existing_entity_reference" : "reminder_candidate",
              display_name: display,
              normalized_display_name: display,
              entity_kind: "character",
              world_entity_subtype: null,
              matched_existing_entity_id: isExisting ? existingNames.get(display).entity_id : null,
              source_type: sourceType,
              source_label: sourceLabel,
              source_path: sourcePath || registryPreview.source_path,
              source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
              source_line_start: i + 2 + k,
              source_line_end: i + 2 + k,
              evidence_text: evidenceText,
              evidence_hash: evidenceHash,
              extraction_rule: "table",
              confidence: isExisting ? 0.95 : 0.6,
              missing_fields: isExisting ? [] : ["role_or_school_context","first_evidence_context","relationship_context","ability_or_weapon_status","naming_review"],
              completion_required: !isExisting,
              risk_level: "low",
              naming_review_required: true,
              name_pattern_diversity: 1.0,
              possible_name_pattern_collision: null,
              allowed_shared_pattern_reason: null,
              naming_warnings: [],
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
              creates_patch_candidate: false,
              creates_formal_card: false,
              warnings: [],
            };
            if (!seenEvidence.has(evidenceHash)) {
              seenEvidence.set(evidenceHash, reminderId);
              addOrMergeReminder(candidate);
            }
          } else if (/新異能武裝|新武裝/u.test(t)) {
            const m = n.match(/《(.+?)》/u);
            if (!m) continue;
            const display = normalizeDisplayName(m[1]);
            const evidenceText = rows[k];
            const evidenceHash = sha256Lf(evidenceText);
            const reminderKind = "weapon_completion_reminder";
            const reminderId = makeReminderId(reminderKind, display, evidenceHash, sourceType);
            const isExisting = existingNames.has(display);
            const candidate = {
              reminder_id: reminderId,
              reminder_kind: reminderKind,
              status: isExisting ? "existing_entity_reference" : "reminder_candidate",
              display_name: display,
              normalized_display_name: display,
              entity_kind: "weapon",
              world_entity_subtype: null,
              matched_existing_entity_id: isExisting ? existingNames.get(display).entity_id : null,
              source_type: sourceType,
              source_label: sourceLabel,
              source_path: sourcePath || registryPreview.source_path,
              source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
              source_line_start: i + 2 + k,
              source_line_end: i + 2 + k,
              evidence_text: evidenceText,
              evidence_hash: evidenceHash,
              extraction_rule: "table",
              confidence: isExisting ? 0.95 : 0.6,
              missing_fields: isExisting ? [] : ["owner","ability_nature","activation_boundary","limitation_or_cost","first_evidence_context","naming_review"],
              completion_required: !isExisting,
              risk_level: "low",
              naming_review_required: true,
              name_pattern_diversity: 1.0,
              possible_name_pattern_collision: null,
              allowed_shared_pattern_reason: null,
              naming_warnings: [],
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
              creates_patch_candidate: false,
              creates_formal_card: false,
              warnings: [],
            };
            if (!seenEvidence.has(evidenceHash)) {
              seenEvidence.set(evidenceHash, reminderId);
              addOrMergeReminder(candidate);
            }
          } else if (/新都市|新國家|新島嶼|新村落|新特殊空間|新設施|新校區|新據點|新地點/u.test(t)) {
            const display = normalizeDisplayName(n);
            const evidenceText = rows[k];
            const evidenceHash = sha256Lf(evidenceText);
            let subtype = null;
            if (/新都市/u.test(t)) subtype = "city";
            else if (/新國家/u.test(t)) subtype = "country";
            else if (/新島嶼/u.test(t)) subtype = "island";
            else if (/新村落/u.test(t)) subtype = "village";
            else if (/新特殊空間/u.test(t)) subtype = "special_space";
            else if (/新設施/u.test(t)) subtype = "facility";
            else if (/新校區/u.test(t)) subtype = "campus";
            else if (/新據點/u.test(t)) subtype = "base";
            const reminderKind = "world_entity_completion_reminder";
            const reminderId = makeReminderId(reminderKind, display, evidenceHash, sourceType);
            const isExisting = existingNames.has(display);
            const candidate = {
              reminder_id: reminderId,
              reminder_kind: reminderKind,
              status: isExisting ? "existing_entity_reference" : "reminder_candidate",
              display_name: display,
              normalized_display_name: display,
              entity_kind: "location",
              world_entity_subtype: subtype,
              matched_existing_entity_id: isExisting ? existingNames.get(display).entity_id : null,
              source_type: sourceType,
              source_label: sourceLabel,
              source_path: sourcePath || registryPreview.source_path,
              source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
              source_line_start: i + 2 + k,
              source_line_end: i + 2 + k,
              evidence_text: evidenceText,
              evidence_hash: evidenceHash,
              extraction_rule: "table",
              confidence: isExisting ? 0.95 : 0.6,
              missing_fields: isExisting ? [] : ["world_entity_subtype","geographic_relation","governance_or_affiliation","first_evidence_context","narrative_function","canon_status_boundary","naming_review"],
              completion_required: !isExisting,
              risk_level: "low",
              naming_review_required: true,
              name_pattern_diversity: 1.0,
              possible_name_pattern_collision: null,
              allowed_shared_pattern_reason: null,
              naming_warnings: [],
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
              creates_patch_candidate: false,
              creates_formal_card: false,
              warnings: [],
            };
            if (!seenEvidence.has(evidenceHash)) {
              seenEvidence.set(evidenceHash, reminderId);
              addOrMergeReminder(candidate);
            }
          }
        }
      }
      i = j - 1;
    }
  }

  // naming diversity check across reminders in this preview
  const nameGroups = {};
  for (const r of reminders) {
    if (!r || !r.display_name) continue;
    const key = r.reminder_kind;
    nameGroups[key] = nameGroups[key] || [];
    nameGroups[key].push(r.display_name);
  }
  const naming_review_summary = {};
  for (const k of Object.keys(nameGroups)) {
    const res = detectNamePattern(nameGroups[k]);
    naming_review_summary[k] = { name_count: nameGroups[k].length, name_pattern_diversity: res.diversity, warnings: res.warnings || [] };
    // annotate per reminder
    for (const r of reminders.filter((x) => x.reminder_kind === k)) {
      r.name_pattern_diversity = res.diversity;
      r.naming_warnings = res.warnings || [];
      if (res.warnings && res.warnings.length) r.naming_review_required = true;
    }
  }

  const counts = {};
  for (const k of config.reminder_kinds) counts[k] = 0;
  for (const r of reminders) counts[r.reminder_kind] = (counts[r.reminder_kind] || 0) + 1;

  const preview = {
    schema_version: config.schema_version,
    mode: config.mode,
    read_only: true,
    source_type: sourceType,
    source_label: sourceLabel,
    source_path: sourcePath || registryPreview.source_path,
    source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
    engine_sha256_lf: registryPreview.source_sha256_lf,
    expected_engine_sha256_lf: config.expected_engine_sha256_lf,
    engine_hash_matches: registryPreview.source_sha256_lf === config.expected_engine_sha256_lf,
    entity_registry_source: {
      source_path: registryPreview.source_path,
      source_sha256_lf: registryPreview.source_sha256_lf,
    },
    entity_intake_source: {
      source_path: intakePreview.source_path,
      source_sha256_lf: intakePreview.source_sha256_lf,
    },
    reminder_count: reminders.length,
    reminder_counts_by_kind: counts,
    reminders,
    existing_references: [],
    naming_review_summary,
    warnings: [],
    blocking_warnings: [],
    canon_write_allowed: false,
    approval_required_for_canon_change: true,
    creates_patch_candidate: false,
    updates_canon_db: false,
    updates_active_engine: false,
  };

  return preview;
}

export function compileSettlementCompletionReminderSummary(preview) {
  requireObject(preview, "settlement preview");
  return {
    source_path: preview.source_path,
    source_sha256_lf: preview.source_sha256_lf,
    engine_sha256_lf: preview.engine_sha256_lf,
    engine_hash_matches: preview.engine_hash_matches,
    reminder_count: preview.reminder_count,
    reminder_counts_by_kind: preview.reminder_counts_by_kind,
    warnings: preview.warnings,
    blocking_warnings: preview.blocking_warnings,
    naming_review_summary: preview.naming_review_summary,
  };
}

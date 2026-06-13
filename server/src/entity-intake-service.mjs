import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot, resolveProjectPath, normalizeProjectPath } from "./project-paths.mjs";
import { buildEntityRegistryPreview } from "./entity-registry-preview-service.mjs";

const intakeConfigPath = path.join(projectRoot, "config", "entity-intake.json");

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

export function validateEntityIntakeConfig(config) {
  requireObject(config, "entity intake config");
  if (config.schema_version !== 1) throw new Error("entity intake config schema_version must be 1.");
  if (config.mode !== "read_only_preview") throw new Error("mode must be read_only_preview.");
  requireString(config.source_entity_registry_config, "source_entity_registry_config");
  requireString(config.source_engine_path, "source_engine_path");
  const expected = requireString(config.expected_engine_sha256_lf, "expected_engine_sha256_lf");
  if (!/^[A-F0-9]{64}$/u.test(expected)) throw new Error("expected_engine_sha256_lf must be an uppercase SHA-256.");
  if (config.canon_write_allowed !== false) throw new Error("canon_write_allowed must be false.");
  if (config.approval_required_for_canon_change !== true) throw new Error("approval_required_for_canon_change must be true.");
  return config;
}

export async function loadEntityIntakeConfig(options = {}) {
  if (options.config) {
    return { config: validateEntityIntakeConfig(structuredClone(options.config)), config_path: null };
  }
  const configPath = options.configPath ? resolveProjectPath(options.configPath, "entity intake config") : intakeConfigPath;
  const config = JSON.parse(await readFile(configPath, "utf8"));
  return { config: validateEntityIntakeConfig(config), config_path: normalizeProjectPath(configPath) };
}

function normalizeDisplayName(name) {
  if (!name) return "";
  return String(name).replaceAll("\u3000", " ").replaceAll("\t", " ").replace(/^《(.*)》$/u, "$1").replace(/\s+/gu, " ").trim();
}

function makeIntakeId(kind, normalizedDisplayName, evidenceHash, sourceType) {
  const seed = `${kind}|${normalizedDisplayName}|${evidenceHash}|${sourceType}`;
  const hash = createHash("sha256").update(seed, "utf8").digest("hex");
  return `intake_${hash.slice(0,12)}`;
}

export async function buildEntityIntakePreview(options = {}) {
  const { config } = await loadEntityIntakeConfig(options);

  // build registry preview to know existing entities
  const registryPreview = await buildEntityRegistryPreview();

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
    sourcePath = resolveProjectPath(options.source_path, "entity intake source path");
    sourceText = await readFile(sourcePath, "utf8");
    sourceSha = sha256Lf(sourceText);
  } else {
    // default: use small fixture empty text
    sourceText = "";
  }

  const lines = normalizeLf(sourceText).split("\n");

  const intakes = [];
  const intakeById = new Map();
  const seenEvidence = new Map();

  function addOrMergeIntake(candidate) {
    const id = candidate.intake_id;
    const existing = intakeById.get(id);
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
      intakes.push(withSources);
      intakeById.set(id, withSources);
      return { added: true };
    }
    const hashes = new Set(existing.sources.map((s) => s.evidence_hash));
    if (!hashes.has(sourceRec.evidence_hash)) {
      existing.sources.push(sourceRec);
      existing._warnings = existing._warnings || [];
      if (!existing._warnings.includes("duplicate_intake_evidence_merged")) existing._warnings.push("duplicate_intake_evidence_merged");
    }
    return { merged: true };
  }

  // helper to check existing registry entities
  const existingNames = new Map();
  for (const e of registryPreview.entities) {
    if (!existingNames.has(e.display_name)) existingNames.set(e.display_name, e);
  }

  // marker patterns
  const markerTypeRe = /^(新角色|新角色候選|character_intake|新異能武裝|新武裝|新武裝候選|weapon_intake)\s*[:：]?\s*(.+)$/u;
  const ownerLinkRe = /^(.+?)\s*｜\s*(?:異能武裝[:：]?\s*)?《(.+?)》/u;

  // scan lines for explicit markers
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // marker form
    const m = line.match(markerTypeRe);
    if (m) {
      const ty = m[1];
      const val = m[2].trim();
      // weapon requires 《》 or will be treated cautiously
      if (/新異能武裝|新武裝|weapon_intake/u.test(ty) || /^《.+》$/u.test(val)) {
        const display = normalizeDisplayName(val.replace(/^《|》$/gu, ""));
        const evidenceText = line;
        const evidenceHash = sha256Lf(evidenceText);
        const kind = "weapon_intake";
        const intakeId = makeIntakeId(kind, display, evidenceHash, sourceType);
        const candidate = {
          intake_id: intakeId,
          intake_kind: kind,
          status: existingNames.has(display) ? "existing_entity_reference" : "intake_candidate",
          display_name: display,
          normalized_display_name: display,
          entity_kind: "weapon",
          matched_existing_entity_id: existingNames.has(display) ? existingNames.get(display).entity_id : null,
          source_type: sourceType,
          source_label: sourceLabel,
          source_path: sourcePath || registryPreview.source_path,
          source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
          source_line_start: i + 1,
          source_line_end: i + 1,
          evidence_text: evidenceText,
          evidence_hash: evidenceHash,
          extraction_rule: "marker",
          confidence: existingNames.has(display) ? 0.95 : 0.5,
          missing_fields: existingNames.has(display) ? [] : ["owner","ability_nature","activation_boundary","limitation_or_cost","first_evidence_context"],
          completion_required: true,
          risk_level: "low",
          canon_write_allowed: false,
          approval_required_for_canon_change: true,
          creates_formal_card: false,
          warnings: [],
        };
        if (!seenEvidence.has(evidenceHash)) {
          seenEvidence.set(evidenceHash, intakeId);
          addOrMergeIntake(candidate);
        }
        continue;
      }
      // character marker
      if (/新角色|新角色候選|character_intake/u.test(ty)) {
        const display = normalizeDisplayName(val);
        const evidenceText = line;
        const evidenceHash = sha256Lf(evidenceText);
        const kind = "character_intake";
        const intakeId = makeIntakeId(kind, display, evidenceHash, sourceType);
        const candidate = {
          intake_id: intakeId,
          intake_kind: kind,
          status: existingNames.has(display) ? "existing_entity_reference" : "intake_candidate",
          display_name: display,
          normalized_display_name: display,
          entity_kind: "character",
          matched_existing_entity_id: existingNames.has(display) ? existingNames.get(display).entity_id : null,
          source_type: sourceType,
          source_label: sourceLabel,
          source_path: sourcePath || registryPreview.source_path,
          source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
          source_line_start: i + 1,
          source_line_end: i + 1,
          evidence_text: evidenceText,
          evidence_hash: evidenceHash,
          extraction_rule: "marker",
          confidence: existingNames.has(display) ? 0.95 : 0.5,
          missing_fields: existingNames.has(display) ? [] : ["role_or_school_context","first_evidence_context","relationship_context","ability_or_weapon_status"],
          completion_required: true,
          risk_level: "low",
          canon_write_allowed: false,
          approval_required_for_canon_change: true,
          creates_formal_card: false,
          warnings: [],
        };
        if (!seenEvidence.has(evidenceHash)) {
          seenEvidence.set(evidenceHash, intakeId);
          addOrMergeIntake(candidate);
        }
        continue;
      }
    }

    // owner link form
    const lm = line.match(ownerLinkRe);
    if (lm) {
      const charName = normalizeDisplayName(lm[1]);
      const weaponName = normalizeDisplayName(lm[2]);
      const evidenceText = line;
      const evidenceHash = sha256Lf(evidenceText);
      const kind = "character_weapon_link_intake";
      const intakeId = makeIntakeId(kind, `${charName}|${weaponName}`, evidenceHash, sourceType);
      const characterExisting = existingNames.get(charName);
      const weaponExisting = existingNames.get(weaponName);
      const candidate = {
        intake_id: intakeId,
        intake_kind: kind,
        status: (characterExisting || weaponExisting) ? "existing_entity_reference" : "intake_candidate",
        display_name: `${charName}｜${weaponName}`,
        normalized_display_name: `${charName}|${weaponName}`,
        entity_kind: "character_weapon_link",
        matched_existing_entity_id: null,
        character_display_name: charName,
        weapon_display_name: weaponName,
        character_existing_entity_id: characterExisting ? characterExisting.entity_id : null,
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
        canon_write_allowed: false,
        approval_required_for_canon_change: true,
        creates_formal_card: false,
        warnings: [],
      };
      if (!seenEvidence.has(evidenceHash)) {
        seenEvidence.set(evidenceHash, intakeId);
        addOrMergeIntake(candidate);
      }
      continue;
    }
  }

  // table detection for explicit intake rows
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
            const kind = "character_intake";
            const intakeId = makeIntakeId(kind, display, evidenceHash, sourceType);
            const candidate = {
              intake_id: intakeId,
              intake_kind: kind,
              status: existingNames.has(display) ? "existing_entity_reference" : "intake_candidate",
              display_name: display,
              normalized_display_name: display,
              entity_kind: "character",
              matched_existing_entity_id: existingNames.has(display) ? existingNames.get(display).entity_id : null,
              source_type: sourceType,
              source_label: sourceLabel,
              source_path: sourcePath || registryPreview.source_path,
              source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
              source_line_start: i + 2 + k,
              source_line_end: i + 2 + k,
              evidence_text: evidenceText,
              evidence_hash: evidenceHash,
              extraction_rule: "table",
              confidence: 0.6,
              missing_fields: existingNames.has(display) ? [] : ["role_or_school_context","first_evidence_context","relationship_context","ability_or_weapon_status"],
              completion_required: true,
              risk_level: "low",
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
              creates_formal_card: false,
              warnings: [],
            };
            if (!seenEvidence.has(evidenceHash)) {
              seenEvidence.set(evidenceHash, intakeId);
              addOrMergeIntake(candidate);
            }
          } else if (/新異能武裝|新武裝/u.test(t)) {
            const m = n.match(/《(.+?)》/u);
            if (!m) continue;
            const display = normalizeDisplayName(m[1]);
            const evidenceText = rows[k];
            const evidenceHash = sha256Lf(evidenceText);
            const kind = "weapon_intake";
            const intakeId = makeIntakeId(kind, display, evidenceHash, sourceType);
            const candidate = {
              intake_id: intakeId,
              intake_kind: kind,
              status: existingNames.has(display) ? "existing_entity_reference" : "intake_candidate",
              display_name: display,
              normalized_display_name: display,
              entity_kind: "weapon",
              matched_existing_entity_id: existingNames.has(display) ? existingNames.get(display).entity_id : null,
              source_type: sourceType,
              source_label: sourceLabel,
              source_path: sourcePath || registryPreview.source_path,
              source_sha256_lf: sourceSha || registryPreview.source_sha256_lf,
              source_line_start: i + 2 + k,
              source_line_end: i + 2 + k,
              evidence_text: evidenceText,
              evidence_hash: evidenceHash,
              extraction_rule: "table",
              confidence: 0.6,
              missing_fields: existingNames.has(display) ? [] : ["owner","ability_nature","activation_boundary","limitation_or_cost","first_evidence_context"],
              completion_required: true,
              risk_level: "low",
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
              creates_formal_card: false,
              warnings: [],
            };
            if (!seenEvidence.has(evidenceHash)) {
              seenEvidence.set(evidenceHash, intakeId);
              addOrMergeIntake(candidate);
            }
          }
        }
      }
      i = j - 1;
    }
  }

  const counts = {};
  for (const k of config.intake_kinds) counts[k] = 0;
  for (const it of intakes) {
    counts[it.intake_kind] = (counts[it.intake_kind] || 0) + 1;
  }

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
    intake_count: intakes.length,
    intake_counts_by_kind: counts,
    intakes,
    existing_references: [],
    warnings: [],
    blocking_warnings: [],
    canon_write_allowed: false,
    approval_required_for_canon_change: true,
  };

  return preview;
}

export function compileEntityIntakeSummary(preview) {
  requireObject(preview, "entity intake preview");
  return {
    source_path: preview.source_path,
    source_sha256_lf: preview.source_sha256_lf,
    engine_sha256_lf: preview.engine_sha256_lf,
    engine_hash_matches: preview.engine_hash_matches,
    intake_count: preview.intake_count,
    intake_counts_by_kind: preview.intake_counts_by_kind,
    warnings: preview.warnings,
    blocking_warnings: preview.blocking_warnings,
  };
}

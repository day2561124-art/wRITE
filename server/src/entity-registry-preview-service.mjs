import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  normalizeProjectPath,
  projectRoot,
  resolveProjectPath,
} from "./project-paths.mjs";
import {
  loadCanonZoneConfig,
  validateCanonZoneConfig,
  buildCanonZonePreview,
} from "./canon-zone-preview-service.mjs";

const entityConfigPath = path.join(projectRoot, "config", "entity-registry.json");

function normalizeLf(value) {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function sha256Lf(value) {
  return createHash("sha256").update(normalizeLf(value), "utf8").digest("hex").toUpperCase();
}

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

export function validateEntityRegistryConfig(config) {
  requireObject(config, "entity registry config");
  if (config.schema_version !== 1) throw new Error("entity registry config schema_version must be 1.");
  if (config.source_component !== "canon_data") throw new Error("source_component must be canon_data.");
  requireString(config.source_path, "source_path");
  requireString(config.source_zones_config, "source_zones_config");
  const expected = requireString(config.expected_sha256_lf, "expected_sha256_lf");
  if (!/^[A-F0-9]{64}$/u.test(expected)) throw new Error("expected_sha256_lf must be an uppercase SHA-256.");
  if (config.mode !== "read_only_preview") throw new Error("mode must be read_only_preview.");
  if (!Array.isArray(config.entity_kinds) || config.entity_kinds.length === 0) {
    throw new Error("entity_kinds must be a non-empty array.");
  }
  return config;
}

export async function loadEntityRegistryConfig(options = {}) {
  if (options.config) {
    return { config: validateEntityRegistryConfig(structuredClone(options.config)), config_path: null };
  }
  const configPath = options.configPath ? resolveProjectPath(options.configPath, "entity registry config") : entityConfigPath;
  const config = JSON.parse(await readFile(configPath, "utf8"));
  return { config: validateEntityRegistryConfig(config), config_path: normalizeProjectPath(configPath) };
}

function normalizeDisplayName(name) {
  if (!name) return "";
  // replace fullwidth spaces, normalize whitespace
  return String(name).replaceAll("\u3000", " ").replaceAll("\t", " ").replace(/\s+/gu, " ").trim();
}

function makeEntityId(kind, displayName, sourceZoneId) {
  const seed = `${kind}|${displayName}|${sourceZoneId}`;
  const hash = createHash("sha256").update(seed, "utf8").digest("hex");
  const short = hash.slice(0, 12);
  const prefix = {
    character: "char_",
    weapon: "weapon_",
    organization: "org_",
    location: "loc_",
  }[kind] ?? `${kind}_`;
  return `${prefix}${short}`;
}

function evidenceHash(text) {
  return sha256Lf(text);
}

function chooseStatusFromEvidence(evidence) {
  const low = evidence.toLowerCase();
  if (/不採用|刪除|撤回/u.test(low)) return "rejected_by_rule";
  if (/候選|暫定|草案|可能|未採用|擬定/u.test(low)) return "ambiguous_candidate";
  return "registry_candidate";
}

function extractFromHeading(line) {
  const m = line.match(/^#{1,6}\s*(.+)$/u);
  if (m) return m[1].trim();
  return null;
}

function extractFromListItem(line) {
  const m = line.match(/^\s*[-*+]\s+(.+)$/u);
  if (m) return m[1].trim();
  return null;
}

function extractTableColumn(headerLine, rows, wantKeys) {
  const cols = headerLine.split("|").map((c) => c.trim().toLowerCase());
  const idx = cols.findIndex((c) => wantKeys.some((k) => c.includes(k)));
  if (idx === -1) return [];
  const values = [];
  for (const r of rows) {
    const parts = r.split("|").map((p) => p.trim());
    if (parts.length > idx) values.push(parts[idx]);
  }
  return values;
}

export async function buildEntityRegistryPreview(options = {}) {
  const { config, config_path } = await loadEntityRegistryConfig(options);
  // load canon zones config via canonical loader to ensure consistency
  const zonesConfigPath = resolveProjectPath(config.source_zones_config, "canon zones config");
  const zonesConfig = JSON.parse(await readFile(zonesConfigPath, "utf8"));
  validateCanonZoneConfig(zonesConfig);

  // build canon zone preview (will validate source hash)
  const canonPreview = await buildCanonZonePreview({ config: zonesConfig });

  if (canonPreview.source_sha256_lf !== config.expected_sha256_lf) {
    throw new Error(`Source hash mismatch between entity config and canon zones: expected ${config.expected_sha256_lf}, got ${canonPreview.source_sha256_lf}`);
  }

  const entities = [];
  const seenEvidence = new Map();
  const entityById = new Map();

  function addOrMergeEntity(candidate) {
    const id = candidate.entity_id;
    const existing = entityById.get(id);
    // prepare source record
    const sourceRec = {
      source_zone_id: candidate.source_zone_id,
      source_path: candidate.source_path,
      source_sha256_lf: candidate.source_sha256_lf,
      source_line_start: candidate.source_line_start,
      source_line_end: candidate.source_line_end,
      evidence_text: candidate.evidence_text,
      evidence_hash: candidate.evidence_hash,
      extraction_rule: candidate.extraction_rule,
    };
    if (!existing) {
      // initialize sources array and set as primary
      const withSources = {
        ...candidate,
        sources: [sourceRec],
      };
      entities.push(withSources);
      entityById.set(id, withSources);
      return { added: true };
    }
    // merge: avoid duplicate evidence_hash
    const existingHashes = new Set(existing.sources.map((s) => s.evidence_hash));
    if (!existingHashes.has(sourceRec.evidence_hash)) {
      existing.sources.push(sourceRec);
      // update confidence if higher
      if (typeof candidate.confidence === "number" && candidate.confidence > (existing.confidence || 0)) {
        existing.confidence = candidate.confidence;
      }
      // merge aliases
      const aliasSet = new Set([...(existing.aliases || []), ...(candidate.aliases || [])]);
      existing.aliases = Array.from(aliasSet);
      // status priority: registry_candidate > ambiguous_candidate > rejected_by_rule
      const priority = { registry_candidate: 3, ambiguous_candidate: 2, rejected_by_rule: 1 };
      const existingPr = priority[existing.status] || 0;
      const candPr = priority[candidate.status] || 0;
      if (candPr > existingPr) existing.status = candidate.status;
      // extraction_rule precision: weapon_heading > table_weapon_column > table_name_column > heading > list_item
      const ruleRank = {
        weapon_heading: 6,
        table_weapon_column: 5,
        table_name_column: 4,
        heading: 3,
        list_item: 2,
      };
      const existingRank = ruleRank[existing.extraction_rule] || 0;
      const candRank = ruleRank[candidate.extraction_rule] || 0;
      if (candRank > existingRank) {
        // promote candidate evidence to primary fields
        existing.source_zone_id = candidate.source_zone_id;
        existing.source_line_start = candidate.source_line_start;
        existing.source_line_end = candidate.source_line_end;
        existing.evidence_text = candidate.evidence_text;
        existing.evidence_hash = candidate.evidence_hash;
        existing.extraction_rule = candidate.extraction_rule;
      }
      // add warning marker
      existing._warnings = existing._warnings || [];
      if (!existing._warnings.includes("duplicate_entity_evidence_merged")) existing._warnings.push("duplicate_entity_evidence_merged");
    }
    return { merged: true };
  }

  const zoneKindMap = {
    character_registry_zone: "character",
    ability_weapon_registry_zone: "weapon",
    world_core: "organization",
  };

  // Zones explicitly excluded from entity extraction
  const excludedZones = new Set([
    "canon_progress_zone",
    "longline_boundary_zone",
    "governance_rules_zone",
    "r0_formal_boundary",
    "formal_setting_layer_header",
    "setting_principles",
  ]);

  const weaponForbiddenHeadings = [
    "能力本質",
    "啟動條件",
    "主要招式",
    "代表技能",
    "反制方式",
    "弱點與代價",
    "不成立事項",
    "一句話定義",
    "未支付技能方向資料位置",
    "基本資料",
    "性格與關聯",
    "能力設定",
    "限制與不成立事項",
  ];

  const nonEntityTokens = [
    "第三層",
    "第四層",
    "正式資料處理規則",
    "R1",
    "R2",
    "R3",
    "R4",
    "正式結算",
    "防誤寫",
    "章",
    "v4.",
    "能力本質",
    "啟動條件",
    "主要招式",
  ];

  for (const zone of canonPreview.zones) {
    if (excludedZones.has(zone.id)) continue;
    const kindHint = zoneKindMap[zone.id] || null;
    const content = zone.content;
    const lines = normalizeLf(content).split("\n");
    // table detection
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // heading
      const heading = extractFromHeading(line);
      if (heading) {
        const displayRaw = heading.replace(/^\*+|\*+$/g, "");
        const display = normalizeDisplayName(displayRaw);
        // reject obvious non-entity headings
        if (nonEntityTokens.some((t) => display.includes(t))) continue;

        // Zone-based enforcement
        if (zone.id === "character_registry_zone") {
          // allow headings as characters only
          const kind = "character";
          const status = chooseStatusFromEvidence(line);
          const entityId = makeEntityId(kind, display, zone.id);
          const evText = line;
          const evidHash = evidenceHash(evText);
          const entity = {
            entity_id: entityId,
            kind,
            display_name: display,
            aliases: [],
            status,
            confidence: 0.9,
            source_zone_id: zone.id,
            source_path: canonPreview.source_path,
            source_sha256_lf: canonPreview.source_sha256_lf,
            source_line_start: zone.start_line + i,
            source_line_end: zone.start_line + i,
            evidence_text: evText,
            evidence_hash: evidHash,
            extraction_rule: "heading",
            canon_write_allowed: false,
            approval_required_for_canon_change: true,
          };
          if (!seenEvidence.has(evidHash)) {
            addOrMergeEntity(entity);
            seenEvidence.set(evidHash, entityId);
          }
        } else if (zone.id === "ability_weapon_registry_zone") {
          // weapon headings must include 《...》 and mention 武裝 or 異能武裝
          const m = display.match(/《(.+?)》/u);
          const mentionsWeapon = /武裝|異能武裝|武器/u.test(display);
          const headingLower = display.toLowerCase();
          if (m && mentionsWeapon && !weaponForbiddenHeadings.some((f) => display.includes(f))) {
            const weaponName = m[1].trim();
            const kind = "weapon";
            const showName = weaponName.startsWith("《") ? weaponName : weaponName;
            const entityId = makeEntityId(kind, showName, zone.id);
            const evText = line;
            const evidHash = evidenceHash(evText);
            const entity = {
              entity_id: entityId,
              kind,
              display_name: showName,
              aliases: [display],
              status: chooseStatusFromEvidence(line),
              confidence: 0.9,
              source_zone_id: zone.id,
              source_path: canonPreview.source_path,
              source_sha256_lf: canonPreview.source_sha256_lf,
              source_line_start: zone.start_line + i,
              source_line_end: zone.start_line + i,
              evidence_text: evText,
              evidence_hash: evidHash,
              extraction_rule: "weapon_heading",
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
            };
            if (!seenEvidence.has(evidHash)) {
              addOrMergeEntity(entity);
              seenEvidence.set(evidHash, entityId);
            }
          }
        } else if (zone.id === "world_core") {
          // possible organization or location if heading contains keywords
          const orgKeywords = /組織|聯域|分局|局|學院|學院區|區|市|站|團|機構|局/u;
          const locKeywords = /市|區|站|院區|學院區|城|島|領域|區域|站/u;
          if (orgKeywords.test(display)) {
            const kind = "organization";
            const entityId = makeEntityId(kind, display, zone.id);
            const evText = line;
            const evidHash = evidenceHash(evText);
            const entity = {
              entity_id: entityId,
              kind,
              display_name: display,
              aliases: [],
              status: chooseStatusFromEvidence(line),
              confidence: 0.8,
              source_zone_id: zone.id,
              source_path: canonPreview.source_path,
              source_sha256_lf: canonPreview.source_sha256_lf,
              source_line_start: zone.start_line + i,
              source_line_end: zone.start_line + i,
              evidence_text: evText,
              evidence_hash: evidHash,
              extraction_rule: "heading",
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
            };
            if (!seenEvidence.has(evidHash)) {
              addOrMergeEntity(entity);
              seenEvidence.set(evidHash, entityId);
            }
          } else if (locKeywords.test(display)) {
            const kind = "location";
            const entityId = makeEntityId(kind, display, zone.id);
            const evText = line;
            const evidHash = evidenceHash(evText);
            const entity = {
              entity_id: entityId,
              kind,
              display_name: display,
              aliases: [],
              status: chooseStatusFromEvidence(line),
              confidence: 0.8,
              source_zone_id: zone.id,
              source_path: canonPreview.source_path,
              source_sha256_lf: canonPreview.source_sha256_lf,
              source_line_start: zone.start_line + i,
              source_line_end: zone.start_line + i,
              evidence_text: evText,
              evidence_hash: evidHash,
              extraction_rule: "heading",
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
            };
            if (!seenEvidence.has(evidHash)) {
              addOrMergeEntity(entity);
              seenEvidence.set(evidHash, entityId);
            }
          }
        }
        continue;
      }
      // list item — only allow conservative character lists from character_registry_zone
      const item = extractFromListItem(line);
      if (item) {
        if (zone.id === "character_registry_zone") {
          // conservative: reject if contains punctuation indicating description
          if (/[:：\-–—\(\)\[\]，,。]|http/u.test(item)) continue;
          const shortWords = item.split(/\s+/u).length <= 6;
          if (!shortWords) continue;
          const display = normalizeDisplayName(item.replace(/^\*+|\*+$/g, ""));
          if (nonEntityTokens.some((t) => display.includes(t))) continue;
          const kind = "character";
          const status = chooseStatusFromEvidence(item);
          const entityId = makeEntityId(kind, display, zone.id);
          const evText = line;
          const evidHash = evidenceHash(evText);
          const entity = {
            entity_id: entityId,
            kind,
            display_name: display,
            aliases: [],
            status,
            confidence: 0.6,
            source_zone_id: zone.id,
            source_path: canonPreview.source_path,
            source_sha256_lf: canonPreview.source_sha256_lf,
            source_line_start: zone.start_line + i,
            source_line_end: zone.start_line + i,
            evidence_text: evText,
            evidence_hash: evidHash,
            extraction_rule: "list_item",
            canon_write_allowed: false,
            approval_required_for_canon_change: true,
          };
          if (!seenEvidence.has(evidHash)) {
            addOrMergeEntity(entity);
            seenEvidence.set(evidHash, entityId);
          }
        }
        continue;
      }
      // table: detect header with pipes
      if (line.includes("|") && i + 1 < lines.length && lines[i + 1].trim().match(/^\|?\s*-+\s*\|/u)) {
        // gather table rows
        const header = line;
        const rows = [];
        let j = i + 2;
        for (; j < lines.length; j++) {
          const r = lines[j];
          if (!r.includes("|")) break;
          rows.push(r);
        }
        // Table extraction conservative by zone
        if (zone.id === "character_registry_zone") {
          const values = extractTableColumn(header, rows, ["name", "名稱", "角色"]);
          for (let k = 0; k < values.length; k++) {
            const v = values[k];
            if (!v) continue;
            const display = normalizeDisplayName(v.replace(/^\*+|\*+$/g, ""));
            if (nonEntityTokens.some((t) => display.includes(t))) continue;
            const kind = "character";
            const status = chooseStatusFromEvidence(v);
            const entityId = makeEntityId(kind, display, zone.id);
            const rowIndex = i + 2 + k;
            const evText = rows[k] ?? v;
            const evidHash = evidenceHash(evText);
            const entity = {
              entity_id: entityId,
              kind,
              display_name: display,
              aliases: [],
              status,
              confidence: 0.75,
              source_zone_id: zone.id,
              source_path: canonPreview.source_path,
              source_sha256_lf: canonPreview.source_sha256_lf,
              source_line_start: zone.start_line + rowIndex,
              source_line_end: zone.start_line + rowIndex,
              evidence_text: evText,
              evidence_hash: evidHash,
              extraction_rule: "table_name_column",
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
            };
            if (!seenEvidence.has(evidHash)) {
              addOrMergeEntity(entity);
              seenEvidence.set(evidHash, entityId);
            }
          }
        } else if (zone.id === "ability_weapon_registry_zone") {
          const headerLower = header.toLowerCase();
          if (/武裝|weapon|武器/u.test(headerLower)) {
            const values = extractTableColumn(header, rows, ["武裝", "weapon", "名稱", "name"]);
            for (let k = 0; k < values.length; k++) {
              const v = values[k];
              if (!v) continue;
              const m = v.match(/《(.+?)》/u);
              if (!m) continue;
              const display = normalizeDisplayName(m[1]);
              const kind = "weapon";
              const entityId = makeEntityId(kind, display, zone.id);
              const rowIndex = i + 2 + k;
              const evText = rows[k] ?? v;
              const evidHash = evidenceHash(evText);
              const entity = {
                entity_id: entityId,
                kind,
                display_name: display,
                aliases: [v],
                status: chooseStatusFromEvidence(v),
                confidence: 0.75,
                source_zone_id: zone.id,
                source_path: canonPreview.source_path,
                source_sha256_lf: canonPreview.source_sha256_lf,
                source_line_start: zone.start_line + rowIndex,
                source_line_end: zone.start_line + rowIndex,
                evidence_text: evText,
                evidence_hash: evidHash,
                extraction_rule: "table_weapon_column",
                canon_write_allowed: false,
                approval_required_for_canon_change: true,
              };
              if (!seenEvidence.has(evidHash)) {
                addOrMergeEntity(entity);
                seenEvidence.set(evidHash, entityId);
              }
            }
          }
        } else if (zone.id === "world_core") {
          // extract explicit organization/location columns
          const headerLower = header.toLowerCase();
          if (/組織|organization|地點|location|名稱|name/u.test(headerLower)) {
            const values = extractTableColumn(header, rows, ["組織", "organization", "地點", "location", "名稱", "name"]);
            for (let k = 0; k < values.length; k++) {
              const v = values[k];
              if (!v) continue;
              const display = normalizeDisplayName(v);
              const orgKeywords = /組織|聯域|分局|局|學院|團|機構/u;
              const locKeywords = /市|區|站|院區|學院區|城|島|領域|區域/u;
              if (orgKeywords.test(display)) {
                const kind = "organization";
                const entityId = makeEntityId(kind, display, zone.id);
                const rowIndex = i + 2 + k;
                const evText = rows[k] ?? v;
                const evidHash = evidenceHash(evText);
                const entity = {
                  entity_id: entityId,
                  kind,
                  display_name: display,
                  aliases: [],
                  status: chooseStatusFromEvidence(v),
                  confidence: 0.75,
                  source_zone_id: zone.id,
                  source_path: canonPreview.source_path,
                  source_sha256_lf: canonPreview.source_sha256_lf,
                  source_line_start: zone.start_line + rowIndex,
                  source_line_end: zone.start_line + rowIndex,
                  evidence_text: evText,
                  evidence_hash: evidHash,
                  extraction_rule: "table_name_column",
                  canon_write_allowed: false,
                  approval_required_for_canon_change: true,
                };
                if (!seenEvidence.has(evidHash)) {
                  addOrMergeEntity(entity);
                  seenEvidence.set(evidHash, entityId);
                }
              } else if (locKeywords.test(display)) {
                const kind = "location";
                const entityId = makeEntityId(kind, display, zone.id);
                const rowIndex = i + 2 + k;
                const evText = rows[k] ?? v;
                const evidHash = evidenceHash(evText);
                const entity = {
                  entity_id: entityId,
                  kind,
                  display_name: display,
                  aliases: [],
                  status: chooseStatusFromEvidence(v),
                  confidence: 0.75,
                  source_zone_id: zone.id,
                  source_path: canonPreview.source_path,
                  source_sha256_lf: canonPreview.source_sha256_lf,
                  source_line_start: zone.start_line + rowIndex,
                  source_line_end: zone.start_line + rowIndex,
                  evidence_text: evText,
                  evidence_hash: evidHash,
                  extraction_rule: "table_name_column",
                  canon_write_allowed: false,
                  approval_required_for_canon_change: true,
                };
                if (!seenEvidence.has(evidHash)) {
                  addOrMergeEntity(entity);
                  seenEvidence.set(evidHash, entityId);
                }
              }
            }
          }
        }
        i = j - 1;
      }
    }
  }

  const counts = {};
  for (const k of config.entity_kinds) counts[k] = 0;
  for (const e of entities) {
    if (!counts[e.kind]) counts[e.kind] = 0;
    counts[e.kind] += 1;
  }

  const preview = {
    schema_version: config.schema_version,
    mode: config.mode,
    read_only: true,
    source_path: canonPreview.source_path,
    source_sha256_lf: canonPreview.source_sha256_lf,
    expected_sha256_lf: config.expected_sha256_lf,
    hash_matches: canonPreview.source_sha256_lf === config.expected_sha256_lf,
    canon_zones_source: {
      zone_count: canonPreview.zones.length,
      roundtrip_matches_source: canonPreview.roundtrip_matches_source,
    },
    entity_count: entities.length,
    entity_counts_by_kind: counts,
    entities,
    warnings: canonPreview.warnings ?? [],
    blocking_warnings: canonPreview.blocking_warnings ?? [],
    canon_write_allowed: false,
    approval_required_for_canon_change: true,
  };

  return preview;
}

export function compileEntityRegistrySummary(preview) {
  requireObject(preview, "entity registry preview");
  return {
    source_path: preview.source_path,
    source_sha256_lf: preview.source_sha256_lf,
    expected_sha256_lf: preview.expected_sha256_lf,
    hash_matches: preview.hash_matches,
    canon_zones_source: preview.canon_zones_source,
    entity_count: preview.entity_count,
    entity_counts_by_kind: preview.entity_counts_by_kind,
    warnings: preview.warnings,
    blocking_warnings: preview.blocking_warnings,
  };
}

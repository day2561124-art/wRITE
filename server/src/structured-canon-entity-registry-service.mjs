import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { buildEntityRegistryPreview } from "./entity-registry-preview-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";
import {
  buildMedicalContinuitySnapshot,
  medicalStatusSummary,
} from "./medical-continuity-service.mjs";

export const entityTypes = Object.freeze([
  "characters",
  "abilities",
  "weapons",
  "timeline_events",
  "world_rules",
  "organizations",
  "locations",
  "chapter_events",
  "relationships",
  "status_effects",
]);
export const entityStatuses = Object.freeze([
  "canon", "candidate", "pending", "deprecated", "conflict", "unknown",
]);
const singularTypes = Object.freeze({
  characters: "character",
  abilities: "ability",
  weapons: "weapon",
  timeline_events: "timeline_event",
  world_rules: "world_rule",
  organizations: "organization",
  locations: "location",
  chapter_events: "chapter_event",
  relationships: "relationship",
  status_effects: "status_effect",
});
const idPrefixes = Object.freeze({
  character: "CHAR",
  ability: "ABILITY",
  weapon: "WEAPON",
  timeline_event: "TL",
  world_rule: "RULE",
  organization: "ORG",
  location: "LOC",
  chapter_event: "CHAPTER-EVENT",
  relationship: "REL",
  status_effect: "STATUS",
});
const candidatePattern = /候選|未採用|草案|骨架|未支付|暫定|fixture|ui[_-]?test|e2e|demo/iu;
const highRiskPattern = /死亡|長期失能|重大能力突破|代表資格|主角身份|階級突破|時間線重大/iu;
const schemaVersion = 1;

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeLf(value) {
  return String(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

export function normalizeEntityName(value) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/[《》「」『』【】（）()[\]{}]/gu, " ")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .toLowerCase();
  return normalized || "unnamed";
}

export function createDeterministicEntityId(entityType, canonicalName, sourceAnchor = "") {
  const prefix = idPrefixes[entityType];
  if (!prefix) throw new Error(`Unknown entity_type: ${entityType}`);
  const normalized = normalizeEntityName(canonicalName).slice(0, 48);
  const shortHash = sha256(`${entityType}|${canonicalName}|${sourceAnchor}`).slice(0, 10);
  return `${prefix}-${normalized}-${shortHash}`.toUpperCase();
}

async function hashDirectory(directory) {
  const records = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) {
        records.push(`${normalizeProjectPath(fullPath)}:${sha256(await readFile(fullPath))}`);
      }
    }
  }
  await walk(directory);
  return sha256(records.join("\n"));
}

function rootsFor(options = {}) {
  const registryRoot = options.registryRoot
    ? assertPathInside(options.registryRoot, projectPaths.entityRegistry, "entity registry test root")
    : projectPaths.entityRegistry;
  return {
    root: registryRoot,
    registry: path.join(registryRoot, "entity_registry.json"),
    index: path.join(registryRoot, "entity_registry.index.json"),
    schema: path.join(registryRoot, "entity_registry.schema.json"),
    buildReport: path.join(registryRoot, "entity_registry_build_report.json"),
    conflicts: path.join(registryRoot, "conflict_report.json"),
    provenance: path.join(registryRoot, "provenance.json"),
  };
}

function parseSections(markdown) {
  const sections = [];
  let current = null;
  const lines = normalizeLf(markdown).split("\n");
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^(#{1,6})\s+(.+)$/u);
    if (match) {
      if (current) sections.push(current);
      current = {
        title: match[2].trim(),
        level: match[1].length,
        startLine: index + 1,
        lines: [],
      };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections.map((section, index) => ({
    ...section,
    endLine: sections[index + 1]?.startLine ? sections[index + 1].startLine - 1 : lines.length,
    content: section.lines.join("\n").trim(),
  }));
}

function sectionAnchor(section) {
  return `L${section.startLine}-L${section.endLine}`;
}

function baseEntity(type, name, section, hashes, extras = {}) {
  const excerpt = String(extras.sourceExcerpt ?? section.content ?? section.title)
    .slice(0, extras.sourceExcerptLimit ?? 1_500);
  const status = extras.status ?? (candidatePattern.test(`${section.title}\n${excerpt}`) ? "candidate" : "canon");
  const riskLevel = extras.riskLevel ?? (highRiskPattern.test(`${section.title}\n${excerpt}`) ? "P0" : "P2");
  const anchor = extras.sourceAnchor ?? sectionAnchor(section);
  const timestamp = hashes.source_modified_at;
  return {
    entity_id: extras.entityId ?? createDeterministicEntityId(type, name, anchor),
    entity_type: type,
    canonical_name: name,
    aliases: extras.aliases ?? [],
    status,
    source_tier: status === "canon" ? "T1 canon" : "T7 candidate",
    source_file: extras.sourceFile ?? "data/canon_db/active_engine.md",
    source_section: section.title,
    source_anchor: anchor,
    source_excerpt: excerpt,
    related_chapters: extras.relatedChapters ?? [],
    related_characters: extras.relatedCharacters ?? [],
    related_entities: extras.relatedEntities ?? [],
    risk_level: riskLevel,
    confidence: extras.confidence ?? 0.85,
    provenance: {
      extraction_rule: extras.extractionRule ?? "section",
      derived_registry: true,
      canon_write_allowed: false,
      ...(extras.provenance ?? {}),
    },
    active_engine_hash_at_build: hashes.active_engine_hash,
    canon_db_hash_at_build: hashes.canon_db_hash,
    compressed_rules_hash_at_build: hashes.compressed_rules_hash,
    created_at: extras.sourceModifiedAt ?? timestamp,
    updated_at: extras.sourceModifiedAt ?? timestamp,
    ...extras.fields,
  };
}

function tableRows(section) {
  const lines = section.lines;
  const tables = [];
  for (let index = 0; index < lines.length - 2; index += 1) {
    if (!lines[index].includes("|") || !/^\s*\|?\s*:?-+/u.test(lines[index + 1])) continue;
    const headers = lines[index].split("|").map((item) => item.trim()).filter(Boolean);
    const rows = [];
    let cursor = index + 2;
    while (cursor < lines.length && lines[cursor].includes("|")) {
      const cells = lines[cursor].split("|").map((item) => item.trim()).filter(Boolean);
      if (cells.length) rows.push(Object.fromEntries(headers.map((header, cell) => [header, cells[cell] ?? ""])));
      cursor += 1;
    }
    tables.push({ headers, rows, lineOffset: index });
    index = cursor - 1;
  }
  return tables;
}

const formalEntitySourceNamePattern = /^entity_[a-z0-9_]+\.md$/u;
const formalEntityHeadingPattern = /^(character|weapon|ability)｜(.+?)｜([a-z][a-z0-9_]*)$/u;

function semicolonList(value) {
  return [...new Set(String(value ?? "")
    .split(/[；;]/u)
    .map((item) => item.trim())
    .filter(Boolean))];
}

function formalEntityFields(section) {
  const table = tableRows(section).find((candidate) => (
    candidate.headers.some((header) => /^欄位$/u.test(header))
    && candidate.headers.some((header) => /正式\s*Canon/iu.test(header))
  ));
  if (!table) return null;
  const fields = new Map();
  for (const row of table.rows) {
    const key = firstValue(row, [/^欄位$/u]);
    const value = firstValue(row, [/正式\s*Canon/iu]);
    if (key) fields.set(key, value);
  }
  return fields;
}

function canonField(fields, ...names) {
  for (const name of names) {
    const value = fields.get(name);
    if (value !== undefined) return value;
  }
  return "";
}

function formalGender(value) {
  if (/^男/u.test(String(value ?? ""))) return "male";
  if (/^女/u.test(String(value ?? ""))) return "female";
  return null;
}

function formalPronouns(gender) {
  if (gender === "male") return { third_person: "他", second_person: "你", resolved: true };
  if (gender === "female") return { third_person: "她", second_person: "妳", resolved: true };
  return { third_person: null, second_person: null, resolved: false };
}

async function readFormalCanonEntitySources(options = {}) {
  if (Array.isArray(options.formalCanonSources)) return options.formalCanonSources;
  const sourceRoot = options.formalCanonSourceRoot ?? projectPaths.canonSources;
  const entries = await readdir(sourceRoot, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  return Promise.all(entries
    .filter((entry) => entry.isFile() && formalEntitySourceNamePattern.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(async (entry) => {
      const filePath = path.join(sourceRoot, entry.name);
      const [content, sourceStat] = await Promise.all([
        readFile(filePath, "utf8"),
        stat(filePath),
      ]);
      return {
        content,
        source_file: normalizeProjectPath(filePath),
        source_hash: sha256(content),
        source_modified_at: sourceStat.mtime.toISOString(),
      };
    }));
}

function parseFormalCanonEntitySources(sources, hashes) {
  const buckets = { characters: [], abilities: [], weapons: [] };
  const seenEntityIds = new Map();
  for (const source of sources) {
    const sourceLabel = source.source_file ?? "unknown entity source";
    const entitySections = parseSections(source.content).filter((section) => (
      /^(?:character|weapon|ability)｜/u.test(section.title)
    ));
    if (!entitySections.length) {
      throw new Error(
        `Invalid formal Canon entity source ${sourceLabel}: no character, weapon, or ability entity headings.`,
      );
    }
    for (const section of entitySections) {
      const heading = formalEntityHeadingPattern.exec(section.title);
      if (!heading) {
        throw new Error(
          `Invalid formal Canon entity source ${sourceLabel} at line ${section.startLine}: malformed entity heading.`,
        );
      }
      const [, entityType, headingName, entityId] = heading;
      if (!entityId.startsWith(`${entityType}_`)) {
        throw new Error(
          `Invalid formal Canon entity source ${sourceLabel} at line ${section.startLine}: ${entityId} must use the ${entityType}_ prefix.`,
        );
      }
      const previousSource = seenEntityIds.get(entityId);
      if (previousSource) {
        throw new Error(
          `Duplicate formal Canon entity ID ${entityId} in ${sourceLabel}; already declared in ${previousSource}.`,
        );
      }
      seenEntityIds.set(entityId, sourceLabel);
      const fields = formalEntityFields(section);
      if (!fields) {
        throw new Error(
          `Invalid formal Canon entity source ${sourceLabel} at line ${section.startLine}: missing 欄位 / 正式 Canon table.`,
        );
      }
      const aliases = semicolonList(canonField(fields, "搜尋別名"));
      const sourceExcerpt = `## ${section.title}\n\n${section.content}`;
      const common = {
        entityId,
        aliases,
        sourceFile: source.source_file,
        sourceModifiedAt: source.source_modified_at,
        sourceExcerpt,
        sourceExcerptLimit: 12_000,
        extractionRule: "formal_canon_entity_source",
        confidence: 1,
        provenance: {
          source_hash: source.source_hash,
          formal_canon_source: true,
          source_scope: "second_layer_formal_setting",
        },
      };
      if (entityType === "character") {
        const canonicalName = canonField(fields, "中文名") || headingName;
        const gender = formalGender(canonField(fields, "性別"));
        const affiliation = canonField(fields, "所屬組織", "所屬");
        const position = canonField(fields, "職位");
        const department = canonField(fields, "部門");
        const age = canonField(fields, "年齡");
        const height = canonField(fields, "身高");
        const appearanceFacts = semicolonList(canonField(fields, "外貌"));
        const personalityFacts = semicolonList(canonField(fields, "性格"));
        const teachingPrinciples = semicolonList(canonField(fields, "教學重點"));
        const combatStyle = semicolonList(canonField(fields, "戰鬥風格"));
        const speechConstraints = semicolonList(canonField(fields, "說話與教學限制"));
        const abilityConstraints = semicolonList(canonField(fields, "能力使用限制"));
        const unknownFields = semicolonList(canonField(fields, "未公開或未知"));
        const weaponIds = semicolonList(canonField(fields, "武裝實體 ID"));
        const abilityIds = semicolonList(canonField(fields, "能力實體 ID"));
        const weaponNames = semicolonList(canonField(fields, "異能武裝"))
          .map((name) => name.replace(/[《》]/gu, ""));
        const identityFacts = [age, height, position, department].filter(Boolean);
        const relationshipOrPositionFacts = [position, department].filter(Boolean);
        const usageConstraints = [...speechConstraints, ...abilityConstraints];
        buckets.characters.push(baseEntity("character", canonicalName, section, hashes, {
          ...common,
          fields: {
            formal_name: canonicalName,
            english_name: canonField(fields, "英文名"),
            categories: semicolonList(canonField(fields, "分類")),
            gender,
            gender_canon: canonField(fields, "性別") || null,
            age,
            height,
            identity: identityFacts.join("；"),
            grade: "",
            grade_or_role: position,
            affiliation,
            department,
            position,
            appearance_facts: appearanceFacts,
            personality_facts: personalityFacts,
            teaching_principles: teachingPrinciples,
            combat_style: combatStyle,
            usage_constraints: usageConstraints,
            unknown_fields: unknownFields,
            ability_ids: abilityIds,
            weapon_ids: weaponIds,
            weapon_names: weaponNames,
            current_status: "",
            recent_injuries: [],
            relationships: [],
            development_stage: canonField(fields, "正式階段"),
            source: "formal_canon_entity_source",
            canon_character_grounding: {
              canonical_name: canonicalName,
              source_authority: "formal_canon_source_high_authority",
              source_file: source.source_file,
              source_section: section.title,
              gender,
              gender_canon: canonField(fields, "性別") || null,
              gender_conflict_detected: false,
              pronouns: formalPronouns(gender),
              identity_facts: identityFacts,
              affiliation_facts: affiliation ? [affiliation] : [],
              appearance_facts: appearanceFacts,
              personality_facts: personalityFacts,
              relationship_or_position_facts: relationshipOrPositionFacts,
              teaching_principles: teachingPrinciples,
              combat_style: combatStyle,
              usage_constraints: usageConstraints,
              unknown_fields: unknownFields,
              explicit_body_traits: [],
              provenance: [{
                source_file: source.source_file,
                source_section: section.title,
                source_line: section.startLine,
                record_context: canonicalName,
              }],
            },
          },
        }));
      } else if (entityType === "weapon") {
        const canonicalName = canonField(fields, "正式名稱")
          .replace(/[《》]/gu, "") || headingName;
        const holderName = canonField(fields, "持有者");
        const holderId = canonField(fields, "持有者實體 ID") || null;
        const abilityIds = semicolonList(canonField(fields, "能力實體 ID"));
        buckets.weapons.push(baseEntity("weapon", canonicalName, section, hashes, {
          ...common,
          relatedCharacters: holderName ? [holderName] : [],
          relatedEntities: [holderId, ...abilityIds].filter(Boolean),
          fields: {
            formal_name: canonField(fields, "正式名稱") || `《${canonicalName}》`,
            categories: semicolonList(canonField(fields, "分類")),
            holder_character_id: holderId,
            holder_name: holderName,
            weapon_type: canonField(fields, "分類"),
            manifestation_type: "器具型",
            appearance: canonField(fields, "外形"),
            core_ability: canonField(fields, "核心能力"),
            effects: semicolonList(canonField(fields, "具體效果")),
            confirmed_limits: semicolonList(canonField(fields, "明確限制")),
            forbidden_expansions: semicolonList(canonField(fields, "禁止擴張")),
            unknown_fields: semicolonList(canonField(fields, "未公開或未知")),
            ability_ids: abilityIds,
            ability_relation: canonField(fields, "核心能力"),
            risk_notes: semicolonList(canonField(fields, "禁止擴張")),
          },
        }));
      } else if (entityType === "ability") {
        const canonicalName = canonField(fields, "概念名稱") || headingName;
        const holderName = canonField(fields, "使用者");
        const holderId = canonField(fields, "使用者實體 ID") || null;
        const weaponId = canonField(fields, "來源武裝實體 ID") || null;
        buckets.abilities.push(baseEntity("ability", canonicalName, section, hashes, {
          ...common,
          relatedCharacters: holderName ? [holderName] : [],
          relatedEntities: [holderId, weaponId].filter(Boolean),
          fields: {
            holder_character_ids: holderId ? [holderId] : [],
            holder_name: holderName,
            ability_type: "weapon_ability",
            source_weapon: canonField(fields, "能力來源"),
            essence: canonField(fields, "核心能力"),
            effects: semicolonList(canonField(fields, "具體效果")),
            activation_conditions: semicolonList(canonField(fields, "成立條件")),
            confirmed_limits: semicolonList(canonField(fields, "明確限制")),
            forbidden_normalizations: semicolonList(canonField(fields, "禁止正規化")),
            unknown_fields: semicolonList(canonField(fields, "未公開或未知")),
            development_stage: "依使用者與武裝現行設定",
            related_weapons: weaponId ? [weaponId] : [],
          },
        }));
      }
    }
  }
  return buckets;
}

function selectSupplementalEntities(primary, supplemental) {
  const protectedIds = new Set(primary.map((entity) => entity.entity_id));
  return supplemental.filter((entity) => !protectedIds.has(entity.entity_id));
}

function appendSupplementalEntities(primary, supplemental) {
  return uniqueEntities([...primary, ...selectSupplementalEntities(primary, supplemental)]);
}

function extractReferencedOrganizations(sections, hashes, names) {
  const organizations = [];
  for (const name of [...new Set(names.filter(Boolean))]) {
    for (const section of sections) {
      const lineOffset = section.lines.findIndex((line) => (
        line.includes(`| ${name} |`) || line.includes(`|${name}|`)
      ));
      if (lineOffset < 0) continue;
      const sourceLine = section.startLine + lineOffset + 1;
      organizations.push(baseEntity("organization", name, section, hashes, {
        extractionRule: "referenced_formal_organization_row",
        sourceExcerpt: section.lines[lineOffset].trim(),
        sourceAnchor: `L${sourceLine}-L${sourceLine}`,
        confidence: 1,
        fields: {
          organization_type: /學院/u.test(name) ? "academy" : "organization",
          members: [],
          hierarchy: [],
          related_locations: [],
        },
      }));
      break;
    }
  }
  return uniqueEntities(organizations);
}

function linkFormalCanonEntities(mapped, supplemental) {
  const all = [
    ...mapped.characters,
    ...mapped.weapons,
    ...mapped.organizations,
    ...supplemental.characters,
    ...supplemental.weapons,
    ...supplemental.abilities,
  ];
  const byId = new Map(all.map((entity) => [entity.entity_id, entity]));
  const organizationByName = new Map(
    mapped.organizations.map((entity) => [entity.canonical_name, entity]),
  );
  for (const character of supplemental.characters) {
    const relatedIds = [
      ...(character.weapon_ids ?? []),
      ...(character.ability_ids ?? []),
    ];
    const organization = organizationByName.get(character.affiliation);
    if (organization) {
      relatedIds.push(organization.entity_id);
      organization.members = [...new Set([...(organization.members ?? []), character.entity_id])];
    }
    character.related_entities = [...new Set([
      ...(character.related_entities ?? []),
      ...relatedIds.filter((entityId) => byId.has(entityId)),
    ])];
  }
  for (const weapon of supplemental.weapons) {
    weapon.related_entities = [...new Set((weapon.related_entities ?? []).filter((id) => byId.has(id)))];
  }
  for (const ability of supplemental.abilities) {
    ability.related_entities = [...new Set((ability.related_entities ?? []).filter((id) => byId.has(id)))];
  }
}

function firstValue(row, patterns) {
  for (const [key, value] of Object.entries(row)) {
    if (patterns.some((pattern) => pattern.test(key))) return value;
  }
  return "";
}

function uniqueEntities(items) {
  const byId = new Map();
  for (const item of items) {
    const current = byId.get(item.entity_id);
    if (!current) {
      byId.set(item.entity_id, item);
      continue;
    }
    current.aliases = [...new Set([...current.aliases, ...item.aliases])];
    current.source_excerpt = current.source_excerpt.length >= item.source_excerpt.length
      ? current.source_excerpt
      : item.source_excerpt;
  }
  return [...byId.values()].sort((left, right) => (
    left.entity_id.localeCompare(right.entity_id, "zh-Hant")
  ));
}

function extractWorldRules(sections, hashes) {
  return sections
    .filter((section) => /^2\./u.test(section.title) && section.level >= 3 && !candidatePattern.test(section.title))
    .map((section) => baseEntity("world_rule", section.title.replace(/^\d+(?:\.\d+)*[｜.\s]*/u, ""), section, hashes, {
      extractionRule: "world_rule_section",
      fields: {
        category: section.title.split(/[｜.]/u)[1]?.trim() || "general",
        rule_title: section.title,
        rule_text: section.content,
        constraints: section.lines.filter((line) => /不得|必須|限制|只/u.test(line)).slice(0, 20),
        forbidden_usage: section.lines.filter((line) => /不得|禁止/u.test(line)).slice(0, 20),
      },
    }));
}

function extractTimelineAndChapterEvents(sections, hashes) {
  const timeline = [];
  const chapterEvents = [];
  for (const section of sections.filter(
    (item) => item.level >= 2 && /^第[一二三四五六七八九十百\d]+章/u.test(item.title),
  )) {
    if (candidatePattern.test(section.title)) continue;
    const chapterMatch = section.title.match(/第([一二三四五六七八九十百\d]+)章/u);
    const chapterId = chapterMatch?.[0] ?? section.title;
    const fields = {
      timeline_position: chapterId,
      week: section.content.match(/四月第[一二三四五六七八九十]+週/u)?.[0] ?? "",
      date_label: section.content.match(/星期[一二三四五六日天]/u)?.[0] ?? "",
      event_title: section.title,
      event_summary: section.content.slice(0, 1_500),
      participants: [],
      result: section.lines.find((line) => /結果|勝出|完成|成立/u.test(line)) ?? "",
      source_chapter: chapterId,
      settled: /正式結算|已結算/u.test(`${section.title}\n${section.content}`),
    };
    timeline.push(baseEntity("timeline_event", section.title, section, hashes, {
      extractionRule: "chapter_timeline_section",
      relatedChapters: [chapterId],
      fields,
    }));
    chapterEvents.push(baseEntity("chapter_event", section.title, section, hashes, {
      extractionRule: "chapter_event_section",
      relatedChapters: [chapterId],
      fields: {
        chapter_id: chapterId,
        chapter_title: section.title,
        event_order: chapterEvents.length + 1,
        event_summary: fields.event_summary,
        participants: [],
        canon_effects: section.lines.filter((line) => /成立|結果|狀態|限制/u.test(line)).slice(0, 20),
        settlement_status: fields.settled ? "settled" : "recorded",
      },
    }));
  }
  return { timeline, chapterEvents };
}

function extractAbilities(sections, hashes, characterNameToId, weaponNameToId) {
  const abilities = [];
  for (const section of sections.filter((item) => /能力卡|能力體系|能力本質/u.test(item.title))) {
    if (candidatePattern.test(section.title) || section.title.includes("未支付")) continue;
    for (const table of tableRows(section)) {
      for (const row of table.rows) {
        const holder = firstValue(row, [/^角色$/u, /持有者/u]);
        const essence = firstValue(row, [/能力本質/u, /本質/u, /定位/u]);
        if (!holder && !essence) continue;
        const name = essence
          ? `${holder || section.title}｜${essence.slice(0, 80)}`
          : section.title;
        const holderId = characterNameToId.get(holder) ?? null;
        const weaponText = firstValue(row, [/異能武裝/u, /武裝/u]);
        const weaponId = [...weaponNameToId.entries()]
          .find(([weaponName]) => weaponText.includes(weaponName))?.[1] ?? null;
        abilities.push(baseEntity("ability", name, section, hashes, {
          extractionRule: "ability_table",
          sourceExcerpt: JSON.stringify(row),
          relatedCharacters: holder ? [holder] : [],
          relatedEntities: [holderId, weaponId].filter(Boolean),
          fields: {
            holder_character_ids: holderId ? [holderId] : [],
            ability_type: "innate",
            essence: essence || section.content.slice(0, 500),
            confirmed_limits: Object.entries(row)
              .filter(([key]) => /限制|代價|不可/u.test(key))
              .map(([, value]) => value),
            forbidden_breakthroughs: section.lines.filter((line) => /不得.*突破|不得.*成熟|未支付/u.test(line)).slice(0, 20),
            development_stage: firstValue(row, [/正式階段/u, /階段/u]) || "未指定",
            related_weapons: weaponId ? [weaponId] : [],
          },
        }));
      }
    }
  }
  if (!abilities.length) {
    const section = sections.find((item) => item.title.includes("能力體系"));
    if (section) {
      abilities.push(baseEntity("ability", section.title, section, hashes, {
        extractionRule: "ability_section_fallback",
        fields: {
          holder_character_ids: [],
          ability_type: "system",
          essence: section.content.slice(0, 1_000),
          confirmed_limits: section.lines.filter((line) => /限制|不得/u.test(line)).slice(0, 20),
          forbidden_breakthroughs: [],
          development_stage: "未指定",
          related_weapons: [],
        },
      }));
    }
  }
  return uniqueEntities(abilities);
}

function mapPreviewEntities(preview, sections, hashes) {
  const buckets = {
    characters: [], weapons: [], organizations: [], locations: [],
  };
  for (const item of preview.entities) {
    const bucket = {
      character: "characters",
      weapon: "weapons",
      organization: "organizations",
      location: "locations",
    }[item.kind];
    if (!bucket) continue;
    if (
      item.kind === "character"
      && (
        /^\d+(?:\.\d+)*\s/u.test(item.display_name)
        || /正式名單|平等邊界|角色設定|學生角色|能力卡/u.test(item.display_name)
      )
    ) continue;
    const section = sections.find((candidate) => (
      item.source_line_start >= candidate.startLine && item.source_line_start <= candidate.endLine
    )) ?? {
      title: item.source_zone_id,
      content: item.evidence_text,
      startLine: item.source_line_start,
      endLine: item.source_line_end,
    };
    const type = singularTypes[bucket];
    const common = {
      aliases: item.aliases ?? [],
      confidence: item.confidence,
      extractionRule: item.extraction_rule,
      sourceExcerpt: item.evidence_text,
      sourceAnchor: `L${item.source_line_start}-L${item.source_line_end}`,
    };
    const fields = type === "character" ? {
      grade: "",
      identity: "",
      affiliation: "",
      ability_ids: [],
      weapon_ids: [],
      current_status: "",
      recent_injuries: [],
      relationships: [],
      source: "active_engine",
    } : type === "weapon" ? {
      holder_character_id: null,
      weapon_type: "",
      manifestation_type: "",
      ability_relation: "",
      confirmed_limits: [],
      risk_notes: [],
    } : type === "organization" ? {
      organization_type: "",
      members: [],
      hierarchy: [],
      related_locations: [],
    } : {
      location_type: "",
      parent_location: null,
      related_events: [],
    };
    buckets[bucket].push(baseEntity(type, item.display_name, section, hashes, {
      ...common,
      fields,
    }));
  }
  for (const key of Object.keys(buckets)) buckets[key] = uniqueEntities(buckets[key]);
  return buckets;
}

function extractRelationships(sections, hashes, characterNameToId) {
  const section = sections.find((item) => item.title.startsWith("4."));
  if (!section) return [];
  const names = [...characterNameToId.keys()];
  const relationships = [];
  for (const line of section.lines.filter((item) => item.trim())) {
    const found = names.filter((name) => line.includes(name)).slice(0, 2);
    if (found.length !== 2 || candidatePattern.test(line)) continue;
    relationships.push(baseEntity("relationship", `${found[0]}-${found[1]}`, section, hashes, {
      extractionRule: "relationship_line",
      sourceExcerpt: line,
      relatedCharacters: found,
      relatedEntities: found.map((name) => characterNameToId.get(name)),
      fields: {
        subject_entity_id: characterNameToId.get(found[0]),
        object_entity_id: characterNameToId.get(found[1]),
        relationship_type: "documented",
        description: line,
        source_chapters: [],
      },
    }));
  }
  if (!relationships.length) {
    for (const row of tableRows(section).flatMap((table) => table.rows)) {
      const text = Object.values(row).join("｜");
      const found = names.filter((name) => text.includes(name)).slice(0, 2);
      if (found.length !== 2 || candidatePattern.test(text)) continue;
      relationships.push(baseEntity("relationship", `${found[0]}-${found[1]}`, section, hashes, {
        extractionRule: "relationship_table",
        sourceExcerpt: text,
        relatedCharacters: found,
        relatedEntities: found.map((name) => characterNameToId.get(name)),
        fields: {
          subject_entity_id: characterNameToId.get(found[0]),
          object_entity_id: characterNameToId.get(found[1]),
          relationship_type: "documented",
          description: text,
          source_chapters: [],
        },
      }));
    }
  }
  return uniqueEntities(relationships);
}

function extractStatusEffects(sections, hashes, characterNameToId) {
  const results = [];
  for (const section of sections) {
    for (const line of section.lines) {
      if (!/傷勢|失能|限制|負荷|複查|換藥/u.test(line) || candidatePattern.test(line)) continue;
      const character = [...characterNameToId.keys()].find((name) => line.includes(name));
      if (!character) continue;
      results.push(baseEntity("status_effect", `${character}-${line.slice(0, 48)}`, section, hashes, {
        extractionRule: "status_effect_line",
        sourceExcerpt: line,
        relatedCharacters: [character],
        relatedEntities: [characterNameToId.get(character)],
        fields: {
          target_character_id: characterNameToId.get(character),
          effect_type: /失能/u.test(line) ? "disability" : /傷/u.test(line) ? "injury" : "restriction",
          description: line,
          start_chapter: section.title.match(/第.+?章/u)?.[0] ?? "",
          expected_duration: /短期/u.test(line) ? "short_term" : "unspecified",
          resolved: /結案|清除|解除/u.test(line),
          source: "active_engine",
        },
      }));
    }
  }
  return uniqueEntities(results);
}

function extractNormalizedMedicalStatuses(
  sections,
  hashes,
  characterNameToId,
  medicalSnapshot,
) {
  const results = [];
  for (const status of medicalSnapshot.character_statuses ?? []) {
    const characterId = characterNameToId.get(status.character);
    if (!characterId) continue;
    const evidence = status.evidence?.[0] ?? status.missing_evidence?.[0] ?? {};
    const matchedLine = evidence.matched_line ?? evidence.match ?? status.character;
    const section = sections.find((item) => (
      item.content.includes(matchedLine)
      || item.title === evidence.source_section
    )) ?? {
      title: evidence.source_section || "現行正式狀態",
      startLine: 1,
      endLine: 1,
      content: matchedLine,
      lines: [matchedLine],
    };
    const activeRestrictionCount = status.active_restrictions?.length ?? 0;
    const resolved = activeRestrictionCount === 0
      && /recovered|no_active|stable_without_active/u.test(status.current_physical_status);
    results.push(baseEntity(
      "status_effect",
      `${status.character}-current-medical-status`,
      section,
      hashes,
      {
        extractionRule: "medical_continuity_normalizer",
        sourceExcerpt: matchedLine,
        relatedCharacters: [status.character],
        relatedEntities: [characterId],
        riskLevel: status.exception_reason === "excluded_from_ordinary_cleanup" ? "P1" : "P2",
        fields: {
          target_character_id: characterId,
          effect_type: "normalized_medical_status",
          description: medicalStatusSummary(status),
          state_model_version: status.state_model_version,
          status_id: status.status_id,
          injury_history: status.injury_history,
          current_physical_status: status.current_physical_status,
          current_spiritual_status: status.current_spiritual_status,
          injury_class: status.injury_class,
          affected_body_parts: status.affected_body_parts,
          severity: status.severity,
          treatment_completed: status.treatment_completed,
          treatment_method: status.treatment_method,
          active_restrictions: status.active_restrictions,
          follow_up_required: status.follow_up_required,
          follow_up_result: status.follow_up_result,
          daily_activity_clearance: status.daily_activity_clearance,
          low_load_training_clearance: status.low_load_training_clearance,
          training_clearance: status.training_clearance,
          competition_clearance: status.competition_clearance,
          weapon_summon_clearance: status.weapon_summon_clearance,
          high_load_manifestation_clearance: status.high_load_manifestation_clearance,
          weapon_control_impact: status.weapon_control_impact,
          expected_recovery_window: status.expected_recovery_window,
          special_interference: status.special_interference,
          exception_reason: status.exception_reason,
          status_as_of_chapter: status.status_as_of_chapter,
          last_confirmed_evidence: status.last_confirmed_evidence,
          resolved_at: status.resolved_at,
          resolution_basis: status.resolution_basis,
          historical_consequences: status.historical_consequences,
          injury_history_retained: true,
          active_restrictions_current_only: true,
          clearance_independent: true,
          resolved,
          source: "active_engine_medical_continuity_normalization",
          normalization_provenance: {
            policy_id: medicalSnapshot.policy_id,
            config_path: medicalSnapshot.provenance.config_path,
            config_hash_sha256: medicalSnapshot.provenance.config_hash_sha256,
            evidence_complete: status.evidence_complete,
            missing_evidence: status.missing_evidence,
            direct_canon_write_allowed: false,
          },
        },
      },
    ));
  }
  return results;
}

function conflict(type, severity, entities, summary, evidence, action) {
  return {
    conflict_id: `CONFLICT-${sha256(`${type}|${entities.join("|")}|${summary}`).slice(0, 12).toUpperCase()}`,
    conflict_type: type,
    severity,
    involved_entity_ids: entities,
    summary,
    evidence,
    recommended_action: action,
    requires_human_review: severity === "P0" || severity === "P1",
  };
}

export function detectEntityRegistryConflicts(registry, provenance = registry.provenance ?? {}) {
  const conflicts = [];
  const all = entityTypes.flatMap((type) => registry[type] ?? []);
  for (const entity of all) {
    if (entity.status === "canon" && !String(entity.source_tier).startsWith("T1")) {
      conflicts.push(conflict(
        "non_canon_source_marked_canon",
        "P0",
        [entity.entity_id],
        `${entity.canonical_name} 使用非 T1 來源卻標記 canon。`,
        [entity.source_tier, entity.source_file],
        "降級為 candidate/unknown 並人工檢查來源。",
      ));
    }
    if (entity.status === "canon" && candidatePattern.test(entity.source_excerpt)) {
      conflicts.push(conflict(
        "candidate_mislabeled_canon",
        "P0",
        [entity.entity_id],
        `${entity.canonical_name} 的 evidence 含候選或未採用標記。`,
        [entity.source_excerpt],
        "立即阻擋 canon 顯示並人工審查。",
      ));
    }
  }
  const duplicateGroups = new Map();
  for (const entity of all) {
    const key = `${entity.entity_type}:${normalizeEntityName(entity.canonical_name)}`;
    duplicateGroups.set(key, [...(duplicateGroups.get(key) ?? []), entity]);
  }
  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    conflicts.push(conflict(
      "possible_duplicate_entity",
      "P2",
      group.map((item) => item.entity_id),
      `可能重複 entity：${group[0].canonical_name}`,
      group.map((item) => `${item.source_section} ${item.source_anchor}`),
      "人工合併 alias 或確認為不同 entity。",
    ));
  }
  const characterFacts = new Map();
  for (const character of registry.characters ?? []) {
    const key = normalizeEntityName(character.canonical_name);
    const facts = characterFacts.get(key) ?? { grades: new Set(), identities: new Set(), ids: [] };
    if (character.grade) facts.grades.add(character.grade);
    if (character.identity) facts.identities.add(character.identity);
    facts.ids.push(character.entity_id);
    characterFacts.set(key, facts);
  }
  for (const facts of characterFacts.values()) {
    if (facts.grades.size > 1 || facts.identities.size > 1) {
      conflicts.push(conflict(
        "mutually_exclusive_character_identity",
        "P1",
        facts.ids,
        "同一角色具有互斥年級或身分。",
        [...facts.grades, ...facts.identities],
        "建立設定修改提案並指定唯一正式值。",
      ));
    }
  }
  const abilityGroups = new Map();
  for (const ability of registry.abilities ?? []) {
    const holder = (ability.holder_character_ids ?? []).join("|") || normalizeEntityName(ability.canonical_name);
    abilityGroups.set(holder, [...(abilityGroups.get(holder) ?? []), ability]);
  }
  for (const group of abilityGroups.values()) {
    const essences = new Set(group.map((item) => item.essence).filter(Boolean));
    if (group.length > 1 && essences.size > 1) {
      conflicts.push(conflict(
        "mutually_exclusive_ability_essence",
        "P1",
        group.map((item) => item.entity_id),
        "同一能力持有者具有多個不同能力本質描述。",
        [...essences],
        "人工確認是否為同一能力的 alias 或互斥設定。",
      ));
    }
  }
  const weaponGroups = new Map();
  for (const weapon of registry.weapons ?? []) {
    const key = normalizeEntityName(weapon.canonical_name);
    weaponGroups.set(key, [...(weaponGroups.get(key) ?? []), weapon]);
  }
  for (const group of weaponGroups.values()) {
    const holders = new Set(group.map((item) => item.holder_character_id).filter(Boolean));
    if (holders.size > 1) {
      conflicts.push(conflict(
        "mutually_exclusive_weapon_holder",
        "P1",
        group.map((item) => item.entity_id),
        "同一武裝具有互斥持有者。",
        [...holders],
        "人工確認正式持有者。",
      ));
    }
  }
  const timelineGroups = new Map();
  for (const event of registry.timeline_events ?? []) {
    const key = event.timeline_position || event.week || event.date_label;
    if (!key) continue;
    timelineGroups.set(key, [...(timelineGroups.get(key) ?? []), event]);
  }
  for (const [position, group] of timelineGroups) {
    const results = new Set(group.map((item) => item.result).filter(Boolean));
    if (results.size > 1) {
      conflicts.push(conflict(
        "timeline_result_conflict",
        "P0",
        group.map((item) => item.entity_id),
        `時間線位置 ${position} 存在互斥結果。`,
        [...results],
        "阻擋自動承接並人工確認正式時間線。",
      ));
    }
  }
  if (
    provenance.active_engine_hash
    && all.some((entity) => entity.active_engine_hash_at_build !== provenance.active_engine_hash)
  ) {
    conflicts.push(conflict(
      "registry_source_hash_mismatch",
      "P0",
      [],
      "Registry entity 的 active_engine hash 與 provenance 不一致。",
      [provenance.active_engine_hash],
      "重新建立 preview registry，禁止沿用舊 registry。",
    ));
  }
  return conflicts.sort((left, right) => (
    left.severity.localeCompare(right.severity) || left.conflict_id.localeCompare(right.conflict_id)
  ));
}

export const entityRegistrySchema = Object.freeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "armed-academy://schemas/entity-registry",
  title: "Structured Canon Entity Registry",
  type: "object",
  required: ["schema_version", "registry_mode", ...entityTypes, "provenance"],
  properties: Object.fromEntries([
    ["schema_version", { const: schemaVersion }],
    ["registry_mode", { const: "derived_preview" }],
    ...entityTypes.map((type) => [type, {
      type: "array",
      items: {
        type: "object",
        required: [
          "entity_id", "entity_type", "canonical_name", "aliases", "status", "source_tier",
          "source_file", "source_section", "source_anchor", "source_excerpt",
          "related_chapters", "related_characters", "related_entities", "risk_level",
          "confidence", "provenance", "active_engine_hash_at_build",
          "canon_db_hash_at_build", "compressed_rules_hash_at_build", "created_at", "updated_at",
        ],
      },
    }]),
    ["provenance", { type: "object" }],
  ]),
});

export function validateEntityRegistry(registry) {
  const errors = [];
  if (registry?.schema_version !== schemaVersion) errors.push("schema_version must be 1.");
  if (registry?.registry_mode !== "derived_preview") errors.push("registry_mode must be derived_preview.");
  for (const type of entityTypes) {
    if (!Array.isArray(registry?.[type])) {
      errors.push(`${type} must be an array.`);
      continue;
    }
    for (const entity of registry[type]) {
      for (const field of entityRegistrySchema.properties[type].items.required) {
        if (!(field in entity)) errors.push(`${entity.entity_id ?? type} missing ${field}.`);
      }
      if (!entityStatuses.includes(entity.status)) errors.push(`${entity.entity_id} invalid status.`);
      if (entity.status === "canon" && !String(entity.source_tier).startsWith("T1")) {
        errors.push(`${entity.entity_id} canon entity must use T1 source.`);
      }
    }
  }
  return errors;
}

function buildEntityIndex(registry, generatedAt) {
  const allEntities = entityTypes.flatMap((type) => registry[type] ?? []);
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    entity_count: allEntities.length,
    by_id: Object.fromEntries(allEntities.map((entity) => [
      entity.entity_id,
      {
        entity_type: entity.entity_type,
        canonical_name: entity.canonical_name,
        status: entity.status,
        risk_level: entity.risk_level,
      },
    ])),
    by_type: Object.fromEntries(entityTypes.map((type) => [
      type,
      (registry[type] ?? []).map((entity) => entity.entity_id),
    ])),
  };
}

export async function buildStructuredEntityRegistry(options = {}) {
  const activeEnginePath = options.activeEnginePath ?? projectPaths.activeEngine;
  const compressedRulesPath = options.compressedRulesPath ?? projectPaths.compressedRules;
  const canonDbPath = options.canonDbPath ?? projectPaths.canonDb;
  const [activeEngine, compressedRules, activeStat, preview, formalCanonSources] = await Promise.all([
    readFile(activeEnginePath, "utf8"),
    readFile(compressedRulesPath),
    stat(activeEnginePath),
    options.preview ?? buildEntityRegistryPreview(options.previewOptions ?? {}),
    readFormalCanonEntitySources(options),
  ]);
  const hashes = {
    active_engine_hash: sha256(activeEngine),
    canon_db_hash: await hashDirectory(canonDbPath),
    compressed_rules_hash: sha256(compressedRules),
    source_modified_at: activeStat.mtime.toISOString(),
  };
  const sections = parseSections(activeEngine);
  const mapped = mapPreviewEntities(preview, sections, hashes);
  const supplemental = parseFormalCanonEntitySources(formalCanonSources, hashes);
  const acceptedSupplemental = {
    characters: selectSupplementalEntities(mapped.characters, supplemental.characters),
    weapons: selectSupplementalEntities(mapped.weapons, supplemental.weapons),
    abilities: [],
  };
  mapped.organizations = uniqueEntities([
    ...mapped.organizations,
    ...extractReferencedOrganizations(
      sections,
      hashes,
      acceptedSupplemental.characters.map((character) => character.affiliation),
    ),
  ]);
  mapped.characters = appendSupplementalEntities(mapped.characters, acceptedSupplemental.characters);
  mapped.weapons = appendSupplementalEntities(mapped.weapons, acceptedSupplemental.weapons);
  const characterNameToId = new Map(mapped.characters.map((item) => [item.canonical_name, item.entity_id]));
  const weaponNameToId = new Map(mapped.weapons.map((item) => [item.canonical_name, item.entity_id]));
  const medicalSnapshot = await buildMedicalContinuitySnapshot({
    ...options.medicalContinuityOptions,
    activeEngineText: activeEngine,
    activeEnginePath,
  });
  const activeEngineAbilities = extractAbilities(
    sections,
    hashes,
    characterNameToId,
    weaponNameToId,
  );
  acceptedSupplemental.abilities = selectSupplementalEntities(
    activeEngineAbilities,
    supplemental.abilities,
  );
  linkFormalCanonEntities(mapped, acceptedSupplemental);
  const abilities = appendSupplementalEntities(
    activeEngineAbilities,
    acceptedSupplemental.abilities,
  );
  const { timeline, chapterEvents } = extractTimelineAndChapterEvents(sections, hashes);
  const provenance = {
    registry_mode: "derived_preview",
    source_tier: "T8 derived",
    built_at: hashes.source_modified_at,
    active_engine_hash: hashes.active_engine_hash,
    canon_db_hash: hashes.canon_db_hash,
    compressed_rules_hash: hashes.compressed_rules_hash,
    source_files: [
      "data/canon_db/active_engine.md",
      "data/error_report_db/compressed_rules.md",
      "config/canon-zones.json",
      "config/entity-registry.json",
      medicalSnapshot.provenance.config_path,
      ...formalCanonSources.map((source) => source.source_file),
    ],
    build_warnings: preview.warnings ?? [],
    direct_canon_write_allowed: false,
  };
  const registry = {
    schema_version: schemaVersion,
    registry_mode: "derived_preview",
    read_only: true,
    characters: mapped.characters,
    abilities,
    weapons: mapped.weapons,
    timeline_events: uniqueEntities(timeline),
    world_rules: uniqueEntities(extractWorldRules(sections, hashes)),
    organizations: mapped.organizations,
    locations: mapped.locations,
    chapter_events: uniqueEntities(chapterEvents),
    relationships: extractRelationships(sections, hashes, characterNameToId),
    status_effects: uniqueEntities([
      ...extractStatusEffects(sections, hashes, characterNameToId),
      ...extractNormalizedMedicalStatuses(
        sections,
        hashes,
        characterNameToId,
        medicalSnapshot,
      ),
    ]),
    provenance,
  };
  const conflicts = detectEntityRegistryConflicts(registry, provenance);
  const validationErrors = validateEntityRegistry(registry);
  const allEntities = entityTypes.flatMap((type) => registry[type]);
  const index = buildEntityIndex(registry, provenance.built_at);
  const buildReport = {
    schema_version: schemaVersion,
    status: validationErrors.length ? "failed" : conflicts.some((item) => item.severity === "P0")
      ? "built_with_conflicts"
      : "complete",
    built_at: provenance.built_at,
    deterministic_source_hash: sha256(JSON.stringify({
      active_engine_hash: hashes.active_engine_hash,
      canon_db_hash: hashes.canon_db_hash,
      compressed_rules_hash: hashes.compressed_rules_hash,
    })),
    entity_count: allEntities.length,
    entity_counts_by_type: Object.fromEntries(entityTypes.map((type) => [type, registry[type].length])),
    status_counts: Object.fromEntries(entityStatuses.map((status) => [
      status,
      allEntities.filter((entity) => entity.status === status).length,
    ])),
    conflict_counts: Object.fromEntries(["P0", "P1", "P2"].map((severity) => [
      severity,
      conflicts.filter((item) => item.severity === severity).length,
    ])),
    validation_errors: validationErrors,
    warnings: [
      ...provenance.build_warnings,
      ...medicalSnapshot.warnings,
    ],
    protected_sources_modified: false,
  };
  const conflictReport = {
    schema_version: schemaVersion,
    generated_at: provenance.built_at,
    conflict_count: conflicts.length,
    conflicts,
  };
  return { registry, index, schema: entityRegistrySchema, buildReport, conflictReport, provenance };
}

export async function rebuildStructuredEntityRegistryPreview(options = {}) {
  const roots = rootsFor(options);
  await mkdir(roots.root, { recursive: true });
  const built = await buildStructuredEntityRegistry(options);
  await commitFileTransaction("rebuild-structured-entity-registry-preview", [
    { filePath: roots.registry, content: json(built.registry) },
    { filePath: roots.index, content: json(built.index) },
    { filePath: roots.schema, content: json(built.schema) },
    { filePath: roots.buildReport, content: json(built.buildReport) },
    { filePath: roots.conflicts, content: json(built.conflictReport) },
    { filePath: roots.provenance, content: json(built.provenance) },
  ], {
    phase: "phase_21a_structured_entity_registry",
    registry_mode: "derived_preview",
  });
  return built;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function withFormalCanonSourceOverlay(result, options = {}) {
  const formalCanonSources = await readFormalCanonEntitySources(options);
  if (!formalCanonSources.length) return result;
  const [activeEngine, compressedRules, activeStat] = await Promise.all([
    readFile(options.activeEnginePath ?? projectPaths.activeEngine, "utf8"),
    readFile(options.compressedRulesPath ?? projectPaths.compressedRules),
    stat(options.activeEnginePath ?? projectPaths.activeEngine),
  ]);
  const hashes = {
    active_engine_hash: sha256(activeEngine),
    canon_db_hash: await hashDirectory(options.canonDbPath ?? projectPaths.canonDb),
    compressed_rules_hash: sha256(compressedRules),
    source_modified_at: activeStat.mtime.toISOString(),
  };
  const registry = structuredClone(result.registry);
  const supplemental = parseFormalCanonEntitySources(formalCanonSources, hashes);
  const mapped = {
    characters: registry.characters ?? [],
    weapons: registry.weapons ?? [],
    organizations: registry.organizations ?? [],
  };
  const acceptedSupplemental = {
    characters: selectSupplementalEntities(mapped.characters, supplemental.characters),
    weapons: selectSupplementalEntities(mapped.weapons, supplemental.weapons),
    abilities: selectSupplementalEntities(registry.abilities ?? [], supplemental.abilities),
  };
  mapped.organizations = uniqueEntities([
    ...mapped.organizations,
    ...extractReferencedOrganizations(
      parseSections(activeEngine),
      hashes,
      acceptedSupplemental.characters.map((character) => character.affiliation),
    ),
  ]);
  linkFormalCanonEntities(mapped, acceptedSupplemental);
  registry.characters = appendSupplementalEntities(mapped.characters, acceptedSupplemental.characters);
  registry.weapons = appendSupplementalEntities(mapped.weapons, acceptedSupplemental.weapons);
  registry.abilities = appendSupplementalEntities(
    registry.abilities ?? [],
    acceptedSupplemental.abilities,
  );
  registry.organizations = mapped.organizations;
  const overlayBuiltAt = formalCanonSources
    .map((source) => source.source_modified_at)
    .sort()
    .at(-1) ?? result.provenance?.built_at ?? hashes.source_modified_at;
  const provenance = {
    ...(result.provenance ?? registry.provenance ?? {}),
    canon_db_hash: hashes.canon_db_hash,
    source_files: [...new Set([
      ...(result.provenance?.source_files ?? registry.provenance?.source_files ?? []),
      ...formalCanonSources.map((source) => source.source_file),
    ])],
    formal_canon_source_overlay: true,
    formal_canon_source_overlay_built_at: overlayBuiltAt,
    formal_canon_source_hashes: Object.fromEntries(
      formalCanonSources.map((source) => [source.source_file, source.source_hash]),
    ),
  };
  registry.provenance = provenance;
  const index = buildEntityIndex(registry, overlayBuiltAt);
  const allEntities = entityTypes.flatMap((type) => registry[type] ?? []);
  const buildReport = {
    ...(result.buildReport ?? {}),
    entity_count: allEntities.length,
    entity_counts_by_type: Object.fromEntries(
      entityTypes.map((type) => [type, (registry[type] ?? []).length]),
    ),
    status_counts: Object.fromEntries(entityStatuses.map((status) => [
      status,
      allEntities.filter((entity) => entity.status === status).length,
    ])),
    validation_errors: validateEntityRegistry(registry),
    formal_canon_source_overlay: true,
  };
  return {
    ...result,
    registry,
    index,
    buildReport,
    provenance,
  };
}

export async function getStructuredEntityRegistry(options = {}) {
  const roots = rootsFor(options);
  try {
    const [registry, index, buildReport, conflictReport, provenance] = await Promise.all([
      readJson(roots.registry),
      readJson(roots.index),
      readJson(roots.buildReport),
      readJson(roots.conflicts),
      readJson(roots.provenance),
    ]);
    return withFormalCanonSourceOverlay({
      registry,
      index,
      buildReport,
      conflictReport,
      provenance,
    }, options);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return rebuildStructuredEntityRegistryPreview(options);
  }
}

export async function searchStructuredEntities(input = {}, options = {}) {
  const allowed = new Set(["type", "status", "q", "risk_level", "related_chapter", "related_character", "limit"]);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`Unknown fields: ${unknown.join(", ")}`);
  const limit = input.limit === undefined ? 20 : Number(input.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be 1..100.");
  const { registry, provenance } = await getStructuredEntityRegistry(options);
  const type = String(input.type ?? "");
  const buckets = type
    ? entityTypes.filter((key) => key === type || singularTypes[key] === type)
    : entityTypes;
  const query = String(input.q ?? "").trim().toLocaleLowerCase("zh-Hant");
  const entities = buckets.flatMap((key) => registry[key] ?? []).filter((entity) => {
    if (input.status && entity.status !== input.status) return false;
    if (input.risk_level && entity.risk_level !== input.risk_level) return false;
    if (input.related_chapter && !entity.related_chapters.includes(input.related_chapter)) return false;
    if (input.related_character && !entity.related_characters.includes(input.related_character)
      && !entity.related_entities.includes(input.related_character)) return false;
    if (query) {
      const haystack = [
        entity.canonical_name,
        ...entity.aliases,
        entity.source_excerpt,
      ].join("\n").toLocaleLowerCase("zh-Hant");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  return { entities: entities.slice(0, limit), total: entities.length, limit, provenance };
}

export async function getStructuredEntity(entityId, options = {}) {
  if (
    typeof entityId !== "string"
    || entityId.length > 200
    || !/^(?:[\p{Letter}\p{Number}-]+-[A-F0-9]{10}|(?:character|weapon|ability)_[a-z0-9_]+)$/u.test(entityId)
  ) {
    throw new Error("Invalid entity_id.");
  }
  const { registry, provenance } = await getStructuredEntityRegistry(options);
  const entity = entityTypes.flatMap((type) => registry[type] ?? [])
    .find((item) => item.entity_id === entityId);
  if (!entity) {
    const error = new Error("Entity not found.");
    error.statusCode = 404;
    throw error;
  }
  return { entity, provenance };
}

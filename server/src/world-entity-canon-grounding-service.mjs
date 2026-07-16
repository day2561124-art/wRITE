import {
  originalEntityFreedomContract,
} from "./character-canon-grounding-service.mjs";

const sourceAuthority = "active_engine_canon_high_authority";

export const worldEntityMentionStatuses = Object.freeze({
  confirmed: "confirmed_existing_canon_world_entity",
  ambiguous: "ambiguous_canon_world_entity_collision",
  none: "no_existing_canon_world_entity_match",
});

const entityDefinitions = Object.freeze([
  ["武裝學院", "school"],
  ["生命學院", "school"],
  ["工學院", "school"],
  ["藝裝學院", "school"],
  ["實習校", "school"],
  ["大學", "school"],
  ["高中", "school"],
  ["國中", "school"],
  ["學院", "school"],
  ["學校", "school"],

  ["行政委員會", "administrative_agency"],
  ["委員會", "administrative_agency"],
  ["辦公室", "administrative_agency"],
  ["研究中心", "official_institution"],
  ["研究院", "official_institution"],
  ["研究所", "official_institution"],
  ["觀測局", "administrative_agency"],
  ["巡禮局", "administrative_agency"],
  ["保安局", "administrative_agency"],
  ["應變局", "administrative_agency"],
  ["局", "administrative_agency"],
  ["署", "administrative_agency"],
  ["廳", "administrative_agency"],
  ["處", "administrative_agency"],
  ["部", "administrative_agency"],

  ["有限公司", "company"],
  ["股份有限公司", "company"],
  ["公司", "company"],
  ["企業", "company"],
  ["集團", "company"],
  ["商會", "organization"],
  ["協會", "organization"],
  ["社團", "organization"],
  ["組織", "organization"],
  ["棋盤社", "organization"],
  ["社", "organization"],
  ["派系", "faction"],
  ["議庭", "faction"],
  ["軍團", "faction"],

  ["共和國", "country"],
  ["王國", "country"],
  ["帝國", "country"],
  ["聯邦", "country"],
  ["行政區", "administrative_area"],
  ["街區", "administrative_area"],
  ["市", "city"],
  ["州", "region"],
  ["省", "region"],
  ["縣", "region"],
  ["鎮", "region"],
  ["村", "region"],

  ["醫療中心", "facility"],
  ["醫院", "facility"],
  ["診所", "facility"],
  ["機場", "facility"],
  ["車站", "facility"],
  ["廣場", "facility"],
  ["大樓", "facility"],
  ["公園", "facility"],
  ["中心", "facility"],
  ["館", "facility"],
  ["園", "facility"],
  ["港", "facility"],
  ["塔", "facility"],
  ["橋", "facility"],
]);

const entitySuffixes = Object.freeze(
  entityDefinitions
    .map(([suffix]) => suffix)
    .sort((left, right) => [...right].length - [...left].length),
);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const suffixPattern = entitySuffixes.map(escapeRegExp).join("|");

const entityIntroductionPattern = new RegExp(
  String.raw`(?:^|[\s|／/、，,；;：:（(「『“"]|(?:進入|選擇|加入|前往|來到|返回|離開|來自|所屬|任職於|就讀於|位於|新成立(?:了)?(?:的)?|成立(?:了)?(?:的)?|新設(?:立)?(?:了)?(?:的)?|設立(?:了)?(?:的)?|寫(?:一段|一篇)?|描寫|關於|讓|安排))([\p{Script=Han}・·]{1,24}?(?:${suffixPattern}))(?=$|[\s|／/、，,。；;！!？?：:）)」』”"的在於向往從到與和及並由為是]|(?:觀測者|執行者|創辦人|院長|副院長|教師|教官|學生|成員|代表|職員|幹部|社長|負責人|工作人員|兼|今天|昨日|明日|目前|剛|已|也|則|將|正在|接到|收到|派出|發布|負責|成立|舉行|開放|關閉|遭到|被))`,
  "gu",
);

const longerEntityExtensionPattern = /^(?:附屬|分校|校區|學部|分局|支局|支部|本部|研究所|研究中心|醫療中心|醫院|診所|公司|企業|集團|學院|學校|大學|高中|國中|局|署|廳|處|部|委員會|辦公室|社團|協會|中心|車站|機場|港|塔|館|園)/u;

const normalEntityContinuationPattern = /^(?:$|[，,。；;！!？?：:\s]|的|在|向|由|與|和|及|也|則|已|將|正在|準備|今天|昨日|明日|目前|剛|接到|收到|派出|發布|負責|成立|舉行|開放|關閉|遭到|被|是|為|有|沒有|仍|不|觀測者|執行者|創辦人|院長|副院長|教師|教官|學生|成員|代表|職員|幹部|社長|負責人|工作人員|兼)/u;

const allowedPrefixPattern = /(?:^|[「『“"'。！？!?；;：:\n]|寫(?:一段|一篇)?|描寫|關於|讓|安排|在|到|向|從|與|和|及|由|為|是|去(?:了)?|前往|來到|返回|離開|進入|加入|選擇|來自|所屬|任職於|就讀於|位於|提到|通知|拜訪)$/u;

function cleanCell(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/giu, "；")
    .replace(/\\\|/gu, "｜")
    .replace(/[`*_]/gu, "")
    .trim();
}

function serializedContext(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function inferEntityType(canonicalName) {
  for (const [suffix, entityType] of entityDefinitions) {
    if (canonicalName.endsWith(suffix)) return entityType;
  }
  return "world_entity";
}

function uniquePush(target, value, maximum = 24) {
  const text = cleanCell(value);
  if (!text || target.includes(text) || target.length >= maximum) return;
  target.push(text);
}

export function extractWorldEntityNames(text) {
  const source = String(text ?? "");
  const entities = [];
  const seen = new Set();

  for (const match of source.matchAll(entityIntroductionPattern)) {
    const canonicalName = cleanCell(match[1]);

    if (
      !canonicalName
      || [...canonicalName].length < 2
      || [...canonicalName].length > 32
      || entitySuffixes.includes(canonicalName)
      || seen.has(canonicalName)
    ) {
      continue;
    }

    seen.add(canonicalName);
    entities.push({
      canonical_name: canonicalName,
      entity_type: inferEntityType(canonicalName),
    });
  }

  return entities;
}

function createWorkingRecord(canonicalName, entityType) {
  return {
    canonicalName,
    entityType,
    sections: [],
    facts: [],
    provenance: [],
  };
}

function addRecord(records, candidate, detail) {
  const record = records.get(candidate.canonical_name)
    ?? createWorkingRecord(candidate.canonical_name, candidate.entity_type);

  uniquePush(record.sections, detail.source_section, 12);
  uniquePush(record.facts, detail.fact, 14);

  if (
    !record.provenance.some((item) => (
      item.source_line === detail.source_line
      && item.source_section === detail.source_section
    ))
    && record.provenance.length < 16
  ) {
    record.provenance.push({
      source_file: detail.source_file,
      source_section: detail.source_section,
      source_line: detail.source_line,
      record_context: detail.fact,
    });
  }

  records.set(candidate.canonical_name, record);
}

export function parseActiveEngineWorldEntityRecords(
  activeEngineContent,
  options = {},
) {
  const sourceFile = String(
    options.sourceFile ?? "data/canon_db/active_engine.md",
  );
  const lines = String(activeEngineContent ?? "").split(/\r?\n/u);
  const records = new Map();
  let currentSection = "active_engine";

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(rawLine);

    if (heading) {
      currentSection = cleanCell(heading[2]);
    }

    const fact = cleanCell(rawLine);

    if (!fact) continue;

    for (const candidate of extractWorldEntityNames(rawLine)) {
      addRecord(records, candidate, {
        source_file: sourceFile,
        source_section: currentSection,
        source_line: index + 1,
        fact: fact.slice(0, 900),
      });
    }
  }

  return [...records.values()]
    .map((record) => ({
      canonical_name: record.canonicalName,
      entity_type: record.entityType,
      source_authority: sourceAuthority,
      source_file: sourceFile,
      source_sections: record.sections,
      canon_facts: record.facts,
      provenance: record.provenance,
    }))
    .sort((left, right) => (
      left.canonical_name.localeCompare(right.canonical_name, "zh-Hant")
    ));
}

function occurrenceIndices(source, canonicalName) {
  const indices = [];
  let offset = 0;

  while (offset <= source.length - canonicalName.length) {
    const index = source.indexOf(canonicalName, offset);

    if (index < 0) break;

    indices.push(index);
    offset = index + Math.max(1, canonicalName.length);
  }

  return indices;
}

function contextWindow(source, index, canonicalName) {
  const end = index + canonicalName.length;

  return {
    before: source.slice(Math.max(0, index - 32), index),
    after: source.slice(end, Math.min(source.length, end + 36)),
    passage: source.slice(
      Math.max(0, index - 20),
      Math.min(source.length, end + 28),
    ),
  };
}

function classifyWorldEntityOccurrence(source, canonicalName, index) {
  const { before, after, passage } = contextWindow(
    source,
    index,
    canonicalName,
  );

  const precedingCharacter = before.slice(-1);

  if (
    precedingCharacter
    && /\p{Script=Han}/u.test(precedingCharacter)
    && !allowedPrefixPattern.test(before)
  ) {
    return {
      status: worldEntityMentionStatuses.ambiguous,
      confidence: "insufficient",
      reason: "possible_longer_prefixed_world_entity",
      index,
      passage,
    };
  }

  if (longerEntityExtensionPattern.test(after)) {
    return {
      status: worldEntityMentionStatuses.ambiguous,
      confidence: "insufficient",
      reason: "possible_longer_world_entity_compound",
      index,
      passage,
    };
  }

  if (normalEntityContinuationPattern.test(after)) {
    return {
      status: worldEntityMentionStatuses.confirmed,
      confidence: "high",
      reason: "exact_existing_world_entity_context",
      index,
      passage,
    };
  }

  return {
    status: worldEntityMentionStatuses.ambiguous,
    confidence: "insufficient",
    reason: "world_entity_name_without_sufficient_boundary",
    index,
    passage,
  };
}

export function resolveWorldEntityMention(text, canonicalName) {
  const source = String(text ?? "");
  const name = cleanCell(canonicalName);

  if (!source || !name) {
    return {
      canonical_name: name || null,
      status: worldEntityMentionStatuses.none,
      confirmed_occurrences: [],
      ambiguous_occurrences: [],
    };
  }

  const occurrences = occurrenceIndices(source, name)
    .map((index) => classifyWorldEntityOccurrence(source, name, index));

  const confirmed = occurrences.filter((item) => (
    item.status === worldEntityMentionStatuses.confirmed
  ));
  const ambiguous = occurrences.filter((item) => (
    item.status === worldEntityMentionStatuses.ambiguous
  ));

  return {
    canonical_name: name,
    status: confirmed.length
      ? worldEntityMentionStatuses.confirmed
      : ambiguous.length
        ? worldEntityMentionStatuses.ambiguous
        : worldEntityMentionStatuses.none,
    confirmed_occurrences: confirmed,
    ambiguous_occurrences: ambiguous,
  };
}

export function resolveWorldEntityMentions(text, records = []) {
  const confirmed_entities = [];
  const ambiguous_mentions = [];

  for (const record of records) {
    const resolution = resolveWorldEntityMention(
      text,
      record.canonical_name,
    );

    if (resolution.status === worldEntityMentionStatuses.confirmed) {
      confirmed_entities.push({
        ...record,
        mention_resolution_status: resolution.status,
        mention_evidence: resolution.confirmed_occurrences,
      });
    }

    for (const occurrence of resolution.ambiguous_occurrences) {
      ambiguous_mentions.push({
        canonical_name: record.canonical_name,
        entity_type: record.entity_type,
        ...occurrence,
      });
    }
  }

  return {
    status: confirmed_entities.length
      ? worldEntityMentionStatuses.confirmed
      : ambiguous_mentions.length
        ? worldEntityMentionStatuses.ambiguous
        : worldEntityMentionStatuses.none,
    confirmed_entities,
    ambiguous_mentions,
  };
}

export function buildWorldEntityCanonGrounding(input = {}) {
  const records = parseActiveEngineWorldEntityRecords(
    input.activeEngineContent,
    { sourceFile: input.sourceFile },
  );

  const primaryInputs = [
    {
      source: "task_prompt",
      text: serializedContext(input.taskPrompt),
    },
    {
      source: "generation_context",
      text: serializedContext(input.generationContext),
    },
    {
      source: "retrieval_context",
      text: serializedContext(input.retrievalContext),
    },
  ];

  const longlineInput = {
    source: "current_longline",
    text: serializedContext(input.currentLongline),
  };

  const matched = [];
  const ambiguousMentions = [];

  for (const record of records) {
    const resolvedInputs = primaryInputs.map((entry, inputIndex) => ({
      ...entry,
      inputIndex,
      resolution: resolveWorldEntityMention(
        entry.text,
        record.canonical_name,
      ),
    }));

    const confirmedInputs = resolvedInputs.filter((entry) => (
      entry.resolution.status === worldEntityMentionStatuses.confirmed
    ));

    for (const entry of resolvedInputs) {
      for (const occurrence of entry.resolution.ambiguous_occurrences) {
        ambiguousMentions.push({
          canonical_name: record.canonical_name,
          entity_type: record.entity_type,
          source: entry.source,
          ...occurrence,
        });
      }
    }

    if (!confirmedInputs.length) continue;

    matched.push({
      ...record,
      grounding_classification:
        "pre_generation_existing_canon_world_entity",
      match_sources: confirmedInputs.map((entry) => entry.source),
      mention_evidence: confirmedInputs.flatMap((entry) => (
        entry.resolution.confirmed_occurrences.map((occurrence) => ({
          source: entry.source,
          ...occurrence,
        }))
      )),
      match_rank: Math.min(...confirmedInputs.flatMap((entry) => (
        entry.resolution.confirmed_occurrences.map((occurrence) => (
          entry.inputIndex * 1_000_000 + occurrence.index
        ))
      ))),
    });
  }

  const useLonglineFallback = (
    input.useCurrentLonglineFallback === true
    || /(?:續寫|下一章|承接|接續|延續)/u.test(primaryInputs[0].text)
  );

  if (!matched.length && useLonglineFallback && longlineInput.text) {
    for (const record of records) {
      const resolution = resolveWorldEntityMention(
        longlineInput.text,
        record.canonical_name,
      );

      if (resolution.status === worldEntityMentionStatuses.confirmed) {
        matched.push({
          ...record,
          grounding_classification:
            "pre_generation_existing_canon_world_entity",
          match_sources: [longlineInput.source],
          mention_evidence: resolution.confirmed_occurrences.map(
            (occurrence) => ({
              source: longlineInput.source,
              ...occurrence,
            }),
          ),
          match_rank: Math.min(
            ...resolution.confirmed_occurrences.map((item) => item.index),
          ),
        });
      }

      for (const occurrence of resolution.ambiguous_occurrences) {
        ambiguousMentions.push({
          canonical_name: record.canonical_name,
          entity_type: record.entity_type,
          source: longlineInput.source,
          ...occurrence,
        });
      }
    }
  }

  const entities = matched
    .sort((left, right) => (
      left.match_rank - right.match_rank
      || left.canonical_name.localeCompare(
        right.canonical_name,
        "zh-Hant",
      )
    ))
    .map(({ match_rank: ignored, ...record }) => record);

  return {
    schema_version: "phase48c-world-entity-canon-grounding-v1",
    loaded: String(input.activeEngineContent ?? "").length > 0,
    source_authority: sourceAuthority,
    source_file: String(
      input.sourceFile ?? "data/canon_db/active_engine.md",
    ),
    source_scope: "full_active_engine_before_context_allocation",
    matched_world_entity_count: entities.length,
    entities,
    mention_resolution: {
      confirmed_existing_canon_world_entity_count: entities.length,
      ambiguous_mention_count: ambiguousMentions.length,
      ambiguous_mentions: ambiguousMentions,
      unmatched_world_entities_are_not_errors: true,
    },
    original_entity_freedom: {
      ...originalEntityFreedomContract,
    },
    authority_contract: {
      existing_world_entity_facts_are_hard_constraints: true,
      canon_absence_does_not_block_original_creation: true,
      ambiguous_names_remain_unresolved: true,
      automatic_persistence: false,
    },
  };
}

function compactFact(value, maximum = 220) {
  return cleanCell(value).slice(0, maximum);
}

export function serializeWorldEntityCanonGroundingFixedGuard(
  packet = {},
) {
  const entities = Array.isArray(packet.entities)
    ? packet.entities
    : [];

  const ambiguousCount = (
    packet.mention_resolution?.ambiguous_mention_count ?? 0
  );

  if (!entities.length && !ambiguousCount) return "";

  const lines = [
    "## 【P0｜既有世界實體 Canon Grounding】",
    "",
    "- 只保護高可信匹配的既有 Canon 世界實體；本區不是世界 entity 白名單。",
    "- Canon 查無資料不構成錯誤、停止理由或刪除新 entity 的理由。",
    "- 原創城市、學校、組織、行政機關、企業、派系與設施不會自動持久化。",
  ];

  for (const entity of entities.slice(0, 10)) {
    lines.push(
      `- ${entity.canonical_name} [${entity.entity_type}]：${
        compactFact((entity.canon_facts ?? []).slice(0, 2).join("；"))
      }`,
    );
  }

  if (ambiguousCount) {
    lines.push(
      `- ambiguous existing world-entity mentions：${ambiguousCount}；保持 unresolved，禁止 force-bind。`,
    );
  }

  return lines.join("\n");
}

export default buildWorldEntityCanonGrounding;

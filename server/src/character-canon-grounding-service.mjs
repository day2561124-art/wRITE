const sourceAuthority = "active_engine_canon_high_authority";

const fieldAliases = Object.freeze({
  name: new Set(["角色", "姓名"]),
  gender: new Set(["性別"]),
  genderAndIdentity: new Set(["性別／身分", "性別/身分"]),
  identity: new Set([
    "年級／身分",
    "年級/身分",
    "年齡／年級",
    "年齡/年級",
    "身分",
    "已成立身分／位置",
    "已成立身分/位置",
  ]),
  affiliation: new Set(["所屬"]),
  appearance: new Set(["外觀重點", "外觀", "外觀辨識", "外觀／聲線", "外觀/聲線"]),
  position: new Set(["正式定位", "正式邊界"]),
});

const unsupportedBodyTraitPolicy = (
  "Unlisted or otherwise unsupported new body-trait invention is forbidden during prose "
  + "generation unless current higher-authority context explicitly supports it. Missing Canon "
  + "fields do not establish absence, but they are not permission to invent a conflicting "
  + "permanent body trait."
);

function cleanCell(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/giu, "；")
    .replace(/\\\|/gu, "｜")
    .replace(/[`*_]/gu, "")
    .trim();
}

function normalizeHeader(value) {
  return cleanCell(value).replace(/\s+/gu, "");
}

function splitMarkdownRow(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.startsWith("|")) return [];
  return trimmed
    .replace(/^\|/u, "")
    .replace(/\|\s*$/u, "")
    .split("|")
    .map(cleanCell);
}

function isSeparatorRow(line) {
  const cells = splitMarkdownRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.replace(/\s+/gu, "")));
}

function indexFor(headers, aliases) {
  return headers.findIndex((header) => aliases.has(header));
}

function uniquePush(target, value) {
  const text = cleanCell(value);
  if (text && !target.includes(text)) target.push(text);
}

function normalizeGender(value) {
  const text = cleanCell(value);
  const match = /^(男|女)(?:性)?(?:$|[；;,，／/])/u.exec(text);
  if (!match) return null;
  return match[1] === "男" ? "male" : "female";
}

function pronounsFor(gender) {
  if (gender === "male") {
    return { third_person: "他", second_person: "你", resolved: true };
  }
  if (gender === "female") {
    return { third_person: "她", second_person: "妳", resolved: true };
  }
  return { third_person: null, second_person: null, resolved: false };
}

function appearanceClausesFromPosition(value) {
  const appearanceMarker = /(髮|眼|瞳|挑染|膚|獸耳|獸尾|尾巴|鹿角|龍角|精靈耳|翅膀|羽翼|鱗片)/u;
  return cleanCell(value)
    .split(/[；;]/u)
    .map((part) => part.trim())
    .filter((part) => part && appearanceMarker.test(part));
}

function explicitBodyTraitsFromAppearance(facts) {
  const bodyTraitMarker = /(獸耳|獸尾|貓耳|狼耳|狐耳|狐狸耳|兔耳|鹿耳|精靈耳|鹿角|龍角|翅膀|羽翼|鱗片|尾巴)/u;
  const unsupportedOrNegative = /(?:無|沒有|未設定|不得|禁止|非)[^；，。]{0,12}(?:獸耳|獸尾|貓耳|狼耳|狐耳|狐狸耳|兔耳|鹿耳|精靈耳|鹿角|龍角|翅膀|羽翼|鱗片|尾巴)/u;
  const traits = [];
  for (const fact of facts) {
    for (const clause of cleanCell(fact).split(/[；;，,。]/u)) {
      const text = clause.trim();
      if (!text || !bodyTraitMarker.test(text) || unsupportedOrNegative.test(text)) continue;
      uniquePush(traits, text);
    }
  }
  return traits;
}

function relationshipBearing(value) {
  return /(父|母|妻|夫|哥哥|弟弟|姐姐|姊姊|妹妹|兄|姊|姐|弟|妹|戀人|摯友|青梅竹馬|童年舊識|搭檔)/u.test(
    cleanCell(value),
  );
}

function createWorkingRecord(canonicalName) {
  return {
    canonicalName,
    genderValues: [],
    identityFacts: [],
    affiliationFacts: [],
    appearanceFacts: [],
    positionFacts: [],
    provenance: [],
  };
}

function cellAt(cells, index) {
  return index >= 0 ? cleanCell(cells[index]) : "";
}

function recordProvenance(record, detail) {
  if (!record.provenance.some((item) => item.source_line === detail.source_line)) {
    record.provenance.push(detail);
  }
}

export function parseActiveEngineCharacterRecords(activeEngineContent, options = {}) {
  const sourceFile = String(options.sourceFile ?? "data/canon_db/active_engine.md");
  const lines = String(activeEngineContent ?? "").split(/\r?\n/u);
  const records = new Map();
  let currentSection = "active_engine";

  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(lines[index]);
    if (heading) currentSection = cleanCell(heading[2]);
    if (!lines[index].trim().startsWith("|") || !isSeparatorRow(lines[index + 1])) continue;

    const headers = splitMarkdownRow(lines[index]).map(normalizeHeader);
    const nameIndex = indexFor(headers, fieldAliases.name);
    if (nameIndex < 0) continue;
    const genderIndex = indexFor(headers, fieldAliases.gender);
    const genderAndIdentityIndex = indexFor(headers, fieldAliases.genderAndIdentity);
    const identityIndex = indexFor(headers, fieldAliases.identity);
    const affiliationIndex = indexFor(headers, fieldAliases.affiliation);
    const appearanceIndex = indexFor(headers, fieldAliases.appearance);
    const positionIndex = indexFor(headers, fieldAliases.position);

    let rowIndex = index + 2;
    while (rowIndex < lines.length && lines[rowIndex].trim().startsWith("|")) {
      const cells = splitMarkdownRow(lines[rowIndex]);
      const canonicalName = cellAt(cells, nameIndex);
      if (canonicalName && !/[：:]/u.test(canonicalName) && canonicalName.length <= 40) {
        const record = records.get(canonicalName) ?? createWorkingRecord(canonicalName);
        const genderCell = cellAt(
          cells,
          genderIndex >= 0 ? genderIndex : genderAndIdentityIndex,
        );
        const gender = normalizeGender(genderCell);
        if (gender) uniquePush(record.genderValues, gender);

        const identityCell = cellAt(
          cells,
          identityIndex >= 0 ? identityIndex : genderAndIdentityIndex,
        );
        const affiliationCell = cellAt(cells, affiliationIndex);
        const appearanceCell = cellAt(cells, appearanceIndex);
        const positionCell = cellAt(cells, positionIndex);
        uniquePush(record.identityFacts, identityCell);
        uniquePush(record.affiliationFacts, affiliationCell);
        uniquePush(record.appearanceFacts, appearanceCell);
        uniquePush(record.positionFacts, positionCell);
        for (const clause of appearanceClausesFromPosition(positionCell)) {
          uniquePush(record.appearanceFacts, clause);
        }
        if (relationshipBearing(identityCell)) uniquePush(record.positionFacts, identityCell);

        recordProvenance(record, {
          source_file: sourceFile,
          source_section: currentSection,
          source_line: rowIndex + 1,
          table_headers: headers,
          record_context: cleanCell(lines[rowIndex]),
        });
        records.set(canonicalName, record);
      }
      rowIndex += 1;
    }
    index = rowIndex - 1;
  }

  return [...records.values()].map((record) => {
    const gender = record.genderValues.length === 1 ? record.genderValues[0] : null;
    const primaryProvenance = record.provenance.find((item) => (
      item.table_headers.some((header) => fieldAliases.gender.has(header)
        || fieldAliases.genderAndIdentity.has(header))
    )) ?? record.provenance[0] ?? {
      source_file: sourceFile,
      source_section: "active_engine",
      source_line: null,
      table_headers: [],
      record_context: null,
    };
    return {
      canonical_name: record.canonicalName,
      source_authority: sourceAuthority,
      source_file: sourceFile,
      source_section: primaryProvenance.source_section,
      gender,
      gender_canon: gender === "male" ? "男" : gender === "female" ? "女" : null,
      gender_conflict_detected: record.genderValues.length > 1,
      pronouns: pronounsFor(gender),
      identity_facts: record.identityFacts,
      affiliation_facts: record.affiliationFacts,
      appearance_facts: record.appearanceFacts,
      relationship_or_position_facts: record.positionFacts,
      explicit_body_traits: explicitBodyTraitsFromAppearance(record.appearanceFacts),
      unsupported_body_trait_policy: unsupportedBodyTraitPolicy,
      provenance: record.provenance,
    };
  });
}

function serializedContext(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function characterMentionIndex(text, canonicalName) {
  const source = String(text ?? "");
  if (!source || !canonicalName) return -1;
  if ([...canonicalName].length > 1) return source.indexOf(canonicalName);
  const match = new RegExp(
    `(?:^|[^\\p{Script=Han}])${escapeRegExp(canonicalName)}(?:$|[^\\p{Script=Han}])`,
    "u",
  ).exec(source);
  return match?.index ?? -1;
}

export function buildCharacterCanonGrounding(input = {}) {
  const records = parseActiveEngineCharacterRecords(input.activeEngineContent, {
    sourceFile: input.sourceFile,
  });
  const primaryInputs = [
    { source: "task_prompt", text: serializedContext(input.taskPrompt) },
    { source: "generation_context", text: serializedContext(input.generationContext) },
    { source: "retrieval_context", text: serializedContext(input.retrievalContext) },
  ];
  const longlineInput = {
    source: "current_longline",
    text: serializedContext(input.currentLongline),
  };

  const matched = [];
  for (const record of records) {
    const evidence = primaryInputs
      .map((entry) => ({ ...entry, index: characterMentionIndex(entry.text, record.canonical_name) }))
      .filter((entry) => entry.index >= 0);
    if (!evidence.length) continue;
    matched.push({
      ...record,
      match_sources: evidence.map((entry) => entry.source),
      match_rank: Math.min(...evidence.map((entry, inputIndex) => inputIndex * 1_000_000 + entry.index)),
    });
  }

  const useLonglineFallback = input.useCurrentLonglineFallback === true
    || /(?:續寫|下一章|承接|接續|延續)/u.test(primaryInputs[0].text);
  if (!matched.length && useLonglineFallback && longlineInput.text) {
    for (const record of records) {
      const index = characterMentionIndex(longlineInput.text, record.canonical_name);
      if (index >= 0) {
        matched.push({
          ...record,
          match_sources: [longlineInput.source],
          match_rank: index,
        });
      }
    }
  }

  const characters = matched
    .sort((left, right) => left.match_rank - right.match_rank
      || left.canonical_name.localeCompare(right.canonical_name, "zh-Hant"))
    .map(({ match_rank: ignored, ...record }) => record);

  return {
    schema_version: "phase48a-character-canon-grounding-v1",
    loaded: String(input.activeEngineContent ?? "").length > 0,
    source_authority: sourceAuthority,
    source_file: String(input.sourceFile ?? "data/canon_db/active_engine.md"),
    source_scope: "full_active_engine_before_context_allocation",
    matched_character_count: characters.length,
    characters,
    body_trait_policy: {
      explicit_traits_may_be_used: true,
      unlisted_traits_mean_canon_absence: false,
      unsupported_new_trait_invention_forbidden: true,
      rule: unsupportedBodyTraitPolicy,
    },
    authority_contract: {
      outranks_character_voice_registry: true,
      outranks_visual_only_references: true,
      character_voice_usage: "supporting_voice_guidance_only",
    },
  };
}

export function serializeCharacterCanonGroundingFixedGuard(packet = {}) {
  const characters = Array.isArray(packet.characters) ? packet.characters : [];
  const lines = [
    "## 【P0｜Character Canon Grounding】",
    "",
    `- source authority: ${packet.source_authority ?? sourceAuthority}`,
    `- matched characters: ${characters.length}`,
    "- Canon character hard facts outrank Character Voice Registry and visual-only guidance.",
    "- Never change a known gender; when gender is explicit, use the grounded Traditional Chinese third- and second-person pronouns consistently.",
    "- Do not replace canonical appearance with genre shorthand.",
    "- Do not invent animal ears, tails, horns, wings, scales, or other permanent body traits without supporting Canon or current higher-authority context.",
    "- Missing fields do not prove absence, but they are not permission to invent a conflicting permanent body trait.",
    "",
  ];
  for (const character of characters) {
    lines.push(
      `- ${character.canonical_name}｜gender=${character.gender ?? "unresolved"}`
      + `｜third_person=${character.pronouns?.third_person ?? "unresolved"}`
      + `｜second_person=${character.pronouns?.second_person ?? "unresolved"}`
      + `｜identity=${character.identity_facts?.join("；") || "unresolved"}`
      + `｜affiliation=${character.affiliation_facts?.join("；") || "unresolved"}`
      + `｜appearance=${character.appearance_facts?.join("；") || "unresolved"}`
      + `｜position=${character.relationship_or_position_facts?.join("；") || "unresolved"}`
      + `｜explicit_body_traits=${character.explicit_body_traits?.join("；") || "none_grounded"}`,
    );
  }
  return lines.join("\n");
}

export const characterCanonGroundingAuthority = sourceAuthority;
export const characterCanonUnsupportedBodyTraitPolicy = unsupportedBodyTraitPolicy;

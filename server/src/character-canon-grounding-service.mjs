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

export const canonCharacterMentionStatuses = Object.freeze({
  confirmed: "confirmed_existing_canon_entity",
  ambiguous: "ambiguous_canon_name_collision",
  none: "no_existing_canon_match",
});

export const originalEntityFreedomContract = Object.freeze({
  original_entity_creation_allowed: true,
  canon_absence_is_not_error: true,
  canon_absence_does_not_block_generation: true,
  canon_absence_does_not_require_deletion: true,
  only_confident_existing_entity_matches_receive_existing_canon_hard_facts: true,
  ambiguous_entities_remain_unresolved: true,
  automatic_canon_persistence: false,
  entity_categories: Object.freeze([
    "character",
    "country",
    "region",
    "city",
    "administrative_area",
    "administrative_agency",
    "official_institution",
    "school",
    "organization",
    "company",
    "faction",
    "facility",
  ]),
});

const nonCharacterEntitySuffixes = Object.freeze([
  "共和國", "委員會", "辦公室", "研究中心", "研究院", "研究所",
  "行政區", "街區", "公園", "醫院", "診所", "公司", "企業", "集團",
  "商會", "協會", "組織", "社團", "機場", "車站", "廣場", "大樓",
  "學院", "學校", "大學", "高中", "國中", "王國", "帝國", "聯邦",
  "中心", "大道", "國", "州", "省", "縣", "市", "區", "鎮", "村",
  "街", "路", "局", "署", "部", "廳", "處", "科", "院", "會", "站",
  "館", "園", "社", "隊", "軍", "艦", "號", "港", "塔", "橋", "河",
  "湖", "山",
]);

const personActionPattern = /^(?:[，,、：:\s]{0,2})(?:把|將|看向|看了|看著|看|望向|望|回答|答道|答|問道|問|說道|說|道|走進|走出|走向|走|跑|拿起|拿|推開|推|坐下|坐|站起|站|皺|笑|哭|點頭|搖頭|轉身|轉|伸手|伸|抬頭|抬|低頭|低|閉眼|閉|睜眼|睜|進來|進門|離開|靠近|靠|喝|吃|放下|放|收起|收|翻開|翻|蹲下|蹲|起身|起|開口|開|關上|關|拍了|拍|碰|摸|聽見|聽|喊道|喊|叫住|喃喃|沉默|停下|停|退開|退|往|朝|找|接過|遞出|遞|抱著|抱|盯著|盯)/u;
const personAddressPattern = /^(?:哥|哥哥|弟|弟弟|姐|姐姐|姊|姊姊|妹|妹妹|老師|教官|同學|學長|學姊|學弟|學妹|先生|小姐)/u;

// Person-context evidence patterns for natural prose recall
const possessivePersonContextPattern = /^的(?:手|聲音|眼睛|眼|目光|臉|頭|身體|胸口|心臟|腳|腿|話|喘息|呼吸|步伐|背影|身影|側臉|表情|嘴角|眉頭|姿態|動作|氣息|氣味|嗓音|聲線|目彩|視線|唇角|眼神|頭髮|耳朵|尾巴|翅膀)/u;
const personStateReactionPattern = /^(?:一愣|愣了|怔住了|沒有回答|沒回答|停了一下|停了下|還蹲|還站|還坐|仍站|似乎|只是|只有|依舊|仍舊|始終|一直|緩緩|慢慢|輕輕|默默|靜靜|悄悄|漸漸|逐漸|突然|驟然|猛然|忽然|突兀|意外|驚訝|震驚|恍然|恍惚|茫然|呆呆|傻傻|癡癡|呆滯|空洞|迷蒙|朦朧|黯淡|明亮|清亮|晶亮|濕潤|泛紅|蒼白|粉紅|滾燙|冰冷|顫抖|哆嗦|發抖|顫動|抖動|蜷縮|蜷著|靜躺|瑟縮|蜷起|捧著|懷抱|擁抱|緊抱|輕抱)/u;
const dialogueSpeakerContextPattern = /^(?:問|說|道|答|喊|叫|問道|說道|答道|喊道|叫住|低聲|輕聲|大聲|輕輕地|緩緩地|急促地|迫不及待地|遲疑地|堅定地|溫柔地|冷淡地|嘲諷地|嘲笑地|讚美地|譏諷地|懇求地|央求地|抗議地|哀求地|哭訴地|嚎啕地|啜泣地|抽噎地)\s*[：:]/u;

// Evidence scoring constants
const evidenceScores = Object.freeze({
  strong: 10,        // Definitive person evidence
  supporting: 5,     // Contextual support
  collision: -10,    // Non-character entity collision
  weak: 2,           // Weak supporting evidence
  ambiguous: 0,      // Insufficient confidence
});

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
    const hasCharacterProfileColumns = [
      genderIndex,
      genderAndIdentityIndex,
      identityIndex,
      affiliationIndex,
      appearanceIndex,
      positionIndex,
    ].some((columnIndex) => columnIndex >= 0);
    // A vertical key/value table may begin with `| 角色 | 某角色 |` and
    // then contain rows such as `| 異能武裝 | ... |`. Those row labels are
    // fields, not character names.
    if (!hasCharacterProfileColumns) continue;

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
    before: source.slice(Math.max(0, index - 24), index),
    after: source.slice(end, Math.min(source.length, end + 32)),
    passage: source.slice(Math.max(0, index - 16), Math.min(source.length, end + 24)),
  };
}

function hasNonCharacterCompoundSuffix(after) {
  const hanPhrase = /^([\p{Script=Han}]{1,18})/u.exec(after)?.[1] ?? "";
  if (!hanPhrase) return null;
  const compound = hanPhrase.split(/[的在於向往從到與和及而但就才又也]/u)[0];
  if (!compound) return null;
  return nonCharacterEntitySuffixes.find((suffix) => {
    const index = compound.indexOf(suffix);
    return index >= 0 && index <= 10;
  }) ?? null;
}

function isVocative(before, after) {
  if (!/^[，,！!？?：:]/u.test(after)) return false;
  return before === "" || /[「『“"'。！？!?；;：:\n]$/u.test(before);
}

function isDirectedCharacterList(before, after) {
  const directive = /(?:寫|描寫|讓|安排|以)[^。！？!?\n]{0,20}$/u.test(before);
  const listOrAction = /^(?:、|，|,|和|與|及|跟|在|一起|找|整理|處理|面對|調查)/u.test(after);
  return directive && listOrAction;
}

// Detect if action pattern is actually a person action vs part of entity name/suffix compound
function isPersonActionNotCompound(after) {
  // Check if the pattern after NAME is actually a person action (not compound word)
  // Examples:
  //   夜星把門推開 → TRUE (把 is definitive person action marker)
  //   夜星站在門口 → TRUE (站在 is person action phrase)
  //   血站在桌邊 → TRUE
  //   夜星站今天停駛 → FALSE (站 + entity compound "station that closes today")
  //   血站今天關門 → FALSE (站 + entity compound)
  //   武裝學院的休息間 → FALSE (not a person action, should have collision detected)
  //   夜星道路今天封閉 → FALSE (道 part of "道路" entity compound)
  
  // Must start with actual person action verb
  if (!personActionPattern.test(after)) return false;
  
  // Extract the matched verb from personActionPattern using precise regex
  const match = /^(?:[，,、：:\s]{0,2})((?:把|將|看向|看了|看著|看|望向|望|回答|答道|答|問道|問|說道|說|道|走進|走出|走向|走|跑|拿起|拿|推開|推|坐下|坐|站起|站|皺|笑|哭|點頭|搖頭|轉身|轉|伸手|伸|抬頭|抬|低頭|低|閉眼|閉|睜眼|睜|進來|進門|離開|靠近|靠|喝|吃|放下|放|收起|收|翻開|翻|蹲下|蹲|起身|起|開口|開|關上|關|拍了|拍|碰|摸|聽見|聽|喊道|喊|叫住|喃喃|沉默|停下|停|退開|退|往|朝|找|接過|遞出|遞|抱著|抱|盯著|盯))/u.exec(after);
  
  if (!match) return false;
  
  const verb = match[1];
  const afterVerb = after.slice(match[0].length);
  
  // Definitive person action markers (multi-character or unambiguous verbs)
  const definitiveVerbs = ['把', '將', '看向', '望向', '回答', '答道', '問道', '說道', '走進', '走出', '走向', '推開', '拿起', '坐下', '站起', '點頭', '搖頭', '轉身', '伸手', '抬頭', '低頭', '閉眼', '睜眼', '進來', '進門', '離開', '靠近', '放下', '收起', '翻開', '蹲下', '起身', '開口', '關上', '拍了', '喊道', '叫住', '抱著', '盯著'];
  
  if (definitiveVerbs.includes(verb)) return true;
  
  // Single-character ambiguous verbs need context examination
  const ambiguousVerbs = ['看', '道', '站', '開', '關', '走', '坐', '皺', '笑', '哭', '轉', '伸', '抬', '低', '閉', '睜', '靠', '喝', '吃', '放', '收', '翻', '蹲', '起', '拍', '碰', '摸', '聽', '喊', '叫', '朝', '找', '遞', '抱', '盯'];
  
  if (ambiguousVerbs.includes(verb)) {
    // No context after - likely not a person action
    if (!afterVerb || afterVerb[0] === '。' || afterVerb[0] === '，') return false;
    
    // Check for person action continuations (stance/location markers)
    if (/^(?:在|著|起|中|過)/.test(afterVerb)) return true;
    
    // Check for possessive person context
    if (/^的(?:手|聲|眼|身|頭)/.test(afterVerb)) return true;
    
    // Check for known non-character entity suffixes - indicates compound noun
    if (/^(?:路|道|局|站|港|塔|橋|河|湖|山|街|村|鎮|市|區|省|縣|州|國|黨|軍|隊|院|校|會|社|店|家|場|室|館|園|廣|台)(?:[^的在於向往從到與和及而但就才又也]|$)/.test(afterVerb)) {
      return false;
    }
    
    // Check for date/time/modifier context - indicates entity context, not person action
    if (/^(?:今|明|近|最|第|一|新|舊|老|小|大|每|週|月|年|日|小時|現在|剛|才|已|了|著|過)/.test(afterVerb)) {
      return false;
    }
    
    // Ambiguous case - conservatively return true (treating as person action when in doubt)
    // Only explicit collision or impossible context returns false
    return true;
  }
  
  // Other verbs - assume person action
  return true;
}

// Evaluate evidence for a single occurrence with scoring
function evaluateOccurrenceEvidence(source, canonicalName, index) {
  const { before, after, passage } = contextWindow(source, index, canonicalName);
  const characterLength = [...canonicalName].length;
  const precedingCharacter = before.slice(-1);
  const oneCharacterBoundary = characterLength > 1
    || !precedingCharacter
    || !/\p{Script=Han}/u.test(precedingCharacter);

  const scores = [];

  // STRONG EVIDENCE
  if (oneCharacterBoundary && isVocative(before, after)) {
    scores.push({
      score: evidenceScores.strong,
      reason: "vocative_character_context",
    });
  }
  
  if (oneCharacterBoundary && personAddressPattern.test(after)) {
    scores.push({
      score: evidenceScores.strong,
      reason: "person_address_or_relationship_context",
    });
  }

  if (characterLength > 1 && isDirectedCharacterList(before, after)) {
    scores.push({
      score: evidenceScores.strong,
      reason: "explicit_character_list_or_writing_directive",
    });
  }

  if (characterLength >= 4 && !nonCharacterEntitySuffixes.some(suffix => canonicalName.endsWith(suffix))) {
    scores.push({
      score: evidenceScores.strong,
      reason: "exact_long_canonical_name",
    });
  }

  // SUPPORTING EVIDENCE - possessive human-bearing context
  if (oneCharacterBoundary && possessivePersonContextPattern.test(after)) {
    scores.push({
      score: evidenceScores.supporting,
      reason: "possessive_person_context",
    });
  }

  // SUPPORTING EVIDENCE - person state/reaction context
  if (oneCharacterBoundary && personStateReactionPattern.test(after)) {
    scores.push({
      score: evidenceScores.supporting,
      reason: "person_state_reaction_context",
    });
  }

  // SUPPORTING EVIDENCE - dialogue speaker context
  if (oneCharacterBoundary && dialogueSpeakerContextPattern.test(after)) {
    scores.push({
      score: evidenceScores.supporting,
      reason: "dialogue_speaker_context",
    });
  }

  // SUPPORTING EVIDENCE - checked person action (with collision guard)
  if (oneCharacterBoundary && personActionPattern.test(after) && isPersonActionNotCompound(after)) {
    scores.push({
      score: evidenceScores.supporting,
      reason: "actor_or_person_action_context",
    });
  }

  // WEAK EVIDENCE - repeated canonical name in person-like position
  if (characterLength >= 2) {
    // Count this occurrence position in sentence/clause subject area
    const sentenceStart = Math.max(0, before.lastIndexOf("。"), before.lastIndexOf("！"), before.lastIndexOf("？"), before.lastIndexOf("\n"));
    const clauseStart = Math.max(0, before.lastIndexOf("，"), before.lastIndexOf("；"));
    if (index - sentenceStart < 20 || (clauseStart > sentenceStart && index - clauseStart < 20)) {
      scores.push({
        score: evidenceScores.weak,
        reason: "subject_position_in_clause",
      });
    }
  }

  // COLLISION EVIDENCE
  const collisionSuffix = hasNonCharacterCompoundSuffix(after);
  if (collisionSuffix && !isPersonActionNotCompound(after)) {
    scores.push({
      score: evidenceScores.collision,
      reason: "non_character_compound_suffix",
      collision_suffix: collisionSuffix,
    });
  }

  return {
    index,
    passage,
    scores,
  };
}

function classifyOccurrence(source, canonicalName, index) {
  const evidence = evaluateOccurrenceEvidence(source, canonicalName, index);
  const { before, after } = contextWindow(source, index, canonicalName);
  const characterLength = [...canonicalName].length;
  const precedingCharacter = before.slice(-1);
  const oneCharacterBoundary = characterLength > 1
    || !precedingCharacter
    || !/\p{Script=Han}/u.test(precedingCharacter);

  // Calculate total score
  const totalScore = evidence.scores.reduce((sum, item) => sum + item.score, 0);
  
  // Determine status based on evidence
  if (totalScore >= evidenceScores.strong) {
    return {
      status: canonCharacterMentionStatuses.confirmed,
      confidence: "high",
      reason: evidence.scores.find(s => s.score === evidenceScores.strong)?.reason || "strong_evidence",
      evidence_scores: evidence.scores,
      total_score: totalScore,
      index: evidence.index,
      passage: evidence.passage,
    };
  }

  // Multiple supporting evidences can collectively confirm
  if (evidence.scores.filter(s => s.score === evidenceScores.supporting).length >= 2) {
    return {
      status: canonCharacterMentionStatuses.confirmed,
      confidence: "medium",
      reason: "multiple_supporting_evidence",
      evidence_scores: evidence.scores,
      total_score: totalScore,
      index: evidence.index,
      passage: evidence.passage,
    };
  }

  // Total supporting + weak evidence with no collision
  if (totalScore >= evidenceScores.supporting && !evidence.scores.some(s => s.score === evidenceScores.collision)) {
    return {
      status: canonCharacterMentionStatuses.confirmed,
      confidence: "medium",
      reason: "accumulated_supporting_evidence",
      evidence_scores: evidence.scores,
      total_score: totalScore,
      index: evidence.index,
      passage: evidence.passage,
    };
  }

  // Collision detected - ambiguous
  if (evidence.scores.some(s => s.score === evidenceScores.collision)) {
    return {
      status: canonCharacterMentionStatuses.ambiguous,
      confidence: "insufficient",
      reason: "non_character_compound_suffix",
      collision_suffix: evidence.scores.find(s => s.collision_suffix)?.collision_suffix,
      evidence_scores: evidence.scores,
      total_score: totalScore,
      index: evidence.index,
      passage: evidence.passage,
    };
  }

  // Insufficient evidence
  if (characterLength === 1) {
    return {
      status: canonCharacterMentionStatuses.ambiguous,
      confidence: "insufficient",
      reason: "single_character_name_without_person_evidence",
      evidence_scores: evidence.scores,
      total_score: totalScore,
      index: evidence.index,
      passage: evidence.passage,
    };
  }

  return {
    status: canonCharacterMentionStatuses.ambiguous,
    confidence: "insufficient",
    reason: "canonical_name_without_sufficient_identity_context",
    evidence_scores: evidence.scores,
    total_score: totalScore,
    index: evidence.index,
    passage: evidence.passage,
  };
}

export function resolveCanonCharacterMention(text, canonicalName) {
  const source = String(text ?? "");
  const name = String(canonicalName ?? "").trim();
  if (!source || !name) {
    return {
      canonical_name: name || null,
      status: canonCharacterMentionStatuses.none,
      confirmed_occurrences: [],
      ambiguous_occurrences: [],
    };
  }
  const occurrences = occurrenceIndices(source, name)
    .map((index) => classifyOccurrence(source, name, index));
  const confirmed = occurrences.filter((item) => (
    item.status === canonCharacterMentionStatuses.confirmed
  ));
  const ambiguous = occurrences.filter((item) => (
    item.status === canonCharacterMentionStatuses.ambiguous
  ));
  return {
    canonical_name: name,
    status: confirmed.length
      ? canonCharacterMentionStatuses.confirmed
      : ambiguous.length
        ? canonCharacterMentionStatuses.ambiguous
        : canonCharacterMentionStatuses.none,
    confirmed_occurrences: confirmed,
    ambiguous_occurrences: ambiguous,
  };
}

export function resolveCanonCharacterMentions(text, records = []) {
  const confirmed_characters = [];
  const ambiguous_mentions = [];
  for (const record of records) {
    const resolution = resolveCanonCharacterMention(text, record.canonical_name);
    if (resolution.status === canonCharacterMentionStatuses.confirmed) {
      confirmed_characters.push({
        ...record,
        mention_resolution_status: resolution.status,
        mention_evidence: resolution.confirmed_occurrences,
      });
    }
    for (const occurrence of resolution.ambiguous_occurrences) {
      ambiguous_mentions.push({
        canonical_name: record.canonical_name,
        ...occurrence,
      });
    }
  }
  return {
    status: confirmed_characters.length
      ? canonCharacterMentionStatuses.confirmed
      : ambiguous_mentions.length
        ? canonCharacterMentionStatuses.ambiguous
        : canonCharacterMentionStatuses.none,
    confirmed_characters,
    ambiguous_mentions,
  };
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
  const ambiguousMentions = [];
  const explicitCharacterNames = new Set(
    Array.isArray(input.explicitCharacterNames)
      ? input.explicitCharacterNames
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
      : [],
  );
  for (const record of records) {
    if (explicitCharacterNames.has(record.canonical_name)) {
      matched.push({
        ...record,
        match_sources: ["typed_retrieval_plan"],
        mention_resolution_status: canonCharacterMentionStatuses.confirmed,
        mention_evidence: [{
          source: "typed_retrieval_plan",
          status: canonCharacterMentionStatuses.confirmed,
          confidence: "high",
          reason: "exact_category_scoped_character_match",
          evidence_scores: [],
          total_score: 100,
          index: null,
          passage: record.canonical_name,
        }],
        match_rank: matched.length,
      });
      continue;
    }
    const resolvedInputs = primaryInputs.map((entry, inputIndex) => ({
      ...entry,
      inputIndex,
      resolution: resolveCanonCharacterMention(entry.text, record.canonical_name),
    }));
    const evidence = resolvedInputs
      .filter((entry) => entry.resolution.status === canonCharacterMentionStatuses.confirmed);
    for (const entry of resolvedInputs) {
      for (const occurrence of entry.resolution.ambiguous_occurrences) {
        ambiguousMentions.push({
          canonical_name: record.canonical_name,
          source: entry.source,
          ...occurrence,
        });
      }
    }
    if (!evidence.length) continue;
    matched.push({
      ...record,
      match_sources: evidence.map((entry) => entry.source),
      mention_resolution_status: canonCharacterMentionStatuses.confirmed,
      mention_evidence: evidence.flatMap((entry) => entry.resolution.confirmed_occurrences.map(
        (occurrence) => ({ source: entry.source, ...occurrence }),
      )),
      match_rank: Math.min(...evidence.flatMap((entry) => (
        entry.resolution.confirmed_occurrences.map((occurrence) => (
          entry.inputIndex * 1_000_000 + occurrence.index
        ))
      ))),
    });
  }

  const useLonglineFallback = input.useCurrentLonglineFallback === true
    || /(?:續寫|下一章|承接|接續|延續)/u.test(primaryInputs[0].text);
  if (!matched.length && useLonglineFallback && longlineInput.text) {
    for (const record of records) {
      const resolution = resolveCanonCharacterMention(
        longlineInput.text,
        record.canonical_name,
      );
      if (resolution.status === canonCharacterMentionStatuses.confirmed) {
        matched.push({
          ...record,
          match_sources: [longlineInput.source],
          mention_resolution_status: canonCharacterMentionStatuses.confirmed,
          mention_evidence: resolution.confirmed_occurrences.map((occurrence) => ({
            source: longlineInput.source,
            ...occurrence,
          })),
          match_rank: Math.min(...resolution.confirmed_occurrences.map((item) => item.index)),
        });
      }
      for (const occurrence of resolution.ambiguous_occurrences) {
        ambiguousMentions.push({
          canonical_name: record.canonical_name,
          source: longlineInput.source,
          ...occurrence,
        });
      }
    }
  }

  const characters = matched
    .sort((left, right) => left.match_rank - right.match_rank
      || left.canonical_name.localeCompare(right.canonical_name, "zh-Hant"))
    .map(({ match_rank: ignored, ...record }) => record);

  return {
    schema_version: "phase48b-character-canon-grounding-v2",
    loaded: String(input.activeEngineContent ?? "").length > 0,
    source_authority: sourceAuthority,
    source_file: String(input.sourceFile ?? "data/canon_db/active_engine.md"),
    source_scope: "full_active_engine_before_context_allocation",
    matched_character_count: characters.length,
    characters,
    mention_resolution: {
      confirmed_existing_canon_character_count: characters.length,
      ambiguous_mention_count: ambiguousMentions.length,
      ambiguous_mentions: ambiguousMentions,
      unmatched_names_are_not_errors: true,
    },
    original_entity_freedom: { ...originalEntityFreedomContract },
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
    "- GPT may freely create new characters and world entities when the story naturally calls for them; Canon absence alone is not an error or a reason to stop or delete them.",
    "- Apply existing hard facts only to confident existing-entity matches; ambiguous name collisions remain unresolved rather than being force-bound.",
    "- Grounding protects established memory; it does not define the limits of the world GPT may create, and new entities are never persisted automatically.",
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

// Lightweight Chapter Anchor Guard and candidate evaluation
export function buildChapterAnchorFromBundle(bundle = {}) {
  const content = bundle.content || {};
  const generation = content.generation_context_for_chat || "";
  const retrieval = content.retrieval_context_for_chat || "";
  const writingCard = content.writing_card_excerpt_or_reference || "";
  const longline = content.longline_excerpt_or_reference || "";

  // Use a core context (generation + retrieval + longline) for extracting required core characters.
  // Writing card text is informative but should not by itself create strict required-core constraints.
  const latestSettledContinuity =
    content.latest_settled_continuity
    && typeof content.latest_settled_continuity === "object"
      ? content.latest_settled_continuity
      : null;
  const settledSummary = String(
    latestSettledContinuity?.summary_text ?? "",
  );
  const text = [
    settledSummary,
    generation,
    retrieval,
    longline,
    writingCard,
  ].join("\n").toString();
  const lc = text.toLocaleLowerCase("zh-Hant");

  // Prefer the structured latest-settlement identity. Text parsing is fallback only.
  const chapter = latestSettledContinuity?.chapter
    ?? /第[一二三四五六七八九十百千萬〇零0-9]+章/.exec(text)?.[0]
    ?? null;
  const latestSettledContinuityApplied =
    latestSettledContinuity?.loaded === true;
  const viewpointSwitchAllowed = latestSettledContinuityApplied
    && /(?:不必承接[^\n]{0,30}下一秒|可(?:以)?[^\n]{0,30}(?:跳至|跳接|轉場|切換視角|切走|開啟新場景))/u.test(settledSummary);
  const must_continue_from = latestSettledContinuityApplied
    ? "latest settled continuity"
    : /正式結算後|正式結算/.test(lc)
      ? "previous chapter settlement"
      : null;

  // Try find locked_match and locked_result by simple phrase matching
  const locked_match = (text.match(/\b[\p{L}0-9\-\u4e00-\u9fff]+\s*(?:vs|VS|對|vs\.|v\.)\s*[\p{L}0-9\-\u4e00-\u9fff]+/u) || [null])[0];
  const locked_result = (lc.match(/九逃獲勝|九逃 獲勝|九逃勝|九逃 勝|裁定中止|裁定 中止/) || [null])[0] || null;

  // required core - attempt to identify obvious names from core context (generation/retrieval/longline)
  const coreContext = [generation, retrieval, longline].join("\n");
  const required_core_characters = [];
  if (!viewpointSwitchAllowed) {
    if (/朝日奈千夜/.test(coreContext)) required_core_characters.push("朝日奈千夜");
    if (/九逃/.test(coreContext)) required_core_characters.push("九逃");
  }

  const allowed_supporting_characters = [];
  const forbidden_characters = ["江止澄", "蒼藤嵐", "周念今", "安岫", "建瑞凰"];

  const forbidden_events = [
    "新增另一場正式對局結果",
    "改寫九逃勝",
  ];

  const allowed_scope = latestSettledContinuityApplied
    ? [
      "依最新結算摘要承接",
      "保留最新角色狀態與未收事項",
      "允許合理轉場",
      "允許切換視角或開啟新場景",
    ]
    : [
      "醫療後座",
      "短期疼痛與訓練限制",
      "明日複查與換藥",
      "觀眾反應",
      "七班初步沉澱",
      "下一場前壓力",
    ];

  const chapter_anchor = {
    chapter: chapter ?? "unknown",
    must_continue_from,
    locked_event: null,
    locked_match: locked_match ?? null,
    locked_result: locked_result ?? null,
    required_core_characters,
    allowed_supporting_characters,
    forbidden_characters,
    forbidden_events,
    allowed_scope,
    latest_settled_continuity_applied:
      latestSettledContinuityApplied,
    viewpoint_switch_allowed: viewpointSwitchAllowed,
  };

  const anchor_confidence = required_core_characters.length >= 2 ? "high" : "low";
  const guard_severity = anchor_confidence === "high" ? "medium" : "high";

  const compact_entity_anchor = required_core_characters.map((name) => ({
    entity_id: name.replace(/\s+/g, "_").toLowerCase(),
    display_name: name,
    short_role: "core_character",
    current_status: null,
    current_injury: null,
    chapter_relevance: chapter ?? null,
    provenance: "extracted_from_context",
  }));

  return {
    chapter_anchor,
    anchor_confidence,
    guard_severity,
    compact_entity_anchor,
  };
}

function escapeEntityMentionRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsEntityMention(candidateText, name) {
  const source = String(candidateText ?? "");
  const token = String(name ?? "").trim();

  if (!token) return false;

  const codePoints = [...token];

  if (codePoints.length > 1) {
    return source.includes(token);
  }

  const escaped = escapeEntityMentionRegExp(token);
  const leftBoundary =
    "(?:^|[\\s，。！？；：、…「」『』（）()【】《》〈〉—–-])";
  const rightEvidence =
    "(?=$|[\\s，。！？；：、…「」『』（）()【】《》〈〉—–-]|說|問|答|道|喊|叫|看|望|盯|走|來|去|笑|哭|點|搖|抬|伸|握|放|站|坐|轉|停|退|靠|沉默|皺眉|垂眼|沒有|不|也|卻|便|才|已|正|仍)";

  return new RegExp(
    `${leftBoundary}${escaped}${rightEvidence}`,
    "u",
  ).test(source);
}

export function evaluateCandidateAgainstAnchor(bundle = {}, candidateText = "") {
  const report = [];
  const anchor = bundle.content?.chapter_anchor ?? {};
  const required = anchor.required_core_characters ?? [];
  const forbidden = anchor.forbidden_characters ?? [];
  const lc = candidateText.toLocaleLowerCase("zh-Hant");
  const anchorConfidence = bundle.anchor_confidence ?? "low";

  // P0_WRONG_CORE_CAST: main POV lacks required core characters
  // Enforce only when anchor confidence is high (i.e., at least two core names were deterministically found).
  const hasRequired = required.every((name) => containsEntityMention(candidateText, name));
  if (!hasRequired && required.length > 0 && anchorConfidence === "high") {
    report.push({ code: "P0_WRONG_CORE_CAST", message: "Missing required core characters in candidate." });
  }

  // P0_FORBIDDEN_CHARACTER: any forbidden appears
  for (const name of forbidden) {
    if (containsEntityMention(candidateText, name)) {
      report.push({ code: "P0_FORBIDDEN_CHARACTER", message: `Forbidden character present: ${name}` });
    }
  }

  // Result alignment helper
  function extractWinner(token) {
    if (!token) return null;
    const m = String(token).match(/([\p{L}\p{N}\-\u4e00-\u9fff]+)\s*勝/u);
    if (m) return m[1];
    // fallback: contiguous "九逃勝" style
    const m2 = String(token).match(/([\u4e00-\u9fff]{1,10})勝/u);
    if (m2) return m2[1];
    return String(token).trim();
  }

  function resultAlignmentCheck(lockedResultToken, candidateTextLc) {
    if (!lockedResultToken) return { aligned: false, conflict: false };
    const lockedWinner = extractWinner(lockedResultToken) || String(lockedResultToken).trim();
    const winnerLc = String(lockedWinner).toLocaleLowerCase("zh-Hant");

    const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const aliasesFor = (name) => {
      const normalized = String(name || "").toLocaleLowerCase("zh-Hant").replace(/\s+/gu, "");
      const aliases = new Set([normalized]);
      const hanOnly = normalized.replace(/[^\p{Script=Han}]/gu, "");
      if (hanOnly.length >= 2) aliases.add(hanOnly);
      if (hanOnly.length > 2) aliases.add(hanOnly.slice(-2));
      if (hanOnly.length > 3) aliases.add(hanOnly.slice(-3));
      return [...aliases].filter(Boolean);
    };

    const hasOutcomeNearName = (name, outcomePattern) => {
      return aliasesFor(name).some((alias) => {
        const escaped = escapeRegExp(alias);
        return new RegExp(`${escaped}[^\n]{0,6}${outcomePattern}`, "u").test(candidateTextLc);
      });
    };

    const winnerAliases = aliasesFor(winnerLc);

    // candidate explicitly shows locked winner as winning -> aligned
    const winnerWinPatterns = winnerAliases.flatMap((alias) => {
      const escaped = escapeRegExp(alias);
      return [
        new RegExp(`${escaped}\\s*(?:勝|獲勝|勝利)`, "u"),
        new RegExp(`勝者[^\\n]{0,20}${escaped}`, "u"),
        new RegExp(`${escaped}[^\\n]{0,6}勝`, "u"),
      ];
    });
    for (const p of winnerWinPatterns) if (p.test(candidateTextLc)) return { aligned: true, conflict: false };

    // candidate explicitly shows some other core character losing -> aligned
    for (const name of required) {
      if (aliasesFor(name).some((alias) => winnerAliases.includes(alias))) continue;
      if (hasOutcomeNearName(name, "(?:敗|落敗|輸)")) return { aligned: true, conflict: false };
    }

    // candidate explicitly shows locked winner losing -> conflict
    if (hasOutcomeNearName(winnerLc, "(?:敗|落敗|輸)")) return { aligned: false, conflict: true };

    // candidate names a forbidden character as winner -> conflict
    for (const f of forbidden) {
      if (hasOutcomeNearName(f, "(?:勝|獲勝|勝利)")) return { aligned: false, conflict: true };
    }

    // candidate contains explicit opposite-win phrases for other required core names.
    for (const name of required) {
      if (aliasesFor(name).some((alias) => winnerAliases.includes(alias))) continue;
      if (hasOutcomeNearName(name, "(?:勝|獲勝|勝利)")) return { aligned: false, conflict: true };
    }

    // ambiguous: contains result-related keywords but no clear alignment or conflict
    const resultKeywords = ["勝", "敗", "裁定", "中止", "勝利", "獲勝"];
    const mentionsResult = resultKeywords.some((kw) => candidateTextLc.includes(kw));
    if (mentionsResult) return { aligned: false, conflict: false };

    return { aligned: false, conflict: false };
  }
  // P0_RESULT_CONFLICT: locked_result mismatch (use alignment helper plus explicit fallback checks)
  const lockedResult = anchor.locked_result;
  if (lockedResult) {
    const check = resultAlignmentCheck(lockedResult, lc);

    const normalizeOutcomeName = (name) => String(name || "").toLocaleLowerCase("zh-Hant").replace(/\s+/gu, "");
    const escapeOutcomeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const outcomeAliasesFor = (name) => {
      const normalized = normalizeOutcomeName(name);
      const aliases = new Set([normalized]);
      const hanOnly = normalized.replace(/[^\p{Script=Han}]/gu, "");
      if (hanOnly.length >= 2) aliases.add(hanOnly);
      if (hanOnly.length > 2) aliases.add(hanOnly.slice(-2));
      if (hanOnly.length > 3) aliases.add(hanOnly.slice(-3));
      return [...aliases].filter(Boolean);
    };
    const lockedWinner = extractWinner(lockedResult) || String(lockedResult).trim();
    const winnerAliases = outcomeAliasesFor(lockedWinner);
    const sameAsWinner = (name) => outcomeAliasesFor(name).some((alias) => winnerAliases.includes(alias));
    const hasOutcome = (name, outcomePattern) => outcomeAliasesFor(name).some((alias) => {
      const escaped = escapeOutcomeRegExp(alias);
      return new RegExp(`${escaped}[^\\n]{0,6}${outcomePattern}`, "u").test(lc);
    });

    const fallbackConflict =
      hasOutcome(lockedWinner, "(?:敗|落敗|輸)") ||
      required.some((name) => !sameAsWinner(name) && hasOutcome(name, "(?:勝|獲勝|勝利)")) ||
      forbidden.some((name) => hasOutcome(name, "(?:勝|獲勝|勝利)"));

    if (check.conflict || fallbackConflict) {
      report.push({ code: "P0_RESULT_CONFLICT", message: "Candidate result conflicts with locked_result." });
    }
    // if aligned -> no report; if ambiguous -> do not escalate to P0
  }

  // P1_TOO_MANY_NEW_NAMES: detect explicit new character-name introductions only.
  // Do not scan arbitrary 2-4 Han character spans; normal Chinese prose creates massive false positives.
  const normalizeNameToken = (token) => String(token || "")
    .replace(/[「」『』《》〈〉（）()，。、：:；;！!？?\s]/gu, "")
    .toLocaleLowerCase("zh-Hant");

  const knownNameLc = new Set();
  const addKnownName = (name) => {
    const normalized = normalizeNameToken(name);
    if (!normalized) return;
    knownNameLc.add(normalized);
    const hanOnly = normalized.replace(/[^\p{Script=Han}]/gu, "");
    if (hanOnly.length >= 2) knownNameLc.add(hanOnly);
    // Allow short forms for established long names, e.g. 朝日奈千夜 -> 千夜.
    if (hanOnly.length > 2) knownNameLc.add(hanOnly.slice(-2));
    if (hanOnly.length > 3) knownNameLc.add(hanOnly.slice(-3));
  };

  for (const name of required) addKnownName(name);
  for (const name of anchor.allowed_supporting_characters || []) addKnownName(name);
  for (const name of forbidden) addKnownName(name);

  // Phase22N-Lite: small current-arc canonical character whitelist.
  // Keep this curated and local; do not import the full entity registry into this lightweight guard.
  const phase22LiteKnownCharacterNames = [
    "朝日奈千夜", "千夜", "九逃", "貓狼", "雪弟", "御先",
    "伊吹沙耶", "沙耶", "岬戶霖", "岬戶", "宇月",
    "槐野理子", "槐野", "理子",
    "梶浦澄斗", "梶浦", "澄斗",
    "霧生棋乃", "霧生", "棋乃",
    "段篠折", "篠折",
    "白瀨零夜", "零夜",
  ];
  for (const name of phase22LiteKnownCharacterNames) addKnownName(name);

  const nonCharacterTerms = new Set([
    "醫療組", "處置室", "醫療終端", "終端", "裁判組", "值勤教官", "電子牌", "訓練館", "醫療樓",
    "走廊", "擔架", "安全牆", "第一日", "第一場", "候場區", "觀眾", "觀眾席", "警界", "戰鬥紀錄",
    "代表資格", "正式名額", "醫療後座", "短期疼痛", "訓練限制", "明日複查", "換藥", "換藥櫃",
    "長椅", "燈光", "南側", "一號帶", "本體顯現", "裁定中止", "不能沾水", "傷勢", "疼痛",
  ].map((s) => normalizeNameToken(s)));

  const genericNonNamePrefix = /^(醫療|處置|終端|裁判|值勤|電子|訓練|安全|觀眾|警界|戰鬥|代表|正式|候場|短期|疼痛|限制|明日|複查|換藥|場地|走廊|擔架|長椅|燈光|南側|本體|靈力|傷勢|紀錄|後座|流程|測試|候選|章節|正文|標籤|輸出|內容|結果|第一|第二|第三|第四|第五|第六|第七|第八|第九|第十)/u;
  const genericNonNameSuffix = /(室|館|樓|區|牆|牌|組|櫃|床|椅|門|窗|燈|光|水|痛|傷|限制|流程|結果|資格|名額|紀錄|場|日|章|段|行|字|頁)$/u;

  const isLikelyNewCharacterName = (token) => {
    const name = normalizeNameToken(token);
    if (!name) return false;
    if (knownNameLc.has(name)) return false;
    if (nonCharacterTerms.has(name)) return false;
    if (name.length < 2 || name.length > 8) return false;
    if (/^\d+$/u.test(name)) return false;
    if (genericNonNamePrefix.test(name)) return false;
    if (genericNonNameSuffix.test(name)) return false;
    return true;
  };

  const possibleNameDetails = [];
  const collectPattern = (pattern, reason) => {
    for (const match of candidateText.matchAll(pattern)) {
      const rawName = match[1];
      const normalizedName = normalizeNameToken(rawName);
      if (!isLikelyNewCharacterName(normalizedName)) continue;
      possibleNameDetails.push({
        name: normalizedName,
        reason,
        evidence: String(match[0] || rawName).trim(),
        whitelist_status: "not_in_known_name_whitelist",
      });
    }
  };

  // Explicit introduction contexts. These are far safer than arbitrary Han-token scanning for long-form Chinese prose.
  collectPattern(
    /(?:名叫|叫做|叫作|名字是|自稱|登錄為|登記為|代號是|稱為|被稱為)\s*[「『“"]?([\p{Script=Han}·・]{2,8})/gu,
    "explicit_introduction",
  );
  collectPattern(
    /([\p{Script=Han}·・]{2,6})(?:老師|教官|醫師|醫生|同學|學姊|學長|學妹|學弟|主任|院長|組長|裁判長)/gu,
    "role_suffix",
  );

  const dedupedNameDetails = [];
  const seenNewNames = new Set();
  for (const detail of possibleNameDetails) {
    if (seenNewNames.has(detail.name)) continue;
    seenNewNames.add(detail.name);
    dedupedNameDetails.push(detail);
  }
  const possibleNewNames = dedupedNameDetails.map((detail) => detail.name);

  if (possibleNewNames.length > 2) {
    const examples = possibleNewNames.slice(0, 20).join(", ");
    const suffix = possibleNewNames.length > 20 ? ", ..." : "";
    report.push({
      code: "P1_TOO_MANY_NEW_NAMES",
      message: "Candidate adds " + possibleNewNames.length + " possible new names beyond allowed: " + examples + suffix + ".",
      detected_names: possibleNewNames.slice(0, 50),
      detected_name_details: dedupedNameDetails.slice(0, 50),
    });
  }
  return { guard_report: report, blocked: report.some((r) => r.code && r.code.startsWith("P0")) };
}

export default { buildChapterAnchorFromBundle, evaluateCandidateAgainstAnchor };

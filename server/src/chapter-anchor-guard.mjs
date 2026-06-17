// Lightweight Chapter Anchor Guard and candidate evaluation
export function buildChapterAnchorFromBundle(bundle = {}) {
  const content = bundle.content || {};
  const generation = content.generation_context_for_chat || "";
  const retrieval = content.retrieval_context_for_chat || "";
  const writingCard = content.writing_card_excerpt_or_reference || "";
  const longline = content.longline_excerpt_or_reference || "";

  // Use a core context (generation + retrieval + longline) for extracting required core characters.
  // Writing card text is informative but should not by itself create strict required-core constraints.
  const text = [generation, retrieval, longline, writingCard].join("\n").toString();
  const lc = text.toLocaleLowerCase("zh-Hant");

  // Heuristics to extract simple anchor fields.
  const chapter = /第[一二三四五六七八九十百0-9]+章/.exec(text)?.[0] ?? null;
  const must_continue_from = /正式結算後|正式結算/.test(lc) ? "previous chapter settlement" : null;

  // Try find locked_match and locked_result by simple phrase matching
  const locked_match = (text.match(/\b[\p{L}0-9\-\u4e00-\u9fff]+\s*(?:vs|VS|對|vs\.|v\.)\s*[\p{L}0-9\-\u4e00-\u9fff]+/u) || [null])[0];
  const locked_result = (lc.match(/九逃勝|九逃 勝|裁定中止|裁定 中止/) || [null])[0] || null;

  // required core - attempt to identify obvious names from core context (generation/retrieval/longline)
  const coreContext = [generation, retrieval, longline].join("\n");
  const required_core_characters = [];
  if (/朝日奈千夜/.test(coreContext)) required_core_characters.push("朝日奈千夜");
  if (/九逃/.test(coreContext)) required_core_characters.push("九逃");

  const allowed_supporting_characters = [];
  const forbidden_characters = ["江止澄", "蒼藤嵐", "周念今", "安岫", "建瑞凰"];

  const forbidden_events = [
    "新增另一場正式對局結果",
    "改寫九逃勝",
  ];

  const allowed_scope = [
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

export function evaluateCandidateAgainstAnchor(bundle = {}, candidateText = "") {
  const report = [];
  const anchor = bundle.content?.chapter_anchor ?? {};
  const required = anchor.required_core_characters ?? [];
  const forbidden = anchor.forbidden_characters ?? [];
  const lc = candidateText.toLocaleLowerCase("zh-Hant");
  const anchorConfidence = bundle.anchor_confidence ?? "low";

  // P0_WRONG_CORE_CAST: main POV lacks required core characters
  // Enforce only when anchor confidence is high (i.e., at least two core names were deterministically found).
  const hasRequired = required.every((name) => candidateText.includes(name));
  if (!hasRequired && required.length > 0 && anchorConfidence === "high") {
    report.push({ code: "P0_WRONG_CORE_CAST", message: "Missing required core characters in candidate." });
  }

  // P0_FORBIDDEN_CHARACTER: any forbidden appears
  for (const name of forbidden) {
    if (candidateText.includes(name)) {
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

    // candidate explicitly shows locked winner as winning
    const winnerWinPatterns = [
      new RegExp(`${winnerLc}\\s*(?:勝|獲勝|勝利)`),
      new RegExp(`勝者[^\n]{0,20}${winnerLc}`),
      new RegExp(`${winnerLc}[^\n]{0,6}勝`),
    ];
    for (const p of winnerWinPatterns) if (p.test(candidateTextLc)) return { aligned: true, conflict: false };

    // candidate explicitly shows some other core character losing -> aligned
    for (const name of required) {
      const nameLc = String(name).toLocaleLowerCase("zh-Hant");
      if (nameLc === winnerLc) continue;
      if (new RegExp(`${nameLc}[^\n]{0,6}(?:敗|落敗|輸)`).test(candidateTextLc)) return { aligned: true, conflict: false };
    }

    // candidate explicitly shows locked winner losing -> conflict
    if (new RegExp(`${winnerLc}[^\n]{0,6}(?:敗|落敗|輸)`).test(candidateTextLc)) return { aligned: false, conflict: true };

    // candidate names a forbidden character as winner -> conflict
    for (const f of forbidden) {
      const fLc = String(f).toLocaleLowerCase("zh-Hant");
      if (new RegExp(`${fLc}[^\n]{0,6}(?:勝|獲勝|勝利)`).test(candidateTextLc)) return { aligned: false, conflict: true };
    }

    // candidate contains explicit opposite-win phrases for other obvious core names
    for (const name of required) {
      const nameLc = String(name).toLocaleLowerCase("zh-Hant");
      if (new RegExp(`${nameLc}[^\n]{0,6}(?:勝|獲勝|勝利)`).test(candidateTextLc) && nameLc !== winnerLc) {
        return { aligned: false, conflict: true };
      }
    }

    // ambiguous: contains result-related keywords but no clear alignment or conflict
    const resultKeywords = ["勝", "敗", "裁定", "中止", "勝利", "獲勝"];
    const mentionsResult = resultKeywords.some((kw) => candidateTextLc.includes(kw));
    if (mentionsResult) return { aligned: false, conflict: false };

    return { aligned: false, conflict: false };
  }

  // P0_RESULT_CONFLICT: locked_result mismatch (use alignment helper)
  const lockedResult = anchor.locked_result;
  if (lockedResult) {
    const check = resultAlignmentCheck(lockedResult, lc);
    if (check.conflict) {
      report.push({ code: "P0_RESULT_CONFLICT", message: "Candidate result conflicts with locked_result." });
    }
    // if aligned -> no report; if ambiguous -> do not escalate to P0
  }

  // P1_TOO_MANY_NEW_NAMES: count distinct new CJK name-like tokens, excluding stopwords/whitelist
  const rawNameMatches = candidateText.match(/(?:\p{Script=Han}){2,4}/gu) || [];
  const stopwords = new Set([
    "醫療組", "處置室", "醫療終端", "終端", "裁判組", "值勤教官", "電子牌", "訓練館", "醫療樓",
    "走廊", "擔架", "安全牆", "第一日", "第一場", "候場區", "觀眾", "警界", "戰鬥紀錄",
    "代表資格", "正式名額", "醫療後座", "短期疼痛與訓練限制", "觀眾反應", "候場區",
  ].map((s) => s.toLocaleLowerCase("zh-Hant")));
  const filteredNames = [...new Set(rawNameMatches.map((n) => n.toLocaleLowerCase("zh-Hant")))].filter(Boolean).filter((n) => {
    if (required.map((r) => r.toLocaleLowerCase("zh-Hant")).includes(n)) return false;
    if ((anchor.allowed_supporting_characters || []).map((r) => r.toLocaleLowerCase("zh-Hant")).includes(n)) return false;
    if (stopwords.has(n)) return false;
    // ignore purely numeric-like or single char tokens
    if (/^\d+$/.test(n)) return false;
    return true;
  });
  const newNamesCount = Math.max(0, filteredNames.length - (anchor.allowed_supporting_characters?.length ?? 0) - required.length);
  if (newNamesCount > 2) {
    report.push({ code: "P1_TOO_MANY_NEW_NAMES", message: `Candidate adds ${newNamesCount} new names beyond allowed.` });
  }

  return { guard_report: report, blocked: report.some((r) => r.code && r.code.startsWith("P0")) };
}

export default { buildChapterAnchorFromBundle, evaluateCandidateAgainstAnchor };

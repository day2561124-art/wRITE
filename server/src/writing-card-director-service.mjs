// Deterministic, local-only Writing Card Director
// Exports: buildWritingCardDirectorContext(input = {})
export function buildWritingCardDirectorContext(input = {}) {
  const taskPrompt = typeof input.taskPrompt === "string" ? input.taskPrompt : String(input.task_prompt ?? "");
  const generationContext = input.generationContext ?? input.generation_context ?? {};
  const retrievalContext = input.retrievalContext ?? input.retrieval_context ?? {};
  const writingCardText = typeof input.writingCardText === "string" ? input.writingCardText : String(input.writing_card_text ?? "");
  const candidateText = typeof input.candidateText === "string" ? input.candidateText : String(input.candidate_text ?? "");

  const combinedText = [
    taskPrompt,
    JSON.stringify(generationContext),
    JSON.stringify(retrievalContext),
    writingCardText,
    candidateText,
  ].join("\n").toLowerCase();

  const keywords = {
    battle: ["battle", "fight", "attack", "selection", "選拔", "戰鬥", "招式", "裁定"],
    romance: ["love", "kiss", "romance", "affair", "曖昧", "戀愛", "告白", "曖昧距離"],
    daily: ["day", "daily", "breakfast", "class", "日常", "日常生活", "社團"],
    longline: ["longline", "payoff", "伏筆", "長線", "章尾", "鋪陳"],
    world: ["rule", "system", "world", "制度", "規則", "世界觀"],
  };

  function countMatches(list) {
    let count = 0;
    for (const kw of list) {
      const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gu");
      const m = combinedText.match(re);
      if (m) count += m.length;
    }
    return count;
  }

  const counts = Object.fromEntries(Object.entries(keywords).map(([k, v]) => [k, countMatches(v)]));
  const maxKey = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "daily";

  const twelve_core_judgments = [
    "canon_judgment",
    "chapter_promise_judgment",
    "scene_function_judgment",
    "ensemble_lens_judgment",
    "character_desire_judgment",
    "conflict_pressure_judgment",
    "creative_boldness_judgment",
    "world_rule_pressure_judgment",
    "dialogue_subtext_judgment",
    "reader_immersion_judgment",
    "battle_selection_judgment",
    "revision_judgment",
  ];

  const archetype_engines = [
    "Araki SBR Character Engine",
    "Arakawa Grounded Ensemble Engine",
    "Togashi Rule-Game Engine",
    "Oda Longline-Payoff Engine",
    "Isayama Reversal Engine",
  ];

  const scene_engine_rules = {
    battle: {
      avoid_move_listings: true,
      require_rules_and_costs: true,
      require_aftermath: true,
    },
    romance: {
      avoid_therapy_tone: true,
      prefer_action_over_spiels: true,
      keep_pressure: true,
    },
    daily: {
      texture_required: true,
      hide_exposition: true,
    },
  };

  const heuristic = {
    combined_text_sample: combinedText.slice(0, 400),
    counts,
    predominant_tone: maxKey,
    selected_archetype: (() => {
      if (maxKey === "battle") return "Togashi Rule-Game Engine";
      if (maxKey === "romance") return "Araki SBR Character Engine";
      if (maxKey === "longline") return "Oda Longline-Payoff Engine";
      if (maxKey === "world") return "Arakawa Grounded Ensemble Engine";
      return "Arakawa Grounded Ensemble Engine";
    })(),
  };

  // Simple chapter anchor summary extraction
  const chapter = (combinedText.match(/第[一二三四五六七八九十百0-9]+章/u) || [null])[0];
  const required_core_characters = [];
  if (combinedText.includes("朝日奈千夜")) required_core_characters.push("朝日奈千夜");
  if (combinedText.includes("九逃")) required_core_characters.push("九逃");
  const forbidden_characters = ["江止澄", "蒼藤嵐", "周念今", "安岫", "建瑞凰"].filter((n) => combinedText.includes(n));
  const locked_result = combinedText.includes("九逃勝") || combinedText.includes("九逃 勝") ? "九逃勝，裁定中止" : null;
  const anchor_confidence = required_core_characters.length >= 2 ? "high" : "low";
  const guard_severity = anchor_confidence === "high" ? "medium" : "high";


  return {
    version: "v1.0.0",
    context_kind: "writing_card_director_context",
    created_at: new Date().toISOString(),
    source: "writing_card_director_service",
    basis: {
      writing_card_version: "v3.0",
    },
    fusion_mode: "mature_creator_fused_into_writing_card",
    twelve_core_judgments,
    archetype_engines,
    scene_engine_rules,
    heuristics: heuristic,
    input_summary: {
      task_prompt_present: Boolean(taskPrompt && taskPrompt.length > 0),
      generation_context_keys: Object.keys(generationContext || {}),
      retrieval_context_keys: Object.keys(retrievalContext || {}),
      writing_card_excerpt_length: writingCardText.length,
      candidate_excerpt_length: candidateText.length,
    },
    chapter_anchor_summary: {
      chapter: chapter ?? null,
      required_core_characters,
      forbidden_characters,
      locked_result: locked_result,
      anchor_confidence,
      guard_severity,
    },
  };
}

export default buildWritingCardDirectorContext;

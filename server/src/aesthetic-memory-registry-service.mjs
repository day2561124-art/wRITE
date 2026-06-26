import { createHash } from "node:crypto";

export const aestheticMemoryRegistryVersion = "aesthetic_memory_registry_v1";

const allowedCategories = new Set([
  "prose_style",
  "pacing",
  "dialogue",
  "character_life",
  "scene_structure",
  "world_consistency",
  "reader_experience",
  "ui_readability",
  "safety",
  "other",
]);

const allowedPolarities = new Set(["prefer", "avoid", "require", "watch"]);
const requiredCoverageCategories = [
  "prose_style",
  "pacing",
  "dialogue",
  "character_life",
  "scene_structure",
  "world_consistency",
  "reader_experience",
];

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value, maximum = 500) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim()).slice(0, maximum).join("");
}

function clampInteger(value, fallback = 50) {
  const number = Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(0, Math.min(100, number));
}

function slug(value, fallback) {
  const source = text(value, 160)
    .toLocaleLowerCase("zh-Hant-TW")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 80);
  return source || fallback;
}

function normalizeCategory(value) {
  const category = text(value, 80).toLocaleLowerCase("en-US");
  return allowedCategories.has(category) ? category : "other";
}

function normalizePolarity(value) {
  const polarity = text(value, 80).toLocaleLowerCase("en-US");
  if (allowedPolarities.has(polarity)) return polarity;
  if (["positive", "liked", "like", "keep"].includes(polarity)) return "prefer";
  if (["negative", "disliked", "ban", "forbid", "reject"].includes(polarity)) return "avoid";
  return "prefer";
}

function stringList(value, maximum = 12, itemMaximum = 240) {
  return array(value)
    .map((item) => text(typeof item === "string" ? item : JSON.stringify(item ?? ""), itemMaximum))
    .filter(Boolean)
    .slice(0, maximum);
}

function defaultSeedEntries() {
  return [
    {
      key: "avoid_flowchart_prose",
      category: "prose_style",
      polarity: "avoid",
      label: "避免流程化與公告式語氣",
      rule: "正文應先讓人物、動作、物件與壓力成立，不要寫成流程、窗口、公告或核對表口吻。",
      rationale: "使用者長期偏好活人小說手感，明確排斥流程化、公告式與行政式攻防。",
      strength: 98,
      applies_to: ["generation", "revision", "final_polisher", "proofing"],
      examples: ["先寫門禁燈、手勢、停頓與代價，再寫規則。"],
    },
    {
      key: "avoid_queue_dialogue",
      category: "dialogue",
      polarity: "avoid",
      label: "避免角色排隊發言",
      rule: "對話不能像每個角色輪流報告；角色應有打斷、沉默、誤會、閃避、短促反應與生活感。",
      rationale: "群像角色需要像活人，而不是站成一排交付資訊。",
      strength: 95,
      applies_to: ["generation", "revision", "dialogue_pass"],
      examples: ["不把每句話都寫得像上班。"],
    },
    {
      key: "require_one_chapter_one_change",
      category: "pacing",
      polarity: "require",
      label: "一章一變局",
      rule: "每章至少要讓局面產生實質變化，不能只有更漂亮的說明或原地整理。",
      rationale: "使用者要求節奏加速、高密度、一章一變局。",
      strength: 97,
      applies_to: ["generation", "revision", "final_polisher", "reader_response"],
      examples: ["章尾應留下新的代價、新路線、新敵意或新問題。"],
    },
    {
      key: "prefer_living_character_behavior",
      category: "character_life",
      polarity: "prefer",
      label: "角色像活人",
      rule: "允許角色猶豫、煩躁、講錯話、沉默、逃避與不漂亮選擇；不要把角色寫成工具人。",
      rationale: "使用者偏好角色有生活反應與心理縫隙。",
      strength: 96,
      applies_to: ["generation", "revision", "character_simulator"],
      examples: ["沉默可以是抗拒、尷尬或不被理解，而不是只代表深沉。"],
    },
    {
      key: "require_world_consistent_creativity",
      category: "world_consistency",
      polarity: "require",
      label: "創作自由必須基於世界觀",
      rule: "可創作伏筆、支線、反派、能力演出與場景候選，但必須基於既有世界觀、能力規則與正史邊界。",
      rationale: "使用者授權候選創作自由，但禁止脫離世界觀另造不相容設定。",
      strength: 100,
      applies_to: ["generation", "revision", "settlement", "proofing"],
      examples: ["新增能力演出必須能回到靈力與異能武裝規則。"],
    },
    {
      key: "prefer_concrete_scene_pressure",
      category: "scene_structure",
      polarity: "prefer",
      label: "用具體場面承壓",
      rule: "場景壓力應落在位置、距離、物件、動作、光線、傷痛、通知、路線與選擇上。",
      rationale: "使用者偏好可感的場面，不喜歡抽象標語與主題先行。",
      strength: 92,
      applies_to: ["generation", "revision", "battle", "daily_life"],
      examples: ["用終端地圖的舊路線熄滅來表現代價。"],
    },
    {
      key: "prefer_reader_continuation_pressure",
      category: "reader_experience",
      polarity: "prefer",
      label: "讀者想追下去",
      rule: "章尾應留下具體未解壓力，而不是作者總結或漂亮金句。",
      rationale: "讀者體感模擬器需要與一章一變局、鉤子、跳讀風險連動。",
      strength: 91,
      applies_to: ["reader_response", "final_polisher", "revision"],
      examples: ["門內有人喊出千夜名字，讓讀者想知道原因。"],
    },
    {
      key: "prefer_readable_ui_summary",
      category: "ui_readability",
      polarity: "prefer",
      label: "UI 要成人話摘要",
      rule: "UI surface 應顯示一眼看懂的狀態卡、人話摘要、紅黃綠風險與可展開細節，不要只丟 raw JSON。",
      rationale: "使用者明確表示 UI 要人性化，否則會看不懂。",
      strength: 94,
      applies_to: ["ui_surface", "bridge_preview", "operator_review"],
      examples: ["顯示『跳讀風險：中』，不要只顯示 skim_risk=0.62。"],
    },
    {
      key: "avoid_theme_first_slogans",
      category: "prose_style",
      polarity: "avoid",
      label: "避免主題先行與金句化",
      rule: "不要為了主題安排說教、標語或作者總結；主題若出現應由劇情自然長出。",
      rationale: "使用者不追求主題先行，偏好劇情與角色自然推進。",
      strength: 90,
      applies_to: ["generation", "revision", "final_polisher"],
      examples: ["不要讓角色突然說章名式意象。"],
    },
  ];
}

function normalizeEntry(rawEntry, index) {
  const entry = object(rawEntry);
  const label = text(entry.label ?? entry.title ?? entry.name ?? entry.rule, 160);
  const rule = text(entry.rule ?? entry.body ?? entry.description ?? entry.value ?? label, 700);
  const key = slug(entry.key ?? entry.id ?? label ?? rule, `aesthetic_memory_${index + 1}`);
  const polarity = normalizePolarity(entry.polarity ?? entry.preference ?? entry.kind ?? entry.type);
  const category = normalizeCategory(entry.category ?? entry.area ?? entry.scope);
  return {
    key,
    label: label || key,
    category,
    polarity,
    strength: clampInteger(entry.strength ?? entry.weight ?? entry.priority, polarity === "require" ? 90 : 80),
    rule: rule || label || key,
    rationale: text(entry.rationale ?? entry.reason ?? entry.source_note, 700),
    applies_to: stringList(entry.applies_to ?? entry.appliesTo ?? entry.targets, 10, 120),
    examples: stringList(entry.examples ?? entry.evidence, 6, 240),
    source: text(entry.source ?? entry.source_type ?? entry.sourceType ?? "phase30a_contract", 120),
  };
}

function entriesFromStrings(values, category, polarity, source) {
  return stringList(values, 24, 320).map((value, index) => ({
    key: `${source}_${index + 1}`,
    label: value,
    category,
    polarity,
    rule: value,
    strength: polarity === "avoid" ? 88 : 82,
    applies_to: ["generation", "revision", "final_polisher"],
    source,
  }));
}

function collectEntries(rawInput, options) {
  const input = object(rawInput);
  const includeDefaultSeed = options.includeDefaultSeed ?? input.include_default_seed ?? input.includeDefaultSeed ?? true;
  const entries = [
    ...(includeDefaultSeed ? defaultSeedEntries() : []),
    ...array(input.aesthetic_memory_entries ?? input.aestheticMemoryEntries ?? input.entries),
    ...entriesFromStrings(input.accepted_patterns ?? input.acceptedPatterns, "prose_style", "prefer", "accepted_pattern"),
    ...entriesFromStrings(input.rejected_patterns ?? input.rejectedPatterns, "prose_style", "avoid", "rejected_pattern"),
    ...entriesFromStrings(input.style_principles ?? input.stylePrinciples, "prose_style", "require", "style_principle"),
    ...entriesFromStrings(input.ui_preferences ?? input.uiPreferences, "ui_readability", "prefer", "ui_preference"),
  ];
  const seen = new Set();
  const normalized = [];
  for (const rawEntry of entries) {
    const entry = normalizeEntry(rawEntry, normalized.length);
    const duplicateKey = `${entry.key}:${entry.category}:${entry.polarity}`;
    if (!entry.rule || seen.has(duplicateKey)) continue;
    seen.add(duplicateKey);
    normalized.push(entry);
  }
  return normalized.slice(0, 80);
}

function coverageFor(entries) {
  const byCategory = Object.fromEntries([...allowedCategories].map((category) => [category, 0]));
  const byPolarity = Object.fromEntries([...allowedPolarities].map((polarity) => [polarity, 0]));
  for (const entry of entries) {
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
    byPolarity[entry.polarity] = (byPolarity[entry.polarity] ?? 0) + 1;
  }
  const missingCategories = requiredCoverageCategories.filter((category) => (byCategory[category] ?? 0) === 0);
  const missingPolarity = [];
  if ((byPolarity.prefer ?? 0) === 0 && (byPolarity.require ?? 0) === 0) missingPolarity.push("missing_positive_preferences");
  if ((byPolarity.avoid ?? 0) === 0) missingPolarity.push("missing_avoidance_rules");
  return {
    by_category: byCategory,
    by_polarity: byPolarity,
    required_categories: requiredCoverageCategories,
    missing_categories: missingCategories,
    missing_polarity: missingPolarity,
    complete: missingCategories.length === 0 && missingPolarity.length === 0 && entries.length > 0,
  };
}

function scoreFor(entries, coverage) {
  const averageStrength = entries.length
    ? Math.round(entries.reduce((sum, entry) => sum + entry.strength, 0) / entries.length)
    : 0;
  const coveragePenalty = (coverage.missing_categories.length * 7) + (coverage.missing_polarity.length * 10);
  return Math.max(0, Math.min(100, averageStrength - coveragePenalty));
}

function buildCards(entries, coverage, score) {
  const requiredCount = entries.filter((entry) => entry.polarity === "require").length;
  const preferCount = entries.filter((entry) => entry.polarity === "prefer").length;
  const avoidCount = entries.filter((entry) => entry.polarity === "avoid").length;
  const watchCount = entries.filter((entry) => entry.polarity === "watch").length;
  return [
    {
      key: "aesthetic_memory_overall",
      label: "審美記憶",
      value: `${score}%`,
      tone: score >= 76 ? "safe" : score >= 55 ? "watch" : "blocked",
      summary: coverage.complete ? "Long-term aesthetic memory coverage is usable." : "Aesthetic memory coverage is incomplete.",
    },
    {
      key: "positive_preferences",
      label: "偏好",
      value: String(preferCount + requiredCount),
      tone: preferCount + requiredCount > 0 ? "safe" : "blocked",
      summary: "Preferences and required principles available for generation and revision.",
    },
    {
      key: "avoidance_rules",
      label: "禁忌",
      value: String(avoidCount),
      tone: avoidCount > 0 ? "safe" : "blocked",
      summary: "Avoidance rules prevent drift into disliked prose habits.",
    },
    {
      key: "coverage_categories",
      label: "覆蓋面",
      value: `${requiredCoverageCategories.length - coverage.missing_categories.length}/${requiredCoverageCategories.length}`,
      tone: coverage.missing_categories.length ? "watch" : "safe",
      summary: coverage.missing_categories.join(", ") || "Required aesthetic categories covered.",
    },
    {
      key: "watch_items",
      label: "觀察項",
      value: String(watchCount),
      tone: watchCount > 0 ? "watch" : "safe",
      summary: "Watch items are reminders, not hard blocks.",
    },
  ];
}

function buildProviderContract(entries) {
  const requiredPrinciples = entries.filter((entry) => entry.polarity === "require").map((entry) => entry.key);
  const preferredPatterns = entries.filter((entry) => entry.polarity === "prefer").map((entry) => entry.key);
  const prohibitedPatterns = entries.filter((entry) => entry.polarity === "avoid").map((entry) => entry.key);
  return {
    generation_payload_key: "aesthetic_memory_registry",
    revision_payload_key: "aesthetic_memory_registry",
    final_polisher_payload_key: "aesthetic_memory_registry",
    reader_response_payload_key: "aesthetic_memory_registry",
    candidate_report_key: "aesthetic_memory_registry",
    required_principles: requiredPrinciples,
    preferred_patterns: preferredPatterns,
    prohibited_patterns: prohibitedPatterns,
    usage_notes: [
      "Use these memories as reader-facing taste guidance, not as Canon facts.",
      "Do not apply aesthetic memories by writing active_engine or compressed_rules.",
      "When a preference conflicts with Canon/world rules, Canon/world rules win.",
    ],
  };
}

export async function buildAestheticMemoryRegistryContract(rawInput = {}, options = {}) {
  const entries = collectEntries(rawInput, options);
  const coverage = coverageFor(entries);
  const score = scoreFor(entries, coverage);
  const missing = [
    ...(entries.length ? [] : ["missing_aesthetic_memory_entries"]),
    ...coverage.missing_categories.map((category) => `missing_category_${category}`),
    ...coverage.missing_polarity,
  ];
  const status = missing.length ? "incomplete" : "completed";
  const source = {
    input_digest: sha256(JSON.stringify(object(rawInput))),
    entries_digest: sha256(JSON.stringify(entries)),
    entry_count: entries.length,
    default_seed_used: (options.includeDefaultSeed ?? object(rawInput).include_default_seed ?? object(rawInput).includeDefaultSeed ?? true) === true,
  };
  const registry = {
    used: true,
    phase: "30A",
    version: aestheticMemoryRegistryVersion,
    registry_kind: "aesthetic_memory_registry",
    memory_scope: "long_term_aesthetic_memory",
    status,
    read_only: true,
    contract_only: true,
    preview_only: true,
    candidate_only: true,
    no_generation: true,
    no_auto_persist: true,
    no_candidate_save: true,
    no_approval: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    no_runtime_ui: true,
    no_mcp_tool: true,
    source,
    entries,
    coverage,
    aesthetic_memory_score: score,
    cards: buildCards(entries, coverage, score),
    provider_contract: buildProviderContract(entries),
    safety_boundary: {
      read_only: true,
      contract_only: true,
      preview_only: true,
      candidate_only: true,
      no_generation: true,
      no_auto_persist: true,
      no_candidate_save: true,
      no_approval: true,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      candidate_saved: false,
      canon_written: false,
      approval_item_created: false,
      runtime_ui_modified: false,
      mcp_tool_added: false,
      memory_file_written: false,
    },
    missing_fields: missing,
    warnings: [
      ...(missing.length ? ["aesthetic_memory_registry_incomplete"] : []),
      ...(coverage.missing_categories.length ? ["aesthetic_memory_category_coverage_incomplete"] : []),
    ],
  };
  registry.trace_id = `aesthetic_memory_${sha256(JSON.stringify({ status, score, source, coverage })).slice(0, 16)}`;
  return registry;
}

export default buildAestheticMemoryRegistryContract;

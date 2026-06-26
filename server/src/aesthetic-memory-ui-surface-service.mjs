import { buildAestheticMemoryRegistryContract } from "./aesthetic-memory-registry-service.mjs";

export const aestheticMemoryUiSurfaceVersion = "aesthetic_memory_ui_surface_v1";

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

function integer(value, fallback = 0) {
  return Number.isInteger(value) ? value : fallback;
}

function scoreNumber(value) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

function toneFor(tone) {
  if (tone === "safe" || tone === "ready") return "ready";
  if (tone === "watch" || tone === "warning") return "watch";
  if (tone === "blocked") return "blocked";
  return "neutral";
}

function statusFrom(registry) {
  const score = scoreNumber(registry.aesthetic_memory_score);
  if (registry.status !== "completed") return "needs_context";
  if (score >= 76) return "ready";
  if (score >= 55) return "watch";
  return "needs_repair";
}

function statusBadge(status) {
  if (status === "ready") {
    return {
      label: "審美記憶完整",
      class_name: "candidate-status-activated",
      tone: "ready",
    };
  }
  if (status === "watch") {
    return {
      label: "審美記憶需注意",
      class_name: "candidate-status-candidate",
      tone: "watch",
    };
  }
  if (status === "needs_context") {
    return {
      label: "缺少審美上下文",
      class_name: "candidate-status-rejected",
      tone: "empty",
    };
  }
  return {
    label: "審美記憶需修復",
    class_name: "candidate-status-blocked",
    tone: "blocked",
  };
}

function percentage(value) {
  return `${scoreNumber(value)}%`;
}

function normalizeCard(card) {
  const item = object(card);
  return {
    key: text(item.key, 120) || "unknown",
    label: text(item.label, 120) || text(item.title, 120) || "未命名卡片",
    value: text(String(item.value ?? ""), 80) || percentage(item.score),
    tone: toneFor(item.tone),
    summary: text(item.summary, 500),
  };
}

function polarityLabel(polarity) {
  if (polarity === "avoid") return "禁忌";
  if (polarity === "require") return "必守";
  if (polarity === "watch") return "觀察";
  return "偏好";
}

function entryTone(entry) {
  if (entry.polarity === "avoid") return "blocked";
  if (entry.polarity === "watch") return "watch";
  return "ready";
}

function summarizeEntry(entry) {
  return {
    key: text(entry.key, 120) || "aesthetic_memory_entry",
    label: text(entry.label, 160) || text(entry.rule, 160) || "審美記憶項目",
    category: text(entry.category, 80) || "other",
    category_label: categoryLabel(entry.category),
    polarity: text(entry.polarity, 80) || "prefer",
    polarity_label: polarityLabel(entry.polarity),
    strength: scoreNumber(entry.strength),
    value: `${polarityLabel(entry.polarity)} · ${scoreNumber(entry.strength)}%`,
    tone: entryTone(entry),
    rule: text(entry.rule, 700),
    rationale: text(entry.rationale, 700),
    applies_to: array(entry.applies_to).map((item) => text(item, 120)).filter(Boolean),
    examples: array(entry.examples).map((item) => text(item, 240)).filter(Boolean),
  };
}

function categoryLabel(category) {
  const labels = {
    prose_style: "文體手感",
    pacing: "節奏",
    dialogue: "對話",
    character_life: "角色活人感",
    scene_structure: "場面結構",
    world_consistency: "世界觀一致性",
    reader_experience: "讀者體感",
    ui_readability: "UI 可讀性",
    safety: "安全邊界",
    other: "其他",
  };
  return labels[category] ?? labels.other;
}

function categoryRows(coverage) {
  const byCategory = object(coverage.by_category);
  const missing = new Set(array(coverage.missing_categories).map((item) => text(item, 80)));
  return Object.keys(byCategory).sort().map((category) => ({
    key: category,
    label: categoryLabel(category),
    value: String(integer(byCategory[category], 0)),
    count: integer(byCategory[category], 0),
    tone: missing.has(category) ? "watch" : integer(byCategory[category], 0) > 0 ? "ready" : "neutral",
    missing: missing.has(category),
  }));
}

function safetyBadges(registry) {
  const safety = object(registry.safety_boundary);
  const mutation = object(registry.no_mutation_snapshot);
  return [
    ["read_only", "只讀", safety.read_only === true, false],
    ["preview_only", "只預覽", safety.preview_only === true, false],
    ["candidate_only", "候選階段", safety.candidate_only === true, false],
    ["no_candidate_save", "不保存候選", safety.no_candidate_save === true, false],
    ["can_write_canon", "可寫入正史", safety.can_write_canon === true, true],
    ["can_update_active_engine", "可更新 active_engine", safety.can_update_active_engine === true, true],
    ["can_update_compressed_rules", "可更新 compressed_rules", safety.can_update_compressed_rules === true, true],
    ["can_modify_runtime_ui", "可修改 runtime UI", safety.can_modify_runtime_ui === true, true],
    ["can_register_mcp_tool", "可註冊 MCP tool", safety.can_register_mcp_tool === true, true],
    ["memory_file_written", "已寫入記憶檔", mutation.memory_file_written === true, true],
    ["mcp_tool_added", "已新增 MCP tool", mutation.mcp_tool_added === true, true],
  ].map(([key, label, value, dangerous]) => ({
    key,
    label,
    value,
    tone: dangerous ? (value ? "blocked" : "ready") : (value ? "ready" : "blocked"),
    allowed: dangerous ? false : value === true,
    denied: dangerous ? value !== true : false,
  }));
}

function humanSummary(registry, status) {
  const entries = array(registry.entries);
  const coverage = object(registry.coverage);
  const score = scoreNumber(registry.aesthetic_memory_score);
  const avoid = entries.filter((entry) => entry.polarity === "avoid").length;
  const prefer = entries.filter((entry) => entry.polarity === "prefer" || entry.polarity === "require").length;
  if (status === "needs_context") {
    return "審美記憶 registry 缺少必要分類或偏好／禁忌項目；目前只能作為不完整預覽，不應直接餵給寫作流程。";
  }
  const base = `審美記憶分數 ${percentage(score)}；偏好／必守 ${prefer} 項；禁忌 ${avoid} 項；必要覆蓋 ${array(coverage.required_categories).length - array(coverage.missing_categories).length}/${array(coverage.required_categories).length}。`;
  if (status === "ready") return `${base} 目前足以作為寫作、修稿、驗稿與讀者體感的長期審美參考。`;
  if (status === "watch") return `${base} 目前可讀，但仍需補齊黃色覆蓋項或降低模糊偏好。`;
  return `${base} 審美記憶不足，建議先補禁忌、偏好與世界觀一致性條款。`;
}

function buildSections(registry) {
  const entries = array(registry.entries).map(summarizeEntry);
  const required = entries.filter((entry) => entry.polarity === "require");
  const preferred = entries.filter((entry) => entry.polarity === "prefer");
  const forbidden = entries.filter((entry) => entry.polarity === "avoid");
  const watch = entries.filter((entry) => entry.polarity === "watch");
  const coverage = object(registry.coverage);
  const provider = object(registry.provider_contract);
  return [
    {
      key: "at_a_glance",
      title: "一眼看懂",
      summary: "把 30A 的 registry contract 轉成人類可讀卡片。",
      items: array(registry.cards).map(normalizeCard),
    },
    {
      key: "forbidden_patterns",
      title: "禁止項目",
      summary: forbidden.length ? "這些手感應主動避開。" : "目前沒有明確禁忌項目，建議補充。",
      items: forbidden,
    },
    {
      key: "preferred_patterns",
      title: "偏好項目",
      summary: preferred.length ? "這些是寫作與修稿時應靠近的手感。" : "目前沒有明確偏好項目。",
      items: preferred,
    },
    {
      key: "required_principles",
      title: "必守原則",
      summary: required.length ? "這些原則應進入寫作、修稿與驗稿上下文。" : "目前沒有必守原則。",
      items: required,
    },
    {
      key: "watch_items",
      title: "觀察項",
      summary: watch.length ? "這些不是硬性阻擋，但需要人工留意。" : "目前沒有額外觀察項。",
      items: watch,
    },
    {
      key: "coverage",
      title: "覆蓋狀態",
      summary: array(coverage.missing_categories).length
        ? `缺少：${array(coverage.missing_categories).join("、")}`
        : "必要審美分類已覆蓋。",
      items: categoryRows(coverage),
    },
    {
      key: "provider_usage",
      title: "流程使用方式",
      summary: "這些記憶只能作為審美參考，不是 Canon 事實，也不會直接改規則。",
      items: [
        {
          key: "generation_payload_key",
          label: "寫作 payload",
          value: text(provider.generation_payload_key, 120),
          tone: "ready",
        },
        {
          key: "revision_payload_key",
          label: "修稿 payload",
          value: text(provider.revision_payload_key, 120),
          tone: "ready",
        },
        {
          key: "final_polisher_payload_key",
          label: "最終潤飾 payload",
          value: text(provider.final_polisher_payload_key, 120),
          tone: "ready",
        },
        {
          key: "reader_response_payload_key",
          label: "讀者體感 payload",
          value: text(provider.reader_response_payload_key, 120),
          tone: "ready",
        },
      ],
    },
    {
      key: "safety_boundary",
      title: "安全邊界",
      summary: "此 UI surface 只顯示審美記憶，不保存候選、不寫正史、不更新引擎、不新增 MCP tool。",
      items: safetyBadges(registry),
    },
  ];
}

function nextAction(status) {
  if (status === "ready") {
    return {
      key: "manual_aesthetic_review",
      label: "人工檢查審美記憶摘要",
      route: "#aesthetic-memory",
      ui_target: "aesthetic-memory",
      reason: "審美記憶覆蓋完整，可人工確認後再接 bridge preview。",
      enabled: true,
    };
  }
  if (status === "watch") {
    return {
      key: "inspect_aesthetic_warnings",
      label: "先檢查黃色覆蓋項",
      route: "#aesthetic-memory",
      ui_target: "aesthetic-memory",
      reason: "審美記憶可讀，但仍有分類或強度需要人工確認。",
      enabled: true,
    };
  }
  return {
    key: "repair_aesthetic_memory_registry",
    label: "先補齊審美記憶 registry",
    route: "#aesthetic-memory",
    ui_target: "aesthetic-memory",
    reason: "審美記憶缺少必要偏好、禁忌或分類覆蓋；此 surface 不會自動寫入任何記憶檔。",
    enabled: true,
  };
}

function markdownFor(surface) {
  return [
    "## Aesthetic Memory Registry UI Surface",
    "",
    `- phase: ${surface.phase}`,
    `- source_phase: ${surface.source_phase}`,
    `- status: ${surface.status}`,
    `- headline: ${surface.headline}`,
    `- aesthetic_memory_score: ${surface.aesthetic_memory_score}`,
    `- read_only: ${surface.safety.read_only}`,
    `- preview_only: ${surface.safety.preview_only}`,
    `- can_write_canon: ${surface.safety.can_write_canon}`,
    `- can_update_active_engine: ${surface.safety.can_update_active_engine}`,
    `- memory_file_written: ${surface.safety.memory_file_written}`,
    "",
    "### Cards",
    ...surface.overview_cards.map((card) => `- ${card.label}: ${card.value} (${card.tone})`),
    "",
  ].join("\n");
}

export async function buildAestheticMemoryUiSurface(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedRegistry = object(options.registry ?? input.aesthetic_memory_registry ?? input.aestheticMemoryRegistry ?? input.registry);
  const registry = providedRegistry.phase === "30A"
    ? providedRegistry
    : await buildAestheticMemoryRegistryContract(input, options);
  const status = statusFrom(registry);
  const coverage = object(registry.coverage);
  const mutation = object(registry.no_mutation_snapshot);
  const safety = object(registry.safety_boundary);
  const sections = buildSections(registry);
  const surface = {
    used: registry.used === true,
    phase: "30B",
    version: aestheticMemoryUiSurfaceVersion,
    ui_kind: "aesthetic_memory_registry_ui_surface",
    source_phase: text(registry.phase, 40) || "30A",
    source_version: text(registry.version, 160) || null,
    status,
    status_badge: statusBadge(status),
    headline: status === "ready"
      ? "審美記憶可以使用"
      : status === "watch"
        ? "審美記憶需要注意"
        : status === "needs_context"
          ? "審美記憶缺少上下文"
          : "審美記憶建議先修復",
    summary: humanSummary(registry, status),
    aesthetic_memory_score: scoreNumber(registry.aesthetic_memory_score),
    coverage_summary: {
      complete: coverage.complete === true,
      missing_categories: array(coverage.missing_categories).map((item) => text(item, 80)).filter(Boolean),
      missing_polarity: array(coverage.missing_polarity).map((item) => text(item, 120)).filter(Boolean),
    },
    overview_cards: array(registry.cards).map(normalizeCard),
    sections,
    next_operator_action: nextAction(status),
    safety_badges: safetyBadges(registry),
    safety: {
      read_only: true,
      preview_only: true,
      candidate_only: registry.candidate_only === true,
      no_auto_persist: registry.no_auto_persist === true,
      no_generation: registry.no_generation === true,
      no_candidate_save: registry.no_candidate_save === true,
      no_approval: registry.no_approval === true,
      no_canon_update: registry.no_canon_update === true,
      no_active_engine_update: registry.no_active_engine_update === true,
      no_compressed_rules_update: registry.no_compressed_rules_update === true,
      can_write_canon: safety.can_write_canon === true,
      can_update_active_engine: safety.can_update_active_engine === true,
      can_update_compressed_rules: safety.can_update_compressed_rules === true,
      can_modify_runtime_ui: safety.can_modify_runtime_ui === true,
      can_register_mcp_tool: safety.can_register_mcp_tool === true,
      active_engine_modified: mutation.active_engine_modified === true,
      compressed_rules_modified: mutation.compressed_rules_modified === true,
      candidate_saved: mutation.candidate_saved === true,
      canon_written: mutation.canon_written === true,
      approval_item_created: mutation.approval_item_created === true,
      runtime_ui_modified: mutation.runtime_ui_modified === true,
      mcp_tool_added: mutation.mcp_tool_added === true,
      memory_file_written: mutation.memory_file_written === true,
    },
    raw_registry: options.include_raw === true || input.include_raw === true || input.includeRaw === true ? registry : null,
  };
  surface.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(surface);
  return surface;
}

export default buildAestheticMemoryUiSurface;

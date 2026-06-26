import { createHash } from "node:crypto";
import { buildAestheticMemoryBridgePreview } from "./aesthetic-memory-bridge-preview-service.mjs";

export const aestheticMemoryInjectionReadinessGateVersion = "aesthetic_memory_injection_readiness_gate_v1";

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function stableDigest(value) {
  return sha256(JSON.stringify(value ?? null));
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

function number(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(number(value, 0))));
}

function sectionByKey(preview, key) {
  return array(preview.bridge_sections).find((section) => object(section).key === key) ?? null;
}

function cardByKey(preview, key) {
  return array(preview.overview_cards).find((card) => object(card).key === key) ?? null;
}

function sectionItems(preview, key) {
  return array(object(sectionByKey(preview, key)).items).map(object);
}

function itemKeys(preview, key) {
  return new Set(sectionItems(preview, key).map((item) => text(item.key, 160)).filter(Boolean));
}

function hasSummaryLine(preview, pattern) {
  return array(preview.chatgpt_summary_lines).some((line) => text(line, 1000).includes(pattern));
}

function safetyIssuesFor(preview) {
  const safety = object(preview.safety_boundary);
  const mutation = object(preview.no_mutation_snapshot);
  const issues = [];
  for (const key of [
    "read_only",
    "preview_only",
    "candidate_only",
    "no_generation",
    "no_auto_persist",
    "no_candidate_save",
    "no_approval",
    "no_canon_update",
    "no_active_engine_update",
    "no_compressed_rules_update",
    "no_runtime_ui_mutation",
    "no_mcp_tool_added",
    "no_memory_file_write",
  ]) {
    if (safety[key] !== true) issues.push(`${key}_not_true`);
  }
  for (const key of [
    "can_write_canon",
    "can_update_active_engine",
    "can_update_compressed_rules",
    "can_modify_runtime_ui",
    "can_register_mcp_tool",
    "can_save_candidate",
    "can_approve",
    "can_confirm_adoption",
    "can_write_memory_file",
  ]) {
    if (safety[key] !== false) issues.push(`${key}_not_false`);
  }
  for (const key of [
    "active_engine_modified",
    "compressed_rules_modified",
    "candidate_saved",
    "canon_written",
    "approval_item_created",
    "runtime_ui_modified",
    "mcp_tool_added",
    "mcp_tool_registered",
    "memory_file_written",
  ]) {
    if (mutation[key] !== false) issues.push(`${key}_not_false`);
  }
  return issues;
}

function contextTargets() {
  return [
    {
      key: "writing_context",
      label: "Writing context",
      payload_key: "generation_payload_key",
      downstream_use: "generation_context_aesthetic_memory",
      applies_to: ["generation", "writing_context"],
      required_summary_terms: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "revision_context",
      label: "Revision context",
      payload_key: "revision_payload_key",
      downstream_use: "revision_context_aesthetic_memory",
      applies_to: ["revision", "rewrite", "proofing"],
      required_summary_terms: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "final_polisher_context",
      label: "Final polisher context",
      payload_key: "final_polisher_payload_key",
      downstream_use: "final_polisher_context_aesthetic_memory",
      applies_to: ["final_polisher", "style_drift_detector"],
      required_summary_terms: ["禁止", "偏好", "必守", "安全"],
    },
    {
      key: "reader_response_simulator_context",
      label: "Reader response simulator context",
      payload_key: "reader_response_payload_key",
      downstream_use: "reader_response_context_aesthetic_memory",
      applies_to: ["reader_response", "reader_experience"],
      required_summary_terms: ["審美記憶", "覆蓋", "安全"],
    },
  ];
}

function readinessForTarget(preview, target, baseIssues) {
  const providerKeys = itemKeys(preview, "provider_usage");
  const cards = [
    cardByKey(preview, "aesthetic_memory_overall"),
    cardByKey(preview, "positive_preferences"),
    cardByKey(preview, "avoidance_rules"),
    cardByKey(preview, "coverage_categories"),
  ];
  const warnings = [];
  const blockers = [];
  if (baseIssues.length) blockers.push("safety_boundary_not_clean");
  if (preview.phase !== "30C") blockers.push("source_preview_not_phase_30c");
  if (preview.bridge_kind !== "aesthetic_memory_bridge_preview") blockers.push("source_preview_kind_invalid");
  if (preview.preview_status === "needs_context") blockers.push("aesthetic_memory_needs_context");
  if (preview.preview_status === "blocked") blockers.push("source_preview_blocked");
  if (!providerKeys.has(target.payload_key)) warnings.push(`missing_provider_payload_key:${target.payload_key}`);
  if (cards.some((card) => !card)) warnings.push("missing_required_overview_cards");
  for (const term of target.required_summary_terms) {
    if (!hasSummaryLine(preview, term)) warnings.push(`missing_summary_term:${term}`);
  }
  const status = blockers.length
    ? "blocked"
    : preview.preview_status === "watch" || warnings.length
      ? "watch"
      : "ready";
  return {
    key: target.key,
    label: target.label,
    status,
    can_attach_readonly_context: status === "ready" || status === "watch",
    will_mutate_context: false,
    payload_key: target.payload_key,
    downstream_use: target.downstream_use,
    applies_to: target.applies_to,
    required_summary_terms: target.required_summary_terms,
    blockers,
    warnings,
    safety_note: "This gate only permits a downstream builder to read the aesthetic memory payload as context; it does not generate, revise, save, approve, or mutate any source of truth.",
  };
}

function readinessStatus(preview, safetyIssues, targets) {
  if (preview.used !== true || preview.preview_status === "needs_context") return "needs_context";
  if (safetyIssues.length) return "blocked";
  if (targets.some((target) => target.status === "blocked")) return "blocked";
  if (preview.preview_status === "watch" || targets.some((target) => target.status === "watch")) return "watch";
  return "ready";
}

function readinessCards(status, score, targets, safetyIssues) {
  return [
    {
      key: "aesthetic_memory_injection_overall",
      label: "Aesthetic memory injection gate",
      value: `${score}%`,
      score,
      tone: status === "ready" ? "ready" : status === "watch" ? "watch" : status === "needs_context" ? "empty" : "blocked",
      summary: "Read-only preflight gate for attaching aesthetic memory to downstream context builders.",
    },
    ...targets.map((target) => ({
      key: target.key,
      label: target.label,
      value: target.status,
      tone: target.status === "ready" ? "ready" : target.status === "watch" ? "watch" : "blocked",
      summary: target.warnings.length ? target.warnings.join("; ") : "Ready for read-only context attachment.",
    })),
    {
      key: "safety_boundary",
      label: "Safety boundary",
      value: safetyIssues.length ? "blocked" : "clean",
      tone: safetyIssues.length ? "blocked" : "ready",
      summary: safetyIssues.length ? safetyIssues.join("; ") : "No protected writes, runtime UI mutation, MCP registration, or memory file write allowed.",
    },
  ];
}

function allowedGateActions() {
  return [
    {
      key: "read_injection_readiness_summary",
      label: "Read aesthetic memory injection readiness summary",
      allowed: true,
      route: "#aesthetic-memory-injection-readiness",
    },
    {
      key: "copy_injection_readiness_markdown",
      label: "Copy injection readiness markdown preview",
      allowed: true,
      route: "#aesthetic-memory-injection-readiness",
    },
    {
      key: "inspect_source_aesthetic_memory_bridge_preview",
      label: "Inspect source Aesthetic Memory bridge preview",
      allowed: true,
      route: "#aesthetic-memory",
    },
    {
      key: "inspect_target_readiness_map",
      label: "Inspect target readiness map",
      allowed: true,
      route: "#aesthetic-memory-injection-readiness",
    },
  ];
}

function blockedInjectionCapabilities() {
  return [
    "generate_text",
    "revise_text",
    "save_candidate",
    "approve",
    "confirm_adoption",
    "auto_adopt",
    "auto_settle",
    "write_canon",
    "create_pending_engine_candidate",
    "update_active_engine",
    "update_compressed_rules",
    "modify_runtime_ui",
    "register_mcp_tool",
    "write_memory_file",
    "update_memory_registry_file",
    "materialize_context_injection",
    "mutate_writing_context",
    "mutate_revision_context",
    "mutate_final_polisher_context",
    "mutate_reader_response_context",
    "restore_backup",
    "rollback",
  ].map((key) => ({
    key,
    label: key,
    allowed: false,
    reason: "Phase 31A is a read-only injection readiness gate, not an injection executor.",
  }));
}

function summaryLines(preview, status, score, targets, safetyIssues) {
  const targetLine = targets.map((target) => `${target.key}=${target.status}`).join("；");
  return [
    `狀態：${status}`,
    `審美記憶注入前檢查：${score}%`,
    `來源：${text(preview.bridge_kind, 120)} / ${text(preview.phase, 40)}`,
    `目標：${targetLine}`,
    safetyIssues.length ? `安全缺口：${safetyIssues.join("、")}` : "安全：只讀、只預覽、不寫正史、不改引擎、不寫 compressed_rules、不新增 MCP tool、不寫 memory file、不實際注入 context",
    "結論：此 gate 只判斷能否把 30C 摘要交給後續 context builder 當參考，不執行生成、修稿、保存、審核或正式資料寫入。",
  ];
}

function markdownFor(gate) {
  return [
    "## Aesthetic Memory Injection Readiness Gate",
    "",
    `- phase: ${gate.phase}`,
    `- source_phase: ${gate.source_phase}`,
    `- gate_kind: ${gate.gate_kind}`,
    `- gate_mode: ${gate.gate_mode}`,
    `- readiness_status: ${gate.readiness_status}`,
    `- injection_readiness_score: ${gate.injection_readiness_score}`,
    `- can_attach_readonly_context: ${gate.can_attach_readonly_context}`,
    `- read_only: ${gate.safety_boundary.read_only}`,
    `- preview_only: ${gate.safety_boundary.preview_only}`,
    `- can_write_canon: ${gate.safety_boundary.can_write_canon}`,
    `- can_update_active_engine: ${gate.safety_boundary.can_update_active_engine}`,
    `- can_register_mcp_tool: ${gate.safety_boundary.can_register_mcp_tool}`,
    `- memory_file_written: ${gate.no_mutation_snapshot.memory_file_written}`,
    "",
    "### Targets",
    ...gate.target_readiness.map((target) => `- ${target.key}: ${target.status} / payload=${target.payload_key}`),
    "",
    "### ChatGPT Summary",
    ...gate.chatgpt_summary_lines.map((line) => `- ${line}`),
    "",
  ].join("\n");
}

export async function buildAestheticMemoryInjectionReadinessGate(rawInput = {}, options = {}) {
  const input = object(rawInput);
  const providedPreview = object(
    options.preview
      ?? input.aesthetic_memory_bridge_preview
      ?? input.aestheticMemoryBridgePreview
      ?? input.bridge_preview
      ?? input.bridgePreview
      ?? input.preview,
  );
  const preview = providedPreview.phase === "30C"
    ? providedPreview
    : await buildAestheticMemoryBridgePreview(input, options);
  const safetyIssues = safetyIssuesFor(preview);
  const targetReadiness = contextTargets().map((target) => readinessForTarget(preview, target, safetyIssues));
  const status = readinessStatus(preview, safetyIssues, targetReadiness);
  const targetWarningCount = targetReadiness.reduce((sum, target) => sum + target.warnings.length, 0);
  const targetBlockerCount = targetReadiness.reduce((sum, target) => sum + target.blockers.length, 0);
  const score = status === "needs_context"
    ? 0
    : clampScore(number(preview.aesthetic_memory_score, 0) - safetyIssues.length * 20 - targetBlockerCount * 20 - targetWarningCount * 5);
  const gate = {
    used: preview.used === true,
    phase: "31A",
    version: aestheticMemoryInjectionReadinessGateVersion,
    gate_kind: "aesthetic_memory_injection_readiness_gate",
    gate_channel: "internal_pipeline_preflight",
    gate_mode: "readonly_injection_readiness",
    source_phase: text(preview.phase, 40) || "30C",
    source_version: text(preview.version, 160) || null,
    source_bridge_kind: text(preview.bridge_kind, 160) || "aesthetic_memory_bridge_preview",
    source_preview_digest: text(preview.bridge_preview_digest, 80) || stableDigest(preview),
    readiness_status: status,
    can_attach_readonly_context: status === "ready" || status === "watch",
    will_attach_context_now: false,
    will_mutate_context: false,
    injection_readiness_score: score,
    injection_targets: contextTargets().map((target) => ({
      key: target.key,
      label: target.label,
      payload_key: target.payload_key,
      downstream_use: target.downstream_use,
      applies_to: target.applies_to,
    })),
    target_readiness: targetReadiness,
    readiness_cards: readinessCards(status, score, targetReadiness, safetyIssues),
    safety_issues: safetyIssues,
    chatgpt_summary_lines: summaryLines(preview, status, score, targetReadiness, safetyIssues),
    allowed_gate_actions: allowedGateActions(),
    blocked_injection_capabilities: blockedInjectionCapabilities(),
    next_operator_action: {
      key: status === "ready" ? "review_readonly_injection_targets" : status === "watch" ? "inspect_injection_warnings" : "repair_aesthetic_memory_before_injection",
      label: status === "ready" ? "Review read-only injection targets" : status === "watch" ? "Inspect injection warnings" : "Repair aesthetic memory before injection",
      route: "#aesthetic-memory-injection-readiness",
      ui_target: "aesthetic-memory-injection-readiness",
      enabled: true,
      reason: status === "ready"
        ? "All target context builders can receive the aesthetic memory payload as read-only reference."
        : status === "watch"
          ? "The gate is usable but one or more target context checks has a warning."
          : "The source aesthetic memory preview is incomplete or unsafe for downstream context use.",
    },
    safety_boundary: {
      read_only: true,
      preview_only: true,
      candidate_only: true,
      no_generation: true,
      no_auto_persist: true,
      no_candidate_save: true,
      no_approval: true,
      no_canon_update: true,
      no_active_engine_update: true,
      no_compressed_rules_update: true,
      no_runtime_ui_mutation: true,
      no_mcp_tool_added: true,
      no_memory_file_write: true,
      no_context_mutation: true,
      can_write_canon: false,
      can_update_active_engine: false,
      can_update_compressed_rules: false,
      can_modify_runtime_ui: false,
      can_register_mcp_tool: false,
      can_save_candidate: false,
      can_approve: false,
      can_confirm_adoption: false,
      can_write_memory_file: false,
      can_materialize_context_injection: false,
    },
    no_mutation_snapshot: {
      active_engine_modified: false,
      compressed_rules_modified: false,
      candidate_saved: false,
      canon_written: false,
      approval_item_created: false,
      runtime_ui_modified: false,
      mcp_tool_added: false,
      mcp_tool_registered: false,
      memory_file_written: false,
      context_mutated: false,
      injection_materialized: false,
    },
    raw_json_preview: {
      visible_by_default: false,
      include_raw_required: true,
      raw_preview_included: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false),
    },
    raw_preview: boolean(options.include_raw ?? input.include_raw ?? input.includeRaw, false) ? preview : null,
  };
  gate.gate_digest = stableDigest({
    gate_kind: gate.gate_kind,
    gate_mode: gate.gate_mode,
    source_preview_digest: gate.source_preview_digest,
    readiness_status: gate.readiness_status,
    target_readiness: gate.target_readiness,
    safety_boundary: gate.safety_boundary,
  });
  gate.surface_markdown = options.include_markdown === false || input.include_markdown === false || input.includeMarkdown === false
    ? ""
    : markdownFor(gate);
  return gate;
}

export default buildAestheticMemoryInjectionReadinessGate;


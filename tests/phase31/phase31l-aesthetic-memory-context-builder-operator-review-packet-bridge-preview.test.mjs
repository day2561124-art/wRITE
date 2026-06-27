import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAestheticMemoryRegistryContract } from "../../server/src/aesthetic-memory-registry-service.mjs";
import { buildAestheticMemoryUiSurface } from "../../server/src/aesthetic-memory-ui-surface-service.mjs";
import { buildAestheticMemoryBridgePreview } from "../../server/src/aesthetic-memory-bridge-preview-service.mjs";
import { buildAestheticMemoryInjectionReadinessGate } from "../../server/src/aesthetic-memory-injection-readiness-gate-service.mjs";
import { buildAestheticMemoryContextAdapterPreview } from "../../server/src/aesthetic-memory-context-adapter-preview-service.mjs";
import { buildAestheticMemoryContextAdapterBridgePreview } from "../../server/src/aesthetic-memory-context-adapter-bridge-preview-service.mjs";
import { buildAestheticMemoryContextBuilderReadinessGate } from "../../server/src/aesthetic-memory-context-builder-readiness-gate-service.mjs";
import { buildAestheticMemoryContextBuilderPreviewSurface } from "../../server/src/aesthetic-memory-context-builder-preview-surface-service.mjs";
import { buildAestheticMemoryContextBuilderBridgePreview } from "../../server/src/aesthetic-memory-context-builder-bridge-preview-service.mjs";

const root = process.cwd();
const runAllPath = path.join(root, "tests", "run-all.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");
const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

function hash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function keyed(items, label) {
  assert(Array.isArray(items), `${label} must be an array.`);
  const map = new Map();
  for (const item of items) {
    assert.equal(typeof item.key, "string", `${label} item key must be a string.`);
    assert.equal(map.has(item.key), false, `${label} has duplicate key ${item.key}.`);
    map.set(item.key, item);
  }
  return map;
}

function assertRunAllOrder(runAllText) {
  const ordered = [
    "tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs",
    "tests/phase31/phase31k-aesthetic-memory-context-builder-operator-review-packet-ui-surface.test.mjs",
    "tests/phase31/phase31l-aesthetic-memory-context-builder-operator-review-packet-bridge-preview.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) assert(runAllText.includes(token), `run-all missing ${token}`);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    assert(runAllText.indexOf(ordered[index]) < runAllText.indexOf(ordered[index + 1]), `run-all order drifted: ${ordered[index]}`);
  }
}

function assertFalseFlags(target, keys, label) {
  for (const key of keys) if (key in target) assert.equal(target[key], false, `${label} ${key} must stay false.`);
}

function assertTrueFlags(target, keys, label) {
  for (const key of keys) if (key in target) assert.equal(target[key], true, `${label} ${key} must stay true.`);
}

const input = Object.freeze({
  task_prompt: "Phase31L aesthetic memory context builder operator review packet bridge preview.",
  accepted_patterns: ["角色要先像活人，才像設定。", "用場景物件承接壓力，而不是角色排隊說明。", "讓對話自然地打斷、停頓與錯開。", "一章一變局。"],
  rejected_patterns: ["公告式總結", "主題先行", "流程化交接", "把能力當日常捷徑"],
  style_principles: ["普通行動先直寫，幽默只能加味。", "不要把核對表語氣寫入正文。", "Operator review packet bridge preview 只能供 ChatGPT Bridge 讀取，不得執行 context build。"],
  ui_preferences: ["Bridge preview 要顯示四條 operator review rows。", "Bridge preview 要顯示 31E→31F→31G→31J→31K digest lineage。", "Bridge preview 安全文字必須明確標出 no build / no attach / no mutate / no persist / no execute。"],
  aesthetic_memory_entries: [
    {
      key: "prefer_builder_operator_review_packet_bridge_preview",
      category: "bridge_preview",
      polarity: "prefer",
      label: "Operator review packet UI surface 需要 Bridge 可讀 preview",
      rule: "Phase31L 必須把 31K UI surface 整理成 ChatGPT Bridge preview cards、rows、digest trace 與 summary lines。",
      rationale: "31K 已完成 Workbench UI 可讀 surface；下一步要讓 ChatGPT Bridge 能以 read-only preview 讀取。",
      strength: 100,
      applies_to: ["context_builder", "operator_review", "chatgpt_bridge", "safety"],
      examples: ["bridge_preview_rows=4；digest_trace=31E→31F→31G→31J→31K；raw_ui_surface_included=false。"],
    },
    {
      key: "avoid_operator_review_bridge_preview_execution",
      category: "safety",
      polarity: "reject",
      label: "Operator review bridge preview 不得執行決策",
      rule: "Bridge preview 只能 display / inspect / summarize，不得 approve、execute、build、attach、mutate、persist 或 register tool。",
      rationale: "Bridge preview 是 ChatGPT 可讀展示層，不是 adoption 或 activation gate。",
      strength: 100,
      applies_to: ["bridge", "approval", "context_builder", "active_engine", "mcp"],
      examples: ["can_execute_bridge_action=false；bridge_preview_persisted=false；context_built=false。"],
    },
  ],
});

async function buildChain({ includeRaw = false, includeMarkdown = true } = {}) {
  const registry = await buildAestheticMemoryRegistryContract(input);
  const surface = await buildAestheticMemoryUiSurface({ registry, include_raw: false });
  const bridgePreview = await buildAestheticMemoryBridgePreview({ surface, include_raw: false });
  const injectionGate = await buildAestheticMemoryInjectionReadinessGate({ preview: bridgePreview, include_raw: false });
  const adapterPreview = await buildAestheticMemoryContextAdapterPreview({ gate: injectionGate, include_raw: false });
  const adapterBridge = await buildAestheticMemoryContextAdapterBridgePreview({ adapter_preview: adapterPreview, include_raw: false });
  const builderGate = await buildAestheticMemoryContextBuilderReadinessGate({ bridge_preview: adapterBridge, include_raw: false });
  const builderSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ gate: builderGate, include_raw: false });
  const builderBridge = await buildAestheticMemoryContextBuilderBridgePreview({ surface: builderSurface, include_raw: includeRaw, include_markdown: includeMarkdown });
  return { registry, surface, bridgePreview, injectionGate, adapterPreview, adapterBridge, builderGate, builderSurface, builderBridge };
}

function buildOperatorReviewPacket({ builderGate, builderSurface, builderBridge, includeRaw = false }) {
  const sourceRows = Array.isArray(builderBridge.builder_bridge_rows) ? builderBridge.builder_bridge_rows : [];
  const operatorReviewRows = sourceRows.map((row) => ({
    key: row.key.replace("_bridge_preview", "_operator_review"),
    source_row_key: row.key,
    builder_key: row.builder_key,
    context_path: row.context_path,
    status: row.status === "ready" ? "ready_for_operator_review" : "needs_context",
    readonly_preview: row.readonly_preview === true,
    source_digest: row.digest,
    can_build_context_now: false,
    can_attach_context_now: false,
    can_mutate_context: false,
    can_persist_payload: false,
    operator_line: `${row.builder_key}/${row.context_path}=${row.status}; readonly_preview=${row.readonly_preview === true}; build=false; attach=false; mutate=false`,
  }));
  const readyRows = operatorReviewRows.filter((row) => row.status === "ready_for_operator_review").length;
  const reviewStatus = readyRows === 4 && builderBridge.preview_status === "ready" ? "ready_for_operator_review" : "needs_context";
  const digestLineage = [
    { key: "builder_readiness_digest", source_phase: "31E", digest: builderGate.builder_readiness_digest },
    { key: "surface_digest", source_phase: "31F", digest: builderSurface.surface_digest },
    { key: "bridge_preview_digest", source_phase: "31G", digest: builderBridge.bridge_preview_digest },
  ];
  const blockedBridgeCapabilities = Array.isArray(builderBridge.blocked_bridge_capabilities)
    ? builderBridge.blocked_bridge_capabilities.map((capability) => ({ key: capability.key, allowed: capability.allowed === true, reason: capability.reason ?? "blocked_by_preview_safety_boundary" }))
    : [];
  const packetDigest = hash(stableJson({ reviewStatus, operatorReviewRows, digestLineage, blockedBridgeCapabilities }));
  return {
    used: true,
    phase: "31J",
    version: "aesthetic_memory_context_builder_operator_review_packet_v1",
    packet_kind: "aesthetic_memory_context_builder_operator_review_packet",
    review_status: reviewStatus,
    source_bridge_preview_digest: builderBridge.bridge_preview_digest,
    source_surface_digest: builderSurface.surface_digest,
    source_builder_readiness_digest: builderGate.builder_readiness_digest,
    packet_digest: packetDigest,
    operator_review_rows: operatorReviewRows,
    digest_lineage: digestLineage,
    blocked_operator_decisions: ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false })),
    blocked_bridge_capabilities: blockedBridgeCapabilities,
    safety_boundary: { ...builderBridge.safety_boundary, no_operator_decision_execute: true, no_operator_packet_persist: true, can_execute_operator_decision: false, can_persist_operator_packet: false },
    no_mutation_snapshot: { ...builderBridge.no_mutation_snapshot, operator_packet_persisted: false, operator_decision_executed: false, context_built_from_operator_packet: false },
    raw_bridge_preview: includeRaw ? builderBridge : null,
    raw_json_preview: { visible_by_default: false, raw_bridge_preview_included: includeRaw },
  };
}

function buildOperatorReviewUiSurface({ packet, includeRaw = false, includeMarkdown = true }) {
  const packetRows = Array.isArray(packet.operator_review_rows) ? packet.operator_review_rows : [];
  const readyRows = packetRows.filter((row) => row.status === "ready_for_operator_review").length;
  const previewStatus = packet.review_status === "ready_for_operator_review" && readyRows === 4 ? "ready" : "needs_context";
  const operatorReviewTableRows = packetRows.map((row, index) => ({
    key: row.key.replace("_operator_review", "_ui_row"),
    source_row_key: row.key,
    display_order: index + 1,
    builder_key: row.builder_key,
    context_path: row.context_path,
    display_status: row.status,
    readonly_preview: row.readonly_preview === true,
    source_digest: row.source_digest,
    ui_action: "inspect_only",
    can_build_context_now: false,
    can_attach_context_now: false,
    can_mutate_context: false,
    can_persist_payload: false,
    ui_line: `${row.builder_key} / ${row.context_path} / ${row.status} / inspect_only`,
  }));
  const digestTraceRows = [
    ...packet.digest_lineage.map((entry) => ({ key: entry.key, source_phase: entry.source_phase, digest: entry.digest, trace_status: "traceable" })),
    { key: "operator_packet_digest", source_phase: "31J", digest: packet.packet_digest, trace_status: "traceable" },
  ];
  const surfaceCards = [
    { key: "ui_surface_overall", label: "Operator Review UI Surface", value: `${readyRows}/4 ready`, status: previewStatus },
    { key: "operator_review_rows", label: "Operator Review Rows", value: String(operatorReviewTableRows.length), status: operatorReviewTableRows.length === 4 ? "ready" : "needs_context" },
    { key: "digest_trace", label: "Digest Trace", value: "31E→31F→31G→31J", status: "traceable" },
    { key: "safety_boundary", label: "Safety Boundary", value: "clean", status: "blocked_execution" },
    { key: "blocked_operator_decisions", label: "Blocked Operator Decisions", value: String(packet.blocked_operator_decisions.length), status: "blocked" },
    { key: "raw_json_preview", label: "Raw JSON Preview", value: "hidden_by_default", status: "collapsed" },
  ];
  const warningBanners = [
    { key: "no_context_build", severity: "info", message: "UI surface will not build, attach, mutate, or persist context." },
    { key: "no_operator_decision_execute", severity: "info", message: "Operator decisions remain blocked in this preview surface." },
    { key: "no_canon_or_engine_write", severity: "info", message: "Canon, active_engine, compressed_rules, MCP tools, and memory files remain unchanged." },
  ];
  const surfaceDigest = hash(stableJson({ previewStatus, operatorReviewTableRows, digestTraceRows, surfaceCards, warningBanners }));
  const surfaceMarkdown = includeMarkdown ? [
    "# Aesthetic Memory Context Builder Operator Review UI Surface",
    "",
    `preview_status: ${previewStatus}`,
    `source_packet_digest: ${packet.packet_digest}`,
    `surface_digest: ${surfaceDigest}`,
    "will_build_context_now: false",
    "will_attach_context_now: false",
    "will_mutate_context: false",
    "will_persist_payload: false",
    "will_execute_operator_decision: false",
    "",
    "## Operator Review Rows",
    ...operatorReviewTableRows.map((row) => `- ${row.builder_key}/${row.context_path}: ${row.display_status}; ${row.ui_action}; build=false; attach=false; mutate=false`),
  ].join("\n") : "";
  return {
    used: true,
    phase: "31K",
    version: "aesthetic_memory_context_builder_operator_review_packet_ui_surface_v1",
    surface_kind: "aesthetic_memory_context_builder_operator_review_packet_ui_surface",
    surface_channel: "ui_context_builder_operator_review",
    surface_mode: "readonly_ui_preview",
    preview_status: previewStatus,
    source_phase: packet.phase,
    source_packet_kind: packet.packet_kind,
    source_packet_digest: packet.packet_digest,
    source_bridge_preview_digest: packet.source_bridge_preview_digest,
    source_surface_digest: packet.source_surface_digest,
    source_builder_readiness_digest: packet.source_builder_readiness_digest,
    surface_digest: surfaceDigest,
    can_display_operator_review_ui: previewStatus === "ready",
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    will_persist_payload: false,
    will_execute_operator_decision: false,
    surface_cards: surfaceCards,
    operator_review_table_rows: operatorReviewTableRows,
    digest_trace_rows: digestTraceRows,
    warning_banners: warningBanners,
    ui_sections: [
      { key: "ui_header", label: "UI Header", visible: true },
      { key: "surface_cards", label: "Surface Cards", items: surfaceCards },
      { key: "operator_review_table", label: "Operator Review Table", items: operatorReviewTableRows },
      { key: "digest_trace", label: "Digest Trace", items: digestTraceRows },
      { key: "warning_banners", label: "Warning Banners", items: warningBanners },
      { key: "blocked_operator_decisions", label: "Blocked Operator Decisions", items: packet.blocked_operator_decisions },
      { key: "raw_json_preview", label: "Raw JSON Preview", visible_by_default: false },
    ],
    surface_markdown: surfaceMarkdown,
    chatgpt_ui_summary_lines: ["Operator review UI surface: ready; review_only; 不 build context; 不執行 operator decision。", ...operatorReviewTableRows.map((row) => row.ui_line)],
    allowed_ui_actions: ["read_operator_review_ui_surface", "copy_operator_review_ui_markdown", "inspect_operator_review_table_rows", "inspect_digest_trace_rows", "inspect_warning_banners", "inspect_blocked_operator_decisions"].map((key) => ({ key, allowed: true })),
    blocked_ui_actions: ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_ui_surface_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false })),
    safety_boundary: { ...packet.safety_boundary, no_ui_surface_persist: true, can_persist_ui_surface: false, can_execute_mutating_ui_action: false },
    no_mutation_snapshot: { ...packet.no_mutation_snapshot, ui_surface_persisted: false, ui_state_written: false, context_built_from_ui_surface: false },
    raw_operator_packet: includeRaw ? packet : null,
    raw_json_preview: { visible_by_default: false, raw_operator_packet_included: includeRaw },
  };
}

function buildOperatorReviewBridgePreview({ uiSurface, includeRaw = false, includeMarkdown = true }) {
  const surfaceRows = Array.isArray(uiSurface.operator_review_table_rows) ? uiSurface.operator_review_table_rows : [];
  const bridgePreviewRows = surfaceRows.map((row, index) => ({
    key: row.key.replace("_ui_row", "_bridge_preview_row"),
    source_row_key: row.key,
    display_order: index + 1,
    builder_key: row.builder_key,
    context_path: row.context_path,
    bridge_status: row.display_status === "ready_for_operator_review" ? "ready_for_bridge_preview" : "needs_context",
    source_display_status: row.display_status,
    readonly_preview: row.readonly_preview === true,
    source_digest: row.source_digest,
    chatgpt_visible: true,
    bridge_action: "inspect_only",
    can_build_context_now: false,
    can_attach_context_now: false,
    can_mutate_context: false,
    can_persist_payload: false,
    can_execute_operator_decision: false,
    chatgpt_line: `${row.builder_key}/${row.context_path}: ${row.display_status}; inspect_only; build=false; attach=false; mutate=false; persist=false; execute=false`,
  }));
  const readyRows = bridgePreviewRows.filter((row) => row.bridge_status === "ready_for_bridge_preview").length;
  const previewStatus = uiSurface.preview_status === "ready" && readyRows === 4 ? "ready" : "needs_context";
  const digestTraceRows = [
    ...uiSurface.digest_trace_rows.map((entry) => ({ key: entry.key, source_phase: entry.source_phase, digest: entry.digest, trace_status: entry.trace_status ?? "traceable" })),
    { key: "operator_review_ui_surface_digest", source_phase: "31K", digest: uiSurface.surface_digest, trace_status: "traceable" },
  ];
  const blockedOperatorDecisionSection = Array.isArray(uiSurface.ui_sections)
    ? uiSurface.ui_sections.find((section) => section.key === "blocked_operator_decisions")
    : null;
  const blockedOperatorDecisions = Array.isArray(blockedOperatorDecisionSection?.items)
    ? blockedOperatorDecisionSection.items.map((item) => ({ key: item.key, allowed: item.allowed === true }))
    : [];
  const blockedBridgeCapabilities = Array.isArray(uiSurface.blocked_ui_actions)
    ? uiSurface.blocked_ui_actions.map((action) => ({ key: action.key, allowed: action.allowed === true, source: "blocked_ui_action", reason: "blocked_by_operator_review_bridge_preview_safety_boundary" }))
    : [];
  const bridgePreviewCards = [
    { key: "bridge_preview_overall", label: "Operator Review Packet Bridge Preview", value: `${readyRows}/4 ready`, status: previewStatus },
    { key: "operator_review_bridge_rows", label: "Operator Review Bridge Rows", value: String(bridgePreviewRows.length), status: bridgePreviewRows.length === 4 ? "ready" : "needs_context" },
    { key: "digest_trace", label: "Digest Trace", value: "31E→31F→31G→31J→31K", status: "traceable" },
    { key: "chatgpt_summary", label: "ChatGPT Summary Lines", value: String(bridgePreviewRows.length + 4), status: "ready" },
    { key: "safety_boundary", label: "Safety Boundary", value: "read_only_preview_only", status: "blocked_execution" },
    { key: "raw_ui_surface", label: "Raw UI Surface", value: "hidden_by_default", status: "collapsed" },
  ];
  const warningBanners = [
    { key: "no_context_build", severity: "info", message: "Bridge preview will not build, attach, mutate, persist, or execute context." },
    { key: "no_operator_decision_execute", severity: "info", message: "Operator decisions remain blocked in this ChatGPT Bridge preview." },
    { key: "no_canon_engine_or_mcp_write", severity: "info", message: "Canon, active_engine, compressed_rules, MCP tools, bridge state, and memory files remain unchanged." },
  ];
  const chatgptSummaryLines = [
    `Operator review packet bridge preview: ${previewStatus}; read-only; preview-only; no context build/attach/mutate/persist/execute.`,
    "digest_trace: 31E→31F→31G→31J→31K",
    `source_ui_surface_digest: ${uiSurface.surface_digest}`,
    ...bridgePreviewRows.map((row) => row.chatgpt_line),
    `blocked_operator_decisions=${blockedOperatorDecisions.length}`,
    `blocked_bridge_capabilities=${blockedBridgeCapabilities.length}`,
  ];
  const bridgePreviewDigest = hash(stableJson({ previewStatus, bridgePreviewRows, digestTraceRows, bridgePreviewCards, warningBanners, chatgptSummaryLines, blockedOperatorDecisions, blockedBridgeCapabilities }));
  const bridgePreviewMarkdown = includeMarkdown ? [
    "# Aesthetic Memory Context Builder Operator Review Packet Bridge Preview",
    "",
    `preview_status: ${previewStatus}`,
    `source_ui_surface_digest: ${uiSurface.surface_digest}`,
    `bridge_preview_digest: ${bridgePreviewDigest}`,
    "digest_trace: 31E→31F→31G→31J→31K",
    "will_build_context_now: false",
    "will_attach_context_now: false",
    "will_mutate_context: false",
    "will_persist_payload: false",
    "will_execute_operator_decision: false",
    "will_register_mcp_tool: false",
    "",
    "## ChatGPT Bridge Rows",
    ...bridgePreviewRows.map((row) => `- ${row.builder_key}/${row.context_path}: ${row.bridge_status}; inspect_only; build=false; attach=false; mutate=false; persist=false; execute=false`),
  ].join("\n") : "";
  return {
    used: true,
    phase: "31L",
    version: "aesthetic_memory_context_builder_operator_review_packet_bridge_preview_v1",
    preview_kind: "aesthetic_memory_context_builder_operator_review_packet_bridge_preview",
    preview_channel: "chatgpt_bridge_context_builder_operator_review",
    preview_mode: "readonly_bridge_preview",
    preview_status: previewStatus,
    source_phase: uiSurface.phase,
    source_surface_kind: uiSurface.surface_kind,
    source_surface_digest: uiSurface.surface_digest,
    source_packet_digest: uiSurface.source_packet_digest,
    source_bridge_preview_digest: uiSurface.source_bridge_preview_digest,
    source_builder_readiness_digest: uiSurface.source_builder_readiness_digest,
    bridge_preview_digest: bridgePreviewDigest,
    can_display_chatgpt_bridge_preview: previewStatus === "ready",
    will_build_context_now: false,
    will_attach_context_now: false,
    will_mutate_context: false,
    will_persist_payload: false,
    will_execute_operator_decision: false,
    will_register_mcp_tool: false,
    bridge_preview_cards: bridgePreviewCards,
    bridge_preview_rows: bridgePreviewRows,
    digest_trace_rows: digestTraceRows,
    warning_banners: warningBanners,
    chatgpt_summary_lines: chatgptSummaryLines,
    bridge_preview_markdown: bridgePreviewMarkdown,
    blocked_operator_decisions: blockedOperatorDecisions,
    blocked_bridge_capabilities: blockedBridgeCapabilities,
    allowed_bridge_actions: ["read_operator_review_packet_bridge_preview", "copy_operator_review_bridge_markdown", "inspect_operator_review_bridge_rows", "inspect_digest_trace_rows", "inspect_warning_banners", "inspect_blocked_operator_decisions", "inspect_blocked_bridge_capabilities"].map((key) => ({ key, allowed: true })),
    blocked_bridge_actions: ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_preview_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"].map((key) => ({ key, allowed: false })),
    safety_boundary: { ...uiSurface.safety_boundary, no_bridge_preview_persist: true, no_bridge_tool_registration: true, can_persist_bridge_preview: false, can_execute_bridge_action: false, can_register_context_builder_bridge_mcp_tool: false },
    no_mutation_snapshot: { ...uiSurface.no_mutation_snapshot, bridge_preview_persisted: false, bridge_state_written: false, bridge_tool_registered: false, context_built_from_bridge_preview: false },
    raw_ui_surface: includeRaw ? uiSurface : null,
    raw_json_preview: { visible_by_default: false, raw_ui_surface_included: includeRaw },
  };
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31L active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31L compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));

const chain = await buildChain();
const { builderGate, builderSurface, builderBridge } = chain;
assert.equal(builderGate.phase, "31E");
assert.equal(builderGate.builder_readiness_status, "ready");
assert.equal(builderSurface.phase, "31F");
assert.equal(builderSurface.preview_status, "ready");
assert.equal(builderBridge.phase, "31G");
assert.equal(builderBridge.preview_status, "ready");

const packet = buildOperatorReviewPacket({ builderGate, builderSurface, builderBridge });
assert.equal(packet.phase, "31J");
assert.equal(packet.review_status, "ready_for_operator_review");

const uiSurface = buildOperatorReviewUiSurface({ packet });
assert.equal(uiSurface.phase, "31K");
assert.equal(uiSurface.preview_status, "ready");
assert.equal(uiSurface.can_display_operator_review_ui, true);

const bridgePreview = buildOperatorReviewBridgePreview({ uiSurface });
assert.equal(bridgePreview.used, true);
assert.equal(bridgePreview.phase, "31L");
assert.equal(bridgePreview.version, "aesthetic_memory_context_builder_operator_review_packet_bridge_preview_v1");
assert.equal(bridgePreview.preview_kind, "aesthetic_memory_context_builder_operator_review_packet_bridge_preview");
assert.equal(bridgePreview.preview_channel, "chatgpt_bridge_context_builder_operator_review");
assert.equal(bridgePreview.preview_mode, "readonly_bridge_preview");
assert.equal(bridgePreview.preview_status, "ready");
assert.equal(bridgePreview.source_phase, "31K");
assert.equal(bridgePreview.source_surface_kind, uiSurface.surface_kind);
assert.equal(bridgePreview.source_surface_digest, uiSurface.surface_digest);
assert.equal(bridgePreview.source_packet_digest, packet.packet_digest);
assert.equal(bridgePreview.source_bridge_preview_digest, builderBridge.bridge_preview_digest);
assert.equal(bridgePreview.source_builder_readiness_digest, builderGate.builder_readiness_digest);
assert.match(bridgePreview.bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.equal(bridgePreview.can_display_chatgpt_bridge_preview, true);
assertFalseFlags(bridgePreview, ["will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision", "will_register_mcp_tool"], "Phase31L bridge preview");

const cards = keyed(bridgePreview.bridge_preview_cards, "Phase31L bridge preview cards");
assert.deepEqual([...cards.keys()], ["bridge_preview_overall", "operator_review_bridge_rows", "digest_trace", "chatgpt_summary", "safety_boundary", "raw_ui_surface"]);
assert.equal(cards.get("bridge_preview_overall")?.value, "4/4 ready");
assert.equal(cards.get("operator_review_bridge_rows")?.value, "4");
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J→31K");
assert.equal(cards.get("raw_ui_surface")?.value, "hidden_by_default");

const rows = keyed(bridgePreview.bridge_preview_rows, "Phase31L bridge preview rows");
assert.deepEqual([...rows.keys()], ["writing_context_builder_bridge_preview_row", "revision_context_builder_bridge_preview_row", "final_polisher_context_builder_bridge_preview_row", "reader_response_context_builder_bridge_preview_row"]);
for (const row of rows.values()) {
  assert.equal(row.bridge_status, "ready_for_bridge_preview");
  assert.equal(row.source_display_status, "ready_for_operator_review");
  assert.equal(row.readonly_preview, true);
  assert.equal(row.chatgpt_visible, true);
  assert.equal(row.bridge_action, "inspect_only");
  assert.match(row.source_digest, /^[a-f0-9]{64}$/u);
  assert(row.chatgpt_line.includes("build=false"));
  assert(row.chatgpt_line.includes("attach=false"));
  assert(row.chatgpt_line.includes("mutate=false"));
  assert(row.chatgpt_line.includes("persist=false"));
  assert(row.chatgpt_line.includes("execute=false"));
  assertFalseFlags(row, ["can_build_context_now", "can_attach_context_now", "can_mutate_context", "can_persist_payload", "can_execute_operator_decision"], row.key);
}
assert.equal(rows.get("writing_context_builder_bridge_preview_row")?.context_path, "writing_context.aesthetic_memory");
assert.equal(rows.get("revision_context_builder_bridge_preview_row")?.context_path, "revision_context.aesthetic_memory");
assert.equal(rows.get("final_polisher_context_builder_bridge_preview_row")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(rows.get("reader_response_context_builder_bridge_preview_row")?.context_path, "reader_response_context.aesthetic_memory");

const digestTrace = keyed(bridgePreview.digest_trace_rows, "Phase31L digest trace rows");
assert.deepEqual([...digestTrace.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest", "operator_review_ui_surface_digest"]);
assert.equal(digestTrace.get("builder_readiness_digest")?.source_phase, "31E");
assert.equal(digestTrace.get("surface_digest")?.source_phase, "31F");
assert.equal(digestTrace.get("bridge_preview_digest")?.source_phase, "31G");
assert.equal(digestTrace.get("operator_packet_digest")?.source_phase, "31J");
assert.equal(digestTrace.get("operator_review_ui_surface_digest")?.source_phase, "31K");
assert.equal(digestTrace.get("operator_review_ui_surface_digest")?.digest, uiSurface.surface_digest);

const warnings = keyed(bridgePreview.warning_banners, "Phase31L warning banners");
assert.deepEqual([...warnings.keys()], ["no_context_build", "no_operator_decision_execute", "no_canon_engine_or_mcp_write"]);
assert(bridgePreview.bridge_preview_markdown.includes("Aesthetic Memory Context Builder Operator Review Packet Bridge Preview"));
assert(bridgePreview.bridge_preview_markdown.includes("digest_trace: 31E→31F→31G→31J→31K"));
assert(bridgePreview.bridge_preview_markdown.includes("will_register_mcp_tool: false"));
assert(bridgePreview.chatgpt_summary_lines.some((line) => line.includes("no context build/attach/mutate/persist/execute")));
assert(bridgePreview.chatgpt_summary_lines.some((line) => line.includes("31E→31F→31G→31J→31K")));
assert.equal(bridgePreview.chatgpt_summary_lines.filter((line) => line.includes("inspect_only")).length, 4);

const blockedOperatorDecisions = keyed(bridgePreview.blocked_operator_decisions, "Phase31L blocked operator decisions");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) {
  assert.equal(blockedOperatorDecisions.get(key)?.allowed, false, `${key} must stay blocked.`);
}
const blockedCapabilities = keyed(bridgePreview.blocked_bridge_capabilities, "Phase31L blocked bridge capabilities");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) {
  assert.equal(blockedCapabilities.get(key)?.allowed, false, `${key} capability must stay blocked.`);
}

const allowedBridgeActions = keyed(bridgePreview.allowed_bridge_actions, "Phase31L allowed bridge actions");
assert.deepEqual([...allowedBridgeActions.keys()], ["read_operator_review_packet_bridge_preview", "copy_operator_review_bridge_markdown", "inspect_operator_review_bridge_rows", "inspect_digest_trace_rows", "inspect_warning_banners", "inspect_blocked_operator_decisions", "inspect_blocked_bridge_capabilities"]);
for (const action of allowedBridgeActions.values()) assert.equal(action.allowed, true);
const blockedBridgeActions = keyed(bridgePreview.blocked_bridge_actions, "Phase31L blocked bridge actions");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_bridge_preview_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) {
  assert.equal(blockedBridgeActions.get(key)?.allowed, false, `${key} must stay blocked.`);
}

assertTrueFlags(bridgePreview.safety_boundary, ["read_only", "preview_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_operator_packet_persist", "no_ui_surface_persist", "no_bridge_preview_persist", "no_bridge_tool_registration"], "Phase31L safety");
assertFalseFlags(bridgePreview.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_persist_operator_packet", "can_persist_ui_surface", "can_execute_mutating_ui_action", "can_persist_bridge_preview", "can_execute_bridge_action", "can_register_context_builder_bridge_mcp_tool"], "Phase31L safety");
assertFalseFlags(bridgePreview.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "operator_packet_persisted", "operator_decision_executed", "ui_surface_persisted", "ui_state_written", "context_built_from_ui_surface", "bridge_preview_persisted", "bridge_state_written", "bridge_tool_registered", "context_built_from_bridge_preview"], "Phase31L mutation");
assert.equal(bridgePreview.raw_ui_surface, null);
assert.equal(bridgePreview.raw_json_preview.visible_by_default, false);
assert.equal(bridgePreview.raw_json_preview.raw_ui_surface_included, false);

const rawBridgePreview = buildOperatorReviewBridgePreview({ uiSurface, includeRaw: true, includeMarkdown: false });
assert.equal(rawBridgePreview.raw_ui_surface.phase, "31K");
assert.equal(rawBridgePreview.raw_json_preview.visible_by_default, false);
assert.equal(rawBridgePreview.raw_json_preview.raw_ui_surface_included, true);
assert.equal(rawBridgePreview.bridge_preview_markdown, "");

for (let index = 0; index < 3; index += 1) {
  const rerun = await buildChain();
  const rerunPacket = buildOperatorReviewPacket({ builderGate: rerun.builderGate, builderSurface: rerun.builderSurface, builderBridge: rerun.builderBridge });
  const rerunUiSurface = buildOperatorReviewUiSurface({ packet: rerunPacket });
  const rerunBridgePreview = buildOperatorReviewBridgePreview({ uiSurface: rerunUiSurface });
  assert.equal(rerun.builderGate.builder_readiness_digest, builderGate.builder_readiness_digest);
  assert.equal(rerun.builderSurface.surface_digest, builderSurface.surface_digest);
  assert.equal(rerun.builderBridge.bridge_preview_digest, builderBridge.bridge_preview_digest);
  assert.equal(rerunPacket.packet_digest, packet.packet_digest);
  assert.equal(rerunUiSurface.surface_digest, uiSurface.surface_digest);
  assert.equal(rerunBridgePreview.bridge_preview_digest, bridgePreview.bridge_preview_digest);
  assert.deepEqual(rerunBridgePreview, bridgePreview, "Phase31L operator review packet bridge preview rerun should be deterministic.");
}

const weakGate = await buildAestheticMemoryContextBuilderReadinessGate({ include_default_seed: false });
const weakSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ include_default_seed: false });
const weakBridge = await buildAestheticMemoryContextBuilderBridgePreview({ include_default_seed: false });
const weakPacket = buildOperatorReviewPacket({ builderGate: weakGate, builderSurface: weakSurface, builderBridge: weakBridge });
const weakUiSurface = buildOperatorReviewUiSurface({ packet: weakPacket });
const weakBridgePreview = buildOperatorReviewBridgePreview({ uiSurface: weakUiSurface });
assert.equal(weakGate.builder_readiness_status, "needs_context");
assert.equal(weakSurface.preview_status, "needs_context");
assert.equal(weakBridge.preview_status, "needs_context");
assert.equal(weakPacket.review_status, "needs_context");
assert.equal(weakUiSurface.preview_status, "needs_context");
assert.equal(weakBridgePreview.preview_status, "needs_context");
assert.equal(weakBridgePreview.can_display_chatgpt_bridge_preview, false);
assertFalseFlags(weakBridgePreview.no_mutation_snapshot, ["context_built", "context_attached", "context_mutated", "operator_packet_persisted", "operator_decision_executed", "ui_surface_persisted", "ui_state_written", "context_built_from_ui_surface", "bridge_preview_persisted", "bridge_state_written", "bridge_tool_registered", "context_built_from_bridge_preview"], "Phase31L weak mutation");

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31L changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31L changed compressed_rules hash.");
console.log("Phase31L aesthetic memory context builder operator review packet bridge preview tests passed.");

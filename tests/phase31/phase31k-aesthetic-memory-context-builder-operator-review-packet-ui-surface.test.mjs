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
    "tests/phase31/phase31i-aesthetic-memory-context-builder-bridge-stability-guard.test.mjs",
    "tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs",
    "tests/phase31/phase31k-aesthetic-memory-context-builder-operator-review-packet-ui-surface.test.mjs",
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
  task_prompt: "Phase31K aesthetic memory context builder operator review packet UI surface.",
  accepted_patterns: ["角色要先像活人，才像設定。", "用場景物件承接壓力，而不是角色排隊說明。", "讓對話自然地打斷、停頓與錯開。", "一章一變局。"],
  rejected_patterns: ["公告式總結", "主題先行", "流程化交接", "把能力當日常捷徑"],
  style_principles: ["普通行動先直寫，幽默只能加味。", "不要把核對表語氣寫入正文。", "Operator review packet UI surface 只能供閱讀與檢查，不得執行 context build。"],
  ui_preferences: ["UI surface 要顯示四條 operator review rows。", "UI surface 要顯示 31E→31F→31G→31J digest lineage。", "UI surface 安全文字必須明確標出 no build / no attach / no mutate / no persist / no execute。"],
  aesthetic_memory_entries: [
    {
      key: "prefer_builder_operator_review_packet_ui_surface",
      category: "ui_surface",
      polarity: "prefer",
      label: "Operator review packet 需要 UI 可讀 surface",
      rule: "Phase31K 必須把 31J operator packet 整理成 cards、table rows、digest trace、warning banners 與 markdown surface。",
      rationale: "31J 已完成操作者審閱封包；下一步要讓 Workbench UI 能以 read-only surface 顯示。",
      strength: 100,
      applies_to: ["context_builder", "operator_review", "ui", "safety"],
      examples: ["operator_review_table=4 rows；digest_trace=31E→31F→31G→31J；will_execute_operator_decision=false。"],
    },
    {
      key: "avoid_operator_review_ui_execution",
      category: "safety",
      polarity: "reject",
      label: "Operator review UI 不得執行決策",
      rule: "UI surface 只能 display / inspect / copy，不得 approve、execute、build、attach、mutate、persist 或 register tool。",
      rationale: "UI surface 是展示層，不是 adoption 或 activation gate。",
      strength: 100,
      applies_to: ["ui", "approval", "context_builder", "active_engine", "mcp"],
      examples: ["can_execute_mutating_ui_action=false；ui_surface_persisted=false；context_built=false。"],
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

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31K active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31K compressed_rules hash baseline drifted before test.");
assertRunAllOrder(await readFile(runAllPath, "utf8"));

const chain = await buildChain();
const { builderGate, builderSurface, builderBridge } = chain;
assert.equal(builderGate.phase, "31E");
assert.equal(builderGate.builder_readiness_status, "ready");
assert.equal(builderSurface.phase, "31F");
assert.equal(builderSurface.preview_status, "ready");
assert.equal(builderBridge.phase, "31G");
assert.equal(builderBridge.preview_status, "ready");
assert.equal(builderSurface.source_builder_readiness_digest, builderGate.builder_readiness_digest);
assert.equal(builderBridge.source_surface_digest, builderSurface.surface_digest);
assert.match(builderGate.builder_readiness_digest, /^[a-f0-9]{64}$/u);
assert.match(builderSurface.surface_digest, /^[a-f0-9]{64}$/u);
assert.match(builderBridge.bridge_preview_digest, /^[a-f0-9]{64}$/u);

const bridgeRows = keyed(builderBridge.builder_bridge_rows, "Phase31K source bridge rows");
assert.deepEqual([...bridgeRows.keys()], ["writing_context_builder_bridge_preview", "revision_context_builder_bridge_preview", "final_polisher_context_builder_bridge_preview", "reader_response_context_builder_bridge_preview"]);

const packet = buildOperatorReviewPacket({ builderGate, builderSurface, builderBridge });
assert.equal(packet.phase, "31J");
assert.equal(packet.review_status, "ready_for_operator_review");
assert.match(packet.packet_digest, /^[a-f0-9]{64}$/u);
assert.equal(packet.source_bridge_preview_digest, builderBridge.bridge_preview_digest);
assert.equal(packet.source_surface_digest, builderSurface.surface_digest);
assert.equal(packet.source_builder_readiness_digest, builderGate.builder_readiness_digest);

const uiSurface = buildOperatorReviewUiSurface({ packet });
assert.equal(uiSurface.used, true);
assert.equal(uiSurface.phase, "31K");
assert.equal(uiSurface.version, "aesthetic_memory_context_builder_operator_review_packet_ui_surface_v1");
assert.equal(uiSurface.surface_kind, "aesthetic_memory_context_builder_operator_review_packet_ui_surface");
assert.equal(uiSurface.surface_channel, "ui_context_builder_operator_review");
assert.equal(uiSurface.surface_mode, "readonly_ui_preview");
assert.equal(uiSurface.preview_status, "ready");
assert.equal(uiSurface.source_phase, "31J");
assert.equal(uiSurface.source_packet_digest, packet.packet_digest);
assert.equal(uiSurface.source_bridge_preview_digest, builderBridge.bridge_preview_digest);
assert.equal(uiSurface.source_surface_digest, builderSurface.surface_digest);
assert.equal(uiSurface.source_builder_readiness_digest, builderGate.builder_readiness_digest);
assert.match(uiSurface.surface_digest, /^[a-f0-9]{64}$/u);
assert.equal(uiSurface.can_display_operator_review_ui, true);
assertFalseFlags(uiSurface, ["will_build_context_now", "will_attach_context_now", "will_mutate_context", "will_persist_payload", "will_execute_operator_decision"], "Phase31K UI surface");

const cards = keyed(uiSurface.surface_cards, "Phase31K surface cards");
assert.deepEqual([...cards.keys()], ["ui_surface_overall", "operator_review_rows", "digest_trace", "safety_boundary", "blocked_operator_decisions", "raw_json_preview"]);
assert.equal(cards.get("ui_surface_overall")?.value, "4/4 ready");
assert.equal(cards.get("operator_review_rows")?.value, "4");
assert.equal(cards.get("digest_trace")?.value, "31E→31F→31G→31J");
assert.equal(cards.get("raw_json_preview")?.value, "hidden_by_default");

const tableRows = keyed(uiSurface.operator_review_table_rows, "Phase31K operator review table rows");
assert.deepEqual([...tableRows.keys()], ["writing_context_builder_ui_row", "revision_context_builder_ui_row", "final_polisher_context_builder_ui_row", "reader_response_context_builder_ui_row"]);
for (const row of tableRows.values()) {
  assert.equal(row.display_status, "ready_for_operator_review");
  assert.equal(row.readonly_preview, true);
  assert.match(row.source_digest, /^[a-f0-9]{64}$/u);
  assert.equal(row.ui_action, "inspect_only");
  assertFalseFlags(row, ["can_build_context_now", "can_attach_context_now", "can_mutate_context", "can_persist_payload"], row.key);
}
assert.equal(tableRows.get("writing_context_builder_ui_row")?.context_path, "writing_context.aesthetic_memory");
assert.equal(tableRows.get("revision_context_builder_ui_row")?.context_path, "revision_context.aesthetic_memory");
assert.equal(tableRows.get("final_polisher_context_builder_ui_row")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(tableRows.get("reader_response_context_builder_ui_row")?.context_path, "reader_response_context.aesthetic_memory");

const digestTrace = keyed(uiSurface.digest_trace_rows, "Phase31K digest trace rows");
assert.deepEqual([...digestTrace.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest", "operator_packet_digest"]);
assert.equal(digestTrace.get("builder_readiness_digest")?.source_phase, "31E");
assert.equal(digestTrace.get("surface_digest")?.source_phase, "31F");
assert.equal(digestTrace.get("bridge_preview_digest")?.source_phase, "31G");
assert.equal(digestTrace.get("operator_packet_digest")?.source_phase, "31J");
assert.equal(digestTrace.get("operator_packet_digest")?.digest, packet.packet_digest);

const warnings = keyed(uiSurface.warning_banners, "Phase31K warning banners");
assert.deepEqual([...warnings.keys()], ["no_context_build", "no_operator_decision_execute", "no_canon_or_engine_write"]);
const sections = keyed(uiSurface.ui_sections, "Phase31K UI sections");
assert.deepEqual([...sections.keys()], ["ui_header", "surface_cards", "operator_review_table", "digest_trace", "warning_banners", "blocked_operator_decisions", "raw_json_preview"]);
assert.equal(sections.get("operator_review_table")?.items.length, 4);
assert.equal(sections.get("digest_trace")?.items.length, 4);
assert.equal(sections.get("raw_json_preview")?.visible_by_default, false);

assert(uiSurface.surface_markdown.includes("Aesthetic Memory Context Builder Operator Review UI Surface"));
assert(uiSurface.surface_markdown.includes("will_build_context_now: false"));
assert(uiSurface.surface_markdown.includes("will_execute_operator_decision: false"));
assert(uiSurface.chatgpt_ui_summary_lines.some((line) => line.includes("不 build context")));

const allowedUiActions = keyed(uiSurface.allowed_ui_actions, "Phase31K allowed UI actions");
assert.deepEqual([...allowedUiActions.keys()], ["read_operator_review_ui_surface", "copy_operator_review_ui_markdown", "inspect_operator_review_table_rows", "inspect_digest_trace_rows", "inspect_warning_banners", "inspect_blocked_operator_decisions"]);
for (const action of allowedUiActions.values()) assert.equal(action.allowed, true);

const blockedUiActions = keyed(uiSurface.blocked_ui_actions, "Phase31K blocked UI actions");
for (const key of ["approve_context_build", "execute_context_build", "attach_context_now", "mutate_context_now", "persist_builder_payload", "write_ui_surface_state", "write_bridge_state", "register_context_builder_bridge_mcp_tool", "write_canon", "update_active_engine", "update_compressed_rules"]) {
  assert.equal(blockedUiActions.get(key)?.allowed, false, `${key} must stay blocked.`);
}

assertTrueFlags(uiSurface.safety_boundary, ["read_only", "preview_only", "no_context_build", "no_context_attach", "no_context_mutation", "no_operator_decision_execute", "no_operator_packet_persist", "no_ui_surface_persist"], "Phase31K safety");
assertFalseFlags(uiSurface.safety_boundary, ["can_write_canon", "can_update_active_engine", "can_update_compressed_rules", "can_register_mcp_tool", "can_execute_operator_decision", "can_persist_operator_packet", "can_persist_ui_surface", "can_execute_mutating_ui_action"], "Phase31K safety");
assertFalseFlags(uiSurface.no_mutation_snapshot, ["active_engine_modified", "compressed_rules_modified", "canon_written", "context_built", "context_attached", "context_mutated", "operator_packet_persisted", "operator_decision_executed", "ui_surface_persisted", "ui_state_written", "context_built_from_ui_surface"], "Phase31K mutation");
assert.equal(uiSurface.raw_operator_packet, null);
assert.equal(uiSurface.raw_json_preview.visible_by_default, false);
assert.equal(uiSurface.raw_json_preview.raw_operator_packet_included, false);

const rawUiSurface = buildOperatorReviewUiSurface({ packet, includeRaw: true, includeMarkdown: false });
assert.equal(rawUiSurface.raw_operator_packet.phase, "31J");
assert.equal(rawUiSurface.raw_json_preview.visible_by_default, false);
assert.equal(rawUiSurface.raw_json_preview.raw_operator_packet_included, true);
assert.equal(rawUiSurface.surface_markdown, "");

for (let index = 0; index < 3; index += 1) {
  const rerun = await buildChain();
  const rerunPacket = buildOperatorReviewPacket({ builderGate: rerun.builderGate, builderSurface: rerun.builderSurface, builderBridge: rerun.builderBridge });
  const rerunUiSurface = buildOperatorReviewUiSurface({ packet: rerunPacket });
  assert.equal(rerun.builderGate.builder_readiness_digest, builderGate.builder_readiness_digest);
  assert.equal(rerun.builderSurface.surface_digest, builderSurface.surface_digest);
  assert.equal(rerun.builderBridge.bridge_preview_digest, builderBridge.bridge_preview_digest);
  assert.equal(rerunPacket.packet_digest, packet.packet_digest);
  assert.equal(rerunUiSurface.surface_digest, uiSurface.surface_digest);
  assert.deepEqual(rerunUiSurface, uiSurface, "Phase31K operator review UI surface rerun should be deterministic.");
}

const weakGate = await buildAestheticMemoryContextBuilderReadinessGate({ include_default_seed: false });
const weakSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ include_default_seed: false });
const weakBridge = await buildAestheticMemoryContextBuilderBridgePreview({ include_default_seed: false });
const weakPacket = buildOperatorReviewPacket({ builderGate: weakGate, builderSurface: weakSurface, builderBridge: weakBridge });
const weakUiSurface = buildOperatorReviewUiSurface({ packet: weakPacket });
assert.equal(weakGate.builder_readiness_status, "needs_context");
assert.equal(weakSurface.preview_status, "needs_context");
assert.equal(weakBridge.preview_status, "needs_context");
assert.equal(weakPacket.review_status, "needs_context");
assert.equal(weakUiSurface.preview_status, "needs_context");
assert.equal(weakUiSurface.can_display_operator_review_ui, false);
assertFalseFlags(weakUiSurface.no_mutation_snapshot, ["context_built", "context_attached", "context_mutated", "operator_packet_persisted", "operator_decision_executed", "ui_surface_persisted", "ui_state_written", "context_built_from_ui_surface"], "Phase31K weak mutation");

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31K changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31K changed compressed_rules hash.");
console.log("Phase31K aesthetic memory context builder operator review packet UI surface tests passed.");
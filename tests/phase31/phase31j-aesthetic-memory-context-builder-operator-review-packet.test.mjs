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
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
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
    "tests/phase31/phase31h-aesthetic-memory-context-builder-bridge-final-smoke.test.mjs",
    "tests/phase31/phase31i-aesthetic-memory-context-builder-bridge-stability-guard.test.mjs",
    "tests/phase31/phase31j-aesthetic-memory-context-builder-operator-review-packet.test.mjs",
    "tests/scripts/daily-scripts.test.mjs",
  ];
  for (const token of ordered) {
    assert(runAllText.includes(token), `run-all missing ${token}`);
  }
  for (let index = 0; index < ordered.length - 1; index += 1) {
    assert(
      runAllText.indexOf(ordered[index]) < runAllText.indexOf(ordered[index + 1]),
      `run-all order drifted: ${ordered[index]} should appear before ${ordered[index + 1]}`,
    );
  }
}

function assertNoMutationSnapshot(snapshot, label) {
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
    "context_built",
    "context_attached",
    "context_mutated",
    "injection_materialized",
    "adapter_payload_persisted",
    "builder_payload_persisted",
    "surface_state_written",
    "surface_state_persisted",
    "bridge_state_written",
    "bridge_state_persisted",
    "bridge_tool_registered",
  ]) {
    if (key in snapshot) {
      assert.equal(snapshot[key], false, `${label} mutation snapshot ${key} must stay false.`);
    }
  }
}

function assertSafetyBoundary(safety, label) {
  for (const key of [
    "read_only",
    "preview_only",
    "candidate_only",
    "no_generation",
    "no_revision",
    "no_auto_persist",
    "no_candidate_save",
    "no_approval",
    "no_canon_update",
    "no_active_engine_update",
    "no_compressed_rules_update",
    "no_runtime_ui_mutation",
    "no_mcp_tool_added",
    "no_memory_file_write",
    "no_context_build",
    "no_context_attach",
    "no_context_mutation",
    "no_materialized_context_injection",
    "no_adapter_payload_persist",
    "no_builder_payload_persist",
    "no_surface_state_persist",
    "no_bridge_state_persist",
    "no_bridge_tool_registration",
  ]) {
    if (key in safety) {
      assert.equal(safety[key], true, `${label} safety boundary ${key} must stay true.`);
    }
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
    "can_build_generation_context",
    "can_build_revision_context",
    "can_build_final_polisher_context",
    "can_build_reader_response_context",
    "can_materialize_context_injection",
    "can_attach_context_now",
    "can_persist_adapter_payload",
    "can_persist_builder_payload",
    "can_write_surface_state",
    "can_write_bridge_state",
    "can_register_context_builder_bridge_mcp_tool",
  ]) {
    if (key in safety) {
      assert.equal(safety[key], false, `${label} safety boundary ${key} must stay false.`);
    }
  }
}

function assertBridgeRows(bridge, label) {
  const rows = keyed(bridge.builder_bridge_rows, `${label} builder bridge rows`);
  assert.deepEqual(
    [...rows.keys()],
    [
      "writing_context_builder_bridge_preview",
      "revision_context_builder_bridge_preview",
      "final_polisher_context_builder_bridge_preview",
      "reader_response_context_builder_bridge_preview",
    ],
    `${label} builder bridge row order drifted.`,
  );

  const expectedPaths = new Map([
    ["writing_context_builder_bridge_preview", "writing_context.aesthetic_memory"],
    ["revision_context_builder_bridge_preview", "revision_context.aesthetic_memory"],
    ["final_polisher_context_builder_bridge_preview", "final_polisher_context.aesthetic_memory"],
    ["reader_response_context_builder_bridge_preview", "reader_response_context.aesthetic_memory"],
  ]);

  for (const [key, expectedPath] of expectedPaths) {
    const row = rows.get(key);
    assert.equal(row?.status, "ready", `${label} ${key} must stay ready.`);
    assert.equal(row?.context_path, expectedPath, `${label} ${key} context path drifted.`);
    assert.equal(row?.readonly_preview, true, `${label} ${key} must remain readonly preview.`);
    assert.match(row?.digest, /^[a-f0-9]{64}$/u, `${label} ${key} digest must be sha256.`);
    assert(row?.chatgpt_line.includes("readonly_preview=true"), `${label} ${key} must expose readonly preview in ChatGPT line.`);
  }

  return rows;
}

const input = Object.freeze({
  task_prompt: "Phase31J aesthetic memory context builder operator review packet.",
  accepted_patterns: [
    "角色要先像活人，才像設定。",
    "用場景物件承接壓力，而不是角色排隊說明。",
    "讓對話自然地打斷、停頓與錯開。",
    "一章一變局。",
  ],
  rejected_patterns: [
    "公告式總結",
    "主題先行",
    "流程化交接",
    "把能力當日常捷徑",
  ],
  style_principles: [
    "普通行動先直寫，幽默只能加味。",
    "不要把核對表語氣寫入正文。",
    "Operator packet 只能供人工審閱，不得執行 context build。",
  ],
  ui_preferences: [
    "Operator review packet 要顯示四條 context builder ready 狀態。",
    "Digest lineage 必須能從 31E、31F、31G 一路追蹤。",
    "Packet 安全文字必須明確標出 no build / no attach / no mutate / no persist。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_builder_operator_review_packet",
      category: "operator_review",
      polarity: "prefer",
      label: "Builder bridge preview 需要操作者審閱封包",
      rule: "Phase31J 必須把 ready rows、digest lineage、safety boundary、blocked capabilities 整理成 operator review packet。",
      rationale: "31E-31I 已完成 builder bridge preview 與穩定性 guard；下一步需要人可讀審閱封包，但仍不能執行 build。",
      strength: 100,
      applies_to: ["context_builder", "operator_review", "chatgpt_bridge", "safety"],
      examples: ["operator_review_status=ready_for_review；context_built=false；bridge_state_written=false。"],
    },
    {
      key: "avoid_operator_packet_execution",
      category: "safety",
      polarity: "reject",
      label: "Operator packet 不得成為執行器",
      rule: "Operator review packet 只能讀取 builder bridge preview，不得 approve、build、attach、mutate、persist 或 register tool。",
      rationale: "操作者審閱與正式 adoption / activation 仍必須分離。",
      strength: 100,
      applies_to: ["approval", "context_builder", "active_engine", "mcp"],
      examples: ["can_execute_operator_decision=false；can_register_mcp_tool=false。"],
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
  const builderBridge = await buildAestheticMemoryContextBuilderBridgePreview({
    surface: builderSurface,
    include_raw: includeRaw,
    include_markdown: includeMarkdown,
  });
  return {
    registry,
    surface,
    bridgePreview,
    injectionGate,
    adapterPreview,
    adapterBridge,
    builderGate,
    builderSurface,
    builderBridge,
  };
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
  const reviewStatus = readyRows === 4 && builderBridge.preview_status === "ready"
    ? "ready_for_operator_review"
    : "needs_context";
  const digestLineage = [
    { key: "builder_readiness_digest", source_phase: "31E", digest: builderGate.builder_readiness_digest },
    { key: "surface_digest", source_phase: "31F", digest: builderSurface.surface_digest },
    { key: "bridge_preview_digest", source_phase: "31G", digest: builderBridge.bridge_preview_digest },
  ];
  const blockedBridgeCapabilities = Array.isArray(builderBridge.blocked_bridge_capabilities)
    ? builderBridge.blocked_bridge_capabilities.map((capability) => ({
      key: capability.key,
      allowed: capability.allowed === true,
      reason: capability.reason ?? "blocked_by_preview_safety_boundary",
    }))
    : [];
  const packetPayload = {
    reviewStatus,
    sourceBridgePreviewDigest: builderBridge.bridge_preview_digest,
    sourceSurfaceDigest: builderSurface.surface_digest,
    sourceBuilderReadinessDigest: builderGate.builder_readiness_digest,
    operatorReviewRows,
    digestLineage,
    blockedBridgeCapabilities,
  };
  const packetDigest = hash(stableJson(packetPayload));
  return {
    used: true,
    phase: "31J",
    version: "aesthetic_memory_context_builder_operator_review_packet_v1",
    packet_kind: "aesthetic_memory_context_builder_operator_review_packet",
    packet_channel: "operator_context_builder_review_packet",
    packet_mode: "readonly_operator_review_packet",
    review_status: reviewStatus,
    source_phase: builderBridge.phase,
    source_bridge_kind: builderBridge.bridge_kind,
    source_bridge_preview_digest: builderBridge.bridge_preview_digest,
    source_surface_digest: builderSurface.surface_digest,
    source_builder_readiness_digest: builderGate.builder_readiness_digest,
    packet_digest: packetDigest,
    operator_review_cards: [
      { key: "operator_review_overall", label: "Operator Review", value: `${readyRows}/4 ready`, status: reviewStatus },
      { key: "digest_lineage", label: "Digest Lineage", value: "31E→31F→31G", status: "traceable" },
      { key: "safety_boundary", label: "Safety Boundary", value: "clean", status: "blocked_execution" },
      { key: "blocked_capabilities", label: "Blocked Capabilities", value: String(blockedBridgeCapabilities.length), status: "blocked" },
      { key: "operator_next_step", label: "Operator Next Step", value: "review_only", status: "manual_review_required" },
    ],
    operator_review_rows: operatorReviewRows,
    digest_lineage: digestLineage,
    chatgpt_operator_lines: [
      "Operator review packet: ready_for_operator_review; 不 build context; 不 attach context; 不 mutate context; 不 persist payload。",
      ...operatorReviewRows.map((row) => row.operator_line),
    ],
    allowed_operator_actions: [
      { key: "read_operator_review_packet", allowed: true },
      { key: "copy_operator_review_markdown", allowed: true },
      { key: "inspect_operator_review_rows", allowed: true },
      { key: "inspect_digest_lineage", allowed: true },
      { key: "inspect_blocked_capabilities", allowed: true },
    ],
    blocked_operator_decisions: [
      "approve_context_build",
      "execute_context_build",
      "attach_context_now",
      "mutate_context_now",
      "persist_builder_payload",
      "write_bridge_state",
      "register_context_builder_bridge_mcp_tool",
      "write_canon",
      "update_active_engine",
      "update_compressed_rules",
    ].map((key) => ({ key, allowed: false })),
    blocked_bridge_capabilities: blockedBridgeCapabilities,
    safety_boundary: {
      ...builderBridge.safety_boundary,
      no_operator_decision_execute: true,
      no_operator_packet_persist: true,
      can_execute_operator_decision: false,
      can_persist_operator_packet: false,
    },
    no_mutation_snapshot: {
      ...builderBridge.no_mutation_snapshot,
      operator_packet_persisted: false,
      operator_decision_executed: false,
      context_built_from_operator_packet: false,
    },
    raw_bridge_preview: includeRaw ? builderBridge : null,
    raw_json_preview: {
      visible_by_default: false,
      raw_bridge_preview_included: includeRaw,
    },
  };
}

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31J active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31J compressed_rules hash baseline drifted before test.");

const runAllText = await readFile(runAllPath, "utf8");
assertRunAllOrder(runAllText);

const chain = await buildChain();
const { builderGate, builderSurface, builderBridge } = chain;

assert.equal(builderGate.phase, "31E");
assert.equal(builderGate.builder_readiness_status, "ready");
assert.match(builderGate.builder_readiness_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderSurface.phase, "31F");
assert.equal(builderSurface.preview_status, "ready");
assert.match(builderSurface.surface_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderSurface.source_builder_readiness_digest, builderGate.builder_readiness_digest);
assert.equal(builderBridge.phase, "31G");
assert.equal(builderBridge.preview_status, "ready");
assert.match(builderBridge.bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderBridge.source_surface_digest, builderSurface.surface_digest);

assertBridgeRows(builderBridge, "Phase31J source bridge");
assertSafetyBoundary(builderBridge.safety_boundary, "Phase31J source bridge");
assertNoMutationSnapshot(builderBridge.no_mutation_snapshot, "Phase31J source bridge");

const packet = buildOperatorReviewPacket({ builderGate, builderSurface, builderBridge });
assert.equal(packet.used, true);
assert.equal(packet.phase, "31J");
assert.equal(packet.version, "aesthetic_memory_context_builder_operator_review_packet_v1");
assert.equal(packet.packet_kind, "aesthetic_memory_context_builder_operator_review_packet");
assert.equal(packet.packet_channel, "operator_context_builder_review_packet");
assert.equal(packet.packet_mode, "readonly_operator_review_packet");
assert.equal(packet.review_status, "ready_for_operator_review");
assert.equal(packet.source_phase, "31G");
assert.equal(packet.source_bridge_kind, "aesthetic_memory_context_builder_bridge_preview");
assert.equal(packet.source_bridge_preview_digest, builderBridge.bridge_preview_digest);
assert.equal(packet.source_surface_digest, builderSurface.surface_digest);
assert.equal(packet.source_builder_readiness_digest, builderGate.builder_readiness_digest);
assert.match(packet.packet_digest, /^[a-f0-9]{64}$/u);

const packetCards = keyed(packet.operator_review_cards, "Phase31J operator review cards");
assert.deepEqual(
  [...packetCards.keys()],
  [
    "operator_review_overall",
    "digest_lineage",
    "safety_boundary",
    "blocked_capabilities",
    "operator_next_step",
  ],
  "Phase31J operator card order drifted.",
);
assert.equal(packetCards.get("operator_review_overall")?.value, "4/4 ready");
assert.equal(packetCards.get("digest_lineage")?.value, "31E→31F→31G");
assert.equal(packetCards.get("safety_boundary")?.value, "clean");
assert.equal(packetCards.get("operator_next_step")?.value, "review_only");

const packetRows = keyed(packet.operator_review_rows, "Phase31J operator review rows");
assert.deepEqual(
  [...packetRows.keys()],
  [
    "writing_context_builder_operator_review",
    "revision_context_builder_operator_review",
    "final_polisher_context_builder_operator_review",
    "reader_response_context_builder_operator_review",
  ],
  "Phase31J operator row order drifted.",
);
for (const row of packetRows.values()) {
  assert.equal(row.status, "ready_for_operator_review", `${row.key} should be ready for operator review.`);
  assert.equal(row.readonly_preview, true, `${row.key} should remain readonly preview.`);
  assert.match(row.source_digest, /^[a-f0-9]{64}$/u);
  assert.equal(row.can_build_context_now, false);
  assert.equal(row.can_attach_context_now, false);
  assert.equal(row.can_mutate_context, false);
  assert.equal(row.can_persist_payload, false);
  assert(row.operator_line.includes("build=false"));
  assert(row.operator_line.includes("attach=false"));
  assert(row.operator_line.includes("mutate=false"));
}
assert.equal(packetRows.get("writing_context_builder_operator_review")?.context_path, "writing_context.aesthetic_memory");
assert.equal(packetRows.get("revision_context_builder_operator_review")?.context_path, "revision_context.aesthetic_memory");
assert.equal(packetRows.get("final_polisher_context_builder_operator_review")?.context_path, "final_polisher_context.aesthetic_memory");
assert.equal(packetRows.get("reader_response_context_builder_operator_review")?.context_path, "reader_response_context.aesthetic_memory");

const lineage = keyed(packet.digest_lineage, "Phase31J digest lineage");
assert.deepEqual([...lineage.keys()], ["builder_readiness_digest", "surface_digest", "bridge_preview_digest"]);
assert.equal(lineage.get("builder_readiness_digest")?.source_phase, "31E");
assert.equal(lineage.get("surface_digest")?.source_phase, "31F");
assert.equal(lineage.get("bridge_preview_digest")?.source_phase, "31G");
assert.equal(lineage.get("builder_readiness_digest")?.digest, builderGate.builder_readiness_digest);
assert.equal(lineage.get("surface_digest")?.digest, builderSurface.surface_digest);
assert.equal(lineage.get("bridge_preview_digest")?.digest, builderBridge.bridge_preview_digest);

const allowedActions = keyed(packet.allowed_operator_actions, "Phase31J allowed operator actions");
assert.deepEqual(
  [...allowedActions.keys()],
  [
    "read_operator_review_packet",
    "copy_operator_review_markdown",
    "inspect_operator_review_rows",
    "inspect_digest_lineage",
    "inspect_blocked_capabilities",
  ],
);
for (const action of allowedActions.values()) {
  assert.equal(action.allowed, true, `${action.key} should be read-only allowed.`);
}

const blockedDecisions = keyed(packet.blocked_operator_decisions, "Phase31J blocked operator decisions");
for (const key of [
  "approve_context_build",
  "execute_context_build",
  "attach_context_now",
  "mutate_context_now",
  "persist_builder_payload",
  "write_bridge_state",
  "register_context_builder_bridge_mcp_tool",
  "write_canon",
  "update_active_engine",
  "update_compressed_rules",
]) {
  assert.equal(blockedDecisions.get(key)?.allowed, false, `${key} must stay blocked.`);
}

const blockedCapabilities = keyed(packet.blocked_bridge_capabilities, "Phase31J blocked bridge capabilities");
for (const key of [
  "build_generation_context",
  "build_revision_context",
  "build_final_polisher_context",
  "build_reader_response_context",
  "materialize_context_builder",
  "attach_context_now",
  "mutate_writing_context",
  "mutate_revision_context",
  "mutate_final_polisher_context",
  "mutate_reader_response_context",
  "persist_adapter_payload",
  "persist_builder_payload",
  "write_surface_state",
  "persist_surface_state",
  "write_bridge_state",
  "persist_bridge_state",
  "register_context_builder_mcp_tool",
  "register_context_builder_bridge_mcp_tool",
]) {
  assert.equal(blockedCapabilities.get(key)?.allowed, false, `${key} must stay blocked in operator packet.`);
}

assertSafetyBoundary(packet.safety_boundary, "Phase31J packet");
assert.equal(packet.safety_boundary.no_operator_decision_execute, true);
assert.equal(packet.safety_boundary.no_operator_packet_persist, true);
assert.equal(packet.safety_boundary.can_execute_operator_decision, false);
assert.equal(packet.safety_boundary.can_persist_operator_packet, false);
assertNoMutationSnapshot(packet.no_mutation_snapshot, "Phase31J packet");
assert.equal(packet.no_mutation_snapshot.operator_packet_persisted, false);
assert.equal(packet.no_mutation_snapshot.operator_decision_executed, false);
assert.equal(packet.no_mutation_snapshot.context_built_from_operator_packet, false);

assert.equal(packet.raw_bridge_preview, null);
assert.equal(packet.raw_json_preview.visible_by_default, false);
assert.equal(packet.raw_json_preview.raw_bridge_preview_included, false);
assert(packet.chatgpt_operator_lines.some((line) => line.includes("ready_for_operator_review")));
assert(packet.chatgpt_operator_lines.some((line) => line.includes("不 build context")));
assert(packet.chatgpt_operator_lines.some((line) => line.includes("writing_context_builder/writing_context.aesthetic_memory=ready")));

const rawPacket = buildOperatorReviewPacket({ builderGate, builderSurface, builderBridge, includeRaw: true });
assert.equal(rawPacket.raw_bridge_preview.phase, "31G");
assert.equal(rawPacket.raw_json_preview.visible_by_default, false);
assert.equal(rawPacket.raw_json_preview.raw_bridge_preview_included, true);

for (let index = 0; index < 3; index += 1) {
  const rerun = await buildChain();
  const rerunPacket = buildOperatorReviewPacket({
    builderGate: rerun.builderGate,
    builderSurface: rerun.builderSurface,
    builderBridge: rerun.builderBridge,
  });
  assert.equal(rerun.builderGate.builder_readiness_digest, builderGate.builder_readiness_digest);
  assert.equal(rerun.builderSurface.surface_digest, builderSurface.surface_digest);
  assert.equal(rerun.builderBridge.bridge_preview_digest, builderBridge.bridge_preview_digest);
  assert.equal(rerunPacket.packet_digest, packet.packet_digest);
  assert.deepEqual(rerunPacket, packet, "Phase31J operator review packet rerun should be deterministic.");
}

const weakGate = await buildAestheticMemoryContextBuilderReadinessGate({ include_default_seed: false });
const weakSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ include_default_seed: false });
const weakBridge = await buildAestheticMemoryContextBuilderBridgePreview({ include_default_seed: false });
const weakPacket = buildOperatorReviewPacket({
  builderGate: weakGate,
  builderSurface: weakSurface,
  builderBridge: weakBridge,
});
assert.equal(weakGate.builder_readiness_status, "needs_context");
assert.equal(weakSurface.preview_status, "needs_context");
assert.equal(weakBridge.preview_status, "needs_context");
assert.equal(weakPacket.review_status, "needs_context");
assertNoMutationSnapshot(weakGate.no_mutation_snapshot, "Phase31J weak gate");
assertNoMutationSnapshot(weakSurface.no_mutation_snapshot, "Phase31J weak surface");
assertNoMutationSnapshot(weakBridge.no_mutation_snapshot, "Phase31J weak bridge");
assertNoMutationSnapshot(weakPacket.no_mutation_snapshot, "Phase31J weak packet");
assertSafetyBoundary(weakBridge.safety_boundary, "Phase31J weak bridge");
assert.equal(weakPacket.safety_boundary.can_execute_operator_decision, false);
assert.equal(weakPacket.no_mutation_snapshot.context_built_from_operator_packet, false);

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31J changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31J changed compressed_rules hash.");

console.log("Phase31J aesthetic memory context builder operator review packet tests passed.");
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
const mcpSmokePath = path.join(root, "server", "src", "mcp-smoke-test.mjs");
const mcpContractPath = path.join(root, "tests", "tools", "mcp-contract.test.mjs");
const activeEnginePath = path.join(root, "data", "canon_db", "active_engine.md");
const compressedRulesPath = path.join(root, "data", "error_report_db", "compressed_rules.md");

const expectedActiveEngineHash = "d797df085cb179d99e2a7bed9ab4545f6b85e9b276574286da4174e9538cb6cb";
const expectedCompressedRulesHash = "f711eed25b777f54fe9bbec7939ef57cfc54a6d4e02f93fd549ae937100c50db";

function hash(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
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
    "tests/phase31/phase31g-aesthetic-memory-context-builder-bridge-preview.test.mjs",
    "tests/phase31/phase31h-aesthetic-memory-context-builder-bridge-final-smoke.test.mjs",
    "tests/phase31/phase31i-aesthetic-memory-context-builder-bridge-stability-guard.test.mjs",
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

function assertMcpSmokeTimeoutHardening(mcpSmokeText, mcpContractText) {
  for (const token of [
    "const mcpSmokeResponseTimeoutMs = 30_000;",
    "function waitForResponse(responses, id, timeoutMs = mcpSmokeResponseTimeoutMs)",
    "const effectiveTimeoutMs = Math.max(timeoutMs, mcpSmokeResponseTimeoutMs);",
    "}, effectiveTimeoutMs);",
  ]) {
    assert(
      mcpSmokeText.includes(token),
      `MCP smoke timeout hardening token missing: ${token}`,
    );
  }

  for (const token of [
    "MCP contract test timed out after 300 seconds.",
    "}, 300_000);",
  ]) {
    assert(
      mcpContractText.includes(token),
      `MCP contract timeout hardening token missing: ${token}`,
    );
  }

  assert.equal(
    mcpContractText.includes("MCP contract test timed out after 180 seconds."),
    false,
    "MCP contract timeout message regressed to 180 seconds.",
  );
  assert.equal(
    mcpContractText.includes("}, 180_000);"),
    false,
    "MCP contract timeout duration regressed to 180_000.",
  );
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
  task_prompt: "Phase31I aesthetic memory context builder bridge stability guard.",
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
    "ChatGPT bridge preview 只能閱讀摘要，不得寫入 runtime context。",
  ],
  ui_preferences: [
    "Bridge preview 要顯示四條 context builder ready 狀態。",
    "安全文字必須明確標出 no build / no attach / no mutate / no persist。",
  ],
  aesthetic_memory_entries: [
    {
      key: "prefer_builder_bridge_stability_guard",
      category: "stability",
      polarity: "prefer",
      label: "Builder bridge preview 需要穩定性 guard",
      rule: "Phase31I 必須防止 31G/31H 鏈路順序、digest 穩定性、raw 預設隱藏與 MCP smoke timeout hardening 被回退。",
      rationale: "31H final smoke 暴露 Windows MCP response drain timeout 後，需要 regression guard 鎖住修正。",
      strength: 100,
      applies_to: ["context_builder", "chatgpt_bridge", "mcp_smoke", "safety"],
      examples: ["mcpSmokeResponseTimeoutMs=30_000；MCP contract timeout=300_000。"],
    },
    {
      key: "avoid_runtime_context_side_effect_in_stability_guard",
      category: "safety",
      polarity: "reject",
      label: "穩定性 guard 不得 materialize context",
      rule: "Phase31I 只能驗證 preview 與 static hardening，不得 build、attach、mutate、persist 任何 context payload。",
      rationale: "審美記憶 context builder 仍處於 preview/read-only chain。",
      strength: 100,
      applies_to: ["writing_context", "revision_context", "final_polisher_context", "reader_response_context"],
      examples: ["context_built=false；bridge_state_written=false；builder_payload_persisted=false。"],
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

const activeEngineBefore = await readFile(activeEnginePath, "utf8");
const compressedRulesBefore = await readFile(compressedRulesPath, "utf8");
assert.equal(hash(activeEngineBefore), expectedActiveEngineHash, "Phase31I active_engine hash baseline drifted before test.");
assert.equal(hash(compressedRulesBefore), expectedCompressedRulesHash, "Phase31I compressed_rules hash baseline drifted before test.");

const [runAllText, mcpSmokeText, mcpContractText] = await Promise.all([
  readFile(runAllPath, "utf8"),
  readFile(mcpSmokePath, "utf8"),
  readFile(mcpContractPath, "utf8"),
]);

assertRunAllOrder(runAllText);
assertMcpSmokeTimeoutHardening(mcpSmokeText, mcpContractText);

const chain = await buildChain();
const { builderGate, builderSurface, builderBridge } = chain;

assert.equal(builderGate.phase, "31E");
assert.equal(builderGate.builder_readiness_status, "ready");
assert.equal(builderGate.will_build_context_now, false);
assert.equal(builderGate.will_attach_context_now, false);
assert.equal(builderGate.will_mutate_context, false);
assert.match(builderGate.builder_readiness_digest, /^[a-f0-9]{64}$/u);

assert.equal(builderSurface.phase, "31F");
assert.equal(builderSurface.preview_status, "ready");
assert.equal(builderSurface.will_build_context_now, false);
assert.equal(builderSurface.will_attach_context_now, false);
assert.equal(builderSurface.will_mutate_context, false);
assert.match(builderSurface.surface_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderSurface.source_builder_readiness_digest, builderGate.builder_readiness_digest);

assert.equal(builderBridge.phase, "31G");
assert.equal(builderBridge.bridge_kind, "aesthetic_memory_context_builder_bridge_preview");
assert.equal(builderBridge.bridge_channel, "chatgpt_bridge_context_builder_preview");
assert.equal(builderBridge.preview_status, "ready");
assert.equal(builderBridge.can_display_builder_bridge_preview, true);
assert.equal(builderBridge.will_build_context_now, false);
assert.equal(builderBridge.will_attach_context_now, false);
assert.equal(builderBridge.will_mutate_context, false);
assert.equal(builderBridge.builder_payload_persisted, false);
assert.equal(builderBridge.bridge_state_persisted, false);
assert.match(builderBridge.bridge_preview_digest, /^[a-f0-9]{64}$/u);
assert.equal(builderBridge.source_surface_digest, builderSurface.surface_digest);

assertBridgeRows(builderBridge, "Phase31I");
const cards = keyed(builderBridge.builder_bridge_cards, "Phase31I builder bridge cards");
assert.equal(cards.get("context_builder_bridge_overall")?.value, "4/4 ready");
assert.equal(cards.get("bridge_safety_boundary")?.value, "clean");

assert.equal(builderBridge.raw_surface, null);
assert.equal(builderBridge.raw_json_preview.visible_by_default, false);
assert.equal(builderBridge.raw_json_preview.raw_surface_included, false);
assert(builderBridge.surface_markdown.includes("Aesthetic Memory Context Builder Bridge Preview"));
assert(builderBridge.surface_markdown.includes("will_build_context_now: false"));
assert(builderBridge.surface_markdown.includes("bridge_state_written: false"));
assert(builderBridge.chatgpt_summary_lines.some((line) => line.includes("不 build context")));

assertSafetyBoundary(builderGate.safety_boundary, "Phase31E");
assertSafetyBoundary(builderSurface.safety_boundary, "Phase31F");
assertSafetyBoundary(builderBridge.safety_boundary, "Phase31G");
assertNoMutationSnapshot(builderGate.no_mutation_snapshot, "Phase31E");
assertNoMutationSnapshot(builderSurface.no_mutation_snapshot, "Phase31F");
assertNoMutationSnapshot(builderBridge.no_mutation_snapshot, "Phase31G");

const blocked = keyed(builderBridge.blocked_bridge_capabilities, "Phase31I blocked bridge capabilities");
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
  assert.equal(blocked.get(key)?.allowed, false, `${key} must stay blocked in Phase31I.`);
}

const rawChain = await buildChain({ includeRaw: true, includeMarkdown: false });
assert.equal(rawChain.builderBridge.raw_surface.phase, "31F");
assert.equal(rawChain.builderBridge.raw_json_preview.raw_surface_included, true);
assert.equal(rawChain.builderBridge.raw_json_preview.visible_by_default, false);
assert.equal(rawChain.builderBridge.surface_markdown, "");

const reruns = [];
for (let index = 0; index < 3; index += 1) {
  reruns.push(await buildChain());
}
for (const rerun of reruns) {
  assert.equal(rerun.builderGate.builder_readiness_digest, builderGate.builder_readiness_digest);
  assert.equal(rerun.builderSurface.surface_digest, builderSurface.surface_digest);
  assert.equal(rerun.builderBridge.bridge_preview_digest, builderBridge.bridge_preview_digest);
  assert.deepEqual(rerun.builderBridge, builderBridge, "Phase31I builder bridge preview rerun should be deterministic.");
}

const weakGate = await buildAestheticMemoryContextBuilderReadinessGate({ include_default_seed: false });
const weakSurface = await buildAestheticMemoryContextBuilderPreviewSurface({ include_default_seed: false });
const weakBridge = await buildAestheticMemoryContextBuilderBridgePreview({ include_default_seed: false });
assert.equal(weakGate.builder_readiness_status, "needs_context");
assert.equal(weakSurface.preview_status, "needs_context");
assert.equal(weakBridge.preview_status, "needs_context");
assertNoMutationSnapshot(weakGate.no_mutation_snapshot, "Phase31I weak gate");
assertNoMutationSnapshot(weakSurface.no_mutation_snapshot, "Phase31I weak surface");
assertNoMutationSnapshot(weakBridge.no_mutation_snapshot, "Phase31I weak bridge");
assertSafetyBoundary(weakBridge.safety_boundary, "Phase31I weak bridge");

assert.equal(hash(await readFile(activeEnginePath, "utf8")), expectedActiveEngineHash, "Phase31I changed active_engine hash.");
assert.equal(hash(await readFile(compressedRulesPath, "utf8")), expectedCompressedRulesHash, "Phase31I changed compressed_rules hash.");

console.log("Phase31I aesthetic memory context builder bridge stability guard tests passed.");

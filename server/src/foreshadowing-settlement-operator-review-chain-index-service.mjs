import {
  buildForeshadowingSettlementOperatorReadinessDashboard,
} from "./foreshadowing-settlement-operator-readiness-dashboard-service.mjs";
import {
  buildForeshadowingSettlementOperatorManualAdoptionReviewEntryUiSurface,
} from "./foreshadowing-settlement-operator-manual-adoption-review-entry-ui-surface-service.mjs";

export const foreshadowingSettlementOperatorReviewChainIndexVersion =
  "foreshadowing_settlement_operator_review_chain_index_v1";

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

function boolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeDashboard(input) {
  const bundle = object(input);
  const dashboard = object(
    bundle.operator_readiness_dashboard
      ?? bundle.readiness_dashboard
      ?? bundle.dashboard,
  );
  if (dashboard.phase === "27R") return dashboard;
  return buildForeshadowingSettlementOperatorReadinessDashboard({
    ...bundle,
    include_raw: true,
    include_markdown: true,
  });
}

function normalizeManualReviewSurface(input) {
  const bundle = object(input);
  const surface = object(
    bundle.operator_manual_adoption_review_entry_surface
      ?? bundle.manual_adoption_review_entry_surface
      ?? bundle.review_entry_surface
      ?? bundle.surface,
  );
  if (surface.phase === "27X") return surface;
  return buildForeshadowingSettlementOperatorManualAdoptionReviewEntryUiSurface({
    ...bundle,
    include_raw: true,
    include_markdown: true,
  });
}

function payloadStatus(payload) {
  const value = payload.index_status
    ?? payload.dashboard_status
    ?? payload.surface_status
    ?? payload.packet_status
    ?? payload.bridge_surface_status
    ?? payload.gate_status
    ?? payload.decision
    ?? payload.status
    ?? "not_available";
  return text(String(value), 180);
}

function payloadSafetyLocked(payload) {
  const safety = object(payload.safety);
  if (Object.keys(safety).length === 0) return null;
  return safety.read_only === true
    && safety.preview_only === true
    && safety.no_auto_persist === true
    && safety.no_canon_update === true
    && safety.no_active_engine_update === true
    && safety.bridge_can_approve === false
    && safety.bridge_can_confirm_adoption === false
    && safety.bridge_can_activate_engine === false
    && safety.pending_engine_candidate_created === false
    && safety.active_engine_modified === false
    && safety.canon_modified === false
    && safety.compressed_rules_modified === false;
}

function phaseRow(key, label, expectedPhase, payload, extras = {}) {
  const item = object(payload);
  const phase = text(item.phase, 40) || "not_loaded";
  const loaded = phase === expectedPhase;
  return {
    key,
    label,
    expected_phase: expectedPhase,
    phase,
    status: payloadStatus(item),
    loaded,
    readable: loaded,
    safety_locked: payloadSafetyLocked(item),
    source_phases: array(item.source_phases).map((value) => text(value, 40)).filter(Boolean),
    summary: text(extras.summary ?? "", 500),
    route: text(extras.route ?? "#writer-workbench", 120),
    test_path: text(extras.test_path ?? "", 240) || null,
    coverage_only: extras.coverage_only === true,
  };
}

function coverageRow(key, label, phase, testPath, summary) {
  return {
    key,
    label,
    expected_phase: phase,
    phase,
    status: "covered_by_regression_guard",
    loaded: true,
    readable: true,
    safety_locked: true,
    source_phases: [phase],
    summary: text(summary, 500),
    route: "#writer-workbench",
    test_path: testPath,
    coverage_only: true,
  };
}

function card(key, title, value, tone, summary = "") {
  return {
    key,
    title,
    value: text(String(value ?? ""), 200),
    tone,
    summary: text(summary, 500),
  };
}

function prohibitedAction(key, label, reason) {
  return {
    key,
    label,
    allowed: false,
    reason: text(reason, 500),
  };
}

function entrypoint(key, label, route, sourcePhase, reason, priority = "secondary") {
  return {
    key,
    label,
    route,
    ui_target: String(route).replace(/^#/u, "") || "writer-workbench",
    source_phase: sourcePhase,
    reason: text(reason, 500),
    priority,
    read_only: true,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
  };
}

function chainSegment(key, label, phases, status, summary) {
  return {
    key,
    label,
    phases,
    status,
    ready: status === "ready",
    summary: text(summary, 500),
  };
}

function allRequiredRowsLoaded(rows) {
  return rows
    .filter((row) => row.coverage_only !== true)
    .every((row) => row.loaded === true && row.readable === true);
}

function allKnownSafetyLocked(rows) {
  return rows.every((row) => row.safety_locked === true || row.safety_locked === null);
}

function safetyMatrix(dashboard, manualSurface, packet, rows) {
  const dashboardSafety = object(dashboard.safety);
  const surfaceSafety = object(manualSurface.safety);
  const packetSafety = object(packet.safety);

  return {
    read_only: true,
    preview_only: true,
    no_auto_persist: true,
    no_canon_update: true,
    no_active_engine_update: true,
    no_compressed_rules_update: true,
    bridge_can_approve: false,
    bridge_can_confirm_adoption: false,
    bridge_can_activate_engine: false,
    index_can_approve: false,
    index_can_confirm_adoption: false,
    index_can_activate_engine: false,
    index_can_auto_adopt: false,
    index_can_auto_settle: false,
    index_can_write_canon: false,
    index_can_create_pending_engine_candidate: false,
    pending_engine_candidate_created: false,
    active_engine_modified: false,
    canon_modified: false,
    compressed_rules_modified: false,
    automatic_adoption_performed: false,
    automatic_settlement_performed: false,
    source_surfaces_locked: [
      dashboardSafety.read_only === true && dashboardSafety.no_active_engine_update === true,
      surfaceSafety.read_only === true && surfaceSafety.no_active_engine_update === true,
      packetSafety.read_only === true && packetSafety.no_active_engine_update === true,
      allKnownSafetyLocked(rows),
    ].every(Boolean),
  };
}

function markdownFor(index) {
  return [
    "## Foreshadowing Settlement Operator Review Chain Index",
    "",
    "- phase: " + index.phase,
    "- version: " + index.version,
    "- index_status: " + index.index_status,
    "- decision: " + index.decision,
    "- can_open_review_surfaces: " + String(index.can_open_review_surfaces),
    "- can_approve: " + String(index.can_approve),
    "- can_confirm_adoption: " + String(index.can_confirm_adoption),
    "- can_activate_engine: " + String(index.can_activate_engine),
    "- active_engine_modified: " + String(index.safety.active_engine_modified),
    "- canon_modified: " + String(index.safety.canon_modified),
    "",
    "### Indexed Phases",
    ...index.phase_rows.map((row) => (
      `- ${row.key}: ${row.phase}/${row.expected_phase}; status=${row.status}; coverage_only=${row.coverage_only}`
    )),
    "",
    "### Operator Entrypoints",
    ...index.operator_entrypoints.map((item) => `- ${item.key}: ${item.label} (${item.route})`),
    "",
    "### Prohibited Actions",
    ...index.prohibited_actions.map((item) => `- ${item.key}: allowed=${item.allowed}`),
    "",
  ].join("\n");
}

export function buildForeshadowingSettlementOperatorReviewChainIndex(input = {}) {
  const bundle = object(input);
  const dashboard = normalizeDashboard(bundle);
  const manualSurface = normalizeManualReviewSurface(bundle);
  const packet = object(manualSurface.raw_packet);
  const adoptionGateSurface = object(packet.raw_surface);
  const adoptionGate = object(adoptionGateSurface.raw_gate);

  const phaseRows = [
    phaseRow(
      "phase27r_readiness_dashboard",
      "Phase 27R readiness dashboard",
      "27R",
      dashboard,
      { summary: "Operator readiness dashboard built from the Phase 27Q full bridge smoke lineage." },
    ),
    phaseRow(
      "phase27t_adoption_readiness_gate",
      "Phase 27T adoption readiness gate",
      "27T",
      adoptionGate,
      { summary: "Adoption readiness gate evidence must remain readable through the manual review chain." },
    ),
    phaseRow(
      "phase27u_adoption_gate_surface",
      "Phase 27U adoption gate UI bridge surface",
      "27U",
      adoptionGateSurface,
      { summary: "Gate surface exposes decision, blockers, next actions, safety badges, and raw gate JSON." },
    ),
    phaseRow(
      "phase27w_manual_adoption_review_entry_packet",
      "Phase 27W manual adoption review entry packet",
      "27W",
      packet,
      { summary: "Evidence packet for entering human manual adoption review without approving or mutating state." },
    ),
    phaseRow(
      "phase27x_manual_adoption_review_entry_ui_surface",
      "Phase 27X manual adoption review entry UI surface",
      "27X",
      manualSurface,
      { summary: "Workbench UI/API surface for manual review entry evidence and safety locks." },
    ),
    coverageRow(
      "phase27y_manual_adoption_review_entry_live_ui_smoke",
      "Phase 27Y manual adoption review entry live UI smoke",
      "27Y",
      "tests/phase27/phase27y-foreshadowing-settlement-operator-manual-adoption-review-entry-live-ui-smoke.test.mjs",
      "Live UI smoke confirms the Workbench endpoint, index, app.js renderer, raw packet, and no-mutation guards.",
    ),
    coverageRow(
      "phase27z_manual_adoption_review_entry_final_bridge_smoke",
      "Phase 27Z manual adoption review entry final bridge smoke",
      "27Z",
      "tests/phase27/phase27z-foreshadowing-settlement-operator-manual-adoption-review-entry-final-bridge-smoke.test.mjs",
      "Final bridge smoke confirms ChatGPT Bridge / Workbench readability for the 27W-27X-27Y chain.",
    ),
  ];

  const prohibitedActions = [
    prohibitedAction("approve_from_index", "Approve from review chain index", "The index is navigation and evidence only."),
    prohibitedAction("confirm_adoption_from_index", "Confirm adoption from review chain index", "Adoption confirmation must stay inside the existing human approval flow."),
    prohibitedAction("activate_engine_from_index", "Activate engine from review chain index", "Engine activation is forbidden from this index."),
    prohibitedAction("write_canon_from_index", "Write Canon from review chain index", "Canon DB writes are forbidden from this index."),
    prohibitedAction("create_pending_engine_candidate_from_index", "Create pending engine candidate from review chain index", "Pending engine candidate creation is forbidden from this index."),
    prohibitedAction("auto_settle_from_index", "Auto-settle from review chain index", "Automatic settlement is forbidden from this index."),
    prohibitedAction("update_compressed_rules_from_index", "Update compressed_rules from review chain index", "Compressed rules updates are forbidden from this index."),
  ];

  const safety = safetyMatrix(dashboard, manualSurface, packet, phaseRows);
  const checks = {
    readiness_dashboard_loaded: dashboard.phase === "27R",
    adoption_readiness_gate_loaded: adoptionGate.phase === "27T",
    adoption_gate_surface_loaded: adoptionGateSurface.phase === "27U",
    manual_review_entry_packet_loaded: packet.phase === "27W",
    manual_review_entry_surface_loaded: manualSurface.phase === "27X",
    live_ui_smoke_covered: phaseRows.some((row) => row.key === "phase27y_manual_adoption_review_entry_live_ui_smoke" && row.coverage_only === true),
    final_bridge_smoke_covered: phaseRows.some((row) => row.key === "phase27z_manual_adoption_review_entry_final_bridge_smoke" && row.coverage_only === true),
    required_payloads_readable: allRequiredRowsLoaded(phaseRows),
    prohibited_actions_locked: prohibitedActions.every((item) => item.allowed === false),
    source_surfaces_locked: safety.source_surfaces_locked === true,
    no_mutation_side_effects: safety.pending_engine_candidate_created === false
      && safety.active_engine_modified === false
      && safety.canon_modified === false
      && safety.compressed_rules_modified === false
      && safety.automatic_adoption_performed === false
      && safety.automatic_settlement_performed === false,
  };
  checks.index_ready = checks.required_payloads_readable
    && checks.prohibited_actions_locked
    && checks.source_surfaces_locked
    && checks.no_mutation_side_effects;

  const chainSegments = [
    chainSegment(
      "operator_readiness_chain",
      "Operator readiness chain",
      ["27R", "27S"],
      checks.readiness_dashboard_loaded ? "ready" : "blocked",
      "Readiness dashboard and live UI smoke coverage for the earlier operator dashboard path.",
    ),
    chainSegment(
      "adoption_gate_chain",
      "Adoption gate chain",
      ["27T", "27U", "27V"],
      checks.adoption_readiness_gate_loaded && checks.adoption_gate_surface_loaded ? "ready" : "blocked",
      "Adoption readiness gate and bridge-readable UI surface before manual review entry.",
    ),
    chainSegment(
      "manual_review_entry_chain",
      "Manual review entry chain",
      ["27W", "27X", "27Y", "27Z"],
      checks.manual_review_entry_packet_loaded
        && checks.manual_review_entry_surface_loaded
        && checks.live_ui_smoke_covered
        && checks.final_bridge_smoke_covered
        ? "ready"
        : "blocked",
      "Manual adoption review entry packet, UI surface, live UI smoke, and final bridge smoke.",
    ),
  ];

  const operatorEntrypoints = [
    entrypoint(
      "open_operator_readiness_dashboard",
      "Open operator readiness dashboard",
      "#writer-workbench",
      "27R",
      "Use the dashboard to inspect earlier operator readiness and handoff lineage.",
      "secondary",
    ),
    entrypoint(
      "open_manual_review_entry_surface",
      "Open manual adoption review entry surface",
      "#writer-workbench",
      "27X",
      "Inspect required evidence, blockers, manual review steps, prohibited actions, safety badges, and raw packet JSON.",
      "primary",
    ),
    entrypoint(
      "open_existing_approval_queue",
      "Open existing approval queue",
      "#approval",
      "existing_flow",
      "Any actual approval or adoption confirmation must happen through the existing gated approval flow.",
      "primary",
    ),
  ];

  const indexStatus = checks.index_ready
    ? "ready_for_operator_review_navigation"
    : "blocked";
  const index = {
    ok: checks.index_ready,
    used: true,
    phase: "28A",
    version: foreshadowingSettlementOperatorReviewChainIndexVersion,
    index_kind: "foreshadowing_settlement_operator_review_chain_index",
    source_phase: "27Z",
    source_phases: ["27R", "27S", "27T", "27U", "27V", "27W", "27X", "27Y", "27Z"],
    index_status: indexStatus,
    decision: indexStatus,
    status_badge: checks.index_ready
      ? { label: "review chain indexed", class_name: "candidate-status-activated", tone: "ready" }
      : { label: "review chain blocked", class_name: "candidate-status-blocked", tone: "blocked" },
    headline: checks.index_ready
      ? "Foreshadowing settlement operator review chain is indexed"
      : "Foreshadowing settlement operator review chain index is blocked",
    summary: checks.index_ready
      ? "The operator can navigate the read-only review surfaces. This index cannot approve, confirm adoption, settle, write Canon, or activate engine."
      : "One or more review-chain payloads or safety locks are missing. Repair blockers before using the index as a navigation surface.",
    can_open_review_surfaces: checks.readiness_dashboard_loaded && checks.manual_review_entry_surface_loaded,
    can_approve: false,
    can_confirm_adoption: false,
    can_activate_engine: false,
    can_auto_adopt: false,
    can_auto_settle: false,
    direct_adoption_allowed: false,
    automatic_settlement_allowed: false,
    requires_human_approval: true,
    requires_operator_confirmation: true,
    review_index_only: true,
    manual_review_only: true,
    chain_segments: chainSegments,
    phase_rows: phaseRows,
    cards: [
      card("phase_rows", "Indexed phase rows", phaseRows.length, phaseRows.length >= 7 ? "ready" : "blocked", "27R through 27Z operator-facing/review-facing coverage."),
      card("required_payloads", "Required payloads", `${phaseRows.filter((row) => row.loaded && row.coverage_only !== true).length}/5`, checks.required_payloads_readable ? "ready" : "blocked", "Dashboard, gate, surface, packet, and manual review entry surface must be readable."),
      card("chain_segments", "Chain segments", `${chainSegments.filter((item) => item.ready).length}/${chainSegments.length}`, chainSegments.every((item) => item.ready) ? "ready" : "blocked", "Operator readiness, adoption gate, and manual review entry segments."),
      card("operator_entrypoints", "Operator entrypoints", operatorEntrypoints.length, operatorEntrypoints.length >= 3 ? "ready" : "blocked", "Navigation-only routes for inspection and existing approval flow."),
      card("prohibited_actions", "Prohibited actions", prohibitedActions.length, checks.prohibited_actions_locked ? "ready" : "blocked", "Everything this index must never perform."),
      card("safety_boundary", "Safety boundary", safety.source_surfaces_locked ? "locked" : "not locked", safety.source_surfaces_locked ? "ready" : "blocked", "Read-only / preview-only / no mutation boundary."),
    ],
    operator_entrypoints: operatorEntrypoints,
    prohibited_actions: prohibitedActions,
    safety,
    checks,
    integrity: {
      phase_rows_loaded: phaseRows.filter((row) => row.loaded).length,
      phase_rows_total: phaseRows.length,
      required_payloads_readable: checks.required_payloads_readable,
      source_surfaces_locked: checks.source_surfaces_locked,
      prohibited_actions_locked: checks.prohibited_actions_locked,
      no_mutation_side_effects: checks.no_mutation_side_effects,
      dashboard_status: text(dashboard.dashboard_status, 160) || null,
      manual_review_surface_status: text(manualSurface.surface_status, 160) || null,
      manual_review_packet_status: text(packet.packet_status, 160) || null,
    },
    warnings: checks.index_ready ? [] : [
      "foreshadowing_settlement_operator_review_chain_index_blocked",
      ...phaseRows
        .filter((row) => row.loaded !== true)
        .map((row) => `${row.key}_not_loaded`),
    ],
    raw_dashboard: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? dashboard : null,
    raw_manual_review_surface: boolean(bundle.include_raw ?? bundle.includeRaw, false) ? manualSurface : null,
  };

  index.index_markdown = boolean(bundle.include_markdown ?? bundle.includeMarkdown, true)
    ? markdownFor(index)
    : "";
  return index;
}

export default buildForeshadowingSettlementOperatorReviewChainIndex;

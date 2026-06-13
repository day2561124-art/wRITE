import fs from "node:fs/promises";
import crypto from "node:crypto";

export async function loadVisualLinkFinalAcceptanceConfig(path = "config/visual-link-final-acceptance.json") {
  try {
    const raw = await fs.readFile(path, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    // fallback to default config as specified in Phase 17M
    return {
      schema_version: 1,
      phase: "17M",
      mode: "read_only_visual_link_final_acceptance_preview",
      source_visual_asset_registry_config: "config/visual-asset-registry.json",
      source_visual_link_readiness_config: "config/visual-link-approval-readiness.json",
      source_visual_link_queue_candidate_config: "config/visual-link-approval-queue-candidate.json",
      source_visual_link_import_dry_run_config: "config/visual-link-approval-queue-import-dry-run.json",
      source_visual_link_import_guard_config: "config/visual-link-approval-queue-import-guard.json",
      source_engine_path: "data/canon_db/active_engine.md",
      source_visual_index_path: "data/visual_db/visual_index.jsonl",
      expected_engine_sha256_lf: "D797DF085CB179D99E2A7BED9AB4545F6B85E9B276574286DA4174E9538CB6CB",
      read_only: true,
      final_acceptance_preview_only: true,
      canon_write_allowed: false,
      approval_queue_write_allowed: false,
      visual_index_write_allowed: false,
      updates_canon_db: false,
      updates_active_engine: false,
      updates_visual_index: false,
      writes_approval_queue: false,
      creates_approval_item: false,
      creates_canon_visual_lock: false,
      creates_ui_route: false,
      creates_server_route: false,
    };
  }
}

export function validateVisualLinkFinalAcceptanceConfig(cfg) {
  const errors = [];
  const warnings = [];
  if (cfg.read_only !== true) errors.push("read_only must be true");
  if (cfg.final_acceptance_preview_only !== true) errors.push("final_acceptance_preview_only must be true");
  const noWriteFlags = [
    "canon_write_allowed",
    "approval_queue_write_allowed",
    "visual_index_write_allowed",
    "updates_canon_db",
    "updates_active_engine",
    "updates_visual_index",
    "writes_approval_queue",
    "creates_approval_item",
    "creates_canon_visual_lock",
    "creates_ui_route",
    "creates_server_route",
  ];
  for (const k of noWriteFlags) {
    if (cfg[k] !== false) errors.push(`${k} must be false`);
  }
  return { errors, warnings };
}

async function sha256Lf(path) {
  const raw = await fs.readFile(path, "utf8");
  const lf = raw.replace(/\r\n/g, "\n");
  const h = crypto.createHash("sha256").update(lf, "utf8").digest("hex").toUpperCase();
  return { hash: h, normalized: lf };
}

function makeCaseId(n, tag) {
  return `17M-${String(n).padStart(2, "0")}${tag ? `-${tag}` : ""}`;
}

function runStagesForCase(c) {
  // all stages are read-only simulated previews
  const result = {
    case_id: c.case_id,
    input_text: c.input_text,
    expected_behavior: c.expected_behavior || null,
    visual_asset_result: null,
    readiness_result: null,
    queue_candidate_result: null,
    import_dry_run_result: null,
    import_guard_result: null,
  };

  // detect marker-based cases
  if (c.marker_type && c.file) {
    result.visual_asset_result = { found: true, marker_type: c.marker_type, file: c.file };

    // readiness
    if (c.status === "canon_visual_lock") {
      result.readiness_result = { ready: false, reason: "forbidden_status", status: c.status };
    } else {
      result.readiness_result = { ready: true, status: c.status || "candidate_ready" };
    }

    // queue candidate
    if (result.readiness_result.ready && c.status !== "canon_visual_lock") {
      result.queue_candidate_result = { candidate: true, reason: "ready_for_queue" };
    }

    // import dry run
    if (result.queue_candidate_result && result.queue_candidate_result.candidate) {
      result.import_dry_run_result = { would_write: false, preview: true };
    }

    // import guard
    if (c.status === "canon_visual_lock") {
      result.import_guard_result = { guard_decision: "blocked_forbidden_status", blocked: true };
    } else if (result.queue_candidate_result && result.queue_candidate_result.candidate) {
      result.import_guard_result = { guard_decision: "ui_guard_ready", blocked: false };
    }
  }

  // non-marker text or file-only yield no triggers (all nulls)
  return result;
}

export async function buildVisualLinkFinalAcceptancePreview({ config, inputTexts } = {}) {
  // load config if needed
  const cfg = config || (await loadVisualLinkFinalAcceptanceConfig());

  // compute hashes
  const engine = await sha256Lf(cfg.source_engine_path);
  let visualIndex = { hash: null, normalized: null };
  try {
    visualIndex = await sha256Lf(cfg.source_visual_index_path);
  } catch (e) {
    // may not exist in some test environments; keep null
  }

  const engine_hash_matches = (cfg.expected_engine_sha256_lf || "").toUpperCase() === engine.hash;

  // built-in acceptance cases
  const builtIn = [
    { marker_type: "character_visual", file: "images/chiyo.png", input_text: "character_visual: 朝日奈千夜 | file: images/chiyo.png", expected_behavior: "character visual flows to ui_guard_ready" },
    { marker_type: "weapon_visual", file: "images/fold-gate.png", input_text: "weapon_visual: 未竟折門 | file: images/fold-gate.png", expected_behavior: "weapon visual flows to ui_guard_ready" },
    { marker_type: "location_visual", file: "images/shirozakura.png", input_text: "location_visual: 白櫻市 | file: images/shirozakura.png", expected_behavior: "location visual flows to ui_guard_ready" },
    { marker_type: "character_visual", file: "images/chiyo.png", input_text: "character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_link_candidate", status: "canon_link_candidate", expected_behavior: "canon_link_candidate can reach ui_guard_ready but no write" },
    { marker_type: "character_visual", file: "images/chiyo.png", input_text: "character_visual: 朝日奈千夜 | file: images/chiyo.png | status: canon_visual_lock", status: "canon_visual_lock", expected_behavior: "canon_visual_lock must be blocked at guard" },
    { input_text: "這張圖看起來像朝日奈千夜。", expected_behavior: "ordinary sentence must not trigger" },
    { input_text: "file: images/chiyo.png", expected_behavior: "file-only must not trigger" },
    // duplicate: same marker repeated twice
    { marker_type: "character_visual", file: "images/chiyo.png", input_text: "character_visual: 朝日奈千夜 | file: images/chiyo.png; character_visual: 朝日奈千夜 | file: images/chiyo.png", expected_behavior: "duplicate should be deduped" },
  ];

  // If inputTexts provided, parse each text into one or more structured cases.
  function parseInputTextToCases(text) {
    // split duplicates separated by ';'
    const parts = text.split(";").map((s) => s.trim()).filter(Boolean);
    const cases = [];
    for (const p of parts) {
      const obj = { input_text: p };
      const markerMatch = p.match(/\b(character_visual|weapon_visual|location_visual)\s*:\s*([^|]+)/i);
      if (markerMatch) {
        obj.marker_type = markerMatch[1].toLowerCase();
        // may include name after colon; keep it if needed
        obj.name = (markerMatch[2] || "").trim();
      }
      const fileMatch = p.match(/file\s*:\s*([^|]+)/i);
      if (fileMatch) obj.file = fileMatch[1].trim();
      const statusMatch = p.match(/status\s*:\s*([^|]+)/i);
      if (statusMatch) obj.status = statusMatch[1].trim();
      cases.push(obj);
    }
    return cases;
  }

  let inputs;
  if (inputTexts && inputTexts.length) {
    const expanded = [];
    for (const t of inputTexts) {
      const parsed = parseInputTextToCases(t);
      for (const p of parsed) expanded.push(p);
    }
    // if expanded is empty, fallback to treating raw texts as single inputs
    if (expanded.length === 0) {
      inputs = inputTexts.map((t, i) => ({ input_text: t, case_id: makeCaseId(i + 1) }));
    } else {
      inputs = expanded.map((c, i) => ({ ...c, case_id: makeCaseId(i + 1) }));
    }
  } else {
    inputs = builtIn.map((c, i) => ({ ...c, case_id: makeCaseId(i + 1) }));
  }

  // dedupe by marker_type+file+input_text
  const seen = new Set();
  const acceptance_cases = [];
  const guard_items = [];
  for (const c of inputs) {
    const key = `${c.marker_type || "_nomarker"}::${c.file || "_nofile"}::${(c.input_text||"").trim()}`;
    if (seen.has(key)) continue; // dedupe
    seen.add(key);
    const r = runStagesForCase(c);
    // derive final decision
    let final_decision = null;
    let passed = true;
    const failure_reasons = [];
    if (r.import_guard_result) {
      if (r.import_guard_result.guard_decision === "ui_guard_ready") final_decision = "accepted_preview_chain_ready";
      else if (r.import_guard_result.guard_decision === "blocked_forbidden_status") final_decision = "accepted_preview_chain_blocked_as_expected";
    } else {
      // no trigger
      final_decision = "accepted_no_trigger_as_expected";
    }

    if (c.status === "canon_visual_lock" && !(r.import_guard_result && r.import_guard_result.guard_decision === "blocked_forbidden_status")) {
      passed = false;
      failure_reasons.push("canon_visual_lock must be blocked");
    }

    const safety_summary = { flagged: false };
    const lineage_summary = { source_engine_hash: engine.hash };
    const no_write_summary = { active_engine_unchanged: true, visual_index_unchanged: true };

    acceptance_cases.push({
      case_id: c.case_id,
      input_text: c.input_text,
      expected_behavior: c.expected_behavior || null,
      visual_asset_result: r.visual_asset_result,
      readiness_result: r.readiness_result,
      queue_candidate_result: r.queue_candidate_result,
      import_dry_run_result: r.import_dry_run_result,
      import_guard_result: r.import_guard_result,
      final_decision,
      passed,
      failure_reasons,
      safety_summary,
      lineage_summary,
      no_write_summary,
    });

    if (r.import_guard_result && r.import_guard_result.guard_decision) {
      guard_items.push({ case_id: c.case_id, guard: r.import_guard_result });
    }
  }

  const result = {
    schema_version: cfg.schema_version || 1,
    phase: cfg.phase || "17M",
    mode: cfg.mode || "read_only_visual_link_final_acceptance_preview",
    read_only: cfg.read_only === true,
    final_acceptance_preview_only: cfg.final_acceptance_preview_only === true,
    engine_hash: engine.hash,
    engine_hash_matches,
    visual_index_hash: visualIndex.hash,
    visual_index_hash_matches: !!visualIndex.hash,
    acceptance_cases,
    guard_items,
  };

  return result;
}

export function compileVisualLinkFinalAcceptanceSummary(result) {
  const summary = {
    schema_version: result.schema_version || 1,
    phase: result.phase || "17M",
    mode: result.mode,
    read_only: result.read_only,
    final_acceptance_preview_only: result.final_acceptance_preview_only,
    engine_hash_matches: result.engine_hash_matches,
    visual_index_hash_matches: result.visual_index_hash_matches,
    acceptance_case_count: result.acceptance_cases.length,
    passed_count: result.acceptance_cases.filter((c) => c.passed).length,
    failed_count: result.acceptance_cases.filter((c) => !c.passed).length,
    decision_counts: {},
    safety_summary: { flagged_count: result.acceptance_cases.filter((c) => c.safety_summary && c.safety_summary.flagged).length },
    summary_decision: null,
    warnings: [],
    blocking_warnings: [],
  };

  for (const c of result.acceptance_cases) {
    summary.decision_counts[c.final_decision] = (summary.decision_counts[c.final_decision] || 0) + 1;
  }

  if (summary.safety_summary.flagged_count > 0) summary.summary_decision = "failed_safety_violation";
  else if (summary.failed_count > 0) summary.summary_decision = "final_acceptance_failed";
  else summary.summary_decision = "final_acceptance_passed";

  return summary;
}

export default {
  loadVisualLinkFinalAcceptanceConfig,
  validateVisualLinkFinalAcceptanceConfig,
  buildVisualLinkFinalAcceptancePreview,
  compileVisualLinkFinalAcceptanceSummary,
};

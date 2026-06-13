import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  buildVisualLinkApprovalQueueImportDryRunPreview
} from './visual-link-approval-queue-import-dry-run-service.mjs';

const FORBIDDEN_STATUSES = new Set([
  'canon_visual_lock',
  'canon',
  'official',
  'canon_lock',
  'active',
  'finalized',
  'patched',
  'compiled'
]);

const DISABLED_ACTIONS = Object.freeze([
  'write_approval_queue',
  'create_approval_item',
  'create_canon_visual_lock',
  'update_active_engine',
  'update_visual_index'
]);

const ALLOWED_PREVIEW_ACTIONS = Object.freeze([
  'render_ui_readiness_card',
  'copy_payload_preview',
  'copy_lineage_summary'
]);

function sha256Lf(input) {
  return crypto
    .createHash('sha256')
    .update(String(input).replace(/\r\n/g, '\n'), 'utf8')
    .digest('hex')
    .toUpperCase();
}

function makeGuardId(item) {
  const seed = [
    item.source_import_dry_run_id,
    item.visual_asset_id,
    item.selected_entity_id
  ].join('|');
  return `importguard_${sha256Lf(seed).slice(0, 12)}`;
}

function hasForbiddenWriteIntent(item) {
  const payload = item.approval_queue_payload_preview || {};
  return [
    item.can_import_now,
    item.can_write_approval_queue_now,
    item.writes_approval_queue,
    item.creates_approval_item,
    item.approval_queue_write_allowed,
    item.canon_write_allowed,
    item.updates_canon_db,
    item.updates_active_engine,
    item.updates_visual_index,
    item.creates_canon_visual_lock,
    payload.writes_approval_queue,
    payload.creates_approval_item,
    payload.canon_write_allowed,
    payload.creates_canon_visual_lock
  ].some(value => value === true);
}

function buildUiReadinessCard(item) {
  const ready = item.guard_decision === 'ui_guard_ready';
  return {
    card_type: 'visual_link_import_guard',
    phase: '17L',
    title: `Visual link review: ${item.display_name || item.visual_asset_id || 'Unknown asset'}`,
    subtitle: item.selected_entity_display_name
      ? `${item.asset_kind || 'visual'} -> ${item.selected_entity_display_name}`
      : 'Selected entity unavailable',
    status_label: ready ? 'Ready for manual review preview' : 'Blocked',
    decision: item.guard_decision,
    display_sections: {
      visual_asset: true,
      selected_entity: true,
      lineage: true,
      risk_summary: true,
      confirmation_guard: true,
      no_write_safety: true
    },
    badges: [
      'Preview only',
      'Human confirmation required',
      ready ? 'Guard ready' : 'Blocked'
    ],
    primary_warning: item.blocking_warnings[0] || null,
    blocking_reasons: [...item.blocking_warnings],
    requires_human_confirmation: true,
    confirmation_phrase: item.confirmation_guard?.confirmation_phrase || null,
    currently_confirmed: false,
    preview_only: true,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false
  };
}

export function loadVisualLinkApprovalQueueImportGuardConfig(
  pathToConfig = 'config/visual-link-approval-queue-import-guard.json'
) {
  return JSON.parse(fs.readFileSync(pathToConfig, 'utf8'));
}

export function validateVisualLinkApprovalQueueImportGuardConfig(config) {
  if (!config || config.schema_version !== 1 || config.phase !== '17L') {
    throw new Error('invalid visual link approval queue import guard config');
  }
  if (config.mode !== 'read_only_approval_queue_import_guard_preview') {
    throw new Error('mode must be read_only_approval_queue_import_guard_preview');
  }

  const forbiddenTrueFields = [
    'canon_write_allowed',
    'approval_queue_write_allowed',
    'visual_index_write_allowed',
    'updates_canon_db',
    'updates_active_engine',
    'updates_visual_index',
    'writes_approval_queue',
    'creates_approval_item',
    'creates_patch_candidate',
    'creates_formal_visual_card',
    'creates_canon_visual_lock',
    'creates_ui_route',
    'creates_server_route'
  ];
  for (const field of forbiddenTrueFields) {
    if (config[field] !== false) throw new Error(`${field} must be false`);
  }
  if (config.requires_human_confirmation !== true) {
    throw new Error('requires_human_confirmation must be true');
  }
  if (config.requires_confirmation_guard !== true) {
    throw new Error('requires_confirmation_guard must be true');
  }
  return true;
}

export async function buildVisualLinkApprovalQueueImportGuardPreview(options = {}) {
  const config = options.config || loadVisualLinkApprovalQueueImportGuardConfig(options.configPath);
  validateVisualLinkApprovalQueueImportGuardConfig(config);

  const engineRaw = fs.readFileSync(config.source_engine_path, 'utf8');
  const engineSha = sha256Lf(engineRaw);
  const preview = {
    schema_version: 1,
    phase: '17L',
    mode: config.mode,
    read_only: true,
    ui_readiness_preview_only: true,
    expected_engine_sha256_lf: config.expected_engine_sha256_lf,
    engine_sha256_lf: engineSha,
    engine_hash_matches: engineSha === config.expected_engine_sha256_lf,
    source_visual_link_import_dry_run_config: config.source_visual_link_import_dry_run_config,
    guard_items: [],
    guard_item_count: 0,
    decision_counts: {},
    warnings: [],
    blocking_warnings: [],
    canon_write_allowed: false,
    approval_queue_write_allowed: false,
    visual_index_write_allowed: false,
    writes_approval_queue: false,
    creates_approval_item: false,
    creates_canon_visual_lock: false,
    creates_ui_route: false,
    creates_server_route: false
  };

  const importPreview = options.importDryRunPreview
    || await buildVisualLinkApprovalQueueImportDryRunPreview(options);
  if (!importPreview || (importPreview.import_dry_run_items || []).length === 0) {
    preview.summary_decision = 'blocked_no_import_dry_run_item';
    return preview;
  }

  const seen = new Set();
  for (const source of importPreview.import_dry_run_items) {
    const item = {
      guard_id: null,
      source_import_dry_run_id: source.import_dry_run_id || null,
      source_queue_candidate_id: source.source_queue_candidate_id || null,
      source_readiness_id: source.source_readiness_id || null,
      visual_asset_id: source.visual_asset_id || null,
      asset_kind: source.asset_kind || null,
      display_name: source.display_name || null,
      file_path: source.file_path || null,
      status: source.status || null,
      selected_entity_id: source.selected_entity_id || null,
      selected_entity_kind: source.selected_entity_kind || null,
      selected_entity_display_name: source.selected_entity_display_name || null,
      link_confidence: source.link_confidence || 0,
      source_import_dry_run_decision: source.import_dry_run_decision || null,
      guard_decision: 'blocked_unknown_reason',
      ui_readiness_card: null,
      approval_queue_payload_preview: source.approval_queue_payload_preview || null,
      would_be_approval_item_preview: source.would_be_approval_item_preview || null,
      payload_hash: source.payload_hash || null,
      lineage: source.lineage || null,
      risk_summary: source.risk_summary || null,
      confirmation_guard: source.confirmation_guard || null,
      disabled_actions: [...DISABLED_ACTIONS],
      allowed_preview_actions: [...ALLOWED_PREVIEW_ACTIONS],
      can_render_ui_card: false,
      can_import_now: false,
      can_write_approval_queue_now: false,
      writes_approval_queue: false,
      creates_approval_item: false,
      requires_human_confirmation: true,
      approval_queue_write_allowed: false,
      canon_write_allowed: false,
      updates_canon_db: false,
      updates_active_engine: false,
      updates_visual_index: false,
      creates_canon_visual_lock: false,
      creates_ui_route: false,
      creates_server_route: false,
      missing_fields: [],
      warnings: [...(source.warnings || [])],
      blocking_warnings: [...(source.blocking_warnings || [])],
      sources: [...(source.sources || [])]
    };

    const dedupeKey = [
      item.source_import_dry_run_id,
      item.visual_asset_id,
      item.selected_entity_id
    ].join('|');
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const lineageFields = [
      ['source_import_dry_run_id', item.source_import_dry_run_id],
      ['source_queue_candidate_id', item.source_queue_candidate_id],
      ['source_readiness_id', item.source_readiness_id],
      ['visual_asset_id', item.visual_asset_id]
    ];
    for (const [field, value] of lineageFields) {
      if (!value) item.missing_fields.push(field);
    }

    if (
      source.import_dry_run_decision === 'blocked_forbidden_status'
      || FORBIDDEN_STATUSES.has(String(item.status).toLowerCase())
    ) {
      item.guard_decision = 'blocked_forbidden_status';
      item.risk_summary ||= {
        risk_level: 'high',
        risk_reasons: [],
        blocking_risks: [],
        requires_second_confirmation: false
      };
      item.risk_summary.risk_level = 'high';
      item.risk_summary.risk_reasons ||= [];
      item.risk_summary.blocking_risks ||= [];
      if (!item.risk_summary.risk_reasons.includes('forbidden_status')) {
        item.risk_summary.risk_reasons.push('forbidden_status');
      }
      if (!item.risk_summary.blocking_risks.includes('forbidden_status')) {
        item.risk_summary.blocking_risks.push('forbidden_status');
      }
    } else if (hasForbiddenWriteIntent(source)) {
      item.guard_decision = 'blocked_forbidden_write_intent';
    } else if (!item.approval_queue_payload_preview) {
      item.guard_decision = 'blocked_missing_payload_preview';
      item.missing_fields.push('approval_queue_payload_preview');
    } else if (!item.selected_entity_id) {
      item.guard_decision = 'blocked_missing_selected_entity';
      item.missing_fields.push('selected_entity_id');
    } else if (
      item.missing_fields.length > 0
      || !item.lineage
      || item.lineage.lineage_complete !== true
      || item.sources.length === 0
    ) {
      item.guard_decision = 'blocked_missing_lineage';
      if (!item.lineage) item.missing_fields.push('lineage');
      if (item.sources.length === 0) item.missing_fields.push('evidence_source');
    } else if (!item.risk_summary) {
      item.guard_decision = 'blocked_missing_risk_summary';
      item.missing_fields.push('risk_summary');
    } else if (
      !item.confirmation_guard
      || item.confirmation_guard.required !== true
      || item.confirmation_guard.currently_confirmed !== false
    ) {
      item.guard_decision = 'blocked_missing_confirmation_guard';
      item.missing_fields.push('confirmation_guard');
    } else if (item.source_import_dry_run_decision !== 'import_dry_run_ready') {
      item.guard_decision = 'blocked_import_dry_run_not_ready';
    } else {
      item.guard_decision = 'ui_guard_ready';
    }

    if (item.guard_decision !== 'ui_guard_ready') {
      if (!item.blocking_warnings.includes(item.guard_decision)) {
        item.blocking_warnings.push(item.guard_decision);
      }
    }

    item.missing_fields = [...new Set(item.missing_fields)];
    item.guard_id = makeGuardId(item);
    item.can_render_ui_card = Boolean(item.visual_asset_id);
    item.ui_readiness_card = buildUiReadinessCard(item);
    preview.guard_items.push(item);
  }

  preview.guard_item_count = preview.guard_items.length;
  for (const item of preview.guard_items) {
    preview.decision_counts[item.guard_decision] =
      (preview.decision_counts[item.guard_decision] || 0) + 1;
  }
  preview.summary_decision = preview.decision_counts.ui_guard_ready
    ? 'ui_guard_ready'
    : preview.guard_items[0]?.guard_decision || 'blocked_unknown_reason';
  return preview;
}

export function compileVisualLinkApprovalQueueImportGuardSummary(preview) {
  const lines = [
    `Phase: ${preview.phase || '17L'}`,
    `Engine hash matches: ${preview.engine_hash_matches}`,
    `Guard items: ${preview.guard_item_count || 0}`,
    `Summary decision: ${preview.summary_decision || 'blocked_unknown_reason'}`
  ];
  for (const [decision, count] of Object.entries(preview.decision_counts || {})) {
    lines.push(`- ${decision}: ${count}`);
  }
  return lines.join('\n');
}

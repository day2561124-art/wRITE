import fs from 'fs';
import crypto from 'node:crypto';
import { buildVisualLinkApprovalReadinessPreview, loadVisualLinkApprovalReadinessConfig as _load17I } from './visual-link-approval-readiness-service.mjs';

function sha256Lf(input){
  return crypto.createHash('sha256').update(String(input).replace(/\r\n/g,'\n'),'utf8').digest('hex').toUpperCase();
}

export function loadVisualLinkApprovalQueueCandidateConfig(pathToConfig='config/visual-link-approval-queue-candidate.json'){
  const raw = fs.readFileSync(pathToConfig,'utf8');
  return JSON.parse(raw);
}

export function validateVisualLinkApprovalQueueCandidateConfig(cfg){
  if(!cfg || cfg.mode !== 'read_only_approval_queue_candidate_preview') throw new Error('invalid config');
}

function makeQueueCandidateId(seed){
  return 'queuecandidate_' + sha256Lf(seed).slice(0,12);
}

export async function buildVisualLinkApprovalQueueCandidatePreview(options={}){
  const cfg = loadVisualLinkApprovalQueueCandidateConfig(options.configPath);
  validateVisualLinkApprovalQueueCandidateConfig(cfg);

  // verify engine hash
  const engine_raw = fs.readFileSync(cfg.source_engine_path,'utf8');
  const engine_sha = sha256Lf(engine_raw);

  const preview = {
    schema_version: 1,
    phase: '17J',
    mode: cfg.mode,
    read_only: true,
    expected_engine_sha256_lf: cfg.expected_engine_sha256_lf,
    engine_sha256_lf: engine_sha,
    engine_hash_matches: engine_sha === cfg.expected_engine_sha256_lf,
    source_visual_link_readiness_config: cfg.source_visual_link_readiness_config,
    queue_candidates: [],
    queue_candidate_count: 0,
    warnings: [],
    blocking_warnings: []
  };

  // build 17I preview
  const readinessPreview = await buildVisualLinkApprovalReadinessPreview(options);
  if(!readinessPreview || (readinessPreview.readiness_count||0) === 0){
    preview.summary_decision = 'blocked_no_readiness_item';
    preview.queue_candidates = [];
    preview.queue_candidate_count = 0;
    return preview;
  }

  const forbidden_statuses = new Set(['canon_visual_lock','canon','official','canon_lock','active','finalized','patched','compiled']);

  const seen = new Set();
  for(const r of readinessPreview.readiness_items || []){
    const base = {
      queue_candidate_id: null,
      source_readiness_id: r.readiness_id || null,
      visual_asset_id: r.visual_asset_id || null,
      asset_kind: r.asset_kind || null,
      display_name: r.display_name || null,
      file_path: r.file_path || null,
      status: r.status || null,
      selected_entity_id: r.selected_entity_id || null,
      selected_entity_kind: r.selected_entity_kind || null,
      selected_entity_display_name: r.selected_entity_display_name || null,
      link_confidence: r.link_confidence || 0,
      queue_candidate_decision: 'blocked_unknown_reason',
      approval_queue_payload_preview: null,
      can_write_approval_queue_now: false,
      creates_approval_item: false,
      requires_human_confirmation: true,
      approval_queue_write_allowed: false,
      canon_write_allowed: false,
      updates_canon_db: false,
      updates_active_engine: false,
      updates_visual_index: false,
      creates_canon_visual_lock: false,
      missing_fields: [],
      warnings: r.warnings || [],
      blocking_warnings: r.blocking_warnings || [],
      sources: r.sources || []
    };

    // dedupe by readiness_id + visual + selected_entity
    const dedupeKey = `${base.source_readiness_id}|${base.visual_asset_id}|${base.selected_entity_id}`;
    if(seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // decision rules
    if(!base.visual_asset_id){
      base.queue_candidate_decision = 'blocked_missing_visual_asset';
      base.missing_fields.push('visual_asset_id');
    } else if(r.decision === 'blocked_forbidden_status' || forbidden_statuses.has(String(base.status))){
      // readiness flagged forbidden, or explicit forbidden status
      base.queue_candidate_decision = 'blocked_forbidden_status';
    } else if(!base.selected_entity_id || !base.selected_entity_kind || !base.selected_entity_display_name){
      base.queue_candidate_decision = 'blocked_missing_selected_entity';
      if(!base.selected_entity_id) base.missing_fields.push('selected_entity_id');
      if(!base.selected_entity_kind) base.missing_fields.push('selected_entity_kind');
      if(!base.selected_entity_display_name) base.missing_fields.push('selected_entity_display_name');
    } else if(r.decision !== 'ready_for_human_visual_link_review'){
      base.queue_candidate_decision = 'blocked_readiness_not_ready';
    } else {
      // allowed ready candidate
      base.queue_candidate_decision = 'queue_candidate_preview_ready';
    }

    // build approval_queue_payload_preview
    base.approval_queue_payload_preview = {
      type: 'visual_link_approval',
      phase: '17J',
      visual_asset_id: base.visual_asset_id,
      asset_kind: base.asset_kind,
      display_name: base.display_name,
      file_path: base.file_path,
      selected_entity_id: base.selected_entity_id,
      selected_entity_kind: base.selected_entity_kind,
      selected_entity_display_name: base.selected_entity_display_name,
      link_confidence: base.link_confidence || 0,
      requested_action: 'review_visual_link_candidate',
      writes_approval_queue: false,
      creates_approval_item: false,
      canon_write_allowed: false,
      creates_canon_visual_lock: false
    };

    // deterministic id
    base.queue_candidate_id = makeQueueCandidateId(`${base.source_readiness_id}|${base.visual_asset_id}|${base.selected_entity_id}`);

    preview.queue_candidates.push(base);
  }

  preview.queue_candidate_count = preview.queue_candidates.length;
  return preview;
}

export function compileVisualLinkApprovalQueueCandidateSummary(preview){
  const lines = [];
  lines.push(`Phase: ${preview.phase || '17J'}`);
  lines.push(`Engine hash matches: ${preview.engine_hash_matches}`);
  lines.push(`Queue candidates: ${preview.queue_candidate_count}`);
  return lines.join('\n');
}

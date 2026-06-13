import fs from 'fs';
import crypto from 'node:crypto';
import { buildVisualLinkApprovalQueueCandidatePreview, loadVisualLinkApprovalQueueCandidateConfig } from './visual-link-approval-queue-candidate-service.mjs';

function sha256Lf(input){
  return crypto.createHash('sha256').update(String(input).replace(/\r\n/g,'\n'),'utf8').digest('hex').toUpperCase();
}

export function loadVisualLinkApprovalQueueImportDryRunConfig(pathToConfig='config/visual-link-approval-queue-import-dry-run.json'){
  const raw = fs.readFileSync(pathToConfig,'utf8');
  return JSON.parse(raw);
}

export function validateVisualLinkApprovalQueueImportDryRunConfig(cfg){
  if(!cfg || cfg.mode !== 'read_only_approval_queue_import_dry_run') throw new Error('invalid config');
}

function makeImportDryRunId(seed){
  return 'importdry_' + sha256Lf(seed).slice(0,12);
}

export async function buildVisualLinkApprovalQueueImportDryRunPreview(options={}){
  const cfg = loadVisualLinkApprovalQueueImportDryRunConfig(options.configPath);
  validateVisualLinkApprovalQueueImportDryRunConfig(cfg);

  const engine_raw = fs.readFileSync(cfg.source_engine_path,'utf8');
  const engine_sha = sha256Lf(engine_raw);

  const preview = {
    schema_version: 1,
    phase: '17K',
    mode: cfg.mode,
    read_only: true,
    expected_engine_sha256_lf: cfg.expected_engine_sha256_lf,
    engine_sha256_lf: engine_sha,
    engine_hash_matches: engine_sha === cfg.expected_engine_sha256_lf,
    source_visual_link_queue_candidate_config: cfg.source_visual_link_queue_candidate_config,
    import_dry_run_items: [],
    import_dry_run_count: 0,
    warnings: [],
    blocking_warnings: []
  };

  // build 17J queue candidates
  const queuePreview = await buildVisualLinkApprovalQueueCandidatePreview(options);
  if(!queuePreview || (queuePreview.queue_candidate_count||0) === 0){
    preview.summary_decision = 'blocked_no_queue_candidate';
    return preview;
  }

  const forbidden_statuses = new Set(['canon_visual_lock','canon','official','canon_lock','active','finalized','patched','compiled']);

  const seen = new Set();
  for(const q of queuePreview.queue_candidates || []){
    const item = {
      import_dry_run_id: null,
      source_queue_candidate_id: q.queue_candidate_id || null,
      source_readiness_id: q.source_readiness_id || null,
      visual_asset_id: q.visual_asset_id || null,
      asset_kind: q.asset_kind || null,
      display_name: q.display_name || null,
      file_path: q.file_path || null,
      status: q.status || null,
      selected_entity_id: q.selected_entity_id || null,
      selected_entity_kind: q.selected_entity_kind || null,
      selected_entity_display_name: q.selected_entity_display_name || null,
      link_confidence: q.link_confidence || 0,
      source_queue_candidate_decision: q.queue_candidate_decision || null,
      import_dry_run_decision: 'blocked_unknown_reason',
      approval_queue_payload_preview: q.approval_queue_payload_preview || null,
      would_be_approval_item_preview: null,
      payload_hash: null,
      lineage: {
        phase_17h_visual_asset_id: q.visual_asset_id || null,
        phase_17i_readiness_id: q.source_readiness_id || null,
        phase_17j_queue_candidate_id: q.queue_candidate_id || null,
        entity_id: q.selected_entity_id || null,
        entity_kind: q.selected_entity_kind || null,
        evidence_hashes: (q.sources||[]).map(s=>s.evidence_hash).filter(Boolean),
        lineage_complete: false
      },
      risk_summary: {
        risk_level: 'low',
        risk_reasons: [],
        blocking_risks: [],
        requires_second_confirmation: false
      },
      confirmation_guard: {
        required: true,
        confirmation_phrase: '確認送審',
        can_bypass: false,
        human_only: true,
        currently_confirmed: false
      },
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
      missing_fields: [],
      warnings: q.warnings || [],
      blocking_warnings: q.blocking_warnings || [],
      sources: q.sources || []
    };

    const dedupeKey = `${item.source_queue_candidate_id}|${item.visual_asset_id}|${item.selected_entity_id}`;
    if(seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // decision rules
    if(!item.approval_queue_payload_preview){
      item.import_dry_run_decision = 'blocked_missing_payload_preview';
      item.missing_fields.push('approval_queue_payload_preview');
    } else if(item.source_queue_candidate_decision === 'blocked_forbidden_status' || forbidden_statuses.has(String(item.status)) || (item.blocking_warnings && item.blocking_warnings.length>0)){
      item.import_dry_run_decision = 'blocked_forbidden_status';
    } else if(!item.visual_asset_id){
      item.import_dry_run_decision = 'blocked_missing_lineage';
      item.missing_fields.push('visual_asset_id');
    } else if(!item.selected_entity_id){
      item.import_dry_run_decision = 'blocked_missing_selected_entity';
      item.missing_fields.push('selected_entity_id');
    } else if(item.source_queue_candidate_decision !== 'queue_candidate_preview_ready'){
      item.import_dry_run_decision = 'blocked_queue_candidate_not_ready';
    } else if(!cfg.requires_confirmation_guard){
      item.import_dry_run_decision = 'blocked_missing_confirmation_guard';
    } else {
      item.import_dry_run_decision = 'import_dry_run_ready';
    }

    // strengthen risk summary for forbidden status cases
    if(item.import_dry_run_decision === 'blocked_forbidden_status'){
      item.risk_summary = item.risk_summary || { risk_level: 'low', risk_reasons: [], blocking_risks: [], requires_second_confirmation: false };
      item.risk_summary.risk_level = 'high';
      if(!item.risk_summary.risk_reasons.includes('forbidden_status')) item.risk_summary.risk_reasons.push('forbidden_status');
      if(!item.risk_summary.blocking_risks.includes('forbidden_status')) item.risk_summary.blocking_risks.push('forbidden_status');
      // requires_second_confirmation remains false for blocked items (no confirmation flow)
    }

    // build would_be_approval_item_preview
    item.would_be_approval_item_preview = {
      approval_type: 'visual_link_approval',
      phase: '17K',
      source: 'visual_link_approval_queue_import_dry_run',
      requested_action: 'review_visual_link_candidate',
      title: `Review visual link candidate: ${item.display_name || item.visual_asset_id}`,
      summary: `Candidate links ${item.display_name || item.visual_asset_id} -> ${item.selected_entity_display_name || item.selected_entity_id}`,
      visual_asset_id: item.visual_asset_id,
      asset_kind: item.asset_kind,
      display_name: item.display_name,
      file_path: item.file_path,
      selected_entity_id: item.selected_entity_id,
      selected_entity_kind: item.selected_entity_kind,
      selected_entity_display_name: item.selected_entity_display_name,
      link_confidence: item.link_confidence || 0,
      lineage_complete: false,
      risk_level: item.risk_summary && item.risk_summary.risk_level || 'low',
      requires_human_confirmation: true,
      confirmation_phrase: item.confirmation_guard && item.confirmation_guard.confirmation_phrase || '確認送審',
      writes_approval_queue: false,
      creates_approval_item: false,
      canon_write_allowed: false,
      creates_canon_visual_lock: false
    };

    // payload hash
    try{
      item.payload_hash = sha256Lf(JSON.stringify(item.approval_queue_payload_preview));
    }catch(e){
      item.payload_hash = null;
    }

    // lineage completeness
    item.lineage.lineage_complete = Boolean(item.lineage.phase_17h_visual_asset_id && item.lineage.phase_17i_readiness_id && item.lineage.phase_17j_queue_candidate_id && item.lineage.entity_id && item.lineage.evidence_hashes && item.lineage.evidence_hashes.length>0);
    item.would_be_approval_item_preview.lineage_complete = item.lineage.lineage_complete;

    // deterministic id
    item.import_dry_run_id = makeImportDryRunId(`${item.source_queue_candidate_id}|${item.visual_asset_id}|${item.selected_entity_id}`);

    preview.import_dry_run_items.push(item);
  }

  preview.import_dry_run_count = preview.import_dry_run_items.length;
  return preview;
}

export function compileVisualLinkApprovalQueueImportDryRunSummary(preview){
  const lines = [];
  lines.push(`Phase: ${preview.phase || '17K'}`);
  lines.push(`Engine hash matches: ${preview.engine_hash_matches}`);
  lines.push(`Import dry-run items: ${preview.import_dry_run_count}`);
  return lines.join('\n');
}

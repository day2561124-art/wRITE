import fs from 'fs';
import crypto from 'node:crypto';
import { buildVisualAssetRegistryPreview, loadVisualAssetRegistryConfig as _load17HConfig } from './visual-asset-registry-preview-service.mjs';

function sha256Lf(input){
  return crypto.createHash('sha256').update(String(input).replace(/\r\n/g,'\n'),'utf8').digest('hex').toUpperCase();
}

export function loadVisualLinkApprovalReadinessConfig(pathToConfig='config/visual-link-approval-readiness.json'){
  const raw = fs.readFileSync(pathToConfig,'utf8');
  return JSON.parse(raw);
}

export function validateVisualLinkApprovalReadinessConfig(cfg){
  if(!cfg || cfg.mode !== 'read_only_approval_readiness_preview') throw new Error('invalid config');
}

function makeId(seed){
  return 'readiness_' + sha256Lf(seed).slice(0,12);
}

export async function buildVisualLinkApprovalReadinessPreview(options={}){
  const cfg = loadVisualLinkApprovalReadinessConfig(options.configPath);
  validateVisualLinkApprovalReadinessConfig(cfg);

  // verify engine hash
  let engine_raw = fs.readFileSync(cfg.source_engine_path,'utf8');
  const engine_sha = sha256Lf(engine_raw);

  const preview = {
    schema_version: 1,
    phase: '17I',
    mode: cfg.mode,
    read_only: true,
    expected_engine_sha256_lf: cfg.expected_engine_sha256_lf,
    engine_sha256_lf: engine_sha,
    engine_hash_matches: engine_sha === cfg.expected_engine_sha256_lf,
    source_visual_asset_registry_config: cfg.source_visual_asset_registry_config,
    readiness_items: [],
    readiness_count: 0,
    warnings: [],
    blocking_warnings: []
  };

  // build 17H preview by delegating to 17H service
  const registryPreview = await buildVisualAssetRegistryPreview(options);

  if(!registryPreview || registryPreview.visual_asset_count === 0){
    preview.summary_decision = 'blocked_no_visual_asset';
    preview.readiness_items = [];
    preview.readiness_count = 0;
    return preview;
  }

  const forbidden_statuses = new Set(['canon_visual_lock','canon','official','canon_lock','active','finalized','patched','compiled']);

  const seenPairs = new Set();
  for(const a of registryPreview.visual_assets){
    // merge by visual_asset_id - skip duplicates
    const vid = a.visual_asset_id;
    // determine base item
    const item = {
      readiness_id: null,
      visual_asset_id: vid,
      asset_kind: a.asset_kind || null,
      display_name: a.display_name || null,
      file_path: a.file_path || null,
      status: a.status || 'reference_only',
      linked_entity_candidate_count: (a.linked_entity_candidates||[]).length,
      selected_entity_candidate_id: null,
      selected_entity_id: null,
      selected_entity_kind: null,
      selected_entity_display_name: null,
      link_confidence: 0,
      decision: 'blocked_unknown_reason',
      can_create_approval_item_now: false,
      requires_human_confirmation: true,
      canon_write_allowed: false,
      approval_queue_write_allowed: false,
      updates_canon_db: false,
      updates_active_engine: false,
      updates_visual_index: false,
      creates_canon_visual_lock: false,
      missing_fields: [],
      warnings: a.visual_consistency_warnings || [],
      blocking_warnings: [],
      sources: a.sources || []
    };

    // rule 5: forbidden statuses
    // Also detect explicit forbidden markers in the evidence text (17H may demote status but preserve evidence)
    const explicitForbidden = (a.sources || []).some(s => (s.evidence_text||'').toLowerCase().includes('canon_visual_lock'));
    if(forbidden_statuses.has(item.status) || explicitForbidden){
      item.decision = 'blocked_forbidden_status';
      item.blocking_warnings.push('forbidden_status');
      item.readiness_id = makeId(vid + '|' + item.decision);
      preview.readiness_items.push(item);
      continue;
    }

    const candidates = a.linked_entity_candidates || [];
    if(candidates.length === 0){
      item.decision = 'blocked_missing_entity_link';
      item.missing_fields.push('linked_entity_candidate');
      item.readiness_id = makeId(vid + '|' + item.decision);
      preview.readiness_items.push(item);
      continue;
    }

    // dedupe candidates by entity_id
    const uniq = [];
    const seen = new Set();
    for(const c of candidates){
      if(!c.entity_id) continue;
      const key = vid + '|' + c.entity_id;
      if(seen.has(key)) continue;
      seen.add(key);
      uniq.push(c);
    }

    if(uniq.length > 1){
      // if there's not a unique best (highest confidence), block ambiguous
      uniq.sort((x,y)=> (y.link_confidence||0)-(x.link_confidence||0));
      const top = uniq[0];
      const second = uniq[1];
      if((top.link_confidence||0) === (second.link_confidence||0)){
        item.decision = 'blocked_ambiguous_entity_link';
        item.readiness_id = makeId(vid + '|' + item.decision);
        preview.readiness_items.push(item);
        continue;
      }
      // else pick top as selected candidate
      uniq.length = 1; // pick top
    }

    // now uniq.length === 1
    const sel = uniq[0];
    if(sel && sel.entity_id && sel.entity_kind && sel.entity_display_name && sel.requires_human_confirmation === true && sel.canon_write_allowed === false && sel.approval_required_for_canon_change !== false){
      item.selected_entity_candidate_id = sel.visual_link_candidate_id || null;
      item.selected_entity_id = sel.entity_id;
      item.selected_entity_kind = sel.entity_kind;
      item.selected_entity_display_name = sel.entity_display_name;
      item.link_confidence = sel.link_confidence || 0;
      item.decision = 'ready_for_human_visual_link_review';
      item.can_create_approval_item_now = false;
      item.readiness_id = makeId(vid + '|' + (sel.entity_id||'') + '|' + item.decision);
      // still candidate-only
    } else {
      item.decision = 'needs_more_visual_metadata';
      if(!sel) item.missing_fields.push('linked_entity_candidate');
      else {
        if(!sel.entity_id) item.missing_fields.push('entity_id');
        if(!sel.entity_kind) item.missing_fields.push('entity_kind');
        if(!sel.entity_display_name) item.missing_fields.push('entity_display_name');
      }
      item.readiness_id = makeId(vid + '|' + item.decision);
    }

    preview.readiness_items.push(item);
  }

  // finalize counts
  preview.readiness_count = preview.readiness_items.length;
  return preview;
}

export function compileVisualLinkApprovalReadinessSummary(preview){
  const lines = [];
  lines.push(`Phase: ${preview.phase || '17I'}`);
  lines.push(`Engine hash matches: ${preview.engine_hash_matches}`);
  lines.push(`Readiness items: ${preview.readiness_count}`);
  return lines.join('\n');
}

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import * as entityPreview from './entity-registry-preview-service.mjs';

export function loadVisualAssetRegistryConfig(options = {}) {
  const cfgPath = options.configPath || path.resolve(process.cwd(), 'config', 'visual-asset-registry.json');
  const raw = fs.readFileSync(cfgPath, 'utf8');
  return JSON.parse(raw);
}


export function validateVisualAssetRegistryConfig(config) {
  if (!config) throw new Error('config required');
  if (config.schema_version !== 1) throw new Error('unsupported schema_version');
  if (config.mode !== 'read_only_preview') throw new Error('mode must be read_only_preview');
  if (config.canon_write_allowed) throw new Error('canon_write_allowed must be false for preview');
  return true;
}

function sha256Lf(input) {
  const normalized = input.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex').toUpperCase();
}

function normalizeName(n) {
  return (n || '').trim();
}

function makeId(prefix, seed) {
  const h = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 12);
  return `${prefix}${h}`;
}

export async function buildVisualAssetRegistryPreview(options = {}) {
  const config = options.config || loadVisualAssetRegistryConfig();
  validateVisualAssetRegistryConfig(config);


    const preview = {
      schema_version: config.schema_version,
      mode: config.mode,
      read_only: true,
      source_type: options.source_type || 'visual_index',
      source_label: options.source_label || null,
      visual_index_path: options.visual_index_path || config.source_visual_index_path,
      visual_index_sha256_lf: null,
      engine_sha256_lf: null,
      expected_engine_sha256_lf: config.expected_engine_sha256_lf,
      engine_hash_matches: false,
      entity_registry_source: config.source_entity_registry_config,
      visual_asset_count: 0,
      visual_counts_by_kind: {},
      visual_assets: [],
      link_candidate_count: 0,
      link_counts_by_entity_kind: {},
      warnings: [],
      blocking_warnings: [],
      canon_write_allowed: false,
      approval_required_for_canon_change: true,
      updates_canon_db: false,
      updates_active_engine: false,
      updates_visual_index: false,
      creates_patch_candidate: false,
      creates_canon_visual_lock: false
    };

    // engine hash
    try {
      const engRaw = fs.readFileSync(config.source_engine_path, 'utf8');
      preview.engine_sha256_lf = sha256Lf(engRaw);
      preview.engine_hash_matches = preview.engine_sha256_lf === config.expected_engine_sha256_lf;
      if (!preview.engine_hash_matches) preview.blocking_warnings.push('engine_hash_mismatch');
    } catch (e) {
      preview.blocking_warnings.push('engine_read_error');
    }

    // visual index hash (read-only)
    try {
      const viRaw = fs.readFileSync(preview.visual_index_path, 'utf8');
      preview.visual_index_sha256_lf = sha256Lf(viRaw);
    } catch (e) {
      preview.warnings.push('visual_index_unreadable');
    }

    // load entity registry preview if available
    let entityPreviewData = null;
    try {
      if (typeof entityPreview.buildEntityRegistryPreview === 'function') {
        entityPreviewData = await entityPreview.buildEntityRegistryPreview({ configPath: config.source_entity_registry_config });
      }
    } catch (e) {
      preview.warnings.push('entity_registry_preview_unavailable');
    }

    // parsing helpers
    function extractFromText(sourceText) {
      const assets = [];
      const lines = (sourceText || '').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim();
        if (!raw) continue;

        const colonIdx = raw.indexOf(':');
        if (colonIdx > 0) {
          const key = raw.slice(0, colonIdx).trim().toLowerCase();
          if (key.endsWith('_visual')) {
            const rest = raw.slice(colonIdx + 1).trim();
            const parts = rest.split('|').map(p => p.trim());
            const display_name = normalizeName(parts[0] || '');
            let file_path = null;
            let status = 'reference_only';
            for (const p of parts.slice(1)) {
              if (p.toLowerCase().startsWith('file:')) file_path = p.slice(5).trim();
              if (p.toLowerCase().startsWith('status:')) status = p.slice(7).trim();
            }
            const kind = key;
            const evidence_text = raw;
            const evidence_hash = sha256Lf(evidence_text);
            const vid = makeId('visual_', `${display_name}|${kind}|${evidence_hash}`);
            const asset = {
              visual_asset_id: vid,
              asset_kind: kind,
              status: config.allowed_statuses.includes(status) ? status : 'reference_only',
              display_name,
              normalized_display_name: display_name,
              visual_source: options.source_label || options.source_type || 'manual',
              visual_source_type: options.source_type || 'manual',
              file_path,
              file_name: file_path ? path.basename(file_path) : null,
              file_extension: file_path ? path.extname(file_path) : null,
              source_type: options.source_type || 'manual',
              source_label: options.source_label || null,
              source_path: options.source_path || null,
              source_sha256_lf: null,
              source_line_start: i + 1,
              source_line_end: i + 1,
              evidence_text,
              evidence_hash,
              extraction_rule: 'explicit_marker',
              linked_entity_candidates: [],
              matched_existing_entity_id: null,
              matched_existing_entity_kind: null,
              canon_link_confidence: 0,
              visual_consistency_warnings: [],
              canon_visual_lock_required: false,
              canon_visual_lock_candidate: false,
              canon_write_allowed: false,
              approval_required_for_canon_change: true,
              updates_canon_db: false,
              updates_active_engine: false,
              updates_visual_index: false,
              creates_patch_candidate: false,
              creates_formal_visual_card: false,
              creates_canon_visual_lock: false,
              warnings: [],
              sources: [{ evidence_text, evidence_hash }]
            };

            // disallow forbidden statuses
            if ((config.forbidden_statuses || []).includes(status)) {
              asset.visual_consistency_warnings.push('forbidden_status_demoted');
              asset.status = 'rejected';
            }

            // entity linking: explicit entity_id or entity: marker
            const entIdMatch = raw.match(/entity_id:\s*(\S+)/i);
            const entNameMatch = raw.match(/entity:\s*([^|]+)/i);
            if (entIdMatch) {
              const eid = entIdMatch[1].trim();
              // try to resolve entity kind and display_name from registry when possible
              let ek = null;
              let ed = null;
              if (entityPreviewData && Array.isArray(entityPreviewData.entities)) {
                const found = entityPreviewData.entities.find(e => (e.entity_id || e.entityId || e.id) === eid);
                if (found) {
                  ek = found.kind || found.entity_kind || found.kind || null;
                  ed = found.display_name || found.displayName || null;
                }
              }
              asset.linked_entity_candidates.push({
                visual_link_candidate_id: makeId('visual_link_', vid + '|' + eid),
                entity_id: eid,
                entity_kind: ek,
                entity_display_name: ed,
                link_reason: 'explicit_entity_id',
                link_confidence: 0.95,
                evidence_text: entIdMatch[0],
                evidence_hash: sha256Lf(entIdMatch[0]),
                requires_human_confirmation: true,
                canon_write_allowed: false,
                approval_required_for_canon_change: true
              });
            } else if (entNameMatch && entityPreviewData && entityPreviewData.entities) {
              const name = entNameMatch[1].trim();
              const hits = entityPreviewData.entities.filter(e => (e.display_name || '').trim() === name);
              if (hits.length === 1) {
                const hit = hits[0];
                  const ek = hit.kind || hit.entity_kind || hit.kind || null;
                  const ed = hit.display_name || null;
                  asset.linked_entity_candidates.push({
                    visual_link_candidate_id: makeId('visual_link_', vid + '|' + hit.entity_id),
                    entity_id: hit.entity_id,
                    entity_kind: ek,
                    entity_display_name: ed,
                    link_reason: 'explicit_entity_name_match',
                    link_confidence: 0.85,
                    evidence_text: entNameMatch[0],
                    evidence_hash: sha256Lf(entNameMatch[0]),
                    requires_human_confirmation: true,
                    canon_write_allowed: false,
                    approval_required_for_canon_change: true
                  });
              } else if (hits.length > 1) asset.visual_consistency_warnings.push('ambiguous_entity_name_match');
            } else if (display_name && entityPreviewData && entityPreviewData.entities) {
              // try unique registry match by display_name
              const hits = entityPreviewData.entities.filter(e => (e.display_name || '').trim() === display_name);
              if (hits.length === 1) {
                const hit = hits[0];
                  const ek = hit.kind || hit.entity_kind || hit.kind || null;
                  const ed = hit.display_name || null;
                  asset.linked_entity_candidates.push({
                    visual_link_candidate_id: makeId('visual_link_', vid + '|' + hit.entity_id),
                    entity_id: hit.entity_id,
                    entity_kind: ek,
                    entity_display_name: ed,
                    link_reason: 'display_name_registry_unique_match',
                    link_confidence: 0.85,
                    evidence_text: display_name,
                    evidence_hash: sha256Lf(display_name),
                    requires_human_confirmation: true,
                    canon_write_allowed: false,
                    approval_required_for_canon_change: true
                  });
              } else if (hits.length > 1) asset.visual_consistency_warnings.push('ambiguous_entity_name_match');
            }

            assets.push(asset);
          }
        } else if (/^\|/.test(raw)) {
          // simple table row style
          const cols = raw.split('|').map(c => c.trim()).filter(Boolean);
          if (cols.length >= 3) {
            const kind = cols[0];
            const name = cols[1];
            const file = cols[2];
            const status = cols[3] || 'reference_only';
            const evidence_text = raw;
            const evidence_hash = sha256Lf(evidence_text);
            const vid = makeId('visual_', `${name}|${kind}|${evidence_hash}`);
            assets.push({
              visual_asset_id: vid,
              asset_kind: kind,
              status: config.allowed_statuses.includes(status) ? status : 'reference_only',
              display_name: name,
              normalized_display_name: name,
              file_path: file,
              evidence_text,
              evidence_hash,
              extraction_rule: 'table_row',
              linked_entity_candidates: [],
              sources: [{ evidence_text, evidence_hash }]
            });
          }
        }
      }
      return assets;
    }

    // source selection
    const sourceText = options.source_text || (options.source_path ? fs.readFileSync(options.source_path, 'utf8') : null);
    let assets = [];
    if (sourceText) assets = extractFromText(sourceText);
    else {
      // read visual index but only pick entries with explicit visual_asset.display_name
      try {
        const raw = fs.readFileSync(preview.visual_index_path, 'utf8');
        const lines = raw.split(/\r?\n/).filter(Boolean);
        for (let i = 0; i < lines.length; i++) {
          try {
            const obj = JSON.parse(lines[i]);
            if (obj && obj.visual_asset && obj.visual_asset.display_name) {
              const name = obj.visual_asset.display_name;
              const kind = obj.visual_asset.asset_kind || 'unknown_visual';
              const evidence_text = lines[i];
              const evidence_hash = sha256Lf(evidence_text);
              const vid = makeId('visual_', `${name}|${kind}|${evidence_hash}`);
              assets.push({
                visual_asset_id: vid,
                asset_kind: kind,
                status: obj.visual_asset.status || 'reference_only',
                display_name: name,
                normalized_display_name: name,
                file_path: obj.visual_asset.file_path || null,
                evidence_text,
                evidence_hash,
                extraction_rule: 'visual_index_entry',
                linked_entity_candidates: [],
                sources: [{ evidence_text, evidence_hash }]
              });
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    // deduplicate by visual_asset_id and merge sources
    const dedup = new Map();
    for (const a of assets) {
      if (!dedup.has(a.visual_asset_id)) dedup.set(a.visual_asset_id, a);
      else {
        const ex = dedup.get(a.visual_asset_id);
        ex.sources = ex.sources || [];
        for (const s of a.sources || []) if (!ex.sources.find(x => x.evidence_hash === s.evidence_hash)) ex.sources.push(s);
      }
    }

    preview.visual_assets = Array.from(dedup.values());
    preview.visual_asset_count = preview.visual_assets.length;
    for (const a of preview.visual_assets) preview.visual_counts_by_kind[a.asset_kind] = (preview.visual_counts_by_kind[a.asset_kind] || 0) + 1;

    // normalize linked_entity_candidates, dedupe per asset, fill entity_kind/display_name and compute link_counts_by_entity_kind
    preview.link_counts_by_entity_kind = {};
    preview.link_candidate_count = 0;
    for (const a of preview.visual_assets) {
      if (!a.linked_entity_candidates || a.linked_entity_candidates.length === 0) continue;
      const seen = new Map();
      for (const l of a.linked_entity_candidates) {
        // ensure entity_id exists
        if (!l.entity_id) continue;
        // fill missing entity_kind/display_name from registry when possible
        if ((!l.entity_kind || !l.entity_display_name) && entityPreviewData && Array.isArray(entityPreviewData.entities)) {
          const found = entityPreviewData.entities.find(e => (e.entity_id || e.id) === l.entity_id || (e.entity_id || e.id) === l.entity_id);
          if (found) {
            l.entity_kind = l.entity_kind || found.kind || found.entity_kind || null;
            l.entity_display_name = l.entity_display_name || found.display_name || found.displayName || null;
          }
        }
        // default unknown kind
        l.entity_kind = l.entity_kind || 'unknown';
        l.entity_display_name = l.entity_display_name || null;

        if (!seen.has(l.entity_id)) seen.set(l.entity_id, l);
        else {
          // merge keeping highest confidence
          const prev = seen.get(l.entity_id);
          if ((l.link_confidence || 0) > (prev.link_confidence || 0)) seen.set(l.entity_id, l);
        }
      }
      const uniq = Array.from(seen.values());
      a.linked_entity_candidates = uniq;

      // update per-asset matched fields when unique
      if (uniq.length === 1) {
        const top = uniq[0];
        a.matched_existing_entity_id = top.entity_id;
        a.matched_existing_entity_kind = top.entity_kind || null;
        a.canon_link_confidence = top.link_confidence || 0;
      }

      // aggregate counts
      for (const l of uniq) {
        const k = l.entity_kind || 'unknown';
        preview.link_counts_by_entity_kind[k] = (preview.link_counts_by_entity_kind[k] || 0) + 1;
        preview.link_candidate_count += 1;
      }
    }

    return preview;
  }

  export function compileVisualAssetRegistrySummary(preview) {
    const lines = [];
    lines.push(`Mode: ${preview.mode}`);
    lines.push(`Visual assets: ${preview.visual_asset_count}`);
    for (const k of Object.keys(preview.visual_counts_by_kind)) lines.push(`- ${k}: ${preview.visual_counts_by_kind[k]}`);
    lines.push(`Link candidates: ${preview.link_candidate_count}`);
    if (preview.warnings && preview.warnings.length) lines.push(`Warnings: ${preview.warnings.join(', ')}`);
    if (preview.blocking_warnings && preview.blocking_warnings.length) lines.push(`Blocking: ${preview.blocking_warnings.join(', ')}`);
    return lines.join('\n');
  }

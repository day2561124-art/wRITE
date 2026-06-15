import { listApprovalItems } from "./approval-queue-service.mjs";
import { listSettingChangeProposals } from "./setting-change-proposal-service.mjs";
import {
  entityTypes,
  getStructuredEntityRegistry,
} from "./structured-canon-entity-registry-service.mjs";

function settingRecord(entity) {
  return {
    setting_id: entity.entity_id,
    entity_id: entity.entity_id,
    setting_type: entity.entity_type,
    entity_type: entity.entity_type,
    title: entity.canonical_name,
    canonical_name: entity.canonical_name,
    aliases: entity.aliases,
    content: entity.source_excerpt,
    status: entity.status,
    source: entity.source_file,
    source_section: entity.source_section,
    source_anchor: entity.source_anchor,
    provenance: entity.provenance,
    related_chapters: entity.related_chapters,
    related_characters: entity.related_characters,
    related_entities: entity.related_entities,
    last_confirmed_version: "active_engine",
    risk_level: entity.risk_level,
    has_conflict: entity.status === "conflict",
    can_propose_change: true,
    structured: true,
    detail: entity,
  };
}

export async function buildCanonSettingsCatalog() {
  const [{ registry, buildReport, conflictReport, provenance }, proposals, approvals] =
    await Promise.all([
      getStructuredEntityRegistry(),
      listSettingChangeProposals(),
      listApprovalItems(),
    ]);
  const records = Object.fromEntries(entityTypes.map((type) => [
    type,
    registry[type].map(settingRecord),
  ]));
  const settings = entityTypes.flatMap((type) => records[type]);
  const conflicts = conflictReport.conflicts.map((item) => ({
    ...item,
    title: item.summary,
    content: item.evidence.join("\n"),
    status: "conflict",
    risk_level: item.severity,
    has_conflict: true,
    can_propose_change: true,
  }));
  return {
    summary: {
      character_count: records.characters.length,
      ability_weapon_count: records.abilities.length + records.weapons.length,
      world_rule_count: records.world_rules.length,
      chapter_event_count: records.chapter_events.length,
      timeline_event_count: records.timeline_events.length,
      pending_setting_change_count: proposals.filter((item) => item.status === "pending_review").length,
      conflict_gap_count: conflicts.length,
      active_engine_hash: provenance.active_engine_hash,
      canon_db_hash: provenance.canon_db_hash,
      compressed_rules_hash: provenance.compressed_rules_hash,
      registry_build_status: buildReport.status,
      last_build_time: buildReport.built_at,
      entity_counts_by_type: buildReport.entity_counts_by_type,
      status_counts: buildReport.status_counts,
      conflict_counts: buildReport.conflict_counts,
    },
    settings,
    characters: records.characters,
    abilities: [...records.abilities, ...records.weapons],
    weapons: records.weapons,
    timeline: records.timeline_events,
    world_rules: records.world_rules,
    organizations: records.organizations,
    locations: records.locations,
    chapter_events: records.chapter_events,
    relationships: records.relationships,
    status_effects: records.status_effects,
    conflicts,
    proposals,
    approval_items: approvals.filter((item) => item.action_type === "setting_change_proposal"),
    registry: {
      build_report: buildReport,
      provenance,
      conflict_report: conflictReport,
    },
    safety: {
      read_only_canon: true,
      proposals_only: true,
      direct_apply_allowed: false,
      registry_mode: "derived_preview",
    },
  };
}

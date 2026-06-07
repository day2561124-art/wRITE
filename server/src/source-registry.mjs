import path from "node:path";
import { projectRoot } from "./project-paths.mjs";

const source = (spec) => ({
  required_in_generation: false,
  ui_visible: false,
  can_be_used_for_canon: false,
  can_be_used_for_style: false,
  can_be_used_for_error_learning: false,
  can_be_used_for_retrieval: true,
  placeholder_patterns: [],
  ...spec,
});

export const registeredSources = [
  source({
    source_id: "active_engine",
    source_type: "canon_database",
    source_trust_level: "T1",
    source_path: "data/canon_db/active_engine.md",
    canon_status: "canon",
    title: "Canon DB｜active_engine.md",
    ui_label: "Canon DB",
    authority: "P0 highest authority",
    authority_rank: 100,
    data_type: "markdown",
    required_in_generation: true,
    ui_visible: true,
    can_be_used_for_canon: true,
  }),
  source({
    source_id: "active_writing_card",
    source_type: "writing_policy",
    source_trust_level: "T3",
    source_path: "data/writing_policy_db/active_writing_card.md",
    canon_status: "policy",
    title: "Writing Policy DB｜active_writing_card.md",
    ui_label: "正文寫作卡",
    authority: "Writing policy, cannot override canon",
    authority_rank: 80,
    data_type: "markdown",
    required_in_generation: true,
    ui_visible: true,
    can_be_used_for_style: true,
  }),
  source({
    source_id: "active_proofing_card",
    source_type: "proofing_policy",
    source_trust_level: "T3",
    source_path: "data/proofing_policy_db/active_proofing_card.md",
    canon_status: "policy",
    title: "Proofing Policy DB｜active_proofing_card.md",
    ui_label: "正式驗稿卡",
    authority: "Proofing policy, cannot override canon",
    authority_rank: 70,
    data_type: "markdown",
    ui_visible: true,
    can_be_used_for_style: true,
    placeholder_patterns: [/尚未建立正式版本/u, /尚未匯入正式驗稿卡/u],
  }),
  source({
    source_id: "active_longline",
    source_type: "longline_policy",
    source_trust_level: "T3",
    source_path: "data/longline_db/active_longline.md",
    canon_status: "policy",
    title: "Longline DB｜active_longline.md",
    ui_label: "長線骨架",
    authority: "Longline boundary index, cannot become canon by itself",
    authority_rank: 75,
    data_type: "markdown",
    ui_visible: true,
    placeholder_patterns: [/缺檔保護卡/u, /尚未匯入正式長線骨架/u],
  }),
  source({
    source_id: "compressed_error_rules",
    source_type: "compressed_error_rules",
    source_trust_level: "T5",
    source_path: "data/error_report_db/compressed_rules.md",
    canon_status: "derived_rule",
    title: "Error Report DB｜compressed_rules.md",
    ui_label: "錯誤壓縮規則",
    authority: "Error avoidance rule, cannot rewrite canon",
    authority_rank: 65,
    data_type: "markdown",
    ui_visible: true,
    can_be_used_for_error_learning: true,
    placeholder_patterns: [/尚未建立正式版本/u, /尚未建立正式錯誤壓縮規則/u],
  }),
  ...[
    ["canon_errors", "Canon error report, cannot rewrite canon", 60],
    ["character_errors", "Character error report", 55],
    ["dialogue_errors", "Dialogue error report", 55],
    ["pacing_errors", "Pacing error report", 55],
    ["battle_errors", "Battle error report", 55],
    ["preference_errors", "Preference error report", 50],
  ].map(([sourceId, authority, authorityRank]) => source({
    source_id: sourceId,
    source_type: "error_report",
    source_trust_level: "T5",
    source_path: `data/error_report_db/${sourceId}.jsonl`,
    canon_status: "error_report",
    title: `Error Report DB｜${sourceId}.jsonl`,
    authority,
    authority_rank: authorityRank,
    data_type: "jsonl",
    can_be_used_for_error_learning: true,
  })),
  source({
    source_id: "pending_error_reports",
    source_type: "pending_error_candidate",
    source_trust_level: "T7",
    source_path: "data/feedback_db/pending_error_reports.jsonl",
    canon_status: "candidate",
    title: "Feedback DB｜pending_error_reports.jsonl",
    authority: "Pending feedback-derived error candidates",
    authority_rank: 45,
    data_type: "jsonl",
  }),
  source({
    source_id: "canon_memory",
    source_type: "memory_cache",
    source_trust_level: "T6",
    source_path: "data/memory_store/canon_memory.json",
    canon_status: "memory",
    title: "Memory Store｜canon_memory.json",
    authority: "Memory cache, cannot override Canon DB",
    authority_rank: 40,
    data_type: "json",
  }),
  source({
    source_id: "preference_memory",
    source_type: "preference_memory",
    source_trust_level: "T6",
    source_path: "data/memory_store/preference_memory.json",
    canon_status: "memory",
    title: "Memory Store｜preference_memory.json",
    authority: "Preference memory, cannot become canon",
    authority_rank: 35,
    data_type: "json",
    can_be_used_for_style: true,
  }),
  source({
    source_id: "working_memory",
    source_type: "working_memory",
    source_trust_level: "T8",
    source_path: "data/memory_store/working_memory.json",
    canon_status: "working",
    title: "Memory Store｜working_memory.json",
    authority: "Working memory for current task only",
    authority_rank: 30,
    data_type: "json",
  }),
];

export const sourceById = new Map(
  registeredSources.map((entry) => [entry.source_id, entry]),
);

export function sourceFilePath(sourceOrId) {
  const entry = typeof sourceOrId === "string" ? sourceById.get(sourceOrId) : sourceOrId;
  if (!entry) throw new Error(`Unknown registered source: ${sourceOrId}`);
  return path.join(projectRoot, ...entry.source_path.split("/"));
}

export function sourceSpecsFor(group) {
  if (group === "ui") return registeredSources.filter((entry) => entry.ui_visible);
  if (group === "stable") {
    return registeredSources.filter((entry) => entry.data_type === "markdown");
  }
  if (group === "jsonl") return registeredSources.filter((entry) => entry.data_type === "jsonl");
  if (group === "memory") return registeredSources.filter((entry) => entry.data_type === "json");
  if (group === "retrieval") {
    return registeredSources.filter((entry) => entry.can_be_used_for_retrieval);
  }
  return [...registeredSources];
}

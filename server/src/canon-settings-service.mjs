import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { listApprovalItems } from "./approval-queue-service.mjs";
import { listSettingChangeProposals } from "./setting-change-proposal-service.mjs";
import { projectPaths } from "./project-paths.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sections(markdown) {
  const result = [];
  const lines = markdown.split(/\r?\n/u);
  let current = null;
  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.+)$/u);
    if (heading) {
      if (current) result.push(current);
      current = { title: heading[2].trim(), level: heading[1].length, lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) result.push(current);
  return result;
}

function classify(title) {
  if (/角色|人物|學生|教師/u.test(title)) return "character";
  if (/能力|異能|武裝|靈力|戰力/u.test(title)) return "ability";
  if (/時間|週次|事件|章節/u.test(title)) return "timeline";
  return "world_rule";
}

function recordsFrom(markdown) {
  return sections(markdown)
    .filter((section) => section.level >= 2)
    .map((section, index) => ({
      setting_id: `canon_setting_${String(index + 1).padStart(4, "0")}`,
      setting_type: classify(section.title),
      title: section.title,
      content: section.lines.join("\n").trim() || "[empty section]",
      status: "canon",
      source: "data/canon_db/active_engine.md",
      last_confirmed_version: "active_engine",
      risk_level: "P2",
      related_chapters: [],
      related_characters: [],
      has_conflict: /衝突|缺漏|待確認/u.test(section.lines.join("\n")),
      can_propose_change: true,
    }));
}

export async function buildCanonSettingsCatalog() {
  const [activeEngine, compressedRules, proposals, approvals] = await Promise.all([
    readFile(projectPaths.activeEngine, "utf8"),
    readFile(projectPaths.compressedRules, "utf8"),
    listSettingChangeProposals(),
    listApprovalItems(),
  ]);
  const settings = recordsFrom(activeEngine);
  const byType = (type) => settings.filter((item) => item.setting_type === type);
  const conflicts = settings.filter((item) => item.has_conflict);
  return {
    summary: {
      character_count: byType("character").length,
      ability_weapon_count: byType("ability").length,
      world_rule_count: byType("world_rule").length,
      chapter_event_count: byType("timeline").length,
      timeline_event_count: byType("timeline").length,
      pending_setting_change_count: proposals.filter((item) => item.status === "pending_review").length,
      conflict_gap_count: conflicts.length,
      active_engine_hash: sha256(activeEngine),
      compressed_rules_hash: sha256(compressedRules),
    },
    settings,
    characters: byType("character"),
    abilities: byType("ability"),
    timeline: byType("timeline"),
    world_rules: byType("world_rule"),
    conflicts,
    proposals,
    approval_items: approvals.filter((item) => item.action_type === "setting_change_proposal"),
    safety: {
      read_only_canon: true,
      proposals_only: true,
      direct_apply_allowed: false,
    },
  };
}

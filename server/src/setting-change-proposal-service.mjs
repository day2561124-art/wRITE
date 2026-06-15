import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createApprovalItem } from "./approval-queue-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const proposalIdPattern = /^setting_proposal_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const settingTypes = new Set(["character", "ability", "weapon", "timeline", "world_rule"]);
const highRiskTerms = [
  "死亡", "長期失能", "重大能力突破", "代表資格", "主角身份", "階級突破",
  "時間線重大", "角色關係重大", "世界觀基礎規則", "active_engine", "rollback",
  "回滾", "正式資料清理",
];

function text(value, label, maxLength, required = false) {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${label} is required.`);
  if (result.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return result;
}

function stringArray(value, label) {
  if (value === undefined || value === null || value === "") return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,，、\n]/u);
  if (values.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must contain strings.`);
  }
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].slice(0, 100);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function makeId() {
  const compact = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  return `setting_proposal_${compact.slice(0, 8)}-${compact.slice(8)}-${randomBytes(4).toString("hex")}`;
}

function rootsFor(options = {}) {
  const proposals = options.settingChangeProposals
    ? assertPathInside(
      options.settingChangeProposals,
      projectPaths.settingChangeProposals,
      "setting proposal test root",
    )
    : projectPaths.settingChangeProposals;
  return { proposals };
}

function proposalPath(proposalId, roots) {
  if (!proposalIdPattern.test(String(proposalId ?? ""))) {
    throw new Error("Invalid proposal_id.");
  }
  return path.join(roots.proposals, `${proposalId}.json`);
}

async function protectedHashes(options = {}) {
  const activeEnginePath = options.activeEnginePath ?? projectPaths.activeEngine;
  const compressedRulesPath = options.compressedRulesPath ?? projectPaths.compressedRules;
  const [activeEngine, compressedRules] = await Promise.all([
    readFile(activeEnginePath),
    readFile(compressedRulesPath),
  ]);
  return {
    active_engine_hash: sha256(activeEngine),
    compressed_rules_hash: sha256(compressedRules),
  };
}

function riskFor(input) {
  const combined = `${input.title}\n${input.before}\n${input.after}\n${input.reason}`;
  const matchedTerms = highRiskTerms.filter((term) => combined.includes(term));
  return {
    risk_level: matchedTerms.length ? "P0" : input.riskLevel || "P1",
    requires_second_confirm: matchedTerms.length > 0 || input.requiresSecondConfirm === true,
    matched_terms: matchedTerms,
  };
}

function normalizeInput(rawInput = {}) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new Error("input must be an object.");
  }
  const settingType = text(
    rawInput.setting_type ?? rawInput.settingType,
    "setting_type",
    50,
    true,
  );
  if (!settingTypes.has(settingType)) throw new Error(`Unknown setting_type: ${settingType}`);
  return {
    targetSettingId: text(
      rawInput.target_setting_id ?? rawInput.targetSettingId,
      "target_setting_id",
      200,
      true,
    ),
    settingType,
    title: text(rawInput.title, "title", 500, true),
    before: text(rawInput.before, "before", 100_000, true),
    after: text(rawInput.after, "after", 100_000, true),
    reason: text(rawInput.reason, "reason", 10_000, true),
    riskLevel: text(rawInput.risk_level ?? rawInput.riskLevel, "risk_level", 20),
    source: text(rawInput.source, "source", 200) || "writer_workbench",
    createdBy: text(rawInput.created_by ?? rawInput.createdBy, "created_by", 200)
      || "local_user",
    requiresSecondConfirm:
      rawInput.requires_second_confirm === true || rawInput.requiresSecondConfirm === true,
    relatedChapters: stringArray(
      rawInput.related_chapters ?? rawInput.relatedChapters,
      "related_chapters",
    ),
    relatedCharacters: stringArray(
      rawInput.related_characters ?? rawInput.relatedCharacters,
      "related_characters",
    ),
  };
}

export async function createSettingChangeProposal(rawInput = {}, options = {}) {
  const input = normalizeInput(rawInput);
  if (input.before === input.after) throw new Error("before and after must differ.");
  const roots = rootsFor(options);
  await mkdir(roots.proposals, { recursive: true });
  const proposalId = makeId();
  const hashes = await protectedHashes(options);
  const risk = riskFor(input);
  const proposal = {
    proposal_id: proposalId,
    target_setting_id: input.targetSettingId,
    setting_type: input.settingType,
    title: input.title,
    before: input.before,
    after: input.after,
    diff: {
      before: input.before,
      after: input.after,
      changed: true,
    },
    reason: input.reason,
    risk_level: risk.risk_level,
    source: input.source,
    created_at: new Date().toISOString(),
    created_by: input.createdBy,
    status: "pending_review",
    requires_second_confirm: risk.requires_second_confirm,
    related_chapters: input.relatedChapters,
    related_characters: input.relatedCharacters,
    active_engine_hash_at_creation: hashes.active_engine_hash,
    compressed_rules_hash_at_creation: hashes.compressed_rules_hash,
    risk_matches: risk.matched_terms,
    safety: {
      modifies_active_engine: false,
      modifies_canon_db: false,
      modifies_compressed_rules: false,
      direct_apply_allowed: false,
      approval_queue_required: true,
    },
  };
  const filePath = proposalPath(proposalId, roots);
  await commitFileTransaction("create-setting-change-proposal", [
    { filePath, content: `${JSON.stringify(proposal, null, 2)}\n` },
  ], { proposal_id: proposalId, phase: "phase_20b_setting_proposal" });

  const approval = await createApprovalItem({
    actionType: "setting_change_proposal",
    targetType: "setting",
    targetId: input.targetSettingId,
    title: `設定修改：${input.title}`,
    summary: input.reason,
    riskLevel: risk.risk_level,
    requiresSecondConfirmation: risk.requires_second_confirm,
    requiresUserConfirmation: true,
    canExecuteWithoutUserConfirmation: false,
    createdBy: input.createdBy,
    source: input.source,
    lineage: { proposal_id: proposalId },
    impact: {
      will_modify: [],
      will_create: [normalizeProjectPath(filePath)],
      rollback_available: false,
    },
    links: { proposal_id: proposalId },
    details: {
      proposal_id: proposalId,
      setting_type: input.settingType,
      before: input.before,
      after: input.after,
      diff: proposal.diff,
      confirmation_text: risk.requires_second_confirm ? "確認設定修改" : "",
      direct_apply_allowed: false,
    },
    safety: proposal.safety,
  }, options);
  return { proposal, approval_item: approval };
}

export async function listSettingChangeProposals(input = {}, options = {}) {
  const roots = rootsFor(options);
  await mkdir(roots.proposals, { recursive: true });
  const entries = await readdir(roots.proposals, { withFileTypes: true });
  const proposals = [];
  for (const entry of entries) {
    if (!entry.isFile() || !proposalIdPattern.test(entry.name.replace(/\.json$/u, ""))) continue;
    try {
      proposals.push(JSON.parse(await readFile(path.join(roots.proposals, entry.name), "utf8")));
    } catch {
      // Ignore incomplete proposal records.
    }
  }
  return proposals
    .filter((item) => !input.setting_type || item.setting_type === input.setting_type)
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
}

export async function getSettingChangeProposal(proposalId, options = {}) {
  return JSON.parse(await readFile(proposalPath(proposalId, rootsFor(options)), "utf8"));
}

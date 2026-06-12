import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  atomicAppendFile,
  atomicWriteFile,
  commitFileTransaction,
} from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  resolveProjectPath,
} from "./project-paths.mjs";
import { getApprovalItem, appendApprovalLog } from "./approval-queue-service.mjs";

const applicationIdPattern =
  /^compressed_rule_application_\d{8}-\d{6}-[a-f0-9]{8}$/u;

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function createId(prefix) {
  const compact = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "");
  return `${prefix}_${compact}-${randomBytes(4).toString("hex")}`;
}

function rootsFor(options = {}) {
  const feedbackLoop = options.feedbackLoop || projectPaths.feedbackLoop;
  return {
    proposals: options.feedbackLoopRuleUpdateProposals
      ? path.join(options.feedbackLoopRuleUpdateProposals)
      : path.join(feedbackLoop, "rule_update_proposals"),
    applications: options.feedbackLoopRuleUpdateApplications
      ? path.join(options.feedbackLoopRuleUpdateApplications)
      : path.join(feedbackLoop, "rule_update_applications"),
    backups: options.feedbackLoopRuleUpdateBackups
      ? path.join(options.feedbackLoopRuleUpdateBackups)
      : path.join(feedbackLoop, "rule_update_backups"),
  };
}

function proposalDataPath(proposalId, roots) {
  return path.join(roots.proposals, proposalId, "proposal.json");
}

function applicationDirPath(applicationId, roots) {
  return path.join(roots.applications, applicationId);
}

function backupDirPath(applicationId, roots) {
  return path.join(roots.backups, applicationId);
}

export async function confirmCompressedRuleUpdate(input = {}, options = {}) {
  const approvalId = input.approval_id || input.approvalId;
  const proposalId = input.proposal_id || input.proposalId;
  const confirmedBy = input.confirmed_by || input.confirmedBy || "local_user";
  if (!approvalId || !proposalId) throw new Error("approval_id and proposal_id are required.");

  const approval = await getApprovalItem(approvalId, options);
  if (approval.action_type !== "compressed_rule_update") {
    throw new Error("Approval item is not a compressed_rule_update.");
  }
  const status = approval.status?.status;
  if (!["resolved", "confirmed"].includes(status)) {
    throw new Error("Approval item is not confirmed/resolved.");
  }
  if (String(approval.details?.proposal_id) !== String(proposalId)) {
    throw new Error("Proposal ID mismatch between approval and provided proposal_id.");
  }

  const roots = rootsFor(options);
  const proposalPath = proposalDataPath(proposalId, roots);
  const proposalData = JSON.parse(await readFile(proposalPath, "utf8"));
  if (proposalData.safety?.proposal_only !== true) {
    throw new Error("Proposal safety does not indicate proposal_only.");
  }
  if (proposalData.risk?.direct_apply_allowed === true) {
    throw new Error("Proposal allows direct apply; Phase 10B requires approval confirm path.");
  }

  // Verify target file hash (allow fixture override)
  const targetPath = options.compressedRulesPath
    ? resolveProjectPath(options.compressedRulesPath, "compressed_rules target")
    : projectPaths.compressedRules;
  const currentBuffer = await readFile(targetPath);
  const currentSha = sha256Buffer(currentBuffer);
  if (currentSha !== proposalData.current_target_sha256) {
    throw new Error("Target file hash mismatch; aborting apply.");
  }

  const mode = proposalData.proposed_patch?.mode;
  const content = proposalData.proposed_patch?.content ?? "";
  if (mode === "manual_review") {
    throw new Error("Proposal requires manual_review; automatic apply blocked.");
  }
  if (mode === "replace_section") {
    throw new Error("replace_section mode deferred; automatic apply blocked.");
  }
  if (mode !== "append") {
    throw new Error("Unsupported proposed_patch.mode for Phase 10B.");
  }

  // Prepare application record
  const applicationId = createId("compressed_rule_application");
  const appDir = applicationDirPath(applicationId, roots);
  const backupDir = backupDirPath(applicationId, roots);
  await mkdir(appDir, { recursive: true });
  await mkdir(backupDir, { recursive: true });

  // Create backup
  const backupFile = path.join(backupDir, "compressed_rules.before.md");
  await atomicWriteFile(backupFile, currentBuffer, { application_id: applicationId });
  const backupJson = {
    application_id: applicationId,
    created_at: new Date().toISOString(),
    source_file: normalizeProjectPath(targetPath),
    source_sha256: currentSha,
    backup_file: "compressed_rules.before.md",
    restore_requires_manual_review: true,
    automatic_restore_allowed: false,
  };
  await atomicWriteFile(path.join(backupDir, "backup.json"), `${JSON.stringify(backupJson, null, 2)}\n`, { application_id: applicationId });

  // Apply append atomically
  const appendManifest = await atomicAppendFile(targetPath, content, { approval_item_id: approvalId, application_id: applicationId });

  const afterBuffer = await readFile(targetPath);
  const afterSha = sha256Buffer(afterBuffer);

  // Build application.json / diff_summary.md / rollback.md
  const application = {
    application_id: applicationId,
    created_at: new Date().toISOString(),
    approval_id: approvalId,
    proposal_id: proposalId,
    target_file: normalizeProjectPath(targetPath),
    before_sha256: currentSha,
    after_sha256: afterSha,
    backup_path: normalizeProjectPath(backupFile),
    applied_patch: {
      mode: "append",
      content_sha256: createHash("sha256").update(content).digest("hex"),
    },
    risk: {
      modified_compressed_rules: true,
      modified_active_engine: false,
      requires_approval: true,
      approval_confirmed: true,
    },
    safety: {
      atomic_write: true,
      active_engine_modified: false,
      writing_card_modified: false,
      proofing_card_modified: false,
      rollback_metadata_created: true,
    },
  };

  const diffSummary = [];
  diffSummary.push(`# Compressed rule update application: ${applicationId}`);
  diffSummary.push(`- proposal: ${proposalId}`);
  diffSummary.push(`- approval: ${approvalId}`);
  diffSummary.push(`- target: ${normalizeProjectPath(targetPath)}`);
  diffSummary.push(`- before_sha256: ${currentSha}`);
  diffSummary.push(`- after_sha256: ${afterSha}`);
  diffSummary.push(`\n## Patch (append)\n`);
  diffSummary.push(content.slice(0, 10_000));

  const rollbackMetadata = {
    application_id: applicationId,
    created_at: new Date().toISOString(),
    backup_file: normalizeProjectPath(backupFile),
    restore_requires_manual_review: true,
    automatic_restore_allowed: false,
  };

  // Persist application artifacts atomically
  await commitFileTransaction("record-compressed-rule-application", [
    { filePath: path.join(appDir, "application.json"), content: `${JSON.stringify(application, null, 2)}\n` },
    { filePath: path.join(appDir, "diff_summary.md"), content: diffSummary.join("\n") },
    { filePath: path.join(appDir, "rollback.md"), content: `${JSON.stringify(rollbackMetadata, null, 2)}\n` },
  ], { application_id: applicationId });

  // Append approval log entry
  try {
    await appendApprovalLog("application_created", approval, { result: "success", approvedBy: confirmedBy }, options);
  } catch (error) {
    // non-fatal
  }

  return { application_id: applicationId, application };
}

export async function listCompressedRuleApplications(input = {}, options = {}) {
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("limit must be an integer between 1 and 100.");
  }
  const roots = rootsFor(options);
  const root = roots.applications;
  try {
    const list = await (await import("node:fs/promises")).readdir(root, { withFileTypes: true });
    const records = [];
    for (const entry of list) {
      if (!entry.isDirectory() || !applicationIdPattern.test(entry.name)) continue;
      try {
        const directory = path.join(root, entry.name);
        const application = JSON.parse(await readFile(
          path.join(directory, "application.json"),
          "utf8",
        ));
        application.metadata = {
          diff_summary_available: await stat(path.join(directory, "diff_summary.md"))
            .then(() => true, () => false),
          rollback_metadata_available: await stat(path.join(directory, "rollback.md"))
            .then(() => true, () => false),
        };
        records.push(application);
      } catch {
        // Ignore incomplete runtime artifacts.
      }
    }
    return records
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
      .slice(0, limit);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export async function getCompressedRuleApplication(applicationId, options = {}) {
  const roots = rootsFor(options);
  const dir = applicationDirPath(applicationId, roots);
  const file = path.join(dir, "application.json");
  return JSON.parse(await readFile(file, "utf8"));
}

export default {
  confirmCompressedRuleUpdate,
  listCompressedRuleApplications,
  getCompressedRuleApplication,
};

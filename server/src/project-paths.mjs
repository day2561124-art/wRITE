import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const releaseRoot = path.resolve(__dirname, "..", "..");

function managedProjectRoot() {
  const configured = process.env.NEXA_MANAGED_PROJECT_ROOT;
  if (configured === undefined) return releaseRoot;
  if (!path.isAbsolute(configured)) throw new Error("NEXA_MANAGED_PROJECT_ROOT must be an absolute repository path.");
  const root = realpathSync.native(configured);
  const git = lstatSync(path.join(root, ".git"));
  if (!git.isDirectory() && !git.isFile()) throw new Error("The managed project has no regular Git repository metadata.");
  return root;
}

export const projectRoot = managedProjectRoot();
const realProjectRoot = realpathSync.native(projectRoot);

function effectiveExistingPath(filePath) {
  const ancestor = nearestExistingPath(filePath);
  return path.resolve(realpathSync.native(ancestor), path.relative(ancestor, filePath));
}
function selectDataRoot(value) {
  if (value === undefined) return path.join(projectRoot, "data");
  if (typeof value !== "string" || !value.trim() || !path.isAbsolute(value)) {
    throw new Error("WRITE_DATA_ROOT must be an absolute directory path.");
  }
  const root = path.resolve(value);
  if (root === path.parse(root).root
      || isInside(projectRoot, root) || isInside(root, projectRoot)) {
    throw new Error("WRITE_DATA_ROOT must be independent of the source repository.");
  }
  return root;
}
// Only trusted process configuration may set this. All default data paths,
// agent run state, traces, journals, locks and transaction manifests use it.
export const projectDataRoot = selectDataRoot(process.env.WRITE_DATA_ROOT);
const realDataRoot = effectiveExistingPath(projectDataRoot);
// Without explicit opt-in, preserve the original no-symlink-escape
// restriction for the repository's default data/ directory.
if (process.env.WRITE_DATA_ROOT === undefined && !isInside(realProjectRoot, realDataRoot)) {
  throw new Error("The default data root must remain inside the source repository.");
}
if (process.env.WRITE_DATA_ROOT !== undefined
    && (isInside(realProjectRoot, realDataRoot) || isInside(realDataRoot, realProjectRoot))) {
  throw new Error("WRITE_DATA_ROOT must resolve independently of the source repository.");
}

export const projectPaths = {
  outputs: path.join(projectDataRoot, "outputs"),
  outputLogs: path.join(projectDataRoot, "outputs", "logs"),
  creativeTasks: path.join(projectDataRoot, "outputs", "creative_tasks"),
  creativeTaskLog: path.join(projectDataRoot, "outputs", "logs", "creative_task_runs.jsonl"),
  gptWritingContexts: path.join(projectDataRoot, "outputs", "gpt_writing_contexts"),
  writingCandidates: path.join(projectDataRoot, "outputs", "writing_candidates"),
  drafts: path.join(projectDataRoot, "outputs", "drafts"),
  proofReports: path.join(projectDataRoot, "outputs", "proof_reports"),
  proofingContexts: path.join(projectDataRoot, "outputs", "proofing_contexts"),
  adoptedWritings: path.join(projectDataRoot, "outputs", "adopted_writings"),
  adoptedWritingSettlementContexts: path.join(
    projectDataRoot,
    "outputs",
    "settlement_contexts",
  ),
  adoptedWritingSettlementReports: path.join(
    projectDataRoot,
    "outputs",
    "settlement_reports",
  ),
  engineCandidateReviews: path.join(
    projectDataRoot,
    "outputs",
    "engine_candidate_reviews",
  ),
  settlementProposals: path.join(projectDataRoot, "outputs", "settlement_proposals"),
  compressedRuleCandidates: path.join(projectDataRoot, "outputs", "compressed_rule_candidates"),
  visualDb: path.join(projectDataRoot, "visual_db"),
  visualAssets: path.join(projectDataRoot, "visual_db", "assets"),
  visualIndex: path.join(projectDataRoot, "visual_db", "visual_index.jsonl"),
  agentRuns: path.join(projectDataRoot, "agent_runs"),
  neuralTraces: path.join(projectDataRoot, "agent_runs", "neural_traces"),
  neuralModuleOutputs: path.join(projectDataRoot, "agent_runs", "neural_outputs"),
  canonDb: path.join(projectDataRoot, "canon_db"),
  activeEngine: path.join(projectDataRoot, "canon_db", "active_engine.md"),
  canonSources: path.join(projectDataRoot, "canon_db", "sources"),
  engineVersions: path.join(projectDataRoot, "canon_db", "versions"),
  pendingEngineCandidates: path.join(projectDataRoot, "canon_db", "pending_engine_candidates"),
  rejectedEngineCandidates: path.join(projectDataRoot, "canon_db", "rejected_engine_candidates"),
  engineSnapshots: path.join(projectDataRoot, "canon_db", "engine_snapshots"),
  engineArchive: path.join(projectDataRoot, "canon_db", "archive"),
  activationLogs: path.join(projectDataRoot, "canon_db", "activation_logs"),
  activationLog: path.join(projectDataRoot, "canon_db", "activation_logs", "activation_log.jsonl"),
  rollback: path.join(projectDataRoot, "canon_db", "rollback"),
  rollbackIndex: path.join(projectDataRoot, "canon_db", "rollback", "rollback_index.json"),
  writingWorkflow: path.join(projectDataRoot, "writing_workflow"),
  candidateDrafts: path.join(projectDataRoot, "writing_workflow", "candidate_drafts"),
  workflowProofReports: path.join(projectDataRoot, "writing_workflow", "proof_reports"),
  adoptedChapters: path.join(projectDataRoot, "writing_workflow", "adopted_chapters"),
  contextBundles: path.join(projectDataRoot, "writing_workflow", "context_bundles"),
  workflowLogs: path.join(projectDataRoot, "writing_workflow", "logs"),
  settlementWorkflow: path.join(projectDataRoot, "writing_workflow", "settlements"),
  settlementContexts: path.join(projectDataRoot, "writing_workflow", "settlements", "contexts"),
  settlementReports: path.join(projectDataRoot, "writing_workflow", "settlements", "reports"),
  approvalQueue: path.join(projectDataRoot, "approval_queue"),
  approvalItems: path.join(projectDataRoot, "approval_queue", "items"),
  approvalLogs: path.join(projectDataRoot, "approval_queue", "logs"),
  approvalLog: path.join(projectDataRoot, "approval_queue", "logs", "approval_log.jsonl"),
  settingChangeProposals: path.join(projectDataRoot, "setting_change_proposals"),
  entityRegistry: path.join(projectDataRoot, "entity_registry"),
  entityRegistryData: path.join(projectDataRoot, "entity_registry", "entity_registry.json"),
  entityRegistryIndex: path.join(projectDataRoot, "entity_registry", "entity_registry.index.json"),
  entityRegistrySchema: path.join(projectDataRoot, "entity_registry", "entity_registry.schema.json"),
  entityRegistryBuildReport: path.join(projectDataRoot, "entity_registry", "entity_registry_build_report.json"),
  entityRegistryConflictReport: path.join(projectDataRoot, "entity_registry", "conflict_report.json"),
  entityRegistryProvenance: path.join(projectDataRoot, "entity_registry", "provenance.json"),
  characterProfileDb: path.join(projectDataRoot, "character_profile_db"),
  characterVoiceRegistry: path.join(
    projectDataRoot,
    "character_profile_db",
    "active_character_voice_registry.md",
  ),
  cleanupRoot: path.join(projectDataRoot, "cleanup"),
  cleanupProposals: path.join(projectDataRoot, "cleanup", "proposals"),
  cleanupLogs: path.join(projectDataRoot, "cleanup", "logs"),
  cleanupLog: path.join(projectDataRoot, "cleanup", "logs", "cleanup_log.jsonl"),
  cleanupTrash: path.join(projectDataRoot, "cleanup", "trash"),
  cleanupStaging: path.join(projectDataRoot, "cleanup", "staging"),
  cleanupTombstones: path.join(projectDataRoot, "cleanup", "tombstones"),
  pendingErrorReports: path.join(projectDataRoot, "feedback_db", "pending_error_reports.jsonl"),
  errorReportDb: path.join(projectDataRoot, "error_report_db"),
  compressedRules: path.join(projectDataRoot, "error_report_db", "compressed_rules.md"),
  feedbackLoop: path.join(projectDataRoot, "feedback_loop"),
  feedbackLoopItems: path.join(projectDataRoot, "feedback_loop", "items"),
  feedbackLoopDigests: path.join(projectDataRoot, "feedback_loop", "digests"),
  feedbackLoopRuleCandidates: path.join(
    projectDataRoot,
    "feedback_loop",
    "rule_candidates",
  ),
  feedbackLoopRuleUpdateProposals: path.join(
    projectDataRoot,
    "feedback_loop",
    "rule_update_proposals",
  ),
  feedbackLoopRuleUpdateApplications: path.join(
    projectDataRoot,
    "feedback_loop",
    "rule_update_applications",
  ),
  feedbackLoopRuleUpdateBackups: path.join(
    projectDataRoot,
    "feedback_loop",
    "rule_update_backups",
  ),
  feedbackLoopContextBundles: path.join(
    projectDataRoot,
    "feedback_loop",
    "context_bundles",
  ),
  backupsRoot: path.join(projectDataRoot, "backups"),
  projectBackups: path.join(projectDataRoot, "backups", "project_backups"),
  backupExports: path.join(projectDataRoot, "backups", "exports"),
  restorePreviews: path.join(projectDataRoot, "backups", "restore_previews"),
};

function isInside(basePath, targetPath) {
  const relative = path.relative(basePath, targetPath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function nearestExistingPath(filePath) {
  let current = filePath;
  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return current;
    current = parent;
  }
  return current;
}

function assertNoSymlinkEscape(filePath, label) {
  const actual = effectiveExistingPath(filePath);
  const projectScoped = isInside(projectRoot, filePath)
    && isInside(realProjectRoot, actual);
  const consumerScoped = process.env.WRITE_DATA_ROOT !== undefined
    && isInside(projectDataRoot, filePath)
    && isInside(realDataRoot, actual);
  if (!projectScoped && !consumerScoped) {
    throw new Error(`${label} escapes the authorized project or data directory through a symbolic link.`);
  }
}

export function normalizeProjectPath(filePath) {
  return path.relative(projectRoot, filePath).replaceAll(path.sep, "/");
}

export function resolveProjectPath(value, label = "path") {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} requires a path.`);
  }
  const resolved = path.resolve(projectRoot, value);
  if (!isInside(projectRoot, resolved) && !isInside(projectDataRoot, resolved)) {
    throw new Error(`${label} must stay inside the project or configured data directory.`);
  }
  assertNoSymlinkEscape(resolved, label);
  return resolved;
}

export function assertPathInside(filePath, allowedRoot, label = "path") {
  const resolved = resolveProjectPath(filePath, label);
  const root = resolveProjectPath(allowedRoot, `${label} root`);
  if (!isInside(root, resolved)) {
    throw new Error(`${label} must stay under ${normalizeProjectPath(root)}.`);
  }
  return resolved;
}

export function assertExactPath(filePath, expectedPath, label = "path") {
  const resolved = resolveProjectPath(filePath, label);
  const expected = resolveProjectPath(expectedPath, `${label} target`);
  if (resolved !== expected) {
    throw new Error(`${label} must be ${normalizeProjectPath(expected)}.`);
  }
  return resolved;
}

export function resolveGeneratedMarkdownPath(value, label = "output") {
  const resolved = assertPathInside(value, projectPaths.outputs, label);
  if (isInside(projectPaths.outputLogs, resolved)) {
    throw new Error(`${label} cannot write into data/outputs/logs.`);
  }
  if (path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error(`${label} must be a Markdown file under data/outputs.`);
  }
  return resolved;
}

export function resolveCandidateMarkdownPath(value, label = "candidate output") {
  const resolved = assertPathInside(value, projectPaths.compressedRuleCandidates, label);
  if (path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error(`${label} must be a Markdown file.`);
  }
  return resolved;
}

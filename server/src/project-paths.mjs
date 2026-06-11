import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.resolve(__dirname, "..", "..");
const realProjectRoot = realpathSync.native(projectRoot);

export const projectPaths = {
  outputs: path.join(projectRoot, "data", "outputs"),
  outputLogs: path.join(projectRoot, "data", "outputs", "logs"),
  creativeTasks: path.join(projectRoot, "data", "outputs", "creative_tasks"),
  creativeTaskLog: path.join(projectRoot, "data", "outputs", "logs", "creative_task_runs.jsonl"),
  gptWritingContexts: path.join(projectRoot, "data", "outputs", "gpt_writing_contexts"),
  writingCandidates: path.join(projectRoot, "data", "outputs", "writing_candidates"),
  drafts: path.join(projectRoot, "data", "outputs", "drafts"),
  proofReports: path.join(projectRoot, "data", "outputs", "proof_reports"),
  proofingContexts: path.join(projectRoot, "data", "outputs", "proofing_contexts"),
  adoptedWritings: path.join(projectRoot, "data", "outputs", "adopted_writings"),
  settlementProposals: path.join(projectRoot, "data", "outputs", "settlement_proposals"),
  compressedRuleCandidates: path.join(projectRoot, "data", "outputs", "compressed_rule_candidates"),
  visualDb: path.join(projectRoot, "data", "visual_db"),
  visualAssets: path.join(projectRoot, "data", "visual_db", "assets"),
  visualIndex: path.join(projectRoot, "data", "visual_db", "visual_index.jsonl"),
  agentRuns: path.join(projectRoot, "data", "agent_runs"),
  neuralTraces: path.join(projectRoot, "data", "agent_runs", "neural_traces"),
  neuralModuleOutputs: path.join(projectRoot, "data", "agent_runs", "neural_outputs"),
  canonDb: path.join(projectRoot, "data", "canon_db"),
  activeEngine: path.join(projectRoot, "data", "canon_db", "active_engine.md"),
  engineVersions: path.join(projectRoot, "data", "canon_db", "versions"),
  pendingEngineCandidates: path.join(projectRoot, "data", "canon_db", "pending_engine_candidates"),
  rejectedEngineCandidates: path.join(projectRoot, "data", "canon_db", "rejected_engine_candidates"),
  engineSnapshots: path.join(projectRoot, "data", "canon_db", "engine_snapshots"),
  engineArchive: path.join(projectRoot, "data", "canon_db", "archive"),
  activationLogs: path.join(projectRoot, "data", "canon_db", "activation_logs"),
  activationLog: path.join(projectRoot, "data", "canon_db", "activation_logs", "activation_log.jsonl"),
  rollback: path.join(projectRoot, "data", "canon_db", "rollback"),
  rollbackIndex: path.join(projectRoot, "data", "canon_db", "rollback", "rollback_index.json"),
  writingWorkflow: path.join(projectRoot, "data", "writing_workflow"),
  candidateDrafts: path.join(projectRoot, "data", "writing_workflow", "candidate_drafts"),
  workflowProofReports: path.join(projectRoot, "data", "writing_workflow", "proof_reports"),
  adoptedChapters: path.join(projectRoot, "data", "writing_workflow", "adopted_chapters"),
  contextBundles: path.join(projectRoot, "data", "writing_workflow", "context_bundles"),
  workflowLogs: path.join(projectRoot, "data", "writing_workflow", "logs"),
  settlementWorkflow: path.join(projectRoot, "data", "writing_workflow", "settlements"),
  settlementContexts: path.join(projectRoot, "data", "writing_workflow", "settlements", "contexts"),
  settlementReports: path.join(projectRoot, "data", "writing_workflow", "settlements", "reports"),
  approvalQueue: path.join(projectRoot, "data", "approval_queue"),
  approvalItems: path.join(projectRoot, "data", "approval_queue", "items"),
  approvalLogs: path.join(projectRoot, "data", "approval_queue", "logs"),
  approvalLog: path.join(projectRoot, "data", "approval_queue", "logs", "approval_log.jsonl"),
  cleanupRoot: path.join(projectRoot, "data", "cleanup"),
  cleanupProposals: path.join(projectRoot, "data", "cleanup", "proposals"),
  cleanupLogs: path.join(projectRoot, "data", "cleanup", "logs"),
  cleanupLog: path.join(projectRoot, "data", "cleanup", "logs", "cleanup_log.jsonl"),
  cleanupTrash: path.join(projectRoot, "data", "cleanup", "trash"),
  cleanupStaging: path.join(projectRoot, "data", "cleanup", "staging"),
  cleanupTombstones: path.join(projectRoot, "data", "cleanup", "tombstones"),
  pendingErrorReports: path.join(projectRoot, "data", "feedback_db", "pending_error_reports.jsonl"),
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
  const existing = nearestExistingPath(filePath);
  const realExisting = realpathSync.native(existing);
  if (!isInside(realProjectRoot, realExisting)) {
    throw new Error(`${label} resolves outside the project through a symbolic link.`);
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
  if (!isInside(projectRoot, resolved)) {
    throw new Error(`${label} must stay inside the project.`);
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

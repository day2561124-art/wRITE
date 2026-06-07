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
  drafts: path.join(projectRoot, "data", "outputs", "drafts"),
  proofReports: path.join(projectRoot, "data", "outputs", "proof_reports"),
  settlementProposals: path.join(projectRoot, "data", "outputs", "settlement_proposals"),
  compressedRuleCandidates: path.join(projectRoot, "data", "outputs", "compressed_rule_candidates"),
  visualDb: path.join(projectRoot, "data", "visual_db"),
  visualAssets: path.join(projectRoot, "data", "visual_db", "assets"),
  visualIndex: path.join(projectRoot, "data", "visual_db", "visual_index.jsonl"),
  activeEngine: path.join(projectRoot, "data", "canon_db", "active_engine.md"),
  engineVersions: path.join(projectRoot, "data", "canon_db", "versions"),
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

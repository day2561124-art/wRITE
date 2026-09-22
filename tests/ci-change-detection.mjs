import { spawn } from "node:child_process";
import path from "node:path";

const SHA1_PATTERN = /^[a-f0-9]{40}$/iu;

export function normalizeCiProjectPath(value) {
  return String(value ?? "")
    .replaceAll("\\", "/")
    .replace(/^\.\//u, "")
    .replace(/\/{2,}/gu, "/");
}

export function requireGitSha(value, label = "commit") {
  const normalized = String(value ?? "").trim();
  if (!SHA1_PATTERN.test(normalized)) {
    throw new Error(`Invalid ${label} SHA: ${normalized || "<empty>"}`);
  }
  return normalized.toLowerCase();
}

export function parseNameStatusZ(output) {
  const tokens = String(output ?? "").split("\0");
  const changed = new Set();
  for (let index = 0; index < tokens.length;) {
    const status = tokens[index++];
    if (!status) continue;
    const kind = status[0];
    if (kind === "R" || kind === "C") {
      const from = normalizeCiProjectPath(tokens[index++] ?? "");
      const to = normalizeCiProjectPath(tokens[index++] ?? "");
      if (from) changed.add(from);
      if (to) changed.add(to);
      continue;
    }
    const filePath = normalizeCiProjectPath(tokens[index++] ?? "");
    if (filePath) changed.add(filePath);
  }
  return [...changed].sort();
}

function runGit(projectRoot, args) {
  return new Promise((resolve, reject) => {
    const executable = process.platform === "win32" ? "git.exe" : "git";
    const child = spawn(executable, args, {
      cwd: path.resolve(projectRoot),
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(`git ${args[0] ?? "<unknown>"} failed: ${stderr.trim() || `exit ${code}`}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function collectCiRangeChangeEvidence({
  projectRoot,
  baseSha,
  headSha,
  runAllPath = "tests/run-all.mjs",
} = {}) {
  const base = requireGitSha(baseSha, "base");
  const head = requireGitSha(headSha, "head");
  const nameStatus = await runGit(projectRoot, [
    "--no-pager",
    "-c",
    "core.fsmonitor=false",
    "diff",
    "--name-status",
    "-z",
    "--find-renames=50%",
    base,
    head,
    "--",
  ]);
  const changedPaths = parseNameStatusZ(nameStatus);
  let runAllDiffText;
  if (changedPaths.includes(runAllPath)) {
    runAllDiffText = await runGit(projectRoot, [
      "--no-pager",
      "-c",
      "core.fsmonitor=false",
      "diff",
      "--no-ext-diff",
      "--no-color",
      "--unified=0",
      base,
      head,
      "--",
      runAllPath,
    ]);
  }
  return Object.freeze({
    base_sha: base,
    head_sha: head,
    changed_paths: Object.freeze(changedPaths),
    run_all_diff_text: runAllDiffText,
  });
}

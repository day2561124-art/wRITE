import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { hashExecutionInput } from "./pi-execution-contract.mjs";
import { reviewProposedStandingPolicy, reviewStandingPolicyScope } from "./pi-standing-policy-review.mjs";

const policyIdPattern = /^pi_standing_[a-f0-9]{32}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const maxPolicyBytes = 64 * 1024;

function rejected() {
  return { code: "POLICY_EVIDENCE_UNAVAILABLE", scope_matches: false, execution_authorized: false };
}

async function directory(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) throw new Error("INVALID_POLICY_ROOT");
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("INVALID_POLICY_ROOT");
  return realpath(root);
}

async function readPolicy(file) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxPolicyBytes) throw new Error("INVALID_POLICY_FILE");
  const handle = await open(file, "r");
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino
      || opened.size > maxPolicyBytes) throw new Error("POLICY_FILE_CHANGED");
    const buffer = Buffer.alloc(maxPolicyBytes + 1);
    let total = 0;
    while (total < buffer.length) {
      const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total > maxPolicyBytes) throw new Error("POLICY_FILE_TOO_LARGE");
    const after = await handle.stat();
    if (opened.size !== total || after.size !== total || after.mtimeMs !== opened.mtimeMs
      || after.ctimeMs !== opened.ctimeMs) throw new Error("POLICY_FILE_CHANGED");
    return JSON.parse(buffer.subarray(0, total).toString("utf8"));
  } finally {
    await handle.close();
  }
}

async function isRevoked(file) {
  try {
    // Existence of any revocation entry blocks review, including a damaged
    // record, directory or symlink. Other I/O failures also fail closed.
    await lstat(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

// Review-only host evidence reader. The composition root must independently
// verify the operator-owned ACL and trusted principal provenance. No request
// supplies a root or writes a record. The exact pinned digest is part of the
// proposed evidence; a changed document cannot silently replace it.
export function createStandingPolicyEvidenceReader({ root, clock = Date.now } = {}) {
  return async function reviewEvidence({ policy_id, policy_sha256, principal, workspace, capabilities } = {}) {
    try {
      if (typeof policy_id !== "string" || !policyIdPattern.test(policy_id)
        || typeof policy_sha256 !== "string" || !digestPattern.test(policy_sha256)
        || typeof clock !== "function") return rejected();
      const dir = await directory(root);
      const revocation = path.join(dir, policy_id + ".revocation.json");
      if (await isRevoked(revocation)) return rejected();
      const policy = await readPolicy(path.join(dir, policy_id + ".policy.json"));
      if (policy?.policy_id !== policy_id || !reviewProposedStandingPolicy(policy).valid
        || hashExecutionInput(policy) !== policy_sha256) return rejected();
      const result = reviewStandingPolicyScope({ policy, principal, workspace, capabilities,
        now: clock(), revoked: await isRevoked(revocation) });
      return { ...result, policy_id, policy_sha256 };
    } catch {
      return rejected();
    }
  };
}

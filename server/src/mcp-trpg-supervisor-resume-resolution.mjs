import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export const TRPG_RESUME_KIND = "trpg_supervisor_ready_observed_20261120";
export const TRPG_RESUME_TOOL = "pi.journal.resolve_trpg_supervisor_resume";
export const TRPG_RESUME_RESULT = Object.freeze({
  outcome: "supervisor_ready_observed_verification_unknown",
  reconciliation_required: false,
  supervisor_ready_observed: true,
  shell_exit_code_observed: false,
  draft_bridge_verified: false,
});

const parentId = "dev_operation_d11a295a8f864caaa4e733ecaf551257";
const childId = "dev_operation_7d331e6fcd994db98a23a25f83a16483";
const workspace = "dev_workspace_shared_repository_v1";
const fingerprint = "c396dd9e7eb6a35d725c556b89e91b2f90d7da5ed953cb16106264198bd086c3";
const commandHash = "9963d85948759b454958c32bd44374b2215399f3edb33822420c14500d74eb3d";
const logHash = "e43a2ea93ab42d968f01a748ad551520478677278b50eb5e5a2f329de8386eb6";
const logName = "host-ae3aae9551646cc9-1795178769673-4b95eee7-15e6-4d19-a377-c9ee6e385f20-0000.jsonl";
const streamPrefix = "formal-trpg-startup.ca7c2e07-202c-42e0-adaf-6521a142ac8d";
const beforeLaunch = Date.parse("2026-11-20T12:46:05.748Z");
const supervisorStart = "2026-11-20T12:46:09.682Z";
const ready = "2026-11-20T12:46:13.832Z";
const stoppedPiHash = "dc7ea72ceec9a62271ac2ad3e864740ad5f37d4b8c70852291ce8b3e9233631d";
const pins = [
  [66016, "969fe1bb96195f87eac6014cfedacb5f8f68fe0a96dee61c97c9823628cabe5b"],
  [66017, "2db87c96a383da3ef54e785dee4ef8a6ef751c9195691a2199ed7164b4ae5816"],
  [66018, "e8403e182243d7fee241cef905db5240bd25a3c1d44e7f71e6cac6e2630a11d4"],
  [66035, "f8c2e2174b9efe69d9712f9776d60594a98495305eddbeaf956709c82a9ffedf"],
  [66036, "dc854cc8a5f9a52bf9cd461e5197f9f93b923b35e422fe57b34fb5f728852278"],
];

function unsafe() { throw new Error("UNSAFE_TRPG_SUPERVISOR_RESUME_RESOLUTION"); }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

export function trpgResumeProofs() {
  return [[childId, pins[3][1], null], [parentId, pins[4][1], fingerprint]]
    .map(([operation_id, expected_terminal_hash, request_fingerprint_sha256]) => ({
      resolution_kind: TRPG_RESUME_KIND, operation_id, expected_terminal_hash, request_fingerprint_sha256,
      decision_owner: "GPT", decision_id: "gpt-trpg-supervisor-resume-20261120",
      reason: "The supervisor log records READY. The original shell exit and exact draft bridge result remain unknown.",
      supervisor_log_sha256: logHash,
    }));
}

export function validateTrpgResumeResolution(events, proof, { requireChildReceipt = true } = {}) {
  const expected = trpgResumeProofs().find(item => item.operation_id === proof?.operation_id);
  if (!expected || Object.keys(proof).length !== Object.keys(expected).length
    || Object.entries(expected).some(([key, value]) => proof[key] !== value)) unsafe();
  const [claim, parent, child, childEnd, parentEnd] = pins.map(([sequence, hash]) =>
    events.find(event => event.sequence === sequence && event.event_hash === hash));
  if (!claim || !parent || !child || !childEnd || !parentEnd
    || parent.operation_id !== parentId || child.operation_id !== childId
    || parent.request_fingerprint_sha256 !== fingerprint || parent.parent_operation_id !== null
    || child.parent_operation_id !== parentId || child.result.command_sha256 !== commandHash || child.result.elevated !== false
    || [parent, child].some(event => event.stage !== "operation_started")
    || [parent, child, childEnd, parentEnd].some(event => event.tool_name !== "powershell_run" || event.workspace_id !== workspace || event.workstream_id !== null)) unsafe();
  for (const [started, terminal] of [[parent, parentEnd], [child, childEnd]]) {
    if (terminal.stage !== "operation_recovered" || terminal.operation_id !== started.operation_id
      || terminal.reconciles_event_id !== started.journal_event_id
      || terminal.result?.outcome !== "ambiguous_effect" || terminal.result?.reconciliation_required !== true) unsafe();
  }
  const projection = claim.execution_projection;
  const action = projection?.intent?.requested_actions?.find(item => item.step_id === "run");
  const final = events.findLast(event => event.execution_projection?.state?.operation_id === projection?.state?.operation_id);
  if (projection?.command?.type !== "tool_call_started" || projection.runtime?.active_call?.idempotency_key !== parent.reconciliation_key
    || projection.runtime.owner?.pid !== child.diagnostic.owner_pid || projection.runtime.owner?.hostname !== child.diagnostic.hostname
    || action?.capability !== "host.powershell" || typeof action.input?.command !== "string" || sha256(action.input.command) !== commandHash
    || final?.event_hash !== stoppedPiHash || final.execution_projection.state.status !== "DECISION_REQUIRED"
    || final.execution_projection.runtime.owner !== null
    || events.some(event => event.stage === "operation_started" && event.operation_type !== "pi_terminal_resolution"
      && (event.parent_operation_id === childId || event.parent_operation_id === parentId && event !== child))) unsafe();
  if (requireChildReceipt && proof.operation_id === parentId && !events.some(event => event.stage === "operation_completed"
    && event.tool_name === TRPG_RESUME_TOOL && event.parent_operation_id === childId
    && event.reconciles_event_id === childEnd.journal_event_id)) unsafe();
  return { started: proof.operation_id === parentId ? parent : child,
    terminal: proof.operation_id === parentId ? parentEnd : childEnd, owners: [claim, parent, child] };
}

export async function verifyTrpgResumeEvidence(root = "E:/TRPG") {
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) unsafe();
  async function regularFile(segments, limit) {
    let file = path.resolve(root);
    for (const segment of segments.slice(0, -1)) {
      file = path.join(file, segment);
      const info = await lstat(file);
      if (!info.isDirectory() || info.isSymbolicLink()) unsafe();
    }
    file = path.join(file, segments.at(-1));
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > limit) unsafe();
    return { file, info };
  }
  const { file } = await regularFile(["logs", "windows", logName], 1024);
  const bytes = await readFile(file);
  if (sha256(bytes) !== logHash) unsafe();
  const records = bytes.toString("utf8").trimEnd().split(/\r?\n/u).map(line => JSON.parse(line));
  if (records.length !== 3 || records[0].event !== "SUPERVISOR_START" || records[0].at !== supervisorStart
    || records[1].event !== "CHILD_START" || records[2].event !== "READY" || records[2].at !== ready) unsafe();
  for (const stream of ["stdout", "stderr"]) {
    const { info } = await regularFile(["work", `${streamPrefix}.${stream}.log`], 4096);
    if (info.birthtimeMs < beforeLaunch || info.birthtimeMs > Date.parse(supervisorStart)) unsafe();
  }
}

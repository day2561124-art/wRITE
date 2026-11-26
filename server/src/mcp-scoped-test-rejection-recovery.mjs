// Read-only proof for the one reviewed R10 scoped-test rejection.
// Exact event pins are evidence, not authority. Journal verification must
// validate the actual event chain before calling this function.
import {createHash} from "node:crypto";
import {lstat,readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {fingerprintMcpMutationRequest} from "./mcp-operation-reconciliation-context.mjs";

export const SCOPED_TEST_REJECTION_KIND="reviewed_scoped_test_rejection_v1";
export const SCOPED_TEST_REJECTION_TOOL="pi.journal.resolve_scoped_test_rejection";
export const REVIEWED_SCOPED_TEST_REJECTION=Object.freeze({
  operation_id:"dev_operation_7f4ff7eec937457d96a2ef2cd0128d93",
  start_hash:"f3f6ce8e834e4e14343e6f97685a56c624f365d2fdeec12811651b2ceed4138a",
  terminal_hash:"79658d3907c84157ad0f006386d5dc835d2cd7ab07de5b2f4c7260168be578e1",
  claim_hash:"43df6d447f749f1ef710f073943421a024aeecf973f1ba17332bb9586249da81",
  receipt_hash:"4fce452dbc3c78bda031224a5dfbb2fb77301b2c147c17037ece7d4bab60d10e",
  fingerprint:"9348235f275a50ec188ceee771a3ce39bf57665867190ec8c5f3e92cae754281",
  runtime_commit:"c32b311327f9294b014a166f388cc931b82984d2",
  source_blob:"3a64ce8cc8ebc32090cae8b6216abdbd596e2edf",
  error:"Use workspace.powershell_isolated to test under the scoped dispatcher.",
});
const fail=()=>{throw Object.assign(new Error("UNSAFE_SCOPED_TEST_REJECTION_RESOLUTION"),{code:"UNSAFE_SCOPED_TEST_REJECTION_RESOLUTION"});};
export function validateScopedTestRejectionResolution(events,input){
  const p=REVIEWED_SCOPED_TEST_REJECTION;
  const exact=["resolution_kind","operation_id","expected_terminal_hash","request_fingerprint_sha256","decision_owner","decision_id","reason"].sort().join(",");
  if(!input||Object.keys(input).sort().join(",")!==exact
    ||input.resolution_kind!==SCOPED_TEST_REJECTION_KIND||input.operation_id!==p.operation_id
    ||input.expected_terminal_hash!==p.terminal_hash||input.request_fingerprint_sha256!==p.fingerprint
    ||input.decision_owner!=="GPT"||!/^gpt-[A-Za-z0-9._:-]{1,120}$/u.test(input.decision_id??"")
    ||typeof input.reason!=="string"||!input.reason.trim()||input.reason.length>1024)fail();
  const one=hash=>{const hits=events.filter(e=>e.event_hash===hash);if(hits.length!==1)fail();return hits[0];};
  const started=one(p.start_hash),terminal=one(p.terminal_hash),claim=one(p.claim_hash),receipt=one(p.receipt_hash);
  const c=claim.execution_projection,r=receipt.execution_projection;
  const call=c?.runtime?.active_call,action=c?.intent?.requested_actions?.find(a=>a.step_id===call?.step_id);
  const error=r?.command?.receipt;
  if(events.filter(e=>e.operation_id===p.operation_id).length!==2
    ||[started,terminal].some(e=>e.operation_id!==p.operation_id||e.operation_type!=="mcp_mutation"
      ||e.tool_name!=="dev_run_tests"||e.request_fingerprint_sha256!==p.fingerprint||e.targets?.length!==0
      ||e.parent_operation_id!==null||e.workspace_id!==started.workspace_id||e.workstream_id!==started.workstream_id
      ||e.reconciliation_key!==started.reconciliation_key||e.diagnostic?.hostname!==started.diagnostic?.hostname
      ||e.diagnostic?.owner_pid!==started.diagnostic?.owner_pid)
    ||started.stage!=="operation_started"||terminal.stage!=="operation_failed"
    ||terminal.result?.outcome!=="ambiguous_effect"||terminal.result?.reconciliation_required!==true
    ||events.some(e=>e.parent_operation_id===p.operation_id&&e.stage==="operation_started"&&e.operation_type!=="pi_terminal_resolution")
    ||claim.sequence!==started.sequence-1||terminal.sequence!==started.sequence+1||receipt.sequence!==terminal.sequence+2
    ||[claim,receipt].some(e=>e.stage!=="operation_completed"||e.operation_type!=="pi_execution_projection"
      ||e.workspace_id!==started.workspace_id||e.workstream_id!==started.workstream_id)
    ||c?.command?.type!=="tool_call_started"||call?.mutation!==true||call?.step_id!=="focused-test"
    ||call?.idempotency_key!==started.reconciliation_key||c.runtime.owner?.hostname!==started.diagnostic.hostname
    ||c.runtime.owner?.pid!==started.diagnostic.owner_pid||action?.capability!=="verification.focused"
    ||action?.idempotency_key!==started.reconciliation_key||action?.input?.suite!=="mcp_pi_postseal"
    ||fingerprintMcpMutationRequest("dev_run_tests",{...action.input,workspace_id:started.workspace_id})!==p.fingerprint
    ||r?.previous_projection_hash!==c?.projection_hash||r?.revision!==c?.revision+1
    ||r?.state?.operation_id!==c?.state?.operation_id||r?.state?.status!=="DECISION_REQUIRED"
    ||r?.state?.completed_steps?.length!==0||r?.runtime?.owner!==null||r?.runtime?.active_call!==null
    ||r?.command?.type!=="decision_requested"||r?.command?.code!=="TOOL_REPORTED_FAILURE"
    ||error?.step_id!==call.step_id||error?.input_hash!==call.input_hash||error?.original_response_available!==true
    ||error?.evidence?.isError!==true||error.evidence._meta?.operation_id!==p.operation_id
    ||error.evidence._meta?.reconciliation_key!==started.reconciliation_key
    ||error.evidence.content?.length!==1||error.evidence.content[0]?.type!=="text"
    ||error.evidence.content[0]?.text!==p.error)fail();
  return {started,terminal,claim,receipt};
}

// For the trusted-host inspector only. The source path is a fixed sibling
// of the installed reader's release directory, never supplied by the caller.
// Do not require old release files for historical decoding after recovery.
export async function inspectReviewedScopedTestSource(){
  const p=REVIEWED_SCOPED_TEST_REJECTION;
  const releases=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../..");
  if(process.platform!=="win32"||path.basename(releases)!=="releases")fail();
  let current=releases;
  for(const part of [p.runtime_commit,"server","src","mcp-development-test-tools.mjs"]){
    current=path.join(current,part);const s=await lstat(current);
    if(s.isSymbolicLink()||(part.endsWith(".mjs")?(!s.isFile()||s.size>1024*1024):!s.isDirectory()))fail();
  }
  const bytes=await readFile(current);
  const blob=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
  if(blob!==p.source_blob)fail();
  return {runtime_commit:p.runtime_commit,source_blob:blob};
}

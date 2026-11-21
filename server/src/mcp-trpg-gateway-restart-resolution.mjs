export const restartResolutionKind = "trpg_test_gateway_restart_observed_20261115";
export const restartResolutionTool = "pi.journal.resolve_trpg_test_gateway_restart";
export const restartOutcome = "interrupted_restart_observed_zip_receipt_missing";
export const restartParentId = "dev_operation_7116cb6cd8c64bcc971895e775dfb50c";
export const restartChildId = "dev_operation_901d4554cbe442ffa66c37cf421f5efb";
const workspace = "dev_workspace_shared_repository_v1";
const pins = [
  [65335, "df36dce8832c3bb596bb199c896e26ffb22479cbcf31f640515160725c002776"],
  [65336, "f898444ccffbc99fa3e5dd96b0bc183619275af0bf20b52cce9a3520c51be1aa"],
  [65527, "c9bb50a4bd6a7f27e6d009e35ec3da3d8b552914eb9d2be97ff94836d6000a1e"],
  [65528, "01713fa5952260fd9a095f80f0002b7ebd452b5448fe76a0b5bb66d0c75e2129"],
];
const fail = () => { throw Error("UNSAFE_TRPG_GATEWAY_JOURNAL_RECOVERY"); };

export function restartFacts(events) {
  const [parent, child, childEnd, parentEnd] = pins.map(([seq, hash]) =>
    events.find(e => e.sequence === seq && e.event_hash === hash));
  if (!parent || !child || !childEnd || !parentEnd
    || parent.operation_id !== restartParentId || parentEnd.operation_id !== restartParentId
    || child.operation_id !== restartChildId || childEnd.operation_id !== restartChildId
    || parent.stage !== "operation_started" || child.stage !== "operation_started"
    || parent.operation_type !== "mcp_mutation" || child.operation_type !== "powershell_maintenance"
    || parent.parent_operation_id !== null || parentEnd.parent_operation_id !== null
    || child.parent_operation_id !== restartParentId || childEnd.parent_operation_id !== restartParentId
    || child.result.command_sha256 !== "26bdc9dbd639be758a569c875b065a7b1a7fc76250ebf492e5300da526f9476f"
    || child.result.elevated !== false || [parent, child, childEnd, parentEnd].some(e =>
      e.tool_name !== "powershell_run" || e.workspace_id !== workspace || e.workstream_id !== null)
    || [childEnd, parentEnd].some(e => e.stage !== "operation_recovered"
      || e.result?.outcome !== "ambiguous_effect" || e.result.reconciliation_required !== true)
    || events.some(e => e.stage === "operation_started"
      && (e.parent_operation_id === restartChildId
        || e.parent_operation_id === restartParentId && e !== child && e.tool_name !== restartResolutionTool)))
    fail();
  return { parent, child, childEnd, parentEnd };
}

export function validateRestartProof(proof) {
  if (!proof || Object.keys(proof).sort().join(",") !== "evidence_sha256,resolution_kind"
    || proof.resolution_kind !== restartResolutionKind || !/^[a-f0-9]{64}$/u.test(proof.evidence_sha256))
    fail();
}

export function validateRestartResolution({ events, admission, receipt, proofText, proofHash }) {
  const { parent, parentEnd } = restartFacts(events);
  for (const e of [admission, receipt]) {
    if (!e || e.operation_type !== "pi_terminal_resolution" || e.tool_name !== restartResolutionTool
      || e.workspace_id !== workspace || e.workstream_id !== null
      || e.parent_operation_id !== parent.operation_id || e.reconciliation_key !== "resolution:" + parent.operation_id
      || e.request_fingerprint_sha256 !== proofHash || e.result?.resolution_record !== proofText) fail();
  }
  if (admission.sequence <= parentEnd.sequence || receipt.sequence <= admission.sequence
    || receipt.reconciles_event_id !== parentEnd.journal_event_id
    || receipt.result.outcome !== restartOutcome || receipt.result.reconciliation_required !== false
    || receipt.result.shell_exit_code_observed !== false || receipt.result.zip_gate_verified !== false
    || Object.hasOwn(receipt.result, "exit_code")) fail();
}

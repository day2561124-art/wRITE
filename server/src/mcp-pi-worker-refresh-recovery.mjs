export const REVIEWED_PI_WORKER_REFRESH = Object.freeze({
 operation_id:'dev_operation_ec75ecf96d71488ab3bb6fff76d00e80',
 start_hash:'9a0b6c3f970c6e28bd58bc240c11ee103cbbb9406fa0dc8cae766aa2378b1027',
 terminal_hash:'6a67edfa1a78366dbb46346a0c1aede4f5af0119cfb86fb000e3eab9692655a2',
 child_id:'dev_operation_d285577c1fc046c3b3082e558712b972',
 child_start_hash:'b86031c3837464a921e66c4a7d27452d82413f4352553c561b7c3077aa3c3cb2',
 child_terminal_hash:'7566d6a15510847af9def3045351fd406e7a4f7ca89b774a0f9f48e9605b3293',
 command_sha256:'cdecfc45609c7182f5a13e2ad8ac3d5e96c1c9f51877dbb6e156a29342efd4bd',
 fingerprint:'cfa9afbb0b40e0b7e6fc85d0e2e41bdb8526f375d4134825a2252d6123e2bb44',
 pi_hash:'9b6becd3bcd9a942b69c14c8c9d78d783c12ae3e51980ba99460f990d1f6d3e0',
 pi_id:'pi_operation_5096ba4c9e1f4c06a1f4806d5a5b0408',
 helper_sha256:'03eb3d7045915e02d3976d7f983b741b9f7b174d3127f38b8fe755e275656fd1',
 receipt_sha256:'5791faecaa9b36946f9d62517b5c03983eca4ddb9049bded4e954bcc9d9d7a6c',
 helper_pid:13264,
});
export const reviewedPiWorkerRefreshResult = Object.freeze({
 observed_effect:'maintenance_helper_staged_then_exited_without_worker_restart',
 worker_restarted:false,
 shell_timed_out:true,
});
export function isReviewedPiWorkerRefresh(events,started,terminal,child,done,input) {
 const p=REVIEWED_PI_WORKER_REFRESH;
 const decision=events.find(e=>e.event_hash===p.pi_hash);
 const projection=decision?.execution_projection;
 return input.operation_id===p.operation_id&&started?.event_hash===p.start_hash&&terminal?.event_hash===p.terminal_hash
  &&child?.operation_id===p.child_id&&child?.event_hash===p.child_start_hash&&done?.event_hash===p.child_terminal_hash
  &&input.expected_terminal_hash===p.terminal_hash&&input.expected_child_terminal_hash===p.child_terminal_hash
  &&input.expected_command_sha256===p.command_sha256&&input.request_fingerprint_sha256===p.fingerprint
  &&done.result?.command_sha256===p.command_sha256&&done.result.timed_out===true
  &&done.result.execution_ok===true&&done.result.ok===false&&done.result.exit_code===0&&input.observed_exit_code===0
  &&decision?.stage==='operation_completed'&&decision.operation_type==='pi_execution_projection'
  &&decision.sequence>child.sequence&&decision.sequence<done.sequence&&done.sequence<terminal.sequence
  &&projection?.state?.operation_id===p.pi_id&&projection.state.status==='DECISION_REQUIRED'
  &&projection.state.last_error?.code==='RECONCILIATION_RETRY_EXHAUSTED'
  &&projection.runtime?.owner===null;
}

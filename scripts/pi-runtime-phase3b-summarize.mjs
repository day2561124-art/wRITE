// Offline audit of actual formal MCP responses; never submits or resumes an intent.
import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createExecutionIntent, hashExecutionInput, validateOperationState} from '../server/src/pi-execution-contract.mjs';

const root = new URL('../', import.meta.url);
const read = async name => JSON.parse((await readFile(new URL(name, root), 'utf8')).replace(/^\uFEFF/, ''));
const capturePath = 'tests/.tmp/pi-pressure-evidence/phase3b-local-status.json';
const capture = await read(capturePath);
const previous = await read('docs/PI-RUNTIME-PRESSURE-PHASE3.evidence.json');
const processes = await read('tests/.tmp/pi-pressure-evidence/phase3b-process-probe.json');
const decode = name => {
  const call = capture.calls.find(row => row.name === name);
  assert.equal(call.ok, true);
  assert.notEqual(call.response.isError, true);
  return JSON.parse(call.response.content.find(row => row.type === 'text').text);
};
const status = decode('dev_pi_execution_status');
const journal = decode('dev_workspace_journal_status');
const checkpoint = decode('dev_workspace_checkpoint_status');
const original = createExecutionIntent(previous.submitted_live_intent);
assert.deepEqual(status.operation.intent, original);
const state = validateOperationState(status.operation.state);
assert.equal(state.intent_hash, hashExecutionInput(original));
assert.equal(state.operation_id, capture.operation_id);
assert.equal(state.intent_id, capture.intent_id);
assert.equal(state.status, 'PREPARING');
assert.equal(state.completed_at, null);
assert.deepEqual(state.tool_calls, []);
assert.deepEqual(state.tool_results, []);
assert.deepEqual(status.operation.receipts, []);
assert.equal(status.operation.runtime.active_call, null);
assert.equal(status.operation.runtime.lifecycle_binding, null);
assert.equal(state.checkpoint, null);
assert.equal(status.route.mode, 'pi_default');
assert.equal(journal.health, 'healthy');
assert.equal(journal.chain_verified, true);
assert.equal(journal.dangling_operation_count, 0);
assert.equal(checkpoint.health, 'healthy');
assert.equal(journal.latest_event_hash, status.operation.journal_receipt.event_hash);
assert.equal(journal.latest_sequence, status.operation.journal_receipt.sequence);
assert.equal(capture.mutations_submitted, 0);
// A known live HTTP parent is the positive control: sandbox process visibility
// alone cannot establish that the recorded owner is absent on the host.
assert.equal(processes.find(row => row.pid === capture.health[0].value.pid)?.exists, true);
assert.equal(processes.find(row => row.pid === status.operation.runtime.owner.pid)?.exists, false);
assert.equal(processes.find(row => row.pid === capture.readiness[0].child_pid)?.exists, false);
const firstReady = capture.readiness.findIndex(row => row.ready === true);
assert.ok(firstReady > 0);
// The call starts after connect, so any sample earlier than its measured duration
// is conservatively before this call finishes, without subtracting UTC clocks.
const readyPending = capture.readiness.filter(row => row.ready === true && row.pending_calls === 1
  && row.elapsed_ms < capture.calls[0].duration_ms);
const tap = await readFile(new URL('tests/.tmp/pi-pressure-evidence/phase3b-focused.tap', root), 'utf8').catch(() => '');
const count = name => Number(tap.match(new RegExp(`^(?:#|ℹ) ${name} (\\d+)\\r?$`, 'm'))?.[1] ?? 0);
const evidence = {
  schema_version: 1,
  phase: '3B',
  generated_at_utc: new Date().toISOString(),
  baseline_commit: '9c4b94bf1528e802fd2207ba24d62fbe893b8868',
  branch: 'codex/pi-runtime-pressure-phase1',
  worktree: 'E:\\武裝學院的二三事\\.runtime-phase1',
  lease: {start_utc: '2026-10-08T14:14:40Z', deadline_utc: '2026-10-08T14:39:40Z'},
  ownership: {candidate_clean_at_start: true, main_head: 'fcfba25de3fc521ea73e326d190ab358ee58d513',
    active_workstreams_observed: 7, shared_journal_owner: 'Pi Continuation', reliable_store_owner: 'UER',
    conflicting_files_modified: false, production_routing_changed: false},
  verification_levels: {original_local_http_status: 'verified', original_terminal_result: 'unknown',
    original_recovery_closure: 'blocked', http_504_attribution: 'partial',
    local_live_powershell: 'not tested', chatgpt_product_e2e: 'blocked',
    new_fault_injection: 'not tested', full_journal_cost_baseline: 'not tested'},
  authoritative_original_operation: {
    intent_id: state.intent_id, operation_id: state.operation_id, intent_hash: state.intent_hash,
    exact_submitted_intent: previous.submitted_live_intent,
    http_request_correlation_id: null,
    correlation_boundary: 'Intent, operation, projection and Journal IDs correlate durable state. Original external HTTP trace ID unavailable; candidate tracing is not deployed.',
    formal_status: state.status, revision: status.operation.revision, terminal_state: 'UNKNOWN',
    recovery_acceptance: 'BLOCKED', last_updated_at_utc: state.updated_at,
    full_formal_status_response: status,
    capability_mutation_observation: 'No dispatched capability, active call, receipt, tool result or lifecycle binding in validated state. Durable Pi admission/projection Journal writes did occur. No PowerShell was requested by this original bootstrap intent.',
    safe_resume_preconditions: 'Fresh formal status and host-owner liveness; full original history/receipt reconciliation by Pi; unchanged exact contract and idempotency keys; unchanged routing/context; caller/session lifetime retained through durable outcome.',
    blocker: 'Original operation is nonterminal; recorded owner absent; no resumed or terminal live result. Prior HTTP 504 does not establish operation failure.'
  },
  process_probe: {method: 'read-only elevated Win32_Process query; live HTTP parent positive control', observations: processes},
  health: {journal, checkpoint, warning: 'Journal active/dangling counts describe journal operations; zero does not make the logical Pi PREPARING operation terminal.'},
  latency: {
    boundary: 'SDK caller on same host through existing loopback HTTP/MCP; not ChatGPT end-to-end',
    clock: 'performance.now() for call and poll elapsed; readiness UTC timestamps are metadata only',
    calls: capture.calls.map(row => ({name: row.name, count: 1, success_count: row.ok ? 1 : 0,
      success_rate: row.ok ? 1 : 0, p50_ms: row.duration_ms, p95_ms: row.duration_ms, max_ms: row.duration_ms,
      percentile_warning: 'One observation; descriptive singleton statistics, no population inference', started_utc: row.started_utc})),
    sdk_connect_ms: capture.connect_ms,
    readiness_monotonic_observation: {origin: 'SDK connect start; not status call start',
      last_not_ready_elapsed_ms: capture.readiness[firstReady - 1].elapsed_ms,
      first_ready_elapsed_ms: capture.readiness[firstReady].elapsed_ms,
      pending_status_at_first_ready: capture.readiness[firstReady].pending_calls,
      continuing_ready_pending_span_ms: readyPending.at(-1).elapsed_ms - readyPending[0].elapsed_ms,
      span_boundary: 'First ready sample through last ready sample before status completed (126532ms); this proves waiting after readiness, not its internal source.'},
    unknown_stages: ['external HTTP admission/queue', 'gateway timeout emitter and limit', 'original connector session ID/lifecycle',
      'Pi status lookup vs hash validation', 'Checkpoint lock wait', 'Journal persistence/lock wait', 'response serialization/return'],
    powershell_execution: 'not applicable: status read; original intent contains workspace bootstrap only',
    concurrency: 'not tested; no additional load placed on active shared engineering',
    before_after: 'not applicable: no runtime performance fix or deployment this lease'
  },
  http_504: {
    connector_status_read: {outcome: 'HTTP 504', error_class: 'MCP client transport unexpected server response',
      exact_error: 'unexpected server response: HTTP 504: error code: 504', duration_ms: null, headers_available: false, request_correlation_id: null},
    emitter: 'UNKNOWN', exceeding_layer: 'UNKNOWN',
    evidence: ['Existing local HTTP parent /health and /live returned 200.',
      'Same original Pi status query succeeded locally after 128700.8791ms, with child readiness preceding completion.',
      'Reviewed HTTP server/adapter source has no explicit 504 emitter; upstream proxy/connector origin remains inference only.',
      'Session transport close invokes bridge close, which terminates its owned stdio child. This establishes session-worker coupling in source, not that the original 504 closed its session.'],
    unresolved: 'Need original external request correlation ID, actual gateway config/headers/logs and original session-close events to attribute 504. Do not add independent stage durations or assume request timeout kills worker.'
  },
  changes: ['scripts/pi-runtime-phase3b-live-status.mjs', 'scripts/pi-runtime-phase3b-summarize.mjs',
    'docs/PI-RUNTIME-PRESSURE-PHASE3B.md', 'docs/PI-RUNTIME-PRESSURE-PHASE3B.evidence.json'],
  runtime_source_modified: false,
  evidence_audit: 'passed: official immutable ExecutionIntent / state validation, exact hash/identity, no dispatch, healthy chain/receipt lineage, unchanged pi_default, positive-control host liveness',
  tests: {command: 'node --test tests/mcp/pi-execution-contract.test.mjs tests/mcp/pi-production-execution.test.mjs tests/mcp/mcp-http-reliability.test.mjs tests/mcp/mcp-request-tracing.test.mjs',
    tests: count('tests'), passed: count('pass'), failed: count('fail'),
    scope: 'isolated regression; cannot substitute for original live recovery or live PowerShell',
    raw_tap_sha256: createHash('sha256').update(tap).digest('hex'), raw_tap: tap},
  local_status_capture: capture,
  git: {diff_check: 'passed: staged diff checked; repeated before candidate commit', commit_sha: 'see commit containing this evidence; a commit cannot embed its own SHA'},
  next_action: 'Re-query the SAME pi_operation_ab4776c172b84bfa921ee99117a6728d via official status. Have Pi validate absent owner and reconcile exact history/receipts, then resume ONLY phase3-live-bootstrap-20261008-2146 with its original contract/idempotency keys in an owned session retained through durable completion. Never create replacement bootstrap. Obtain original gateway/session correlation to diagnose 504; only after terminal reconciliation and owned workspace binding proceed to live PowerShell E2E.'
};
await writeFile(new URL('docs/PI-RUNTIME-PRESSURE-PHASE3B.evidence.json', root), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({audit: evidence.evidence_audit, formal_status: state.status,
  tests: {passed: evidence.tests.passed, failed: evidence.tests.failed}}, null, 2));

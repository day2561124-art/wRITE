import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createExecutionIntent,hashExecutionInput,validateOperationState} from '../server/src/pi-execution-contract.mjs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const read=async name=>JSON.parse((await readFile(new URL(name,root),'utf8')).replace(/^\uFEFF/,''));
const tmp='tests/.tmp/pi-pressure-evidence/';
const initial=await read(tmp+'phase3c-local-status.json');
const recovery=await read(tmp+'phase3c-live-recovery.json');
const fixture=await read(tmp+'phase3c-status-fixture.json');
const processes=await read(tmp+'phase3c-process-probe.json');
const post=await read(tmp+'phase3c-post-timeout-status.json').catch(()=>null);
const tap=await readFile(new URL(tmp+'phase3c-final.tap',root),'utf8');
const beforeTimer=await readFile(new URL(tmp+'phase3c-timer-before.txt',root),'utf8');
const count=name=>Number(tap.match(new RegExp(`^(?:#|ℹ) ${name} (\\d+)\\r?$`,'m'))?.[1]??0);
const decode=call=>JSON.parse(call.response.content.find(row=>row.type==='text').text);
const prior=decode(initial.calls[0]).operation;
assert.equal(prior.state.operation_id,recovery.operation_id);
assert.equal(prior.state.intent_hash,hashExecutionInput(createExecutionIntent(prior.intent)));
assert.equal(recovery.mutation_submissions,1);assert.equal(recovery.replacement_intents,0);
assert.equal(fixture.exact_result_equality,true);
const formalPost=post?.calls[0]?.ok?decode(post.calls[0]):null;
if(formalPost){validateOperationState(formalPost.operation.state);
  assert.equal(formalPost.operation.state.intent_hash,prior.state.intent_hash);}
const base=new URL('../data/outputs/logs/development_runtime/operation-journal/',root);
const head=await read('..'+ '/data/outputs/logs/development_runtime/operation-journal/head.json');
const localEvents=[];
for(const name of (await readdir(new URL('events/',base))).filter(n=>/^0000000513(5[5-9]|[6-9][0-9])/.test(n)).sort()){
  const event=JSON.parse(await readFile(new URL('events/'+name,base),'utf8'));
  if(event.result?.intent_id===recovery.intent_id)localEvents.push(event);
}
const result={schema_version:1,phase:'3C',baseline_commit:'a88f09d7344f0b624b2cc39fef1a070f3d271a3c',
  generated_at_utc:new Date().toISOString(),lease:{start_utc:'2026-10-08T14:42:28Z',deadline_utc:'2026-10-08T15:07:28Z'},
  closure_round:{start_utc:'2026-10-08T16:28:32Z',scope:'Finish existing regressions, diff-check and candidate commit only',
    latest_user_constraint:'No resubmit, resume or replacement intent; original live operation may only be inspected read-only.'},
  branch:'codex/pi-runtime-pressure-phase1',candidate_clean_at_start:true,
  ownership:{active_workstreams:7,journal_owner:'Pi Continuation',reliable_store_owner:'UER',conflicting_files_modified:false},
  original_operation:{operation_id:recovery.operation_id,intent_id:recovery.intent_id,intent_hash:recovery.intent_hash,
    exact_intent:prior.intent,initial_status:prior.state.status,initial_revision:prior.revision,
    recovery_gate:'Verified exact durable contract/state, healthy chain, absent owner with host positive control, both original keys formally not_admitted/reinitiate_requires_same_key; Pi rechecks fencing and CAS.',
    resume_attempts:1,replacement_intents:0,result:'UNKNOWN',recovery_closure:'BLOCKED',
    authoritative_post_status:formalPost,last_formal_status:formalPost?.operation.state.status??prior.state.status,
    warning:'If post query is incomplete, last formal state predates the resume. Bounded filesystem observations are not terminal authority.',
    local_bounded_history:{head_sequence:head.latest_sequence,events:localEvents,chain_verified_by_this_read:false},
    process_probe:processes,retained_owned_session:recovery.own_session_id,
    mutation_retries_after_timeout:0},
  runtime_fixes:{status:{files:['server/src/pi-production-execution-controller.mjs','server/src/mcp-server.mjs'],
    cause:'Same read-only operation-status request reloaded execution history five times and route history three times; repeated full validation. No request-local snapshot reuse.',
    change:'One fully validated execution snapshot and one validated route history per request; preserved context/enrollment proof and no cross-request caching. Mutation prepare/admission/CAS unchanged.',
    measured_scope:'isolated real-journal controller fixture; no production deployment or live after claim'},
    timer:{file:'server/src/mcp-http-stdio-adapter.mjs',
      cause:'timeoutForRequest selected existing long-tool timeout 28800000ms; registerListener accepted at most1800000ms, so it silently reverted to ordinary 300000ms in the deployed service.',
      change:'Validate listener timeout against the same existing MAX_LONG_TOOL_CALL_TIMEOUT_MS. Existing timeout values/tool allowlist and ordinary status timer unchanged.',
      before_regression_failed:true,before_failure_output:beforeTimer,
      live_evidence:recovery.blocker,executor_after_timeout_present:false,
      boundary:'Live typed error proves actual child-call deadline 300000ms; source mismatch and fail-before/pass-after timer test confirm mechanism. Original external HTTP504 emitter remains unknown.'}},
  latency:{phase3b_live_status_ms:128700.8791,phase3c_reproduced_live_status_ms:initial.calls[0].duration_ms,
    live_scope:'existing deployed loopback HTTP/MCP, not ChatGPT end-to-end',fixture,
    failed_live_journal_reader_probes:{baseline:'CORRUPT_STATE; no successful sample',candidate:'JOURNAL_LOCK_CONTENDED; no successful sample',
      interpretation:'No live before/after latency conclusion. Candidate journal reader differed from active deployed journal reader; shared contention encountered. No shared Journal repair or forced unlock.'},
    unknown_segments:['original HTTP504 emitter/gateway deadline','external queue','complete decomposition of 129965ms','original capability outcome after child-call timeout'],
    no_production_latency_improvement_claim:true},
  verification_levels:{fixture_powershell:'see final regression results',local_live_recovery:'BLOCKED',
    local_live_powershell:'not tested',http_live_powershell:'not tested',chatgpt_product_path:'not verified'},
  health:{initial_journal:decode(initial.calls[1]),initial_checkpoint:decode(initial.calls[2]),
    post_journal:post?.calls[1]?.ok?decode(post.calls[1]):null,post_checkpoint:post?.calls[2]?.ok?decode(post.calls[2]):null,
    warning:'Health/chain verification does not prove the logical Pi operation is terminal.'},
  tests:{command:'node --test tests/mcp/pi-production-status-snapshot.test.mjs tests/mcp/pi-production-execution.test.mjs tests/mcp/pi-execution-contract.test.mjs tests/mcp/mcp-request-tracing.test.mjs tests/mcp/mcp-http-reliability.test.mjs tests/mcp/pi-runtime-pressure.test.mjs tests/mcp/pi-runtime-phase2.test.mjs tests/mcp/pi-runtime-phase3-http.test.mjs',
    total:count('tests'),passed:count('pass'),failed:count('fail'),raw_tap:tap,
    raw_tap_sha256:createHash('sha256').update(tap).digest('hex'),all_suite_run:false},
  live_initial_capture:initial,live_recovery_capture:recovery,post_timeout_capture:post,
  integration_gate:{ready:false,reason:'Original mutation claim has unresolved live outcome; no live Pi PowerShell E2E; candidate fixes not deployed or accepted.'},
  git:{diff_check:'passed: working-tree and staged diff-check; repeated before candidate commit',commit_sha:'see commit containing this evidence'},
  next_action:'STOP after isolated candidate commit. Original operation remains EXECUTING/UNKNOWN: no resubmit, no further resume, no replacement intent. Only read-only status/receipt inspection is currently authorized. Preserve owned session ed450214-ef29-476f-97ff-881d2b622600 pending lifecycle review. Integration Gate remains false; any additional recovery or deployment requires a subsequent explicit engineering decision.'};
await writeFile(new URL('docs/PI-RUNTIME-PRESSURE-PHASE3C.evidence.json',root),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({formal_post_status:formalPost?.operation.state.status,tests:{passed:count('pass'),failed:count('fail')},integration_gate:false},null,2));

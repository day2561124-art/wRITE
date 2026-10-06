import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createDevOperationJournalService,canonicalJson} from '../../server/src/mcp-development-journal-tools.mjs';
async function fixture(child=false){
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-terminal-resolution-'));
 const j=createDevOperationJournalService({storageRoot:path.join(root,'journal')});
 const a=await j.begin({operation_type:'mcp_mutation',tool_name:'dev_create_file',reconciliation_key:'test-create-ambiguous',request_fingerprint_sha256:'a'.repeat(64)});
 if(child){const b=await j.begin({operation_type:'filesystem_create',tool_name:'dev_create_file',parent_operation_id:a.operation_id});await j.complete(b.operation_id);}
 const terminal=await j.fail(a.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
 // Simulate the original process having exited, preserving the hash chain in this fixture only.
 const file=path.join(j.storageRoot,'events',(await readdir(path.join(j.storageRoot,'events'))).at(-1));
 const e=JSON.parse(await readFile(file,'utf8'));e.diagnostic.owner_pid=2147483647;
 const {event_hash,...body}=e;e.event_hash=createHash('sha256').update(canonicalJson(body)).digest('hex');
 await writeFile(file,canonicalJson(e)+'\n');
 await writeFile(path.join(j.storageRoot,'head.json'),JSON.stringify({schema_version:1,latest_sequence:e.sequence,latest_event_id:e.journal_event_id,latest_event_hash:e.event_hash}));
 const reopened=createDevOperationJournalService({storageRoot:j.storageRoot});
 const input={operation_id:a.operation_id,expected_terminal_hash:e.event_hash,request_fingerprint_sha256:'a'.repeat(64),decision_owner:'GPT',decision_id:'gpt-resolution-fixture',reason:'Verified create has no child admission before effects'};
 return {j:reopened,input,file,bytes:await readFile(file,'utf8'),root};
}
test('append-only resolution restores health, preserves original failure and never replays',async()=>{
 const f=await fixture();assert.equal((await f.j.status()).health,'degraded');
 await f.j.resolveNoChildMutation(f.input);assert.equal((await f.j.status()).health,'healthy');
 assert.equal(await readFile(f.file,'utf8'),f.bytes);
 const op=await f.j.getOperation({operation_id:f.input.operation_id});
 assert.equal(op.reconciliation_state,'no_effect');assert.equal(op.automatic_replay_allowed,false);assert.equal(op.reinitiate_requires_new_key,true);
 assert.equal(op.events.at(-1).result.outcome,'ambiguous_effect');
 const j2=createDevOperationJournalService({storageRoot:f.j.storageRoot});const head=(await j2.status()).latest_sequence;
 const duplicate=await j2.resolveNoChildMutation(f.input);assert.equal(duplicate.reconciled,true);assert.equal((await j2.status()).latest_sequence,head);
});
test('any child admission prevents no-effect resolution',async()=>{const f=await fixture(true);await assert.rejects(f.j.resolveNoChildMutation(f.input),/UNSAFE_TERMINAL_RESOLUTION/);assert.equal((await f.j.status()).health,'degraded');});
test('wrong fingerprint, hash or decision owner cannot resolve ambiguity',async()=>{
 const f=await fixture();for(const change of [{request_fingerprint_sha256:'b'.repeat(64)},{expected_terminal_hash:'b'.repeat(64)},{decision_owner:'Pi'}])await assert.rejects(f.j.resolveNoChildMutation({...f.input,...change}),/UNSAFE_TERMINAL_RESOLUTION/);
 assert.equal((await f.j.status()).latest_sequence,2);
});
test('concurrent identical resolutions create exactly one durable pair',async()=>{
 const f=await fixture();const second=createDevOperationJournalService({storageRoot:f.j.storageRoot});
 await Promise.all([f.j.resolveNoChildMutation(f.input),second.resolveNoChildMutation(f.input)]);
 assert.equal((await second.status()).latest_sequence,4);assert.equal((await second.status()).health,'healthy');
});
test('create exception before any child is recorded as no-effect without replay',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-create-no-effect-'));const j=createDevOperationJournalService({storageRoot:path.join(root,'journal')});let calls=0;
 const ctx={reconciliation_key:'create-before-child-error',request_fingerprint_sha256:'c'.repeat(64),tool_name:'dev_create_file'};
 await assert.rejects(j.executeReconciled(ctx,async()=>{calls++;throw Error('validation failure');}),/validation failure/);
 assert.equal((await j.status()).health,'healthy');const replay=await j.executeReconciled(ctx,async()=>{calls++;});
 assert.equal(calls,1);assert.equal(replay.operation.reconciliation_state,'no_effect');
});
test('a live owner cannot be resolved and no event is appended',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-resolution-live-'));const j=createDevOperationJournalService({storageRoot:path.join(root,'journal')});
 const a=await j.begin({operation_type:'mcp_mutation',tool_name:'dev_create_file',reconciliation_key:'live-create-error',request_fingerprint_sha256:'a'.repeat(64)});
 const t=await j.fail(a.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
 await assert.rejects(j.resolveNoChildMutation({operation_id:a.operation_id,expected_terminal_hash:t.event_hash,request_fingerprint_sha256:'a'.repeat(64),decision_owner:'GPT',decision_id:'gpt-live-owner',reason:'Cannot prove owner stopped'}),/RESOLUTION_OWNER_STILL_ACTIVE/);
 assert.equal((await j.status()).latest_sequence,2);
});
test('a changed GPT resolution decision is rejected after successful resolution',async()=>{
 const f=await fixture();await f.j.resolveNoChildMutation(f.input);await assert.rejects(f.j.resolveNoChildMutation({...f.input,decision_id:'gpt-other-resolution'}),/RESOLUTION_DECISION_CONFLICT/);
 assert.equal((await f.j.status()).latest_sequence,4);
});
test('audited pre-child patch error stays healthy and returns stored no-effect on duplicate',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-patch-no-effect-'));const j=createDevOperationJournalService({storageRoot:path.join(root,'journal')});let calls=0;
 const ctx={reconciliation_key:'patch-before-child-error',request_fingerprint_sha256:'d'.repeat(64),tool_name:'dev_apply_patch'};
 await j.executeReconciled(ctx,async()=>{calls++;return {isError:true,content:[{type:'text',text:'oldText was not found'}]};});
 assert.equal((await j.status()).health,'healthy');const result=await j.executeReconciled(ctx,async()=>{calls++;});
 assert.equal(calls,1);assert.equal(result.operation.reconciliation_state,'no_effect');
});
test('other tool errors without child still escalate ambiguity',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-unknown-no-child-'));const j=createDevOperationJournalService({storageRoot:path.join(root,'journal')});
 await j.executeReconciled({reconciliation_key:'unknown-before-child-error',request_fingerprint_sha256:'e'.repeat(64),tool_name:'unknown_mutation'},async()=>({isError:true}));
 assert.equal((await j.status()).health,'degraded');
});

async function completedFixture({changed=false,extra=false}={}) {
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-completed-child-'));
 const context={root,workspace_id:'dev_workspace_123456789012345678901234',workstream_id:'dev_workstream_20261004-000000_123456789012'};
 const j=createDevOperationJournalService({storageRoot:path.join(root,'journal'),resolutionContextResolver:async()=>context});
 const content='GPT approved fixture content\n', digest=createHash('sha256').update(content).digest('hex');
 const target={path:'probe.mjs',role:'created_file',before:{exists:false,artifact_type:null,sha256:null,bytes:null},expected:{exists:true,artifact_type:'file',sha256:digest,bytes:Buffer.byteLength(content)}};
 const a=await j.begin({operation_type:'mcp_mutation',tool_name:'dev_create_file',workspace_id:context.workspace_id,workstream_id:context.workstream_id,reconciliation_key:'completed-child-create',request_fingerprint_sha256:'f'.repeat(64)});
 const b=await j.begin({operation_type:'filesystem_create',tool_name:'dev_create_file',workspace_id:context.workspace_id,workstream_id:context.workstream_id,parent_operation_id:a.operation_id,targets:[target]});
 await writeFile(path.join(root,'probe.mjs'),changed?'unexpected':content);
 const done=await j.complete(b.operation_id,{targets:[{...target,after:target.expected}],result:{created:true,after_sha256:digest}});
 if(extra){const c=await j.begin({operation_type:'filesystem_create',tool_name:'dev_create_file',parent_operation_id:a.operation_id});await j.complete(c.operation_id);}
 await j.fail(a.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
 const file=path.join(j.storageRoot,'events',(await readdir(path.join(j.storageRoot,'events'))).at(-1));
 const e=JSON.parse(await readFile(file,'utf8'));e.diagnostic.owner_pid=2147483647;
 const {event_hash,...body}=e;e.event_hash=createHash('sha256').update(canonicalJson(body)).digest('hex');
 await writeFile(file,canonicalJson(e)+'\n');
 await writeFile(path.join(j.storageRoot,'head.json'),JSON.stringify({schema_version:1,latest_sequence:e.sequence,latest_event_id:e.journal_event_id,latest_event_hash:e.event_hash}));
 const reopened=createDevOperationJournalService({storageRoot:j.storageRoot,resolutionContextResolver:async()=>context});
 return {j:reopened,file,bytes:await readFile(file,'utf8'),root,context,input:{operation_id:a.operation_id,expected_terminal_hash:e.event_hash,request_fingerprint_sha256:'f'.repeat(64),decision_owner:'GPT',decision_id:'gpt-completed-child-fixture',reason:'Exact completed child receipt and physical postcondition prove success; never replay',resolution_kind:'completed_child_create',expected_child_terminal_hash:done.event_hash,observed_sha256:digest}};
}
test('completed child with exact physical postcondition resolves append-only and duplicates never replay',async()=>{
 const f=await completedFixture();const originalHead=(await f.j.status()).latest_sequence;
 await f.j.resolveCompletedChildMutation(f.input);
 assert.equal((await f.j.status()).health,'healthy');assert.equal(await readFile(f.file,'utf8'),f.bytes);
 const op=await f.j.getOperation({operation_id:f.input.operation_id});
 assert.equal(op.reconciliation_state,'completed');assert.equal(op.automatic_replay_allowed,false);assert.equal(op.safe_to_reinitiate,false);
 let calls=0;const duplicate=await f.j.executeReconciled({tool_name:'dev_create_file',reconciliation_key:'completed-child-create',request_fingerprint_sha256:'f'.repeat(64)},async()=>{calls++;});
 assert.equal(calls,0);assert.equal(duplicate.operation.reconciliation_state,'completed');
 await f.j.resolveCompletedChildMutation(f.input);assert.equal((await f.j.status()).latest_sequence,originalHead+2);
});
test('changed physical postcondition never resolves a completed child',async()=>{
 const f=await completedFixture({changed:true});const head=(await f.j.status()).latest_sequence;
 await assert.rejects(f.j.resolveCompletedChildMutation(f.input),/RESOLUTION_PHYSICAL_STATE_CHANGED/);
 assert.equal((await f.j.status()).latest_sequence,head);assert.equal((await f.j.status()).health,'degraded');
});
test('multiple children and incorrect child terminal hash fail safe',async()=>{
 const f=await completedFixture({extra:true});await assert.rejects(f.j.resolveCompletedChildMutation(f.input),/UNSAFE_COMPLETED_CHILD_RESOLUTION/);
 const g=await completedFixture();await assert.rejects(g.j.resolveCompletedChildMutation({...g.input,expected_child_terminal_hash:'0'.repeat(64)}),/UNSAFE_COMPLETED_CHILD_RESOLUTION/);
});
test('completed child proof cannot use no-child repair ingress or a foreign workspace',async()=>{
 const f=await completedFixture();await assert.rejects(f.j.resolveNoChildMutation(f.input),/INVALID_TERMINAL_RESOLUTION/);
 const other=createDevOperationJournalService({storageRoot:f.j.storageRoot,resolutionContextResolver:async()=>({...f.context,workstream_id:null})});
 await assert.rejects(other.resolveCompletedChildMutation(f.input),/RESOLUTION_WORKSPACE_MISMATCH/);
});

test('stored resolution dedupes after PID reuse without a second event',async()=>{
 const f=await fixture();await f.j.resolveNoChildMutation(f.input);
 const before=(await f.j.status()).latest_sequence;
 const {mock}=await import('node:test');const prior=process.kill;
 mock.method(process,'kill',(pid,signal)=>pid===2147483647?undefined:prior.call(process,pid,signal));
 try{const result=await f.j.resolveNoChildMutation(f.input);assert.equal(result.reconciled,true);assert.equal((await f.j.status()).latest_sequence,before);}
 finally{mock.restoreAll();}
});


test('powershell nonzero exit with completed child stays reconciled',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-powershell-nonzero-'));
 const scope={workspace_id:'dev_workspace_123456789012345678901234',workstream_id:'dev_workstream_20261006-000000_123456789012'};
 const j=createDevOperationJournalService({storageRoot:path.join(root,'journal')});
 const commandSha=createHash('sha256').update('node --test tests/mcp/pi-production-execution.test.mjs').digest('hex');
 const result=await j.executeReconciled({tool_name:'powershell_run',reconciliation_key:'powershell-nonzero-exit',request_fingerprint_sha256:'9'.repeat(64),resolve_workspace_scope:async()=>scope},async()=>{
   const child=await j.begin({operation_type:'powershell_maintenance',tool_name:'powershell_run',workspace_id:scope.workspace_id,workstream_id:scope.workstream_id,
     result:{command_sha256:commandSha,cwd:root,elevated:false,timeout_ms:120000}});
   await j.complete(child.operation_id,{result:{command_sha256:commandSha,cwd:root,duration_ms:10,elevated:false,execution_ok:true,exit_code:1,ok:false,reason:null,
     stderr_sha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',stderr_truncated:false,stdout_truncated:false,timed_out:false,timeout_ms:120000}});
   return {content:[{type:'text',text:JSON.stringify({execution_ok:true,ok:false,exit_code:1,timed_out:false})}]};
 });
 assert.equal(result.operation.reconciliation_state,'completed');
 assert.equal((await j.status()).health,'healthy');
});

test('completed powershell child ambiguity resolves append-only with exact receipt',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-powershell-resolution-'));
 const scope={workspace_id:'dev_workspace_123456789012345678901234',workstream_id:'dev_workstream_20261006-000000_123456789012'};
 const j=createDevOperationJournalService({storageRoot:path.join(root,'journal')});
 const commandSha=createHash('sha256').update('node --test tests/mcp/pi-production-execution.test.mjs').digest('hex');
 const requestHash='8'.repeat(64);
 const outer=await j.begin({operation_type:'mcp_mutation',tool_name:'powershell_run',workspace_id:scope.workspace_id,workstream_id:scope.workstream_id,
   reconciliation_key:'powershell-resolution-fixture',request_fingerprint_sha256:requestHash});
 const child=await j.begin({operation_type:'powershell_maintenance',tool_name:'powershell_run',workspace_id:scope.workspace_id,workstream_id:scope.workstream_id,
   parent_operation_id:outer.operation_id,result:{command_sha256:commandSha,cwd:root,elevated:false,timeout_ms:120000}});
 const childDone=await j.complete(child.operation_id,{result:{command_sha256:commandSha,cwd:root,duration_ms:10,elevated:false,execution_ok:true,exit_code:1,ok:false,reason:null,
   stderr_sha256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',stderr_truncated:false,stdout_truncated:false,timed_out:false,timeout_ms:120000}});
 await j.fail(outer.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
 const file=path.join(j.storageRoot,'events',(await readdir(path.join(j.storageRoot,'events'))).at(-1));
 const terminal=JSON.parse(await readFile(file,'utf8'));terminal.diagnostic.owner_pid=2147483647;
 const {event_hash,...body}=terminal;terminal.event_hash=createHash('sha256').update(canonicalJson(body)).digest('hex');
 await writeFile(file,canonicalJson(terminal)+'\n');
 await writeFile(path.join(j.storageRoot,'head.json'),JSON.stringify({schema_version:1,latest_sequence:terminal.sequence,latest_event_id:terminal.journal_event_id,latest_event_hash:terminal.event_hash}));
 const reopened=createDevOperationJournalService({storageRoot:j.storageRoot});
 await reopened.resolveCompletedPowershellMutation({operation_id:outer.operation_id,expected_terminal_hash:terminal.event_hash,request_fingerprint_sha256:requestHash,
   decision_owner:'GPT',decision_id:'gpt-powershell-resolution-fixture',reason:'Exact completed maintenance child proves the command execution reached a durable terminal result; never replay.',
   resolution_kind:'completed_powershell_observation',expected_child_terminal_hash:childDone.event_hash,expected_command_sha256:commandSha,observed_exit_code:1});
 const status=await reopened.status();assert.equal(status.health,'healthy');assert.equal(status.reconciliation_required,false);
 const operation=await reopened.getOperation({operation_id:outer.operation_id});
 assert.equal(operation.reconciliation_state,'completed');assert.equal(operation.automatic_replay_allowed,false);assert.equal(operation.safe_to_reinitiate,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {recoverIndexRefreshOperations,inspectIndexRefreshRecovery,indexRefreshResult,validateIndexRefreshRecovery} from '../../server/src/mcp-startup-index-refresh-recovery.mjs';
const run=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
const journalURL=new URL('../../server/src/mcp-development-journal-tools.mjs',import.meta.url).href;
async function fixture(t){
 const parent=path.resolve(os.tmpdir()),root=await fs.mkdtemp(path.join(parent,'ww-index-recovery-'));
 t.after(async()=>{assert.equal(path.dirname(root),parent);assert.match(path.basename(root),/^ww-index-recovery-[A-Za-z0-9]+$/);await fs.rm(root,{recursive:true,force:true});});
 const git=async(...args)=>(await run('git',['--no-pager','-c','core.fsmonitor=false',...args],{cwd:root,windowsHide:true,timeout:15000})).stdout;
 await git('init','-q');await fs.writeFile(path.join(root,'seed.txt'),'fixture\n');await git('add','seed.txt');await git('-c','user.name=fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');
 const storageRoot=path.join(root,'journal');
 const code=`import {createDevOperationJournalService} from ${JSON.stringify(journalURL)};const j=createDevOperationJournalService({storageRoot:${JSON.stringify(storageRoot)}});const parent=await j.begin({operation_type:'mcp_mutation',tool_name:'powershell_run',reconciliation_key:'index-fixture',request_fingerprint_sha256:'a'.repeat(64)});await j.begin({operation_type:'powershell_maintenance',tool_name:'powershell_run',parent_operation_id:parent.operation_id,result:{command_sha256:'b'.repeat(64),cwd:${JSON.stringify(root)},timeout_ms:120000,elevated:false}});console.log(JSON.stringify((await j.verify()).events));`;
 const events=JSON.parse((await run(process.execPath,['--input-type=module','-e',code],{windowsHide:true,timeout:20000})).stdout);
 await fs.writeFile(path.join(root,'proof.json'),'fixture proof\n');
 const profile={id:'fixture-only-index-recovery',root,head:(await git('rev-parse','HEAD')).trim(),index_entries_sha256:sha(await git('ls-files','--stage','-z')),parent:events[0],child:events[1],artifacts:{'proof.json':sha('fixture proof\n')},working:{'seed.txt':sha('fixture\n')},approval_sha256:'d'.repeat(64),decision_id:'gpt-index-fixture'};
 const options={storageRoot,indexRefreshRecoveryProfile:profile};const journal=createDevOperationJournalService(options);
 const authority=async(p,body)=>body({approval_sha256:p.approval_sha256,assertExclusive:async()=>true});
 const apply=(extra={})=>recoverIndexRefreshOperations({journal,root,profile,authority,...extra});
 return {root,profile,journal,options,authority,apply,events};
}
test('append-only failed-effect recovery, child first, cold verified, never shell success or replay',async t=>{
 const f=await fixture(t),before=(await f.journal.verify()).events;const result=await f.apply();assert.equal(result.journal.health,'healthy');
 const v=await f.journal.verify();assert.deepEqual(v.events.slice(0,2),before);assert.equal(v.events.length,4);
 assert.equal(v.events[2].operation_id,f.profile.child.operation_id);assert.equal(v.events[3].operation_id,f.profile.parent.operation_id);
 const cold=createDevOperationJournalService(f.options);assert.equal((await cold.status()).health,'healthy');
 for(const e of [f.profile.parent,f.profile.child]){const op=await cold.getOperation({operation_id:e.operation_id});assert.equal(op.reconciliation_state,'completed');assert.equal(op.original_result.ok,false);assert.equal(op.original_result.execution_ok,false);assert.equal(op.original_result.shell_exit_code_observed,false);assert.equal(Object.hasOwn(op.original_result,'exit_code'),false);assert.equal(op.automatic_replay_allowed,false);assert.equal(op.safe_to_reinitiate,false);}
 await f.apply();assert.equal((await f.journal.verify()).events.length,4);
});
test('requires trusted host authority, exact approval and live exclusion',async t=>{
 const f=await fixture(t);for(const authority of [undefined,async(p,b)=>b({approval_sha256:'e'.repeat(64),assertExclusive:async()=>true}),async(p,b)=>b({approval_sha256:p.approval_sha256,assertExclusive:async()=>false})])await assert.rejects(f.apply({authority}),/HOST_RECOVERY_AUTHORITY_REQUIRED/);
 assert.equal((await f.journal.verify()).events.length,2);
});
test('changed physical evidence or unrelated content blocks before append',async t=>{
 const f=await fixture(t);for(const name of ['proof.json','seed.txt']){const file=path.join(f.root,name),bytes=await fs.readFile(file);await fs.writeFile(file,'changed');await assert.rejects(f.apply(),/UNSAFE_INDEX_REFRESH_RECOVERY/);await fs.writeFile(file,bytes);}
 assert.equal((await f.journal.verify()).events.length,2);
});
test('forged profile, fingerprint, shell success, exit code and parent-first receipts fail cold validation',async t=>{
 const f=await fixture(t),child={...f.profile.child,stage:'operation_recovered',sequence:3,reconciles_event_id:f.profile.child.journal_event_id,result:indexRefreshResult(f.profile)};
 validateIndexRefreshRecovery(f.events,child,f.profile);
 for(const result of [{...child.result,ok:true},{...child.result,exit_code:0},{...child.result,recovery_profile:'other'},{...child.result,evidence_sha256:'a'.repeat(64)}])assert.throws(()=>validateIndexRefreshRecovery(f.events,{...child,result},f.profile),/UNSAFE_INDEX_REFRESH_RECOVERY/);
 assert.throws(()=>validateIndexRefreshRecovery(f.events,{...child,request_fingerprint_sha256:'a'.repeat(64)},f.profile),/UNSAFE_INDEX_REFRESH_RECOVERY/);
 const parent={...f.profile.parent,stage:'operation_recovered',sequence:3,reconciles_event_id:f.profile.parent.journal_event_id,result:indexRefreshResult(f.profile)};assert.throws(()=>validateIndexRefreshRecovery(f.events,parent,f.profile),/UNSAFE_INDEX_REFRESH_RECOVERY/);
});
test('actual native automatic owner-loss recovery stays ambiguous and cannot be overwritten',async t=>{
 const f=await fixture(t);await f.journal.reconcileDangling();await assert.rejects(f.apply(),/UNSAFE_INDEX_REFRESH_RECOVERY/);assert.equal((await f.journal.status()).health,'degraded');
});
test('competing operation prevents adjudication',async t=>{
 const f=await fixture(t);await f.journal.recover(f.profile.child.operation_id,{reconciles_event_id:f.profile.child.journal_event_id,result:indexRefreshResult(f.profile)});await f.journal.recover(f.profile.parent.operation_id,{reconciles_event_id:f.profile.parent.journal_event_id,result:indexRefreshResult(f.profile)});
 const other=await f.journal.begin({operation_type:'filesystem_create',tool_name:'dev_create_file'});await assert.rejects(f.apply(),/UNSAFE_INDEX_REFRESH_RECOVERY/);await f.journal.complete(other.operation_id,{result:{outcome:'no_effect_observed'}});
});
test('losing exclusion after inspection cannot publish terminal',async t=>{
 const f=await fixture(t);let checks=0;const authority=async(p,b)=>b({approval_sha256:p.approval_sha256,assertExclusive:async()=>++checks===1});await assert.rejects(f.apply({authority}),/HOST_RECOVERY_AUTHORITY_REQUIRED/);assert.equal((await f.journal.verify()).events.length,2);
});
test('continuation after child append is idempotent and requires identical evidence',async t=>{
 const f=await fixture(t);await f.journal.recover(f.profile.child.operation_id,{reconciles_event_id:f.profile.child.journal_event_id,result:indexRefreshResult(f.profile)});await f.apply();assert.equal((await f.journal.status()).health,'healthy');assert.equal((await f.journal.verify()).events.length,4);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
process.env.WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL='1';
process.env.WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT='1';
process.env.WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION='1';
const {createDevTransactionService}=await import('../../server/src/mcp-development-transaction-tools.mjs');
async function scope(t,checkpoint){
 const root=await mkdtemp(path.join(os.tmpdir(),'txn-cp-diagnostic-'));
 t.after(()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('txn-cp-diagnostic-'));return rm(root,{recursive:true,force:true});});
 const storageRoot=path.join(root,'runtime','transactions');
 return {root,storageRoot,service:createDevTransactionService({storageRoot,checkpoint,journal:{async status(){return{health:'healthy'};}}})};
}
test('checkpoint contention preserves exact dependency code without permanently degrading healthy transactions',async t=>{
 let busy=true;const h=await scope(t,{async status(){return busy?{health:'degraded',last_health_error_code:'CHECKPOINT_STORE_BUSY',last_health_error:'exclusive maintenance lock timed out'}:{health:'healthy'};}});
 const first=await h.service.status();assert.equal(first.health,'degraded');
 const issue=first.integrity_issues.find(x=>x.code==='CHECKPOINT_STORE_NOT_HEALTHY');
 assert.equal(issue.checkpoint_error_code,'CHECKPOINT_STORE_BUSY');
 assert.equal(issue.checkpoint_error,'exclusive maintenance lock timed out');
 busy=false;const recovered=await h.service.status();assert.equal(recovered.health,'healthy');assert.equal(recovered.last_health_error,null);
});
test('checkpoint corruption is reported as corrupt and retains underlying evidence',async t=>{
 const h=await scope(t,{async status(){return{health:'corrupt',last_health_error_code:'CHECKPOINT_BLOB_CORRUPT',last_health_error:'blob digest mismatch'};}});
 const r=await h.service.status();assert.equal(r.health,'corrupt');assert.equal(r.integrity_issues[0].checkpoint_error_code,'CHECKPOINT_BLOB_CORRUPT');
});
test('thrown checkpoint failure retains its native code and does not become healthy',async t=>{
 const h=await scope(t,{async status(){throw Object.assign(new Error('private checkpoint unreadable'),{code:'EACCES'});}});
 const r=await h.service.status();assert.equal(r.health,'corrupt');assert.equal(r.integrity_issues[0].checkpoint_error_code,'EACCES');
});
test('real orphan transaction barrier remains corrupt after dependency becomes healthy',async t=>{
 let busy=true;const h=await scope(t,{async status(){return{health:busy?'degraded':'healthy',last_health_error_code:busy?'CHECKPOINT_STORE_BUSY':null};}});
 await h.service.status();
 const barriers=path.join(h.storageRoot,'barriers');await mkdir(barriers,{recursive:true});
 const workspace='dev_workspace_0123456789abcdef01234567';
 const barrier=path.join(barriers,workspace+'.json');
 await writeFile(barrier,JSON.stringify({schema_version:1,workspace_id:workspace,transaction_id:'dev_transaction_'+'f'.repeat(32),state:'applying',transaction_plan_hash:'a'.repeat(64)}));
 busy=false;const r=await h.service.status();assert.equal(r.health,'corrupt');assert.ok(r.integrity_issues.some(x=>x.code==='TRANSACTION_ORPHAN_BARRIER'));
 assert.equal((await h.service.status()).health,'corrupt');
 await assert.rejects(h.service.assertWorkspaceAvailable(workspace),e=>e.code==='WORKSPACE_TRANSACTION_IN_PROGRESS');
 // Removing this own test artifact is not transaction reconciliation. A genuine
 // transaction corruption latch must survive and remain fail-closed.
 await rm(barrier);
 assert.equal((await h.service.status()).health,'corrupt');
});
test('busy dependency becomes healthy without retaining a transaction degradation latch',async t=>{
 let busy=true;const h=await scope(t,{async status(){return{health:busy?'degraded':'healthy',last_health_error_code:busy?'CHECKPOINT_STORE_BUSY':null};}});
 assert.equal((await h.service.status()).health,'degraded');
 busy=false;assert.equal((await h.service.status()).health,'healthy');
});

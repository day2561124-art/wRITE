import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {createDevOperationJournalService} from '../../server/src/mcp-development-journal-tools.mjs';
import {projectRoot} from '../../server/src/project-paths.mjs';
import {markWorkstreamStaleBeforeWrite,preserveWorkstreamPrewriteFailure} from '../../server/src/mcp-workstream-prewrite-failure.mjs';

test('isolation audit failure persists genuine pre-handler evidence and duplicate never dispatches',async t=>{
 const {markIsolationBeforeDispatch}=await import('../../server/src/mcp-workstream-prewrite-failure.mjs');
 const j=await harness(t);let sends=0;const c=context('isolation-preaudit-fixture-0001','dev_workspace_create_isolated');
 await assert.rejects(j.executeReconciled(c,async()=>{sends++;throw markIsolationBeforeDispatch(new Error('audit preparation failed'));}),/audit preparation/);
 const history=await j.verify();const barriers=history.events.filter(e=>e.operation_type==='workspace_isolation_dispatch_barrier'&&e.stage==='operation_completed');
 assert.equal(barriers.length,1);assert.equal(JSON.parse(barriers[0].result.pre_dispatch_record).protocol,'writer-workbench/isolation-before-handler/v1');
 assert.equal((await j.status()).health,'healthy');
 const duplicate=await j.executeReconciled(c,async()=>{sends++;throw Error('must never replay');});
 assert.equal(duplicate.operation.reconciliation_state,'no_effect');assert.equal(duplicate.operation.reinitiate_requires_new_key,true);assert.equal(sends,1);
});
const tool='dev_workspace_update_workstream';
async function harness(t){const root=path.join(projectRoot,'tests/.tmp','prewrite-'+randomUUID());await fs.mkdir(root,{recursive:true});t.after(async()=>{assert(root.startsWith(path.join(projectRoot,'tests/.tmp')+path.sep));await fs.rm(root,{recursive:true,force:true});});return createDevOperationJournalService({storageRoot:root});}
const context=(key,tool_name=tool)=>({tool_name,reconciliation_key:key,request_fingerprint_sha256:'a'.repeat(64)});
const stale=()=>Object.assign(new Error('stale workstream revision: expected 1, current 2.'),{code:'WORKSTREAM_STALE_REVISION'});
const marked=()=>markWorkstreamStaleBeforeWrite(stale(),{expected_revision:1,current_revision:2});
const response=e=>preserveWorkstreamPrewriteFailure(e,{isError:true,content:[{type:'text',text:e.message}]});

test('native pre-write error keeps a failed no-effect terminal and duplicate never retries',async t=>{
 const j=await harness(t);let calls=0;
 await assert.rejects(j.executeReconciled(context('prewrite-direct-0001'),async()=>{calls++;throw marked();}),/stale workstream/);
 assert.equal((await j.status()).health,'healthy');
 const result=await j.executeReconciled(context('prewrite-direct-0001'),async()=>{calls++;throw Error('must not repeat');});
 assert.equal(result.reconciled,true);assert.equal(result.operation.reconciliation_state,'no_effect');assert.equal(calls,1);
 assert.equal(result.operation.original_result.outcome,'failed_no_effect');
});
test('trusted audit envelope preserves the process-local pre-write fact',async t=>{
 const j=await harness(t);const r=await j.executeReconciled(context('prewrite-audit-0001'),async()=>response(marked()));
 assert.equal(r.value.isError,true);assert.equal(r.operation.reconciliation_state,'no_effect');assert.equal((await j.status()).health,'healthy');
});
test('matching error string or code never mints no-effect proof',async t=>{
 const j=await harness(t);await assert.rejects(j.executeReconciled(context('prewrite-forged-code-0001'),async()=>{throw stale();}));
 assert.equal((await j.status()).health,'degraded');
});
test('serialized marker or client metadata never mints no-effect proof',async t=>{
 const j=await harness(t);const r=await j.executeReconciled(context('prewrite-serialized-0001'),async()=>{
  const r=response(marked());r.no_effect=true;r._meta={registry_before_write:true};return JSON.parse(JSON.stringify(r));
 });assert.equal(r.operation.reconciliation_state,'recovery_required');assert.equal((await j.status()).health,'degraded');
});
test('proof from another admitted operation cannot clear a later failure',async t=>{
 const j=await harness(t);let retained;
 await j.executeReconciled(context('prewrite-first-operation-0001'),async()=>{retained=response(marked());return retained;});
 const r=await j.executeReconciled(context('prewrite-second-operation-0001'),async()=>retained);
 assert.equal(r.operation.reconciliation_state,'recovery_required');assert.equal((await j.status()).health,'degraded');
});
test('arbitrary tool errors remain ambiguous even with an attempted trusted marker',async t=>{
 const j=await harness(t);const r=await j.executeReconciled(context('prewrite-other-tool-0001','powershell_run'),async()=>response(marked()));
 assert.equal(r.operation.reconciliation_state,'recovery_required');assert.equal((await j.status()).health,'degraded');
});
test('a child effect defeats the registry pre-write proof',async t=>{
 const j=await harness(t);const r=await j.executeReconciled(context('prewrite-child-effect-0001'),async()=>{
  const child=await j.begin({operation_type:'test_evidence',tool_name:tool});await j.complete(child.operation_id,{result:{outcome:'intended_effect_observed'}});return response(marked());
 });assert.equal(r.operation.reconciliation_state,'recovery_required');assert.equal((await j.status()).health,'degraded');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {hashExecutionInput,REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';
const exec=promisify(execFile),project=path.resolve('.'),shared='dev_workspace_shared_repository_v1';
async function fixture(t){
 await mkdir(path.join(project,'tests','.tmp'),{recursive:true});
 const root=await mkdtemp(path.join(project,'tests','.tmp','c-')),repo=path.join(root,'repo');await mkdir(repo,{recursive:true});
 const git=(args,options={})=>exec(process.platform==='win32'?'git.exe':'git',args,{cwd:options.cwd??repo,windowsHide:true,shell:false,timeout:30000,maxBuffer:1024*1024});
 await git(['init','-b','main']);await git(['config','user.email','pi-fixture@example.invalid']);await git(['config','user.name','Pi fixture']);await writeFile(path.join(repo,'base.txt'),'base\n');await git(['add','base.txt']);await git(['commit','-m','fixture base']);const base=(await git(['rev-parse','HEAD'])).stdout.trim();
 const actions=[['begin','workspace.begin_workstream',{label:'Cold lifecycle',declared_scope:['tests/mcp/pi-cold-fixture.test.mjs']}],['isolate','workspace.create_isolated',{}],['read','filesystem.read',{path:'base.txt'}],['write','filesystem.write',{path:'tests/mcp/pi-cold-fixture.test.mjs',content:"import test from 'node:test';import assert from 'node:assert/strict';test('GPT expected result',()=>assert.equal(2+2,4));\n"}],['checkpoint','workspace.create_checkpoint',{label:'Cold resume same identity'}],['test','verification.focused',{suite:'mcp_core'}],['commit','git.commit',{paths:['tests/mcp/pi-cold-fixture.test.mjs'],message:'GPT fixture commit',expectedHead:base}]].map(([step_id,capability,input],i)=>({step_id,capability,input,depends_on:i?[['begin','isolate','read','write','checkpoint','test','commit'][i-1]]:[],...(step_id==='read'?{}:{idempotency_key:'cold-key-'+step_id+'-0001'})}));
 const intent={schema_version:1,bootstrap:true,intent_id:'full-cold-lifecycle-0001',goal:'Fixture for physical bootstrap and durable process restart',context:{project_id:'writer_workbench',workstream_id:null,workspace_id:shared},constraints:['GPT exact content','No shared-main mutation'],requested_actions:actions,
 mutation_plan:actions.filter(a=>a.idempotency_key).map(a=>({step_id:a.step_id,target:a.step_id==='checkpoint'?'bootstrap_workspace':a.input.path??'bootstrap_workstream',expected_change:'Exact GPT-authored fixture operation',input_sha256:hashExecutionInput(a.input)})),verification:{focused:['test'],affected:[],full:[]},completion_conditions:['Review physical commit and no replay'],permissions:{read:true,workspace_create:true,write:true,tests:true,commit:true,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
 const config=path.join(root,'config.json');await writeFile(config,JSON.stringify({root,base,intent}));
 t.after(async()=>{assert.equal(path.dirname(root),path.join(project,'tests','.tmp'));const lines=(await git(['worktree','list','--porcelain'])).stdout.match(/^worktree (.+)$/gm)??[];for(const line of lines.slice(1)){const target=line.slice(9);assert.equal(path.dirname(path.resolve(target)),path.join(root,'.writer-workbench-worktrees'));try{await git(['worktree','unlock',target]);}catch{}await git(['worktree','remove','--force',target]);}await rm(root,{recursive:true,force:true});});
 return {root,repo,git,base,config};
}
const worker=fileURLToPath(new URL('./pi-bootstrap-cold-worker.fixture.mjs',import.meta.url));
const run=(f,point)=>exec(process.execPath,[worker,f.config,point],{cwd:project,windowsHide:true,shell:false,timeout:60000,maxBuffer:1024*1024});
for(const point of ['begin_effect','isolate_effect','after_checkpoint'])test('fresh Pi process resumes full physical lifecycle after '+point,async t=>{
 const f=await fixture(t);await assert.rejects(run(f,point),e=>e.code===73);
 const beforeCalls=(await readFile(path.join(f.root,'dispatch.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
 const beforeRegistry=JSON.parse(await readFile(path.join(f.root,'registry.json'),'utf8'));const original=beforeRegistry.workstreams[0];assert.equal(beforeRegistry.workstreams.length,1);
 await run(f,'resume');const r=JSON.parse(await readFile(path.join(f.root,'worker-result.json'),'utf8'));assert.notEqual(r.pid,beforeCalls[0].pid);assert.equal(r.result.state.status,'COMPLETED');assert.equal(r.health.health,'healthy');assert.equal(r.health.active_operation_count,0);assert.equal(r.health.dangling_operation_count,0);
 const binding=r.result.runtime.lifecycle_binding;assert.equal(binding.workstream_id,original.workstream_id);assert.equal(binding.base_head,f.base);if(point!=='begin_effect')assert.equal(binding.workspace_id,original.workspace_id);
 const cp=r.result.receipts.find(x=>x.step_id==='checkpoint');const facts=JSON.parse(cp.evidence.content[0].text);assert.match(facts.checkpoint_id,/^dev_checkpoint_/);assert.equal(facts.workspace_id,binding.workspace_id);assert.equal(facts.workstream_id,binding.workstream_id);assert.equal(facts.git_head,f.base);
 const workspace=path.join(f.root,'.writer-workbench-worktrees',binding.workspace_id);assert.notEqual((await f.git(['rev-parse','HEAD'],{cwd:workspace})).stdout.trim(),f.base);assert.equal((await f.git(['status','--porcelain'],{cwd:workspace})).stdout,'');assert.equal((await f.git(['rev-parse','HEAD'])).stdout.trim(),f.base);assert.equal((await f.git(['status','--porcelain'])).stdout,'');
 const calls=(await readFile(path.join(f.root,'dispatch.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);for(const name of ['dev_workspace_begin_workstream','dev_workspace_create_isolated','dev_create_file','dev_workspace_create_checkpoint','dev_git_commit'])assert.equal(calls.filter(x=>x.tool===name).length,1,name);
 await run(f,'duplicate');assert.equal(await readFile(path.join(f.root,'dispatch.jsonl'),'utf8'),calls.map(x=>JSON.stringify(x)).join('\n')+'\n');const duplicate=JSON.parse(await readFile(path.join(f.root,'worker-result.json'),'utf8'));assert.equal(duplicate.result.state.operation_id,r.result.state.operation_id);
});
test('an actual partial Git worktree effect becomes durable ambiguity and never authorizes replay',async t=>{
 const f=await fixture(t);await assert.rejects(run(f,'partial_workspace'),e=>e.code===73);
 const before=await readFile(path.join(f.root,'dispatch.jsonl'),'utf8');const registryBefore=await readFile(path.join(f.root,'registry.json'),'utf8');
 await assert.rejects(run(f,'resume'),e=>e.code===74);
 const recovered=JSON.parse(await readFile(path.join(f.root,'worker-recovery-health.json'),'utf8'));assert.equal(recovered.health.health,'degraded');assert.equal(recovered.health.reconciliation_required,true);
 assert.equal(await readFile(path.join(f.root,'dispatch.jsonl'),'utf8'),before);assert.equal(await readFile(path.join(f.root,'registry.json'),'utf8'),registryBefore);
 assert.equal((await f.git(['worktree','list','--porcelain'])).stdout.match(/^worktree /gm).length,2);
 assert.equal((await f.git(['status','--porcelain'])).stdout,'');
});

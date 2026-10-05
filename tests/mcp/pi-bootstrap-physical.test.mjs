import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createDevWorkstreamRegistryService} from '../../server/src/mcp-development-workstream-tools.mjs';
import {runPiManagedMcpCall} from '../../server/src/pi-production-execution-controller.mjs';
import {runWithMcpOperationReconciliationContext,fingerprintMcpMutationRequest} from '../../server/src/mcp-operation-reconciliation-context.mjs';
const exec=promisify(execFile),project=path.resolve('.');
async function fixture(t){
 await mkdir(path.join(project,'tests','.tmp'),{recursive:true});
 const root=await mkdtemp(path.join(project,'tests','.tmp','p-')),repo=path.join(root,'repo'),registryPath=path.join(root,'registry.json');await mkdir(repo,{recursive:true});
 const git=(args,options={})=>exec(process.platform==='win32'?'git.exe':'git',args,{cwd:options.cwd??repo,windowsHide:true,shell:false,timeout:30000,maxBuffer:512*1024});
 await git(['init','-b','main']);await git(['config','user.email','pi-fixture@example.invalid']);await git(['config','user.name','Pi fixture']);await writeFile(path.join(repo,'base.txt'),'base\n');await git(['add','base.txt']);await git(['commit','-m','fixture base']);const head=(await git(['rev-parse','HEAD'])).stdout.trim();
 const create=()=>createDevWorkstreamRegistryService({registryPath,repositoryRoot:repo,worktreeRootPath:path.join(root,'.writer-workbench-worktrees'),gitRunner:git,headReader:async()=>head});
 t.after(async()=>{assert.equal(path.dirname(root),path.join(project,'tests','.tmp'));const worktrees=(await git(['worktree','list','--porcelain'])).stdout.match(/^worktree (.+)$/gm)??[];for(const line of worktrees.slice(1)){const target=line.slice(9);assert.equal(path.dirname(path.resolve(target)),path.join(root,'.writer-workbench-worktrees'));await git(['worktree','unlock',target]);await git(['worktree','remove',target]);}await rm(root,{recursive:true,force:true});});
 return {root,repo,git,head,registryPath,create,service:create()};
}
const request=(tool_name,args,key)=>({operation_type:'mcp_mutation',tool_name,reconciliation_key:key,request_fingerprint_sha256:fingerprintMcpMutationRequest(tool_name,args)});
test('registry bootstrap and workspace creation survive service restart without a second physical identity',async t=>{
 const f=await fixture(t),args={label:'Pi exact bootstrap',declared_scope:['tests/.tmp/*']},start=request('dev_workspace_begin_workstream',args,'physical-bootstrap-0001');
 const first=await f.service.beginBootstrap({...args,bootstrap_id:start.reconciliation_key,request_fingerprint_sha256:start.request_fingerprint_sha256});
 assert.equal(first.base_head,f.head);const recovered=await f.create().inspectPiLifecycleEffect(start);assert.equal(recovered.workstream_id,first.workstream_id);assert.equal(recovered.outcome,'intended_effect_observed');
 const duplicate=await f.create().beginBootstrap({...args,bootstrap_id:start.reconciliation_key,request_fingerprint_sha256:start.request_fingerprint_sha256});assert.equal(duplicate.workstream_id,first.workstream_id);
 const isolationArgs={workstream_id:first.workstream_id,expected_workstream_revision:1},isolation=request('dev_workspace_create_isolated',isolationArgs,'physical-isolate-0001');isolation.workspace_id=first.workspace_id;isolation.workstream_id=first.workstream_id;
 const invoke=service=>runPiManagedMcpCall(()=>runWithMcpOperationReconciliationContext(isolation,()=>service.createIsolated(isolationArgs)));
 const workspace=await invoke(f.service);assert.equal(workspace.state,'active');assert.equal(workspace.base_head,f.head);
 const observation=await f.create().inspectPiLifecycleEffect(isolation);assert.equal(observation.workspace_id,workspace.workspace_id);assert.equal(observation.outcome,'intended_effect_observed');
 const repeated=await invoke(f.create());assert.equal(repeated.workspace_id,workspace.workspace_id);const all=await f.service.list({});assert.equal(all.workstreams.length,1);
 assert.equal((await f.git(['worktree','list','--porcelain'])).stdout.match(/^worktree /gm).length,2);
 assert.equal((await f.git(['status','--porcelain'])).stdout,'');
 await assert.rejects(f.service.begin({label:'forged',metadata:{pi_bootstrap_id:'forge-00001'}}),/RESERVED_PI_LIFECYCLE_IDENTITY/);
});
test('missing/conflicting/stale/terminal physical evidence stays ambiguous and metadata identity cannot be rewritten',async t=>{
 const f=await fixture(t),args={label:'negative bootstrap'},start=request('dev_workspace_begin_workstream',args,'physical-bootstrap-0002');
 assert.equal((await f.service.inspectPiLifecycleEffect(start)).outcome,'ambiguous_effect');
 const r=await f.service.beginBootstrap({...args,bootstrap_id:start.reconciliation_key,request_fingerprint_sha256:start.request_fingerprint_sha256});
 assert.equal((await f.service.inspectPiLifecycleEffect({...start,request_fingerprint_sha256:'f'.repeat(64)})).outcome,'ambiguous_effect');
 await assert.rejects(f.service.update({workstream_id:r.workstream_id,expected_revision:1,metadata:{pi_bootstrap_id:'modified-001'}}),/IMMUTABLE_PI_LIFECYCLE_IDENTITY/);
 const updated=await f.service.update({workstream_id:r.workstream_id,expected_revision:1,metadata:{note:'GPT metadata'}});assert.equal(updated.metadata.pi_bootstrap_id,start.reconciliation_key);
 assert.equal((await f.service.inspectPiLifecycleEffect(start)).outcome,'ambiguous_effect');
 const ended=await f.service.end({workstream_id:r.workstream_id,expected_revision:2,outcome:'completed'});assert.equal(ended.state,'completed');
 await assert.rejects(f.service.update({workstream_id:r.workstream_id,expected_revision:3,state:'active'}),/Terminal/);
 const raw=JSON.parse(await readFile(f.registryPath,'utf8'));raw.checksum_sha256='f'.repeat(64);await writeFile(f.registryPath,JSON.stringify(raw));await assert.rejects(f.service.inspectPiLifecycleEffect(start),/checksum|corrupt|registry/i);
});

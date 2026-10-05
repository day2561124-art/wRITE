import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {projectPaths} from '../../server/src/project-paths.mjs';
const config=JSON.parse(await readFile(process.argv[2],'utf8')),point=process.argv[3],exec=promisify(execFile);
const root=config.root,repo=path.join(root,'repo');
// Set the existing host-owned paths BEFORE loading transaction modules. Every
// abrupt process exit now leaves only a fixture-owned lock/transaction record.
projectPaths.outputLogs=path.join(root,'fixture-logs');
const {createDevWorkstreamRegistryService}=await import('../../server/src/mcp-development-workstream-tools.mjs');
const {createDevOperationJournalService}=await import('../../server/src/mcp-development-journal-tools.mjs');
const {createDevCheckpointService}=await import('../../server/src/mcp-development-checkpoint-tools.mjs');
const {createPiProductionRouteStore}=await import('../../server/src/pi-production-execution-route.mjs');
const {createPiProductionExecutionController}=await import('../../server/src/pi-production-execution-controller.mjs');
const {fingerprintMcpMutationRequest}=await import('../../server/src/mcp-operation-reconciliation-context.mjs');
const git=async(args,options={})=>{const r=await exec(process.platform==='win32'?'git.exe':'git',args,{cwd:options.cwd??repo,windowsHide:true,shell:false,timeout:30000,maxBuffer:1024*1024});if(point==='partial_workspace'&&args[0]==='worktree'&&args[1]==='add')process.exit(73);return r;};
const registry=createDevWorkstreamRegistryService({registryPath:path.join(root,'registry.json'),repositoryRoot:repo,worktreeRootPath:path.join(root,'.writer-workbench-worktrees'),gitRunner:git,headReader:async()=>config.base});
const journal=createDevOperationJournalService({storageRoot:path.join(root,'journal'),lifecycleEffectInspector:registry.inspectPiLifecycleEffect});
const initialized=await journal.initialize();
if(initialized.health!=='healthy'){await writeFile(path.join(root,'worker-recovery-health.json'),JSON.stringify({pid:process.pid,health:initialized}));process.exit(74);}
const checkpoint=createDevCheckpointService({storageRoot:path.join(root,'checkpoints'),repositoryRoot:repo,workspaceContextResolver:registry.resolveExecutionContext,journal});
const route=createPiProductionRouteStore({journal});
if((await route.inspect()).revision===0)await route.change({mode:'pi_default',expected_revision:0,decision_id:'gpt-cold-fixture',gate_hash:'a'.repeat(64)},{validateGate:async()=>true});
const host=createPiProductionExecutionController({journal,route,
 executionHook:async(stage,r)=>{if(point==='after_checkpoint'&&stage==='after_receipt'&&r.state.completed_steps.includes('checkpoint'))process.exit(73);},
 transport:{resolveWorkspace:async args=>{const r=await registry.getWorkspace(args);return r.workspace??r;},verifyScope:async()=>true,
 queryOperation:a=>journal.getOperation(a),callTool:async p=>{
  await appendFile(path.join(root,'dispatch.jsonl'),JSON.stringify({pid:process.pid,tool:p.name,key:p._meta?.reconciliation_key??null})+'\n');
  const scope=p.arguments.workspace_id?await registry.resolveExecutionContext({workspace_id:p.arguments.workspace_id}):p.name==='dev_workspace_create_isolated'?{workspace_id:'dev_workspace_shared_repository_v1',workstream_id:p.arguments.workstream_id}:{workspace_id:'dev_workspace_shared_repository_v1',workstream_id:null};
  const physical=async()=>{
   let result;
   if(p.name==='dev_workspace_begin_workstream')result=await registry.beginBootstrap({...p.arguments,bootstrap_id:p._meta.reconciliation_key,request_fingerprint_sha256:fingerprintMcpMutationRequest(p.name,p.arguments)});
   else if(p.name==='dev_workspace_create_isolated')result=await registry.createIsolated(p.arguments);
   else if(p.name==='dev_create_file'){await mkdir(path.dirname(path.join(scope.root,p.arguments.path)),{recursive:true});await writeFile(path.join(scope.root,p.arguments.path),p.arguments.content,{flag:'wx'});result={ok:true};}
   else if(p.name==='dev_read_file')result={content:await readFile(path.join(scope.root,p.arguments.path),'utf8')};
   else if(p.name==='dev_workspace_create_checkpoint')result=await checkpoint.create(p.arguments);
   else if(p.name==='dev_run_tests'){await exec(process.execPath,['--test','tests/mcp/pi-cold-fixture.test.mjs'],{cwd:scope.root,windowsHide:true,timeout:30000});result={passed:true,suite:p.arguments.suite};}
   else if(p.name==='dev_git_commit'){if((await git(['rev-parse','HEAD'],{cwd:scope.root})).stdout.trim()!==p.arguments.expectedHead)throw Error('HEAD_MISMATCH');await git(['add','--',...p.arguments.paths],{cwd:scope.root});await git(['-c','user.name=Pi fixture','-c','user.email=pi@example.invalid','commit','-m',p.arguments.message],{cwd:scope.root});result={commit_sha:(await git(['rev-parse','HEAD'],{cwd:scope.root})).stdout.trim()};}
   else throw Error('UNREQUESTED_FIXTURE_TOOL');
   if((point==='begin_effect'&&p.name==='dev_workspace_begin_workstream')||(point==='isolate_effect'&&p.name==='dev_workspace_create_isolated'))process.exit(73);
   return {content:[{type:'text',text:JSON.stringify(result)}]};
  };
  if(!p._meta)return physical();
  const r=await journal.executeReconciled({tool_name:p.name,reconciliation_key:p._meta.reconciliation_key,request_fingerprint_sha256:fingerprintMcpMutationRequest(p.name,p.arguments),resolve_workspace_scope:async()=>scope},physical);
  return r.reconciled?{reconciled:true,...r.operation}:r.value;
 }} });
const result=await host.execute(config.intent);await writeFile(path.join(root,'worker-result.json'),JSON.stringify({pid:process.pid,result,health:await journal.status()}));console.log(JSON.stringify({pid:process.pid,status:result.state.status,identity:result.runtime.lifecycle_binding}));

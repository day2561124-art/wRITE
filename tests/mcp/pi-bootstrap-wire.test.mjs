import assert from 'node:assert/strict';
import test from 'node:test';
import {cp,mkdtemp,mkdir,readFile,writeFile,readdir,lstat,symlink,rm} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {hashExecutionInput,REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';
import {getDevTestSuiteMapping} from '../../server/src/mcp-development-test-tools.mjs';
import {createPiTaskAuthorizationStore} from '../../server/src/pi-task-authorization.mjs';
const completionTimeoutMs=getDevTestSuiteMapping().mcp_pi_postseal.timeout_ms+300_000;
const exec=promisify(execFile),source=process.env.PI_POSTSEAL_TEST_SOURCE_ROOT??path.resolve('.'),shared='dev_workspace_shared_repository_v1';
function facts(response){if(response.isError)throw Error(response.content?.[0]?.text??'MCP_TOOL_ERROR');return JSON.parse(response.content.find(c=>c.type==='text').text);}
function intent(id,context,actions,bootstrap=false){return {schema_version:1,...(bootstrap?{bootstrap:true}:{}),intent_id:id,goal:'GPT-authored wire lifecycle acceptance',context,constraints:['Preserve exact identity and content','No shared-main source mutation'],requested_actions:actions,
 mutation_plan:actions.filter(a=>a.idempotency_key).map(a=>({step_id:a.step_id,target:a.capability==='workspace.create_checkpoint'?'bootstrap_workspace':['workspace.end_workstream','workspace.update_workstream'].includes(a.capability)?context.workstream_id:a.input.path??'bootstrap_workstream',expected_change:'Exact GPT-authored operation',input_sha256:hashExecutionInput(a.input)})),
 verification:{focused:actions.filter(a=>a.capability==='verification.focused').map(a=>a.step_id),affected:[],full:[]},completion_conditions:['GPT reviews lifecycle evidence'],permissions:{read:true,workspace_create:bootstrap,write:true,tests:true,commit:true,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};}
test('actual MCP default ingress completes cold lifecycle and terminal no replay using existing official SDK',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-wire-')),repo=path.join(root,'repo');await mkdir(repo,{recursive:true});
 const git=(args,options={})=>exec(process.platform==='win32'?'git.exe':'git',args,{cwd:options.cwd??repo,windowsHide:true,shell:false,timeout:60000,maxBuffer:1024*1024});
 const clients=[],workers=[];
 t.after(async()=>{
  for(const client of clients)try{await client.close();}catch{}
  for(const worker of workers){
   if(worker.exitCode!==null)continue;
   if(worker.connected)worker.send({protocol:'writer-workbench/pi-durable-worker/v1',kind:'drain'});
   await new Promise(resolve=>{const timer=setTimeout(()=>{worker.kill();resolve();},5000);worker.once('close',()=>{clearTimeout(timer);resolve();});});
  }
  assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
  const metadata=await lstat(path.join(repo,'.git')).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
  if(metadata){
   assert(metadata.isDirectory()&&!metadata.isSymbolicLink());
   assert.equal(path.resolve((await git(['rev-parse','--show-toplevel'])).stdout.trim()),path.resolve(repo));
   const lines=(await git(['worktree','list','--porcelain'])).stdout.match(/^worktree (.+)$/gm)??[];
   for(const line of lines.slice(1)){const target=path.resolve(line.slice(9));assert.equal(path.dirname(target),path.resolve(root,'.writer-workbench-worktrees'));try{await git(['worktree','unlock',target]);}catch{}await git(['worktree','remove','--force',target]);}
  }
  await rm(path.resolve(root),{recursive:true,force:true});
 });
 for(const dir of ['server','scripts'])await cp(path.join(source,dir),path.join(repo,dir),{recursive:true,filter:p=>!['.tmp','node_modules'].includes(path.basename(p))});
 await mkdir(path.join(repo,'tests'),{recursive:true});
 for(const entry of await readdir(path.join(source,'tests'))){if(['.tmp','node_modules'].includes(entry))continue;await cp(path.join(source,'tests',entry),path.join(repo,'tests',entry),{recursive:true,filter:p=>!['.tmp','node_modules'].includes(path.basename(p))});}
 await cp(path.join(source,'package.json'),path.join(repo,'package.json'));
 await writeFile(path.join(repo,'.gitignore'),'node_modules/\ndata/outputs/\ntests/.tmp/\n');
 const dependencies=path.join(repo,'node_modules');await mkdir(dependencies);
 // Only read existing installed packages through fixture-owned bridges. No npm
 // download, runtime upgrade, dependency replacement or production path change.
 for(const name of await readdir(path.join(source,'node_modules'))){if(name.startsWith('.'))continue;const target=path.join(source,'node_modules',name);if((await lstat(target)).isDirectory())await symlink(target,path.join(dependencies,name),process.platform==='win32'?'junction':'dir');}
 await git(['init','-b','main']);await git(['config','--local','core.longpaths','true']);await git(['config','--local','core.autocrlf','false']);await git(['config','user.email','pi-wire@example.invalid']);await git(['config','user.name','Pi wire fixture']);await git(['add','.']);await git(['commit','-m','Exact source fixture']);const base=(await git(['rev-parse','HEAD'])).stdout.trim();
 const {createPiProductionRouteStore}=await import(pathToFileURL(path.join(repo,'server','src','pi-production-execution-route.mjs')).href);
 const {createDevOperationJournalService}=await import(pathToFileURL(path.join(repo,'server','src','mcp-development-journal-tools.mjs')).href);
 const journalRoot=path.join(repo,'data','outputs','logs','development_runtime','operation-journal');
 await mkdir(path.join(repo,'data','outputs','logs'),{recursive:true});
 const journal=createDevOperationJournalService({storageRoot:journalRoot}),route=createPiProductionRouteStore({journal});
 await route.change({mode:'pi_default',expected_revision:0,decision_id:'gpt-real-wire-fixture',gate_hash:'a'.repeat(64)},{validateGate:async()=>true});
 const injectedIncident=await journal.begin({operation_type:'filesystem_patch',tool_name:'dev_apply_patch',
  workspace_id:'dev_workspace_'+'f'.repeat(24),targets:[{path:'tests/mcp/pi-wire-lifecycle-probe.test.mjs'}]});
 await journal.fail(injectedIncident.operation_id,{result:{outcome:'ambiguous_effect',reconciliation_required:true}});
 const taskRoot=path.join(root,'task-authorizations');await mkdir(taskRoot);
 const taskStore=createPiTaskAuthorizationStore({root:taskRoot});
 const environment={...process.env,MCP_TOOL_PROFILE:'chatgpt_developer',PI_POSTSEAL_WIRE_FIXTURE_ROOT:repo,
  NEXA_PI_TASK_AUTHORIZATION_ROOT:taskRoot,NEXA_PI_REQUIRE_TASK_AUTHORIZATION:'0'};
 for(const key of Object.keys(environment))if(key.startsWith('WRITER_WORKBENCH_ISOLATED_TEST_')||key==='WRITER_WORKBENCH_TEST_JOURNAL_GROUP')delete environment[key];
 // Never inherit a configured live project or external data root into this fixture.
 delete environment.NEXA_MANAGED_PROJECT_ROOT;delete environment.WRITE_DATA_ROOT;
 const hook=fileURLToPath(new URL('./pi-bootstrap-wire-cold.fixture.mjs',import.meta.url));
 async function connect(exit,{standing=false,proof='SYNTHETIC_STANDING_APPROVED'}={}){const transport=new StdioClientTransport({command:process.execPath,args:['--import',pathToFileURL(hook).href,path.join(repo,'server','src','mcp-server.mjs')],cwd:repo,env:{...environment,PI_POSTSEAL_WIRE_EXIT:exit?'1':'0',PI_STANDING_WIRE_FIXTURE:standing?'1':'0',NEXA_PI_REQUIRE_TASK_AUTHORIZATION:standing?'1':'0'},stderr:'pipe'});transport.stderr?.on('data',chunk=>process.stderr.write(chunk));if(standing){const send=transport.send.bind(transport);transport.send=message=>send({...message,params:{...message.params,_meta:{...message.params?._meta,workbench_http_access_token:proof,workbench_purpose:'WORKBENCH'}}});}const client=new Client({name:'pi-postseal-wire-acceptance',version:'1'});clients.push(client);await client.connect(transport);return {client,transport};}
 async function startWorker(exit,{standing=false}={}){
  const worker=spawn(process.execPath,['--import',pathToFileURL(hook).href,path.join(repo,'server/src/mcp-server.mjs'),'--pi-worker'],
   {cwd:repo,env:{...environment,PI_POSTSEAL_WIRE_EXIT:exit?'1':'0',PI_STANDING_WIRE_FIXTURE:standing?'1':'0',NEXA_PI_REQUIRE_TASK_AUTHORIZATION:standing?'1':'0'},windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
  workers.push(worker);worker.stderr.on('data',chunk=>process.stderr.write(chunk));return worker;
 }
 async function submitAndWait(client,contract){
  let value=facts(await client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(contract)}},undefined,{timeout:300000}));
  return waitFor(client,value,contract.bootstrap===true);
 }
 async function waitFor(client,value,bootstrap=false){
  const deadline=Date.now()+completionTimeoutMs;
  while(!['COMPLETED','FAILED','CANCELLED','BLOCKED','DECISION_REQUIRED'].includes(value.state.status)&&Date.now()<deadline){
   await new Promise(r=>setTimeout(r,100));
   const context=value.intent.context;
   value=facts(await client.callTool({name:'dev_pi_execution_status',arguments:{operation_id:value.state.operation_id,...(bootstrap?{bootstrap:true}:{workstream_id:context.workstream_id,workspace_id:context.workspace_id})}},undefined,{timeout:300000})).operation;
  }return value;
 }
 const first=await connect(false);const toolNames=(await first.client.listTools()).tools.map(t=>t.name);assert(toolNames.includes('dev_capability_get_schema'));assert(toolNames.includes('dev_pi_execute_intent'));
 await assert.rejects(async()=>facts(await first.client.callTool({name:'dev_workspace_begin_workstream',arguments:{label:'direct must be rejected'}})),/PI_EXECUTION_INTENT_REQUIRED/);
 const actions=[['begin','workspace.begin_workstream',{label:'Actual MCP cold lifecycle',declared_scope:['tests/mcp/pi-wire-lifecycle-probe.test.mjs']}],['isolate','workspace.create_isolated',{}],['read','filesystem.read',{path:'package.json'}],['write','filesystem.write',{path:'tests/mcp/pi-wire-lifecycle-probe.test.mjs',content:"import test from 'node:test';import assert from 'node:assert/strict';test('GPT exact probe',()=>assert.equal(2+2,4));\n"}],['checkpoint','workspace.create_checkpoint',{label:'Wire checkpoint'}],['test','verification.focused',{suite:'mcp_pi_postseal'}],['commit','git.commit',{message:'GPT wire acceptance',paths:['tests/mcp/pi-wire-lifecycle-probe.test.mjs'],expectedHead:base}]].map(([step_id,capability,input],i)=>({step_id,capability,input,depends_on:i?[['begin','isolate','read','write','checkpoint','test','commit'][i-1]]:[],...(step_id==='read'?{}:{idempotency_key:'wire-lifecycle-'+step_id+'-0001'})}));
 for(const a of actions){const schema=facts(await first.client.callTool({name:'dev_capability_get_schema',arguments:{capability_name:a.capability}}));a.expected_capability_version=schema.capability_version;a.expected_schema_hash=schema.schema_hash;}
 const contract=intent('real-MCP-wire-lifecycle-0001',{project_id:'writer_workbench',workstream_id:null,workspace_id:shared},actions,true);
 const admitted=facts(await first.client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(contract)}},undefined,{timeout:300000}));
 assert.equal(admitted.state.status,'CREATED');
 await first.client.close();
 const observer=await connect(false);
 const crashedWorker=await startWorker(true);
 const workerExit=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker failed to reach checkpoint')),300000);crashedWorker.once('close',code=>{clearTimeout(timer);resolve(code);});crashedWorker.once('error',reject);});
 assert.equal(workerExit,73);
 const exit=JSON.parse(await readFile(path.join(root,'exit-checkpoint.json'),'utf8'));assert.equal(exit.pid,crashedWorker.pid);
 const independentRead=facts(await observer.client.callTool({name:'dev_read_file',arguments:{path:'package.json'}}));
 assert.equal(JSON.parse(independentRead.content).name,JSON.parse(await readFile(path.join(repo,'package.json'),'utf8')).name);
 await observer.client.close();
 const second=await connect(false);assert.notEqual(second.transport.pid,exit.pid);
 const saved=facts(await second.client.callTool({name:'dev_pi_execution_status',arguments:{intent_id:contract.intent_id,bootstrap:true}})).operation;
 assert.equal(saved.state.operation_id,exit.operation_id);assert.equal(saved.runtime.lifecycle_binding.workspace_id,exit.binding.workspace_id);assert(saved.state.completed_steps.includes('checkpoint'));
 const originalWorker=await startWorker(false);
 const resumed=await submitAndWait(second.client,contract);assert.equal(resumed.state.status,'COMPLETED',JSON.stringify({state:resumed.state,runtime:resumed.runtime,receipts:resumed.receipts.map(r=>({step_id:r.step_id,kind:r.kind,evidence:r.step_id==='test'?r.evidence:undefined}))}));assert.equal(resumed.state.operation_id,exit.operation_id);assert.equal(resumed.result.verification.focused,'passed');
 const context={project_id:'writer_workbench',workstream_id:exit.binding.workstream_id,workspace_id:exit.binding.workspace_id};
 let recoveredBuild=false;
 if(process.platform==='win32'&&process.arch==='x64'){
  const capability='workspace.powershell_isolated';
  const goal='Exercise AppContainer through the real authenticated Pi worker';
  const grant=await taskStore.issue({...context,goal,capabilities:[capability,'filesystem.patch','git.commit'],expires_at_ms:Date.now()+300_000});
  const staged={request_kind:'autonomous_engineering',intent_id:'wire-appcontainer-0001',goal,workspace_id:context.workspace_id,
   task_authorization_id:grant.task_authorization_id,sandbox_paths:['package.json'],output_paths:['sandbox-result.txt'],
   command:"$package = Get-Content package.json -Raw | ConvertFrom-Json; [IO.File]::WriteAllText([IO.Path]::GetFullPath('sandbox-result.txt'), $package.name)"};
  const observed=await submitAndWait(second.client,staged);
  assert.equal(observed.state.status,'COMPLETED',JSON.stringify({state:observed.state,command:observed.command}));
  const result=facts(observed.receipts[0].evidence);
  const sourcePackage=JSON.parse(await readFile(path.join(repo,'package.json'),'utf8'));
  assert.equal(result.artifacts[0].content,sourcePackage.name);
  assert.equal(result.workspace_writes,false);
  assert.equal((await submitAndWait(second.client,staged)).projection_hash,observed.projection_hash);

  const {path:sourceFile,content}=actions.find(action=>action.step_id==='write').input;
  const input={sandbox_paths:[sourceFile],command:[
   `if ((Get-Content -LiteralPath '${sourceFile}' -Raw) -notmatch 'repair-marker') { exit 7 }`,
   "Write-Output 'revalidated-sandbox-source'",
  ].join('\n')};
  const sourceCommit=facts(resumed.receipts.find(receipt=>receipt.step_id==='commit').evidence).commit;
  const repairPlan={request_kind:'autonomous_engineering',intent_id:'wire-appcontainer-repair-0001',goal,
   workspace_id:context.workspace_id,task_authorization_id:grant.task_authorization_id,requested_actions:[
    {step_id:'initial',capability,input,on_failure:['patch','retry']},
    {step_id:'patch',capability:'filesystem.patch',depends_on:['initial'],input:{path:sourceFile,oldText:content,
     newText:content+'// repair-marker\n',expectedSha256:createHash('sha256').update(content).digest('hex')}},
    {step_id:'retry',capability,input,depends_on:['patch']},
    {step_id:'commit',capability:'git.commit',depends_on:['initial'],
     input:{paths:[sourceFile],message:'Commit the repaired wire fixture',expectedHead:sourceCommit}},
   ]};
  const repaired=await submitAndWait(second.client,repairPlan);
  assert.equal(repaired.state.status,'COMPLETED',JSON.stringify({state:repaired.state,command:repaired.command}));
  assert.deepEqual(repaired.state.recovery.recovered_steps,['initial']);
  assert.deepEqual(repaired.state.completed_steps,['patch','retry','commit']);
  assert.match(facts(repaired.receipts.find(receipt=>receipt.step_id==='retry').evidence).stdout,/revalidated-sandbox-source/u);
  assert.equal((await submitAndWait(second.client,repairPlan)).projection_hash,repaired.projection_hash);
  recoveredBuild=true;
 }

 // Real MCP request serialization and actual worker process, with a fixture
 // verifier (not live OAuth). Stop the original bootstrap worker before
 // enabling mandatory-grant mode on both new processes.
 async function drain(worker){
  if(worker.exitCode!==null)return;
  const closed=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Standing fixture worker did not drain')),30000);
   worker.once('close',code=>{clearTimeout(timer);resolve(code);});
  });
  worker.send({protocol:'writer-workbench/pi-durable-worker/v1',kind:'drain'});
  assert.equal(await closed,0);
 }
 await drain(originalWorker);
 // Exercise the operator CLI in its own fixture process, rather than
 // injecting an issuer into the runtime. The plan lives outside the repo.
 const policyCli=async(...args)=>JSON.parse((await exec(process.execPath,
  [path.join(repo,'scripts/manage-pi-standing-policy.mjs'),...args],
  {cwd:repo,env:environment,windowsHide:true,shell:false,timeout:60000,maxBuffer:1024*1024})).stdout);
 const policyPlan={schema_version:1,project_id:'writer_workbench',principal:'wire-standing-operator-fixture',
  scopes:[{workspace_id:context.workspace_id,workstream_id:context.workstream_id}],
  capabilities:['filesystem.read','filesystem.patch','workspace.create_checkpoint','verification.focused','git.commit'],
  expires_at_ms:Date.now()+completionTimeoutMs+300000};
 const planFile=path.join(root,'standing-policy-plan.json');
 await writeFile(planFile,JSON.stringify(policyPlan));
 const preview=await policyCli('preview',planFile);
 assert.equal(preview.publication_performed,false);
 const policy=await policyCli('issue',planFile,preview.plan_sha256);
 assert.equal(policy.publication_performed,true);
 const authenticated=await connect(false,{standing:true});
 const wrong=await connect(false,{standing:true,proof:'SYNTHETIC_STANDING_OTHER'});
 const readArgs={workspace_id:context.workspace_id,path:actions.find(a=>a.step_id==='write').input.path};
 const before=facts(await authenticated.client.callTool({name:'dev_read_file',arguments:readArgs}));
 const gitBefore=facts(await authenticated.client.callTool({name:'dev_git_status',arguments:{workspace_id:context.workspace_id}}));
 const newText=before.content+'// standing-policy-wire-marker\n';
 const standingRequest={request_kind:'autonomous_engineering',intent_id:'wire-standing-lifecycle-0001',
  goal:'Verify independently approved standing policy through real MCP',workspace_id:context.workspace_id,
  requested_actions:[
   {step_id:'read',capability:'filesystem.read',input:{path:readArgs.path}},
   {step_id:'patch',capability:'filesystem.patch',depends_on:['read'],input:{path:readArgs.path,oldText:before.content,newText,expectedSha256:createHash('sha256').update(before.content).digest('hex')}},
   {step_id:'standing-checkpoint',capability:'workspace.create_checkpoint',depends_on:['patch'],input:{label:'Standing wire checkpoint'}},
   {step_id:'verify',capability:'verification.focused',depends_on:['standing-checkpoint'],input:{suite:'mcp_pi_postseal'}},
   {step_id:'commit',capability:'git.commit',depends_on:['verify'],input:{paths:[readArgs.path],message:'Verify standing policy wire lifecycle',expectedHead:gitBefore.workspace_context.current_head}},
  ]};
 const submitStanding=async(client,request)=>facts(await client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(request)}},undefined,{timeout:300000}));
 await assert.rejects(submitStanding(wrong.client,standingRequest),/PERMISSION_DENIED/u);
 await wrong.client.close();
 const queuedStanding=await submitStanding(authenticated.client,standingRequest);
 assert.equal(queuedStanding.state.status,'CREATED');
 assert.equal(queuedStanding.intent.task_authorization_id,undefined);
 assert.equal(queuedStanding.intent.standing_authorization.policy_id,policy.policy_id);
 assert.equal(queuedStanding.intent.standing_authorization.policy_sha256,policy.policy_sha256);
 await assert.rejects(submitStanding(authenticated.client,queuedStanding.intent),/PERMISSION_DENIED/u);
 await authenticated.client.close();
 const standingWorker=await startWorker(false,{standing:true});
 const authenticatedAgain=await connect(false,{standing:true});
 const standingComplete=await waitFor(authenticatedAgain.client,queuedStanding);
 assert.equal(standingComplete.state.status,'COMPLETED',JSON.stringify({state:standingComplete.state,runtime:standingComplete.runtime}));
 assert.equal(standingComplete.result.verification.focused,'passed');
 assert.equal(standingComplete.state.operation_id,queuedStanding.state.operation_id);
 assert.deepEqual(standingComplete.intent.standing_authorization,queuedStanding.intent.standing_authorization);
 assert.equal(facts(await authenticatedAgain.client.callTool({name:'dev_read_file',arguments:readArgs})).content,newText);
 const standingDuplicate=await submitStanding(authenticatedAgain.client,{...standingRequest,request_kind:'standing_engineering'});
 assert.equal(standingDuplicate.projection_hash,standingComplete.projection_hash);
 await drain(standingWorker);
 const revokedRequest={request_kind:'autonomous_engineering',intent_id:'wire-standing-revoked-0001',
  goal:'Distinct queued goal must stop after independent revocation',workspace_id:context.workspace_id,
  requested_actions:[{step_id:'patch',capability:'filesystem.patch',input:{path:readArgs.path,oldText:newText,
   newText:newText+'// forbidden-after-revocation\n',expectedSha256:createHash('sha256').update(newText).digest('hex')}}]};
 const queuedRevoked=await submitStanding(authenticatedAgain.client,revokedRequest);
 assert.equal(queuedRevoked.state.status,'CREATED');
 assert.equal((await policyCli('revoke',policy.policy_id)).revoked,true);
 const revocationWorker=await startWorker(false,{standing:true});
 const revoked=await waitFor(authenticatedAgain.client,queuedRevoked);
 assert.equal(revoked.state.status,'BLOCKED');
 assert.equal(revoked.state.last_error.code,'PERMISSION_DENIED');
 assert.equal(facts(await authenticatedAgain.client.callTool({name:'dev_read_file',arguments:readArgs})).content,newText);
 await assert.rejects(submitStanding(authenticatedAgain.client,{...revokedRequest,intent_id:'wire-standing-after-revoke'}),/PERMISSION_DENIED/u);
 await authenticatedAgain.client.close();
 await drain(revocationWorker);
 await startWorker(false);
 console.log(JSON.stringify({standing_wire_verified:true,synthetic_identity_verifier:true,mandatory_grant_mode:true,
  independent_worker:true,completed:standingComplete.state.status,revoked:revoked.state.status,terminal_duplicate_unchanged:true}));
 const observations=intent('wire-read-checkpoint-0001',context,[{step_id:'workstream',capability:'workspace.get_workstream',input:{workstream_id:context.workstream_id},depends_on:[]},{step_id:'checkpoint',capability:'workspace.get_checkpoint',input:{checkpoint_id:exit.checkpoint.checkpoint_id},depends_on:['workstream']}]);
 const inspected=(await submitAndWait(second.client,observations));assert.equal(inspected.state.status,'COMPLETED');const workstream=facts(inspected.receipts[0].evidence),checkpoint=facts(inspected.receipts[1].evidence);assert.equal(checkpoint.checkpoint_id,exit.checkpoint.checkpoint_id);assert.equal(checkpoint.workspace_id,context.workspace_id);assert.equal(checkpoint.workstream_id,context.workstream_id);assert.equal(checkpoint.git_head,base);
 const transition=async(state,revision)=>{
  const id='wire-recovery-'+state+'-0001';
  const contract=intent(id,context,[{step_id:'transition',capability:'workspace.update_workstream',input:{workstream_id:context.workstream_id,expected_revision:revision,state},depends_on:[],idempotency_key:id}]);
  const result=(await submitAndWait(second.client,contract));
  assert.equal(result.state.status,'COMPLETED');const record=facts(result.receipts[0].evidence);assert.equal(record.state,state);assert.equal(record.revision,revision+1);
  const duplicate=(await submitAndWait(second.client,contract));assert.equal(duplicate.projection_hash,result.projection_hash);return record;
 };
 const paused=await transition('paused',workstream.revision);const active=await transition('active',paused.revision);
 const end=intent('wire-terminal-workstream-0001',context,[{step_id:'end',capability:'workspace.end_workstream',input:{workstream_id:context.workstream_id,expected_revision:active.revision,outcome:'completed'},depends_on:[],idempotency_key:'wire-workstream-end-0001'}]);
 assert.equal((await submitAndWait(second.client,end)).state.status,'COMPLETED');
 const beforeCalls=resumed.state.tool_calls.length;const duplicate=(await submitAndWait(second.client,contract));assert.equal(duplicate.state.tool_calls.length,beforeCalls);assert.equal(duplicate.projection_hash,resumed.projection_hash);
 const health=await journal.status();assert.equal(health.health,'degraded');assert.equal(health.active_operation_count,0);assert.equal(health.dangling_operation_count,0);
 assert.equal(health.isolated_operation_count,1);
 assert.equal(health.isolated_operations[0].operation_id,injectedIncident.operation_id);
 assert.equal((await journal.getOperation({operation_id:injectedIncident.operation_id})).automatic_replay_allowed,false);
 assert.equal((await git(['rev-parse','HEAD'])).stdout.trim(),base);assert.equal((await git(['status','--porcelain'])).stdout,'');
 const records=(await readdir(path.join(journalRoot,'events'))).sort();const events=await Promise.all(records.map(f=>readFile(path.join(journalRoot,'events',f),'utf8').then(JSON.parse)));
 const calls=events.filter(e=>e.operation_type==='mcp_mutation'&&e.stage==='operation_started'&&e.reconciliation_key?.startsWith('wire-lifecycle-'));
 assert.equal(calls.length,6);const creation=calls.find(e=>e.tool_name==='dev_workspace_create_isolated');assert.equal(creation.workstream_id,context.workstream_id);
 console.log(JSON.stringify({real_MCP:true,SDK_reused:true,cold_pids:[exit.pid,second.transport.pid],workstream_id:context.workstream_id,workspace_id:context.workspace_id,checkpoint_id:checkpoint.checkpoint_id,original_base:base,terminal_duplicate_new_dispatches:0,conditional_repair_verified:recoveredBuild,unrelated_journal_fault_preserved:true,independent_read_after_worker_exit:true,journal:health,shared_main_unchanged:true}));
});

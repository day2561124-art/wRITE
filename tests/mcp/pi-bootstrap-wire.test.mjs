import assert from 'node:assert/strict';
import test from 'node:test';
import {cp,mkdtemp,mkdir,readFile,writeFile,readdir,lstat,symlink,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {hashExecutionInput,REQUIRED_DECISION_BOUNDARIES} from '../../server/src/pi-execution-contract.mjs';
const exec=promisify(execFile),source=process.env.PI_POSTSEAL_TEST_SOURCE_ROOT??path.resolve('.'),shared='dev_workspace_shared_repository_v1';
function facts(response){if(response.isError)throw Error(response.content?.[0]?.text??'MCP_TOOL_ERROR');return JSON.parse(response.content.find(c=>c.type==='text').text);}
function intent(id,context,actions,bootstrap=false){return {schema_version:1,...(bootstrap?{bootstrap:true}:{}),intent_id:id,goal:'GPT-authored wire lifecycle acceptance',context,constraints:['Preserve exact identity and content','No shared-main source mutation'],requested_actions:actions,
 mutation_plan:actions.filter(a=>a.idempotency_key).map(a=>({step_id:a.step_id,target:a.capability==='workspace.create_checkpoint'?'bootstrap_workspace':['workspace.end_workstream','workspace.update_workstream'].includes(a.capability)?context.workstream_id:a.input.path??'bootstrap_workstream',expected_change:'Exact GPT-authored operation',input_sha256:hashExecutionInput(a.input)})),
 verification:{focused:actions.filter(a=>a.capability==='verification.focused').map(a=>a.step_id),affected:[],full:[]},completion_conditions:['GPT reviews lifecycle evidence'],permissions:{read:true,workspace_create:bootstrap,write:true,tests:true,commit:true,integrate:false,push:false},decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};}
test('actual MCP default ingress completes cold lifecycle and terminal no replay using existing official SDK',async t=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'pi-wire-')),repo=path.join(root,'repo');await mkdir(repo,{recursive:true});
 const git=(args,options={})=>exec(process.platform==='win32'?'git.exe':'git',args,{cwd:options.cwd??repo,windowsHide:true,shell:false,timeout:60000,maxBuffer:1024*1024});
 const clients=[];
 t.after(async()=>{
  for(const client of clients)try{await client.close();}catch{}
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
 const environment={...process.env,MCP_TOOL_PROFILE:'chatgpt_developer',PI_POSTSEAL_WIRE_FIXTURE_ROOT:repo};
 for(const key of Object.keys(environment))if(key.startsWith('WRITER_WORKBENCH_ISOLATED_TEST_')||key==='WRITER_WORKBENCH_TEST_JOURNAL_GROUP')delete environment[key];
 const hook=fileURLToPath(new URL('./pi-bootstrap-wire-cold.fixture.mjs',import.meta.url));
 async function connect(exit){const transport=new StdioClientTransport({command:process.execPath,args:['--import',pathToFileURL(hook).href,path.join(repo,'server','src','mcp-server.mjs')],cwd:repo,env:{...environment,PI_POSTSEAL_WIRE_EXIT:exit?'1':'0'},stderr:'pipe'});transport.stderr?.on('data',chunk=>process.stderr.write(chunk));const client=new Client({name:'pi-postseal-wire-acceptance',version:'1'});clients.push(client);await client.connect(transport);return {client,transport};}
 const first=await connect(true);const toolNames=(await first.client.listTools()).tools.map(t=>t.name);assert(toolNames.includes('dev_capability_get_schema'));assert(toolNames.includes('dev_pi_execute_intent'));
 await assert.rejects(async()=>facts(await first.client.callTool({name:'dev_workspace_begin_workstream',arguments:{label:'direct must be rejected'}})),/PI_EXECUTION_INTENT_REQUIRED/);
 const actions=[['begin','workspace.begin_workstream',{label:'Actual MCP cold lifecycle',declared_scope:['tests/mcp/pi-wire-lifecycle-probe.test.mjs']}],['isolate','workspace.create_isolated',{}],['read','filesystem.read',{path:'package.json'}],['write','filesystem.write',{path:'tests/mcp/pi-wire-lifecycle-probe.test.mjs',content:"import test from 'node:test';import assert from 'node:assert/strict';test('GPT exact probe',()=>assert.equal(2+2,4));\n"}],['checkpoint','workspace.create_checkpoint',{label:'Wire checkpoint'}],['test','verification.focused',{suite:'mcp_pi_postseal'}],['commit','git.commit',{message:'GPT wire acceptance',paths:['tests/mcp/pi-wire-lifecycle-probe.test.mjs'],expectedHead:base}]].map(([step_id,capability,input],i)=>({step_id,capability,input,depends_on:i?[['begin','isolate','read','write','checkpoint','test','commit'][i-1]]:[],...(step_id==='read'?{}:{idempotency_key:'wire-lifecycle-'+step_id+'-0001'})}));
 for(const a of actions){const schema=facts(await first.client.callTool({name:'dev_capability_get_schema',arguments:{capability_name:a.capability}}));a.expected_capability_version=schema.capability_version;a.expected_schema_hash=schema.schema_hash;}
 const contract=intent('real-MCP-wire-lifecycle-0001',{project_id:'writer_workbench',workstream_id:null,workspace_id:shared},actions,true);
 await assert.rejects(first.client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(contract)}},undefined,{timeout:300000}));
 const exit=JSON.parse(await readFile(path.join(root,'exit-checkpoint.json'),'utf8'));assert.equal(exit.pid,first.transport.pid??exit.pid);await first.client.close();
 const second=await connect(false);assert.notEqual(second.transport.pid,exit.pid);
 const saved=facts(await second.client.callTool({name:'dev_pi_execution_status',arguments:{intent_id:contract.intent_id,bootstrap:true}})).operation;
 assert.equal(saved.state.operation_id,exit.operation_id);assert.equal(saved.runtime.lifecycle_binding.workspace_id,exit.binding.workspace_id);assert(saved.state.completed_steps.includes('checkpoint'));
 const resumed=facts(await second.client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(contract)}},undefined,{timeout:300000}));assert.equal(resumed.state.status,'COMPLETED');assert.equal(resumed.state.operation_id,exit.operation_id);assert.equal(resumed.result.verification.focused,'passed');
 const context={project_id:'writer_workbench',workstream_id:exit.binding.workstream_id,workspace_id:exit.binding.workspace_id};
 const observations=intent('wire-read-checkpoint-0001',context,[{step_id:'workstream',capability:'workspace.get_workstream',input:{workstream_id:context.workstream_id},depends_on:[]},{step_id:'checkpoint',capability:'workspace.get_checkpoint',input:{checkpoint_id:exit.checkpoint.checkpoint_id},depends_on:['workstream']}]);
 const inspected=facts(await second.client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(observations)}},undefined,{timeout:300000}));assert.equal(inspected.state.status,'COMPLETED');const workstream=facts(inspected.receipts[0].evidence),checkpoint=facts(inspected.receipts[1].evidence);assert.equal(checkpoint.checkpoint_id,exit.checkpoint.checkpoint_id);assert.equal(checkpoint.workspace_id,context.workspace_id);assert.equal(checkpoint.workstream_id,context.workstream_id);assert.equal(checkpoint.git_head,base);
 const transition=async(state,revision)=>{
  const id='wire-recovery-'+state+'-0001';
  const contract=intent(id,context,[{step_id:'transition',capability:'workspace.update_workstream',input:{workstream_id:context.workstream_id,expected_revision:revision,state},depends_on:[],idempotency_key:id}]);
  const result=facts(await second.client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(contract)}},undefined,{timeout:300000}));
  assert.equal(result.state.status,'COMPLETED');const record=facts(result.receipts[0].evidence);assert.equal(record.state,state);assert.equal(record.revision,revision+1);
  const duplicate=facts(await second.client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(contract)}},undefined,{timeout:300000}));assert.equal(duplicate.projection_hash,result.projection_hash);return record;
 };
 const paused=await transition('paused',workstream.revision);const active=await transition('active',paused.revision);
 const end=intent('wire-terminal-workstream-0001',context,[{step_id:'end',capability:'workspace.end_workstream',input:{workstream_id:context.workstream_id,expected_revision:active.revision,outcome:'completed'},depends_on:[],idempotency_key:'wire-workstream-end-0001'}]);
 assert.equal(facts(await second.client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(end)}},undefined,{timeout:300000})).state.status,'COMPLETED');
 const beforeCalls=resumed.state.tool_calls.length;const duplicate=facts(await second.client.callTool({name:'dev_pi_execute_intent',arguments:{intent_json:JSON.stringify(contract)}},undefined,{timeout:300000}));assert.equal(duplicate.state.tool_calls.length,beforeCalls);assert.equal(duplicate.projection_hash,resumed.projection_hash);
 const health=await journal.status();assert.equal(health.health,'healthy');assert.equal(health.active_operation_count,0);assert.equal(health.dangling_operation_count,0);
 assert.equal((await git(['rev-parse','HEAD'])).stdout.trim(),base);assert.equal((await git(['status','--porcelain'])).stdout,'');
 const records=(await readdir(path.join(journalRoot,'events'))).sort();const events=await Promise.all(records.map(f=>readFile(path.join(journalRoot,'events',f),'utf8').then(JSON.parse)));
 const calls=events.filter(e=>e.operation_type==='mcp_mutation'&&e.stage==='operation_started'&&e.reconciliation_key?.startsWith('wire-lifecycle-'));
 assert.equal(calls.length,6);const creation=calls.find(e=>e.tool_name==='dev_workspace_create_isolated');assert.equal(creation.workstream_id,context.workstream_id);
 console.log(JSON.stringify({real_MCP:true,SDK_reused:true,cold_pids:[exit.pid,second.transport.pid],workstream_id:context.workstream_id,workspace_id:context.workspace_id,checkpoint_id:checkpoint.checkpoint_id,original_base:base,terminal_duplicate_new_dispatches:0,journal:health,shared_main_unchanged:true}));
});

import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,writeFile,readdir,symlink,rm,lstat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {hashExecutionInput,REQUIRED_DECISION_BOUNDARIES} from '../server/src/pi-execution-contract.mjs';

const exec=promisify(execFile), source=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const shared='dev_workspace_shared_repository_v1';
const decode=r=>{if(r.isError)throw Error(r.content?.[0]?.text??'MCP_TOOL_ERROR');return JSON.parse(r.content.find(c=>c.type==='text').text);};
export function phase2Intent(id,context,actions,bootstrap=false) {
  return {schema_version:1,intent_id:id,goal:'GPT-authorized fixture-only Pi PowerShell verification',
    ...(bootstrap?{bootstrap:true}:{}),context,constraints:['No production or other workspace changes'],requested_actions:actions,
    mutation_plan:actions.filter(a=>a.idempotency_key).map(a=>({step_id:a.step_id,
      target:bootstrap?'bootstrap_workstream':a.capability==='host.powershell'?'canonical-host-maintenance':context.workspace_id,
      expected_change:'Execute precisely authored capability once',input_sha256:hashExecutionInput(a.input)})),
    verification:{focused:[],affected:[],full:[]},completion_conditions:['Verify exact output and durable evidence'],
    permissions:{read:true,workspace_create:bootstrap,write:true,tests:false,commit:false,integrate:false,push:false},
    decision_boundaries:[...REQUIRED_DECISION_BOUNDARIES]};
}
export async function runPhase2E2E({normalCalls=8,outputPath=null,keep=false}={}) {
  const root=await mkdtemp(path.join(os.tmpdir(),'pi-phase2-')),repo=path.join(root,'repo');
  await mkdir(repo);
  const git=args=>exec(process.platform==='win32'?'git.exe':'git',args,{cwd:repo,windowsHide:true,shell:false,timeout:30000,maxBuffer:1024*1024});
  let client,transport,journal;
  const samples=[],runs=[];
  let requestId=1;
  try {
    for(const dir of ['server','scripts'])await cp(path.join(source,dir),path.join(repo,dir),
      {recursive:true,filter:p=>!['node_modules','.tmp'].includes(path.basename(p))});
    await cp(path.join(source,'package.json'),path.join(repo,'package.json'));
    await writeFile(path.join(repo,'.gitignore'),'node_modules/\ndata/outputs/\n');
    await symlink(path.resolve(source,'..','node_modules'),path.join(repo,'node_modules'),'junction');
    await git(['init','-b','main']);
    await git(['add','.']);
    await git(['-c','user.name=Pi phase2 fixture','-c','user.email=pi-phase2@example.invalid','-c','core.hooksPath=NUL','commit','-m','Phase2 exact fixture']);
    const head=(await git(['rev-parse','HEAD'])).stdout.trim();
    const {createDevOperationJournalService}=await import(pathToFileURL(path.join(repo,'server/src/mcp-development-journal-tools.mjs')).href);
    const {createPiProductionRouteStore}=await import(pathToFileURL(path.join(repo,'server/src/pi-production-execution-route.mjs')).href);
    const journalRoot=path.join(repo,'data/outputs/logs/development_runtime/operation-journal');
    await mkdir(path.join(repo,'data/outputs/logs'),{recursive:true});
    journal=createDevOperationJournalService({storageRoot:journalRoot});
    await createPiProductionRouteStore({journal}).change({mode:'pi_default',expected_revision:0,
      decision_id:'gpt-phase2-fixture',gate_hash:'a'.repeat(64)},{validateGate:async()=>true});
    const env={...process.env,MCP_TOOL_PROFILE:'chatgpt_developer',PI_PRESSURE_PHASE2_FIXTURE_ROOT:repo};
    for(const key of Object.keys(env))if(key.startsWith('WRITER_WORKBENCH_ISOLATED_TEST_'))delete env[key];
    transport=new StdioClientTransport({command:process.execPath,args:['--import',
      new URL('./pi-runtime-phase2-trace.mjs',import.meta.url).href,path.join(repo,'server/src/mcp-server.mjs')],cwd:repo,env,stderr:'pipe'});
    transport.stderr?.on('data',chunk=>process.stderr.write(chunk));
    client=new Client({name:'pi-phase2-e2e',version:'1'});await client.connect(transport);
    async function call(name,args,expectedError=false) {
      const start=performance.now();
      const request_id=String(requestId++);
      try {
        const response=await client.callTool({name,arguments:args},undefined,{timeout:300000});
        const value=decode(response);
        samples.push({request_id,name,ms:performance.now()-start,ok:!response.isError,request_result:value.state?.status??null});
        process.stderr.write(JSON.stringify({tool:name,status:value.state?.status??null,ms:samples.at(-1).ms})+'\n');
        return value;
      } catch(error) {
        samples.push({request_id,name,ms:performance.now()-start,ok:false,error:error.message,expected_error:expectedError});
        if(!expectedError)throw error;
        return {error:error.message};
      }
    }
    const schema=await call('dev_capability_get_schema',{capability_name:'host.powershell'});
    assert.equal(schema.risk_class,'low-risk-write');
    const bootstrap=phase2Intent('phase2-bootstrap-0001',{project_id:'writer_workbench',workstream_id:null,workspace_id:shared},[
      {step_id:'begin',capability:'workspace.begin_workstream',input:{label:'Phase2 isolated PowerShell fixture',declared_scope:['scripts/pi-runtime-phase2*']},depends_on:[],idempotency_key:'phase2-fixture-begin-0001'},
      {step_id:'isolate',capability:'workspace.create_isolated',input:{},depends_on:['begin'],idempotency_key:'phase2-fixture-isolate-0001'}],true);
    const boot=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(bootstrap)});
    assert.equal(boot.state.status,'COMPLETED');
    const binding=boot.runtime.lifecycle_binding;
    const context={project_id:'writer_workbench',workspace_id:binding.workspace_id,workstream_id:binding.workstream_id};
    function powershell(id,command="Write-Output 'PI_PHASE2_OK'",timeoutMs=30000) {
      return phase2Intent(id,context,[{step_id:'ps',capability:'host.powershell',input:{command,cwd:'.',timeoutMs},
        depends_on:[],idempotency_key:id+'-key',expected_capability_version:schema.capability_version,expected_schema_hash:schema.schema_hash}]);
    }
    const receipt=value=>decode(value.receipts.find(r=>r.step_id==='ps').evidence);
    for(let i=0;i<normalCalls;i++) {
      const intent=powershell('phase2-normal-'+i+'-0001');
      const result=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(intent)});
      assert.equal(result.state.status,'COMPLETED');
      const fact=receipt(result);assert.equal(fact.exit_code,0);assert.equal(fact.elevated,false);assert.match(fact.stdout,/PI_PHASE2_OK/);
      runs.push({intent_id:intent.intent_id,operation_id:result.state.operation_id,child_operation_id:fact.operation_id,
        command_sha256:fact.command_sha256,exit_code:fact.exit_code,stdout:fact.stdout.trim(),duration_ms:fact.duration_ms});
    }
    const firstIntent=powershell('phase2-normal-0-0001');
    const duplicate=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(firstIntent)});
    assert.equal(duplicate.state.operation_id,runs[0].operation_id);
    const denied=await call('powershell_run',{command:"Write-Output 'MUST_NOT_RUN'",workspace_id:shared},true);
    assert.match(denied.error,/PI_EXECUTION_INTENT_REQUIRED/);
    const deniedIntent=powershell('phase2-denied-permission-0001');deniedIntent.permissions.write=false;
    assert.match((await call('dev_pi_execute_intent',{intent_json:JSON.stringify(deniedIntent)},true)).error,/PERMISSION_DENIED/);
    const concurrent=await Promise.all(Array.from({length:4},(_,i)=>call('dev_pi_execute_intent',
      {intent_json:JSON.stringify(powershell('phase2-concurrent-'+i+'-0001'))})));
    assert(concurrent.every(value=>value.state.status==='COMPLETED'));
    const competition=await Promise.all([
      call('dev_pi_execute_intent',{intent_json:JSON.stringify(powershell('phase2-queue-holder-0001',"Start-Sleep -Seconds 2; Write-Output 'PI_PHASE2_OK'"))}),
      ...Array.from({length:3},()=>call('dev_capability_get_schema',{capability_name:'host.powershell'})),
    ]);
    assert.equal(competition[0].state.status,'COMPLETED');
    const nonzero=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(powershell('phase2-nonzero-0001','exit 7'))});
    const nonzeroFact=receipt(nonzero);
    assert.equal(nonzeroFact.exit_code,7);
    assert.equal(nonzero.state.status,'DECISION_REQUIRED');
    assert.equal((await journal.status()).health,'healthy');
    const timeoutIntent=powershell('phase2-timeout-0001','Start-Sleep -Seconds 3',1000);
    const timeout=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(timeoutIntent)},true);
    assert.match(timeout.error,/JOURNAL_DEGRADED/);
    const retry=await call('dev_pi_execute_intent',{intent_json:JSON.stringify(timeoutIntent)},true);
    assert.match(retry.error,/JOURNAL_DEGRADED/);
    const health=await journal.status();
    assert.equal(health.chain_verified,true);
    assert.equal(health.health,'degraded');
    assert.equal(health.last_health_error,'ambiguous_terminal_operation_requires_reconciliation');
    const events=(await journal.verify()).events;
    const started=events.filter(e=>e.operation_type==='powershell_maintenance'&&e.stage==='operation_started');
    assert.equal(started.length,normalCalls+2+4+1,'duplicates, denied calls and unresolved timeout retry must never spawn another command');
    const timeoutFact=events.find(e=>e.operation_type==='powershell_maintenance'&&e.stage==='operation_completed'&&e.result?.timed_out===true)?.result;
    assert(timeoutFact);
    assert.equal((await git(['rev-parse','HEAD'])).stdout.trim(),head);
    assert.equal((await git(['status','--porcelain'])).stdout,'');
    await client.close();client=null;
    const trace=(await readFile(path.join(root,'trace.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
    const evidence={scope:'isolated actual MCP stdio ingress; not production/ChatGPT connector',pi_dependency_version:'1.0.4',
      source_commit:'8e9b561b86e009e8df86734d980aa586538d8f2e',context,runs,samples,trace,
      server_sha256:createHash('sha256').update(await readFile(path.join(repo,'server/src/mcp-server.mjs'))).digest('hex'),
      nonzero:{status:nonzero.state.status,exit_code:nonzeroFact.exit_code,ok:nonzeroFact.ok,error:nonzero.result},
      timeout:{error:timeout.error,retry_error:retry.error,timed_out:timeoutFact.timed_out,exit_code:timeoutFact.exit_code,ok:timeoutFact.ok,
        reconciliation:'required; automatic restoration deliberately not asserted'},
      concurrent_statuses:concurrent.map(r=>r.state.status),journal:health,physical_dispatches:started.length,
      duplicate_same_operation:true,unauthorized_no_dispatch:true,shared_fixture_head_unchanged:true};
    if(outputPath)await writeFile(outputPath,JSON.stringify(evidence,null,2)+'\n');
    return evidence;
  } catch(error) {
    const failed={error:error.message,fixture:root,samples,runs,journal:journal?await journal.status().catch(e=>({error:e.message})):null,
      trace:await readFile(path.join(root,'trace.jsonl'),'utf8').catch(()=>null)};
    if(outputPath)await writeFile(outputPath,JSON.stringify(failed,null,2)+'\n');
    throw error;
  } finally {
    if(client)await client.close().catch(()=>{});
    if(!keep) {
      assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));
      assert(path.basename(root).startsWith('pi-phase2-'));
      if(await lstat(path.join(repo,'.git')).catch(()=>null)) {
        for(const line of ((await git(['worktree','list','--porcelain'])).stdout.match(/^worktree (.+)$/gm)??[]).slice(1)) {
          const target=path.resolve(line.slice(9));assert.equal(path.dirname(target),path.join(root,'.writer-workbench-worktrees'));
          await git(['worktree','unlock',target]);await git(['worktree','remove',target]);
        }
      }
      await rm(root,{recursive:true,force:true});
    }
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=await runPhase2E2E({outputPath:process.argv[2]??null,keep:process.argv.includes('--keep')});
  console.log(JSON.stringify({scope:result.scope,runs:result.runs,nonzero:result.nonzero,timeout:result.timeout,
    concurrent:result.concurrent_statuses,dispatches:result.physical_dispatches,journal:result.journal},null,2));
}

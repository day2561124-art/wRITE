import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {openSync,closeSync,mkdtempSync,rmSync} from 'node:fs';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStdioSession} from '../../server/src/mcp-http-stdio-adapter.mjs';

// Match the actual headless launcher's DETACHED_PROCESS parent. CREATE_NO_WINDOW
// alone does not reproduce the Windows child-console inheritance difference.
if(process.argv[2]==='--detached-parent'){
  const reportPath=process.argv[3];assert(reportPath);
  const out=openSync(reportPath+'.child.stdout.txt','w');
  const err=openSync(reportPath+'.child.stderr.txt','w');
  try{
    const child=spawn(process.execPath,[process.argv[1],reportPath],{
      cwd:process.cwd(),env:process.env,detached:true,windowsHide:true,stdio:['ignore',out,err],
    });
    const [code]=await once(child,'exit');process.exitCode=code??1;
  }finally{closeSync(out);closeSync(err);}
  process.exit(process.exitCode??0);
}

// Run under the interactive Windows observer, with a console-free Node parent.
// Fault injection only targets ChildProcess objects created by this test.
const sessions=[];
const spawned=[];
const report={platform:process.platform,startedAt:new Date().toISOString(),spawned};
function verifyLoginIdentityContract(){
  const fixture=mkdtempSync(path.join(tmpdir(),'mcp-login-contract-'));
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const q=value=>`'${value.replaceAll("'","''")}'`;
  try{
    const harness=`$ErrorActionPreference='Stop'; $Root=${q(root)}; $private=${q(fixture)};
      $ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $Root 'tests/secure-tunnel-recovery-windows.ps1'),[ref]$null,[ref]$null);
      foreach($name in @('Assert','Get-RecoveryHashes','Get-LoginIdentity','Assert-LoginIdentity')){
        $fn=$ast.Find({param($a) $a -is [Management.Automation.Language.FunctionDefinitionAst] -and $a.Name -eq $name},$false);
        if(-not $fn){throw 'MISSING_ACCEPTANCE_IDENTITY_FUNCTION'}; Invoke-Expression $fn.Extent.Text
      }
      [IO.File]::WriteAllText((Join-Path $private 'launcher.json'),'fixture configuration');
      [IO.File]::WriteAllText((Join-Path $private 'runtime-key.dpapi'),'fixture ciphertext');
      $expected=Get-LoginIdentity; Assert-LoginIdentity $expected;
      $hashes=Get-RecoveryHashes;
      Assert ($hashes.Contains('server/src/mcp-http-stdio-adapter.mjs')) 'ADAPTER_HASH_REQUIRED';
      Assert ($hashes['server/src/mcp-http-stdio-adapter.mjs'] -eq (Get-FileHash (Join-Path $Root 'server/src/mcp-http-stdio-adapter.mjs')).Hash) 'ADAPTER_HASH_MISMATCH';
      [IO.File]::WriteAllText((Join-Path $private 'runtime-key.dpapi'),'changed fixture ciphertext');
      $rejected=$false;try{Assert-LoginIdentity $expected}catch{if($_.Exception.Message -eq 'ARMED_CREDENTIAL_CHANGED'){$rejected=$true}else{throw}};
      Assert $rejected 'CHANGED_CREDENTIAL_ACCEPTED';
      [IO.File]::WriteAllText((Join-Path $private 'runtime-key.dpapi'),'fixture ciphertext');
      [IO.File]::WriteAllText((Join-Path $private 'launcher.json'),'changed fixture configuration');
      $rejected=$false;try{Assert-LoginIdentity $expected}catch{if($_.Exception.Message -eq 'ARMED_CONFIGURATION_CHANGED'){$rejected=$true}else{throw}};
      Assert $rejected 'CHANGED_CONFIGURATION_ACCEPTED';
      $rejected=$false;try{Assert-LoginIdentity $null}catch{if($_.Exception.Message -eq 'ARMED_IDENTITY_REQUIRED'){$rejected=$true}else{throw}};
      Assert $rejected 'MISSING_ARM_IDENTITY_ACCEPTED'; Write-Output 'LOGIN_IDENTITY_CONTRACT_PASS';`;
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',harness],
      {encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(result.status,0,result.stderr||result.stdout||result.error?.message);
    assert(result.stdout.includes('LOGIN_IDENTITY_CONTRACT_PASS'));
  }finally{
    assert.equal(path.dirname(fixture),tmpdir());
    assert(path.basename(fixture).startsWith('mcp-login-contract-'));
    rmSync(fixture,{recursive:true,force:true});
  }
}
const rpc=(session,method,params={})=>new Promise((resolve,reject)=>session.call(
  {jsonrpc:'2.0',id:randomUUID(),method,params},(error,response)=>{
    if(error)reject(error);else if(response.error)reject(Error(JSON.stringify(response.error)));else resolve(response.result);
  }));
async function until(predicate){const deadline=Date.now()+120000;while(!predicate()){
  assert(Date.now()<deadline,'Recovery/readiness deadline exceeded');await new Promise(r=>setTimeout(r,25));
}}
function makeSession(){
  const session=createStdioSession({spawnProcess:(exe,args,options)=>{
    assert.equal(options.windowsHide,true);
    assert.deepEqual(options.stdio,['pipe','pipe','pipe','ipc']);
    const child=spawn(exe,['--import','data:text/javascript,process.stderr.write("windows-console-stderr-probe\\n")',...args],{
      ...options,env:{...options.env,MCP_TOOL_PROFILE:'chatgpt_public'},
    });
    const row={pid:child.pid,windowsHide:options.windowsHide,ipcMessages:0,stdoutBytes:0,stderrBytes:0};spawned.push(row);
    child.on('message',()=>row.ipcMessages++);
    child.stdout.on('data',c=>row.stdoutBytes+=c.length);
    child.stderr.on('data',c=>row.stderrBytes+=c.length);
    return child;
  }});
  sessions.push(session);return session;
}
async function initialize(session){
  await rpc(session,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'windows-console-acceptance',version:'1'}});
  session.send({jsonrpc:'2.0',method:'notifications/initialized'});
  const catalog=await rpc(session,'tools/list');
  assert(catalog.tools.some(t=>t.name==='get_engine_components_status'));
  return catalog.tools.length;
}
try{
  if(process.platform==='win32'){verifyLoginIdentityContract();report.loginIdentityContract='PASS';}
  const first=makeSession();report.singleSessionCatalog=await initialize(first);
  const second=makeSession();report.multiSessionCatalog=await initialize(second);
  const read=session=>rpc(session,'tools/call',{name:'get_engine_components_status',arguments:{}});
  const results=await Promise.all([read(first),read(first),read(second),read(second)]);
  assert(results.every(r=>!r.isError));report.concurrentReadonlyCalls=results.length;
  const secondPid=second.child.pid;
  report.restart=await first.restart();await rpc(first,'tools/list');
  const exited=once(first.child,'exit');first.child.kill();await exited;
  await until(()=>first.getStatus().generation===3&&!first.getStatus().recovering&&first.getStatus().last_recovery?.ok);
  await rpc(first,'tools/list');assert(!(await read(first)).isError);
  assert.equal(second.child.pid,secondPid);assert(second.getStatus().child_alive);
  const status=first.getStatus();
  report.recovered={generation:status.generation,child_alive:status.child_alive,pending_calls:status.pending_calls,
    last_recovery:status.last_recovery,runtime_readiness:status.runtime_readiness};
  assert(spawned.every(row=>row.ipcMessages>0&&row.stdoutBytes>0&&row.stderrBytes>0),'All generations must preserve stdout, stderr and IPC');
  report.pass=true;
}catch(error){report.pass=false;report.error={message:error.message,code:error.code};process.exitCode=1;
}finally{
  await Promise.all(sessions.map(async session=>{const child=session.child;const done=child.exitCode===null&&child.signalCode===null?once(child,'exit'):null;session.close();if(done)await done;}));
  report.ownedProcessesDrained=true;
  if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}

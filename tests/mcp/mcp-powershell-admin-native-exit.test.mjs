import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

if(process.platform!=='win32'){
  console.log('SKIP: requires native Windows PowerShell 5.1');
}else{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const runner=path.join(root,'scripts/mcp-powershell-admin-runner.ps1');
  const sourceHash=createHash('sha256').update(readFileSync(runner)).digest('hex');
  const executable=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
  const quote=s=>"'"+s.replaceAll("'","''")+"'";
  const run=command=>spawnSync(executable,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(command,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:45000,env:{...process.env,PSModulePath:path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/Modules')}});
  const identity=run("[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);@{sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;version=$PSVersionTable.PSVersion.ToString()}|ConvertTo-Json -Compress");
  assert.equal(identity.status,0,identity.stderr);
  const facts=JSON.parse(identity.stdout.trim());assert.match(facts.sid,/^S-1-5-21-(?:\d+-){3}\d+$/);assert.match(facts.version,/^5\.1\./);
  const temp=mkdtempSync(path.join(os.tmpdir(),'writer-admin-native-exit-'));
  const cases=[
    {name:'success',command:"[Console]::WriteLine('success-sentinel');exit 0",exit:0},
    {name:'nonzero7',command:"[Console]::WriteLine('failure7-sentinel');exit 7",exit:7},
    {name:'nonzero19',command:"[Console]::WriteLine('failure19-sentinel');exit 19",exit:19},
    {name:'terminating-error',command:"$ErrorActionPreference='Stop';throw 'own-test-terminating-error'",exit:1},
    {name:'stderr-success',command:"[Console]::Error.WriteLine('own-nonfatal-stderr');exit 0",exit:0},
    {name:'timeout',command:"[Console]::WriteLine('own-bounded-timeout');Start-Sleep -Seconds 60",exit:null,timeout:true},
  ];
  try{
    for(const test of cases){
      const folder=path.join(temp,test.name);mkdirSync(folder);for(const name of ['requests','results','temp'])mkdirSync(path.join(folder,name));
      const config=path.join(folder,'config.json'),id=randomUUID().replaceAll('-','');
      writeFileSync(config,JSON.stringify({schema_version:1,expected_user_sid:facts.sid,allowed_roots:[folder],request_root:folder}));
      writeFileSync(path.join(folder,'requests',id+'.request.json'),JSON.stringify({schema_version:1,request_id:id,command:test.command,cwd:folder,timeout_ms:test.timeout?1000:20000}));
      const command="$ErrorActionPreference='Stop';$bytes=[IO.File]::ReadAllBytes("+quote(runner)+");$h=[Security.Cryptography.SHA256]::Create();try{$actual=([BitConverter]::ToString($h.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()};if($actual -cne '"+sourceHash+"'){throw 'EXACT_RUNNER_TEST_SOURCE'};& ([scriptblock]::Create([Text.UTF8Encoding]::new($false,$true).GetString($bytes))) -ConfigPath "+quote(config);
      const host=run(command);assert.equal(host.error,undefined);assert.equal(host.status,0,host.stderr);
      const result=JSON.parse(readFileSync(path.join(folder,'results',id+'.result.json'),'utf8'));
      assert.equal(result.request_id,id);assert.equal(result.execution_ok,true,JSON.stringify(result));assert.equal(result.exit_code,test.exit,JSON.stringify(result));assert.equal(result.timed_out,test.timeout===true,JSON.stringify(result));
      if(test.name==='nonzero7')assert.match(result.stdout,/failure7-sentinel/);
      if(test.name==='nonzero19')assert.match(result.stdout,/failure19-sentinel/);
      if(test.name==='terminating-error')assert.match(result.stderr,/own-test-terminating-error/);
      if(test.name==='stderr-success')assert.match(result.stderr,/own-nonfatal-stderr/);
      if(test.timeout)assert.equal(result.reason,'PROCESS_TIMEOUT');
      assert.equal(result.stdout_truncated,false);assert.equal(result.stderr_truncated,false);
      console.log('PASS '+test.name+' actual_exit='+JSON.stringify(result.exit_code)+' timed_out='+result.timed_out);
    }
  }finally{
    assert.ok(path.basename(temp).startsWith('writer-admin-native-exit-'));
    assert.equal(path.dirname(temp),path.resolve(os.tmpdir()));
    rmSync(temp,{recursive:true,force:true});
  }
  console.log('PASS 6 native existing-Runner cases; no protected Task, installed Runner, Guest, or Parent changes');
}

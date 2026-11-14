import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createPublicKey,verify} from 'node:crypto';
import {loadProbeCredentials,authenticateProbeRequest} from '../../scripts/probe-mcp-credentials.mjs';
import {runMcpProbe,formatProbeFailure} from '../../scripts/probe-mcp.mjs';
import {getMcpIdentity} from '../../server/src/mcp-http-identity.mjs';
import {createTestOAuthCredentials,createTestProbeCredentialFile} from './fixtures/workbench-http-test-security.mjs';
async function directory(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'probe-auth-fixture-'));t.after(async()=>{const root=await fs.realpath(os.tmpdir()),actual=await fs.realpath(dir);assert.equal(path.dirname(actual).toLowerCase(),root.toLowerCase());assert.match(path.basename(actual),/^probe-auth-fixture-/);await fs.rm(actual,{recursive:true,force:true});});return dir;}
async function listener(t,{authenticated=false}={}){
 const credentials=createTestOAuthCredentials(),calls=[],counts={health:0,ready:0},identity={...getMcpIdentity(),pid:process.pid,instanceId:'probe-auth-instance',profile:'chatgpt_developer',pi_durable_worker:{state:'idle',pid:process.pid}};
 const key=createPublicKey({key:JSON.parse(credentials.publicJwk),format:'jwk'});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url==='/health'){counts.health++;res.end(JSON.stringify(identity));return;}
  if(req.url==='/ready'){counts.ready++;assert.equal(req.headers['mcp-session-id'],'probe-auth-session');res.end(JSON.stringify({ready:true,child:{generation:1,runtime_readiness:{state:'ready'}}}));return;}
  if(req.url!=='/mcp'){res.writeHead(404).end();return;}
  if(req.method==='GET'){res.writeHead(405).end();return;}
  if(req.method==='DELETE'){res.writeHead(204).end();return;}
  let raw='';for await(const chunk of req)raw+=chunk;
  const message=JSON.parse(raw),proof=message.params?._meta?.workbench_http_access_token;
  assert.equal(req.headers.authorization,undefined,'raw bearer must not reach the private upstream');
  if(authenticated){const parts=proof?.split('.')??[],valid=parts.length===3&&verify('sha256',Buffer.from(parts[0]+'.'+parts[1]),{key,dsaEncoding:'ieee-p1363'},Buffer.from(parts[2],'base64url'));if(!valid){res.end(JSON.stringify({jsonrpc:'2.0',id:message.id??null,error:{code:-32001,message:'INVALID_TOKEN'}}));return;}}
  calls.push(message);if(!Object.hasOwn(message,'id')){res.writeHead(202).end();return;}
  if(message.method==='initialize')res.setHeader('Mcp-Session-Id','probe-auth-session');
  const result=message.method==='initialize'?{protocolVersion:message.params.protocolVersion,capabilities:{tools:{},resources:{}},serverInfo:{name:'armed-academy-fiction-engine',version:'0.1.0'}}:message.method==='tools/list'?{tools:[{name:'fixture_read',inputSchema:{type:'object'}}]}:message.method==='resources/list'?{resources:[]}:{};
  res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
 });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});return {endpoint:`http://127.0.0.1:${server.address().port}/mcp`,credentials,calls,counts,identity};
}
const code=expected=>error=>error.code===expected;

test('probe credentials are bounded/private/pinned; only protocol mode needs a credential',async t=>{
 const dir=await directory(t),f=await listener(t),file=await createTestProbeCredentialFile(dir,f.endpoint,f.credentials);
 const c=await loadProbeCredentials(file,f.endpoint);assert.equal(c.accessToken,f.credentials.proof);assert.equal(c.bearer,false);assert.equal(await loadProbeCredentials(undefined,f.endpoint),null);
 await assert.rejects(loadProbeCredentials(file,'http://127.0.0.1:1/mcp'),code('MCP_AUTH_TARGET_MISMATCH'));
 await assert.rejects(loadProbeCredentials(path.join(dir,'missing.json'),f.endpoint),code('MCP_AUTH_CONFIGURATION_INVALID'));
 const raw=JSON.parse(await fs.readFile(file,'utf8'));raw.extra='SYNTHETIC_SECRET_DO_NOT_LOG';await fs.writeFile(file,JSON.stringify(raw));await assert.rejects(loadProbeCredentials(file,f.endpoint),code('MCP_AUTH_CONFIGURATION_INVALID'));assert.equal(f.counts.health,0);
});

test('probe refuses broad ACL, symlink parents, oversized and expired credential files',async t=>{
 const dir=await directory(t),f=await listener(t),file=await createTestProbeCredentialFile(dir,f.endpoint,f.credentials);
 if(process.platform==='win32'){
  const script=`$ErrorActionPreference='Stop';$a=[IO.File]::GetAccessControl($env:WRITER_PROBE_TEST_FILE,[Security.AccessControl.AccessControlSections]::Access);$i=[Security.Principal.SecurityIdentifier]::new('S-1-1-0');$r=[Security.AccessControl.FileSystemAccessRule]::new($i,'Read','Allow');$a.AddAccessRule($r);[IO.File]::SetAccessControl($env:WRITER_PROBE_TEST_FILE,$a)`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,WRITER_PROBE_TEST_FILE:file,PSModulePath:path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/Modules')},timeout:3000,encoding:'utf8'});assert.equal(result.status,0,'Synthetic DACL fixture failed: '+String(result.stderr??'').slice(0,2000));
 }else await fs.chmod(file,0o644);
 await assert.rejects(loadProbeCredentials(file,f.endpoint),code('MCP_AUTH_CONFIGURATION_INVALID'));
 const link=path.join(dir,'junction'),target=path.join(dir,'target');await fs.mkdir(target);await fs.symlink(target,link,process.platform==='win32'?'junction':'dir');const linked=await createTestProbeCredentialFile(target,f.endpoint,f.credentials);await assert.rejects(loadProbeCredentials(path.join(link,path.basename(linked)),f.endpoint),code('MCP_AUTH_CONFIGURATION_INVALID'));
 const large=await createTestProbeCredentialFile(dir,f.endpoint,f.credentials);await fs.writeFile(large,'x'.repeat(16385));await assert.rejects(loadProbeCredentials(large,f.endpoint),code('MCP_AUTH_CONFIGURATION_INVALID'));
 const parts=f.credentials.proof.split('.'),claims=JSON.parse(Buffer.from(parts[1],'base64url'));claims.exp=1;parts[1]=Buffer.from(JSON.stringify(claims)).toString('base64url');const expired=await createTestProbeCredentialFile(dir,f.endpoint,f.credentials,parts.join('.'));await assert.rejects(loadProbeCredentials(expired,f.endpoint),code('MCP_AUTH_CREDENTIAL_EXPIRED'));
});

test('proof accompanies initialize, notifications and catalog requests; raw bearer is only sent to the pinned HTTPS resource',async t=>{
 const dir=await directory(t),f=await listener(t),file=await createTestProbeCredentialFile(dir,f.endpoint,f.credentials),c=await loadProbeCredentials(file,f.endpoint);
 for(const method of ['initialize','notifications/initialized','tools/list','resources/list','ping']){
  const request=authenticateProbeRequest(f.endpoint,{method:'POST',headers:{authorization:'Bearer WRONG','content-length':'1'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params:{_meta:{keep:'fixture',workbench_http_access_token:'forged'}}})},c),body=JSON.parse(request.body);
  assert.equal(request.headers.get('authorization'),null);assert.equal(request.headers.get('content-length'),null);assert.equal(body.params._meta.keep,'fixture');assert.equal(body.params._meta.workbench_http_access_token,f.credentials.proof);
 }
 const raw=JSON.parse(await fs.readFile(file,'utf8')),remote=await loadProbeCredentials(file,raw.resource),headers=authenticateProbeRequest(raw.resource,{method:'GET'},remote).headers;assert.equal(headers.get('authorization'),'Bearer '+f.credentials.proof);
 for(const url of ['https://foreign.invalid/mcp',new URL('/other',f.endpoint).href])assert.throws(()=>authenticateProbeRequest(url,{method:'GET'},c),code('MCP_AUTH_TARGET_MISMATCH'));
 for(const body of ['[]','not json',JSON.stringify({method:'ping',params:{_meta:'unsafe'}})])assert.throws(()=>authenticateProbeRequest(f.endpoint,{method:'POST',body},c),code('MCP_AUTH_CONFIGURATION_INVALID'));
});

test('actual SDK completes full protocol with signed proof on every request and no secret in returned diagnostics',async t=>{
 const dir=await directory(t),f=await listener(t,{authenticated:true}),file=await createTestProbeCredentialFile(dir,f.endpoint,f.credentials);
 const result=await runMcpProbe({endpoint:f.endpoint,credentialFile:file,expectedInstance:f.identity.instanceId,startupBudgetMs:10000,hardDeadlineMs:12000,operationTimeoutMs:3000});
 assert.equal(result.protocolVerified,true);assert.equal(result.authenticated,true);assert.equal(result.probeKind,'protocol');assert.equal(result.resourceCount,0);assert.ok(f.counts.ready>0);assert.ok(f.calls.some(c=>c.method==='ping'));for(const request of f.calls)assert.equal(request.params._meta.workbench_http_access_token,f.credentials.proof);assert.ok(!JSON.stringify(result).includes(f.credentials.proof));assert.ok(!JSON.stringify(result).includes(file));
});

for(const phase of ['initialize','resources/list'])test('authentication failure is terminal, redacted and never retries runtime readiness: '+phase,async t=>{
 const f=await listener(t),failure=Object.assign(new Error('MCP error -32001: AUTHENTICATION_REQUIRED'),{code:-32001}),start=Date.now();let closed=0;
 const createClientFactory=()=>({transport:{sessionId:'probe-auth-session',async terminateSession(){closed++;}},client:{async connect(){if(phase==='initialize')throw failure;},getServerVersion(){return{name:'armed-academy-fiction-engine'};},async listTools(){return{tools:[{name:'fixture'}]};},async listResources(){throw failure;},async close(){}}});
 await assert.rejects(runMcpProbe({endpoint:f.endpoint,credentialFile:'',createClientFactory,startupBudgetMs:3000,hardDeadlineMs:4000}),error=>{assert.equal(error.code,'MCP_AUTHENTICATION_FAILED');const serialized=formatProbeFailure(error);assert.ok(!serialized.includes('Bearer'));assert.ok(!serialized.includes('SYNTHETIC_SECRET'));return true;});assert.ok(Date.now()-start<2000);assert.equal(f.counts.ready,0);assert.equal(closed,1);
});

test('local health is loopback-only, creates no MCP session, and does not claim full protocol or load a credential',async t=>{
 const f=await listener(t),result=await runMcpProbe({endpoint:f.endpoint,mode:'local-health',credentialFile:'C:/SYNTHETIC_MISSING.json',createClientFactory(){throw Error('MUST_NOT_OPEN_MCP_SESSION');}});
 assert.equal(result.ready,true);assert.equal(result.protocolVerified,false);assert.equal(result.probeKind,'local-health');assert.equal(result.toolCount,undefined);assert.equal(f.calls.length,0);
 await assert.rejects(runMcpProbe({endpoint:'https://remote.invalid/mcp',mode:'local-health',credentialFile:''}),code('LOCAL_HEALTH_LOOPBACK_REQUIRED'));
});


test('real probe CLI drains Windows fetch handles and keeps exact success/authentication-failure exit statuses',async t=>{
 const f=await listener(t,{authenticated:true}),entry=fileURLToPath(new URL('../../scripts/probe-mcp.mjs',import.meta.url));
 async function invoke(mode){return new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,[entry,f.endpoint,mode,f.identity.instanceId],{cwd:path.resolve(path.dirname(entry),'..'),windowsHide:true,env:{...process.env,WRITER_WORKBENCH_PROBE_CREDENTIAL_FILE:'',PROBE_STARTUP_BUDGET_MS:'3000',PROBE_HARD_DEADLINE_MS:'5000',PROBE_OP_TIMEOUT_MS:'2000'}});let stdout='',stderr='';
  const timer=setTimeout(()=>{child.kill();reject(Error('Owned probe CLI exceeded deadline'));},10000);
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('close',(code,signal)=>{clearTimeout(timer);resolve({code,signal,stdout,stderr});});
 });}
 for(let n=0;n<3;n++){const r=await invoke('local-health');assert.equal(r.code,0,r.stderr);assert.equal(r.signal,null);const d=JSON.parse(r.stdout);assert.equal(d.protocolVerified,false);assert.equal(d.ready,true);}
 const denied=await invoke('probe');assert.equal(denied.code,1,denied.stderr);assert.equal(denied.signal,null);assert.equal(denied.stdout,'');assert.equal(JSON.parse(denied.stderr).code,'MCP_AUTHENTICATION_FAILED');assert.ok(!denied.stderr.includes(f.credentials.proof));
});

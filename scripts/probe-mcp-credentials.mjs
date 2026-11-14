import {lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
export class ProbeCredentialError extends Error {
  constructor(code='MCP_AUTH_CONFIGURATION_INVALID') { super(code); this.name='ProbeCredentialError'; this.code=code; }
}
const fail=code=>{throw new ProbeCredentialError(code);};
const windowsAclScript=`$ErrorActionPreference='Stop'
try {
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $allowed=@($sid,'S-1-5-18','S-1-5-32-544')
 $acl=Get-Acl -LiteralPath $env:WRITER_PROBE_INTERNAL_CREDENTIAL_PATH
 $owner=(New-Object Security.Principal.NTAccount($acl.Owner)).Translate([Security.Principal.SecurityIdentifier]).Value
 if($allowed -notcontains $owner){exit 2}
 foreach($rule in $acl.Access){
  if($rule.AccessControlType -eq 'Allow'){
   $identity=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
   if($allowed -notcontains $identity){exit 3}
  }
 }
 Write-Output 'PRIVATE'
} catch {exit 4}`;
async function readCredentialFile(filename){
 if(typeof filename!=='string'||!path.isAbsolute(filename)||filename.startsWith('\\\\'))return fail();
 const file=path.resolve(filename),parsed=path.parse(file);let cursor=parsed.root;
 for(const part of file.slice(parsed.root.length).split(path.sep)){cursor=path.join(cursor,part);const item=await lstat(cursor);if(item.isSymbolicLink()||(cursor===file?!item.isFile()||item.size>16384:!item.isDirectory()))return fail();}
 const handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
 try {
  const stat=await handle.stat();if(!stat.isFile()||stat.size>16384)return fail();
  if(process.platform==='win32'){
   const acl=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',windowsAclScript],{env:{...process.env,WRITER_PROBE_INTERNAL_CREDENTIAL_PATH:file,PSModulePath:path.join(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/Modules')},windowsHide:true,encoding:'utf8',timeout:3000,maxBuffer:4096});
   if(acl.error||acl.status!==0||acl.stdout.trim()!=='PRIVATE')return fail();
  }else if((stat.mode&0o077)!==0)return fail();
  const bytes=Buffer.alloc(16385);let length=0;
  while(length<bytes.length){const part=await handle.read(bytes,length,bytes.length-length,null);if(!part.bytesRead)break;length+=part.bytesRead;}
  const after=await lstat(file);if(length>16384||after.isSymbolicLink()||stat.dev!==after.dev||stat.ino!==after.ino||stat.size!==length||after.size!==length)return fail();
  return JSON.parse(bytes.subarray(0,length).toString('utf8').replace(/^\uFEFF/,''));
 }finally{await handle.close();}
}
/** Opt-in OS-owner input only. Missing/invalid configured credentials never fall back to anonymous. */
export async function loadProbeCredentials(filename,endpoint){
 if(filename===undefined||filename==='')return null;
 try{
  const raw=await readCredentialFile(filename);
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).sort().join(',')!=='access_token,resource,schema,upstream_origin'||raw.schema!=='workbench-probe/1.0'||typeof raw.resource!=='string'||raw.resource.length>512||typeof raw.access_token!=='string'||raw.access_token.length>8192||!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test('Bearer '+raw.access_token))return fail();
  const resource=new URL(raw.resource),target=new URL(endpoint);
  if(resource.protocol!=='https:'||resource.username||resource.password||resource.pathname!=='/mcp'||resource.search||resource.hash||target.username||target.password||target.search||target.hash||target.pathname!=='/mcp')return fail();
  let upstream=null;if(raw.upstream_origin!==null){if(typeof raw.upstream_origin!=='string'||raw.upstream_origin.length>256)return fail();const url=new URL(raw.upstream_origin);if(url.protocol!=='http:'||!['127.0.0.1','[::1]'].includes(url.hostname)||Number(url.port)<1024||Number(url.port)>65535||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return fail();upstream=url.origin;}
  if(target.href!==resource.href&&(!upstream||target.origin!==upstream))return fail('MCP_AUTH_TARGET_MISMATCH');
  const claims=JSON.parse(Buffer.from(raw.access_token.split('.')[1],'base64url').toString('utf8'));
  if(!Number.isSafeInteger(claims.exp)||claims.exp<=Math.floor(Date.now()/1000))return fail('MCP_AUTH_CREDENTIAL_EXPIRED');
  if(!(claims.aud===resource.href||Array.isArray(claims.aud)&&claims.aud.includes(resource.href)))return fail();
  return Object.freeze({accessToken:raw.access_token,origin:target.origin,bearer:target.href===resource.href});
 }catch(error){if(error instanceof ProbeCredentialError)throw error;return fail();}
}
/** Applies standard Bearer transport auth and cryptographic IPC proof only to the pinned endpoint. */
export function authenticateProbeRequest(url,init,credentials){
 if(!credentials)return init;
 let target;try{target=new URL(url);}catch{return fail('MCP_AUTH_TARGET_MISMATCH');}
 if(target.origin!==credentials.origin||!['/mcp','/health','/ready'].includes(target.pathname)||target.username||target.password)return fail('MCP_AUTH_TARGET_MISMATCH');
 const headers=new Headers(init.headers);if(credentials.bearer)headers.set('authorization','Bearer '+credentials.accessToken);else headers.delete('authorization');headers.delete('content-length');
 let body=init.body;
 if(target.pathname==='/mcp'&&String(init.method??'GET').toUpperCase()==='POST'){
  try{
   if(typeof body!=='string')return fail();const message=JSON.parse(body);
   if(!message||typeof message!=='object'||Array.isArray(message)||typeof message.method!=='string'||message.params!==undefined&&(message.params===null||typeof message.params!=='object'||Array.isArray(message.params)))return fail();
   const params=message.params??{},meta=params._meta??{};if(typeof meta!=='object'||meta===null||Array.isArray(meta))return fail();
   body=JSON.stringify({...message,params:{...params,_meta:{...meta,workbench_http_access_token:credentials.accessToken}}});
  }catch(error){if(error instanceof ProbeCredentialError)throw error;return fail();}
 }
 return {...init,headers,...(body===undefined?{}:{body})};
}

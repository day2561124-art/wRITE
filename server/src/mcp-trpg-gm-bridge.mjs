import {pathToFileURL} from 'node:url';
const readNames=new Set(['trpg.gm.get_round_context','trpg.gm.get_pending_actions','trpg.gm.get_character_context','trpg.gm.get_scenario_context','trpg.gm.get_asset_metadata','trpg.gm.get_scenario_import']);
const attachmentName='trpg.gm.stage_scenario_attachment';
const previewName='trpg.gm.preview_scenario_publish',publishName='trpg.gm.publish_scenario';
const writeNames=new Set([attachmentName,previewName,publishName,'trpg.gm.claim_round','trpg.gm.commit_round_result']);
const error=code=>({isError:true,content:[{type:'text',text:JSON.stringify({error:{code,retryable:false}})}]});
const empty=(status='disabled')=>Object.freeze({status,tools:Object.freeze([]),instruction:'',callTool:async()=>error('TOOL_NOT_AUTHORIZED')});
const loadFailureCodes=new Set(['INVALID_BRIDGE_CONFIGURATION','INVALID_CREDENTIAL_FILE','INVALID_GATEWAY_ADDRESS','GATEWAY_AUTHORIZATION_FAILED']);
export function isTRPGGMToolName(name){return readNames.has(name)||writeNames.has(name);}
// The sole deployment path is the user's existing TRPG checkout. No tool input
// or environment-selected module can redirect imports, credentials or endpoints.
const loadModule=()=>import(pathToFileURL('E:\\TRPG\\apps\\gm-adapter\\dist\\writer-workbench.js').href);
export function isTRPGTransportTrusted({ipc=typeof process.send==='function',trustedLocalOwner=process.argv.includes('--trusted-local-owner')}={}){
 // Stdio under the local Windows owner can read its private credential file.
 // Remote IPC needs a verified request token. Only an OS-owner process argument trusts the local Pi CLI.
 return ipc===false||trustedLocalOwner===true;
}
export async function loadTRPGGMBridge({load=loadModule,disabled=process.argv.includes('--pi-worker')||process.env.WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL==='1'||process.env.MCP_TOOL_PROFILE?.trim()==='chatgpt_public'||!isTRPGTransportTrusted(),onDisabled=reason=>process.stderr.write(`TRPG_GM_BRIDGE_UNAVAILABLE ${reason}\n`)}={}){
 if(disabled)return empty();
 try{
  const provider=await load(),bridge=await provider.loadWriterWorkbenchBridge();
  if(bridge===null)return empty();
  if(bridge?.protocol!=='trpg-writer-workbench-bridge/1.0'||!Array.isArray(bridge.tools)||bridge.tools.length>readNames.size+writeNames.size||typeof bridge.instruction!=='string'||bridge.instruction.length>4096)throw Error();
  const byName=new Map();
  for(const tool of bridge.tools){
   const read=readNames.has(tool.name),write=writeNames.has(tool.name);
   if((!read&&!write)||byName.has(tool.name)||tool.risk!==(read?'read':'high-risk-write')||tool.annotations?.readOnlyHint!==read||tool.inputSchema?.type!=='object'||tool.inputSchema.additionalProperties!==false||typeof tool.handler!=='function')throw Error();
   byName.set(tool.name,tool);
  }
  return Object.freeze({status:'ready',tools:Object.freeze([...byName.values()]),instruction:bridge.instruction,
   async callTool(name,args){
    const tool=byName.get(name);if(!tool)return error('TOOL_NOT_AUTHORIZED');
    try{return await tool.handler(args);}
    catch{return {isError:true,content:[{type:'text',text:JSON.stringify({error:{code:'TRPG_GATEWAY_UNAVAILABLE',retryable:true,instruction:'Do not infer whether a write committed. Preserve the original command and idempotency key.'}})}]};}
   }});
 }catch(e){
  onDisabled(loadFailureCodes.has(e?.message)?e.message:'BRIDGE_LOAD_FAILED');
  return empty('unavailable');
 }
}

/** Called after transport authorization. Only validated tools reach the registry. */
export function createTRPGGMBridgeRegistration({enabled,register,load=()=>loadTRPGGMBridge({disabled:false})}){
 let current=empty();
 let pending;
 return Object.freeze({
  get current(){return current;},
  async ensure(){
   if(!enabled||current.tools.length)return current;
   pending??=Promise.resolve().then(load).then(bridge=>{
    if(bridge.tools.length)register(bridge.tools);
    current=bridge;
    return current;
   }).finally(()=>{pending=undefined;});
   return pending;
  },
 });
}
export function trpgPublicToolDefinition(tool){
 return {name:tool.name,description:'['+tool.risk+'] '+tool.description,inputSchema:tool.inputSchema,annotations:tool.annotations,
  _meta:{'trpg/execution_domain':'TRPG_GM_CONFIDENTIAL','trpg/authority':'TRPG campaign credential; never Writer/Canon or engineering authority',
   ...(tool.name===attachmentName?{'openai/fileParams':['file'],'trpg/idempotency':'The qualified attachment SHA-256 identifies the draft request; never publish through this tool.'}:tool.name===previewName?{'trpg/approval':'Preview only. Review the returned plan without changing the live world.'}:tool.name===publishName?{'trpg/approval':'Use the exact preview receipt and revision after explicit campaign publication authorization. On uncertainty, check status or retry the same receipt.'}:writeNames.has(tool.name)?{'trpg/idempotency':'Preserve GMResolution idempotency_key on retries; audit and transactions belong to TRPG, not Writer development journal.'}:{})}};
}

const loadSecurityModule=()=>import(pathToFileURL('E:\\TRPG\\apps\\gm-adapter\\dist\\workbench-security.js').href);
async function defaultSecurityLoader(){
 const args=process.argv.filter(value=>value.startsWith('--workbench-security-config='));
 if(args.length>1)throw Error('INVALID_PRIVATE_CONFIGURATION');
 const {loadWorkbenchSecurity}=await loadSecurityModule();
 return loadWorkbenchSecurity(args.length?{configFile:args[0].slice('--workbench-security-config='.length)}:{});
}
/** Per-request cryptographic authentication for IPC; no model metadata grants trust. */
export function createWorkbenchTransportBoundary({ipc=typeof process.send==='function',trustedLocalOwner=process.argv.includes('--trusted-local-owner'),loadSecurity=defaultSecurityLoader}={}){
 const local=ipc===false||trustedLocalOwner===true;
 let security=null,loading=null,principal=null,gmOnly=false;
 const knownGM=isTRPGGMToolName;
 return Object.freeze({
  get local(){return local;},get gmOnly(){return gmOnly;},
  isToolAllowed(name){return !gmOnly||knownGM(name);},
  async authorize(message){
   if(!local){
    const proof=message?.params?._meta?.workbench_http_access_token;
    if(typeof proof!=='string'||proof.length>8192)return {ok:false,code:'AUTHENTICATION_REQUIRED'};
    let decision;
    try{
     if(!security){loading??=Promise.resolve().then(loadSecurity);try{security=await loading;}finally{loading=null;}}
     if(typeof security?.verifier?.authorize!=='function')return {ok:false,code:'AUTHENTICATION_UNAVAILABLE'};
     decision=await security.verifier.authorize({authorization:'Bearer '+proof});
    }catch{return {ok:false,code:'AUTHENTICATION_UNAVAILABLE'};}
    if(!decision.ok)return {ok:false,code:decision.code};
    if(principal!==null&&principal!==decision.principal.key)return {ok:false,code:'MCP_SESSION_OWNER_MISMATCH'};
    principal=decision.principal.key;
   }
   if(message?.method==='tools/call'&&knownGM(message.params?.name)||message?.params?._meta?.workbench_purpose==='GM')gmOnly=true;
   if(gmOnly&&!['initialize','ping','tools/list','tools/call','notifications/initialized'].includes(message?.method))return {ok:false,code:'GM_CONNECTION_METHOD_DENIED'};
   if(gmOnly&&message?.method==='tools/call'&&!knownGM(message.params?.name))return {ok:false,code:'GM_CONNECTION_TOOL_DENIED'};
   return {ok:true,local,principal};
  },
  close(){security?.close?.();security=null;},
 });
}

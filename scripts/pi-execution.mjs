import {pathToFileURL} from "node:url";
import {createStdioSession} from "../server/src/mcp-http-stdio-adapter.mjs";
import {createExecutionIntent,hashExecutionInput} from "../server/src/pi-execution-contract.mjs";
const transient=new Set(["CHILD_HUNG","CHILD_CALL_TIMEOUT","CHILD_EXITED","CHILD_PROCESS_EXITED","CHILD_RECOVERY_NOT_READY","TRANSPORT_ERROR"]);
const done=new Set(["COMPLETED","FAILED","CANCELLED","DECISION_REQUIRED","BLOCKED"]);
function fail(code){throw Object.assign(new Error(code),{code});}
function connect(){if(!process.env.MCP_TOOL_PROFILE)process.env.MCP_TOOL_PROFILE="chatgpt_developer";
 return createStdioSession({readonlyRetryMaxAttempts:0});}
function rpc(session,message){return new Promise((resolve,reject)=>session.call(message,(error,response)=>{
 if(error){reject(error);return;}if(response?.error){reject(Object.assign(new Error("PI_REQUEST_REJECTED"),{code:"PI_REQUEST_REJECTED"}));return;}
 resolve(response?.result);
}));}
function facts(response){if(response?.isError){const raw=response.content?.[0]?.text??"";
 fail(/^[A-Z][A-Z0-9_]{0,63}$/u.test(raw)?raw:"PI_REQUEST_REJECTED");}
 if(response?.structuredContent)return response.structuredContent;
 try{return JSON.parse(response.content.find(x=>x.type==="text").text);}catch{fail("INVALID_PI_RESPONSE");}}
async function initialize(s){await rpc(s,{jsonrpc:"2.0",id:"pi-cli-init",method:"initialize",
 params:{protocolVersion:"2024-11-05",capabilities:{},clientInfo:{name:"pi-execution-host",version:"1"}}});
 s.send({jsonrpc:"2.0",method:"notifications/initialized",params:{}});}
export async function submitPiExecutionIntent(source,{sessionFactory=connect,sleep=ms=>new Promise(r=>setTimeout(r,ms)),clock=Date.now,deadlineMs=1800000}={}){
 const intent=createExecutionIntent(source),args={intent_json:JSON.stringify(intent)};
 if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>1800000)fail("INVALID_SUBMISSION_DEADLINE");
 let session=null,retries=0,last=null,sequence=0;const deadline=clock()+deadlineMs;
 try{while(clock()<deadline){try{
  if(!session){session=sessionFactory();await initialize(session);}
  last=facts(await rpc(session,{jsonrpc:"2.0",id:"pi-cli-submit-"+(++sequence),method:"tools/call",params:{name:"dev_pi_execute_intent",arguments:args}}));
  if(!last?.state?.operation_id||last.intent?.intent_id!==intent.intent_id||hashExecutionInput(last.intent)!==hashExecutionInput(intent)
   ||last.state.intent_id!==intent.intent_id||last.state.intent_hash!==hashExecutionInput(intent))fail("INVALID_PI_RESPONSE");
  if(done.has(last.state.status))return last;
  await sleep(1000);
 }catch(error){if(!transient.has(error?.code)||++retries>3)throw error;
  session?.close();session=null;await sleep(Math.min(5000,250*2**(retries-1)));
 }}
 if(last)return {submission_pending:true,reason:"PI_SUBMISSION_DEADLINE",operation:last};
 fail("PI_SUBMISSION_DEADLINE");
 }finally{session?.close();}
}
export async function readPiExecutionStatus(args={}, {sessionFactory=connect}={}){
 const s=sessionFactory();try{await initialize(s);return facts(await rpc(s,{jsonrpc:"2.0",id:"pi-cli-status",
 method:"tools/call",params:{name:"dev_pi_execution_status",arguments:args}}));}finally{s.close();}
}
export async function readPiIntentJson(input=process.stdin){
 input.setEncoding("utf8");let text="";
 for await(const chunk of input){text+=chunk;if(Buffer.byteLength(text)>524288)fail("INTENT_SIZE_LIMIT");}
 return text.trim()?JSON.parse(text):{};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.slice(2).some(a=>a!=="--status")||process.argv.slice(2).length>1)fail("INVALID_CLI_ACTION");
 const value=await readPiIntentJson();const result=process.argv[2]==="--status"?await readPiExecutionStatus(value):await submitPiExecutionIntent(value);
 process.stdout.write(JSON.stringify(result)+"\n");
 }catch(error){process.stdout.write(JSON.stringify({ok:false,code:/^[A-Z][A-Z0-9_]{0,63}$/u.test(error?.code??"")?error.code:"PI_SUBMISSION_FAILED"})+"\n");process.exitCode=1;}
}

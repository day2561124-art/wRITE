import {spawn} from 'node:child_process';
import path from 'node:path';
import {projectRoot} from './project-paths.mjs';
import {controlledProcessEnvironment} from './process-control.mjs';
import {PI_DURABLE_WORKER_PROTOCOL} from './pi-durable-worker-protocol.mjs';

// The long-lived HTTP host owns this process independently of MCP sessions.
// The journal remains the sole work queue and owner/CAS authority.
export function createPiDurableWorkerSupervisor({spawnProcess=spawn,root=projectRoot,
 enabled=true,minRestartMs=1000,maxRestartMs=60000,onStatus=()=>{}}={}){
 let child=null,restartTimer=null,closed=false,attempts=0;
 let status={protocol:PI_DURABLE_WORKER_PROTOCOL,state:enabled?'starting':'disabled',pid:null,restarts:0,operation_id:null,last_exit:null};
 const publish=patch=>{status={...status,...patch};onStatus({...status});};
 function start(){
  if(closed||!enabled)return;
  const testEnvironment=Object.fromEntries(Object.entries(process.env).filter(([key])=>
   key.startsWith('WRITER_WORKBENCH_ISOLATED_TEST_')||key==='WRITER_WORKBENCH_TEST_JOURNAL_GROUP'));
  const worker=spawnProcess(process.execPath,[path.join(root,'server/src/mcp-server.mjs'),'--pi-worker'],{
   cwd:root,windowsHide:true,stdio:['ignore','ignore','pipe','ipc'],
   env:controlledProcessEnvironment({...testEnvironment,MCP_TOOL_PROFILE:'chatgpt_developer'}),
  });
  const started=Date.now();child=worker;publish({state:'starting',pid:worker.pid??null});
  // Child errors contain no commands or caller-selected data in this channel.
  worker.stderr?.on('data',()=>{});
  worker.on('message',message=>{
   if(message?.protocol!==PI_DURABLE_WORKER_PROTOCOL||message.pid!==worker.pid
    ||!['ready','executing','idle','drained','failed'].includes(message.kind))return;
   publish({state:message.kind,pid:worker.pid,operation_id:/^pi_operation_[a-f0-9]{32}$/.test(message.operation_id??'')?message.operation_id:null});
  });
  worker.once('error',()=>publish({state:'spawn_failed'}));
  worker.once('close',(code,signal)=>{
   if(child!==worker)return;child=null;
   publish({state:closed?'stopped':'restarting',pid:null,operation_id:null,last_exit:{code,signal}});
   if(!closed){attempts=Date.now()-started>=60000?1:attempts+1;publish({restarts:status.restarts+1});
    restartTimer=setTimeout(start,Math.min(maxRestartMs,minRestartMs*2**Math.min(attempts-1,10)));}
  });
 }
 function drain(){
  closed=true;clearTimeout(restartTimer);
  if(child?.connected){publish({state:'draining'});child.send({protocol:PI_DURABLE_WORKER_PROTOCOL,kind:'drain'},()=>{});}
  else if(!child)publish({state:'stopped'});
 }
 start();
 return Object.freeze({getStatus:()=>({...status,last_exit:status.last_exit?{...status.last_exit}:null}),drain});
}

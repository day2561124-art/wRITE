import {setTimeout as wait} from 'node:timers/promises';
import {localOwnerAlive} from './pi-reliable-execution-store.mjs';

import {PI_DURABLE_WORKER_PROTOCOL} from './pi-durable-worker-protocol.mjs';
export {PI_DURABLE_WORKER_PROTOCOL};

// This is an awaited process lifetime, never an unobserved request promise.
// All execution, ownership, retries and reconciliation stay in the Pi engine.
export async function runPiDurableWorker({controller,signal,ready,intervalMs=5000,
 observe=event=>process.send?.(event)}={}){
 if(!controller||typeof controller.discover!=='function'||typeof controller.execute!=='function'
  ||!Number.isSafeInteger(intervalMs)||intervalMs<10||intervalMs>60000)throw Error('INVALID_DURABLE_WORKER_BINDING');
 const lifetime=new AbortController();
 const stop=()=>lifetime.abort();
 const onMessage=message=>{if(message?.protocol===PI_DURABLE_WORKER_PROTOCOL&&message.kind==='drain')stop();};
 const notify=(kind,extra={})=>observe({protocol:PI_DURABLE_WORKER_PROTOCOL,kind,pid:process.pid,...extra});
 process.on('message',onMessage);process.once('SIGTERM',stop);process.once('SIGINT',stop);process.once('disconnect',stop);
 signal?.addEventListener('abort',stop,{once:true});if(signal?.aborted)stop();
 try{
  await ready?.();
  notify('ready');
  while(!lifetime.signal.aborted){
   // Discovery performs a new verified journal read on every pass. An omitted
   // wake, dead submitter or restarted worker cannot drop an admitted operation.
   const pending=await controller.discover({limit:128});
   let ran=false;
   for(const record of pending){
    if(lifetime.signal.aborted)break;
    if(record.runtime.owner&&localOwnerAlive(record.runtime.owner)!==false)continue;
    notify('executing',{operation_id:record.state.operation_id});
    await controller.execute(record.intent);ran=true;
    notify('idle');
    // One operation per scan ensures a fresh authoritative snapshot between jobs.
    break;
   }
   if(!ran)try{await wait(intervalMs,undefined,{signal:lifetime.signal});}
   catch(error){if(error.name!=='AbortError')throw error;}
  }
  notify('drained');
 }catch(error){
  notify('failed',{code:/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code??'')?error.code:'WORKER_FAILED'});
  // Exit the owning process on failure. Keeping a live PID after abandoning an
  // acquired claim would prevent safe restart; no liveness fiction is recorded.
  throw error;
 }finally{
  process.off('message',onMessage);process.off('SIGTERM',stop);process.off('SIGINT',stop);process.off('disconnect',stop);
  signal?.removeEventListener('abort',stop);
 }
}

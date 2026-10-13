// Isolated server-side candidate only. Comments keep the HTTP stream active;
// they are not RPC replies/progress, receipts, admissions or tool deadline resets.
export function attachBoundedSseKeepalive(response,{intervalMs=30000}={}) {
  if(!Number.isSafeInteger(intervalMs)||intervalMs<100||intervalMs>60000)throw new Error('KEEPALIVE_INTERVAL_BOUND');
  let stopped=false, cleaned=false, sentType;
  const originalWriteHead=response.writeHead;
  const observeWriteHead=function(...args){
    const headers=typeof args[1]==='string'?args[2]:args[1];
    let explicitType;
    if(Array.isArray(headers)) {
      for(let i=0;i<headers.length;i+=2)if(String(headers[i]).toLowerCase()==='content-type')explicitType=headers[i+1];
    }else if(headers&&typeof headers==='object') {
      for(const [key,value] of Object.entries(headers))if(key.toLowerCase()==='content-type')explicitType=value;
    }
    const result=originalWriteHead.apply(this,args);
    // writeHead headers take precedence over setHeader and may not be retained
    // in getHeader. Observe the successful native call without changing it.
    sentType=explicitType??this.getHeader('content-type');
    return result;
  };
  if(typeof originalWriteHead==='function')response.writeHead=observeWriteHead;
  const halt=()=>{
    if(stopped)return;stopped=true;clearInterval(timer);
    if(response.writeHead===observeWriteHead)response.writeHead=originalWriteHead;
  };
  const stop=()=>{
    halt();if(cleaned)return;cleaned=true;
    for(const event of ['close','finish'])response.removeListener(event,stop);
    response.removeListener('error',halt);
  };
  const timer=setInterval(()=>{
    if(response.destroyed||response.writableEnded){stop();return;}
    const type=String(sentType??response.getHeader('content-type')??'').split(';',1)[0].trim().toLowerCase();
    if(!response.headersSent||type!=='text/event-stream'||response.writableNeedDrain)return;
    // Node may emit an error after invoking the write callback. Keep the
    // error handler until close/finish so that ordering cannot be unhandled.
    try{response.write(': mcp keepalive\n\n',error=>{if(error)halt();});}catch{halt();}
  },intervalMs);
  timer.unref();
  for(const event of ['close','finish'])response.once(event,stop);
  response.on('error',halt);
  return stop;
}

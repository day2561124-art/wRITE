import assert from 'node:assert/strict';
import {EventEmitter,once} from 'node:events';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {attachBoundedSseKeepalive} from '../../server/src/mcp-http-sse-keepalive.mjs';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){const end=Date.now()+5000;while(!predicate()){assert(Date.now()<end,'Isolated observation deadline');await delay(10);}}
class MockResponse extends EventEmitter {
 constructor(){super();this.headersSent=true;this.destroyed=false;this.writableEnded=false;this.writableNeedDrain=false;this.type='text/event-stream';this.frames=[];}
 getHeader(){return this.type;}
 write(frame,callback){this.frames.push(frame);callback?.();return true;}
}
for(const intervalMs of [0,99,60001,Infinity])assert.throws(()=>attachBoundedSseKeepalive(new MockResponse(),{intervalMs}),/INTERVAL_BOUND/);
const r=new MockResponse(),stop=attachBoundedSseKeepalive(r,{intervalMs:100});await until(()=>r.frames.length>0);assert(r.frames.every(frame=>frame===': mcp keepalive\n\n'));
r.writableNeedDrain=true;const count=r.frames.length;await delay(200);assert.equal(r.frames.length,count);
r.writableNeedDrain=false;r.type='application/json';await delay(200);assert.equal(r.frames.length,count);
r.emit('finish');await delay(200);assert.equal(r.frames.length,count);assert.equal(r.listenerCount('error'),0);assert.equal(r.listenerCount('close'),0);stop();
const raw=new MockResponse();raw.writeHead=function(){this.headersSent=true;return this;};const originalHead=raw.writeHead,stopRaw=attachBoundedSseKeepalive(raw,{intervalMs:100});
assert.equal(raw.writeHead(200,'OK',['Content-Type','text/event-stream; charset=utf-8']),raw);raw.type='application/json';await until(()=>raw.frames.length>0);stopRaw();assert.equal(raw.writeHead,originalHead);
const fake=new MockResponse();fake.type='text/event-stream-invalid';const stopFake=attachBoundedSseKeepalive(fake,{intervalMs:100});await delay(200);assert.equal(fake.frames.length,0);stopFake();
const fail=new MockResponse();let writes=0;fail.write=(frame,callback)=>{writes++;callback(new Error('EPIPE'));assert.doesNotThrow(()=>fail.emit('error',new Error('EPIPE')));};
attachBoundedSseKeepalive(fail,{intervalMs:100});await until(()=>writes>0);await delay(200);assert.equal(writes,1);fail.emit('close');assert.equal(fail.listenerCount('error'),0);
const thrown=new MockResponse();let attempts=0;thrown.write=()=>{attempts++;throw new Error('EPIPE');};attachBoundedSseKeepalive(thrown,{intervalMs:100});await until(()=>attempts>0);await delay(200);assert.equal(attempts,1);assert.doesNotThrow(()=>thrown.emit('error',new Error('EPIPE')));thrown.emit('close');assert.equal(thrown.listenerCount('error'),0);

const mcp=new McpServer({name:'isolated-readonly-stream-test',version:'1'});let calls=0;
mcp.registerTool('delayed_read',{description:'Self-owned loopback only',inputSchema:{},annotations:{readOnlyHint:true}},async()=>{calls++;await delay(450);return {content:[{type:'text',text:'actual-read-result'}]};});
const transport=new StreamableHTTPServerTransport({sessionIdGenerator:()=>randomUUID()});await mcp.connect(transport);
const responses=[],httpServer=http.createServer((req,res)=>{
 const record={method:req.method,comments:0,final:false};responses.push(record);const original=res.write;
 res.write=function(chunk,...args){const text=Buffer.from(chunk).toString('utf8');if(text.startsWith(': mcp keepalive'))record.comments++;if(text.includes('actual-read-result'))record.final=true;return original.call(this,chunk,...args);};
 attachBoundedSseKeepalive(res,{intervalMs:100});transport.handleRequest(req,res).catch(error=>{if(!res.headersSent)res.writeHead(500);res.end();});
});
httpServer.listen(0,'127.0.0.1');await once(httpServer,'listening');const client=new Client({name:'isolated-stream-client',version:'1'});
try {
 await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:'+httpServer.address().port+'/mcp')));
 const answer=await client.callTool({name:'delayed_read',arguments:{}},undefined,{timeout:5000});assert.notEqual(answer.isError,true);assert.equal(answer.content[0].text,'actual-read-result');
 assert(responses.some(row=>row.method==='POST'&&row.final&&row.comments>0),'The tool POST itself must have comments; GET comments are insufficient');
 const previous=responses.length;await assert.rejects(client.callTool({name:'delayed_read',arguments:{}},undefined,{timeout:300}),error=>error.code===-32001);
 assert(responses.slice(previous).some(row=>row.method==='POST'&&row.comments>0));await delay(500);assert.equal(calls,2);
}finally{await client.close();await mcp.close();httpServer.closeAllConnections();await new Promise(resolve=>httpServer.close(resolve));}
console.log('MCP HTTP SSE keepalive focused and SDK deadline regressions passed.');

import readline from 'node:readline';
const lines=readline.createInterface({input:process.stdin});
setInterval(()=>{},1000);
process.on('disconnect',()=>process.exit(0));
lines.on('line',line=>{
 const m=JSON.parse(line);
 process.send?.({observed:m.method,tool:m.params?.name,id:m.id});
 if(m.id===undefined)return;
 const result=m.method==='initialize'?{protocolVersion:'2025-03-26',capabilities:{},serverInfo:{name:'real-pipe-peer',version:'1'}}:
 m.method==='tools/list'?{tools:[{name:'unsafe_write',annotations:{readOnlyHint:false}},{name:'safe_read',annotations:{readOnlyHint:true}}]}:{ok:true};
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\n');
});

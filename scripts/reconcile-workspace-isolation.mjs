// A host maintenance integration supplies the already authorized Journal object.
// Ordinary CLI use is inspect-only; no flag/environment value mints authority.
import {pathToFileURL} from 'node:url';
import {createDevOperationJournalService} from '../server/src/mcp-development-journal-tools.mjs';
export async function inspectWorkspaceIsolation(input,{journal=createDevOperationJournalService()}={}){
 return journal.inspectWorkspaceIsolationMutation(input);
}
export async function reconcileWorkspaceIsolation(input,{journal}={}){
 if(!journal||typeof journal.resolveWorkspaceIsolationMutation!=='function')throw new Error('HOST_RECOVERY_AUTHORITY_REQUIRED');
 return journal.resolveWorkspaceIsolationMutation(input);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length!==3||process.argv[2]!=='--inspect')throw new Error('HOST_RECOVERY_AUTHORITY_REQUIRED');
  process.stdin.setEncoding('utf8');let text='';for await(const chunk of process.stdin){text+=chunk;if(Buffer.byteLength(text)>8192)throw new Error('ISOLATION_INPUT_LIMIT');}
  process.stdout.write(JSON.stringify(await inspectWorkspaceIsolation(JSON.parse(text)))+'\n');
 }catch(error){process.stderr.write(String(error.code??error.message)+'\n');process.exitCode=1;}
}

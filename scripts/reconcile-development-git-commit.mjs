// Trusted-host maintenance entry. GPT supplies the decision; this entry only
// verifies physical facts and uses the existing append-only Journal resolver.
// Never dispatches Pi work, commits, changes routes, integrates or pushes.
import {pathToFileURL} from 'node:url';
import {createDevOperationJournalService} from '../server/src/mcp-development-journal-tools.mjs';

export async function reconcileDevelopmentGitCommit(input, {apply=false, journal=createDevOperationJournalService()}={}) {
  return apply ? journal.resolveCompletedGitCommitMutation(input) : journal.inspectCompletedGitCommitMutation(input);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3 || !['--inspect','--apply'].includes(process.argv[2])) throw new Error('INVALID_RECONCILIATION_ACTION');
    process.stdin.setEncoding('utf8');let source='';
    for await (const chunk of process.stdin) {source+=chunk;if(Buffer.byteLength(source)>64*1024)throw new Error('RESOLUTION_RECORD_LIMIT');}
    const result=await reconcileDevelopmentGitCommit(JSON.parse(source), {apply:process.argv[2]==='--apply'});
    process.stdout.write(JSON.stringify(result)+'\n');
  } catch (error) {
    process.stderr.write(String(error.message)+'\n');process.exitCode=1;
  }
}

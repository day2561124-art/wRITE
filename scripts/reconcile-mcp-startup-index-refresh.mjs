// Host maintenance only. CLI is inspect-only; no flag mints recovery authority.
import {pathToFileURL} from 'node:url';
import {createDevOperationJournalService} from '../server/src/mcp-development-journal-tools.mjs';
import {inspectIndexRefreshRecovery,recoverIndexRefreshOperations} from '../server/src/mcp-startup-index-refresh-recovery.mjs';
export async function inspectStartupIndexRefresh({journal=createDevOperationJournalService()}={}){
 const {verified,head,pending}=await inspectIndexRefreshRecovery({journal});return {verified,head,pending};
}
export async function reconcileStartupIndexRefresh({journal,authority}={}){
 if(!journal||typeof authority!=='function')throw Error('HOST_RECOVERY_AUTHORITY_REQUIRED');
 return recoverIndexRefreshOperations({journal,authority});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.argv.length!==3||process.argv[2]!=='--inspect')throw Error('HOST_RECOVERY_AUTHORITY_REQUIRED');console.log(JSON.stringify(await inspectStartupIndexRefresh()));}
 catch(error){console.error(error.message);process.exitCode=1;}
}

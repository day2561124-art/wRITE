import assert from 'node:assert/strict';
import test from 'node:test';
import {runPhase3HttpE2E} from '../../scripts/pi-runtime-phase3-http-e2e.mjs';
test('HTTP correlation survives concurrent Pi dispatch and completed-response loss without replay', {timeout:180000},async()=>{
  const evidence=await runPhase3HttpE2E(process.env.PI_PHASE3_EVIDENCE_PATH??null);
  assert.equal(evidence.correlation_verified,true);
  assert.equal(evidence.privacy_verified,true);
  assert.equal(evidence.owned_processes_drained,true);
  assert.equal(evidence.lost_response.state,'COMPLETED');
  assert.equal(evidence.lost_response.duplicate_same_operation,true);
  assert.equal(evidence.physical_dispatches,11);
  assert.equal(evidence.journal.chain_verified,true);
  assert(evidence.concurrent.every(status=>status==='COMPLETED'));
});

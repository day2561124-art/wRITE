import assert from 'node:assert/strict';
import test from 'node:test';
import {runPhase2E2E} from '../../scripts/pi-runtime-phase2-e2e.mjs';

test('schema metadata progresses during real Pi PowerShell execution without authorizing replay', {timeout:180000}, async()=>{
  const evidence=await runPhase2E2E({normalCalls:1});
  assert.equal(evidence.runs[0].stdout,'PI_PHASE2_OK');
  assert.equal(evidence.physical_dispatches,8);
  assert.equal(evidence.duplicate_same_operation,true);
  assert.equal(evidence.unauthorized_no_dispatch,true);
  const metadata=evidence.trace.filter(row=>row.kind==='queue'&&row.tool==='dev_capability_get_schema');
  assert.equal(metadata.length,4);
  // Verify completion order rather than a fragile wall-clock threshold.
  const holder=String(Number(metadata[1].request)-1);
  const holderCompleted=evidence.trace.findIndex(row=>row.label==='mcp.dispatch'&&row.request===holder);
  assert(holderCompleted>=0);
  for(const request of metadata.slice(1)) {
    const completed=evidence.trace.findIndex(row=>row.label==='mcp.dispatch'&&row.request===request.request);
    assert(completed>=0&&completed<holderCompleted,'metadata must complete before the PowerShell holder');
  }
  assert.equal(evidence.nonzero.status,'DECISION_REQUIRED');
  assert.equal(evidence.timeout.timed_out,true);
  assert.match(evidence.timeout.retry_error,/JOURNAL_DEGRADED/);
  assert.equal(evidence.journal.chain_verified,true);
});

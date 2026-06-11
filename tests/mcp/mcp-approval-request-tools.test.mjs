import path from "node:path";
import { readFile, readdir, rm } from "node:fs/promises";
import { hash as nodeHash } from "crypto";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";
import { approvalRequestTools, approvalRequestToolMetadata } from "../../server/src/mcp-approval-request-tools.mjs";
import { listApprovalItems, getApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { get_approval_queue_status } from "../../server/src/mcp-readonly-tools.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function names(directory) {
  try { return new Set(await readdir(directory)); } catch (e) { if (e.code === 'ENOENT') return new Set(); throw e; }
}

async function main() {
  const approvalRoot = path.join(projectPaths.approvalQueue, ".mcp-approval-request-test");
  const pendingRoot = path.join(projectPaths.canonDb, ".mcp-approval-request-test-pending");
  await rm(approvalRoot, { recursive: true, force: true });
  await rm(pendingRoot, { recursive: true, force: true });

  // metadata checks
  for (const name of [
    "request_engine_candidate_activation",
    "request_high_risk_engine_candidate_activation",
    "request_rollback_active_engine",
    "request_cleanup_execution",
    "request_cleanup_proposal_approval",
    "get_approval_item_detail",
    "get_approval_queue_status",
  ]) {
    assert(typeof approvalRequestTools[name] === 'function', `${name} missing`);
    const meta = approvalRequestToolMetadata[name];
    assert(meta.permission, `${name} metadata missing permission`);
  }

  // create a pending candidate via importSettlementResult
  const candidate = await importSettlementResult({ rawText: '# Test\n\nCandidate', sourceChapter: 'T' }, { pendingEngineCandidates: pendingRoot });
  const candidateId = candidate.metadata.candidate_id;
  // request activation
  const res1 = await approvalRequestTools.request_engine_candidate_activation({ candidate_id: candidateId, reason: 'test' }, { approvalItems: approvalRoot, pendingEngineCandidates: pendingRoot });
  assert(res1.ok, `request failed: ${res1.blocked_reason}`);
  const id1 = res1.result.approval_item_id;
  // duplicate request should return same item
  const res2 = await approvalRequestTools.request_engine_candidate_activation({ candidate_id: candidateId }, { approvalItems: approvalRoot, pendingEngineCandidates: pendingRoot });
  assert(res2.ok, 'duplicate request blocked');
  const id2 = res2.result.approval_item_id;
  assert(id1 === id2, 'duplicate request did not dedupe');

  // read-only get detail
  const detail = await approvalRequestTools.get_approval_item_detail({ approval_id: id1 }, { approvalItems: approvalRoot });
  assert(detail.ok, 'get_approval_item_detail failed');

  // get approval queue status via readonly delegate
  const status = await approvalRequestTools.get_approval_queue_status({}, { approvalQueue: approvalRoot });
  assert(status.ok, 'get_approval_queue_status failed');

  console.log('MCP approval-request tools test passed.');
}

main().catch((err) => { console.error('MCP approval-request tools test failed:', err.message); process.exitCode = 1; });

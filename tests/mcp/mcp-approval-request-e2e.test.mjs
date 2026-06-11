import { writeFile, readFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { importSettlementResult } from "../../server/src/engine-candidate-service.mjs";
import { approvalRequestTools } from "../../server/src/mcp-approval-request-tools.mjs";
import { getApprovalItem, confirmApprovalItem } from "../../server/src/approval-queue-service.mjs";
import { projectPaths } from "../../server/src/project-paths.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const tempCanon = path.join(projectPaths.canonDb, ".mcp-approval-request-e2e");
  const pendingRoot = path.join(tempCanon, "pending_engine_candidates");
  const approvalQueueRoot = path.join(projectPaths.approvalQueue, ".mcp-approval-request-e2e");
  const activeEnginePath = path.join(tempCanon, "active_engine.md");
  // cleanup pre-run
  await rm(tempCanon, { recursive: true, force: true });
  await rm(approvalQueueRoot, { recursive: true, force: true });
  await mkdir(tempCanon, { recursive: true });
  await writeFile(activeEnginePath, "# Active\n\nOriginal\n", "utf8");

  try {
    // create a pending candidate using the test canon roots
    const candidate = await importSettlementResult({ rawText: '# 新版完整創作引擎候選\n\n```md\nNew candidate content\n```', sourceChapter: 'E2E' }, { pendingEngineCandidates: pendingRoot, activeEnginePath });
    const candidateId = candidate.metadata.candidate_id;

    // Adjust candidate status/risk to make it eligible for activation in this E2E test
    const candidateDir = path.join(pendingRoot, candidateId);
    const status = {
      status: 'candidate',
      can_activate: true,
      eligible_for_phase_3_activation: true,
      requires_second_confirmation: false,
      blocked_reason: null,
    };
    const risk = { risk_level: 'low', requires_second_confirmation: false };
    await writeFile(path.join(candidateDir, 'status.json'), JSON.stringify(status, null, 2) + '\n', 'utf8');
    await writeFile(path.join(candidateDir, 'risk_report.json'), JSON.stringify(risk, null, 2) + '\n', 'utf8');

    // MCP request: create approval item
    const req = await approvalRequestTools.request_engine_candidate_activation({ candidate_id: candidateId, reason: 'E2E test' }, { approvalQueue: approvalQueueRoot, pendingEngineCandidates: pendingRoot });
    assert(req.ok, `request failed: ${req.blocked_reason}`);
    const approvalId = req.result.approval_item_id;

    // UI reads approval item
    const item = await getApprovalItem(approvalId, { approvalQueue: approvalQueueRoot });
    assert(item.action_type === 'activate_engine_candidate', 'action_type mismatch');
    assert(item.target_type === 'pending_engine_candidate', 'target_type mismatch');
    assert(item.links && item.links.candidate_id === candidateId, 'links missing candidate id');
    assert(item.details && item.details.requested_by === 'mcp', 'requested_by not mcp');

    // ensure active engine not modified yet (reads from fixture)
    const before = await readFile(activeEnginePath, 'utf8');
    assert(before.includes('Original'), 'fixture active engine missing original content');

    // Simulate UI confirm: this should activate candidate into our fixture activeEnginePath
    const res = await confirmApprovalItem(approvalId, { confirm: true, approvalText: '確認啟用', approvedBy: 'ui_test' }, { pendingEngineCandidates: pendingRoot, activeEnginePath, approvalQueue: approvalQueueRoot });
    // confirmApprovalItem should return result with activation details
    assert(res && res.approval_item, 'confirmApprovalItem did not return approval_item');

    // active engine should now reflect candidate activation in fixture
    const after = await readFile(activeEnginePath, 'utf8');
    assert(after.includes('Candidate') || after.includes('New') , 'active engine not updated by confirm flow');

    console.log('MCP approval-request E2E test passed.');
  } finally {
    // cleanup fixtures
    await rm(tempCanon, { recursive: true, force: true });
    await rm(approvalQueueRoot, { recursive: true, force: true });
  }
}

main().catch((err) => { console.error('MCP approval-request E2E failed:', err.message); process.exitCode = 1; });

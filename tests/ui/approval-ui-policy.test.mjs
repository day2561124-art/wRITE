import assert from "node:assert/strict";
import {
  isActionableApprovalItem,
  isApprovalHistoryItem,
} from "../../server/ui/approval-ui-policy.mjs";

const terminal = [
  "rejected",
  "approved",
  "completed",
  "expired",
  "invalidated",
  "orphaned",
  "resolved",
  "confirmed",
  "archived",
];

for (const status of terminal) {
  const item = { status: { status } };
  assert.equal(isActionableApprovalItem(item), false, `${status} leaked into pending UI.`);
  assert.equal(isApprovalHistoryItem(item), true, `${status} was not routed to history.`);
}

assert.equal(isActionableApprovalItem({ status: { status: "pending" } }), true);
assert.equal(isActionableApprovalItem({
  status: { status: "blocked" },
  resolution_path: { available: false },
}), false);
assert.equal(isActionableApprovalItem({
  status: { status: "blocked" },
  resolution_path: { available: true },
}), true);
assert.equal(isActionableApprovalItem({
  status: { status: "pending", target_exists: false },
}), false);
assert.equal(isActionableApprovalItem({
  status: { status: "pending" },
  test_fixture: true,
}), false);

console.log("Approval UI actionable filtering policy passed.");

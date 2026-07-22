const historyStatuses = new Set([
  "resolved",
  "confirmed",
  "rejected",
  "approved",
  "completed",
  "expired",
  "invalidated",
  "orphaned",
  "archived",
]);

export function isApprovalHistoryItem(item = {}) {
  return historyStatuses.has(item.status?.status);
}

export function isActionableApprovalItem(item = {}) {
  const status = item.status?.status;
  if (item.test_fixture === true || item.target_exists === false
    || item.status?.target_exists === false) return false;
  if (status === "pending") return true;
  return status === "blocked" && item.resolution_path?.available === true;
}

import {
  approvalIdentity,
  archiveApprovalItem,
  backfillApprovalIdentity,
  invalidateApprovalItem,
  isActionableApprovalItem,
  isApprovalTestFixture,
  listApprovalItems,
  validateApprovalItemTarget,
} from "./approval-queue-service.mjs";

const suppressionActions = new Set([
  "activate_engine_candidate",
  "neural_trace_missing",
  "retire_external_brain_session",
]);

function statusOf(item) {
  return item?.status?.status ?? item?.status ?? null;
}

function newestFirst(left, right) {
  return String(right.updated_at ?? right.created_at)
    .localeCompare(String(left.updated_at ?? left.created_at));
}

function emptyStatistics() {
  return {
    duplicates_collapsed: 0,
    orphaned_invalidated: 0,
    test_items_archived: 0,
    missing_trace_items_closed: 0,
    session_retirement_items_suppressed: 0,
    remaining_pending_items: 0,
  };
}

export async function planApprovalQueueCleanup(options = {}) {
  const items = await listApprovalItems(options);
  const planById = new Map();
  const targetState = new Map();

  const add = (item, action, reason, extras = {}) => {
    if (planById.has(item.approval_item_id)) return;
    planById.set(item.approval_item_id, {
      approval_item_id: item.approval_item_id,
      action,
      reason,
      action_type: item.action_type,
      target_id: item.target_id,
      prior_status: statusOf(item),
      ...extras,
    });
  };

  for (const item of items) {
    if (["archived", "invalidated", "orphaned"].includes(statusOf(item))) continue;
    if (isApprovalTestFixture(item)) {
      add(item, "archive", "test_fixture_excluded_from_production_queue", {
        statistic: "test_items_archived",
      });
      continue;
    }
    if (item.action_type === "neural_trace_missing"
      && !(item.workflow_run_id || item.lineage?.workflow_run_id || item.details?.workflow_run_id)) {
      add(item, "invalidate", "trace_source_unavailable", {
        statistic: "missing_trace_items_closed",
      });
      continue;
    }
    const target = await validateApprovalItemTarget(item, options);
    targetState.set(item.approval_item_id, target);
    if (target.exists === false) {
      add(item, "invalidate", "target_not_found", {
        orphaned: true,
        statistic: "orphaned_invalidated",
      });
    }
  }

  const groups = new Map();
  for (const item of items) {
    if (["archived", "invalidated", "orphaned"].includes(statusOf(item))
      || planById.has(item.approval_item_id)) continue;
    const identity = approvalIdentity(item);
    const group = groups.get(identity.dedupe_key) ?? [];
    group.push(item);
    groups.set(identity.dedupe_key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((left, right) => {
      const leftTarget = targetState.get(left.approval_item_id);
      const rightTarget = targetState.get(right.approval_item_id);
      const leftValid = leftTarget?.exists !== false && leftTarget?.actionable !== false ? 1 : 0;
      const rightValid = rightTarget?.exists !== false && rightTarget?.actionable !== false ? 1 : 0;
      return rightValid - leftValid || newestFirst(left, right);
    });
    const keep = ordered[0];
    for (const duplicate of ordered.slice(1)) {
      add(duplicate, "archive", "duplicate_dedupe_key", {
        duplicate_of: keep.approval_item_id,
        statistic: "duplicates_collapsed",
      });
    }
  }

  for (const item of items) {
    if (planById.has(item.approval_item_id)) continue;
    if (statusOf(item) !== "rejected" || item.status?.suppression) continue;
    if (!suppressionActions.has(item.action_type)) continue;
    add(item, "backfill_suppression", "explicit_rejected_status", {
      statistic: item.action_type === "retire_external_brain_session"
        ? "session_retirement_items_suppressed"
        : null,
    });
  }

  const plan = [...planById.values()];
  const statistics = emptyStatistics();
  for (const entry of plan) {
    if (entry.statistic) statistics[entry.statistic] += 1;
  }
  const removedFromPending = new Set(
    plan
      .filter((entry) => ["archive", "invalidate"].includes(entry.action))
      .map((entry) => entry.approval_item_id),
  );
  statistics.remaining_pending_items = items.filter((item) => (
    !removedFromPending.has(item.approval_item_id) && isActionableApprovalItem(item)
  )).length;
  return {
    dry_run: true,
    write_performed: false,
    statistics,
    planned_changes: plan,
  };
}

export async function cleanupApprovalQueue(
  { dryRun = true, confirm = false } = {},
  options = {},
) {
  const preview = await planApprovalQueueCleanup(options);
  if (dryRun) return preview;
  if (confirm !== true) {
    throw new Error("Approval queue cleanup apply mode requires confirm=true after reviewing dry-run.");
  }
  for (const entry of preview.planned_changes) {
    if (entry.action === "archive") {
      await archiveApprovalItem(entry.approval_item_id, {
        reason: entry.reason,
        duplicateOf: entry.duplicate_of ?? null,
      }, options);
    } else if (entry.action === "invalidate") {
      await invalidateApprovalItem(entry.approval_item_id, {
        reason: entry.reason,
        orphaned: entry.orphaned === true,
      }, options);
    } else if (entry.action === "backfill_suppression") {
      await backfillApprovalIdentity(entry.approval_item_id, options);
    }
  }
  const after = await planApprovalQueueCleanup(options);
  return {
    dry_run: false,
    write_performed: preview.planned_changes.length > 0,
    statistics: {
      ...preview.statistics,
      remaining_pending_items: after.statistics.remaining_pending_items,
    },
    applied_changes: preview.planned_changes,
    remaining_planned_changes: after.planned_changes,
  };
}

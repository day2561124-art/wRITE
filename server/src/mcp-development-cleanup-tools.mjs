import {
  approveCleanupProposal,
  createCleanupProposal,
  executeCleanupProposal,
  getCleanupProposal,
  listCleanupProposals,
  scanCleanupCandidates,
} from "./cleanup-proposal-service.mjs";
import { assertDevJournalMutationAllowed } from "./mcp-development-journal-tools.mjs";

export const DEV_CLEANUP_PROPOSAL_ID_PATTERN_SOURCE =
  "^cleanup_proposal_\\d{8}-\\d{6}-[a-f0-9]{8}$";
export const DEV_CLEANUP_MAX_LIST_RESULTS = 50;
export const DEV_CLEANUP_MAX_ITEM_PREVIEW = 100;
export const DEV_CLEANUP_STORAGE_ITEM_TYPES = Object.freeze([
  "archive",
  "external_brain_session",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObjectKeys(input, label, allowed) {
  if (!isObject(input)) throw new Error(`${label} must be an object.`);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`${label} does not allow field ${key}.`);
  }
}

function boundedInteger(value, label, { minimum = 1, maximum, fallback }) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < minimum || resolved > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return resolved;
}

function compactItem(item = {}) {
  return {
    item_id: item.item_id ?? null,
    item_type: item.item_type ?? null,
    source_path: item.source_path ?? null,
    status: item.status ?? null,
    reason: item.reason ?? null,
    risk_level: item.risk_level ?? null,
    retention: item.retention ?? null,
    session_id: item.session_id ?? null,
    classification: item.classification ?? null,
    age_days: Number.isFinite(item.age_days) ? item.age_days : null,
    estimated_logical_bytes: Number.isFinite(item.estimated_logical_bytes)
      ? item.estimated_logical_bytes
      : null,
    estimated_file_count: Number.isFinite(item.estimated_file_count)
      ? item.estimated_file_count
      : null,
    cleanup_path_count: Array.isArray(item.cleanup_paths) ? item.cleanup_paths.length : 0,
    reference_count: Array.isArray(item.referenced_by) ? item.referenced_by.length : 0,
    ownership_proof_complete: item.ownership_proof_complete === true,
  };
}

function groupSummary(items = [], maxItems = DEV_CLEANUP_MAX_ITEM_PREVIEW) {
  return {
    count: items.length,
    returned: Math.min(items.length, maxItems),
    truncated: items.length > maxItems,
    items: items.slice(0, maxItems).map(compactItem),
  };
}

function compactScan(scan, maxItems) {
  return {
    scanned_at: scan.scanned_at,
    scope: [...DEV_CLEANUP_STORAGE_ITEM_TYPES],
    retention_policy: scan.retention_policy,
    risk_summary: scan.risk_summary,
    eligible: groupSummary(scan.eligible_items, maxItems),
    must_keep: groupSummary(scan.must_keep_items, maxItems),
    needs_review: groupSummary(scan.needs_review_items, maxItems),
    blocked: groupSummary(scan.blocked_items, maxItems),
  };
}

const storageItemTypeSet = new Set(DEV_CLEANUP_STORAGE_ITEM_TYPES);

function proposalItems(proposal = {}) {
  return [
    ...(proposal.eligible_items ?? []),
    ...(proposal.must_keep_items ?? []),
    ...(proposal.needs_review_items ?? []),
    ...(proposal.blocked_items ?? []),
  ];
}

function isStorageScopedProposal(proposal = {}) {
  return proposalItems(proposal).every(
    (item) => storageItemTypeSet.has(item?.item_type),
  );
}

function assertStorageScopedProposal(proposal = {}) {
  if (!isStorageScopedProposal(proposal)) {
    throw new Error(
      "Developer cleanup surface only accepts storage-scoped proposals containing archive and external_brain_session items.",
    );
  }
  return proposal;
}

function compactProposal(proposal, { includeItems = false, maxItems = 0 } = {}) {
  const output = {
    cleanup_proposal_id: proposal.cleanup_proposal_id,
    created_at: proposal.created_at,
    created_by: proposal.created_by,
    title: proposal.title,
    summary: proposal.summary,
    scope: [...DEV_CLEANUP_STORAGE_ITEM_TYPES],
    status: proposal.status,
    retention_policy: proposal.retention_policy,
    risk_summary: proposal.risk_summary,
    eligible_count: proposal.eligible_items?.length ?? 0,
    must_keep_count: proposal.must_keep_items?.length ?? 0,
    needs_review_count: proposal.needs_review_items?.length ?? 0,
    blocked_count: proposal.blocked_items?.length ?? 0,
  };
  if (includeItems) {
    output.eligible = groupSummary(proposal.eligible_items ?? [], maxItems);
    output.must_keep = groupSummary(proposal.must_keep_items ?? [], maxItems);
    output.needs_review = groupSummary(proposal.needs_review_items ?? [], maxItems);
    output.blocked = groupSummary(proposal.blocked_items ?? [], maxItems);
  }
  return output;
}

export async function dev_cleanup_scan_storage(input = {}) {
  assertObjectKeys(input, "dev_cleanup_scan_storage input", new Set(["max_items"]));
  await assertDevJournalMutationAllowed();
  const maxItems = boundedInteger(input.max_items, "max_items", {
    maximum: DEV_CLEANUP_MAX_ITEM_PREVIEW,
    fallback: 50,
  });
  const scan = await scanCleanupCandidates({
    itemTypes: DEV_CLEANUP_STORAGE_ITEM_TYPES,
    actor: "chatgpt_developer",
  });
  return compactScan(scan, maxItems);
}

export async function dev_cleanup_create_storage_proposal(input = {}) {
  assertObjectKeys(
    input,
    "dev_cleanup_create_storage_proposal input",
    new Set(["title", "max_items"]),
  );
  await assertDevJournalMutationAllowed();
  if (input.title !== undefined && (typeof input.title !== "string" || input.title.trim().length < 1 || input.title.length > 160)) {
    throw new Error("title must be a non-blank string up to 160 characters.");
  }
  const maxItems = boundedInteger(input.max_items, "max_items", {
    maximum: DEV_CLEANUP_MAX_ITEM_PREVIEW,
    fallback: 50,
  });
  const proposal = await createCleanupProposal({
    itemTypes: DEV_CLEANUP_STORAGE_ITEM_TYPES,
    createdBy: "chatgpt_developer",
    title: input.title?.trim() || "Controlled storage history cleanup",
    summary: "Retention- and lineage-gated cleanup limited to superseded engine archives and unreferenced external-brain session storage.",
  });
  return compactProposal(proposal, { includeItems: true, maxItems });
}

export async function dev_cleanup_get_proposal(input = {}) {
  assertObjectKeys(
    input,
    "dev_cleanup_get_proposal input",
    new Set(["cleanup_proposal_id", "include_items", "max_items"]),
  );
  if (typeof input.cleanup_proposal_id !== "string") throw new Error("cleanup_proposal_id is required.");
  const includeItems = input.include_items ?? false;
  if (typeof includeItems !== "boolean") throw new Error("include_items must be boolean.");
  const maxItems = boundedInteger(input.max_items, "max_items", {
    maximum: DEV_CLEANUP_MAX_ITEM_PREVIEW,
    fallback: 50,
  });
  const proposal = assertStorageScopedProposal(
    await getCleanupProposal(input.cleanup_proposal_id),
  );
  return compactProposal(proposal, { includeItems, maxItems });
}

export async function dev_cleanup_list_proposals(input = {}) {
  assertObjectKeys(input, "dev_cleanup_list_proposals input", new Set(["limit"]));
  const limit = boundedInteger(input.limit, "limit", {
    maximum: DEV_CLEANUP_MAX_LIST_RESULTS,
    fallback: 20,
  });
  const proposals = (await listCleanupProposals()).filter(isStorageScopedProposal);
  return {
    total: proposals.length,
    returned: Math.min(proposals.length, limit),
    truncated: proposals.length > limit,
    proposals: proposals.slice(0, limit).map((proposal) => compactProposal(proposal)),
  };
}

export async function dev_cleanup_approve_proposal(input = {}) {
  assertObjectKeys(
    input,
    "dev_cleanup_approve_proposal input",
    new Set(["cleanup_proposal_id", "confirm"]),
  );
  await assertDevJournalMutationAllowed();
  if (typeof input.cleanup_proposal_id !== "string") throw new Error("cleanup_proposal_id is required.");
  if (input.confirm !== true) throw new Error("Cleanup approval requires confirm=true.");
  assertStorageScopedProposal(await getCleanupProposal(input.cleanup_proposal_id));
  const proposal = await approveCleanupProposal(
    input.cleanup_proposal_id,
    { confirm: true, approvedBy: "chatgpt_developer" },
  );
  return compactProposal(proposal, { includeItems: false });
}

export async function dev_cleanup_execute_proposal(input = {}) {
  assertObjectKeys(
    input,
    "dev_cleanup_execute_proposal input",
    new Set(["cleanup_proposal_id", "confirm", "max_items"]),
  );
  await assertDevJournalMutationAllowed();
  if (typeof input.cleanup_proposal_id !== "string") throw new Error("cleanup_proposal_id is required.");
  if (input.confirm !== true) throw new Error("Cleanup execution requires confirm=true.");
  assertStorageScopedProposal(await getCleanupProposal(input.cleanup_proposal_id));
  const maxItems = boundedInteger(input.max_items, "max_items", {
    maximum: DEV_CLEANUP_MAX_ITEM_PREVIEW,
    fallback: 50,
  });
  const execution = await executeCleanupProposal(
    input.cleanup_proposal_id,
    { confirm: true, approvedBy: "chatgpt_developer" },
  );
  return {
    cleanup_proposal: compactProposal(execution.cleanup_proposal),
    transaction_id: execution.transaction_id,
    moved_item_count: execution.moved_items.length,
    returned_moved_items: Math.min(execution.moved_items.length, maxItems),
    moved_items_truncated: execution.moved_items.length > maxItems,
    moved_items: execution.moved_items.slice(0, maxItems).map((item) => ({
      cleanup_trash_id: item.cleanup_trash_id,
      item_type: item.item_type,
      item_id: item.item_id,
      session_id: item.session_id ?? null,
      original_path: item.original_path,
      trash_path: item.trash_path,
      restore_available: item.restore_available === true,
      permanent_delete_allowed_after: item.permanent_delete_allowed_after,
      deleted_file_count: item.deleted_file_count ?? null,
      deleted_logical_bytes: item.deleted_logical_bytes ?? null,
    })),
  };
}

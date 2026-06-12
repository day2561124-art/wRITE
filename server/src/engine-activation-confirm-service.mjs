import {
  activatePendingCandidate,
  assertEngineCandidateId,
  engineActivationLogIdPattern,
  listActivationLogs,
} from "./engine-candidate-service.mjs";

function errorWithStatus(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function requireApprovalConfirmation(input, options) {
  if (options.approvalConfirmed !== true) {
    throw errorWithStatus("Engine activation requires approval queue confirmation.", 409);
  }
  const item = options.approvalItem;
  if (!item || item.approval_item_id !== input.approvalItemId) {
    throw errorWithStatus("Confirmed approval item context is required.", 409);
  }
  if (item.action_type !== "activate_engine_candidate") {
    throw errorWithStatus("Approval item action is not engine activation.", 409);
  }
  if (item.target_type !== "pending_engine_candidate"
    || item.target_id !== input.pendingEngineCandidateId) {
    throw errorWithStatus("Approval item target does not match engine candidate.", 409);
  }
  if (!["pending", "deferred"].includes(item.status?.status)) {
    throw errorWithStatus(`Approval item cannot activate engine: ${item.status?.status}`, 409);
  }
  if (item.requires_user_confirmation === false
    || item.can_execute_without_user_confirmation === true) {
    throw errorWithStatus("Approval item does not enforce user confirmation.", 409);
  }
  return item;
}

export async function activateEngineCandidateAfterApproval(rawInput = {}, options = {}) {
  const input = {
    approvalItemId: String(
      rawInput.approvalItemId ?? rawInput.approval_item_id ?? "",
    ).trim(),
    pendingEngineCandidateId: String(
      rawInput.pendingEngineCandidateId ?? rawInput.pending_engine_candidate_id ?? "",
    ).trim(),
    confirmedBy: String(
      rawInput.confirmedBy ?? rawInput.confirmed_by ?? "local_user",
    ).trim().slice(0, 200) || "local_user",
    secondConfirm:
      rawInput.secondConfirm === true || rawInput.second_confirm === true,
  };
  if (!input.approvalItemId) throw errorWithStatus("approval_item_id is required.");
  assertEngineCandidateId(input.pendingEngineCandidateId);
  const approvalItem = requireApprovalConfirmation(input, options);
  if (approvalItem.requires_second_confirmation === true && !input.secondConfirm) {
    throw errorWithStatus("Engine activation requires second confirmation.", 409);
  }
  return activatePendingCandidate(input.pendingEngineCandidateId, {
    confirm: true,
    secondConfirm: input.secondConfirm,
    approvedBy: input.confirmedBy,
    approvalItemId: input.approvalItemId,
    activationSource: "approval_queue_confirmation",
  }, options);
}

export async function listEngineActivationConfirmLogs(input = {}, options = {}) {
  const candidateId = String(
    input.pendingEngineCandidateId ?? input.pending_engine_candidate_id ?? "",
  ).trim();
  const approvalItemId = String(
    input.approvalItemId ?? input.approval_item_id ?? "",
  ).trim();
  const limit = Number.isInteger(input.limit) && input.limit > 0
    ? Math.min(input.limit, 100)
    : 20;
  return (await listActivationLogs(options))
    .filter((entry) => entry.log_kind === "engine_activation_confirmation")
    .filter((entry) => !candidateId || entry.pending_engine_candidate_id === candidateId)
    .filter((entry) => !approvalItemId || entry.approval_item_id === approvalItemId)
    .slice(0, limit);
}

export async function getEngineActivationConfirmLog(activationLogId, options = {}) {
  if (!engineActivationLogIdPattern.test(String(activationLogId ?? ""))) {
    throw errorWithStatus("Invalid activation_log_id.");
  }
  const record = (await listEngineActivationConfirmLogs({ limit: 100 }, options))
    .find((entry) => entry.activation_log_id === activationLogId);
  if (!record) throw errorWithStatus("Engine activation log not found.", 404);
  return record;
}

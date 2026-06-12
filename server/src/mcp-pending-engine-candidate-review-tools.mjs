import {
  buildPendingEngineCandidateReview,
  getPendingEngineCandidateReview,
  listPendingEngineCandidateReviews,
  requestPendingEngineCandidateActivation,
} from "./pending-engine-candidate-review-service.mjs";
import { normalizeProjectPath, projectPaths } from "./project-paths.mjs";

function blocked(toolName, error) {
  return {
    ok: false,
    tool_name: toolName,
    permission: toolName.startsWith("get_") || toolName.startsWith("list_")
      ? "read_only"
      : toolName.startsWith("request_")
        ? "approval_request"
        : "write_low_risk",
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: error.message,
  };
}

function success(toolName, permission, result, created = [], warnings = []) {
  return {
    ok: true,
    tool_name: toolName,
    permission,
    result,
    created,
    warnings,
    blocked: false,
    blocked_reason: null,
  };
}

export async function build_pending_engine_candidate_review(input = {}, options = {}) {
  try {
    const result = await buildPendingEngineCandidateReview(input, options);
    return success("build_pending_engine_candidate_review", "write_low_risk", result, [{
      label: "pending_engine_candidate_review",
      target_id: result.review.review_id,
      source_path: result.review_for_ui_path,
      canon_status: "review_only",
    }], result.review.warnings);
  } catch (error) {
    return blocked("build_pending_engine_candidate_review", error);
  }
}

export async function get_pending_engine_candidate_review(input = {}, options = {}) {
  try {
    return success(
      "get_pending_engine_candidate_review",
      "read_only",
      await getPendingEngineCandidateReview(
        input.review_id ?? input.reviewId,
        {
          ...options,
          includeContent: input.include_content ?? input.includeContent,
          maxContentChars: input.max_content_chars ?? input.maxContentChars,
        },
      ),
    );
  } catch (error) {
    return blocked("get_pending_engine_candidate_review", error);
  }
}

export async function list_pending_engine_candidate_reviews(input = {}, options = {}) {
  try {
    const reviews = await listPendingEngineCandidateReviews(input, options);
    return success("list_pending_engine_candidate_reviews", "read_only", {
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    return blocked("list_pending_engine_candidate_reviews", error);
  }
}

export async function request_pending_engine_candidate_activation(input = {}, options = {}) {
  try {
    const result = await requestPendingEngineCandidateActivation(input, options);
    return success(
      "request_pending_engine_candidate_activation",
      "approval_request",
      result,
      result.dry_run ? [] : [{
        label: "approval_item",
        target_id: result.approval_item_id,
        canon_status: "approval_required",
      }],
    );
  } catch (error) {
    return blocked("request_pending_engine_candidate_activation", error);
  }
}

export const pendingEngineCandidateReviewTools = {
  build_pending_engine_candidate_review,
  get_pending_engine_candidate_review,
  list_pending_engine_candidate_reviews,
  request_pending_engine_candidate_activation,
};

const deniedCapabilities = {
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_approve: false,
  can_rollback: false,
  can_execute_cleanup: false,
  can_generate_locally: false,
  requires_user_confirmation_for_activation: true,
};

export const pendingEngineCandidateReviewToolMetadata = {
  build_pending_engine_candidate_review: {
    permission: "write_low_risk",
    writes_files: true,
    writes_only_to: [
      normalizeProjectPath(projectPaths.engineCandidateReviews),
      normalizeProjectPath(projectPaths.pendingEngineCandidates),
      normalizeProjectPath(projectPaths.outputs),
    ],
    ...deniedCapabilities,
    creates_activation_approval_item: false,
  },
  get_pending_engine_candidate_review: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
    creates_activation_approval_item: false,
  },
  list_pending_engine_candidate_reviews: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    ...deniedCapabilities,
    creates_activation_approval_item: false,
  },
  request_pending_engine_candidate_activation: {
    permission: "approval_request",
    writes_files: true,
    writes_only_to: [
      normalizeProjectPath(projectPaths.engineCandidateReviews),
      normalizeProjectPath(projectPaths.approvalQueue),
      normalizeProjectPath(projectPaths.pendingEngineCandidates),
      normalizeProjectPath(projectPaths.outputs),
    ],
    ...deniedCapabilities,
    creates_activation_approval_item: true,
  },
};

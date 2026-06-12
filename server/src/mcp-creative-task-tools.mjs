import {
  getCreativeTaskStatus,
  listCreativeTaskTypes,
  runCreativeTask,
} from "./creative-task-orchestrator-service.mjs";
import { normalizeProjectPath, projectPaths } from "./project-paths.mjs";

export async function run_creative_task(input = {}, options = {}) {
  return runCreativeTask(input, options);
}

export async function get_creative_task_status(input = {}, options = {}) {
  const taskId = input.task_id ?? input.taskId;
  try {
    return await getCreativeTaskStatus(taskId, options);
  } catch (error) {
    return {
      ok: false,
      task_id: taskId ?? "",
      task_type: "",
      status: "blocked",
      permission: "creative_task",
      result: {},
      created: [],
      warnings: [],
      blocked: true,
      blocked_reason: error.message,
      safety: {
        can_modify_active_engine: false,
        can_activate_engine: false,
        can_approve: false,
        can_rollback: false,
        can_execute_cleanup: false,
        canon_update_allowed: false,
      },
    };
  }
}

export async function list_creative_task_types() {
  return {
    ok: true,
    permission: "read_only",
    task_types: listCreativeTaskTypes(),
    blocked: false,
    blocked_reason: null,
  };
}

export const creativeTaskTools = {
  run_creative_task,
  get_creative_task_status,
  list_creative_task_types,
};

export const creativeTaskToolMetadata = {
  run_creative_task: {
    permission: "creative_task",
    writes_files: true,
    writes_only_to: [
      normalizeProjectPath(projectPaths.creativeTasks),
      normalizeProjectPath(projectPaths.creativeTaskLog),
      normalizeProjectPath(projectPaths.writingWorkflow),
      normalizeProjectPath(projectPaths.approvalQueue),
      normalizeProjectPath(projectPaths.adoptedWritingSettlementContexts),
      normalizeProjectPath(projectPaths.adoptedWritingSettlementReports),
      normalizeProjectPath(projectPaths.pendingEngineCandidates),
      normalizeProjectPath(projectPaths.adoptedWritings),
      normalizeProjectPath(projectPaths.writingCandidates),
    ],
    can_modify_active_engine: false,
    can_activate_engine: false,
    can_approve: false,
    can_rollback: false,
    can_execute_cleanup: false,
    requires_user_confirmation: false,
  },
  get_creative_task_status: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    can_modify_active_engine: false,
    can_activate_engine: false,
    can_approve: false,
    can_rollback: false,
    can_execute_cleanup: false,
    requires_user_confirmation: false,
  },
  list_creative_task_types: {
    permission: "read_only",
    writes_files: false,
    writes_only_to: [],
    can_modify_active_engine: false,
    can_activate_engine: false,
    can_approve: false,
    can_rollback: false,
    can_execute_cleanup: false,
    requires_user_confirmation: false,
  },
};

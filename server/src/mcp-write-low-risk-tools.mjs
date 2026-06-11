import { createHash } from "node:crypto";
import path from "node:path";
import {
  createAgentRun,
  assertAgentRunId,
} from "./agent-run-service.mjs";
import {
  saveCandidateDraft,
  saveProofReport,
} from "./writing-workflow-service.mjs";
import {
  saveSettlementReport,
  createPendingCandidateFromSettlementReport,
} from "./settlement-workflow-service.mjs";
import { importSettlementResult } from "./engine-candidate-service.mjs";
import {
  run_scene_planner,
  run_character_simulator,
  run_neural_critic,
  run_style_drift_detector,
  run_over_governance_detector,
} from "./neural-module-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import { atomicWriteFile } from "./file-transactions.mjs";
import { projectPaths, assertPathInside, normalizeProjectPath } from "./project-paths.mjs";
import { describeSourceFile } from "./mcp-readonly-tools.mjs";
import { createNeuralTrace } from "./neural-trace-service.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function baseOk(toolName, permission = "write_low_risk") {
  return {
    ok: true,
    tool_name: toolName,
    permission,
    result: {},
    created: [],
    warnings: [],
    blocked: false,
    blocked_reason: null,
  };
}

function blocked(toolName, reason) {
  return {
    ok: false,
    tool_name: toolName,
    permission: "write_low_risk",
    result: null,
    created: [],
    warnings: [],
    blocked: true,
    blocked_reason: reason,
  };
}

export async function create_agent_run(input = {}) {
  const tool = baseOk("create_agent_run");
  try {
    const run = await createAgentRun(input);
    tool.result.run = run;
    const runPath = path.join(projectPaths.agentRuns, run.run_id, "run.json");
    const modulesPath = path.join(projectPaths.agentRuns, run.run_id, "neural_modules_used.json");
    tool.created.push({
      label: "agent_run",
      source_path: normalizeProjectPath(runPath),
      hash: null,
      canon_status: "agent_run",
    });
    tool.created.push({
      label: "neural_modules_used",
      source_path: normalizeProjectPath(modulesPath),
      hash: null,
      canon_status: "neural_usage",
    });
    return tool;
  } catch (error) {
    return blocked("create_agent_run", error.message);
  }
}

export async function save_candidate_draft(input = {}, options = {}) {
  const tool = baseOk("save_candidate_draft");
  try {
    const draft = await saveCandidateDraft(input, options);
    tool.result.draft = {
      draft_id: draft.metadata.draft_id,
      status: draft.status.status,
    };
    const writingRoot = options.writingWorkflow
      ? assertPathInside(options.writingWorkflow, projectPaths.writingWorkflow, "workflow root")
      : projectPaths.writingWorkflow;
    const draftDir = path.join(writingRoot, "candidate_drafts", draft.metadata.draft_id);
    tool.created.push({
      label: "candidate_draft",
      source_path: normalizeProjectPath(draftDir),
      hash: draft.metadata.draft_hash ?? null,
      canon_status: "candidate",
    });
    return tool;
  } catch (error) {
    return blocked("save_candidate_draft", error.message);
  }
}

export async function save_proof_report(input = {}, options = {}) {
  const tool = baseOk("save_proof_report");
  try {
    const proof = await saveProofReport(input, options);
    tool.result.proof = {
      proof_id: proof.metadata.proof_id,
      status: proof.status.status,
    };
    const writingRoot = options.writingWorkflow
      ? assertPathInside(options.writingWorkflow, projectPaths.writingWorkflow, "workflow root")
      : projectPaths.writingWorkflow;
    const dir = path.join(writingRoot, "proof_reports", proof.metadata.proof_id);
    tool.created.push({
      label: "proof_report",
      source_path: normalizeProjectPath(dir),
      hash: proof.metadata.proof_hash ?? null,
      canon_status: "proof_report",
    });
    return tool;
  } catch (error) {
    return blocked("save_proof_report", error.message);
  }
}

export async function save_settlement_report(input = {}, options = {}) {
  const tool = baseOk("save_settlement_report");
  try {
    const report = await saveSettlementReport(input, options);
    tool.result.settlement_report = {
      settlement_report_id: report.metadata.settlement_report_id,
      status: report.status.status,
    };
    const writingRoot = options.writingWorkflow
      ? assertPathInside(options.writingWorkflow, projectPaths.writingWorkflow, "workflow root")
      : projectPaths.writingWorkflow;
    const dir = path.join(writingRoot, "settlements", "reports", report.metadata.settlement_report_id);
    tool.created.push({
      label: "settlement_report",
      source_path: normalizeProjectPath(dir),
      hash: report.metadata.settlement_hash ?? null,
      canon_status: "settlement_report",
    });
    return tool;
  } catch (error) {
    return blocked("save_settlement_report", error.message);
  }
}

export async function create_pending_candidate_from_settlement_report(input = {}, options = {}) {
  const tool = baseOk("create_pending_candidate_from_settlement_report");
  try {
    const settlementReportId = input.settlementReportId || input.settlement_report_id || input.settlementReportId;
    const result = await createPendingCandidateFromSettlementReport(settlementReportId, input, options);
    const candidate = result.pending_candidate;
    tool.result = result;
    const pendingRoot = options.pendingEngineCandidates
      ? assertPathInside(options.pendingEngineCandidates, projectPaths.canonDb, "pending candidates")
      : projectPaths.pendingEngineCandidates;
    tool.created.push({
      label: "pending_engine_candidate",
      source_path: normalizeProjectPath(path.join(pendingRoot, candidate.metadata.candidate_id)),
      hash: candidate.metadata.candidate_hash ?? null,
      canon_status: "pending",
    });
    return tool;
  } catch (error) {
    return blocked("create_pending_candidate_from_settlement_report", error.message);
  }
}

export async function save_run_log(input = {}, options = {}) {
  const tool = baseOk("save_run_log");
  try {
    const runId = input.runId || input.run_id;
    assertAgentRunId(runId);
    const allowedRoot = options.agentRuns
      ? assertPathInside(options.agentRuns, projectPaths.agentRuns, "agent runs root")
      : projectPaths.agentRuns;
    const logsDir = path.join(allowedRoot, runId, "logs");
    const logPath = path.join(logsDir, "run_log.jsonl");
    const entry = {
      run_id: runId,
      created_at: new Date().toISOString(),
      source: input.source || "mcp_write_low_risk",
      payload: input.payload ?? {},
    };
    await commitFileTransaction("save-run-log", [
      { type: "append", filePath: logPath, content: `${JSON.stringify(entry)}\n` },
    ], { run_id: runId, phase: "phase_7b" });
    tool.result.log = entry;
    tool.created.push({
      label: "run_log",
      source_path: normalizeProjectPath(logPath),
      hash: sha256(JSON.stringify(entry)),
      canon_status: "run_log",
    });
    return tool;
  } catch (error) {
    return blocked("save_run_log", error.message);
  }
}

// Neural module wrappers: rely on existing neural-module-service which records traces.
async function callNeuralWrapper(fn, input = {}, options = {}) {
  const tool = baseOk(fn.name, "write_low_risk");
  try {
    const result = await fn(input, options);
    // result.trace is produced by the wrapper and persisted to traces.
    if (result?.trace) {
      tool.result.trace = result.trace;
      tool.created.push({
        label: "neural_trace",
        source_path: normalizeProjectPath(path.join(projectPaths.neuralTraces, `${result.trace.trace_id}.json`)),
        hash: result.trace.input_hash ?? null,
        canon_status: "neural_trace",
      });
    }
    tool.result.output = result.output ?? null;
    return tool;
  } catch (error) {
    return blocked(fn.name, error.message);
  }
}

export async function run_scene_planner_tool(input = {}, options = {}) {
  return callNeuralWrapper(run_scene_planner, input, options);
}

export async function run_character_simulator_tool(input = {}, options = {}) {
  return callNeuralWrapper(run_character_simulator, input, options);
}

export async function run_neural_critic_tool(input = {}, options = {}) {
  return callNeuralWrapper(run_neural_critic, input, options);
}

export async function run_style_drift_detector_tool(input = {}, options = {}) {
  return callNeuralWrapper(run_style_drift_detector, input, options);
}

export async function run_over_governance_detector_tool(input = {}, options = {}) {
  return callNeuralWrapper(run_over_governance_detector, input, options);
}

export const writeLowRiskTools = {
  create_agent_run,
  save_candidate_draft,
  save_proof_report,
  save_settlement_report,
  create_pending_candidate_from_settlement_report,
  save_run_log,
  run_scene_planner: run_scene_planner_tool,
  run_character_simulator: run_character_simulator_tool,
  run_neural_critic: run_neural_critic_tool,
  run_style_drift_detector: run_style_drift_detector_tool,
  run_over_governance_detector: run_over_governance_detector_tool,
};

export const writeLowRiskToolMetadata = Object.fromEntries(Object.keys(writeLowRiskTools).map((name) => [name, {
  permission: "write_low_risk",
  writes_files: true,
  writes_neural_trace: name.startsWith("run_"),
  can_modify_active_engine: false,
  can_activate_engine: false,
  can_rollback: false,
  can_execute_cleanup: false,
  requires_user_confirmation: false,
  writes_only_to: [
    normalizeProjectPath(projectPaths.writingWorkflow),
    normalizeProjectPath(projectPaths.agentRuns),
    normalizeProjectPath(projectPaths.pendingEngineCandidates),
  ],
}]));

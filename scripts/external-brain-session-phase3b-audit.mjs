import { writeExternalBrainSessionPhase3bAudits } from "../server/src/external-brain-session-reconciliation-service.mjs";

const result = await writeExternalBrainSessionPhase3bAudits();
console.log(JSON.stringify({
  liveness_path: result.liveness_path,
  reconciliation_plan_path: result.plan_path,
  running_session_count: result.liveness.running_session_count,
  diagnostic_counts: result.liveness.diagnostic_counts,
  recommendation_counts: result.liveness.recommendation_counts,
  deterministic_backfill_count: result.plan.deterministic_backfill_count,
  deterministic_completion_reconciliation_count: result.plan.deterministic_completion_reconciliation_count,
  retire_recommended_count: result.plan.retire_recommended_count,
  automatic_retirement_executed: false,
  production_cleanup_executed: false,
}, null, 2));

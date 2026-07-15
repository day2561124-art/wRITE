import { writeExternalBrainSessionLifecycleAudit } from "../server/src/external-brain-session-lineage-service.mjs";

const result = await writeExternalBrainSessionLifecycleAudit();
console.log(JSON.stringify({
  output_path: result.output_path,
  external_brain_session_count: result.report.external_brain_session_count,
  classification_counts: result.report.classification_counts,
  potential_cleanup_sessions: result.report.potential_cleanup_sessions,
  estimated_reclaim_bytes: result.report.estimated_reclaim_bytes,
  estimated_reclaim_files: result.report.estimated_reclaim_files,
  production_cleanup_executed: false,
}, null, 2));

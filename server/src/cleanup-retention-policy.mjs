export const defaultCleanupRetentionPolicy = Object.freeze({
  keep_latest_archives: 10,
  keep_latest_snapshots: 10,
  rejected_candidate_days: 90,
  failed_candidate_days: 90,
  blocked_candidate_days: 90,
  completed_unadopted_session_days: 45,
  failed_or_blocked_session_days: 30,
  test_session_days: 14,
  trash_retention_days: 30,
});

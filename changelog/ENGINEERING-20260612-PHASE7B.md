# ENGINEERING 2026-06-12 PHASE7B

Phase 7B: MCP write-low-risk tools

- 新增 `server/src/mcp-write-low-risk-tools.mjs`，匯出 `writeLowRiskTools` 與 `writeLowRiskToolMetadata`。
- 工具列表（low-risk write）：
  - create_agent_run
  - save_candidate_draft
  - save_proof_report
  - save_settlement_report
  - create_pending_candidate_from_settlement_report
  - save_run_log
  - run_scene_planner
  - run_character_simulator
  - run_neural_critic
  - run_style_drift_detector
  - run_over_governance_detector

實作遵守 Phase 7B 規範：不修改 `data/canon_db/active_engine.md`、不建立 snapshot / archive、不得 activate / rollback / execute cleanup。

新增測試： `tests/mcp/mcp-write-low-risk-tools.test.mjs`，並更新 `tests/run-all.mjs`。

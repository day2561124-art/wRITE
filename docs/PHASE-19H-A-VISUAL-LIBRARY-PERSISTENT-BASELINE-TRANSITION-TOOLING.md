# Phase 19H-A: Visual Library Persistent Baseline Transition Tooling

Phase 19H-A provides the preview-first transition plan required before the
formal visual library can move from an empty baseline to a persistent non-empty
baseline.

This phase does not activate that transition. Formal import and acceptance
baseline changes remain deferred to Phase 19H-B.

## Preview Output

The service reports:

- Current formal visual index and asset counts.
- Protected active-engine hash and required protected-path checks.
- The proposed future `0 -> N` baseline, where `1 <= N <= 3`.
- Inputs and confirmation gates required by Phase 19H-B.
- The acceptance updates that Phase 19H-B must apply.
- Rollback triggers and required restoration state.
- Forbidden actions and next-phase readiness.

An optional controlled import result may be summarized to show whether it has
imported items and a rollback manifest. The preview never executes that result.

## CLI

```powershell
node .\scripts\visual-library-persistent-baseline-transition-preview.mjs --pretty
```

Supported arguments are `--pretty`, `--json`, and `--help`.

Dangerous arguments including `--execute`, `--confirm-text`, `--write`,
`--import`, `--rollback`, `--delete`, `--restore`, and
`--update-acceptance` return `blocked_forbidden_argument`.

## Safety Boundary

Phase 19H-A does not:

- Modify `data/visual_db/visual_index.jsonl`.
- Copy files into `data/visual_db/assets`.
- Update the final E2E or UI acceptance baseline.
- Modify active engine, Canon DB, compressed rules, or Approval Queue.
- Create an approval item or `canon_visual_lock`.
- Register an MCP write tool or alter the Phase 19F read-only tool.

Phase 19H-B requires separate human approval before any persistent write or
acceptance baseline update.

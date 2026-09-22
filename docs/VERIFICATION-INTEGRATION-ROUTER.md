# VA-5 — Exact-Candidate Integration Verification Router

Baseline: 27a349ba97534d4b61955754cf716cef33b89d0e.

## Boundary

Formal integration still materializes the exact validated commit, checks candidate and
dependency freshness, performs working/staged diff checks, preserves unrelated dirty
main, records each real test operation in the Journal, performs controlled main
advancement, and verifies the canonical remote. This phase changes suite selection
only. The previous full MCP/MCP tunnel gates and VA-4 reliability tests remain
available and are never deleted.

The server reads the NUL-delimited git diff --name-only --no-renames -z
from exact target HEAD to exact integration commit, within its own materialized
integration worktree. The clean integration worktree's porcelain status is NOT
the source of changed files. An unavailable/failed Git diff fails validation.
Any missing, ambiguous, invalid, mixed-domain or unreviewed path retains the old
mcp + mcp_tunnel gate. An explicit certification-file change adds all.
A required suite FAIL/timeout ends execution and fails candidate validation;
it never becomes a green skip or a retry PASS.

## Reviewed suite routing

- Character communication-only source and reviewed IR contract: communication.
  The fixed allowlisted tests/run-communication.mjs entrypoint retains the
  existing communication inventory and contracts; no arbitrary command.
- Reviewed memory/retrieval/affect source and Phase90–96 tests:
  memory_retrieval + cognition + world_simulation.
- Explicit MCP core paths: mcp_core.
- Reviewed MCP infrastructure: mcp_core + mcp_infrastructure.
- MCP HTTP/transport changes: mcp_core + mcp_infrastructure + mcp_tunnel.
- MCP reliability: mcp_core + mcp_reliability, adding infrastructure and tunnel
  when the same path touches HTTP/transport.
- Router/integration/tool-runner/unknown/mixed-source changes:
  the legacy mcp + mcp_tunnel gate.

The integration system's existing exact-candidate and provenance tests stay in
mcp. During migration VA-5 itself changes integration routing and therefore
must go through the OLD full formal gate. The affected development gate
still analyzes working-tree changes before commit; naive execution against a
clean integration commit would fall back to all. Exact candidate routing instead
selects reviewed suites from the target-to-commit delta. Future expansion needs
explicit classification and coverage tests, not speculative filename rules.

## Research basis

Risk-aligned test choice and conservative escalation are consistent with Google's
change qualification/presubmit descriptions. GitHub documents that skipping a
required workflow on path filters can leave required checks Pending. The controlled
formal validation entrypoint therefore always runs a selected required gate and
never treats an absent check as success. Classification controls depth, not the
mandatory Journal, commit-identity, diff, transaction or remote safety gates.

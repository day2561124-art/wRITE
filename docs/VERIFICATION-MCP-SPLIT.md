# VA-4 — MCP suite separation

Base: `00f55c7927bcc98d6fcddf520eed0e25fccc2b05`.

## Contract

`tests/tools/mcp-suite-groups.mjs` assigns every script from the original 24-step
`tests/tools/mcp-contract.test.mjs` exactly one owner: `core`, `infrastructure`,
or `reliability`. Membership keeps the original full-runner order. The additive
`mcp-suite-groups.test.mjs` checks the exact historical inventory, uniqueness,
partition completeness, required reliability scripts and on-disk entrypoints.
The original `mcp` runner remains the full 24-script gate (plus the additive
partition contract) and its timeout/isolated test environment are unchanged.

## Controlled suites

| Suite | Intended trigger | Important exclusions |
| --- | --- | --- |
| `mcp_core` | MCP contract / tool profile / basic development and Journal contract / readiness | Failure injection, transaction and checkpoint reliability certification |
| `mcp_infrastructure` | Process/HTTP/session/origin/security/workspace/integration infrastructure | Reliability certification |
| `mcp_reliability` | Explicit reliability and recovery changes or certification | No implicit ordinary feature gate |
| `mcp` | Legacy full gate retained while integration routing is unchanged | No scripts removed |

New layer entrypoints are fixed files in the controlled `dev_run_tests` allowlist,
not arbitrary caller commands. They run one server-approved sequential list and
keep the original isolated Journal/checkpoint/transaction fixture environment and
per-script timeouts. The new suites are not yet substituted for `mcp` or
`mcp_tunnel` by formal integration: **that is VA-5's risk router scope**.
No CC-6D test inventory, full regression inventory, certification evidence, or
reliability test is deleted.

## Safety and acceptance

- An unknown suite or unapproved command remains rejected.
- Every original script remains in `mcp` and in exactly one layer.
- Ordinary `mcp_core` excludes `mcp-reliability-certification.test.mjs`.
- Full `mcp` must still PASS before treating this phase as integrated.
- Journal, transaction, checkpoint, exact-candidate validation and canonical
  remote verification remain authoritative. A retry PASS cannot erase a prior
  failure, and the global exclusive test lock must not be bypassed.

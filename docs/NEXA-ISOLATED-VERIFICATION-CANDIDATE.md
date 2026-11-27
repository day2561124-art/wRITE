# Isolated verification continuation

Refs #106 and #128. This candidate continues the fixed AppContainer route with hosted verification and narrowly scoped Windows runner compatibility fixes, not an authorization or deployment change.

## Execution boundary

- `mcp_hermetic_core`: fixed five-file AppContainer closure; working-tree snapshot evidence. No network or host state; it is never equivalent to a full gate.
- `mcp_pi_postseal`: existing 29-script group plus its preflight. Includes native Windows runner, nested isolation, HTTP, Git and recovery fixtures. Run the unchanged suite on disposable GitHub-hosted Windows and Linux runners at an exact checked-out candidate SHA.
- `mcp`, `mcp_core`, `mcp_infrastructure`, `mcp_reliability`, `mcp_tunnel`, subsystem suites, `affected`, and `all`: retain existing reviewed definitions and required coverage. Host-dependent suites are not enabled in the protected local dispatcher.

The stacked PR job uses read-only repository permissions and does not persist checkout credentials, select a self-hosted runner, install a production service, read operator grants, or send production data. Its results certify only the checked-out committed candidate and the actual runner/platform. OS-specific skips must be inspected rather than counted as passes. The CI workflow and candidate code are not an independent authorization source.

## Completion gates

1. Preserve and finish #128's current CI without restarting it for this follow-up.
2. Inspect the complete postseal logs on both platforms. Classify fixture/runner limitations and product failures separately; retain every original test and safety assertion; test-fixture watchdogs may be adjusted independently of production defaults.
3. Run the original complete `all` gate on the exact combined candidate on a disposable Ubuntu runner, alongside both platform postseal jobs. A fixed isolated development receipt independently recaptures both snapshot boundaries without memory/parent authority reuse. Do not promote a focused receipt to full evidence.
4. For a future production integration, require a separate trusted verifier of exact candidate identity, required suites, successful platform runs and original gate result. Bind evidence to a commit, never to an uncommitted workspace by assumption. No CI result alone authorizes local integration, push, maintenance, or deployment.
5. Test live permanent authorization using an independently approved isolated workspace and release candidate. Keep R10 and operator policy unchanged unless explicitly authorized through the existing host mechanism.

A disposable hosted runner is useful for committed candidates, but it cannot certify the live dispatcher identity, live ACLs, a private dirty worktree or actual local policy. No general local full-suite runner is implemented by this follow-up.

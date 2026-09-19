# Character Memory Core — Certification Final Audit

## Scope and authority

This is a release evidence and boundary audit for the sealed Phase90–96 Character Memory Core, not Phase97 and not a new psychological behavior. The starting authoritative main/remote commit is `83c24e5f6ee4e5624292d27fcadb308788dd861f` (Phase96). Keep all sealed phases intact unless an independently demonstrated authoritative regression requires a separately scoped repair. Existing unrelated shared-main dirty files and other workstreams are not certification inputs and must not be modified.

Certification means **repository contract and regression-suite verification**, not proof that a human-like mind has been achieved, not field evaluation of a local language model, and not universal behavioral correctness. A successful static inventory check is not a substitute for execution of the phase suites, world simulation, cognition, memory retrieval, and formal MCP/MCP-tunnel integration checks.

## Requirement-to-evidence matrix

| Requirement / source of authority | Executable evidence | Bounded negative or abstention criterion |
| --- | --- | --- |
| Phase90A selective encoding from attended and meaningful evidence | `tests/phase90/phase90a-selective-memory-encoding.test.mjs` | No binary attention gate, universal threshold, memory-content rewrite or world-truth authority. |
| Phase90B unified current accessibility, actual Phase63B/63C ownership | `tests/phase90/phase90b-unified-memory-accessibility.test.mjs` | No single memory-strength variable, novel scalar accessibility score or persistent-memory mutation. |
| Phase91 adaptive consolidation | `tests/phase91/phase91-adaptive-memory-consolidation.test.mjs` | Elapsed time alone cannot prove consolidation, and consolidated is not truth or guaranteed recall. |
| Phase92 reconsolidation closure | `tests/phase92/phase92-memory-reconsolidation-lifecycle.test.mjs` | Canonical stored trace preserved; no same-turn destabilization/restabilization or retrieval-alone update. |
| Phase93 metamemory and retrieval effort | `tests/phase93/phase93-metamemory-retrieval-effort.test.mjs` | No checking unrecovered memories, hidden target presence, numerical confidence or control takeover. |
| Phase94 familiarity, recognition and source monitoring | `tests/phase94/phase94-familiarity-recognition-source-monitoring.test.mjs` | Familiarity is not identity/world truth; attribution does not access hidden provenance. |
| Phase95 interference and bounded distortion | `tests/phase95/phase95-interference-bounded-memory-distortion.test.mjs` | No invented or randomly rewritten memory; competition/distortion need eligible evidence. |
| Phase96 memory–affect lifecycle closure | `tests/phase96/phase96-memory-affect-lifecycle-closure.test.mjs` | Only real current-turn Phase63C recovery admitted into Runtime Current Mind, same-character Phase89C mood; no affective truth/selection/rewrite authority. |
| Phase90–96 end-to-end *test inventory*, phase contracts and cross-phase negatives | `tests/certification/character-memory-core-certification.test.mjs` | All eight phase tests appear once across world-simulation/cognition/memory-retrieval groups and in the full runner; certification executes last. |

The certification test asserts the actual exported runtime contracts, rather than duplicating the full scenario fixtures. The phase-specific tests retain ownership of behavioral and negative-case evidence. In particular Phase96's source checks cover the ordering from Phase89C to action candidate construction and the current/final working-context boundary.

## Acceptance gates

1. No unrelated shared-main changes copied, staged, reset or committed; certification changes remain isolated and explicitly enumerated.
2. Run affected tests, world_simulation, cognition and memory_retrieval on an exact worktree snapshot; verify that phase-specific behavioral tests and certification all execute. Record any failure, timeout or unexecuted gate as **not verified** rather than PASS.
3. Controlled exact-commit formal integration validation runs MCP, MCP tunnel and diff checks; only then integrate/push and independently compare `local main` with authoritative `origin/main` using ls-remote, not the potentially stale local tracking ref.
4. Confirm Journal chain, zero dangling/active operations, checkpoint/transaction integrity, isolated-worktree cleanup. Record an infrastructure failure separately from an authoritative memory-core regression.

## Non-goals and explicit open-boundary handling

The planned bounded *time-based prospective-memory temporal_juncture / equivalent temporal cue* is a **separate cross-system question**, not evidence to fabricate a standalone prospective-memory engine or a reason to reopen sealed Phase90–96. A literal `temporal_juncture` and `prospective_memory` search of `server/src` found no match during this audit; that narrow search alone cannot establish whether an equivalent cue is absent. Do not certify an equivalent implementation or assert absence without tracing the full cue/intent/clock path. If a genuine gap is established, record and scope it separately; do not silently claim it is implemented.

The phase suite and formal integration gates are evidence about this repository's tested contracts, not a substitute for real-time long-run character evaluation, semantic validity of a separately selected local model, or an external psychological validation.

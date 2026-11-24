# CB-C7 — Formal / Native semantic parity preparation

Status: **source-grounded preparation only; C7 implementation not yet accepted.**
Date: 2026-11-24. Exact audit baseline: `6273bb70e192616bd016500a3e1edc93945c7c02`.
Authority: BR-07 and BR-19 in `docs/CHARACTER-BRAIN-C-LINE-BLUEPRINT-CONTRACT.md`.
Prerequisite: C6 bounded functional implementation/remote regression accepted; formal local seal remains outstanding. This preparation neither bypasses that formal gate nor reopens C6.

## Scope

Formal transport and Native execution must preserve equivalent Character Brain semantics, epistemic boundaries and character choice authority for equivalent supported scenes. Native uses trusted in-process callbacks; Formal must use its own bounded, brokered decision protocol. Identical implementation, raw packet shape, arbitrary caller callbacks, and model-context forgetting are not requirements. Do not replace the existing Memory, Belief, Affect, Goal, Plan, CC or World writers with transport-owned truth.

## Inspected actual baseline

| Source | Finding |
| --- | --- |
| C-line blueprint BR-07, BR-19 | C7 covers retrieval failure/source ambiguity/delayed recovery and paired authority, belief, retrieval and action semantics. |
| `server/src/world-simulation-formal-turn-transport-service.mjs` lines 94–116, 637–661 | `formalLoopOptions` deliberately strips caller callbacks; trusted replay only builds closures from already validated broker submissions. `prepareFormalDecisionRound` calls canonical Native preparation, then builds existing deliberation rounds. |
| Same file lines 140–178, 714–761, 862–965 | Existing formal surfaces and contract retain one active prepared turn, ordered bounded submissions, one-shot resolution, same-snapshot replay and action/outcome/commit authority separation. Do not relax these restrictions. |
| `server/src/world-simulation-formal-experiential-deliberation-contract.mjs` and `world-simulation-formal-experiential-deliberation-service.mjs` | Existing Phase76/79/80/81/82/89 decision kinds and server replay provide an architectural precedent for a new bounded semantic round; no Phase63C decision kind was found in the inspected enum. Replay checks canonical resolver-view hashes. |
| `server/src/world-simulation-loop-service.mjs` lines 3644–3721 | Native `resolveMemoryRetrievalResolution` invokes an explicitly supplied trusted resolver with character, query, candidate records/evaluations, perception and character state; absent resolver returns `process_occurred:false`. Resolver output cannot author recovered content. The input is engine-side and is not a safe public decision packet. |
| `docs/WORLD-SIMULATION-FORMAL-MCP-TRANSPORT.md` | Formal explicitly leaves Phase63C recovery absent until an isolated resolver context exists. Recovered semantics belong to working context when Runtime v3 reinstatement is active, not raw candidate contents or legacy retrieved_memories alias. |
| `tests/phase62/phase62a-r1-formal-mcp-public-adoption.test.mjs` | Existing public boundary tests prohibit unretrieved candidate secrets and raw recovered-content channel leakage. They are preservation requirements, not tests to delete to make parity green. |
| `tests/phase63/phase63c-memory-retrieval-process.test.mjs`, `phase63c-memory-retrieval-multistep.test.mjs`, `phase63c-memory-retrieval-persistence.test.mjs` | Existing Native/core retrieval oracles cover no-process, partial/source-grounded recovery, target failure with non-target recovery, spontaneous recovery, source selectors and persistence. These are inspected test surfaces, not a new execution receipt. |

## Bounded engineering sequence

1. **C7-A: exact source map and authority contract.** Trace actual public and IPC broker schema, round submission/validation, prepared payload lifetime, and Phase63C query/candidate/recovery validation. Inventory existing formal stages before declaring any gaps. Preserve public adoption and no-callback protections. This document is the initial preparation artifact, not the completed source audit.
2. **C7-B: memory retrieval parity, first confirmed functional gap.** Identify a safe character-specific retrieval decision representation that does not expose candidate contents as already remembered facts. Keep full candidate records and source selectors engine-side; use the existing Phase63C evaluator/writer to ground actual recovered fragments. A no-process, failed or partial retrieval remains possible. Do not substitute deterministic success, inject known answer text, or simply forward arbitrary callback functions. Any staged replay must bind exact session, revision/hash, character, stage, opaque handle and canonical resolver context. If the existing isolated context cannot meet the boundary, keep the gap unresolved rather than exposing raw records.
3. **C7-C: belief/decision/communication parity inventory and targeted connections.** Inspect the actual current Formal and Native surfaces for observer-specific belief revision, goals/plans, affect, social interpretation, action selection and already-supported CC/experiential rounds. Only connect demonstrably missing semantic edges; reuse existing authority validators and writers. Avoid a blanket parity claim from a shared service import or the older blueprint inventory. Derive finite acceptance cases from the actual gaps.
4. **C7-D: paired acceptance.** For equivalent bounded scenes, compare recovered content and uncertainty, subjective belief, available decision authority and subsequent committed action/outcome; compare semantic consequences rather than session-specific opaque IDs or identical turn counts. Include two observers with distinct available evidence, hidden candidate/source rejection, no-process and failure, partial recovery, wrong/stale/cross-character/duplicate handle, callback injection, and durable replay. Preserve formal public redaction and parent broker lifecycle. Execute affected and main regression on the exact candidate, then formal local verification.

C7 is not general World/Body expansion, multiplayer isolation, unrestricted semantic model quality, or C8 cross-day continuity. The first actionable next step is to trace the broker/Phase63C boundary and build a bounded retrieval parity contract and negative/positive oracle, not modify sealed memory semantics.

## C6 handoff

PR #90 exact integrated main `8c1b7fe340edcc80830420a53e078f8367b78be3` completed [main regression 45340440268](https://github.com/day2561124-art/wRITE/actions/runs/45340440268) with all five required jobs successful. PR #92 acceptance documentation was merged at the exact baseline above. C6 local synchronization, Nexa Journal/transaction/checkpoint/cleanup and formal seal remain unverified. Do not claim C6 PASS_STABLE or workstation deployment. Source-only C7 preparation is permissible without asserting that formal closure.


## C7-A focused staged-retrieval authority audit — 2026-11-24

Exact inspected main: `0c90c42eea7b40b3d1e379ea2b7ebe69a570e8ff`.
PR #93 passed [CI 45346890542](https://github.com/day2561124-art/wRITE/actions/runs/45346890542) and was merged. C6 documentation main [45346647378](https://github.com/day2561124-art/wRITE/actions/runs/45346647378) passed.

### Correct the older transport description before implementation

The inspected current Native preparation is **not limited to the legacy V2
single-step resolver**. `world-simulation-loop-service.mjs:6688–6857`
chooses `memoryRetrievalStageResolver` and Phase63C V3 when present, or
falls back to V2. The existing learned-dialogue referent path may supply
an internally owned staged resolver, and unresolved conversation descriptions
may supply an internally owned no-process resolver. Preserve these special
routes. Therefore the confirmed gap is the **general Formal caller-driven
staged retrieval path**, not a claim that Formal can never execute any
internal retrieval under any event configuration.

`world-simulation-memory-retrieval-multistep-service.mjs`:
- 2820–2910: initiation uses a frontier/query projection without candidate
  contents, and grounded cue-orientation options.
- 3090–3175: recovery exposes current-frontier candidate records to the
  trusted engine-side resolver, with prior recovered semantic views.
- 3270–3355: optional cue construction receives actual materialized sources
  only, not full memory records, future queue or unrecovered content.
- 3470–3550: continuation receives actual recovery occurrences and current
  recovered views; later frontier depends on admitted cues and kernel
  processing.
- 2015–2065: the kernel clones/freeze-binds the actual resolver input,
  requires an object and records stage/step/input/output audit.
- Technical step limit is a safety bound, not a cognitive stop decision.
  Do not invent a successful recall or treat budget exhaustion as forgetting.

The existing multistep test at lines 205–350 is a concrete positive/negative
oracle: target content is not present at initiation or recovery step 0;
a real recovered bridge cue permits later target frontier entry; only then
does the trusted recovery resolver see target content. The later recovery
uses a source selector, and continuation explicitly stops. Preserve the
distinction between a trusted recovery resolver and the Character Brain
receiving recovered semantics. Passing a full recovery input to the public
caller would violate that distinction.

### Formal/IPC lifecycle and required extension

`world-simulation-mcp-boundary-service.mjs` currently enumerates **five**
formal public World tools, including
`chatgpt_bridge_submit_world_character_deliberation`. The four-tool list
in the older Phase62 document is historical, not current capability evidence.
`mcp-world-simulation-tools.mjs` routes deliberation to the formal transport;
`world-simulation-prepared-turn-broker-ipc.mjs` forwards an opaque prepared
handle, decision handle and bounded deliberation response to the parent.
No runtime function travels through IPC.

`world-simulation-formal-turn-transport-service.mjs:795–963` reserves
preparation against committed revision/hash, publishes one current decision,
checks fresh receipt before each submission, and uses stored deliberation
submissions for same-snapshot repreparation. Errors abort preparation rather
than fabricate a decision. Existing
`world-simulation-prepared-turn-ephemeral-broker.mjs:547–625` explicitly
allows enumerated deliberation stages and rejects non-current handles.
Its duplicate rule is **one submission per decision kind and character**.
This is adequate for existing one-shot stages, but cannot represent
multiple recovery/continuation iterations for the same observer.

The existing experiential-round protocol is a useful precedent, not a
drop-in V3 adapter. A retrieval decision must be distinguished by the
exact session and committed frontier, observer, retrieval episode/query,
stage, step and canonical stage-input hash, with engine-owned opaque
decision handle. Do not globally remove the existing duplicate check.
Introduce retrieval-specific identity and admission only after its
validation contract exists. Any rerun must consume the same validated
prefix in deterministic stage order; a changed prefix/frontier fails
closed. Do not replay a previously completed World commit.

### First implementation boundary for C7-B

Prefer a small **engine-private staged resolver replay/checkpoint contract**
as the first executable slice, separately from public adoption.

1. Trace V3 stage-specific response validators and actual query identity
   stability across same-snapshot preparation. Define the private canonical
   stage identity and transcript validation for repeated stages, including
   exact input hash, step order, observer and session/frontier binding.
2. Build a bounded replay/next-request adapter and tests with the existing
   V3 kernel: no process; recovery failure; partial fragment; bridge cue
   and subsequent recovery; explicit continuation/stop; changed stage hash,
   duplicate or out-of-order response, foreign observer and stale frontier.
   An unanswered request is pending, **not** a fake no-process result or
   completed prepared turn. Retain all recovery and World writes under
   existing owners. This adapter alone is not Formal public parity.
3. Before routing any recovery request through Formal/IPC, specify and prove
   the actual isolation boundary. Initiation/continuation/cue construction
   may have candidate-content-free bounded views; recovery's trusted input
   is not public-safe. Use an actually isolated trusted recovery context
   with the same source-grounded validators, or a separately proven
   content-safe decision representation. Do not expose raw candidate
   records, candidate diagnostics, hidden future frontier, or source
   locators in the ordinary Character Brain/action packet. Do not assume
   changing a label to "private" establishes model-context isolation.
4. Adopt only the proven stage route in the existing broker and public
   transport; preserve prior stage semantics and no arbitrary callbacks.
   Verify the full Native/Formal pair and public redaction before marking
   C7-B accepted.

Remaining C7-A inspection: exact MCP schema and parent dispatch allowlists,
stage-specific response validation and actual retrieval query/replay identity,
plus the wider Formal/Native semantic inventory. This is a focused audit,
not a completed C7-A gate. No runtime code has been changed in this slice.

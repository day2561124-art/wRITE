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


## C7-B private replay and public receipt boundary — 2026-11-24

PR #96 merged at `3fec924bcd57f547b0f2b42cd53bc79db1c297b1`; [CI 45352493340](https://github.com/day2561124-art/wRITE/actions/runs/45352493340) passed all six executed jobs. The affected gate actually executed the extended Phase63C fixture. Private staged replay is an executable slice, not public parity.

Further inspection:
- `world-simulation-loop-service.mjs` derives turn ID from session, committed revision/hash and event ID; the V3 query then binds observer, turn, memory snapshot, accessibility context, initial frontier and goal.
- `mcp-server.mjs` deliberation schema explicitly allows only the existing Phase79M response fields. Do not broaden it to arbitrary recovery objects.
- `world-simulation-prepared-turn-broker-ipc.mjs` forwards bounded deliberation input to the parent, whose owner identity is minted by the attachment. The parent broker returns the current `character_input` directly; an internal recovery payload placed there would be exposed.
- This slice rejects private replay request/response envelopes and raw recovery stage views nested in public decision input before storing a prepared round. Direct parent and IPC negative cases verify no current decision or private content is returned; ordinary action preparation still proceeds. This is a narrow defense-in-depth guard, not general sanitization or proof of model-context isolation.
- Native learned-dialogue special-case recovery is not a general recovery policy. Do not substitute it, always-recover behavior, or a dummy failure for general retrieval.
- Next executable boundary: define an engine-owned, separately isolated recovery executor and a content-safe projection for other stage decisions. The existing private replay helper supplies stage identity and transcript validation. No public schema expansion or adoption until that route is demonstrated end to end. C7-A wider semantic inventory remains open.


## C7-B private World preparation executor — 2026-11-25

PR #97 ([CI 45356232668](https://github.com/day2561124-art/wRITE/actions/runs/45356232668)) and PR #98 ([CI 45358151235](https://github.com/day2561124-art/wRITE/actions/runs/45358151235)) each passed all six executed jobs and were merged at `794f20716b8ebeace1e424ee084525d8cd8162d6` and `c5a4bb8b5f1e969f55655de13501fe47764ad26b`. Integrated main full regression is separate.

The private World preparation entry validates the actual committed frontier before and after each checkpoint. The existing Character Runtime Manager handles current-mind/action preparation and committed experience, but has no general independent Phase63C recovery-model provider. The legacy neural memory retriever is not a replacement for V3.

This slice adds an engine-private host executor over that checkpoint entry. The host must explicitly supply a stage-context factory; each pending request acquires a distinct context object, sends only the current trusted stage view, binds the response to the exact request, and closes the context before admitting another stage. Missing provider, provider failure, reuse and close failure must not become cognitive failure or a completed turn. The existing kernel remains the authority on memory materialization and stage semantics.

This lifecycle contract is not a security sandbox or model-context attestation. The test backend is deterministic and not a model. The formal/public action conversation must never be used as the trusted recovery context. Before public adoption, establish a real host-owned backend with independent model-context lifecycle, confirm its data retention/logging boundaries, and integrate the private transcript with parent reservation/repreparation without re-running resolved stages or weakening current deliberation authority. No new public MCP tools or automatic recall policy are installed by this slice.


## C7-B configured Formal retrieval and parent-owned replay — 2026-11-25

This candidate connects the private checkpoint/executor to the existing Formal prepare/deliberation/action/resolve lifecycle. The preparation reservation owner requests the private preparation through the existing broker or parent IPC. The parent derives the committed frontier, executes the first private search, retains only the bound response transcript for same-snapshot repreparation, and replays it with the existing engine-owned deliberation closures. A changed or incomplete prefix blocks rather than generating a new response. The parent rejects a configured round that bypasses this preparation or substitutes different retrieval/decision packet contents. Terminal cleanup drops process-local references, not a secure erase claim.

Host configuration is opt-in and separate from prose generation:
- `WRITER_PRIVATE_RETRIEVAL_ENDPOINT`: explicitly configured HTTP loopback OpenAI-compatible JSON chat-completions endpoint (127.0.0.1 or ::1).
- `WRITER_PRIVATE_RETRIEVAL_MODEL`: explicit model ID on that endpoint.
- Optional `WRITER_PRIVATE_RETRIEVAL_AUTH_TOKEN`, `WRITER_PRIVATE_RETRIEVAL_TIMEOUT_MS` (100–30000, default 20000), and `WRITER_PRIVATE_RETRIEVAL_STEP_BUDGET` (1–32, default 8; technical safety only).
- Both endpoint and model absent retains existing unconfigured compatibility behavior, not retrieval parity. Partial or invalid config fails closed. Never inherit the prose provider or OpenAI API key. No public tool schema or caller callback ingress changes.
- HTTP parent owns the provider and stage transcript; standalone transport can use the same host configuration. Each stage sends a fresh two-message JSON request without conversation history, requesting `store:false`. Endpoint redirects are rejected; payloads and elapsed execution are bounded. Provider faults/malformed responses block preparation rather than being classified as forgetting. A local server can still proxy or retain requests; deploy only a trusted independently verified backend. No actual model execution or retention attestation is claimed by this source candidate.

Acceptance additions (pending execution): real Phase63C fixture through configured host protocol with synthetic fetch, parent IPC, public Formal prepare, repeat prepare, submit, commit and duplicate resolve rejection; no unrecovered text or private transcript in public receipts; invalid host and malformed provider failure; existing Phase89B deliberation reprepare with multi-observer explicit no-process decisions, replay without new provider calls and unchanged mood semantics. Keep Native and Formal authority on existing kernel and original deliberation validators. Production provider configuration and real model verification are still outstanding. C7-C and C7-D remain open.


## C7-C explicit goal/plan and post-encoding claim continuation — 2026-11-25

PR #115 (CI 45567664892, merge `400a9a9340738e45272367c648de07e2c6e3cefd`) passed the affected gate including Phase68D paired Native/Formal goal/plan lifecycle and the actual public MCP contract. PR #117 (CI 45567935619, merge `8cc2179ae2176944fdc207af8c6d98abb5a24d82`) passed the affected gate including Native and engine-only claim handoff, one claim/one belief revision, distinct observer motivation source, stale/forged/duplicate evidence rejection and unchanged committed state/history on failure.

This candidate adopts the shared post-encoding claim interpreter in Formal. The character may opt in on its current action decision with `request_subjective_claim_interpretation: true`. After all action decisions freeze, the existing resolve tool enters a parent-owned process-local canonical resolution once. If the engine admits current-turn subjective memory to the requesting character, the receipt returns `resolution_pending: true` and a current decision of kind `post_encoding_subjective_claim`. The existing deliberation tool accepts only `claim_context_token` and `claim_intents` for that decision (an empty list is a valid decision). The parent keeps the staged execution and lease, validates opaque context/source tokens, and resumes the same running canonical pipeline; it does not rerun causal execution or expose staged World state. Subsequent prepare/resolve calls may observe the same pending handle. A child disconnect does not cancel a parent-owned continuation. The canonical commit gate and CAS remain authoritative; immediately before the atomic writer, the engine must acquire the active parent permit. Before that permit, abandonment/expiry invalidates the continuation; once granted, cancellation cannot revoke an in-progress atomic commit. Default lease: 120 seconds, trusted-host bounded override only. Process restart loses pending execution; no durable continuation or secure memory erasure is claimed.

No model substitution, no external caller-defined callbacks, no additional public tool. Unrequested interpretation keeps the ordinary one-shot route. The initial tests exercise actual World resolve, two IPC clients, pending-state invariance, invalid context and action reselection rejection, commit/history, and lease expiry. Acceptance is pending CI. The Phase65 relation decision route (explicit evidence conflict/support and revision rather than simple claim formation) remains distinct; no claim that all C7-C belief semantics are complete. Real configured retrieval-model execution and integrated-main regression remain outstanding.


## C7-C explicit subjective claim relations (candidate)

The canonical Phase65B relation writer accepts exactly `challenges` and `supersedes`; supporting evidence belongs to Phase65 claim formation, not a new unsupported claim relation type. The new shared relation context supplies a bounded view of the observer's own current-turn claims (max 8) and prior claims (max 16). Prior claim projection is subjective claim comparison, not attestation of episodic memory retrieval. Canonical event IDs, hashes, raw evidence and other observers are excluded; opaque context and claim tokens are scoped to the frozen turn, character and canonical source view. Explicit relation selection must use a current claim source, cannot target itself, and supersession requires a prior-turn target. Phase65B independently revalidates evidence-backed support, source/target lineage and event ordering, and Phase66 owns effective belief revision; no rewriting historical claims or declaring objective truth.

Native and Formal separately opt in with `request_subjective_claim_relation_interpretation: true` on the ordinary action response; no relation requested means no new explicit comparison. If staged consciousness is denied or fewer than two claims are available, no relation decision is manufactured. The existing parent-owned suspended execution returns `post_encoding_subjective_claim_relation` with only the current observer's claim comparison. The existing deliberation tool accepts `relation_context_token` and `relation_intents` only for that stage. Claim formation precedes relation comparison; both occur inside one canonical resolution and one final commit. Existing legacy resolvers remain supported on Native when the corresponding explicit opt-in is absent. Tests pair two Native/Formal actual World turns, one current and one prior subjective claim, token rejection, immutable prior history, same semantic relation and belief revisions; acceptance pending CI. Stacked on #118 corrected source-path checks, which preserve all previous same-snapshot requirements. C7-D integrated baseline and real retrieval model verification still pending.


## C7-A/C closure audit and actual public stage schema — 2026-11-25

#118 corrected CI 45573112622 passed all six executed jobs, including Phase62A transport and Phase81D-R1/E/J same-snapshot checks; merged `cf159cfce400b50077c3cc793282c673c159ccd1`. #119 CI 45573600101 passed all six executed jobs; affected log explicitly reports `C7 paired explicit Native/Formal claim relation pipeline: PASS`; merged `61ea280c6258e8f587beb88a2e735412257b467b`. No production backend or local seal is attested.

Exact source inspection at #119 merge found a separate public reachability defect: the internal experiential contract's responseField enumerates 11 distinct fields across 12 stages, but the MCP server's strict nested deliberation schema still advertised only the first four plus the new claim and relation DTOs. Phase80B/H, Phase81E/J/O, Phase82F and Phase89B had canonical validators and replay but no matching advertised public field. This candidate exports their bounded schemas from the existing stage contract, retains per-stage exclusive response admission, and adds an inventory check against the actual public tool list. The actual HTTP fixture also bootstraps two controlled appraisal turns, submits the observer's explicit Phase89B mood through the public tool, rejects a forged evidence ref, verifies same-snapshot reprepare, and commits once. It is not a model-quality test. CI acceptance pending.

Remaining verified source gaps / scope decisions (not yet implemented):
- `world-simulation-loop-service.mjs:5877–5997`: listener social interpretation and person-targeted social appraisal accept trusted resolver callbacks before final action candidates. These are distinct from the Phase89B persistent-mood stage; current Formal replay does not bind these specific callbacks. Need inspect the C4 durable social writer and the existing bounded DTOs before deciding the appropriate stage/replay order. Do not infer trust from speaker intent.
- `world-simulation-loop-service.mjs:11912–11938`: the existing Phase86A action-aware appraisal resolver accepts one observer-specific context after causal resolution, before commit. Formal action-only route does not expose this explicit choice. Prefer the same staged parent-owned continuation and canonical Phase86A projection rather than a synthetic mood.
- `world-simulation-loop-service.mjs:8150–8190`: C5 native subjective affordance proposal is explicitly enabled by native capability and can extend the candidate universe only with admitted same-character evidence. Formal has no matching proposal decision; this is a concrete action-authority gap, not a reason to expose the raw World or accept arbitrary action objects. Inspect C5 proposal authority and bind same-snapshot preparation before final action selection. No expansion to Body/world mechanics is implied.

C7-D must not be marked complete while these material gaps and actual private retrieval provider verification remain open. Keep C6 local seal outstanding; exact main integrated regression and local verification are distinct gates.

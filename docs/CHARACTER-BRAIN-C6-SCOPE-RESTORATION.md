# CB-C6 scope restoration — Character Brain sleep and foreground continuity

Status: **scope/acceptance rebaseline; C6-F is not sealed.**
Date: 2026-11-24. GitHub baseline: `0e9da73b6aa64697902edd861536bedb94354f64` (merged PR #83).
Authority source: `docs/CHARACTER-BRAIN-C6-SLEEP-OFFSCREEN-CONTRACT.md`, BR-18 and BR-21 in `docs/CHARACTER-BRAIN-C-LINE-BLUEPRINT-CONTRACT.md`.
This note does not supersede either contract or assert a runtime feature without evidence.

## Role and boundaries

**C6 is a Character Brain continuity integration gate**, not an unlimited World collision or combat solver. Sleep/arousal condition is an objective Body fact, committed by World; conscious cognition/subjective Goal/Plan/Memory remains Brain-owned; World owns simulation time, scheduler admission and causal persistence.

- **In scope:** a committed sleep/wake transition changes conscious C2 dispatch availability without deleting a pending concern, goal, plan or due cue; an actual admitted Brain invocation may decide what to think/choose; an unchanged cue has one stable opportunity identity across genuine wake; a consumed opportunity is suppressed; dormant cognition is never inferred from an elapsed clock.
- **In scope:** offscreen processing conserves the committed Body, goal, plan, memory and social evidence lineage. Returning to foreground reads actual chronology and does not fabricate unobserved conversations or autobiography. Paired full/limited observations must compare the same authoritative horizon.
- **Outside C6:** additional physics kernels (four-plus simultaneous damaging fields, generalized projectile/field solver, extra scene collision combinations, exact trajectory fidelity where no Brain continuity oracle requires it). These belong to **World/Body** engineering with their own tests/acceptance, and are not a proxy for neural cognition quality.
- **Independent future gates:** C7 Formal/Native semantic parity, C8 cross-day personality/relationship/belief/goal/action continuity, and platform deployment/local Nexa formal seals.

## Inspected baseline and gaps

| Gate | Verified source/behavior | Current boundary for acceptance |
| --- | --- | --- |
| C6-B | `world-simulation-body-authority-service.mjs` and `tests/cb-c6/cb-c6-sleep-arousal-reader.test.mjs`: committed sleep evidence is private and missing legacy condition remains unknown | Does not claim automatic physiological sleep |
| C6-C | `world-simulation-body-sleep-arousal-service.mjs`, `tests/cb-c6/cb-c6-sleep-arousal-transition-authority.test.mjs`: configured, guarded World/Body sleep-to-wake mutations and causal history | An intention or sound alone cannot assert waking |
| C6-D | `world-simulation-autonomous-cognition-scheduler-service.mjs` implements deferral and stable evidence identity; `world-simulation-loop-service.mjs` provides canonical Native scheduling and dispatch | **Next Brain-facing gate:** prove asleep defers actual Brain call, wake resumes the *same* pending opportunity, consumed evidence remains suppressed, no forged future `simulation_time`, no invented memories/goal writes |
| C6-E | `world-simulation-offscreen-event-batch-service.mjs` uses bounded World causal turns and physical breakpoints with atomic revision/hash history | Bounded supported physics is not equivalent to an offscreen independent-thinking policy or elapsed-time reconstruction |
| C6-F | `docs/CHARACTER-BRAIN-C6-F-CANDIDATE-EVIDENCE.md` records PR #47–#51 queued/physical/speech/reentry cases and explicit open limits | Need a positive **Brain decision continuation** after real foreground reentry, preserved observer-specific subjective provenance, and paired horizon proof; neither passive readback nor physical-only CI seals C6-F |

World/Body engineering through GitHub PR #79–#83 fixed field injury chronology, movement interruption and persistence. Its latest merge has a separately successful GitHub `main` run [#45293110941](https://github.com/day2561124-art/wRITE/actions/runs/45293110941). **No Character Brain memory/personality/decision service was edited by those PRs**. This is only a code-change classification, not an assertion that indirect integration behavior cannot change.

## Execution order restored

1. **C6-D canonical clock + sleep/wake Brain reentry**: block caller-controlled future due times, assert pending cue identity and actual bounded Brain dispatch on committed wake, no thought content from scheduler, no World write on read-only reentry, replay suppression. Do not replace the Brain with synthetic thoughts.
2. **C6-D continuity across cognition**: test already committed goals/plans plus genuine internal concerns, different observer accessibility, return to foreground and future C2/Goal/Plan decisions. Do not claim that controlled fixture Brain responses are general autonomous intelligence.
3. **C6-E/F paired reduced/foreground evidence**: compare committed causal and character-facing state at equal World time. If unsupported offscreen processes exist, return unresolved and preserve bytes, never fabricate missing narrative. Add positive cases only where a real authority exists.
4. **C6 gate audit**: explicitly list passed and missing positive/negative oracles, exact GitHub PR CI and postmerge `main` results. Mark C6-F sealed **only** with required formal/local validation and preserved original contract; no seal from green physics unit tests alone.

## Ownership and deployment

One `wRITE` GitHub repository is retained. World/Body changes keep their paths, history and regression coverage but are tracked outside the **Brain C-line functional acceptance numerator**. Do not cherry-pick, revert or rewrite PR #79–#83. Keep the user's offline Windows working tree and Nexa unmodified; a GitHub merge does not imply workstation sync or formal journal/transaction/checkpoint acceptance.

## Quiet-frontier cognition candidate (2026-11-24)

PR #84's exact-head CI and post-merge main regression passed. PR #85's exact-head CI proved paired queued foreground/offscreen wake reentry with memory/claim/belief lineage, goal adoption and plan commits; merged at `c784b8091c0c0834dd6e0542a1ee1cdeef526cd2`. These do not demonstrate independently reduced cognitive fidelity.

This candidate exposes `runWorldSimulationOffscreenCognitionStep` in the existing Native loop for an explicit host invocation at a committed quiet frontier. It uses the same C2 opportunity scheduler, conscious sleep admission, Brain callback and C3 authoritative goal/plan writers as foreground dispatch. It requires the expected World revision/hash, a valid committed simulation time and an explicit 0–32 opportunity budget. It refuses queued World events, pending sound events and active fields/projectiles rather than silently settling them. An oversized admitted batch is deferred in full to preserve the existing atomic cognitive transaction. No clock advancement, automatic physical work, synthetic thought, forced action, new memory writer or new scheduler is authorized. Read-only consumption still requires the caller's receipt; existing goal/plan commit history supplies durable consumption. This is a bounded explicit invocation, not an automatic background service, a full fidelity policy, or an assertion that the listed checks cover all potential World processes. Candidate acceptance requires actual CI; C6-F remains unsealed.


## Final gate inventory — 2026-11-24, PR #87 baseline

Reviewed original C6 contract and BR-18/21 at exact GitHub main
`82649fe7204d6586cf8548fd004200983866f208`. This inventory supersedes the
*open-gap status descriptions* in the older C6-F candidate evidence note, not
the source contract. The historical tests and commits remain intact.

| Gate | Remote evidence at this baseline | Remaining acceptance |
| --- | --- | --- |
| C6-A | Original source-grounded contract, CC8Y supported/deferred modality handoff described in that contract, scope restoration PR #84 | Formal exact-contract/local handoff receipts have not been independently verified in this round. |
| C6-B | Existing objective sleep reader and private provenance tests, included in prior World regression | No new physiological model required; local formal gate outstanding. |
| C6-C | Existing configured Body transition tests: accepted/denied transitions, authoritative history, independent injury/incapacitation | Do not expand configured transitions into general physiology. |
| C6-D | Existing D1/D2/D3 ingress tests plus #84 clock pin and wake bridge; #85 source-backed goal/plan reentry; #87 atomic abort/retry | Core bounded regression evidence accepted remotely; no claim of complete nonconscious neural simulation. |
| C6-E | Existing bounded event/breakpoint/horizon reports; supported physical-only and queued cases; #86 explicit quiet-frontier cognition step using existing C2/C3 | A real host/World scheduling-resolution transition remains unproved. The current explicit step is not an automatic background runner. |
| C6-F | #47/#49 paired wake and acoustic reentry; #85/#86 same-horizon subjective goal/plan continuation and offscreen execution; #87 interrupted cognitive write recovery | Need one positive paired resolution-switch lifecycle, with observer-specific social/memory evidence preserved through actual reentry. Formal exact-commit/local acceptance remains outstanding. |

### Current exact-commit remote receipts

- #84: [PR CI 45302455093](https://github.com/day2561124-art/wRITE/actions/runs/45302455093), [main 45305453017](https://github.com/day2561124-art/wRITE/actions/runs/45305453017), all required jobs successful.
- #85: [PR CI 45306037741](https://github.com/day2561124-art/wRITE/actions/runs/45306037741), [main 45308121113](https://github.com/day2561124-art/wRITE/actions/runs/45308121113), all required jobs successful.
- #86: [PR CI 45308386503](https://github.com/day2561124-art/wRITE/actions/runs/45308386503), [main 45312816386](https://github.com/day2561124-art/wRITE/actions/runs/45312816386), all required jobs successful; quiet-frontier goal/plan and independent awake/sleeping actor markers inspected in job logs.
- #87: [PR CI 45314977403](https://github.com/day2561124-art/wRITE/actions/runs/45314977403), all five required jobs successful. Affected job 138179520289 records the four explicit goal/plan incomplete/duplicate PASS markers; no consumed IDs on aborted speculative writes, unchanged durable bytes, one successful retry commit, durable replay suppression. [Main 45320992205](https://github.com/day2561124-art/wRITE/actions/runs/45320992205) **in progress at audit time**.

### Finite remaining engineering sequence

1. **Resolution selection and reentry:** inspect existing World/session scheduling
   authority and expose the smallest explicit, version-bound foreground/offscreen
   resolution selection. Reuse existing full canonical event turns, bounded
   physical progression and quiet-frontier cognition. Mode selection is an
   execution policy, not a new Body fact, memory store, or character knowledge.
   No wall-clock catch-up, arbitrary time jump, or blanket suppression of an
   awake actor. Preserve pending work and report the actual horizon.
2. **Paired positive lifecycle:** compare a foreground route and one route that
   actually selects limited execution, then returns to foreground. Use the same
   initial state, committed time horizon and source-backed internal concerns.
   Assert Body state, committed goal/plan identity, observer-specific memory
   and social evidence/relationship projection, opportunity receipts and
   subsequent admitted Brain decision. A genuine observation may create its
   ordinary memory; promotion alone may not. Reuse the existing CC8/C6
   source-aware communication path, not invented conversations or arbitrary
   relationship mutation. Existing acoustic parity proves emitted/heard
   evidence and unchanged prior relationship labels, not a new semantic or
   social inference. Existing goal/plan tests use controlled Brain responses,
   not independent policy-quality certification.
3. **Exact candidate gate:** complete affected and main regression, then verify
   the formal source/remote/local integration and CC8 handoff receipts. If the
   workstation/Nexa is unavailable, label the result remote-only and leave the
   formal seal open. Do not equate code merge with deployment or local sync.

This is a finite closure sequence for C6, not a mandate to implement every
possible slow process, physics combination, or consumer-specific host loop.
General World/Body expansion and consumer integration remain separately owned.
C7 Formal/Native parity and C8 cross-day continuity remain their own gates.
**C6-F is not sealed.**

# CC-7AA — Native Temporal Response Execution Architecture

Baseline: `68990e4bb33fdd7ddd49992540603d2c7896a8df`
Status: design gate for the next CC-7 native execution slices

## Observed boundary

The current turn prepares all character action selections, resolves the causal
outcome once, then projects released speech increments and observer decisions.
`runWorldSimulationTurnIncrementHandoff` explicitly runs after the consistency
gate. CC-7L can record `backchannel`, `request_floor`, silence, or withdrawal
as observer intention, while CC-7Z records only verified physical speech
overlap. Neither turns an observer's new intention into a selected World action
at its release time. A post-causal callback must never append a speech event to
the already-resolved action set.

Relevant paths:

- `server/src/world-simulation-loop-service.mjs`: selected actions, causal
  adjudication, consistency gate, observer handoff, atomic turn commit.
- `server/src/world-simulation-communication-speech-stream-service.mjs`:
  selected realized speech split into technical release increments.
- `server/src/world-simulation-communication-observer-increment-service.mjs`:
  acoustic admission per observer and release horizon.
- `server/src/world-simulation-observer-microtick-ledger-service.mjs` and
  `server/src/world-simulation-observer-tick-prefix-reconstruction-service.mjs`:
  bounded release ordering and World prefix reconstruction.
- `server/src/world-simulation-global-causal-timeline-service.mjs`:
  authoritative turn-relative clock and causal epochs.
- `server/src/world-simulation-communication-authorized-floor-claim-service.mjs`:
  authorization is consumed only by actual selected emitted speech.

## Required execution seam

A World-owned temporal scheduler must resume at the next already-authorized
causal release, before committing the remainder of the turn. It passes one
observer's actually admitted cue and World prefix projection to that
character's Brain. The Brain may revise its own preparation, remain silent,
or propose an action. Only a fresh Character Brain selection followed by a
fresh World causal epoch can produce a public signal. The scheduler then
orders the new signal alongside existing streams and rechecks the next
release. A prior hypothetical future stream is never exposed as a present
perception.

The transport needs an explicit ephemeral `prepared_epoch` identity containing
session, turn, World state revision/hash, causal epoch hash, release cursor,
per-observer admitted cue identity, and any still-valid selected action
commitment. Every response binds to that identity. A changed World prefix,
canceled source action, duplicate observer response, reused response handle,
or stale epoch invalidates the response. The server decides the next clock
step; the character does not supply timestamps or future World state.

The existing one-shot formal transport and atomic World turn commit must stay
authoritative. A bounded temporal execution may produce many internal epochs,
but only one final coherent turn result is committed. Failure before commit
discards the speculative epochs. An interruption or movement that invalidates
a scheduled later speech increment must also invalidate that increment's
observer admission and all dependent speculative decisions; no final history
may retain a cue from a canceled source.

## Distinct action paths

| Path | Character authority | World evidence | Floor meaning |
| --- | --- | --- | --- |
| Wait or silence | Choose no action | No public signal | None |
| Backchannel | Choose a short response or other modality after an admitted cue | Selected action, emitted signal, timed source lineage | Does not claim the floor |
| Floor request | Choose to seek a turn | Observer intention; later speaker selection and physical emission | Request alone is not ownership |
| Co-completion | Choose a continuation from an own interpreted prefix | Public signal with source cue and temporal lineage | Requires separate recipient and speaker interpretation |
| Interruption | Choose to act while another signal is active | Overlap and effect on the ongoing source are separate observations | Cannot be inferred from overlap alone |

A response token does not prove comprehension, agreement, grounding, or a
completed speaker turn. Backchannel realization must use the shared Chinese
repertoire or another explicit modality contract; never map personality
directly to a canned token.

## Minimum safe implementation sequence

1. **Epoch read and replay gate:** expose a read-only, observer-scoped
   `prepared_epoch` with only currently released cues. Demonstrate stable
   replay, future withholding, and stale response rejection. No new World
   action yet.
2. **Action proposal boundary:** allow that observer's Brain to propose a
   same-character candidate from a fresh prefix input; validate its original
   semantic/provenance and privacy gates. Silence remains legal.
3. **Causal insertion:** re-run the authoritative World causal resolution on
   the new action set/epoch. Invalidate future increments from canceled or
   changed sources and recompute release ordering. Prove that a backchannel
   signal comes from a selected action without floor award.
4. **Temporal interaction:** admit response preparation revisions,
   co-completion, and interruption evidence. Keep physical overlap separate
   from speaker intent and each listener's subjective interpretation.
5. **Formal transport adoption:** server-issued one-use response handles and
   one final atomic turn commit; restart and lost-response recovery preserve
   exactly-once behavior.

A technical cap on epochs/queued releases is an execution safety budget,
never a psychological rule for yielding the floor. Wall-clock gaps or a
fixed 200 ms threshold must not select a speaker.

## CC-7AE staged response-preparation evidence (implementation status)

The first CC-7AE slice reuses the existing CC-7AB one-use
`wait` / `revise_preparation` receipt and verified next-release gate.
`world-simulation-native-response-preparation-service.mjs` records a
bounded engine-private audit across successive actual releases for ONE
observer. The previous private epoch is passed only to the next World-owned
step; only cue-free ticks may be skipped. Public signal emission,
Character Brain action selection, World mutation, and long-term memory
writes are all **absent** from this slice. Its audit intentionally contains
no current/future speech surface, cognition, or World snapshot. A technical
32-epoch receipt budget remains an execution guard, not a psychological
turn-taking threshold.

CC-7AE slice 2 adds **opt-in native World turn adoption** via
`characterNativeTemporalResponsePreparationResolver`, which requires the
paired input/selection resolvers from CC-7AD. The World iterates actual
admitted releases for one observer, consumes private CC-7AB wait/revision
receipts, and prepares a fresh later epoch using the previous consumed
private epoch. Only `select_response` opens the existing canonical
Character Brain proposal and World causal replay; the Character Brain's
action-selection resolver is called just once at that later release.
Without this opt-in, the sealed first-cue CC-7AD behavior remains unchanged.

The replay preserves all previously released source events including the
chosen release time and all strictly **earlier** completed World mutation
batches. At the chosen same-timestamp release, the atomic batch may be
re-coalesced because the new response begins then; this does not authorize
changing the earlier source acoustic admission or any prior World mutation.
Existing Phase74D pre-cue `reject_all` and later emitted response evidence
remain distinct, and the ordinary World consistency gate/atomic commit are
still authoritative. Tests exercise the actual wait-then-later-response
commit and verify one later input/selection, no future/private content in
the World history, and the original rejected pre-cue choice.

CC-7AE slice 3 persists ONLY a compact, hash-linked preparation audit
chain when an actual later response is selected and emitted in the same
atomic World commit. A bounded chain tracks `wait` / `revise_preparation`
at different admitted release cursors, ties its final hash to the later
choice evidence and source pre-turn World hash, and verifies both count and
causal-release order against the emitted speech. The full private epoch,
unreleased speech, hidden cognition, and the speculative Brain inputs
are NOT saved. The absence of a later response means there is no
fabricated committed preparation-as-speech evidence; all-wait World turns
still commit without B's signal or a synthetic post-cue selection receipt.

CC-7AF adds a separate, opt-in, **refusal-only** causal epoch challenge:
World re-adjudicates the old source against a revised action-set challenge
before fresh response input and after tentative action selection. If the
source epoch changes, old private preparation/choice cannot be committed;
no historical sound is erased. The challenge never authorizes a replacement
character action, nor is it automatically evidence of a real source change.
See `docs/CHARACTER-COMMUNICATION-CAUSAL-EPOCH-INVALIDATION.md`.

CC-7AF also allows actual **precommit source reconsideration** when
explicitly enabled. Only the same speaker's fresh Character Brain choice
from its broker-prepared candidate catalog may replace the first tentative
source. The canonical World re-adjudicates both selections before committing
the final Phase74D receipt and CC-7AD replay; the old speech is never emitted
or represented as a durable original Phase74D choice. B can respond only to
the replacement's newly admitted acoustic increment. This is NOT retroactive
retraction of an already committed earlier sound.

CC-7AF further provides the opt-in
`characterNativeCommittedSourceDependency` for a NEW World turn:
before speculative preparation and Character Brain ingress, the engine
checks the exact prior committed speech/observer admission against
append-only World history and current revision/hash. This check does
NOT present past hearing as a fresh cue or grant B a response; the new
turn still needs its own released acoustic increment and same-character
Brain selection. The previous source's physical emissions remain
immutable; stale/forged dependencies are refused before Brain ingress.
See `docs/CHARACTER-COMMUNICATION-CAUSAL-EPOCH-INVALIDATION.md`.

This opt-in stage does NOT yet implement automatic new-epoch re-planning
after an already committed source, multiple successive World causal epochs
with a complete cancellation or interruption lifecycle, nor does it make
a fixed gap threshold a behavioral decision. Those require separate later
acceptance evidence.

Research basis: Levinson and Torreira (2015),
https://doi.org/10.3389/fpsyg.2015.00731, on response preparation during
continued comprehension; Goodwin (1986),
https://doi.org/10.1007/BF00148127, on different sequential treatments
of continuers and assessments. These motivate separate preparation and
public-response decisions; neither supplies an automatic timing threshold.

## Stage gates

The first read-only epoch slice must show that B hears only a released
prefix of A's speech: no future fragment, speaker hidden intention, or
another observer's interpretation enters B. Replay is stable; a stale
response identity is rejected. Existing CC-6 and CC-7Y/7Z routed suites
continue to pass.

Before enabling actual response actions, the later slices must show:

- B can wait or revise a prepared response without an emitted signal.
- B's actual backchannel requires B's subsequent fresh selection and a
  matching World emission; it leaves A's floor claim unchanged.
- A later canceled source invalidates its future cues and dependent decisions
  before commit.
- Two emitted intervals may overlap without any interruption finding.
- A failed epoch, stale handle, or consistency conflict commits no speculative
  World change, memory, grounding, or relationship effect.

## Research basis

The local allocation rules and distinction between next-speaker selection
and self-selection follow Sacks, Schegloff, and Jefferson (1974),
https://doi.org/10.2307/412243. Response preparation before a turn ends and
the caution against a rigid gap threshold are supported by Levinson and
Torreira (2015), https://doi.org/10.3389/fpsyg.2015.00731. The distinction
between continuers and assessments in mid-turn recipient actions follows
Goodwin (1986), https://doi.org/10.1007/BF00148127. These sources inform
the contracts; they do not set fixed psychological timing constants.

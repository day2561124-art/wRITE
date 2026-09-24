# CC-7AF — Causal Epoch Supersession and Dependent Response Invalidation

Status: research + bounded engineering contract (NOT implemented/accepted)
Baseline: `a3b59f00b6512d3b617ead3b73477d418a825e6c` (sealed CC-7AE)

## Why this phase exists

CC-7AE proves that ONE observer may wait, revise a private preparation, and
select speech only after a later verified sound release. It does **not** prove
what happens if a subsequent World causal re-adjudication changes/cancels the
source whose earlier cues supported that preparation. A listener's old
`prepared_epoch.epoch_id`, private consumed receipt, response proposal or
World schedule MUST NOT become an authorization for a later action against a
different source execution merely because the text or clock time resembles
the old one.

This phase does not invent a new World loop, Character Brain, or Memory store.
It reuses `world-simulation-observer-prepared-epoch-service.mjs` (one-use
`epoch_id`, `causal_epoch_hash`, `ledger_hash`, `source_prefix_hash`),
`world-simulation-native-temporal-schedule-service.mjs` (exact source action,
stream, observer acoustic audit), and Phase62K/CC-7G canonical replay from
the original pre-turn state.

## Distinct identities, decisions and irreversible physical facts

- **Physical emission:** once an increment has actually been committed at
  time T, a later replan cannot erase an observer's historical hearing.
  Correction is a new later public signal or other actual World event.
- **Unreleased future:** if the canonical source action, stream, admissible
  increment or causal execution is superseded, the engine drops any planned
  later release that has not been committed. Never project the old
  `future_release` as current perception or claim it was heard.
- **Dependent private state:** a `wait`/`revise_preparation` chain, pending
  response proposal and schedule cite their original observer epoch. On
  source supersession, they are stale: do not carry their receipts to a
  replacement epoch or silently reuse the old Character Brain selection.
- **Fresh later choice:** only a newly admitted increment and fresh
  same-character Brain input may create a new proposal. New World causal
  resolution, consistency and one atomic commit are still mandatory.
- **Interpretation:** simultaneous speech proves only physical overlap;
  interruption, floor loss, understanding and grounding require distinct
  evidence and are not inferred from the clock alone.

## Source-authenticity gate (first implementation slice)

Inputs are ENGINE-only exact original pre-turn state and canonical World
action sets/revisions. Recompute both initial and proposed causal executions
with the existing programmatic adjudicator, rather than trusting a
caller-authored `source_cancelled:true` flag. Derive both observer acoustic
ledgers from those verified executions, and compare source action/stream,
increment identity, release time, and admitted-observer reference. A
previous `epoch_id` is valid in a later calculation only if the complete
causal epoch/ledger/observer-prefix binding still matches. A payload with a
forged hash or mismatched original World snapshot is refused before
invalidation claims may be used.

The first slice is a **dry-run invalidation assessment**, not a World
commit, turn-taking arbiter, or public signal. It cannot retroactively
erase an emitted source; it reports what future dependent work must be
replanned.

## CC-7AF slice 2 — optional native refusal fence

A separate, explicitly opt-in World-only resolver
`characterNativeTemporalResponseCausalRevalidationResolver` requires the
existing native Brain input/selection pair. The World calls it at two
boundaries: (1) after finding an actually admitted current observer epoch,
BEFORE obtaining new same-character Brain input; (2) after a tentative
selected response is scheduled but BEFORE the original-state causal replay
and the later atomic World commit. The resolver may provide an engine-only
**revised-action challenge** bound to the exact source epoch; it is NOT a
replacement Character Brain selection or a trusted source-cancellation
command. The canonical adjudicator independently reruns original and
challenged action sets from the verified pre-turn snapshot. Changed
execution/ledger/source, stale epoch identity, or malformed challenge
refuses the speculative response; the old preparation/choice/schedule
cannot authorize emission. This mode cannot silently adopt another
character's revised action, reset Phase74D, or remove a historical sound.

Full native World tests assert that source cancellation at either fence
leaves World revision/state hash/history unchanged. They separately check
that a first-fence cancellation never obtains fresh Brain input, and a
second-fence cancellation invalidates the single tentative choice.
Unchanged challenges may proceed through the existing canonical World
replay and commit path. Because this is refusal-only, **automatic fresh
replanning after cancellation is not implemented**; later work must obtain
an actually new released cue and new character action authority before
continuing. A caller-provided challenge is not evidence that the real
World's source has changed, nor permission to rewrite earlier selected
public actions. Both claims require separate authoritative evidence.

## CC-7AF slice 3 — provisional replacement-source reentry proof

`world-simulation-native-source-reentry-service.mjs` is an **engine-private
dry run**, NOT a second native World loop or a source mutation tool.
Both pre-revision and post-revision A/B action sets must match their own
complete decision packets, exact selected candidates, and recomputed
Phase74D receipt bundles against the SAME verified original pre-turn
World state. A changed source is accepted for this proof only when the
original A release is ABSENT from the revised canonical acoustic
admissions; a different sentence with the same clock time is not the
same source. B must retain a distinct pre-cue `reject_all` receipt in
BOTH decision stages.

The revised branch then uses the existing CC-7AD replay on its OWN
canonical World observer ledger: old private epochs, consumed receipts
and speculative Character Brain packet are not accepted as input.
A fresh B input and new B response selection are required for the new
source. Tests compare the two resulting epoch identities and reject
wrong/forged Phase74D bundles, stale World state hash, switched
candidate bodies and unchanged source before B's input runs. The
returned audit contains only hashes and source/response references;
the full revised causal resolution remains ENGINE PRIVATE.

**Authority boundary:** this helper proves consistency of a
*proposed, separately deliberated* source replacement. It DOES NOT
prove the caller was authorized to revise a committed source,
does not persist or replace the original Phase74D receipt, and does not
commit either the original or replacement branch. The real broker,
World state revision, chronological mutation executor and atomic commit
must independently authorize the revised stage before adopting it.
Already committed earlier sound cannot be retroactively replaced.
Unreleased future increments and dependency invalidation still need
live scheduler/restart evidence. There is no automatic cross-turn
cancellation/replanning or interruption judgement in this slice.

## CC-7AF slice 4 — actual Character Brain precommit source reconsideration

The native `runWorldSimulationTurn` opt-in
`characterNativePrecommitSourceReconsiderationCharacter` works only for
a named speaker already present in the *broker-prepared decision packets*,
alongside a separate named listener and the CC-7AD paired Brain resolvers.
The same source Character Brain is invoked **twice** via the existing
serialized Character Runtime. Both invocations receive the original
single-source projected Brain packet; the second selection MUST match
that speaker's exact broker candidate catalog. Neither the caller nor
the World can create a new speech candidate or force the second choice.
The initial source action is speculative and never emitted, persisted,
or recorded as a durable Phase74D choice.

Before the ordinary World native replay runs, the engine re-adjudicates
the original and revised action sets against the same verified World
snapshot, then admits the final choice only if the former acoustic
source no longer exists in the revised causal execution. A second
identical choice, absent/different character, unchanged source,
non-speech replacement action or stale World revision is rejected.
The final speaker choice alone travels into the established Phase74D
receipt, CC-7AD native observer replay, World consistency checks and
atomic turn commit. In the replacement-speech case B obtains ONE new
observer cue and selects ONE fresh response. In the reject-all case
no source acoustic cue exists and B cannot invent one. Neither branch
uses an old B epoch, speculative proposal or private preparation.

Full World tests verify first-speech/second-reject silent commit,
same-choice fail-closed without history, and a different
*broker-prepared* speech candidate whose final Phase74D receipt,
physical source release, and B's emitted response are coherent;
the old speculative A speech is absent from committed outcomes and
acoustic timeline.

This does **not** remove sound that was committed in an earlier turn,
derive new proposals beyond the broker catalog, automatically react to
an in-turn collision/interruption, or establish a cross-turn
source-cancellation scheduler. It does not persist an extra
"tentative Phase74D" receipt. Those require separate lifecycle
evidence and cannot be inferred from this opt-in.



## CC-7AF cross-turn commit-boundary audit (next acceptance gate)

The repository's authoritative `commitWorldSimulationTurn` commits ONE
complete World turn with expected state revision/hash compare-and-swap,
an append-only history turn, and a duplicate-turn check inside the
existing file transaction. The canonical acoustic microtick ledger is
engine-private reconstruction **within that completed turn**; it is not
an independently durable microtick transaction. Consequently the
phrase "committed first sound but cancel unreleased later fragments of
the same turn" must NOT be claimed under the CURRENT architecture:
after a full turn commit, all of that turn's emitted increments belong
to its immutable causal history. A later re-adjudication of the old
pre-turn snapshot is counterfactual only; it is not authority to modify
the committed source, observer admission, Phase74D receipt, or
already-realized tail of that stream.

This is different from a **still-uncommitted later dependency**. Such a
dependency can be rejected before its own World turn commits when its
cited prior-turn source/reference or current World revision/hash is
stale. A new correction, renewed source utterance, or listener
response must be scheduled as a NEW event/turn with its own broker
preparation, newly admitted observation, same-character Brain choice,
canonical causal resolution, and atomic commit. It may incorporate
earlier committed hearing as historical evidence, but must never
pretend that hearing was retroactively unheard.

Engineering acceptance therefore separates:

1. **Committed-source guard:** derive source identity and acoustic
   observer admission from authoritative append-only World history,
   bind pending dependency to that committed turn/hash, and reject a
   wrong turn, fabricated release, mismatched observer, or attempt to
   rewrite its Phase74D/physical outcome. This guard is read-only; its
   output does not cancel a committed source.
2. **Uncommitted-dependency guard:** reject a speculative future action
   if the World CAS revision/hash or cited source/dependency lineage
   no longer matches, with no new public signal or stale Brain choice.
3. **New-turn reentry:** obtain a newly valid event and actual newly
   released cue; no reuse of the prior observer epoch or one-use
   receipt. Distinguish physical overlap evidence from an explicit
   listener/speaker interpretation of interruption.
4. **Recovery:** continue using existing Journal/transaction/atomic
   duplicate-turn protections. No new persistent scheduler or memory
   repository may be introduced merely to represent this boundary.

The first four CC-7AF slices do NOT establish these cross-turn
acceptance results. Slice 4 instead proves legitimate **precommit**
source reconsideration where the first speech never entered World
history. Future work must inspect and test the real history shape,
the current queued-event model, and the atomic state transition
rather than assuming per-microtick durable acknowledgements.

## Acceptance and adversarial matrix

| Case | Required evidence/result |
| --- | --- |
| Exact replay of unchanged source | No spurious supersession; current one-use receipts remain bound. |
| Source action rejected before its future increment | No phantom future cue, and dependent preparation/choice/schedule invalidated. |
| Source replaced with same content or timestamp | Identity and causal execution, not text/time equivalence, determine freshness. |
| Actual earlier committed increment | Historical World/observer receipt remains immutable; only later unreleased work can be canceled. |
| Revised World mutation before a planned later response | Old prefix hash fails; fresh re-adjudication required. |
| Two actual overlapping emitted speech intervals | Overlap may be recorded; no automatic interruption, floor or grounding claim. |
| Forged ledger/revision/source hash, wrong observer | Refuse without Brain call, public signal or World mutation. |
| No fresh admitted cue after supersession | Preserve silence and no fabricated Phase74D or memory evidence. |
| Crash/lost-response/restart around final commit | Existing Journal/transaction/atomic commit owns exactly-once recovery; no parallel write channel. |

Scope boundary: a full cross-turn, multi-agent, multi-causal-epoch
interruption/recovery lifecycle is NOT established by this design. It
requires its own formal tests before being claimed complete.

## Research used for engineering separation

- Schlangen & Skantze (2011), *A General, Abstract Model of Incremental
  Dialogue Processing* — incremental module topology, packaging and
  dependencies: https://aclanthology.org/2011.dnd-2.11/
- Baumann, Buß & Schlangen (2011), *Evaluation and Optimisation of
  Incremental Processors* — partial input may later be revised:
  https://aclanthology.org/2011.dnd-2.10/
- Schegloff (2000), *Overlapping talk and the organization of turn-taking
  for conversation* — overlap and participant treatment cannot be collapsed
  into a single interruption flag:
  https://doi.org/10.1017/S0047404500001019

These references inform the separation of tentative private state and
committed physical signals; they do not supply a numerical response-gap
threshold or assert that every acoustic overlap is an interruption.

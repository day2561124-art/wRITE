# Phase 65C — Committed Subjective Cognition Read Projection

## Purpose

Phase65C closes the first practical cognition loop between already committed subjective claims and later character action reasoning.

The phase does **not** install a truth resolver, probability model, persistent belief database, or last-write-wins belief state. It adds one bounded, read-only projection from the character's own committed prior-turn subjective claim history into later cognition.

The projection is consumed by:

1. the action proposer, so subjective understanding can affect which candidate actions are considered; and
2. the final Character Brain ingress, so the Character Brain can choose among those candidates using the same bounded subjective context.

## Research references and adopted principles

### AGM belief revision

The AGM tradition treats revision as a constrained change to an existing belief set rather than an unconditional overwrite by the newest assertion. Phase65C adopts only the conservative architectural lesson needed here: **preserve prior committed claims and explicit conflict relations instead of silently replacing history**.

Phase65C intentionally does not implement AGM contraction/revision operators. That belongs to a later belief-resolution phase.

### BDI practical reasoning

BDI architectures distinguish beliefs from desires/intentions while allowing beliefs to inform practical reasoning. Phase65C follows that separation by supplying a bounded subjective read model before action proposal and final action choice, while keeping causal outcome authority in the World Engine.

### CoALA and modern agent memory architectures

CoALA separates memory components and action space instead of treating all stored information as one undifferentiated prompt. Phase65C similarly exposes only a purpose-built subjective cognition projection rather than the full persistent memory or world state.

### Generative Agents

Generative Agents use a memory stream plus retrieval/reflection mechanisms to synthesize context for later planning. Phase65C adopts the bounded-context pattern, but it does not synthesize new beliefs or summaries during projection. Only canonical committed Phase65A/65B material is read.

### MemGPT / Letta

MemGPT and its Letta lineage emphasize tiered/context-managed agent memory rather than injecting all durable state into every turn. Phase65C follows the same engineering principle: durable claim history remains engine-side; a bounded character-facing projection is produced for the current reasoning context.

### ACT-R / retrieval-strength distinction

Cognitive architectures may use activation or retrieval strength to model accessibility. Phase65C explicitly keeps accessibility separate from epistemic authority: retrieval frequency, accessibility strength, and plasticity strength are **not** treated as credibility or truth support.

## Source and timing contract

The source is the authoritative world snapshot read at the beginning of `prepareWorldSimulationTurn`.

For character `C` and current turn `T`, Phase65C may project only:

- Phase65A subjective claims belonging to `C`;
- whose `source_turn_id` is not `T`;
- referenced by canonical append-only claim history;
- plus Phase65B claim relations belonging to `C`;
- whose source turn is not `T`;
- and whose source and target claims are both inside the selected bounded claim projection.

Because Phase65A claim formation and Phase65B relation formation occur later inside `resolveWorldSimulationTurn`, after Character Brain has already acted, the timing gives a structural same-turn feedback barrier:

```text
committed world snapshot
  -> Phase65C read projection
  -> cognition
  -> action proposer
  -> Character Brain
  -> causal adjudication
  -> subjective memory formation
  -> Phase65A new claims
  -> Phase65B new relations
  -> world commit
```

A claim created in turn `T` cannot be read by Phase65C until a later turn.

## Character-facing shape

The projection exposes semantic content only:

```text
subjective_cognition:
  source: committed_prior_turn_subjective_claim_history
  claims:
    - proposition: <character's subjective proposition>
      subjective_not_world_truth: true
  relations:
    - relation: challenges | supersedes
      source_proposition: <subjective proposition>
      target_proposition: <subjective proposition>
      candidate_relation_only: true
      truth_resolution_applied: false
  unresolved_competing_claims_present: <boolean>
  claims_truncated: <boolean>
  relations_truncated: <boolean>
```

It does not expose:

- claim event IDs or hashes;
- relation event IDs or hashes;
- source memory IDs or hashes;
- internal memory provenance;
- world state or raw world events;
- engine turn/session identity;
- retrieval history;
- confidence or probability numbers;
- world-truth verification;
- mutation authority.

## Boundedness

The v1 engineering bounds are:

- maximum projected claims: 16;
- maximum projected relations: 32.

When history exceeds a bound, the projection keeps the newest canonical history entries within that bound and exposes truncation flags. The bounds are context-engineering limits, not cognitive truth weights.

## Conflict semantics

Phase65B `challenges` and `supersedes` relations remain **candidate subjective relations**.

Phase65C does not:

- invalidate the target claim;
- delete or rewrite old claims;
- make `supersedes` equivalent to truth;
- choose a winner between competing claims;
- infer confidence from recency;
- infer credibility from retrieval frequency;
- infer truth from accessibility or plasticity strength.

If competing claims are present, they remain visible as unresolved competing material.

## Integrity

Before projection, Phase65C independently verifies:

- canonical claim-history references;
- immutable Phase65A claim event hashes;
- canonical relation-history references;
- immutable Phase65B relation event hashes;
- relation source/target claim hash pinning;
- same-character relation ownership.

The projector is read-only and must not mutate claim history, relation history, memories, or world state.

## Non-goals

The following are explicitly deferred:

- full belief-state consolidation;
- AGM-style contraction/revision operators;
- belief adoption/retraction state;
- source reliability models;
- confidence/probability calibration;
- semantic graph traversal;
- persistent Character Mind database;
- automatic truth resolution;
- same-turn belief feedback.

A later Phase65D/Phase66 may introduce explicit belief-resolution semantics after separate research and acceptance criteria.

## Acceptance focus

Phase65C tests must demonstrate:

1. same-character isolation;
2. committed-prior-turn-only exposure;
3. structural same-turn feedback exclusion;
4. bounded claims and relations;
5. immutable hash/reference verification;
6. no evidence/engine-ID leakage;
7. no confidence/probability/world-truth authority;
8. unresolved competing claims remain represented;
9. the projection is present before action proposal;
10. the same bounded projection survives final Character Brain ingress;
11. Phase65A/65B production mutation semantics remain unchanged.

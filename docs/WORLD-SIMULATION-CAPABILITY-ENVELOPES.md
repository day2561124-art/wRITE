# Phase62A-R1 — Least-Privilege Capability Envelopes

## Scope

Step 1 installs the policy registry, envelope compiler, source-ref materialization primitives, neural-extension validator, and tests for least-privilege world-simulation capabilities.

This step **does not yet change the runtime behavior of the seven Phase62A capabilities**. Runtime adoption is intentionally deferred to later R1 steps.

## Core rule

> Neural models may interpret authorized information. Neural models do not decide what information they were authorized to receive.

The trusted programmatic system prepares a bounded capability view before any optional neural adapter can see it.

## Disclosure is not authority

A value may be readable by an adapter without becoming writable by that adapter.

Examples:

- recovered memory content may be readable by character cognition;
- the adapter cannot rewrite the recovered memory and return the rewrite as authoritative retrieval;
- programmatic hard consistency findings may be readable by an advisory critic;
- the critic cannot reduce `hard_conflict_count` or delete a hard finding.

## Claim domain and assurance origin

Step 1 deliberately avoids one universal trust/confidentiality score.

`claim_domain` describes what kind of claim a record represents, such as:

- `world_state`
- `perception`
- `character_subjective_state`
- `memory_recovery`
- `action_candidate`
- `diagnostic`

`assurance_origin` describes where the record's authority came from:

- `engine_persisted`
- `programmatic_derived`
- `caller_asserted`
- `neural_derived`

A programmatically verified subjective memory recovery is not thereby objective world truth.

## Native vs direct assurance

Native engine execution and direct compatibility calls are distinct assurance modes:

- `native_engine_verified`
- `direct_caller_asserted`

A direct caller cannot promote a supplied record into engine verification by labeling it `programmatic_derived`; the effective assurance is downgraded to `caller_asserted`.

The capability payload itself may not self-declare its assurance mode.

## AdapterEnvelope vs TrustedMaterializationContext

The compiler returns two different objects.

### AdapterEnvelope

Safe to pass to an optional neural adapter. It contains:

- capability identity and purpose;
- explicit character subject when required;
- intended downstream audience;
- protected base values that the adapter may read but not rewrite;
- authorized source content under invocation-scoped opaque refs;
- the allowed neural-extension schema.

Character-facing envelopes reject raw world state, raw scene state, full character state, exact engine simulation time, and internal scene IDs.

### TrustedMaterializationContext

Engine-only. It contains:

- authoritative ref-to-source mappings;
- full provenance manifest;
- effective assurance evidence;
- the protected base copy;
- envelope identity/hash binding.

The provenance manifest is intentionally not exposed to the neural adapter.

## Invocation-scoped refs

Neural adapters never materialize authoritative source content by authoring it themselves.

They may select opaque refs supplied in the current envelope. The trusted materializer then resolves those refs against the engine-only source catalog.

Unknown refs fail closed. Refs from another character, turn, or envelope fail closed.

## Neural extension rules

A neural extension:

- may use only fields registered for that capability;
- may not override protected result fields;
- may not author audience, assurance, provenance, trust-domain, or policy metadata;
- may not expand its audience;
- may not raise its assurance;
- is always treated as `neural_derived`.

For an optional native helper, an invalid extension can be discarded while the trusted base survives. For an explicitly requested direct adapter, invalid output throws.

## Capability roles in Step 1

| Capability | Trust domain | Step 1 adapter pattern |
| --- | --- | --- |
| `world_scene_causal_analyzer` | engine-facing | protected base + advisory extension |
| `world_perception_filter` | character-facing | authorized observation refs + annotations |
| `world_memory_retriever` | character-facing compatibility | source-ref selection |
| `world_character_cognition` | character-facing | protected base + subjective extension |
| `world_action_proposer` | character-facing | protected action catalog + ref ordering |
| `world_agency_guard` | diagnostic | programmatic findings + advisory extension |
| `world_consistency_critic` | engine-facing diagnostic | programmatic hard findings + advisory extension |

## Important non-claims

Step 1 does not claim to:

- sandbox arbitrary malicious JavaScript adapters;
- prevent a malicious stateful adapter from remembering data across invocations;
- implement process-level or per-character model isolation;
- prevent neural hallucination;
- implement subjective source monitoring or source confusion;
- implement the future attempt-affordance action engine.

## Runtime adoption

Step 1 is contract-only. Existing Phase62A/62B/62C runtime paths remain unchanged until later R1 adoption steps.


## Step 2 — Character-facing runtime adoption

Step 2 moves the Step 1 envelope contract into the live character-facing capability path. The trusted deterministic builder now executes before any optional neural adapter for perception, legacy memory projection, character cognition, and action proposal. The neural adapter receives only an AdapterEnvelope and returns an extension; it no longer authors the full trusted capability result.

Native world-loop calls use `native_engine_verified`; direct/session compatibility calls use `direct_caller_asserted`. Capability payloads cannot self-promote assurance. Invalid optional native neural extensions are discarded while the trusted base survives; explicitly requested direct adapters fail closed.

### Character views

Perception and cognition now expose dedicated character views. Exact engine `simulation_time`, internal `scene_id`, capability contracts, R1 runtime metadata, raw scene state, and full character state are not forwarded into the Character Brain packet. A character can know time or location only through subjective evidence such as a visible clock, an announcement, memory, or other authorized cognition.

### Memory terminology

Legacy `world_memory_retriever` output is `memory_projection`, not `memory_recovery`. Actual recovery remains owned by Phase63C. Neural selection/order in the compatibility projector cannot change Phase63B candidates, Phase63C recovered memories, or retrieval history.

### Action authority

Neural action consideration may rank or deprioritize refs from the trusted candidate catalog. It does not add candidates, delete candidates, choose the final action, or decide outcomes. The complete trusted `candidate_action_intents` set remains available to the Character Brain until the future attempt-affordance phase replaces the static catalog.


## Step 3 — Engine-facing integrity sealing

Step 3 completes R1 runtime adoption for `world_scene_causal_analyzer`, `world_agency_guard`, and `world_consistency_critic`. All seven world capabilities now execute their trusted deterministic builder before any optional neural adapter. Neural adapters receive detached AdapterEnvelope copies and return extension-only output.

### Authority separation

- Scene analysis remains a trusted normalized helper. Neural scene interpretation is advisory and is never forwarded into causal adjudication.
- Programmatic consistency findings and `hard_conflict_count` exclusively control the commit gate. Neural consistency advisory can neither unblock a hard conflict nor create a hard block.
- Phase62B remains the hard narrative-control input boundary. `world_agency_guard` is diagnostic; neural agency advisory is not security policy.

### Reference-monitor hardening

Every actual world-simulation neural invocation must pass through a compiler-attested canonical R1 envelope. Shared Neural Core rejects raw world neural calls. Canonical envelope hashes are recomputed before validation/materialization, capability binding is checked, and the adapter receives a detached clone rather than the engine-owned canonical object.

Neural advisory uses a sealed non-authoritative vocabulary. Authority-like fields such as `must_fix`, `hard_conflict_count`, `commit_allowed`, `winner`, outcome fields, selected-action fields, and mutation fields are rejected recursively inside advisory output.

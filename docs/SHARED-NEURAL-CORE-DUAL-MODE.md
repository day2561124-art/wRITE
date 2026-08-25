# Shared Neural Core Dual Mode — Phase62B

## Purpose

Phase62B turns the Phase62A writing/world split into one shared neural execution core with two hard session modes:

- `writing`
- `world_simulation`

The public entries stay separate. The writing route keeps the existing seven-module writing registry and contracts. The world route keeps the Phase62A world capability surface. The shared core owns mode validation, capability-family routing, and cross-mode rejection.

## Entry and lineage lock

`chatgpt_bridge_begin_external_brain_writing_session` creates an agent run with:

- `task_type = draft_generation`
- `mode = chatgpt_owned_external_brain`
- `session_mode = writing`

`chatgpt_bridge_begin_world_simulation_session` creates an agent run with:

- `task_type = world_simulation`
- `mode = chatgpt_owned_world_simulation`
- `session_mode = world_simulation`

`session_mode` is immutable after run creation. A writing session cannot call world capabilities, and a world session cannot call writing capabilities. Legacy persisted sessions without the explicit field can still be inferred from their pre-existing `task_type + mode` pair, so Phase62B does not invalidate prior Phase62A/External-Brain runs.

## Shared capability families

The shared core does not claim that the existing wrappers are seven separately trained neural networks. It is an execution/router contract over the existing neural-module wrappers, adapters, deterministic builders, traces, and GPT-owned cognition path.

Important shared families include:

| Shared family | Writing adapter | World-simulation adapter |
| --- | --- | --- |
| `scene_analysis` | `scene_planner` | `world_scene_causal_analyzer` |
| `character_cognition` | `character_simulator` | `world_character_cognition` |
| `agency_governance` | `over_governance_detector` | `world_agency_guard` |
| `consistency_critique` | `neural_critic` | `world_consistency_critic` |

Writing-only capabilities such as `style_drift_detector`, `writing_card_director`, and `final_polisher` remain writing-only. World-only perception, legacy memory-context projection, and action-candidate proposal remain world-only.

## World-mode hard boundary

World mode rejects writing and narrative-control payloads before the adapter can consume them. Examples include writing contexts, draft/prose payloads, plot goals, narrative objectives, camera priorities, or desired romance/plot progress.

`world_agency_guard` is the diagnostic exception for narrative-control signals: it may inspect those signals only to report that they must not control character choice.

World output is also checked for causal-authority violations. In particular, `world_action_proposer` may return candidate intents but may not return a selected/final action or an action result. World/character state mutation remains outside neural authority.

## Writing-mode compatibility

Phase62B deliberately preserves:

- the seven-module writing registry;
- existing writing capability names;
- existing MCP tool count;
- existing external-brain generation boundaries;
- existing Canon/active-engine/candidate mutation guards.

The architecture-primary writing route now passes through the shared core in `session_mode = writing`, while ordinary non-session/local compatibility calls can continue using the existing low-level wrappers. Legacy scoped sessions without an explicit `session_mode` are inferred from their established `task_type + mode` lineage and therefore still receive the same mode lock.

## Trace evidence

Architecture-primary writing and world traces record:

- `session_mode`
- `shared_neural_core_version`
- `shared_capability_family`

This gives testable evidence that both modes use the same core router while preserving separate input/output contracts.

### Phase62A-R2 strict neural execution provenance

Shared Core routing is not proof that a trained model executed. Phase62A-R2 therefore keeps wrapper completion, adapter invocation, model-backed execution, and adapter-output acceptance as separate evidence axes.

`used_neural_network = true` now requires all of the following:

- the adapter function identity was server-attested as `model_backed_attested`;
- the wrapper actually invoked that function;
- the adapter returned, establishing model-backed execution evidence.

A deterministic programmatic adapter, an unattested callable, a historical success trace without provenance, or adapter output that merely claims `model_backed: true` does not satisfy this evidence rule. Attestation is stored out-of-band against the server-side function identity and is not accepted from MCP or adapter JSON output.

Adapter-output acceptance is independent. In world mode a server-attested model may execute and return successfully while R1 rejects its output and preserves the trusted base; that run still has model-execution evidence but does not have `neural_extension_accepted` authority.

`neural_modules_used` and required-module completion retain their historical structural wrapper-success semantics. They do not become neural-model evidence. `sharedNeuralCoreVersion` remains `phase62b-shared-neural-core-v1`; provenance and usage evidence are independently versioned.

## Phase62B acceptance

`tests/phase62/phase62b-shared-neural-core-dual-mode-isolation.test.mjs` verifies:

- exactly two session modes;
- `character_simulator` and `world_character_cognition` share `character_cognition`;
- writing registry count remains seven;
- mode is bound to the entry `task_type + mode`, persisted, and immutable;
- direct low-level wrapper calls infer the mode of an already-scoped session and reject cross-mode use;
- writing→world and world→writing capability use is rejected;
- writing-context bundle lineage cannot be mixed across sessions;
- world cognition rejects narrative objectives;
- `world_agency_guard` can inspect forbidden control signals diagnostically;
- world action proposal cannot select the final action/result;
- both writing and world traces carry the same shared-core version and shared character-cognition family.

# World Simulation Neural Bridge

Phase62A adds a world-simulation cognition route beside the existing formal-writing external-brain route.

## Design boundary

The programmatic world simulator owns hard state and causal outcomes. ChatGPT owns named-character cognition and final action choice. Writer Workbench supplies bounded cognitive helpers, traces, and diagnostics.

The world-simulation route deliberately does **not** reuse `chatgpt_bridge_begin_external_brain_writing_session`, because formal-writing context hydration and relevant-Canon budgeting are writing concerns and can block or distort long-running simulation turns.

## Flow

```text
Programmatic World Simulator
  -> Scene State / Character State
  -> world_scene_causal_analyzer
  -> world_perception_filter
  -> Phase63B memory accessibility candidates (engine-side)
  -> Phase63C actual retrieval process
  -> recovered_memories
  -> world_character_cognition
  -> world_action_proposer
  -> ChatGPT character brain chooses an action intent
  -> causal simulator adjudicates result
  -> world_consistency_critic
  -> next event
```

`world_agency_guard` may be called before character choice whenever a request contains narrative, camera, spotlight, romance, or governance pressures that must not choose the character's action.

## Formal MCP surface

The Step4B-2 `chatgpt_public` mainline is:

- `chatgpt_bridge_begin_world_simulation_session`
- `chatgpt_bridge_prepare_world_turn`
- `chatgpt_bridge_submit_world_character_action`
- `chatgpt_bridge_resolve_world_turn`

The seven individual capability tools remain available only in the full/debug profile for diagnostics and compatibility:

- `chatgpt_bridge_use_world_scene_causal_analyzer`
- `chatgpt_bridge_use_world_perception_filter`
- `chatgpt_bridge_use_world_memory_retriever` — legacy candidate projector, not successful Phase63C retrieval
- `chatgpt_bridge_use_world_character_cognition`
- `chatgpt_bridge_use_world_action_proposer`
- `chatgpt_bridge_use_world_agency_guard`
- `chatgpt_bridge_use_world_consistency_critic`

## Hard permissions

World-simulation cognitive capabilities may not:

- mutate world or character state;
- decide action outcomes or combat results;
- force a character action;
- choose story direction;
- optimize for drama, camera, or screen time;
- expose unobserved/private information;
- promote guesses or memories into objective truth;
- mutate Canon or Active Engine.

## Adapter note

Phase62A provides deterministic structural defaults so the bridge is testable and safe even without an external model adapter. These defaults normalize inputs, enforce information boundaries, and produce diagnostic/cognition packets; they are not a claim that a trained neural model executed.

A later phase can inject actual local/remote neural adapters into `runWorldSimulationCapability(...)` without changing the MCP contract. The adapter receives the capability name, world-simulation run identity, and hard permission boundary, and must return a JSON object.

## Test

```powershell
npm run test:phase62a
```

The Phase62A test verifies information isolation, memory provenance, non-binding actions, agency protection, consistency findings, trace creation, and no input mutation.

## Step4B-2 transport boundary note

Formal native MCP turn transport is installed. The public route exposes only begin/prepare/submit/resolve and keeps the complete prepared turn in the HTTP parent ephemeral broker. Legacy individual capability tools are full/debug only. Step4A audit redaction covers both the formal tools and the retained debug tools. The programmatic native loop remains the authoritative end-to-end kernel.

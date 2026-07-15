# External Brain Session Authority Map

This map records the Phase 3A repository evidence. It deliberately separates persisted explicit linkage from inference. Timestamp proximity is never retention authority.

## Authority root

The persisted authority root is the agent run. For the ChatGPT-owned route, `external_brain_session_id`, `agent_run_id`, and `run_id` name the same `agent_run_*` identity. The agent run is therefore the session root, not a child record and not a separate parallel ID.

Phase 3A persists `external_brain_session_id` and `writing_context_bundle_id` in newly created ChatGPT-owned `run.json` records. Historical sessions predate those fields; their bundle linkage must come from the explicit evidence below or remain incomplete.

## Persisted lineage edges

| From | To | Historical evidence | Phase 3A forward evidence | Edge kind |
|---|---|---|---|---|
| external-brain session | agent run | The bridge aliases all three session/run input names to one `agent_run_*` ID. | `run.json.external_brain_session_id === run.json.run_id`. | `EXPLICIT_ID` |
| agent run | GPT writing context | Begin-session returned both IDs, but the original run stored only a hash of the begin input. Phase47 cognition output records persist both IDs. Phase44/46/47 acceptance evidence also persists both. | New ChatGPT-owned runs persist `writing_context_bundle_id`. | `EXPLICIT_ID` / `EXPLICIT_METADATA` |
| agent run | neural trace | Every persisted neural trace has `run_id`; `neural_modules_used.json` also stores `trace_id`. | Unchanged. | `EXPLICIT_ID` |
| GPT writing context | neural trace | Phase47 prior-cognition output records persist run, bundle, and trace together for the five prior cognition modules. Acceptance evidence persists the seven-trace live chains. | All new neural traces may persist `writing_context_bundle_id`, including writing-card-director and final-polisher traces. | `EXPLICIT_ID` / `EXPLICIT_METADATA` |
| session/bundle/trace | neural output | `data/agent_runs/neural_outputs/<run>/<bundle>/<module>/<trace>.json` and each cognition record carry the same IDs plus `output_hash`. | Unchanged. | `EXPLICIT_METADATA`; path is supporting `PATH_REFERENCE` |
| raw-story seal | session/bundle | The live broker receipt holds run, bundle, handoff ID, and SHA-256 only in process-local memory. It does not survive restart. Phase47K acceptance evidence persists a historical handoff ID. | A successful sealed-route final-polisher trace persists the handoff ID, bundle ID, and run ID, but never the raw prose. | `EXPLICIT_METADATA` when a trace/evidence record exists; otherwise ephemeral only |
| final polisher | session | Its trace has `run_id`, module `final_polisher`, and output hash. Historical bundle linkage comes through the session's explicit cognition/evidence bundle edge. | New traces also carry bundle ID and sealed handoff ID when applicable. | `EXPLICIT_ID` / `EXPLICIT_METADATA` |
| writing candidate | GPT bundle | `writing_candidates/*/metadata.json.source_bundle_id` and `source_bundle_path`. | Unchanged. | `EXPLICIT_ID` / `PATH_REFERENCE` |
| proof | candidate | Proof metadata persists candidate/proofing-context IDs. | Unchanged. | `EXPLICIT_ID` |
| approval | candidate/proof | Approval `item.json`, request payload, and links persist candidate and proof IDs. | Unchanged. | `EXPLICIT_ID` / `EXPLICIT_METADATA` |
| settlement/adoption | candidate/draft/proof | Settlement and adoption metadata carry their workflow IDs and upstream candidate/draft/proof IDs. | Unchanged. | `EXPLICIT_ID` / `EXPLICIT_METADATA` |
| Canon activation/rollback | governance chain | Pending candidates, activation logs, and rollback index persist governance IDs and paths. | Unchanged. | `EXPLICIT_ID` / `PATH_REFERENCE` |
| Phase acceptance evidence | session/bundle/trace/handoff | Immutable JSON records in `config/` explicitly name the accepted run, bundle, traces, hashes, and (Phase47K) handoff. | The lineage scanner treats ID, matching hash, and path references as hard evidence pins. | `EXPLICIT_ID`, `HASH_MATCH`, or `PATH_REFERENCE` |

## Governance chain

The external-brain service itself intentionally creates no candidate, approval, settlement, adoption, or Canon mutation. A later candidate can explicitly reference its GPT bundle. From there, candidate → proof → approval → adoption/settlement → Canon records form a persisted governance chain. A session is governance-pinned only when this chain can be reached through explicit ID, metadata, hash, or path edges.

Closed, unrelated workflow records do not pin a session merely because their timestamps are nearby. Active candidates, active approvals, settlement records, adopted writing, and Canon activation/rollback references do pin it.

## Inferred linkage

Historical `run.json` files may lack the GPT bundle ID. If exactly one `gptctx_*` directory has the same compact timestamp as a run, the scanner records `INFERRED_TIME_CORRELATION`. This edge:

- is shown for review;
- does not add the bundle to cleanup paths;
- does not create governance or acceptance authority;
- makes an otherwise completed lineage `INCOMPLETE_SESSION` rather than cleanup-eligible.

The input hash in an old run cannot be reversed into the original bundle ID. A matching timestamp, directory birth time, or transaction proximity is therefore never promoted to permanent authority.

## Cleanup ownership boundary

One cleanup proposal item represents one session lineage. Eligible paths may contain only:

- the exact `data/agent_runs/<run_id>` directory;
- an explicitly and uniquely owned `data/outputs/gpt_writing_contexts/<bundle_id>` directory;
- exact trace files under `data/agent_runs/neural_traces` whose persisted `run_id` matches;
- exact output files under `data/agent_runs/neural_outputs` whose persisted run identity matches.

Candidates, proofs, approvals, settlements, adoption records, Canon, rollback state, acceptance evidence, transaction manifests, visual assets, `active_engine.md`, and `compressed_rules.md` are never session cleanup paths.

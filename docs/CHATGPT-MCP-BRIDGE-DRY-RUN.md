# ChatGPT MCP Bridge E2E Dry Run

## Purpose

Phase 14B adds a deterministic end-to-end dry-run workflow for the Phase 14A
ChatGPT MCP Bridge. It verifies the guarded chain from Writer Workbench status
through creation of a pending adoption request.

The workflow does not call ChatGPT, OpenAI, another external model, or a local
generation adapter. Static fixture text stands in for candidate and proof
output.

## Run

```powershell
npm.cmd run bridge:dry-run
npm.cmd run test:bridge:e2e
```

Direct CLI examples:

```powershell
node scripts/chatgpt-bridge-e2e-dry-run.mjs --dry-run
node scripts/chatgpt-bridge-e2e-dry-run.mjs --fixture-root .phase14b-chatgpt-bridge-e2e --cleanup
node scripts/chatgpt-bridge-e2e-dry-run.mjs --json --include-settlement-fixture
```

`--fixture-root` is an isolated dot-prefixed fixture name. It is mapped under
the existing workflow test roots so repository path policy remains enforced.
The script always removes its fixture directories and transaction manifests,
including when a workflow assertion fails.

## Main Flow

```text
Writer Workbench status
  -> current task/generation/retrieval inputs
  -> writing context
  -> deterministic candidate fixture
  -> candidate intake
  -> proofing context
  -> deterministic proof report fixture
  -> proof report intake
  -> adoption request
  -> approval queue
  -> STOP
```

The request must remain `pending`. The script never confirms or approves it and
does not create an adopted chapter.

## Settlement Fixture

With `--include-settlement-fixture`, the script creates a synthetic adopted
writing only inside its isolated fixture root:

```text
synthetic adopted-writing fixture
  -> chatgpt_bridge_build_settlement_context
  -> settlement context artifact
  -> STOP
```

This does not confirm adoption, create an official adopted writing, save a
settlement report, or create a pending engine candidate. The synthetic files
and settlement context are removed before the command exits.

## Safety Checks

The JSON summary reports every step, artifact ID, cleanup status, and before /
after hashes. A successful run verifies:

- No external or local generation call occurred.
- No approval or adoption confirmation occurred.
- No official adopted chapter or pending engine candidate was created.
- No settlement report was saved.
- No activation, compressed-rule application, restore, rollback, or cleanup
  execution capability was invoked.
- `active_engine.md` and `compressed_rules.md` are byte-for-byte unchanged.
- All fixture and transaction runtime artifacts were removed.

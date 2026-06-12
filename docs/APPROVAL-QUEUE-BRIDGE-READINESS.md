# Approval Queue Bridge Readiness

## Purpose

Phase 14C makes ChatGPT Bridge adoption requests reviewable and traceable
before an operator uses the existing approval flow. It does not add approval,
adoption confirmation, activation, restore, or rollback capabilities.

ChatGPT Bridge requests must stop in the approval queue because candidate
adoption changes workflow status and creates an adopted chapter. Only a human
operator may make that decision.

## Review Flow

```text
ChatGPT Bridge
  -> candidate adoption request
  -> approval queue item
  -> readiness validator
  -> operator reviews source, lineage, artifacts, and safety checks
  -> manual confirmation only through the existing approval flow
```

## Request Lineage

A bridge-created request records:

- Writing context and source bundle ID.
- Candidate ID, title, creation time, and hash.
- Proofing context ID.
- Proof report ID, verdict, severity, and hash.
- Active-engine and compressed-rules hashes at request time.
- Denied bridge capabilities and required human-review steps.

Missing candidate, proof report, proofing context, writing context, or hash
evidence blocks readiness.

## Operator Review

1. Confirm `source` is `chatgpt_bridge` and status is `pending`.
2. Read the candidate and verify it should be considered for adoption.
3. Read the proof report, including verdict, severity, and unresolved findings.
4. Confirm candidate and proof hashes match the request snapshot.
5. Confirm current active-engine and compressed-rules hashes match the request.
6. Confirm no adopted chapter or pending engine candidate has been created.
7. Confirm all bridge capabilities remain denied.

Do not confirm when any required artifact is missing or a hash has changed.

## Readiness Decisions

- `ready_for_human_review`: Evidence is complete and unchanged. This is not an
  approval; the operator must still decide manually.
- `blocked`: One or more `blocking_reasons` must be resolved before confirmation.

The optional `approval_queue_bridge_readiness_report` MCP tool is read-only.
It may include bounded artifact previews, but it cannot approve, confirm
adoption, activate an engine, apply compressed rules, restore, or roll back.

## Protected Files

Phase 14C does not modify `data/canon_db/active_engine.md` or
`data/error_report_db/compressed_rules.md`. A hash mismatch in either file
blocks readiness and requires a new request or explicit operator investigation.

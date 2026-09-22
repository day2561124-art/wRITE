# Verification Scheduled Regression (VA-13)

VA-13 keeps the VA-12 Full ×3 scheduled regression matrix, but turns the Ubuntu / Node 24 lane into a selector-audit lane that compares focused affected selection against the full suite on the same repository state.

## Audit range

The scheduled Ubuntu / Node 24 lane checks out full Git history and selects a bounded rolling range of at most 20 first-parent transitions. The oldest commit in that window becomes the audit base; the scheduled commit is the audit head.

This is intentionally a rolling confidence window rather than a claim that the selected base is the exact previous scheduled run. VA-14 retains each scheduled audit as bounded workflow artifact evidence and can aggregate multiple retained receipts without changing this gate.

## Execution rules

1. Compute exact base-to-head changed-path evidence with the VA-12 CI change detector.
2. Run the existing affected selector against that exact range.
3. If the selector returns a focused plan, run all required focused suites without VA-11 result caching.
4. Run the complete `tests/run-all.mjs` suite on the same checked-out head.
5. Emit `tests/.tmp/ci-selection-audit.last.json` and the same receipt to stdout.

If the affected selector falls back to `all`, the audit does not run a duplicate affected full suite. It runs the scheduled full regression once and records a `FULL_FALLBACK_*` classification.

## Classification

- `CONSISTENT_PASS`: focused affected suites pass and the full suite passes.
- `SELECTOR_MISS_CANDIDATE`: focused affected suites pass but the full suite fails.
- `AFFECTED_FAILED_FULL_PASSED`: focused affected suites fail while full passes; this is not automatically called a selector miss because flakiness or infrastructure can still be involved.
- `BOTH_FAILED`: both focused affected and full fail.
- `FULL_FALLBACK_PASS` / `FULL_FALLBACK_FAIL`: the affected selector conservatively escalated to full, so no focused-vs-full miss inference is made.

Only `SELECTOR_MISS_CANDIDATE` is evidence that the dependency graph / routing may have missed hidden coupling. VA-13 does not automatically rewrite mappings from one observation; the receipt is evidence for a later reviewed routing update.

## Coverage preservation

Scheduled full coverage remains three environments:

- Ubuntu / Node 18: direct full regression.
- Windows / Node 18: direct full regression.
- Ubuntu / Node 24: selector audit followed by full regression.

Thus VA-13 adds selection validation without adding a fourth full-suite run.

## Safety boundaries

- `tests/run-all.mjs` remains unchanged.
- CC-6D declared scope remains untouched.
- Full regression remains authoritative for the scheduled lane.
- VA-11 cache is not enabled.
- A focused failure still fails the audit even when full passes.
- A full failure always fails the audit.
- Unknown/unscoped change remains a safe selector fallback to full.
- VA-14 retains the audit receipt as bounded CI artifact evidence and aggregates one or more retained receipts without changing this gate.

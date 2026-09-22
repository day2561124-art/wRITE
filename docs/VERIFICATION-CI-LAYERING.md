# Verification CI Layering (VA-12)

VA-12 replaces the previous "full suite on every event and every matrix entry" CI policy with layered verification while preserving full-regression evidence.

## Event layers

### Pull request

Pull requests targeting `main` run:

1. an Ubuntu / Node 24 affected gate derived from the exact PR base and head Git SHAs;
2. an Ubuntu / Node 18 structural smoke job;
3. a Windows / Node 18 structural smoke job.

The affected gate uses the existing fail-closed affected selector. Unknown, unscoped, or unprovable changes still escalate to `run-all`; CI does not guess a smaller suite.

The workflow does not use top-level `paths` or `paths-ignore` filters. This keeps required PR checks visible even when a change is documentation-heavy.

### Main push

A push to `main` runs:

- Ubuntu / Node 24 `tests/run-all.mjs` as the post-merge broader regression;
- the same Ubuntu / Windows Node 18 structural smoke matrix.

This retains immediate post-merge regression coverage without multiplying the complete suite across three environments.

### Scheduled full regression

A weekly scheduled run executes the complete `tests/run-all.mjs` suite on the preserved matrix:

- Ubuntu / Node 18;
- Windows / Node 18;
- Ubuntu / Node 24.

This preserves the old cross-platform Full ×3 evidence outside the critical PR path. VA-13 can build telemetry and selector-miss analysis on this lane without changing the PR gate again.

### Manual full / certification

`workflow_dispatch` exposes two explicit purposes:

- `full`: full cross-platform regression;
- `certification`: the same full cross-platform regression plus the explicit Character Memory Core certification audit.

Certification remains an explicit milestone action rather than an ordinary feature-development default.

## Git-range affected detection

`tests/ci-change-detection.mjs` accepts only exact 40-character Git SHA-1 object IDs. It invokes Git without a shell and collects both sides of rename/copy records, so deletions and path moves cannot silently disappear from change evidence.

`tests/run-ci-affected.mjs` then passes the exact changed-path set into the existing affected selector. If `tests/run-all.mjs` changed, it also supplies the exact base-to-head zero-context diff so the selector can distinguish reviewed inventory-only edits from runner-semantics changes.

## Safety invariants retained

- Unknown changes still fall back to full regression.
- No certification test is deleted.
- No reliability test is deleted.
- Formal Writer Workbench integration validation is unchanged.
- Journal / transaction / checkpoint / authoritative-remote safety is unchanged.
- `tests/run-all.mjs` itself is not modified by VA-12.
- The active CC-6D declared scope is not touched.
- CI result caching from VA-11 is not enabled in formal CI.
- Full regression remains available on main, schedule, and explicit manual runs.

## GitHub Actions implementation notes

The workflow uses GitHub's native event routing rather than external orchestration. Pull-request change detection checks out full history (`fetch-depth: 0`) so both exact base and head objects are available locally. Scheduled workflows run against the latest default-branch commit, making the weekly Full ×3 lane suitable for detecting hidden coupling that focused PR selection missed.

The workflow uses current first-party `actions/checkout@v7` and `actions/setup-node@v7`, with persisted checkout credentials disabled because CI only reads repository history.

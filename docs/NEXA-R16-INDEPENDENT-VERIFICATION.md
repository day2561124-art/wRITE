# R16 independent full verification

Status: independent evidence and adoption foundation merged; issuer candidate under review. Not a release approval or production trust configuration.

## Verified implementation baseline

- #137: typed managed integration preparation/validation, exact scope and positive Journal evidence, fail-closed capability availability. Full affected/all, Session 0 and Journal scale passed.
- #138: signed Ed25519 verification, trusted read-only GitHub collector and transport, candidate observation without authority. Full affected/all and both platform fixtures passed.
- #139: exact registered candidate and immutable Git delta, original risk-routed suites, receipt and policy recheck. Full affected/all and historical preflight recovery passed.
- #140: opt-in independent adoption, original local Git worktree/clean/diff/cleanup gates, signed remote evidence recorded separately from local test execution. Ready publication follows a durable terminal. Apply rechecks the proof and Journal. Independent interrupted validation retires the candidate without replay or inferred success. Exact tested head e890821e9ae46d59e935aebdc64ffbf408bf8b37: workflow 45955068591 (17 fixture tests per platform), 45955068617 (Session 0), 45955068596 (Journal scale), 45955068637 (full affected/all, six executed jobs). Merged main c7777a44990695e0d021b13a78204d66ad57fd95, identical tree.

## Execution boundary

The installed protected dispatcher only executes the fixed five-file AppContainer suite. Do not substitute it for full suites, run host-dependent tests unconfined, or extend its privilege. Hosted disposable committed-candidate verification retains the actual risk-routed suite plan and full release/platform requirements. A dirty uncommitted workspace is not an exact remote commit.

GitHub provider success alone is not an independently verified raw process outcome. The collector requires complete attempt-specific data, pinned repository/workflow/runner identity and reviewed mandatory steps; abbreviated connector results, candidate stdout, or candidate-provided artifacts are not trusted. The read-only GitHub transport binds a separately owned credential and immutable Git object bytes.

## Issuer candidate

The host-only issuer module takes an exact registered candidate identity, derives the host-owned policy, collects the exact provider observation, and requires a separate trusted observation of the original mandatory test outcome. The test result must match suite/platform/workflow/commit/run/job/attempt/timestamp. The independent signer is supplied only by the already trusted verifier process. The returned envelope is verified against the pinned issuer public key, exact context and freshness; its expiry never extends the observed jobs' maximum age. The caller cannot provide the policy, job data or key. A receipt grants no execution permission.

No private key, real credential, new privileged operation or production enrollment is included. The test uses ephemeral fixture keys and injected observations.

## Remaining acceptance and operational binding

1. Establish the independent verification service identity and reviewed immutable execution definitions through the existing authorized host/operator mechanism. Keep issuer credentials and signing keys inaccessible to candidate execution and engineering agents.
2. Bind actual provider observation plus independently trusted test outcome evidence to that service. A provider job conclusion must not be promoted to an invented exit code. Use exact committed candidate objects and the required suite/platform plan. Confirm real full-suite, postseal, failure, expiry and changed-attempt scenarios.
3. Configure the production integration service's opt-in evidence gate using that independently enrolled issuer and protected read source. Enable managed validation availability only after its exact host binding and positive acceptance have been proven. No self-issued standing grant or bypass of protected host controls.
4. Exercise the complete authenticated lifecycle, including exact candidate publication, verification, local safe integration, push to a disposable remote and existing approved maintenance fixture. Separately verify live release deployment and host identity. Keep #106 open until these gates have actual evidence.

## Live host observation

At the #140 merge, authoritative remote main was c7777a44990695e0d021b13a78204d66ad57fd95. Local main remained 2955dc448943443750d478aecdbd216b0a754a17, dirty, with stale tracking and remote object not locally available. Pi isolated sidecar reported ready; Journal was healthy, chain verified, sequence 66462, no active, dangling, ambiguous or isolated operations. No local sync, deployment, or grant mutation was made. Preserve the existing dirty worktree.


## Protected consumer binding candidate

The default integration service and the explicit host maintenance integration entry share a fixed, opt-in consumer loader. Unconfigured hosts keep the existing local path; a configured but invalid binding denies independent validation/apply rather than falling back. The Pi scoped-dispatcher full verification and integration-validation availability gates remain unchanged until separately accepted operational enrollment. This change does not establish a supervisor, issuer, credential, signing service or authorization.

The operator must independently enroll the standard dispatcher SID, issuer Ed25519 public key and reviewed complete suite/workflow policy. Under the existing protected Windows installation only, the fixed location is `%ProgramFiles%\WriterWorkbench-PiMaintenance-v3\independent-verification\consumer.json`; the receipt directory is its fixed sibling child `receipts`. Neither location is an MCP argument. The installed release must be under `%ProgramFiles%\NexaRuntimeV3\releases\<40-character commit>`, with the existing managed project and scoped grant-root configuration. The protected launcher must pin the exact manifest bytes through `NEXA_INDEPENDENT_VERIFICATION_CONSUMER_SHA256`. Do not add this to an engineering workspace, an interactive user shell, or a candidate's environment as a substitute for operator enrollment.

Manifest has exactly five fields: schema_version (1), consumer_sid (Windows SID), issuer_public_key (public SPKI PEM only), policy (existing consumer policy: repository, issuer, max_age_ms, suite_workflows, additional_required), acl_sha256 (ordered array of lowercase SHA-256 digests of UTF-8 owner/group/DACL SDDL strings). ACL order is filesystem root through each ancestor of the independent-verification directory inclusive, followed by consumer.json, then receipts. Obtain SDDL from the actual host with GetSecurityDescriptorSddlForm(Owner | Group | Access). The operator must first review effective ownership and write access (including parent replacement rights, group memberships, issuer-only publication and dispatcher read-only access), not simply hash whatever ACL happens to exist. A matching digest is a comparison to that reviewed state, not proof that an arbitrary descriptor is safe. No credentials or private keys belong in this manifest.

The fixed native read-only probe rejects reparse points, checks the actual process SID and non-administrator token, and compares each descriptor to its reviewed pin. The loader bounds and hashes the manifest bytes, rejects linked/substituted config files and non-public/non-Ed25519 keys, and rechecks manifest and ACLs on receipt reads and apply. Revocation by protected configuration removal/change denies the running consumer; changing trust requires a new independent review and protected restart. Fixture tests use ephemeral keys and synthetic descriptor pins; a Windows native read-only probe uses actual ACLs on temporary test files. These do not certify production ACLs, issuer trust, OS executable closure, or live deployment.

Operational completion still requires an independently approved protected launcher pin, actual host enrollment and positive attempt-specific signed receipt acceptance. The consumer code must not create a trust configuration, enroll its own keys, or enable managed availability based on an unsigned CI log or synthetic fixture.


## Operator-only host directory preparation

After #179 the signed supervisor outcome publisher and consumer-side binding are merged. The observed live host has the existing running NexaPiDispatch runtime, SYSTEM station lease and scoped maintenance runner, but no independent-verification directory. Do not reinstall or modify those existing components.

The reviewed `scripts/prepare-r16-independent-verification.ps1` is a create-only preparation step for an elevated 64-bit Windows PowerShell operator. It requires two already existing, enabled, separate standard local accounts for issuer and supervisor, distinct from the dispatcher and operator. It checks the existing maintenance root ACL against its original scoped installer contract and rejects an existing target instead of repairing it. `-WhatIf` makes no changes. No account, credential, private key, manifest, grant, scheduled task, launcher pin or validation capability is created.

The new exchange root is fixed beneath the existing maintenance root. Its receipts directory permits issuer publication and dispatcher read access; its outcomes directory permits supervisor publication and issuer read access. Neither ordinary role can change the directory ACL or replace the exchange root. System and administrators retain maintenance authority. Owner Rights constrains implicit owner DACL modification. These are explicit DACL preparations, not proof of effective token isolation: the operator must independently verify ancestor protection, group/privilege membership, actual standard-account read/write denial, inherited file ACLs and service identity before enrollment. The fixture checks actual Windows directory creation, role-specific ACEs, no overwrite, identity collision rejection, and unchanged prior maintenance configuration; it does not certify a live deployment.

No use of the script on the actual host is required yet. The next operational step must select a trusted execution source and independently enrolled service identities. Only then can actual launcher and service installation, key provisioning outside candidate reach, manifest pinning and real signed outcome acceptance proceed. A blank directory is not an enrolled service. A failure partway through preparation leaves the newly created partial layout for operator inspection; the script does not delete or rewrite it automatically.

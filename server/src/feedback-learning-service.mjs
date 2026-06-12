import { createHash, randomBytes } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createApprovalItem } from "./approval-queue-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";

const feedbackIdPattern = /^feedback_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const digestIdPattern = /^feedback_digest_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const ruleCandidateIdPattern = /^rule_candidate_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const proposalIdPattern =
  /^compressed_rule_update_proposal_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const contextBundleIdPattern =
  /^feedback_context_bundle_\d{8}-\d{6}-[a-f0-9]{8}$/u;

const sourceTypes = new Set([
  "user_feedback",
  "proof_report",
  "settlement_report",
  "adoption_rejection",
  "writing_candidate",
  "ui_marker",
  "manual",
]);
const severities = new Set(["info", "low", "medium", "high", "critical"]);
const categories = new Set([
  "dialogue",
  "pacing",
  "continuity",
  "character",
  "combat",
  "romance",
  "daily_life",
  "worldbuilding",
  "style",
  "canon",
  "safety",
  "workflow",
  "other",
]);
const feedbackStatuses = new Set([
  "open",
  "triaged",
  "included_in_digest",
  "converted_to_rule_candidate",
  "rejected",
  "archived",
]);
const ruleAreas = new Set([
  "writing_context",
  "proofing_context",
  "settlement_context",
  "compressed_rules",
  "workflow",
  "other",
]);
const riskLevels = new Set(["low", "medium", "high"]);
const proposalModes = new Set(["append", "replace_section", "manual_review"]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createId(prefix) {
  return `${prefix}_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maxLength = 5_000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalText(value, label, maxLength = 5_000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalStringArray(value, label, maximum = 100) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${label} must be an array with at most ${maximum} items.`);
  }
  return [...new Set(value.map((item) => requiredText(item, `${label} item`, 500)))];
}

function optionalObjectArray(value, label, maximum = 50) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${label} must be an array with at most ${maximum} items.`);
  }
  return value.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`${label} items must be objects.`);
    }
    return {
      kind: requiredText(item.kind, `${label}.kind`, 100),
      value: requiredText(item.value, `${label}.value`, 10_000),
    };
  });
}

function optionalLimit(value, fallback = 20) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("limit must be an integer between 1 and 100.");
  }
  return value;
}

function requireEnum(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`Unknown ${label}: ${value}`);
  return value;
}

function assertId(value, pattern, label) {
  if (!pattern.test(String(value ?? ""))) throw new Error(`Invalid ${label}.`);
  return value;
}

function rootsFor(options = {}) {
  const root = options.feedbackLoop
    ? assertPathInside(options.feedbackLoop, projectPaths.feedbackLoop, "feedback loop test root")
    : projectPaths.feedbackLoop;
  const compressedRules = options.compressedRulesPath
    ? assertPathInside(
      options.compressedRulesPath,
      projectPaths.errorReportDb,
      "compressed rules test path",
    )
    : projectPaths.compressedRules;
  return {
    root,
    items: path.join(root, "items"),
    digests: path.join(root, "digests"),
    ruleCandidates: path.join(root, "rule_candidates"),
    proposals: path.join(root, "rule_update_proposals"),
    contextBundles: path.join(root, "context_bundles"),
    compressedRules,
  };
}

function artifactPaths(root, id, filename) {
  return {
    directory: path.join(root, id),
    data: path.join(root, id, filename),
  };
}

function feedbackPaths(id, roots) {
  assertId(id, feedbackIdPattern, "feedback_id");
  return artifactPaths(roots.items, id, "feedback.json");
}

function digestPaths(id, roots) {
  assertId(id, digestIdPattern, "digest_id");
  return artifactPaths(roots.digests, id, "digest.json");
}

function ruleCandidatePaths(id, roots) {
  assertId(id, ruleCandidateIdPattern, "rule_candidate_id");
  return artifactPaths(roots.ruleCandidates, id, "candidate.json");
}

function proposalPaths(id, roots) {
  assertId(id, proposalIdPattern, "proposal_id");
  return artifactPaths(roots.proposals, id, "proposal.json");
}

function contextBundlePaths(id, roots) {
  assertId(id, contextBundleIdPattern, "context_bundle_id");
  const directory = path.join(roots.contextBundles, id);
  return {
    directory,
    metadata: path.join(directory, "metadata.json"),
    context: path.join(directory, "context.md"),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function listArtifacts(root, pattern, filename) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const records = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !pattern.test(entry.name)) continue;
    try {
      records.push(await readJson(path.join(root, entry.name, filename)));
    } catch {
      // Ignore incomplete runtime artifacts.
    }
  }
  return records.sort((left, right) => (
    String(right.created_at).localeCompare(String(left.created_at))
  ));
}

function feedbackSafety() {
  return {
    modifies_active_engine: false,
    modifies_compressed_rules: false,
    requires_approval_to_apply: true,
  };
}

function fallbackTitle(body) {
  const firstLine = body.split(/\r?\n/u).find((line) => line.trim()) ?? "Feedback item";
  return firstLine.trim().slice(0, 120);
}

function countsBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key];
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function repeatedPatterns(items) {
  const counts = new Map();
  for (const item of items) {
    for (const value of [item.category, ...item.tags]) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([pattern, count]) => ({ pattern, count }));
}

async function resolveFeedbackItems(input, options) {
  const ids = optionalStringArray(
    input.feedback_ids ?? input.feedbackIds,
    "feedback_ids",
  );
  if (ids.length) return Promise.all(ids.map((id) => getFeedbackItem(id, options)));
  return listFeedbackItems({
    category: input.category,
    severity: input.severity,
    status: input.status ?? "open",
    limit: input.limit ?? 100,
  }, options);
}

export async function saveFeedbackItem(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const body = requiredText(input.body ?? input.feedback_text, "body", 50_000);
  const sourceType = requireEnum(
    optionalText(input.source_type ?? input.sourceType, "source_type", 100) || "manual",
    sourceTypes,
    "source_type",
  );
  const severity = requireEnum(
    optionalText(input.severity, "severity", 100) || "medium",
    severities,
    "severity",
  );
  const category = requireEnum(
    optionalText(input.category, "category", 100) || "other",
    categories,
    "category",
  );
  const feedbackId = createId("feedback");
  const roots = rootsFor(options);
  const paths = feedbackPaths(feedbackId, roots);
  const record = {
    feedback_id: feedbackId,
    created_at: new Date().toISOString(),
    source_type: sourceType,
    source_id: optionalText(input.source_id ?? input.sourceId, "source_id", 500) || null,
    severity,
    category,
    status: "open",
    title: optionalText(input.title, "title", 500) || fallbackTitle(body),
    body,
    evidence: optionalObjectArray(input.evidence, "evidence"),
    tags: optionalStringArray(input.tags, "tags", 50),
    created_by: optionalText(input.created_by ?? input.createdBy, "created_by", 200)
      || "feedback_learning_service",
    safety: feedbackSafety(),
  };
  await commitFileTransaction("save-feedback-item", [
    { filePath: paths.data, content: json(record) },
  ], { feedback_id: feedbackId, phase: "phase_10a_feedback_learning" });
  return record;
}

export async function getFeedbackItem(feedbackId, options = {}) {
  const roots = rootsFor(options);
  const paths = feedbackPaths(feedbackId, roots);
  if (!await exists(paths.data)) throw new Error("Feedback item not found.");
  return readJson(paths.data);
}

export async function listFeedbackItems(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const category = optionalText(input.category, "category", 100);
  const severity = optionalText(input.severity, "severity", 100);
  const status = optionalText(input.status, "status", 100);
  if (category) requireEnum(category, categories, "category");
  if (severity) requireEnum(severity, severities, "severity");
  if (status) requireEnum(status, feedbackStatuses, "status");
  const roots = rootsFor(options);
  return (await listArtifacts(roots.items, feedbackIdPattern, "feedback.json"))
    .filter((item) => !category || item.category === category)
    .filter((item) => !severity || item.severity === severity)
    .filter((item) => !status || item.status === status)
    .slice(0, optionalLimit(input.limit));
}

export async function listFeedbackDigests(input = {}, options = {}) {
  const roots = rootsFor(options);
  return (await listArtifacts(roots.digests, digestIdPattern, "digest.json"))
    .slice(0, optionalLimit(input.limit));
}

export async function listRuleCandidates(input = {}, options = {}) {
  const roots = rootsFor(options);
  return (await listArtifacts(
    roots.ruleCandidates,
    ruleCandidateIdPattern,
    "candidate.json",
  )).slice(0, optionalLimit(input.limit));
}

export async function listCompressedRuleUpdateProposals(input = {}, options = {}) {
  const roots = rootsFor(options);
  return (await listArtifacts(
    roots.proposals,
    proposalIdPattern,
    "proposal.json",
  )).slice(0, optionalLimit(input.limit));
}

export async function createFeedbackDigest(input = {}, options = {}) {
  const items = await resolveFeedbackItems(input, options);
  if (!items.length) throw new Error("No feedback items matched the digest input.");
  const digestId = createId("feedback_digest");
  const roots = rootsFor(options);
  const paths = digestPaths(digestId, roots);
  const digest = {
    digest_id: digestId,
    created_at: new Date().toISOString(),
    source_feedback_ids: items.map((item) => item.feedback_id),
    filter: {
      category: optionalStringArray(input.category ? [input.category] : input.categories, "category"),
      severity: optionalStringArray(input.severity ? [input.severity] : input.severities, "severity"),
      status: optionalStringArray(input.status ? [input.status] : input.statuses, "status"),
    },
    summary: {
      total_items: items.length,
      by_category: countsBy(items, "category"),
      by_severity: countsBy(items, "severity"),
      repeated_patterns: repeatedPatterns(items),
    },
    items,
    safety: {
      digest_only: true,
      modifies_rules: false,
      modifies_active_engine: false,
    },
  };
  const operations = [{ filePath: paths.data, content: json(digest) }];
  for (const item of items) {
    const itemPaths = feedbackPaths(item.feedback_id, roots);
    operations.push({
      filePath: itemPaths.data,
      content: json({ ...item, status: "included_in_digest", latest_digest_id: digestId }),
    });
  }
  await commitFileTransaction("create-feedback-digest", operations, {
    digest_id: digestId,
    phase: "phase_10a_feedback_learning",
  });
  return digest;
}

export async function createRuleCandidate(input = {}, options = {}) {
  const roots = rootsFor(options);
  const digestId = assertId(
    requiredText(input.source_digest_id ?? input.sourceDigestId, "source_digest_id", 200),
    digestIdPattern,
    "digest_id",
  );
  const digest = await readJson(digestPaths(digestId, roots).data);
  const targetRuleArea = requireEnum(
    optionalText(input.target_rule_area ?? input.targetRuleArea, "target_rule_area", 100)
      || "other",
    ruleAreas,
    "target_rule_area",
  );
  const riskLevel = requireEnum(
    optionalText(input.risk_level ?? input.riskLevel, "risk_level", 100)
      || (targetRuleArea === "compressed_rules" ? "high" : "medium"),
    riskLevels,
    "risk_level",
  );
  const ruleCandidateId = createId("rule_candidate");
  const paths = ruleCandidatePaths(ruleCandidateId, roots);
  const candidate = {
    rule_candidate_id: ruleCandidateId,
    created_at: new Date().toISOString(),
    source_digest_id: digestId,
    source_feedback_ids: digest.source_feedback_ids,
    target_rule_area: targetRuleArea,
    risk_level: riskLevel,
    candidate_rule: requiredText(
      input.candidate_rule ?? input.candidateRule,
      "candidate_rule",
      20_000,
    ),
    rationale: requiredText(input.rationale, "rationale", 20_000),
    examples: optionalStringArray(input.examples, "examples", 50),
    status: input.ready_for_proposal === false ? "draft" : "ready_for_proposal",
    safety: {
      candidate_only: true,
      not_applied: true,
      requires_approval: true,
    },
  };
  const operations = [{ filePath: paths.data, content: json(candidate) }];
  for (const feedbackId of digest.source_feedback_ids) {
    const itemPaths = feedbackPaths(feedbackId, roots);
    const item = await readJson(itemPaths.data);
    operations.push({
      filePath: itemPaths.data,
      content: json({
        ...item,
        status: "converted_to_rule_candidate",
        latest_rule_candidate_id: ruleCandidateId,
      }),
    });
  }
  await commitFileTransaction("create-rule-candidate", operations, {
    rule_candidate_id: ruleCandidateId,
    digest_id: digestId,
    phase: "phase_10a_feedback_learning",
  });
  return candidate;
}

export async function createCompressedRuleUpdateProposal(input = {}, options = {}) {
  const roots = rootsFor(options);
  const candidateIds = optionalStringArray(
    input.source_rule_candidate_ids ?? input.sourceRuleCandidateIds,
    "source_rule_candidate_ids",
  );
  if (!candidateIds.length) throw new Error("source_rule_candidate_ids is required.");
  const candidates = await Promise.all(candidateIds.map(async (id) => {
    assertId(id, ruleCandidateIdPattern, "rule_candidate_id");
    return readJson(ruleCandidatePaths(id, roots).data);
  }));
  if (candidates.some((candidate) => candidate.status !== "ready_for_proposal")) {
    throw new Error("All rule candidates must be ready_for_proposal.");
  }
  const targetText = await readFile(roots.compressedRules, "utf8");
  const mode = requireEnum(
    optionalText(input.mode, "mode", 100) || "manual_review",
    proposalModes,
    "proposal mode",
  );
  const content = requiredText(input.content, "content", 50_000);
  const proposalId = createId("compressed_rule_update_proposal");
  const paths = proposalPaths(proposalId, roots);
  const proposal = {
    proposal_id: proposalId,
    created_at: new Date().toISOString(),
    source_rule_candidate_ids: candidateIds,
    target_file: normalizeProjectPath(roots.compressedRules),
    current_target_sha256: sha256(targetText),
    proposed_patch: { mode, content },
    diff_summary: optionalText(input.diff_summary ?? input.diffSummary, "diff_summary", 5_000)
      || `${mode}: ${candidateIds.length} candidate rule(s), ${content.length} characters`,
    risk: {
      modifies_compressed_rules: true,
      modifies_active_engine: false,
      requires_approval: true,
      direct_apply_allowed: false,
    },
    safety: {
      proposal_only: true,
      applied: false,
      approval_required: true,
    },
  };
  const operations = [{ filePath: paths.data, content: json(proposal) }];
  for (const candidate of candidates) {
    operations.push({
      filePath: ruleCandidatePaths(candidate.rule_candidate_id, roots).data,
      content: json({
        ...candidate,
        status: "included_in_proposal",
        latest_proposal_id: proposalId,
      }),
    });
  }
  await commitFileTransaction("create-compressed-rule-update-proposal", operations, {
    proposal_id: proposalId,
    phase: "phase_10a_feedback_learning",
  });
  return proposal;
}

export async function requestCompressedRuleUpdate(input = {}, options = {}) {
  const roots = rootsFor(options);
  const proposalId = assertId(
    requiredText(input.proposal_id ?? input.proposalId, "proposal_id", 200),
    proposalIdPattern,
    "proposal_id",
  );
  const proposal = await readJson(proposalPaths(proposalId, roots).data);
  const riskLevel = proposal.proposed_patch.mode === "manual_review" ? "high" : "medium";
  const item = await createApprovalItem({
    actionType: "compressed_rule_update",
    targetType: "compressed_rules",
    targetId: proposalId,
    title: "Compressed rule update proposal",
    summary: optionalText(input.reason, "reason", 5_000)
      || "Review the proposed compressed rule update.",
    reason: optionalText(input.reason, "reason", 5_000),
    riskLevel,
    requiresSecondConfirmation: riskLevel === "high",
    requiresUserConfirmation: true,
    canExecuteWithoutUserConfirmation: false,
    createdBy: "feedback_learning_service",
    impact: {
      will_modify: ["data/error_report_db/compressed_rules.md"],
      will_create: [],
      rollback_available: false,
    },
    details: {
      proposal_id: proposalId,
      current_target_sha256: proposal.current_target_sha256,
      proposed_patch: proposal.proposed_patch,
      direct_apply_allowed: false,
      rules_modified: false,
      active_engine_modified: false,
    },
    safety: {
      rules_modified: false,
      active_engine_modified: false,
      approval_only: true,
      direct_apply_allowed: false,
    },
  }, options);
  return {
    approval_item_id: item.approval_item_id,
    action_type: item.action_type,
    status: item.status.status,
    risk_level: item.risk_level,
    target_type: item.target_type,
    proposal_id: proposalId,
    requires_user_confirmation: true,
    can_execute_without_user_confirmation: false,
    direct_apply_allowed: false,
    safety: item.safety,
  };
}

function contextMarkdown(metadata, items, candidates) {
  const lines = [
    "# Feedback Context Bundle",
    "",
    "## Scope",
    metadata.scope || "Feedback learning context for external GPT use.",
    "",
    "## Open Feedback",
  ];
  for (const item of items) {
    lines.push(
      `### ${item.title}`,
      `- feedback_id: ${item.feedback_id}`,
      `- category: ${item.category}`,
      `- severity: ${item.severity}`,
      "",
      item.body,
      "",
    );
  }
  lines.push("## Repeated Patterns");
  for (const pattern of repeatedPatterns(items)) {
    lines.push(`- ${pattern.pattern}: ${pattern.count}`);
  }
  lines.push("", "## Candidate Rules Not Yet Approved");
  for (const candidate of candidates) {
    lines.push(
      `### ${candidate.rule_candidate_id}`,
      `- target: ${candidate.target_rule_area}`,
      `- risk: ${candidate.risk_level}`,
      "",
      candidate.candidate_rule,
      "",
    );
  }
  lines.push(
    "## Safety",
    "- This bundle is context only.",
    "- It does not modify compressed rules.",
    "- It does not modify active_engine.",
    "",
  );
  return lines.join("\n");
}

export async function buildFeedbackContextBundle(input = {}, options = {}) {
  const roots = rootsFor(options);
  const items = await resolveFeedbackItems({ ...input, status: input.status ?? "open" }, options);
  const candidateIds = optionalStringArray(
    input.rule_candidate_ids ?? input.ruleCandidateIds,
    "rule_candidate_ids",
  );
  const candidates = candidateIds.length
    ? await Promise.all(candidateIds.map((id) => (
      readJson(ruleCandidatePaths(assertId(id, ruleCandidateIdPattern, "rule_candidate_id"), roots).data)
    )))
    : (await listArtifacts(
      roots.ruleCandidates,
      ruleCandidateIdPattern,
      "candidate.json",
    )).filter((candidate) => ["draft", "ready_for_proposal"].includes(candidate.status));
  const bundleId = createId("feedback_context_bundle");
  const paths = contextBundlePaths(bundleId, roots);
  const metadata = {
    context_bundle_id: bundleId,
    created_at: new Date().toISOString(),
    scope: optionalText(input.scope, "scope", 5_000)
      || "Feedback learning context for writing and proofing.",
    source_feedback_ids: items.map((item) => item.feedback_id),
    source_rule_candidate_ids: candidates.map((candidate) => candidate.rule_candidate_id),
    for_external_gpt: true,
    local_generation_allowed: false,
    safety: {
      context_only: true,
      modifies_compressed_rules: false,
      modifies_active_engine: false,
      applies_rules: false,
    },
    paths: {
      context: normalizeProjectPath(paths.context),
      metadata: normalizeProjectPath(paths.metadata),
    },
  };
  await commitFileTransaction("build-feedback-context-bundle", [
    { filePath: paths.metadata, content: json(metadata) },
    { filePath: paths.context, content: contextMarkdown(metadata, items, candidates) },
  ], {
    context_bundle_id: bundleId,
    phase: "phase_10a_feedback_learning",
  });
  return {
    metadata,
    context_path: normalizeProjectPath(paths.context),
    metadata_path: normalizeProjectPath(paths.metadata),
  };
}

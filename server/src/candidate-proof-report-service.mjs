import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  getWritingCandidateDetail,
  resolveWritingCandidatePaths,
} from "./chat-output-candidate-service.mjs";
import { getCandidateProofingContext } from "./candidate-proofing-context-service.mjs";
import { commitFileTransaction } from "./file-transactions.mjs";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
} from "./project-paths.mjs";
import {
  characterVoiceGuardMetadata,
  evaluateCharacterVoiceDrift,
} from "./character-voice-drift-guard-service.mjs";

const proofReportIdPattern = /^proof_report_\d{8}-\d{6}-[a-f0-9]{8}$/u;
const verdicts = new Set(["pass", "needs_revision", "blocked"]);
const severities = new Set(["P0", "P1", "P2", "P3", "none"]);
const sources = new Set(["chatgpt", "gpt", "manual_paste"]);
const proofReportMaxLength = 200_000;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stamp(date = new Date()) {
  const compact = date.toISOString().replace(/\D/gu, "").slice(0, 14);
  return `${compact.slice(0, 8)}-${compact.slice(8)}`;
}

function createProofReportId() {
  return `proof_report_${stamp()}-${randomBytes(4).toString("hex")}`;
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters.`);
  return text;
}

function optionalInteger(value, fallback, label, maximum) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function normalizeInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const verdict = optionalText(input.verdict, "verdict", 100) || "needs_revision";
  const severity = optionalText(input.severity, "severity", 100) || "none";
  const source = optionalText(input.source, "source", 100) || "chatgpt";
  if (!verdicts.has(verdict)) throw new Error(`Unknown verdict: ${verdict}`);
  if (!severities.has(severity)) throw new Error(`Unknown severity: ${severity}`);
  if (!sources.has(source)) throw new Error(`Unknown source: ${source}`);
  return {
    candidateId: requiredText(input.candidate_id ?? input.candidateId, "candidate_id", 200),
    proofingContextId: optionalText(
      input.proofing_context_id ?? input.proofingContextId,
      "proofing_context_id",
      200,
    ),
    proofReportText: requiredText(
      input.proof_report_text ?? input.proofReportText,
      "proof_report_text",
      proofReportMaxLength,
    ),
    verdict,
    severity,
    summary: optionalText(input.summary, "summary", 10_000),
    notes: optionalText(input.notes, "notes", 10_000),
    source,
    dryRun: input.dry_run === true || input.dryRun === true,
  };
}

function rootsFor(options = {}) {
  const proofReports = options.proofReports
    ? assertPathInside(options.proofReports, projectPaths.outputs, "proof reports test root")
    : projectPaths.proofReports;
  return { proofReports };
}

function proofReportPaths(proofReportId, roots) {
  if (!proofReportIdPattern.test(String(proofReportId ?? ""))) {
    throw new Error("Invalid proof_report_id.");
  }
  const directory = path.join(roots.proofReports, proofReportId);
  return {
    directory,
    report: path.join(directory, "proof_report.md"),
    metadata: path.join(directory, "proof_report.json"),
  };
}

function publicResult(metadata) {
  return {
    proof_report_id: metadata.proof_report_id,
    candidate_id: metadata.candidate_id,
    proofing_context_id: metadata.proofing_context_id,
    proof_report_path: metadata.proof_report_path,
    proof_report_meta_path: metadata.metadata_path,
    proof_report_hash: metadata.proof_report_hash,
    verdict: metadata.verdict,
    severity: metadata.severity,
    canon_status: metadata.canon_status,
    adopted: metadata.adopted,
    settled: metadata.settled,
    character_voice_guard_used: metadata.character_voice_guard_used,
    character_voice_registry_loaded: metadata.character_voice_registry_loaded,
    character_voice_registry_hash_sha256:
      metadata.character_voice_registry_hash_sha256,
    character_voice_registry_source_type:
      metadata.character_voice_registry_source_type,
    character_voice_registry_authority:
      metadata.character_voice_registry_authority,
    character_voice_guard_verdict: metadata.character_voice_guard_verdict,
    character_voice_guard_severity: metadata.character_voice_guard_severity,
    character_voice_guard_findings_count:
      metadata.character_voice_guard_findings_count,
  };
}

export async function saveChatOutputAsProofReport(rawInput, options = {}) {
  const input = normalizeInput(rawInput);
  const candidate = await getWritingCandidateDetail(input.candidateId, options);
  if (input.proofingContextId) {
    const proofingContext = await getCandidateProofingContext(input.proofingContextId, options);
    if (proofingContext.context.candidate_id !== input.candidateId) {
      throw new Error("proofing_context_id does not belong to candidate_id.");
    }
  }
  const reportHash = sha256(input.proofReportText);
  const candidatePaths = resolveWritingCandidatePaths(input.candidateId, options);
  const candidateText = await readFile(candidatePaths.content, "utf8");
  const characterVoiceGuard = candidate.metadata.character_voice_guard
    ?? await evaluateCharacterVoiceDrift({ candidate_text: candidateText }, options);
  const characterVoiceMetadata = characterVoiceGuardMetadata(characterVoiceGuard);
  if (input.dryRun) {
    return {
      dry_run: true,
      proof_report_created: false,
      candidate_id: input.candidateId,
      proofing_context_id: input.proofingContextId,
      proof_report_hash: reportHash,
      verdict: input.verdict,
      severity: input.severity,
      canon_status: "candidate_only",
      adopted: false,
      settled: false,
      ...characterVoiceMetadata,
    };
  }

  const roots = rootsFor(options);
  await mkdir(roots.proofReports, { recursive: true });
  const proofReportId = createProofReportId();
  const paths = proofReportPaths(proofReportId, roots);
  const existingReportIds = Array.isArray(candidate.metadata.proof_report_ids)
    ? candidate.metadata.proof_report_ids.filter((value) => typeof value === "string")
    : [];
  const metadata = {
    proof_report_id: proofReportId,
    report_kind: "chat_output_candidate_proof_report",
    created_at: new Date().toISOString(),
    source: input.source,
    candidate_id: input.candidateId,
    candidate_hash: candidate.metadata.candidate_hash,
    proofing_context_id: input.proofingContextId,
    verdict: input.verdict,
    severity: input.severity,
    summary: input.summary,
    notes: input.notes,
    proof_report_hash: reportHash,
    proof_report_chars: input.proofReportText.length,
    canon_status: "candidate_only",
    adopted: false,
    settled: false,
    approval_item_created: false,
    local_generation_used: false,
    active_engine_update_allowed: false,
    canon_update_allowed: false,
    adoption_allowed_without_approval: false,
    settlement_allowed_without_adoption: false,
    ...characterVoiceMetadata,
    proof_report_path: normalizeProjectPath(paths.report),
    metadata_path: normalizeProjectPath(paths.metadata),
  };
  const updatedCandidate = {
    ...candidate.metadata,
    canon_status: "candidate_only",
    adopted: false,
    settled: false,
    proofed: true,
    latest_proof_report_id: proofReportId,
    proof_report_ids: [...existingReportIds, proofReportId],
    latest_proof_verdict: input.verdict,
    latest_proof_severity: input.severity,
    active_engine_update_allowed: false,
    canon_update_allowed: false,
    adoption_allowed_without_approval: false,
    settlement_allowed_without_adoption: false,
    ...characterVoiceMetadata,
  };
  await commitFileTransaction("save-chat-output-proof-report", [
    { filePath: paths.report, content: `${input.proofReportText}\n` },
    { filePath: paths.metadata, content: `${JSON.stringify(metadata, null, 2)}\n` },
    {
      filePath: candidatePaths.metadata,
      content: `${JSON.stringify(updatedCandidate, null, 2)}\n`,
    },
  ], {
    proof_report_id: proofReportId,
    candidate_id: input.candidateId,
    phase: "phase_8d_writing_candidate_proofing",
  });
  return {
    ...publicResult(metadata),
    proof_report_created: true,
  };
}

export async function getProofReportDetail(proofReportId, options = {}) {
  const roots = rootsFor(options);
  const paths = proofReportPaths(proofReportId, roots);
  const [metadata, proofReportText] = await Promise.all([
    readFile(paths.metadata, "utf8").then(JSON.parse),
    readFile(paths.report, "utf8"),
  ]);
  return {
    metadata,
    proof_report_text: proofReportText,
    proof_report_path: normalizeProjectPath(paths.report),
    proof_report_meta_path: normalizeProjectPath(paths.metadata),
  };
}

export async function listProofReports(input = {}, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("input must be an object.");
  }
  const limit = optionalInteger(input.limit, 20, "limit", 100);
  const candidateId = optionalText(
    input.candidate_id ?? input.candidateId,
    "candidate_id",
    200,
  );
  const verdict = optionalText(input.verdict, "verdict", 100);
  const severity = optionalText(input.severity, "severity", 100);
  if (verdict && !verdicts.has(verdict)) throw new Error(`Unknown verdict: ${verdict}`);
  if (severity && !severities.has(severity)) throw new Error(`Unknown severity: ${severity}`);
  const roots = rootsFor(options);
  await mkdir(roots.proofReports, { recursive: true });
  const entries = await readdir(roots.proofReports, { withFileTypes: true });
  const reports = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !proofReportIdPattern.test(entry.name)) continue;
    try {
      const record = await getProofReportDetail(entry.name, options);
      const metadata = record.metadata;
      if (candidateId && metadata.candidate_id !== candidateId) continue;
      if (verdict && metadata.verdict !== verdict) continue;
      if (severity && metadata.severity !== severity) continue;
      reports.push({
        proof_report_id: metadata.proof_report_id,
        created_at: metadata.created_at,
        candidate_id: metadata.candidate_id,
        proofing_context_id: metadata.proofing_context_id,
        verdict: metadata.verdict,
        severity: metadata.severity,
        summary: metadata.summary,
        proof_report_path: metadata.proof_report_path,
        canon_status: metadata.canon_status,
      });
    } catch {
      // Ignore incomplete proof report records.
    }
  }
  return reports
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
    .slice(0, limit);
}

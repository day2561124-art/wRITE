import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertPathInside,
  normalizeProjectPath,
  projectPaths,
  projectRoot,
} from "./project-paths.mjs";

export const medicalStatusSchemaVersion = 1;
export const medicalStateTokens = Object.freeze([
  "unknown",
  "not_recorded",
  "not_applicable",
  "deferred",
  "cleared",
]);
export const requiredMedicalStatusFields = Object.freeze([
  "injury_history",
  "current_physical_status",
  "current_spiritual_status",
  "injury_class",
  "affected_body_parts",
  "severity",
  "treatment_completed",
  "treatment_method",
  "active_restrictions",
  "follow_up_required",
  "follow_up_result",
  "daily_activity_clearance",
  "training_clearance",
  "competition_clearance",
  "weapon_summon_clearance",
  "weapon_control_impact",
  "expected_recovery_window",
  "special_interference",
  "exception_reason",
  "status_as_of_chapter",
  "last_confirmed_evidence",
  "resolved_at",
  "resolution_basis",
]);

const defaultConfigPath = path.join(projectRoot, "config", "medical-continuity.json");
const clearanceFields = Object.freeze([
  "daily_activity_clearance",
  "low_load_training_clearance",
  "training_clearance",
  "competition_clearance",
  "weapon_summon_clearance",
  "high_load_manifestation_clearance",
]);
const shortTermExpiryKinds = new Set([
  "same_day",
  "next_day",
  "short_term",
  "recovery_window",
]);

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const structuredHourKeys = new Set([
  "elapsedhours",
  "timejumphours",
  "storytimeoffsethours",
  "hourssincestatus",
  "hourssinceinjury",
  "hoursafterpreviouschapter",
]);
const structuredDayKeys = new Set([
  "elapseddays",
  "timejumpdays",
  "storytimeoffsetdays",
  "dayssincestatus",
  "dayssinceinjury",
  "daysafterpreviouschapter",
]);
const structuredWeekKeys = new Set([
  "elapsedweeks",
  "timejumpweeks",
  "storytimeoffsetweeks",
  "weekssincestatus",
  "weekssinceinjury",
  "weeksafterpreviouschapter",
]);

function normalizedTemporalKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/gu, "");
}

function finiteNonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function chineseInteger(value) {
  const source = String(value ?? "").trim();
  if (!source) return null;
  if (/^\d+(?:\.\d+)?$/u.test(source)) return Number(source);

  const digitMap = new Map([
    ["〇", 0],
    ["零", 0],
    ["一", 1],
    ["二", 2],
    ["兩", 2],
    ["三", 3],
    ["四", 4],
    ["五", 5],
    ["六", 6],
    ["七", 7],
    ["八", 8],
    ["九", 9],
  ]);
  const unitMap = new Map([
    ["十", 10],
    ["百", 100],
    ["千", 1000],
  ]);
  if ([...source].every((character) => digitMap.has(character))) {
    return Number([...source].map((character) => digitMap.get(character)).join(""));
  }

  let total = 0;
  let current = 0;
  for (const character of source) {
    if (digitMap.has(character)) {
      current = digitMap.get(character);
      continue;
    }
    const unit = unitMap.get(character);
    if (!unit) return null;
    total += (current || 1) * unit;
    current = 0;
  }
  return total + current;
}

function explicitRelativeHours(text) {
  const source = String(text ?? "");
  const matches = [];
  const zhPattern =
    /([0-9]+(?:\.[0-9]+)?|[〇零一二兩三四五六七八九十百千]+)\s*(小時|時|天|日|週|周)\s*(?:後|之後|以後|過後)/gu;
  const enPattern =
    /(?:after\s+)?([0-9]+(?:\.[0-9]+)?)\s*(hours?|days?|weeks?)\s*(?:later|after)?/giu;

  for (const match of source.matchAll(zhPattern)) {
    const amount = chineseInteger(match[1]);
    if (!Number.isFinite(amount)) continue;
    const multiplier = /週|周/u.test(match[2])
      ? 24 * 7
      : /天|日/u.test(match[2])
        ? 24
        : 1;
    matches.push({
      elapsedHours: amount * multiplier,
      evidence: match[0],
      source: "task_prompt_explicit_relative_time",
    });
  }
  for (const match of source.matchAll(enPattern)) {
    if (!/(?:later|after)/iu.test(match[0])) continue;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    const multiplier = /^weeks?/iu.test(match[2])
      ? 24 * 7
      : /^days?/iu.test(match[2])
        ? 24
        : 1;
    matches.push({
      elapsedHours: amount * multiplier,
      evidence: match[0],
      source: "task_prompt_explicit_relative_time",
    });
  }
  return matches.at(-1) ?? null;
}

function structuredTemporalOffset(value, depth = 0, seen = new Set()) {
  if (!value || typeof value !== "object" || depth > 6 || seen.has(value)) return null;
  seen.add(value);
  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = normalizedTemporalKey(key);
    const numeric = finiteNonNegativeNumber(item);
    if (numeric !== null) {
      if (structuredHourKeys.has(normalizedKey)) {
        return {
          elapsedHours: numeric,
          evidence: `${key}=${numeric}`,
          source: "structured_temporal_context",
          anchorScope: /sinceinjury|sincestatus/u.test(normalizedKey)
            ? "status_or_injury"
            : "latest_settled_continuity",
        };
      }
      if (structuredDayKeys.has(normalizedKey)) {
        return {
          elapsedHours: numeric * 24,
          evidence: `${key}=${numeric}`,
          source: "structured_temporal_context",
          anchorScope: /sinceinjury|sincestatus/u.test(normalizedKey)
            ? "status_or_injury"
            : "latest_settled_continuity",
        };
      }
      if (structuredWeekKeys.has(normalizedKey)) {
        return {
          elapsedHours: numeric * 24 * 7,
          evidence: `${key}=${numeric}`,
          source: "structured_temporal_context",
          anchorScope: /sinceinjury|sincestatus/u.test(normalizedKey)
            ? "status_or_injury"
            : "latest_settled_continuity",
        };
      }
    }
    const nested = structuredTemporalOffset(item, depth + 1, seen);
    if (nested) return nested;
  }
  return null;
}

function chapterReferences(value) {
  const output = [];
  for (const match of String(value ?? "").matchAll(
    /第([0-9]+|[〇零一二兩三四五六七八九十百千]+)章/gu,
  )) {
    const number = chineseInteger(match[1]);
    if (!Number.isFinite(number)) continue;
    output.push({
      number,
      label: match[0],
    });
  }
  return output;
}

function latestContinuityChapterNumber(latestContinuity = {}) {
  const direct = finiteNonNegativeNumber(latestContinuity.chapter_number);
  if (direct !== null) return direct;
  return chapterReferences([
    latestContinuity.chapter,
    latestContinuity.display_heading,
    latestContinuity.continuity_head,
  ].filter(Boolean).join("\n")).at(-1)?.number ?? null;
}

export function deriveMedicalTemporalContext({
  taskPrompt = "",
  generationContext = {},
  retrievalContext = {},
  latestContinuity = {},
} = {}) {
  const structured = structuredTemporalOffset(generationContext)
    ?? structuredTemporalOffset(retrievalContext);
  const explicit = explicitRelativeHours(taskPrompt);
  const selected = structured ?? (
    latestContinuity?.loaded === true ? explicit : null
  );
  const chapterRefs = chapterReferences(taskPrompt);
  const requestedChapter = chapterRefs.length
    ? chapterRefs.reduce((highest, current) => (
      current.number > highest.number ? current : highest
    ))
    : null;
  const latestChapterNumber = latestContinuityChapterNumber(latestContinuity);

  if (!selected) {
    return {
      timeAnchorAvailable: false,
      elapsedHours: null,
      elapsedHoursLowerBound: false,
      anchorScope: "not_recorded",
      anchorSource: "not_recorded",
      anchorEvidence: null,
      latestContinuityChapterNumber: latestChapterNumber,
      asOfChapter: requestedChapter?.label ?? null,
      evaluatedAtStoryTime: "not_recorded",
    };
  }

  const anchorScope = selected.anchorScope
    ?? "latest_settled_continuity";
  return {
    timeAnchorAvailable: true,
    elapsedHours: selected.elapsedHours,
    elapsedHoursLowerBound:
      anchorScope === "latest_settled_continuity",
    anchorScope,
    anchorSource: selected.source,
    anchorEvidence: selected.evidence,
    latestContinuityChapterNumber: latestChapterNumber,
    asOfChapter: requestedChapter?.label
      ?? latestContinuity.display_heading
      ?? latestContinuity.chapter
      ?? null,
    evaluatedAtStoryTime:
      `${selected.elapsedHours}h_after_${anchorScope}`,
  };
}

function statusChapterNumber(status) {
  return chapterReferences(status?.status_as_of_chapter).at(-1)?.number ?? null;
}

function temporalContextForStatus(status, context = {}) {
  if (context?.timeAnchorAvailable !== true) return context;
  if (context.anchorScope !== "latest_settled_continuity") return context;

  const latestChapterNumber = finiteNonNegativeNumber(
    context.latestContinuityChapterNumber,
  );
  const statusAsOfChapterNumber = statusChapterNumber(status);
  if (
    latestChapterNumber === null
    || statusAsOfChapterNumber === null
    || statusAsOfChapterNumber > latestChapterNumber
  ) {
    return {
      ...context,
      timeAnchorAvailable: false,
      elapsedHours: null,
      temporalApplicability: "status_chapter_order_not_proven",
    };
  }

  return {
    ...context,
    temporalApplicability:
      "status_at_or_before_latest_settled_continuity",
  };
}

function recoveryClassForRecord(record, policy) {
  const available = Object.keys(policy.recovery_windows ?? {});
  const explicitCandidates = [
    record.injury_class,
    record.expected_recovery_window,
    ...(record.injury_history ?? []).map((item) => item?.injury_class),
  ].map((item) => String(item ?? "").trim()).filter(Boolean);

  for (const candidate of explicitCandidates) {
    if (available.includes(candidate)) return candidate;
  }

  const embedded = available.filter((recoveryClass) => (
    explicitCandidates.some((candidate) => candidate.includes(recoveryClass))
  ));
  if (!embedded.length) return null;
  return embedded.sort((left, right) => {
    const leftWindow = policy.recovery_windows[left];
    const rightWindow = policy.recovery_windows[right];
    return rightWindow.daily_activity_hours_max - leftWindow.daily_activity_hours_max
      || rightWindow.high_load_hours_max - leftWindow.high_load_hours_max
      || left.localeCompare(right);
  })[0];
}

function recordHasExcludedClass(record, policy) {
  const classes = [
    record.injury_class,
    record.expected_recovery_window,
    record.special_interference,
    record.exception_reason,
    ...(record.injury_history ?? []).flatMap((item) => [
      item?.injury_class,
      item?.special_interference,
      item?.exception_reason,
    ]),
  ].map((item) => String(item ?? "").trim()).filter(Boolean);
  return classes.some((candidate) => (
    policy.excluded_from_ordinary_cleanup.some((excludedClass) => (
      candidate === excludedClass || candidate.includes(excludedClass)
    ))
  ));
}

function configPathFor(options = {}) {
  return options.medicalContinuityConfig
    ? assertPathInside(
      options.medicalContinuityConfig,
      path.join(projectRoot, "config"),
      "medical continuity config",
    )
    : defaultConfigPath;
}

function activeEnginePathFor(options = {}) {
  return options.activeEnginePath
    ? assertPathInside(
      options.activeEnginePath,
      projectPaths.canonDb,
      "medical continuity active engine",
    )
    : projectPaths.activeEngine;
}

function lineContaining(text, match) {
  if (!match) return "";
  return String(text ?? "")
    .split(/\r?\n/u)
    .find((line) => line.includes(match))
    ?.trim() ?? "";
}

function normalizeRestriction(restriction) {
  if (typeof restriction === "string") {
    return {
      restriction_id: `RESTRICTION-${sha256(restriction).slice(0, 12).toUpperCase()}`,
      scope: restriction,
      status: "active",
      expiry_kind: "not_recorded",
    };
  }
  if (!isObject(restriction)) return null;
  const scope = String(restriction.scope ?? restriction.description ?? "").trim();
  if (!scope) return null;
  return {
    ...restriction,
    restriction_id: String(
      restriction.restriction_id
        ?? restriction.id
        ?? `RESTRICTION-${sha256(scope).slice(0, 12).toUpperCase()}`,
    ),
    scope,
    status: String(restriction.status ?? "active"),
    expiry_kind: String(restriction.expiry_kind ?? "not_recorded"),
  };
}

export function validateMedicalContinuityConfig(config) {
  const errors = [];
  if (config?.schema_version !== medicalStatusSchemaVersion) {
    errors.push(`schema_version must be ${medicalStatusSchemaVersion}.`);
  }
  if (!isObject(config?.recovery_policy)) errors.push("recovery_policy must be an object.");
  if (!Array.isArray(config?.character_statuses)) {
    errors.push("character_statuses must be an array.");
    return errors;
  }
  const policy = config.recovery_policy ?? {};
  for (const field of [
    "care_systems",
    "capabilities",
    "treatment_costs",
    "ordinary_injury_classes",
    "excluded_from_ordinary_cleanup",
    "extension_reasons",
    "clearance_axes",
    "clearance_values",
    "preserved_consequences",
  ]) {
    if (!Array.isArray(policy[field]) || policy[field].length === 0) {
      errors.push(`recovery_policy.${field} must be a non-empty array.`);
    }
  }
  if (!isObject(policy.recovery_windows)) {
    errors.push("recovery_policy.recovery_windows must be an object.");
  }
  for (const [injuryClass, window] of Object.entries(policy.recovery_windows ?? {})) {
    if (!Number.isFinite(window.daily_activity_hours_max) || window.daily_activity_hours_max <= 0) {
      errors.push(`${injuryClass}.daily_activity_hours_max must be positive.`);
    }
    if (!Number.isFinite(window.high_load_hours_max) || window.high_load_hours_max <= 0) {
      errors.push(`${injuryClass}.high_load_hours_max must be positive.`);
    }
  }
  const ids = new Set();
  for (const status of config.character_statuses) {
    if (!isObject(status)) {
      errors.push("character_statuses entries must be objects.");
      continue;
    }
    if (!String(status.status_id ?? "").trim()) errors.push("status_id is required.");
    if (ids.has(status.status_id)) errors.push(`duplicate status_id: ${status.status_id}.`);
    ids.add(status.status_id);
    if (!String(status.character ?? "").trim()) errors.push(`${status.status_id} character is required.`);
    for (const field of requiredMedicalStatusFields) {
      if (!(field in status)) errors.push(`${status.status_id} missing ${field}.`);
    }
    if (!Array.isArray(status.injury_history)) {
      errors.push(`${status.status_id} injury_history must be an array.`);
    }
    if (!Array.isArray(status.active_restrictions)) {
      errors.push(`${status.status_id} active_restrictions must be an array.`);
    }
    if (!Array.isArray(status.last_confirmed_evidence)) {
      errors.push(`${status.status_id} last_confirmed_evidence must be an array.`);
    }
    for (const field of clearanceFields) {
      if (!(field in status)) errors.push(`${status.status_id} missing ${field}.`);
      const value = status[field];
      if (!medicalStateTokens.includes(value)) {
        errors.push(`${status.status_id} ${field} has unsupported value ${value}.`);
      }
    }
  }
  return errors;
}

export async function loadMedicalContinuityConfig(options = {}) {
  const filePath = configPathFor(options);
  const content = await readFile(filePath, "utf8");
  const config = JSON.parse(content);
  const validationErrors = validateMedicalContinuityConfig(config);
  if (validationErrors.length) {
    throw new Error(`Invalid medical continuity config: ${validationErrors.join(" ")}`);
  }
  return {
    config,
    path: normalizeProjectPath(filePath),
    sha256: sha256(content),
  };
}

function hasActiveExtension(record, policy, overlay) {
  const exceptionReasons = unique([
    ...(Array.isArray(record.exception_reasons) ? record.exception_reasons : []),
    record.exception_reason,
    ...(Array.isArray(overlay?.exception_reasons) ? overlay.exception_reasons : []),
  ]);
  return exceptionReasons.some((reason) => (
    policy.extension_reasons.includes(reason)
    || policy.excluded_from_ordinary_cleanup.includes(reason)
  ));
}

function overlayIsExpired(overlay, context) {
  if (!overlay) return false;
  if (overlay.expired === true) return true;
  if (!overlay.expires_at || !context.asOfTime) return false;
  const expiresAt = Date.parse(overlay.expires_at);
  const asOfTime = Date.parse(context.asOfTime);
  return Number.isFinite(expiresAt) && Number.isFinite(asOfTime) && expiresAt <= asOfTime;
}

export function resolveInjuryStatus(rawRecord, context = {}, recoveryPolicy) {
  if (!isObject(rawRecord)) throw new Error("injury record must be an object.");
  if (!isObject(recoveryPolicy)) throw new Error("recovery policy is required.");
  const record = clone(rawRecord);
  record.injury_history = Array.isArray(record.injury_history)
    ? record.injury_history
    : [clone(rawRecord)];
  record.active_restrictions = (record.active_restrictions ?? [])
    .map(normalizeRestriction)
    .filter((item) => item?.status === "active");
  const injuryClass = String(record.injury_class ?? "");
  const recoveryClass = recoveryClassForRecord(record, recoveryPolicy);
  const ordinary = Boolean(recoveryClass);
  const excluded = recordHasExcludedClass(record, recoveryPolicy);
  const overlay = isObject(context.continuityOverlay) ? context.continuityOverlay : null;
  const validOverlay = overlay && !overlayIsExpired(overlay, context) ? overlay : null;
  const extensionActive = hasActiveExtension(record, recoveryPolicy, validOverlay);

  if (validOverlay?.explicitly_active === true) {
    record.current_physical_status = validOverlay.current_physical_status
      ?? record.current_physical_status
      ?? "treated_recovery_status_not_recorded";
    record.active_restrictions = [
      ...record.active_restrictions,
      ...(validOverlay.active_restrictions ?? []).map(normalizeRestriction).filter(Boolean),
    ];
    record.active_restrictions = Object.values(Object.fromEntries(
      record.active_restrictions.map((item) => [item.restriction_id, item]),
    ));
    record.exception_reason = "active_continuity_overlay";
    record.resolution_basis = "latest_continuity_overlay_precedence";
    return record;
  }

  if (!ordinary || excluded || extensionActive || record.treatment_completed !== true) {
    record.resolution_basis = record.resolution_basis
      ?? (excluded ? "excluded_from_ordinary_cleanup" : "cleanup_conditions_not_met");
    return record;
  }

  const window = recoveryPolicy.recovery_windows[recoveryClass];
  if (!window) return record;
  record.resolved_recovery_class = recoveryClass;
  const timeAnchorAvailable = context.timeAnchorAvailable === true
    && Number.isFinite(context.elapsedHours);
  if (!timeAnchorAvailable) {
    record.current_physical_status = "treated_recovery_status_not_recorded";
    record.exception_reason = "recovery_time_anchor_missing";
    record.resolved_at = "not_recorded";
    record.resolution_basis = "recovery_time_anchor_missing";
    return record;
  }

  if (context.elapsedHours < window.daily_activity_hours_max) {
    record.current_physical_status = record.current_physical_status
      ?? "treated_recovering";
    return record;
  }

  record.current_physical_status = "recovered_stable";
  record.active_restrictions = record.active_restrictions.filter(
    (restriction) => !shortTermExpiryKinds.has(restriction.expiry_kind),
  );
  record.daily_activity_clearance = "cleared";
  record.resolved_at = context.asOfChapter ?? "resolved_by_elapsed_time_anchor";
  record.resolution_basis = "ordinary_recovery_window_elapsed_without_extension_evidence";
  record.exception_reason = record.exception_reason === "recovery_time_anchor_missing"
    ? "none_confirmed"
    : record.exception_reason;
  record.competition_clearance = rawRecord.competition_clearance ?? "not_recorded";
  record.evaluated_at_story_time = context.evaluatedAtStoryTime
    ?? context.asOfTime
    ?? context.asOfChapter
    ?? "elapsed_time_anchor";
  return record;
}

function resolveEvidence(status, activeEngineText) {
  const resolved = [];
  const missing = [];
  for (const evidence of status.last_confirmed_evidence ?? []) {
    const sourceFile = String(evidence.source_file ?? "");
    const matchedLine = sourceFile === "data/canon_db/active_engine.md"
      ? lineContaining(activeEngineText, evidence.match)
      : "";
    if (matchedLine) {
      resolved.push({
        ...evidence,
        matched_line: matchedLine,
        evidence_status: "confirmed",
      });
    } else {
      missing.push({
        ...evidence,
        evidence_status: "not_recorded",
      });
    }
  }
  return { resolved, missing };
}

export async function buildMedicalContinuitySnapshot(options = {}) {
  const [{ config, path: configPath, sha256: configHash }, activeEngineText] = await Promise.all([
    loadMedicalContinuityConfig(options),
    options.activeEngineText !== undefined
      ? String(options.activeEngineText)
      : readFile(activeEnginePathFor(options), "utf8"),
  ]);
  const temporalContext = isObject(options.temporalContext)
    ? clone(options.temporalContext)
    : null;
  const statuses = config.character_statuses.map((status) => {
    const statusContext = temporalContext
      ? temporalContextForStatus(status, temporalContext)
      : null;
    const evidence = resolveEvidence(status, activeEngineText);
    const shouldResolve = statusContext?.timeAnchorAvailable === true
      || isObject(statusContext?.continuityOverlay);
    const normalized = shouldResolve
      ? resolveInjuryStatus(status, statusContext, config.recovery_policy)
      : clone(status);
    normalized.active_restrictions = normalized.active_restrictions
      .map(normalizeRestriction)
      .filter(Boolean);
    normalized.evidence = evidence.resolved;
    normalized.missing_evidence = evidence.missing;
    normalized.evidence_complete = evidence.missing.length === 0;
    normalized.state_model_version = "medical-continuity-v1";
    normalized.injury_history_retained = true;
    normalized.active_restrictions_current_only = true;
    normalized.clearance_independent = true;
    normalized.temporal_resolution = statusContext
      ? {
        time_anchor_available: statusContext.timeAnchorAvailable === true,
        elapsed_hours: statusContext.elapsedHours ?? null,
        elapsed_hours_lower_bound:
          statusContext.elapsedHoursLowerBound === true,
        anchor_scope: statusContext.anchorScope ?? "not_recorded",
        anchor_source: statusContext.anchorSource ?? "not_recorded",
        anchor_evidence: statusContext.anchorEvidence ?? null,
        applicability:
          statusContext.temporalApplicability ?? "not_evaluated",
        evaluated_at_story_time:
          statusContext.evaluatedAtStoryTime ?? "not_recorded",
      }
      : null;
    return normalized;
  });
  return {
    schema_version: medicalStatusSchemaVersion,
    policy_id: config.policy_id,
    source_authority: config.source_authority,
    recovery_policy: clone(config.recovery_policy),
    character_statuses: statuses,
    temporal_context: temporalContext,
    provenance: {
      config_path: configPath,
      config_hash_sha256: configHash,
      active_engine_path: normalizeProjectPath(activeEnginePathFor(options)),
      active_engine_hash_sha256: sha256(activeEngineText),
      direct_canon_write_allowed: false,
      candidate_review_required: true,
    },
    warnings: statuses.flatMap((status) => (
      status.missing_evidence.map((evidence) => (
        `${status.character}: formal evidence not found for ${evidence.match}`
      ))
    )),
  };
}

export function medicalStatusSummary(status) {
  const restrictions = status.active_restrictions?.length
    ? status.active_restrictions.map((item) => item.scope).join("；")
    : "無目前有效的普通短期限制";
  const history = status.injury_history?.length
    ? status.injury_history.map((item) => (
      `- ${item.event_id}｜${item.chapter}｜${item.injury_class}`
      + `｜${(item.affected_body_parts ?? []).join("、") || "部位未記錄"}`
      + (
        item.historical_restrictions?.length
          ? `｜過去限制（已失效）：${item.historical_restrictions.join("、")}`
          : ""
      )
      + `｜${item.history_status ?? "history_recorded"}`
    ))
    : ["- 無已記錄傷勢歷史"];
  const evidence = status.evidence?.length
    ? status.evidence.map((item) => `- ${item.match}`)
    : ["- 無可核對的 active engine 證據行"];
  return [
    `角色：${status.character}`,
    `當前肉體狀態：${status.current_physical_status}`,
    `當前靈力狀態：${status.current_spiritual_status}`,
    `目前有效限制：${restrictions}`,
    `日常活動許可：${status.daily_activity_clearance}`,
    `低負荷訓練許可：${status.low_load_training_clearance}`,
    `正式訓練許可：${status.training_clearance}`,
    `競技許可：${status.competition_clearance}`,
    `武裝召喚許可：${status.weapon_summon_clearance}`,
    `高負荷／本體顯現許可：${status.high_load_manifestation_clearance}`,
    `未解例外：${status.exception_reason}`,
    `狀態截至：${status.status_as_of_chapter}`,
    `傷勢歷史筆數：${status.injury_history.length}`,
    "傷勢歷史（只作歷史證據，不等於當前限制）：",
    ...history,
    "已核對正式證據：",
    ...evidence,
  ].join("\n");
}

function stateToken(value) {
  return medicalStateTokens.includes(value) ? `\`${value}\`` : String(value);
}

function policyMarkdown(policy) {
  const windowRows = Object.entries(policy.recovery_windows).map(([id, window]) => (
    `| \`${id}\` | ${window.label} | 日常上限 ${window.daily_activity_hours_max} 小時；高負荷 ${window.high_load_hours_min}～${window.high_load_hours_max} 小時 | ${window.requires_follow_up_for_high_load ? "高負荷需複查" : "依現場監測"} |`
  ));
  return [
    "#### 2.2.3 高科技靈力醫療、治療型武裝與傷勢正規化",
    "",
    "本世界之醫療由高科技生體醫療、靈力醫療與治療型異能武裝協作。三者可顯著縮短普通傷勢恢復時間，但不是無條件瞬間治癒，也不得抹除靈力消耗、精神後座、競技結果、資格影響或本源損傷。",
    "",
    "##### 可用醫療能力",
    "",
    ...policy.capabilities.map((item) => `- ${item}`),
    "",
    "##### 修復成本與不能抹除的後果",
    "",
    `- 修復仍可能消耗：${policy.treatment_costs.join("、")}。`,
    `- 肉體修復後仍保留：${policy.preserved_consequences.join("、")}。`,
    "- 傷口完成治療、當前肉體狀態、日常活動、低負荷訓練、正式訓練、競技、武裝召喚與高負荷／本體顯現許可，均為獨立欄位。",
    "- 肉體恢復不得自動核發競技許可；競技許可尚無正式紀錄，也不得反推角色仍然肉體受傷。",
    "",
    "##### 普通傷勢預設恢復區間",
    "",
    "| 傷勢類別 | 敘事預設 | 可供 resolver 使用的窗口 | 高負荷邊界 |",
    "|---|---|---|---|",
    ...windowRows,
    "",
    "以上是 continuity 判斷預設，不是強制倒數計時器。治療受阻、反覆受傷、持續使用能力、靈力逆流、未知污染、武裝共鳴異常、神經／本源損傷、治療完成結果遭能力阻斷或正式 Canon 指定長期影響時，必須延長或停止普通清理。",
    "",
    "##### 普通傷勢清理與例外",
    "",
    "- 普通傷勢已治療、時間錨點足以跨過合理窗口且無延長證據時，只清除目前有效的短期限制；injury history 永久保留。",
    "- 找不到實際時間錨點時，不以章號差換算天數，不虛構精確恢復日期；只記錄已治療、恢復狀態尚無正式紀錄，且不得誤寫成仍重傷。",
    `- ordinary cleanup 不處理：${policy.excluded_from_ordinary_cleanup.map((item) => `\`${item}\``).join("、")}。`,
    "- 最新 continuity overlay 高於較舊 active engine 細節；但已有失效時間的當日／短期 overlay 不得永久凍結傷勢。",
    "- 「醫療後座仍有效」必須拆成歷史／後果仍有效，或目前限制仍有效，不得以同一句話混用。",
    "",
    "##### 狀態值",
    "",
    `- ${policy.clearance_values.map((item) => `\`${item}\``).join("、")} 必須分開保存；空值不得同時表示沒有問題與尚無正式紀錄。`,
    "",
    "##### 治療型能力與正式階段",
    "",
    "| 階段 | 合理治療範圍 | 防錯 |",
    "|---|---|---|",
    "| 初顯者 | 小傷癒合、止血、緩痛與輕度靈力穩定。 | 不處理死亡復歸或重大重建。 |",
    "| 成形者 | 快速修復一般傷勢並實質處理中度創傷、骨折、失血與靈力紊亂；可自療。 | 不單獨完成肉體死亡後復歸；不能無代價處理極高污染／靈魂重創。 |",
    "| 契合者 | 處理重傷、臟器損傷、污染侵蝕、多人戰地救援與瀕死搶救。 | 復歸仍非輕易單獨常態效果。 |",
    "| 成熟者 | 可承擔重大組織重建、本體／靈魂共鳴修復，並參與生命復歸。 | 仍受本源狀態、窗口、設備、干擾與後續影響限制。 |",
    "| 超脫者 | 可在同源生命法則與正式條件內處理更高層級存續、本源重建或復歸。 | 不自動救回本源完全消散／毀滅者。 |",
    "",
  ].join("\n");
}

function historySummary(status) {
  return status.injury_history.map((item) => (
    `${item.chapter} ${item.affected_body_parts.join("／")} ${item.injury_class}（${item.history_status}）`
  )).join("；");
}

function statusMarkdown(statuses) {
  const rows = statuses.map((status) => {
    const restrictions = status.active_restrictions.length
      ? status.active_restrictions.map((item) => item.scope).join("；")
      : "無目前有效的普通短期限制";
    return `| ${status.character} | ${status.current_physical_status} | ${status.current_spiritual_status} | ${restrictions} | 日常 ${stateToken(status.daily_activity_clearance)}；訓練 ${stateToken(status.training_clearance)}；競技 ${stateToken(status.competition_clearance)}；召喚 ${stateToken(status.weapon_summon_clearance)}；高負荷 ${stateToken(status.high_load_manifestation_clearance)} | ${status.exception_reason} | ${status.status_as_of_chapter} |`;
  });
  const history = statuses.map((status) => (
    `- **${status.character}：** ${historySummary(status)}。resolution basis：\`${status.resolution_basis}\`。`
  ));
  return [
    "### 3.2.1｜傷勢歷史、當前狀態與許可正規化",
    "",
    "本節只正規化既成傷勢的當前有效性，不刪除歷史、不新增未有證據的傷勢，也不自動核發正式競技許可。",
    "",
    `正式狀態欄位：${requiredMedicalStatusFields.map((field) => `\`${field}\``).join("、")}；另保存 \`low_load_training_clearance\` 與 \`high_load_manifestation_clearance\`，使日常、訓練、競技、召喚與本體顯現許可互不混用。`,
    "",
    "| 角色 | current physical | current spiritual | active restrictions | clearance | unresolved exception | evidence chapter |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    "#### Injury history（永久保留）",
    "",
    ...history,
    "",
    "#### 御先痕跡分離守則",
    "",
    "- 頸側舊靈力灼傷、掌心創痕、武裝解除末段未分類靈力殘痕、棋盤黑紋是四個獨立來源；目前正式來源未載前兩項的可核對證據，故只標記來源查證延後，不得補寫其成因或當前效力。",
    "- 御先普通物理檢查指標正常；目前直接異常是武裝解除末段未分類靈力殘痕，追加比對尚未結束。",
    "- 棋盤黑紋沒有可指向御先個人的靈力殘留，且同類特徵早於御先入學存在；不得建立「御先造成黑紋」的 Canon。",
    "",
  ].join("\n");
}

function bumpPatchVersion(text) {
  let changed = false;
  return String(text).replace(/v(\d+)\.(\d+)\.(\d+)/u, (_match, major, minor, patch) => {
    changed = true;
    return `v${major}.${minor}.${Number.parseInt(patch, 10) + 1}`;
  }).replace(/^/, changed ? "" : "");
}

function replaceSection(text, startHeading, endHeading, replacement) {
  const start = text.indexOf(startHeading);
  const end = text.indexOf(endHeading, start + startHeading.length);
  if (start < 0 || end < 0) {
    throw new Error(`Unable to locate engine section between ${startHeading} and ${endHeading}.`);
  }
  return `${text.slice(0, start)}${replacement.trimEnd()}\n\n${text.slice(end)}`;
}

export async function buildMedicalContinuityEngineCandidate(options = {}) {
  const activeEnginePath = activeEnginePathFor(options);
  const activeEngineText = options.activeEngineText !== undefined
    ? String(options.activeEngineText)
    : await readFile(activeEnginePath, "utf8");
  const snapshot = await buildMedicalContinuitySnapshot({
    ...options,
    activeEngineText,
  });
  let candidateText = bumpPatchVersion(activeEngineText);
  candidateText = replaceSection(
    candidateText,
    "#### 2.2.3 高科技靈力醫療、治療型武裝與生命復歸",
    "### 2.3 異能武裝靈魂內收納、召喚與維持準則",
    policyMarkdown(snapshot.recovery_policy),
  );
  const normalizedHeading = "### 3.2.1｜傷勢歷史、當前狀態與許可正規化";
  if (candidateText.includes(normalizedHeading)) {
    candidateText = replaceSection(
      candidateText,
      normalizedHeading,
      "## 3.3｜近期章節必要結算",
      statusMarkdown(snapshot.character_statuses),
    );
  } else {
    const insertAt = candidateText.indexOf("## 3.3｜近期章節必要結算");
    if (insertAt < 0) throw new Error("Unable to locate 3.3 engine insertion point.");
    candidateText = `${candidateText.slice(0, insertAt)}${statusMarkdown(snapshot.character_statuses)}\n${candidateText.slice(insertAt)}`;
  }
  candidateText = candidateText.replace(
    "朝日奈千夜對九逃之既成賽果與醫療後座仍有效，但不再是目前時間頭",
    "朝日奈千夜對九逃之既成賽果與歷史／關係後果仍有效；第十九章當日普通物理醫囑不作現行限制，訓練與競技許可則依正式紀錄分開判定",
  );
  return {
    candidate_text: candidateText.replace(/\r\n?/gu, "\n").trimEnd(),
    base_active_engine_hash: sha256(activeEngineText),
    candidate_engine_hash_sha256: sha256(candidateText.replace(/\r\n?/gu, "\n").trimEnd()),
    snapshot,
    active_engine_path: normalizeProjectPath(activeEnginePath),
    active_engine_modified: false,
    activation_performed: false,
  };
}

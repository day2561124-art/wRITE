const reasonLabels = {
  explicit_introduction: "明確命名語境",
  role_suffix: "角色稱謂語境",
};

const whitelistStatusLabels = {
  not_in_known_name_whitelist: "不在目前短名白名單中",
};

function safeString(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function guardSeverity(code) {
  if (safeString(code).startsWith("P0")) return "blocking";
  if (safeString(code).startsWith("P1")) return "warning";
  return "info";
}

function guardTitle(entry = {}) {
  if (entry.code === "P1_TOO_MANY_NEW_NAMES") return "疑似新增角色過多";
  if (entry.code === "P0_RESULT_CONFLICT") return "結果與 locked_result 衝突";
  if (entry.code === "P0_FORBIDDEN_CHARACTER") return "候選正文使用了禁止角色";
  return safeString(entry.code, "Guard report");
}

function guardActionHint(entry = {}) {
  if (entry.code === "P1_TOO_MANY_NEW_NAMES") {
    return "P1 只提醒、不阻擋 candidate-only save；若這些名字是既有角色，請補入 current-arc 白名單或調整稱謂語境。";
  }
  if (entry.code === "P0_RESULT_CONFLICT") {
    return "請修正候選正文，使比賽結果承接 locked_result；P0 會阻擋後續採用。";
  }
  if (safeString(entry.code).startsWith("P0")) {
    return "請先修正 P0 問題；P0 會阻擋後續採用。";
  }
  return "請依 guard report 檢查候選正文。";
}

function p1NameDetails(entry = {}) {
  const details = Array.isArray(entry.detected_name_details)
    ? entry.detected_name_details
    : [];
  if (details.length > 0) {
    return details.map((detail) => {
      const name = safeString(detail.name, "未命名");
      const reason = reasonLabels[detail.reason] ?? safeString(detail.reason, "未知語境");
      const evidence = safeString(detail.evidence, "未提供證據");
      const whitelist = whitelistStatusLabels[detail.whitelist_status]
        ?? safeString(detail.whitelist_status, "白名單狀態未知");
      return `${name}：${reason}，證據「${evidence}」，${whitelist}`;
    });
  }
  return (Array.isArray(entry.detected_names) ? entry.detected_names : [])
    .map((name) => `${safeString(name)}：疑似新增角色，尚無詳細語境資料`);
}

function guardDetails(entry = {}) {
  if (entry.code === "P1_TOO_MANY_NEW_NAMES") return p1NameDetails(entry).slice(0, 50);
  return [safeString(entry.message)].filter(Boolean);
}

function guardSummary(entry = {}) {
  if (entry.code === "P1_TOO_MANY_NEW_NAMES") {
    const count = Array.isArray(entry.detected_names)
      ? entry.detected_names.length
      : Array.isArray(entry.detected_name_details)
        ? entry.detected_name_details.length
        : 0;
    return `偵測到 ${count} 個疑似新增角色；此項為 P1 提醒，不阻擋候選保存。`;
  }
  return safeString(entry.message, guardTitle(entry));
}

export function formatGuardReportEntryForDisplay(entry = {}) {
  const details = guardDetails(entry);
  const title = guardTitle(entry);
  const summary = guardSummary(entry);
  return {
    code: safeString(entry.code, "UNKNOWN_GUARD"),
    severity: guardSeverity(entry.code),
    title,
    summary,
    details,
    action_hint: guardActionHint(entry),
    text: [
      `${title}（${safeString(entry.code, "UNKNOWN_GUARD")}）`,
      summary,
      ...details.map((detail) => `- ${detail}`),
      guardActionHint(entry),
    ].filter(Boolean).join("\n"),
  };
}

export function formatGuardReportForDisplay(guardReport = []) {
  const entries = Array.isArray(guardReport)
    ? guardReport.map((entry) => formatGuardReportEntryForDisplay(entry))
    : [];
  const blockingCount = entries.filter((entry) => entry.severity === "blocking").length;
  const warningCount = entries.filter((entry) => entry.severity === "warning").length;
  return {
    count: entries.length,
    blocking_count: blockingCount,
    warning_count: warningCount,
    has_blocking_errors: blockingCount > 0,
    has_non_blocking_warnings: warningCount > 0,
    entries,
    text: entries.length
      ? entries.map((entry) => entry.text).join("\n\n")
      : "Guard report clean：沒有 P0/P1 guard 項目。",
  };
}

export default { formatGuardReportForDisplay, formatGuardReportEntryForDisplay };

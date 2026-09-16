import fs from 'fs';
import path from 'path';

const DEFAULT_MAX_INCIDENT_FILES = 20;
const DEFAULT_MAX_DETAIL_DEPTH = 4;
const DEFAULT_MAX_STRING_LENGTH = 2_000;
const SECRET_KEY_PATTERN = /(authorization|cookie|password|secret|token|credential|api[_-]?key)/iu;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function safeSegment(value) {
  return String(value ?? 'incident')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64) || 'incident';
}

function sanitizeValue(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.slice(0, DEFAULT_MAX_STRING_LENGTH);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (depth >= DEFAULT_MAX_DETAIL_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, 64).map((entry) => sanitizeValue(entry, depth + 1, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    const result = {};
    for (const [key, entry] of Object.entries(value).slice(0, 128)) {
      result[key] = SECRET_KEY_PATTERN.test(key)
        ? '[redacted]'
        : sanitizeValue(entry, depth + 1, seen);
    }
    return result;
  }
  return String(value).slice(0, DEFAULT_MAX_STRING_LENGTH);
}

function runtimeSummary() {
  const memory = process.memoryUsage();
  const resource = process.resourceUsage?.() ?? {};
  return {
    pid: process.pid,
    ppid: process.ppid,
    uptime_ms: Math.round(process.uptime() * 1000),
    memory: {
      rss_bytes: memory.rss,
      heap_total_bytes: memory.heapTotal,
      heap_used_bytes: memory.heapUsed,
      external_bytes: memory.external,
      array_buffers_bytes: memory.arrayBuffers ?? null,
    },
    resource_usage: sanitizeValue(resource),
  };
}

function redactedNodeReport(error = undefined) {
  try {
    const report = process.report?.getReport?.(error);
    if (!report || typeof report !== 'object') return null;
    const header = report.header ?? {};
    return {
      header: {
        event: header.event ?? null,
        trigger: header.trigger ?? null,
        filename: header.filename ?? null,
        dumpEventTime: header.dumpEventTime ?? null,
        processId: header.processId ?? process.pid,
        nodejsVersion: header.nodejsVersion ?? process.version,
        wordSize: header.wordSize ?? null,
        arch: header.arch ?? process.arch,
        platform: header.platform ?? process.platform,
        componentVersions: sanitizeValue(header.componentVersions ?? {}),
      },
      javascriptHeap: sanitizeValue(report.javascriptHeap ?? {}),
      resourceUsage: sanitizeValue(report.resourceUsage ?? {}),
      userLimits: sanitizeValue(report.userLimits ?? {}),
      workers: Array.isArray(report.workers)
        ? report.workers.slice(0, 32).map((worker) => ({
          threadId: worker?.header?.threadId ?? null,
          javascriptHeap: sanitizeValue(worker?.javascriptHeap ?? {}),
          resourceUsage: sanitizeValue(worker?.resourceUsage ?? {}),
        }))
        : [],
    };
  } catch (reportError) {
    return {
      unavailable: true,
      error: reportError?.message ?? String(reportError),
    };
  }
}

function listManagedFiles(directory) {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /^mcp-(incident|report)-/u.test(entry.name))
      .map((entry) => {
        const fullPath = path.join(directory, entry.name);
        const stat = fs.statSync(fullPath);
        return { name: entry.name, path: fullPath, mtimeMs: stat.mtimeMs };
      })
      .sort((left, right) => right.mtimeMs - left.mtimeMs || right.name.localeCompare(left.name));
  } catch {
    return [];
  }
}

function enforceRetention(directory, maxFiles) {
  const files = listManagedFiles(directory);
  for (const file of files.slice(maxFiles)) {
    try { fs.unlinkSync(file.path); } catch { }
  }
}

export function createMcpRuntimeDiagnostics(options = {}) {
  const directory = path.resolve(
    options.directory
      ?? process.env.MCP_DIAGNOSTICS_DIRECTORY
      ?? path.join('data', 'outputs', 'logs', 'mcp-incidents'),
  );
  const maxFiles = boundedInteger(
    options.maxFiles ?? process.env.MCP_DIAGNOSTICS_MAX_FILES,
    DEFAULT_MAX_INCIDENT_FILES,
    1,
    200,
  );

  function captureIncident(type, details = {}, error = undefined) {
    try {
      fs.mkdirSync(directory, { recursive: true });
      const timestamp = new Date().toISOString();
      const stamp = timestamp.replace(/[:.]/gu, '-');
      const segment = safeSegment(type);
      const incidentPath = path.join(directory, `mcp-incident-${stamp}-${process.pid}-${segment}.json`);
      const reportPath = path.join(directory, `mcp-report-${stamp}-${process.pid}-${segment}.json`);
      const incident = {
        schema_version: 1,
        type: segment,
        timestamp,
        runtime: runtimeSummary(),
        details: sanitizeValue(details),
        error: error ? sanitizeValue({ name: error.name, message: error.message, code: error.code }) : null,
      };
      fs.writeFileSync(incidentPath, JSON.stringify(incident, null, 2), 'utf8');
      const report = redactedNodeReport(error);
      if (report) fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      enforceRetention(directory, maxFiles);
      return {
        incident_path: incidentPath,
        report_path: report ? reportPath : null,
      };
    } catch (captureError) {
      console.error('[mcp-diagnostics] incident capture failed', captureError);
      return null;
    }
  }

  function getSummary() {
    return {
      directory,
      max_files: maxFiles,
      managed_file_count: listManagedFiles(directory).length,
      runtime: runtimeSummary(),
    };
  }

  return { captureIncident, getSummary };
}

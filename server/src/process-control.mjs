import { spawnSync } from "node:child_process";

const safeEnvironmentNames = Object.freeze([
  "PATH",
  "SystemRoot",
  "ComSpec",
  "PATHEXT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramData",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "CommonProgramFiles",
  "CommonProgramFiles(x86)",
  "HOMEDRIVE",
  "HOMEPATH",
  "HOME",
  "OS",
  "WINDIR",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "LANG",
  "LC_ALL",
]);

export function controlledProcessEnvironment(fixedEnvironment = {}) {
  const sourceEntries = new Map(
    Object.entries(process.env).map(([key, value]) => [key.toLowerCase(), [key, value]]),
  );
  const environment = {};
  for (const requestedName of safeEnvironmentNames) {
    const entry = sourceEntries.get(requestedName.toLowerCase());
    if (entry?.[1] !== undefined) environment[entry[0]] = entry[1];
  }
  environment.CI = "1";
  environment.NO_COLOR = "1";
  environment.FORCE_COLOR = "0";
  for (const [key, value] of Object.entries(fixedEnvironment)) {
    if (typeof value === "string") environment[key] = value;
  }
  return environment;
}

function stripAnsi(value) {
  return value
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/gu, "")
    .replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[A-Za-z\d]*(?:;[-A-Za-z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/gu, "");
}

export function redactProcessOutput(value) {
  let text = stripAnsi(String(value ?? ""));
  text = text.replace(
    /-----BEGIN (?:[A-Z0-9 ]*PRIVATE KEY)-----[\s\S]*?-----END (?:[A-Z0-9 ]*PRIVATE KEY)-----/giu,
    "[REDACTED PRIVATE KEY]",
  );
  text = text.replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/giu, "Bearer [REDACTED]");
  text = text.replace(/\b(?:sk|rk|pk)-[A-Za-z0-9_-]{8,}\b/gu, "[REDACTED API KEY]");
  text = text.replace(/\bgh(?:p|o|u|s|r)_[A-Za-z0-9_]{8,}\b/giu, "[REDACTED GITHUB TOKEN]");
  text = text.replace(/\bgithub_pat_[A-Za-z0-9_]{8,}\b/giu, "[REDACTED GITHUB TOKEN]");
  text = text.replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu, "[REDACTED AWS ACCESS KEY]");
  text = text.replace(
    /((?:api[_ -]?key|access[_ -]?token|auth(?:orization)?|client[_ -]?secret|password|passwd|pwd|secret(?:[_ -]?access[_ -]?key)?|token)["']?\s*[:=]\s*["']?)([^\s"',;}{]+)/giu,
    "$1[REDACTED]",
  );
  text = text.replace(
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/gu,
    "[REDACTED TOKEN]",
  );
  return text;
}

export function createBoundedOutputCollector(maxCharacters) {
  const headLimit = Math.floor(maxCharacters / 4);
  const tailLimit = maxCharacters - headLimit;
  let head = "";
  let tail = "";
  let totalCharacters = 0;
  let totalBytes = 0;

  return {
    append(chunk) {
      const text = Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
      totalCharacters += text.length;
      totalBytes += Buffer.byteLength(text, "utf8");
      let remainder = text;
      if (head.length < headLimit) {
        const needed = headLimit - head.length;
        head += remainder.slice(0, needed);
        remainder = remainder.slice(needed);
      }
      if (remainder) tail = `${tail}${remainder}`.slice(-tailLimit);
    },
    finish() {
      const truncated = totalCharacters > maxCharacters;
      const separator = truncated ? "\n...[output truncated; tail follows]...\n" : "";
      return {
        text: redactProcessOutput(`${head}${separator}${tail}`),
        truncated,
        characters: totalCharacters,
        bytes: totalBytes,
      };
    },
  };
}

export function terminateProcessTree(child, { forceAfterMs = 2_000 } = {}) {
  if (!child || child.exitCode !== null || child.killed || !child.pid) return;

  if (process.platform === "win32") {
    const result = spawnSync(
      "taskkill.exe",
      ["/pid", String(child.pid), "/t", "/f"],
      {
        stdio: "ignore",
        windowsHide: true,
      },
    );
    if (result.status !== 0 && child.exitCode === null) {
      child.kill();
    }
    return;
  }

  child.kill("SIGTERM");
  const forceTimer = setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, forceAfterMs);
  forceTimer.unref();
}

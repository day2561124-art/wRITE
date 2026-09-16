import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import { controlledProcessEnvironment } from "./process-control.mjs";

const execFileAsync = promisify(execFile);

export const WINDOWS_LOCK_OWNER_MAX_RESULTS = 64;
export const WINDOWS_LOCK_OWNER_TIMEOUT_MS = 30_000;
export const WINDOWS_LOCK_OWNER_MAX_BUFFER_BYTES = 512 * 1024;

const WINDOWS_HANDLE_SCAN_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$targetPath = [Environment]::GetEnvironmentVariable('WRITER_WORKBENCH_LOCK_TARGET')
if ([string]::IsNullOrWhiteSpace($targetPath)) { throw 'WRITER_WORKBENCH_LOCK_TARGET is required.' }
$source = @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

public sealed class WriterLockOwner {
    public int ProcessId { get; set; }
    public string ImagePath { get; set; }
    public string MatchedPath { get; set; }
}

public sealed class WriterLockScanReport {
    public WriterLockScanReport() {
        Owners = new List<WriterLockOwner>();
    }

    public List<WriterLockOwner> Owners { get; set; }
    public long SystemHandleCount { get; set; }
    public long ScannedHandleCount { get; set; }
    public int InaccessibleProcessCount { get; set; }
    public long DuplicateFailureCount { get; set; }
    public long DiskHandleCount { get; set; }
    public bool Truncated { get; set; }
}

public static class WriterWindowsHandleScanner {
    private const int SystemExtendedHandleInformation = 64;
    private const int StatusInfoLengthMismatch = unchecked((int)0xC0000004);
    private const uint ProcessDuplicateHandle = 0x0040;
    private const uint ProcessQueryLimitedInformation = 0x1000;
    private const uint DuplicateSameAccess = 0x00000002;
    private const uint FileTypeDisk = 0x0001;
    private const int MaxResults = 64;
    private const long MaxHandles = 2000000;

    [StructLayout(LayoutKind.Sequential)]
    private struct SystemHandleTableEntryInfoEx {
        public IntPtr Object;
        public IntPtr UniqueProcessId;
        public IntPtr HandleValue;
        public uint GrantedAccess;
        public ushort CreatorBackTraceIndex;
        public ushort ObjectTypeIndex;
        public uint HandleAttributes;
        public uint Reserved;
    }

    [DllImport("ntdll.dll")]
    private static extern int NtQuerySystemInformation(
        int systemInformationClass,
        IntPtr systemInformation,
        int systemInformationLength,
        out int returnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DuplicateHandle(
        IntPtr sourceProcessHandle,
        IntPtr sourceHandle,
        IntPtr targetProcessHandle,
        out IntPtr targetHandle,
        uint desiredAccess,
        bool inheritHandle,
        uint options);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern uint GetFileType(IntPtr handle);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(
        IntPtr fileHandle,
        StringBuilder filePath,
        uint filePathLength,
        uint flags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool QueryFullProcessImageNameW(
        IntPtr processHandle,
        uint flags,
        StringBuilder exeName,
        ref uint size);

    private static string NormalizePath(string value) {
        if (String.IsNullOrWhiteSpace(value)) return null;
        string normalized = value.Trim();
        if (normalized.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase)) {
            normalized = @"\\" + normalized.Substring(8);
        } else if (normalized.StartsWith(@"\\?\", StringComparison.OrdinalIgnoreCase)) {
            normalized = normalized.Substring(4);
        }
        normalized = normalized.Replace('/', '\\');
        while (normalized.Length > 3 && normalized.EndsWith("\\", StringComparison.Ordinal)) {
            normalized = normalized.Substring(0, normalized.Length - 1);
        }
        return normalized;
    }

    private static bool IsWithinTarget(string candidate, string target) {
        if (String.Equals(candidate, target, StringComparison.OrdinalIgnoreCase)) return true;
        return candidate.StartsWith(target + "\\", StringComparison.OrdinalIgnoreCase);
    }

    private static string ResolveDiskPath(IntPtr handle) {
        var buffer = new StringBuilder(1024);
        uint length = GetFinalPathNameByHandleW(handle, buffer, (uint)buffer.Capacity, 0);
        if (length == 0) return null;
        if (length >= buffer.Capacity) {
            int requested = checked((int)Math.Min((long)length + 2L, 32768L));
            buffer = new StringBuilder(requested);
            length = GetFinalPathNameByHandleW(handle, buffer, (uint)buffer.Capacity, 0);
            if (length == 0 || length >= buffer.Capacity) return null;
        }
        return NormalizePath(buffer.ToString());
    }

    private static string QueryImagePath(int processId) {
        IntPtr process = OpenProcess(ProcessQueryLimitedInformation, false, processId);
        if (process == IntPtr.Zero) return null;
        try {
            uint size = 32768;
            var buffer = new StringBuilder((int)size);
            if (!QueryFullProcessImageNameW(process, 0, buffer, ref size)) return null;
            return buffer.ToString();
        } finally {
            CloseHandle(process);
        }
    }

    public static WriterLockScanReport Scan(string targetPath) {
        var report = new WriterLockScanReport();
        string target = NormalizePath(Path.GetFullPath(targetPath));
        if (String.IsNullOrWhiteSpace(target)) return report;

        IntPtr buffer = IntPtr.Zero;
        int size = 1024 * 1024;
        int needed;
        try {
            while (true) {
                buffer = Marshal.AllocHGlobal(size);
                int status = NtQuerySystemInformation(SystemExtendedHandleInformation, buffer, size, out needed);
                if (status == 0) break;
                Marshal.FreeHGlobal(buffer);
                buffer = IntPtr.Zero;
                if (status != StatusInfoLengthMismatch) {
                    throw new InvalidOperationException("NtQuerySystemInformation failed with NTSTATUS 0x" + status.ToString("X8") + ".");
                }
                long grown = Math.Max((long)size * 2L, (long)needed + 65536L);
                if (grown > 256L * 1024L * 1024L) {
                    throw new InvalidOperationException("System handle table exceeded the bounded diagnostic buffer.");
                }
                size = (int)grown;
            }

            long handleCount = Marshal.ReadIntPtr(buffer).ToInt64();
            report.SystemHandleCount = handleCount;
            long scanCount = Math.Min(handleCount, MaxHandles);
            if (handleCount > scanCount) report.Truncated = true;
            int entrySize = Marshal.SizeOf(typeof(SystemHandleTableEntryInfoEx));
            long headerSize = IntPtr.Size * 2L;
            var processHandles = new Dictionary<int, IntPtr>();
            var inaccessibleProcesses = new HashSet<int>();
            var seenOwners = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            IntPtr currentProcess = GetCurrentProcess();

            try {
                for (long index = 0; index < scanCount; index++) {
                    long offset = checked(headerSize + index * (long)entrySize);
                    IntPtr entryPtr = new IntPtr(buffer.ToInt64() + offset);
                    var entry = (SystemHandleTableEntryInfoEx)Marshal.PtrToStructure(entryPtr, typeof(SystemHandleTableEntryInfoEx));
                    long rawPid = entry.UniqueProcessId.ToInt64();
                    if (rawPid <= 0 || rawPid > Int32.MaxValue) continue;
                    int pid = (int)rawPid;
                    report.ScannedHandleCount++;

                    IntPtr sourceProcess;
                    if (!processHandles.TryGetValue(pid, out sourceProcess)) {
                        sourceProcess = OpenProcess(ProcessDuplicateHandle, false, pid);
                        if (sourceProcess == IntPtr.Zero) {
                            inaccessibleProcesses.Add(pid);
                            continue;
                        }
                        processHandles[pid] = sourceProcess;
                    }

                    IntPtr duplicate;
                    if (!DuplicateHandle(sourceProcess, entry.HandleValue, currentProcess, out duplicate, 0, false, DuplicateSameAccess)) {
                        report.DuplicateFailureCount++;
                        continue;
                    }
                    try {
                        if (GetFileType(duplicate) != FileTypeDisk) continue;
                        report.DiskHandleCount++;
                        string resolved = ResolveDiskPath(duplicate);
                        if (String.IsNullOrWhiteSpace(resolved) || !IsWithinTarget(resolved, target)) continue;
                        string key = pid.ToString() + "|" + resolved;
                        if (!seenOwners.Add(key)) continue;
                        report.Owners.Add(new WriterLockOwner {
                            ProcessId = pid,
                            ImagePath = QueryImagePath(pid),
                            MatchedPath = resolved,
                        });
                        if (report.Owners.Count >= MaxResults) {
                            report.Truncated = true;
                            break;
                        }
                    } finally {
                        CloseHandle(duplicate);
                    }
                }
            } finally {
                foreach (var processHandle in processHandles.Values) {
                    if (processHandle != IntPtr.Zero) CloseHandle(processHandle);
                }
            }
            report.InaccessibleProcessCount = inaccessibleProcesses.Count;
            return report;
        } finally {
            if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer);
        }
    }
}
'@
Add-Type -TypeDefinition $source -Language CSharp
$report = [WriterWindowsHandleScanner]::Scan($targetPath)
$report | ConvertTo-Json -Depth 5 -Compress
`;

function normalizeMatchedPath(targetPath, matchedPath) {
  const absoluteTarget = path.resolve(targetPath);
  const absoluteMatched = path.resolve(String(matchedPath ?? ""));
  const relative = path.relative(absoluteTarget, absoluteMatched);
  if (relative === "") return ".";
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) return null;
  return relative.replaceAll(path.sep, "/");
}

export async function findWindowsPathLockOwners(targetPath, {
  execFileRunner = execFileAsync,
  platform = process.platform,
} = {}) {
  const resolvedTarget = path.resolve(String(targetPath ?? ""));
  if (platform !== "win32") {
    return {
      supported: false,
      platform,
      owner_count: 0,
      owners: [],
      scan: null,
    };
  }

  const { stdout } = await execFileRunner(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      WINDOWS_HANDLE_SCAN_SCRIPT,
    ],
    {
      cwd: path.parse(resolvedTarget).root,
      env: controlledProcessEnvironment({
        WRITER_WORKBENCH_LOCK_TARGET: resolvedTarget,
      }),
      windowsHide: true,
      timeout: WINDOWS_LOCK_OWNER_TIMEOUT_MS,
      maxBuffer: WINDOWS_LOCK_OWNER_MAX_BUFFER_BYTES,
      shell: false,
    },
  );

  const raw = String(stdout ?? "").trim();
  const parsed = raw ? JSON.parse(raw) : {};
  const rawOwners = Array.isArray(parsed.Owners) ? parsed.Owners : (parsed.Owners ? [parsed.Owners] : []);
  const owners = [];
  for (const owner of rawOwners.slice(0, WINDOWS_LOCK_OWNER_MAX_RESULTS)) {
    const relative = normalizeMatchedPath(resolvedTarget, owner?.MatchedPath);
    if (relative === null) continue;
    const pid = Number(owner?.ProcessId);
    if (!Number.isSafeInteger(pid) || pid <= 0) continue;
    const imagePath = typeof owner?.ImagePath === "string" && owner.ImagePath.trim()
      ? owner.ImagePath.trim()
      : null;
    owners.push({
      pid,
      image_name: imagePath ? path.basename(imagePath) : null,
      image_path: imagePath,
      matched_relative_path: relative,
      matches_workspace_root: relative === ".",
    });
  }

  return {
    supported: true,
    platform,
    owner_count: owners.length,
    owners,
    scan: {
      system_handle_count: Number(parsed.SystemHandleCount ?? 0),
      scanned_handle_count: Number(parsed.ScannedHandleCount ?? 0),
      inaccessible_process_count: Number(parsed.InaccessibleProcessCount ?? 0),
      duplicate_failure_count: Number(parsed.DuplicateFailureCount ?? 0),
      disk_handle_count: Number(parsed.DiskHandleCount ?? 0),
      truncated: parsed.Truncated === true || rawOwners.length > WINDOWS_LOCK_OWNER_MAX_RESULTS,
    },
  };
}

using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

internal static class PowerShellAppContainer {
    private const uint Suspended = 0x00000004, UnicodeEnvironment = 0x00000400, ExtendedStartup = 0x00080000, NoWindow = 0x08000000;
    private const uint UseStdHandles = 0x100;
    private const uint JobLimits = 0x2000 | 0x200 | 0x08; // Close kills descendants, with aggregate memory and process limits.
    private const uint WaitTimeout = 258;

    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityCapabilities { public IntPtr Sid, Capabilities; public uint Count, Reserved; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo {
        public int Size;
        public string Reserved, Desktop, Title;
        public int X, Y, XSize, YSize, XChars, YChars, Fill;
        public uint Flags;
        public short Show, ReservedSize;
        public IntPtr ReservedData, StdIn, StdOut, StdErr;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfoEx { public StartupInfo Info; public IntPtr Attributes; }
    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInfo { public IntPtr Process, Thread; public uint Pid, Tid; }
    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes { public int Size; public IntPtr Descriptor; public int Inherit; }
    [StructLayout(LayoutKind.Sequential)]
    private struct JobBasicLimits {
        public long ProcessTime, JobTime;
        public uint Flags;
        public UIntPtr MinimumWorkingSet, MaximumWorkingSet;
        public uint ActiveProcesses;
        public UIntPtr Affinity;
        public uint Priority, Scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct JobIoCounters { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)]
    private struct JobExtendedLimits {
        public JobBasicLimits Basic;
        public JobIoCounters Io;
        public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct JobAccounting {
        public long UserTime, KernelTime, PeriodUserTime, PeriodKernelTime;
        public uint PageFaults, TotalProcesses, ActiveProcesses, TerminatedProcesses;
    }

    [DllImport("userenv.dll", CharSet = CharSet.Unicode)] private static extern int CreateAppContainerProfile(string name, string label, string description, IntPtr capabilities, uint count, out IntPtr sid);
    [DllImport("userenv.dll", CharSet = CharSet.Unicode)] private static extern int DeleteAppContainerProfile(string name);
    [DllImport("advapi32.dll")] private static extern IntPtr FreeSid(IntPtr sid);
    [DllImport("advapi32.dll", SetLastError = true)] private static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("advapi32.dll", SetLastError = true)] private static extern bool GetTokenInformation(IntPtr token, int type, out int value, int size, out int required);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool InitializeProcThreadAttributeList(IntPtr attributes, int count, uint flags, ref IntPtr size);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool UpdateProcThreadAttribute(IntPtr attributes, uint flags, IntPtr key, IntPtr value, IntPtr size, IntPtr previous, IntPtr resultSize);
    [DllImport("kernel32.dll")] private static extern void DeleteProcThreadAttributeList(IntPtr attributes);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CreateProcess(string application, StringBuilder command, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string cwd, ref StartupInfoEx startup, out ProcessInfo result);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref SecurityAttributes attributes, uint size);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr attributes, IntPtr name);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetInformationJobObject(IntPtr job, int kind, ref JobExtendedLimits data, int size);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool QueryInformationJobObject(IntPtr job, int kind, out JobAccounting data, int size, IntPtr returned);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetExitCodeProcess(IntPtr handle, out uint code);
    [DllImport("kernel32.dll")] private static extern bool TerminateProcess(IntPtr handle, uint exitCode);
    [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);

    // CI experiment only. The production branch has no lease client.
    private sealed class DiagnosticLease : IDisposable {
        private NamedPipeClientStream pipe;
        internal string Id { get; private set; }
        private byte[] ReadExact(int count) {
            byte[] data = new byte[count];
            var deadline = Stopwatch.StartNew();
            int offset = 0;
            while (offset < count) {
                var pending = pipe.BeginRead(data, offset, count-offset, null, null);
                int remaining = 5000-(int)deadline.ElapsedMilliseconds;
                if (remaining<=0 || !pending.AsyncWaitHandle.WaitOne(remaining))
                    throw new TimeoutException("Diagnostic lease response timeout");
                int size = pipe.EndRead(pending);
                if (size==0) throw new EndOfStreamException("Diagnostic lease ended");
                offset += size;
            }
            return data;
        }
        internal DiagnosticLease() {
            try {
                pipe = new NamedPipeClientStream(".", "NexaDiagStationLeaseV1",
                    PipeAccessRights.ReadWrite | PipeAccessRights.ReadPermissions | PipeAccessRights.Synchronize,
                    PipeOptions.Asynchronous, TokenImpersonationLevel.Identification, HandleInheritability.None);
                pipe.Connect(5000);
                var owner = pipe.GetAccessControl().GetOwner(typeof(SecurityIdentifier));
                if (!owner.Equals(new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null)))
                    throw new InvalidOperationException("Unexpected diagnostic provider identity");
                pipe.WriteByte(65); pipe.Flush();
                Id=Encoding.ASCII.GetString(ReadExact(32));
                Guid parsed;
                if (!Guid.TryParseExact(Id,"N",out parsed) || parsed.ToString("N")!=Id)
                    throw new InvalidOperationException("Malformed diagnostic lease ID");
            } catch {
                Dispose();
                throw;
            }
        }
        internal void Release() {
            pipe.WriteByte(82); pipe.Flush();
            if (ReadExact(1)[0]!=75) throw new InvalidOperationException("Diagnostic lease cleanup unacknowledged");
        }
        public void Dispose() { if(pipe!=null) { pipe.Dispose(); pipe=null; } }
    }

    private static void Require(bool ok) { if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error()); }
    private static void Close(ref IntPtr handle) { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } }
    private static void AllowDirectory(string target, SecurityIdentifier sid, FileSystemRights rights) {
        var acl = Directory.GetAccessControl(target);
        acl.AddAccessRule(new FileSystemAccessRule(sid, rights, InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit,
            PropagationFlags.None, AccessControlType.Allow));
        Directory.SetAccessControl(target, acl);
    }

    private sealed class Capture {
        internal readonly MemoryStream Bytes = new MemoryStream();
        internal bool Truncated;
        internal bool Failed;
        internal readonly Thread Reader;
        internal Capture(IntPtr handle) {
            Reader = new Thread(delegate() {
                try {
                    using (var source = new FileStream(new SafeFileHandle(handle, true), FileAccess.Read, 4096, false)) {
                        byte[] buffer = new byte[4096];
                        int size;
                        while ((size = source.Read(buffer, 0, buffer.Length)) != 0) {
                            int retained = (int)Math.Min(size, 4096 - Bytes.Length);
                            Bytes.Write(buffer, 0, retained);
                            if (retained < size) Truncated = true;
                        }
                    }
                } catch (IOException error) {
                    int code = error.HResult & 0xffff;
                    Failed = code != 109 && code != 232; // Pipes close after the last writer exits.
                }
            });
            Reader.IsBackground = true;
            Reader.Start();
        }
    }

    private static bool WithinStageBudget(string root) {
        var remaining = new System.Collections.Generic.Stack<string>();
        remaining.Push(root);
        long bytes = 0;
        int count = 0;
        try {
            while (remaining.Count > 0) {
                string directory = remaining.Pop();
                FileSystemInfo[] entries;
                try { entries = new DirectoryInfo(directory).GetFileSystemInfos(); }
                catch (DirectoryNotFoundException) { if (directory == root) return false; continue; }
                foreach (var item in entries) {
                    if (++count > 4096) return false;
                    try {
                        if ((item.Attributes & FileAttributes.ReparsePoint) != 0) continue;
                        if (item is DirectoryInfo) remaining.Push(item.FullName);
                        else if ((bytes += ((FileInfo)item).Length) > 64 * 1024 * 1024) return false;
                    } catch (FileNotFoundException) { }
                }
            }
            return true;
        } catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
    }

    public static int Main(string[] args) {
        uint timeout;
        if ((args.Length != 3 && args.Length != 4) || !UInt32.TryParse(args[2], out timeout) || timeout < 1000 || timeout > 120000) return 64;
        bool fixedHermeticCore = args.Length == 4;
        if (fixedHermeticCore && (args[3] != "fixed-hermetic-core" || args[1] != ".")) return 64;
        string root = Path.GetFullPath(args[0]);
        string work = Path.Combine(root, "work");
        string tools = Path.Combine(Directory.GetParent(root).FullName, "tools");
        string cwd = Path.GetFullPath(Path.Combine(work, args[1]));
        if (!cwd.Equals(work, StringComparison.OrdinalIgnoreCase) && !cwd.StartsWith(work + "\\", StringComparison.OrdinalIgnoreCase)) return 64;
        // DIAGNOSTIC ONLY: pair the exact package with the independent CI
        // provisioner. This is not a production profile or deployment contract.
        bool fixtureStation = fixedHermeticCore && Process.GetCurrentProcess().SessionId == 0;
        string name = "NexaPiShell" + Guid.NewGuid().ToString("N");
        string windows = Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        string system = Path.Combine(windows, "System32");
        string psHome = Path.Combine(system, @"WindowsPowerShell\v1.0");
        string executable = fixedHermeticCore ? Path.Combine(tools, "node.exe") : Path.Combine(psHome, "powershell.exe");
        string fixedEntrypoint = Path.Combine(work, @"tests\tools\mcp-hermetic-core.test.mjs");
        if (fixedHermeticCore && (!File.Exists(executable) || !File.Exists(fixedEntrypoint))) return 64;
        IntPtr sid = IntPtr.Zero, attrs = IntPtr.Zero, security = IntPtr.Zero, env = IntPtr.Zero, handles = IntPtr.Zero;
        IntPtr job = IntPtr.Zero, token = IntPtr.Zero, stdoutRead = IntPtr.Zero, stdoutWrite = IntPtr.Zero;
        IntPtr stderrRead = IntPtr.Zero, stderrWrite = IntPtr.Zero, stdinRead = IntPtr.Zero, stdinWrite = IntPtr.Zero;
        ProcessInfo child = new ProcessInfo();
        bool initialized = false;
        DiagnosticLease lease = null;
        bool profileDeleted = false;
        bool leaseCleanupVerified = false;
        string completedResult = null;
        try {
            if (fixtureStation) {
                lease = new DiagnosticLease();
                name = "NexaLease" + lease.Id;
            }
            Marshal.ThrowExceptionForHR(CreateAppContainerProfile(name, name, "Nexa engineering shell", IntPtr.Zero, 0, out sid));
            var package = new SecurityIdentifier(sid);
            AllowDirectory(root, package, FileSystemRights.Modify);
            bool hasTools = Directory.Exists(tools);
            if (hasTools) AllowDirectory(tools, package, FileSystemRights.ReadAndExecute);

            var pipe = new SecurityAttributes { Size = Marshal.SizeOf(typeof(SecurityAttributes)), Inherit = 1 };
            Require(CreatePipe(out stdoutRead, out stdoutWrite, ref pipe, 0));
            Require(CreatePipe(out stderrRead, out stderrWrite, ref pipe, 0));
            Require(CreatePipe(out stdinRead, out stdinWrite, ref pipe, 0));
            Require(SetHandleInformation(stdoutRead, 1, 0));
            Require(SetHandleInformation(stderrRead, 1, 0));
            Close(ref stdinWrite); // The guest receives EOF, never the server's stdin.

            IntPtr size = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 2, 0, ref size);
            if (size == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
            attrs = Marshal.AllocHGlobal(size);
            Require(InitializeProcThreadAttributeList(attrs, 2, 0, ref size)); initialized = true;
            int capabilitySize = Marshal.SizeOf(typeof(SecurityCapabilities));
            security = Marshal.AllocHGlobal(capabilitySize);
            Marshal.StructureToPtr(new SecurityCapabilities { Sid = sid }, security, false);
            Require(UpdateProcThreadAttribute(attrs, 0, new IntPtr(0x20009), security, new IntPtr(capabilitySize), IntPtr.Zero, IntPtr.Zero));
            handles = Marshal.AllocHGlobal(IntPtr.Size * 3);
            Marshal.WriteIntPtr(handles, 0, stdinRead);
            Marshal.WriteIntPtr(handles, IntPtr.Size, stdoutWrite);
            Marshal.WriteIntPtr(handles, IntPtr.Size * 2, stderrWrite);
            Require(UpdateProcThreadAttribute(attrs, 0, new IntPtr(0x20002), handles, new IntPtr(IntPtr.Size * 3), IntPtr.Zero, IntPtr.Zero));

            job = CreateJobObject(IntPtr.Zero, IntPtr.Zero);
            Require(job != IntPtr.Zero);
            var limits = new JobExtendedLimits { Basic = new JobBasicLimits { Flags = JobLimits, ActiveProcesses = 32 }, JobMemory = new UIntPtr(768U * 1024 * 1024) };
            Require(SetInformationJobObject(job, 9, ref limits, Marshal.SizeOf(typeof(JobExtendedLimits))));
            var startup = new StartupInfoEx { Info = new StartupInfo { Size = Marshal.SizeOf(typeof(StartupInfoEx)), Flags = UseStdHandles,
                Desktop = fixtureStation ? "NexaLeaseStation" + lease.Id + @"\NexaLeaseDesktop" : null,
                StdIn = stdinRead, StdOut = stdoutWrite, StdErr = stderrWrite }, Attributes = attrs };
            string scratch = Path.Combine(root, "temp");
            env = Marshal.StringToHGlobalUni("COMSPEC=" + Path.Combine(system, "cmd.exe") + "\0LOCALAPPDATA=" + scratch
                + "\0NEXA_SANDBOX_CWD=" + args[1] + "\0NEXA_SANDBOX_SCRIPT=" + Path.Combine(root, "command.txt")
                + (hasTools ? "\0NEXA_SANDBOX_TOOLCHAIN=" + tools : "") + "\0NEXA_SANDBOX_WORK=" + work
                + (hasTools ? "\0NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main" : "")
                + "\0NPM_CONFIG_AUDIT=false\0NPM_CONFIG_CACHE=" + Path.Combine(scratch, "npm-cache") + "\0NPM_CONFIG_FUND=false\0NPM_CONFIG_OFFLINE=true"
                + "\0PATH=" + system + ";" + psHome + (hasTools ? ";" + tools : "") + "\0PATHEXT=.COM;.EXE;.BAT;.CMD\0PSModulePath=" + Path.Combine(psHome, "Modules")
                + "\0SystemDrive=" + Path.GetPathRoot(windows).TrimEnd('\\') + "\0SystemRoot=" + windows
                + "\0TEMP=" + scratch + "\0TMP=" + scratch + "\0USERPROFILE=" + scratch + "\0WINDIR=" + windows + "\0\0");
            const string loader = "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; "
                + "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); "
                // AppContainer may lack normal module discovery. Load only the OS-owned module, never staged source.
                + "Microsoft.PowerShell.Core\\Import-Module -Name ([IO.Path]::Combine($PSHOME, 'Modules\\Microsoft.PowerShell.Management\\Microsoft.PowerShell.Management.psd1')) -ErrorAction Stop; "
                + "Microsoft.PowerShell.Core\\Import-Module -Name ([IO.Path]::Combine($PSHOME, 'Modules\\Microsoft.PowerShell.Utility\\Microsoft.PowerShell.Utility.psd1')) -ErrorAction Stop; "
                + "Microsoft.PowerShell.Management\\New-PSDrive -Name Nexa -PSProvider FileSystem -Root $env:NEXA_SANDBOX_WORK -Scope Global | Out-Null; "
                + "Microsoft.PowerShell.Management\\Set-Location -LiteralPath (Microsoft.PowerShell.Management\\Join-Path 'Nexa:\\' $env:NEXA_SANDBOX_CWD); "
                + "$global:LASTEXITCODE = 0; & ([scriptblock]::Create([IO.File]::ReadAllText($env:NEXA_SANDBOX_SCRIPT))); "
                + "$successful = $?; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }; if (-not $successful) { exit 1 }; exit 0";
            // The sole direct Node route has a server-fixed entrypoint and identical token/job controls.
            // The legacy PowerShell route and its working-directory behavior are unchanged.
            var command = new StringBuilder(fixedHermeticCore
                ? "\"" + executable + "\" \"" + fixedEntrypoint + "\""
                : "\"" + executable + "\" -NoLogo -NoProfile -NonInteractive -EncodedCommand " + Convert.ToBase64String(Encoding.Unicode.GetBytes(loader)));
            Require(CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, true, Suspended | UnicodeEnvironment | ExtendedStartup | NoWindow, env, cwd, ref startup, out child));
            Require(AssignProcessToJobObject(job, child.Process));
            Require(OpenProcessToken(child.Process, 8, out token));
            int isContainer, needed;
            Require(GetTokenInformation(token, 29, out isContainer, sizeof(int), out needed));
            if (isContainer != 1) throw new InvalidOperationException("Expected an AppContainer token");
            Close(ref stdoutWrite); Close(ref stderrWrite); Close(ref stdinRead);
            var stdout = new Capture(stdoutRead); stdoutRead = IntPtr.Zero;
            var stderr = new Capture(stderrRead); stderrRead = IntPtr.Zero;
            Require(ResumeThread(child.Thread) != UInt32.MaxValue);

            var clock = Stopwatch.StartNew();
            string reason = "completed";
            while (true) {
                uint state = WaitForSingleObject(child.Process, 150);
                if (state == 0) break;
                if (state != WaitTimeout) throw new Win32Exception(Marshal.GetLastWin32Error());
                if (clock.ElapsedMilliseconds >= timeout) { reason = "timeout"; break; }
                if (!WithinStageBudget(root)) { reason = "stage_limit"; break; }
            }
            uint code = 0;
            if (reason == "completed") Require(GetExitCodeProcess(child.Process, out code));
            Require(TerminateJobObject(job, 1));
            var drain = Stopwatch.StartNew();
            while (true) {
                JobAccounting accounting;
                Require(QueryInformationJobObject(job, 1, out accounting, Marshal.SizeOf(typeof(JobAccounting)), IntPtr.Zero));
                if (accounting.ActiveProcesses == 0) break;
                if (drain.ElapsedMilliseconds >= 5000) return 3;
                Thread.Sleep(25);
            }
            if (!stdout.Reader.Join(5000) || !stderr.Reader.Join(5000) || stdout.Failed || stderr.Failed) return 3;
            if (reason == "completed" && !WithinStageBudget(root)) reason = "stage_limit";
            completedResult = "{\"state\":\"" + reason + "\",\"exit_code\":" + (reason == "completed" ? code.ToString() : "null")
                + ",\"stdout_b64\":\"" + Convert.ToBase64String(stdout.Bytes.ToArray()) + "\",\"stderr_b64\":\"" + Convert.ToBase64String(stderr.Bytes.ToArray())
                + "\",\"stdout_truncated\":" + (stdout.Truncated ? "true" : "false") + ",\"stderr_truncated\":" + (stderr.Truncated ? "true" : "false") + "}";
        } catch (Exception error) {
            Console.Error.WriteLine(error.Message);
            return 2;
        } finally {
            if (child.Process != IntPtr.Zero) TerminateProcess(child.Process, 1);
            Close(ref job); Close(ref child.Thread); Close(ref child.Process); Close(ref token);
            Close(ref stdinRead); Close(ref stdinWrite); Close(ref stdoutRead); Close(ref stdoutWrite); Close(ref stderrRead); Close(ref stderrWrite);
            if (initialized) DeleteProcThreadAttributeList(attrs);
            if (attrs != IntPtr.Zero) Marshal.FreeHGlobal(attrs);
            if (security != IntPtr.Zero) Marshal.FreeHGlobal(security);
            if (env != IntPtr.Zero) Marshal.FreeHGlobal(env);
            if (handles != IntPtr.Zero) Marshal.FreeHGlobal(handles);
            if (sid != IntPtr.Zero) {
                FreeSid(sid);
                profileDeleted = DeleteAppContainerProfile(name) == 0;
                if (!profileDeleted) Console.Error.WriteLine("AppContainer profile cleanup failed");
            }
            if (lease != null) {
                try {
                    if (profileDeleted) {
                        lease.Release();
                        leaseCleanupVerified = true;
                    }
                }
                catch (Exception error) { Console.Error.WriteLine("Diagnostic lease cleanup failed: " + error.Message); }
                finally { lease.Dispose(); }
            }
        }
        // Never publish a successful result before profile deletion and the
        // provider cleanup acknowledgement have both been observed.
        if (fixtureStation && !leaseCleanupVerified) return 3;
        if (completedResult == null) return 3;
        Console.WriteLine(completedResult);
        return 0;
    }
}

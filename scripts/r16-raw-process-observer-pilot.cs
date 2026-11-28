// R16 disposable native observer feasibility test. No production dispatch,
// signing, credentials from candidate code, or candidate acceptance.
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text;
using System.Threading;

internal static class Program {
    const uint Suspended=4, UnicodeEnvironment=0x400, NoWindow=0x08000000;
    const uint WaitObject=0, WaitTimeout=258, Query=8, Duplicate=2, KillOnClose=0x2000;
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct Startup {
        public int cb;
        public string reserved, desktop, title;
        public int x,y,xSize,ySize,xCount,yCount,fill,flags;
        public short show,reserved2;
        public IntPtr reservedPtr,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits {
        public long processTime,jobTime;
        public uint flags;
        public UIntPtr minWorkingSet,maxWorkingSet;
        public uint activeLimit;
        public UIntPtr affinity;
        public uint priority,scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters { public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes; }
    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits {
        public BasicLimits basic; public IoCounters io;
        public UIntPtr processMemory,jobMemory,peakProcessMemory,peakJobMemory;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct Accounting {
        public long userTime,kernelTime,periodUserTime,periodKernelTime;
        public uint pageFaults,totalProcesses,activeProcesses,terminatedProcesses;
    }
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool LogonUser(string user,string domain,string password,int type,int provider,out IntPtr token);
    [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool CreateProcessAsUser(IntPtr token,string executable,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref Startup startup,out ProcessInfo info);
    [DllImport("advapi32.dll",SetLastError=true)]
    static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr sa,IntPtr name);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref ExtendedLimits limits,int size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out Accounting value,int size,IntPtr returned);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exitCode);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint exitCode);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);

    static void Require(bool value,string stage) { if(!value) throw new Win32Exception(Marshal.GetLastWin32Error(),stage); }
    static void Close(IntPtr handle) { if(handle!=IntPtr.Zero) CloseHandle(handle); }
    static string QuotePs(string value) { return "'" + value.Replace("'","''") + "'"; }
    static string stage="initial";
    static void CheckToken(IntPtr token,string sid) {
        using(var identity=new WindowsIdentity(token)) {
            if(identity.User.Value!=sid || new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)
                || identity.User.IsWellKnown(WellKnownSidType.LocalSystemSid)) throw new InvalidOperationException("GUEST_TOKEN_MISMATCH");
        }
    }
    static void Run(IntPtr token,string sid,string root,string name,string script,uint expectedExit,int limitMs,bool cancel,StreamWriter log) {
        var windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        var executable=Path.Combine(windows,@"System32\WindowsPowerShell\v1.0\powershell.exe");
        var guest=Path.Combine(root,"guest");
        string encoded=Convert.ToBase64String(Encoding.Unicode.GetBytes(script));
        var command=new StringBuilder("\""+executable+"\" -NoLogo -NoProfile -NonInteractive -EncodedCommand "+encoded);
        var environment=Marshal.StringToHGlobalUni("PATH="+Path.Combine(windows,"System32")+"\0SystemRoot="+windows+"\0TEMP="+guest+"\0TMP="+guest+"\0WINDIR="+windows+"\0\0");
        IntPtr job=IntPtr.Zero,childToken=IntPtr.Zero;
        ProcessInfo child=new ProcessInfo();
        bool assigned=false;
        try {
            stage=name+":job_create";
            job=CreateJobObject(IntPtr.Zero,IntPtr.Zero);
            Require(job!=IntPtr.Zero,"job_create");
            var limits=new ExtendedLimits(); limits.basic.flags=KillOnClose;
            Require(SetInformationJobObject(job,9,ref limits,Marshal.SizeOf(typeof(ExtendedLimits))),"job_limits");
            var startup=new Startup(); startup.cb=Marshal.SizeOf(typeof(Startup));
            stage=name+":process_create";
            Require(CreateProcessAsUser(token,executable,command,IntPtr.Zero,IntPtr.Zero,false,Suspended|UnicodeEnvironment|NoWindow,environment,guest,ref startup,out child),"process_create");
            Require(AssignProcessToJobObject(job,child.process),"job_assign"); assigned=true;
            stage=name+":token_open";
            Require(OpenProcessToken(child.process,Query|Duplicate,out childToken),"token_open");
            stage=name+":token_check";
            CheckToken(childToken,sid);
            stage=name+":resume";
            Require(ResumeThread(child.thread)!=uint.MaxValue,"thread_resume");
            stage=name+":wait";
            var elapsed=Stopwatch.StartNew();
            uint state=WaitForSingleObject(child.process,(uint)limitMs);
            string result;
            uint exit=0;
            if(state==WaitObject) {
                Require(GetExitCodeProcess(child.process,out exit),"exit_read");
                if(cancel || exit!=expectedExit || limitMs<2000) throw new InvalidOperationException("UNEXPECTED_NATIVE_EXIT");
                result="completed";
            } else if(state==WaitTimeout) {
                if(limitMs>=2000 && !cancel) throw new InvalidOperationException("UNEXPECTED_NATIVE_TIMEOUT");
                result=cancel?"cancelled":"timed_out";
            } else throw new Win32Exception(Marshal.GetLastWin32Error(),"process_wait");
            stage=name+":cleanup";
            Require(TerminateJobObject(job,125),"job_terminate");
            Require(WaitForSingleObject(child.process,5000)==WaitObject,"child_terminated");
            var cleanup=Stopwatch.StartNew();
            Accounting facts;
            do {
                Require(QueryInformationJobObject(job,1,out facts,Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero),"job_accounting");
                if(facts.activeProcesses==0) break;
                Thread.Sleep(25);
            } while(cleanup.ElapsedMilliseconds<5000);
            if(facts.activeProcesses!=0) throw new InvalidOperationException("JOB_NOT_EMPTY");
            if(name=="descendant" && facts.totalProcesses<2) throw new InvalidOperationException("DESCENDANT_NOT_OBSERVED");
            log.WriteLine("RAW_OBSERVER "+name+" outcome="+result+" exit="+(result=="completed"?exit.ToString():"null")+" active=0 total="+facts.totalProcesses);
        } finally {
            if(assigned) TerminateJobObject(job,125);
            else if(child.process!=IntPtr.Zero) TerminateProcess(child.process,125);
            Close(childToken); Close(child.thread); Close(child.process); Close(job);
            Marshal.FreeHGlobal(environment);
        }
    }
    static int Main(string[] args) {
        if(args.Length!=3) return 2;
        var root=Path.GetFullPath(args[0]);
        var user=args[1]; var sid=args[2];
        if(!WindowsIdentity.GetCurrent().User.IsWellKnown(WellKnownSidType.LocalSystemSid) || Process.GetCurrentProcess().SessionId!=0) return 3;
        IntPtr token=IntPtr.Zero;
        using(var log=new StreamWriter(Path.Combine(root,"observer.log"),false,new UTF8Encoding(false))) {
            log.AutoFlush=true;
            try {
                var secret=Path.Combine(root,"password.txt");
                stage="read_fixture_password";
                var password=File.ReadAllText(secret);
                File.Delete(secret);
                stage="batch_logon";
                Require(LogonUser(user,Environment.MachineName,password,4,0,out token),"batch_logon");
                password=null; stage="batch_token_check"; CheckToken(token,sid);
                var sentinel=QuotePs(Path.Combine(root,"sentinel.txt"));
                string check="$p="+sentinel+"; try { [void][IO.File]::ReadAllText($p); exit 91 } catch [UnauthorizedAccessException] {} ; try { [IO.File]::WriteAllText($p,'bad'); exit 92 } catch [UnauthorizedAccessException] {} ; exit 0";
                Run(token,sid,root,"isolation",check,0,10000,false,log);
                Run(token,sid,root,"success","exit 0",0,10000,false,log);
                Run(token,sid,root,"failure","exit 7",7,10000,false,log);
                string descendant="$ErrorActionPreference='Stop'; $p=[Diagnostics.ProcessStartInfo]::new([IO.Path]::Combine($PSHOME,'powershell.exe'),'-NoProfile -NonInteractive -Command [Threading.Thread]::Sleep(90000)'); $p.UseShellExecute=$false; $p.CreateNoWindow=$true; $child=[Diagnostics.Process]::Start($p); if ($null -eq $child -or $child.HasExited) { exit 93 }; exit 7";
                Run(token,sid,root,"descendant",descendant,7,10000,false,log);
                Run(token,sid,root,"timeout","[Threading.Thread]::Sleep(90000)",0,1000,false,log);
                Run(token,sid,root,"cancel","[Threading.Thread]::Sleep(90000)",0,1000,true,log);
                if(File.ReadAllText(Path.Combine(root,"sentinel.txt"))!="synthetic-protected-sentinel") throw new InvalidOperationException("SENTINEL_CHANGED");
                log.WriteLine("RAW_OBSERVER_PILOT_PASS");
                return 0;
            } catch(Exception e) { log.WriteLine("RAW_OBSERVER_PILOT_FAIL stage="+stage+" type="+e.GetType().Name+" hresult="+e.HResult.ToString("X8")+" message="+e.Message); return 1; }
            finally { Close(token); }
        }
    }
}

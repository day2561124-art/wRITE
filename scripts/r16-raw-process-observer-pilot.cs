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
using System.Collections.Generic;
using Microsoft.Win32.SafeHandles;

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
    struct StartupEx { public Startup info; public IntPtr attributes; }
    [StructLayout(LayoutKind.Sequential)]
    struct PipeSecurity { public int size; public IntPtr descriptor; public int inherit; }
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
    [DllImport("advapi32.dll",EntryPoint="CreateProcessAsUserW",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool CreateProcessWithCapture(IntPtr token,string executable,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref StartupEx startup,out ProcessInfo info);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref PipeSecurity security,uint size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool InitializeProcThreadAttributeList(IntPtr attrs,int count,uint flags,ref IntPtr size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateProcThreadAttribute(IntPtr attrs,uint flags,IntPtr key,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr attrs);
    [DllImport("advapi32.dll",SetLastError=true)]
    static extern bool OpenProcessToken(IntPtr process,uint access,out IntPtr token);
    [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr sa,IntPtr name);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref ExtendedLimits limits,int size);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out Accounting value,int size,IntPtr returned);
    [DllImport("kernel32.dll",EntryPoint="QueryInformationJobObject",SetLastError=true)] static extern bool QueryJobProcessIds(IntPtr job,int kind,IntPtr value,int size,IntPtr returned);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exitCode);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint exitCode);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool CloseHandle(IntPtr handle);

    static void Require(bool value,string stage) { if(!value) throw new Win32Exception(Marshal.GetLastWin32Error(),stage); }
    static void Close(IntPtr handle) { if(handle!=IntPtr.Zero) CloseHandle(handle); }
    static void Close(ref IntPtr handle) { Close(handle); handle=IntPtr.Zero; }
    // Keep a bounded rolling diagnostic tail; do not interpret guest text as evidence.
    sealed class Capture {
        const int Limit=32768;
        readonly byte[] ring=new byte[Limit];
        int next,count;
        internal bool failed;
        internal readonly Thread reader;
        internal Capture(IntPtr handle) {
            reader=new Thread(delegate() {
                try {
                    using(var stream=new FileStream(new SafeFileHandle(handle,true),FileAccess.Read,4096,false)) {
                        var chunk=new byte[4096]; int n;
                        while((n=stream.Read(chunk,0,chunk.Length))>0) {
                            for(int i=0;i<n;i++) { ring[next]=chunk[i]; next=(next+1)%Limit; if(count<Limit) count++; }
                        }
                    }
                } catch(IOException e) { int code=e.HResult&0xffff; failed=code!=109&&code!=232; }
                catch(Exception) { failed=true; }
            });
            reader.IsBackground=true; reader.Start();
        }
        internal string Tail() {
            byte[] value=new byte[count]; int start=(next-count+Limit)%Limit;
            for(int i=0;i<count;i++) value[i]=ring[(start+i)%Limit];
            return Convert.ToBase64String(value);
        }
    }
    static string QuotePs(string value) { return "'" + value.Replace("'","''") + "'"; }
    static string stage="initial";
    static void CheckToken(IntPtr token,string sid) {
        using(var identity=new WindowsIdentity(token)) {
            if(identity.User.Value!=sid || new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)
                || identity.User.IsWellKnown(WellKnownSidType.LocalSystemSid)) throw new InvalidOperationException("GUEST_TOKEN_MISMATCH");
        }
    }
    static List<string> ReadJobProcessIds(IntPtr job) {
        const int capacity=64;
        int bytes=8+IntPtr.Size*capacity;
        IntPtr buffer=Marshal.AllocHGlobal(bytes);
        try {
            Require(QueryJobProcessIds(job,3,buffer,bytes,IntPtr.Zero),"job_process_ids");
            int assigned=Marshal.ReadInt32(buffer,0), count=Marshal.ReadInt32(buffer,4);
            if(assigned!=count || count<1 || count>capacity) throw new InvalidOperationException("JOB_PROCESS_LIST_INCOMPLETE");
            var ids=new List<string>();
            for(int i=0;i<count;i++) {
                long pid=Marshal.ReadIntPtr(buffer,8+i*IntPtr.Size).ToInt64();
                if(pid<=0 || pid>Int32.MaxValue || ids.Contains(pid.ToString())) throw new InvalidOperationException("INVALID_JOB_PROCESS_ID");
                ids.Add(pid.ToString());
            }
            return ids;
        } finally { Marshal.FreeHGlobal(buffer); }
    }
    static bool Run(IntPtr token,string sid,string root,string name,string script,uint expectedExit,int limitMs,bool cancel,StreamWriter log,string nativeExe=null,string nativeArgs=null,string workDir=null,string envBlock=null) {
        var windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
        var executable=Path.Combine(windows,@"System32\WindowsPowerShell\v1.0\powershell.exe");
        var guest=Path.Combine(root,"guest");
        string encoded=Convert.ToBase64String(Encoding.Unicode.GetBytes(script));
        if(nativeExe!=null) executable=nativeExe;
        bool actualSuite=nativeExe!=null;
        var command=new StringBuilder("\""+executable+"\" "+(actualSuite?nativeArgs:"-NoLogo -NoProfile -NonInteractive -EncodedCommand "+encoded));
        var environment=Marshal.StringToHGlobalUni(envBlock??("PATH="+Path.Combine(windows,"System32")+"\0SystemRoot="+windows+"\0TEMP="+guest+"\0TMP="+guest+"\0WINDIR="+windows+"\0\0"));
        IntPtr job=IntPtr.Zero,childToken=IntPtr.Zero;
        ProcessInfo child=new ProcessInfo();
        bool assigned=false,attrsInitialized=false;
        IntPtr input=IntPtr.Zero,inputWrite=IntPtr.Zero,output=IntPtr.Zero,outputWrite=IntPtr.Zero,error=IntPtr.Zero,errorWrite=IntPtr.Zero,attrs=IntPtr.Zero,handleList=IntPtr.Zero;
        Capture stdout=null,stderr=null;
        try {
            stage=name+":job_create";
            job=CreateJobObject(IntPtr.Zero,IntPtr.Zero);
            Require(job!=IntPtr.Zero,"job_create");
            var limits=new ExtendedLimits(); limits.basic.flags=KillOnClose;
            Require(SetInformationJobObject(job,9,ref limits,Marshal.SizeOf(typeof(ExtendedLimits))),"job_limits");
            var startup=new Startup(); startup.cb=Marshal.SizeOf(typeof(Startup));
            stage=name+":process_create";
            if(actualSuite) {
                // Inherit exactly three pipe endpoints, never the job or privileged handles.
                var pipe=new PipeSecurity {size=Marshal.SizeOf(typeof(PipeSecurity)),inherit=1};
                Require(CreatePipe(out input,out inputWrite,ref pipe,0),"stdin_pipe");
                Require(CreatePipe(out output,out outputWrite,ref pipe,0),"stdout_pipe");
                Require(CreatePipe(out error,out errorWrite,ref pipe,0),"stderr_pipe");
                Require(SetHandleInformation(output,1,0),"stdout_private");
                Require(SetHandleInformation(error,1,0),"stderr_private");
                Close(ref inputWrite);
                IntPtr size=IntPtr.Zero;
                InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);
                Require(size!=IntPtr.Zero,"attribute_size");
                attrs=Marshal.AllocHGlobal(size);
                Require(InitializeProcThreadAttributeList(attrs,1,0,ref size),"attribute_init"); attrsInitialized=true;
                handleList=Marshal.AllocHGlobal(IntPtr.Size*3);
                Marshal.WriteIntPtr(handleList,0,input);
                Marshal.WriteIntPtr(handleList,IntPtr.Size,outputWrite);
                Marshal.WriteIntPtr(handleList,IntPtr.Size*2,errorWrite);
                Require(UpdateProcThreadAttribute(attrs,0,new IntPtr(0x20002),handleList,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero),"handle_list");
                startup.cb=Marshal.SizeOf(typeof(StartupEx)); startup.flags=0x100; startup.input=input; startup.output=outputWrite; startup.error=errorWrite;
                var extended=new StartupEx {info=startup,attributes=attrs};
                Require(CreateProcessWithCapture(token,executable,command,IntPtr.Zero,IntPtr.Zero,true,Suspended|UnicodeEnvironment|NoWindow|0x80000,environment,workDir??guest,ref extended,out child),"process_create_capture");
            } else {
                Require(CreateProcessAsUser(token,executable,command,IntPtr.Zero,IntPtr.Zero,false,Suspended|UnicodeEnvironment|NoWindow,environment,workDir??guest,ref startup,out child),"process_create");
            }
            Require(AssignProcessToJobObject(job,child.process),"job_assign"); assigned=true;
            stage=name+":token_open";
            Require(OpenProcessToken(child.process,Query|Duplicate,out childToken),"token_open");
            stage=name+":token_check";
            CheckToken(childToken,sid);
            if(actualSuite) {
                Close(ref input); Close(ref outputWrite); Close(ref errorWrite);
                stdout=new Capture(output); output=IntPtr.Zero;
                stderr=new Capture(error); error=IntPtr.Zero;
            }
            stage=name+":resume";
            Require(ResumeThread(child.thread)!=uint.MaxValue,"thread_resume");
            if(name=="observer_loss") {
                // The fixture launches an explicit child which stays alive. Record
                // membership from the native job, not a candidate-written receipt.
                stage=name+":membership";
                var deadline=Stopwatch.StartNew();
                List<string> ids;
                do {
                    if(WaitForSingleObject(child.process,0)!=WaitTimeout) throw new InvalidOperationException("LOSS_FIXTURE_EXITED_EARLY");
                    ids=ReadJobProcessIds(job);
                    if(ids.Count>=3) break;
                    Thread.Sleep(50);
                } while(deadline.ElapsedMilliseconds<10000);
                if(ids.Count<3 || !ids.Contains(child.pid.ToString())) throw new InvalidOperationException("LOSS_MEMBERS_NOT_OBSERVED");
                log.WriteLine("RAW_OBSERVER_LOSS_READY supervisor="+Process.GetCurrentProcess().Id+"; members="+String.Join(",",ids.ToArray()));
                // An outside fixture controller must forcibly terminate this
                // supervisor. A normal return cannot certify observer loss.
                Thread.Sleep(60000);
                throw new InvalidOperationException("LOSS_CONTROLLER_DID_NOT_TERMINATE");
            }
            stage=name+":wait";
            var elapsed=Stopwatch.StartNew();
            uint state=WaitForSingleObject(child.process,(uint)limitMs);
            string result;
            uint exit=0;
            if(state==WaitObject) {
                Require(GetExitCodeProcess(child.process,out exit),"exit_read");
                if(!actualSuite && (cancel || exit!=expectedExit || limitMs<2000)) throw new InvalidOperationException("UNEXPECTED_NATIVE_EXIT");
                result="completed";
            } else if(state==WaitTimeout) {
                if(!actualSuite && limitMs>=2000 && !cancel) throw new InvalidOperationException("UNEXPECTED_NATIVE_TIMEOUT");
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
            if(actualSuite) {
                if(!stdout.reader.Join(5000)||!stderr.reader.Join(5000)||stdout.failed||stderr.failed) throw new InvalidOperationException("CAPTURE_DRAIN_FAILED");
                // Distinct prefixed encoded records in protected log; bounded, non-authoritative.
                File.WriteAllText(Path.Combine(root,name+".stdout.b64"),stdout.Tail());
                File.WriteAllText(Path.Combine(root,name+".stderr.b64"),stderr.Tail());
            }
            return result=="completed" && exit==0;
        } finally {
            if(assigned) TerminateJobObject(job,125);
            else if(child.process!=IntPtr.Zero) TerminateProcess(child.process,125);
            Close(childToken); Close(child.thread); Close(child.process); Close(job);
            Close(ref input); Close(ref inputWrite); Close(ref output); Close(ref outputWrite); Close(ref error); Close(ref errorWrite);
            if(attrsInitialized) DeleteProcThreadAttributeList(attrs);
            if(attrs!=IntPtr.Zero) Marshal.FreeHGlobal(attrs);
            if(handleList!=IntPtr.Zero) Marshal.FreeHGlobal(handleList);
            Marshal.FreeHGlobal(environment);
        }
    }
    static int Main(string[] args) {
        if(args.Length!=3 && (args.Length!=4 || (args[3]!="loss" && args[3]!="tunnel"))) return 2;
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
                if(args.Length==4 && args[3]=="tunnel") {
                    // Fixed native Node entry only; no candidate-defined command or supervisor credential.
                    var guest=Path.Combine(root,"guest");
                    var source=Path.Combine(guest,"source");
                    var scratch=Path.Combine(guest,"run");
                    var tools=Path.Combine(root,"tools");
                    var node=Path.Combine(tools,"node.exe");
                    var npm=Path.Combine(tools,@"node_modules\npm\bin\npm-cli.js");
                    var entry=Path.Combine(source,@"tests\mcp-tunnel-launcher.test.mjs");
                    var windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
                    var system=Path.Combine(windows,"System32");
                    var git=File.ReadAllText(Path.Combine(root,"git-dir.txt")).Trim();
                    if(!Path.IsPathRooted(git) || !File.Exists(Path.Combine(git,"git.exe")) || !File.Exists(node) || !File.Exists(npm) || !File.Exists(entry)) throw new InvalidOperationException("FIXTURE_INPUT_MISSING");
                    var profile=Path.Combine(scratch,"profile");
                    Directory.CreateDirectory(profile);
                    // No inherited GitHub token, OIDC, or supervisor environment.
                    var env=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase) {
                        {"APPDATA",Path.Combine(profile,"AppData","Roaming")},{"CI","1"},{"COMSPEC",Path.Combine(system,"cmd.exe")},
                        {"GIT_CONFIG_GLOBAL","NUL"},{"GIT_CONFIG_NOSYSTEM","1"},{"GIT_TERMINAL_PROMPT","0"},{"HOME",profile},{"LOCALAPPDATA",Path.Combine(profile,"AppData","Local")},
                        {"NPM_CONFIG_CACHE",Path.Combine(scratch,"npm-cache")},{"PATH",tools+";"+git+";"+system+";"+Path.Combine(system,@"WindowsPowerShell\v1.0")},{"PATHEXT",".COM;.EXE;.BAT;.CMD"},
                        {"SystemDrive",Path.GetPathRoot(windows).TrimEnd('\\')},{"SystemRoot",windows},{"TEMP",scratch},{"TMP",scratch},{"USERPROFILE",profile},{"WINDIR",windows},
                        {"WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL","1"},{"WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT","1"},{"WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION","1"}
                    };
                    var block=new StringBuilder(); foreach(var item in env) block.Append(item.Key+"="+item.Value+"\0"); block.Append("\0");
                    var environment=block.ToString();
                    if(!Run(token,sid,root,"npm_prepare","",0,600000,false,log,node,"\""+npm+"\" ci --ignore-scripts --no-audit --no-fund",source,environment)) return 1;
                    if(!Run(token,sid,root,"mcp_tunnel","",0,1200000,false,log,node,"\""+entry+"\"",source,environment)) return 1;
                    log.WriteLine("RAW_OBSERVER_TUNNEL_PILOT_PASS");
                    return 0;
                }
                if(args.Length==4) {
                    string loss="$ErrorActionPreference='Stop'; $p=[Diagnostics.ProcessStartInfo]::new([IO.Path]::Combine($PSHOME,'powershell.exe'),'-NoProfile -NonInteractive -Command [Threading.Thread]::Sleep(90000)'); $p.UseShellExecute=$false; $p.CreateNoWindow=$true; $child=[Diagnostics.Process]::Start($p); if ($null -eq $child -or $child.HasExited) { exit 93 }; [Threading.Thread]::Sleep(90000)";
                    Run(token,sid,root,"observer_loss",loss,0,10000,false,log);
                    return 1;
                }
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

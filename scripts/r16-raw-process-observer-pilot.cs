// R16 disposable native observer feasibility test. No production dispatch,
// signing, credentials from candidate code, or candidate acceptance.
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Security.Cryptography;
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
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]
    struct ProfileInfo { public int size,flags; public string user,path,defaultPath,server,policy; public IntPtr handle; }
    [DllImport("userenv.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool LoadUserProfile(IntPtr token,ref ProfileInfo profile);
    [DllImport("userenv.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool GetUserProfileDirectory(IntPtr token,StringBuilder path,ref uint length);
    [DllImport("userenv.dll",SetLastError=true)] static extern bool UnloadUserProfile(IntPtr token,IntPtr profile);
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
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForMultipleObjects(uint count,IntPtr[] handles,bool all,uint ms);
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
        EventWaitHandle cancellation=null;
        Thread cancellationSource=null;
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
            uint state;
            if(cancel) {
                cancellation=new EventWaitHandle(false,EventResetMode.ManualReset);
                var signal=cancellation;
                cancellationSource=new Thread(delegate() { Thread.Sleep(1000); signal.Set(); });
                cancellationSource.IsBackground=true;
                cancellationSource.Start();
                state=WaitForMultipleObjects(2,new[]{child.process,cancellation.SafeWaitHandle.DangerousGetHandle()},false,(uint)limitMs);
            } else state=WaitForSingleObject(child.process,(uint)limitMs);
            string result;
            uint exit=0;
            if(state==WaitObject) {
                Require(GetExitCodeProcess(child.process,out exit),"exit_read");
                if(!actualSuite && (cancel || exit!=expectedExit || limitMs<2000)) throw new InvalidOperationException("UNEXPECTED_NATIVE_EXIT");
                result="completed";
            } else if(state==WaitObject+1 && cancel) {
                if(WaitForSingleObject(child.process,0)!=WaitTimeout) throw new InvalidOperationException("CANCELLED_CHILD_NOT_RUNNING");
                result="cancelled";
            } else if(state==WaitTimeout) {
                if(cancel || (!actualSuite && limitMs>=2000)) throw new InvalidOperationException("UNEXPECTED_NATIVE_TIMEOUT");
                result="timed_out";
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
            if(cancellationSource!=null) cancellationSource.Join();
            if(cancellation!=null) cancellation.Dispose();
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

    // Disposable pilot only. Copy regular single-link file bytes from the
    // drained preparation job into new supervisor-owned objects. Never
    // apply ACLs recursively to an account-controlled directory tree.
    [StructLayout(LayoutKind.Sequential)]
    struct FileIdentity {
        public uint attributes;
        public System.Runtime.InteropServices.ComTypes.FILETIME creation,access,write;
        public uint volume,sizeHigh,sizeLow,links,indexHigh,indexLow;
    }
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool GetFileInformationByHandle(SafeFileHandle file,out FileIdentity identity);
    sealed class TreeBudget {
        public int count;
        public long bytes;
    }
    static void CheckRegular(string p,bool directory) {
        var a=File.GetAttributes(p);
        if((a&FileAttributes.ReparsePoint)!=0 || ((a&FileAttributes.Directory)!=0)!=directory)
            throw new InvalidOperationException("DEPENDENCY_UNSUPPORTED_OBJECT");
    }
    static string HashBytes(byte[] data) {
        using(var h=SHA256.Create()) return BitConverter.ToString(h.ComputeHash(data)).Replace("-","").ToLowerInvariant();
    }
    static void ReadTree(string from,string to,string relative,StringBuilder manifest,TreeBudget budget,int depth) {
        if(depth>100 || ++budget.count>200000) throw new InvalidOperationException("DEPENDENCY_TREE_BUDGET");
        CheckRegular(from,true);
        if(to!=null) {
            if(Directory.Exists(to)||File.Exists(to)) throw new InvalidOperationException("DEPENDENCY_COPY_COLLISION");
            Directory.CreateDirectory(to);
            CheckRegular(to,true);
        }
        manifest.Append("D ").Append(Convert.ToBase64String(Encoding.UTF8.GetBytes(relative))).Append('\n');
        var entries=Directory.GetFileSystemEntries(from);
        Array.Sort(entries,StringComparer.Ordinal);
        foreach(var p in entries) {
            var name=Path.GetFileName(p);
            if(name.Length==0 || name.IndexOf(':')>=0) throw new InvalidOperationException("DEPENDENCY_INVALID_NAME");
            var rel=relative.Length==0?name:relative+"/"+name;
            var dst=to==null?null:Path.Combine(to,name);
            var attr=File.GetAttributes(p);
            if((attr&FileAttributes.ReparsePoint)!=0) throw new InvalidOperationException("DEPENDENCY_REPARSE_POINT");
            if((attr&FileAttributes.Directory)!=0) { ReadTree(p,dst,rel,manifest,budget,depth+1); continue; }
            if(++budget.count>200000) throw new InvalidOperationException("DEPENDENCY_TREE_BUDGET");
            CheckRegular(p,false);
            using(var input=new FileStream(p,FileMode.Open,FileAccess.Read,FileShare.Read)) {
                FileIdentity info;
                Require(GetFileInformationByHandle(input.SafeFileHandle,out info),"dependency_file_identity");
                if(info.links!=1 || (info.attributes&0x400)!=0) throw new InvalidOperationException("DEPENDENCY_UNSUPPORTED_FILE_IDENTITY");
                budget.bytes=checked(budget.bytes+input.Length);
                if(budget.bytes>4L*1024*1024*1024) throw new InvalidOperationException("DEPENDENCY_BYTE_BUDGET");
                string hash;
                using(var h=SHA256.Create()) hash=BitConverter.ToString(h.ComputeHash(input)).Replace("-","").ToLowerInvariant();
                if(dst!=null) {
                    input.Position=0;
                    using(var output=new FileStream(dst,FileMode.CreateNew,FileAccess.Write,FileShare.None)) input.CopyTo(output);
                }
                manifest.Append("F ").Append(Convert.ToBase64String(Encoding.UTF8.GetBytes(rel))).Append(' ').Append(hash).Append('\n');
            }
        }
    }
    static string TreeDigest(string from,string to) {
        var m=new StringBuilder(); var budget=new TreeBudget();
        ReadTree(from,to,"",m,budget,0);
        if(budget.count<2 || budget.bytes<1) throw new InvalidOperationException("DEPENDENCY_EMPTY_TREE");
        return HashBytes(Encoding.UTF8.GetBytes(m.ToString()));
    }
    static string SealPreparedTree(string root,string source) {
        var deps=Path.Combine(source,"node_modules");
        var quarantine=Path.Combine(root,"prepared-dependency-quarantine");
        CheckRegular(deps,true);
        if(Directory.Exists(quarantine)||File.Exists(quarantine)) throw new InvalidOperationException("DEPENDENCY_QUARANTINE_COLLISION");
        // Preparation Run has returned with its native job drained. The old
        // objects are not used by the test guest; the new tree inherits RX
        // for both ordinary accounts from the supervisor-owned source root.
        Directory.Move(deps,quarantine);
        var original=TreeDigest(quarantine,deps);
        var sealedDigest=TreeDigest(deps,null);
        if(original!=sealedDigest) throw new InvalidOperationException("DEPENDENCY_COPY_MISMATCH");
        return sealedDigest;
    }
    static string DependencyDenialScript(string source) {
        return "$ErrorActionPreference='Stop'; $dependency="+QuotePs(Path.Combine(source,@"node_modules\@modelcontextprotocol\sdk\package.json"))+"; $dir="+QuotePs(Path.Combine(source,"node_modules"))+"; "
            +"if([IO.File]::ReadAllBytes($dependency).Length -lt 1){exit 95}; "
            +"try { $h=[IO.File]::Open($dependency,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite); $h.Dispose(); exit 96 } catch [UnauthorizedAccessException] {}; "
            +"try { [IO.File]::WriteAllText([IO.Path]::Combine($dir,'.r16-seal-forbidden'),'bad'); exit 97 } catch [UnauthorizedAccessException] {}; "
            +"try { [IO.File]::Delete($dependency); exit 98 } catch [UnauthorizedAccessException] {}; if(-not [IO.File]::Exists($dependency)){exit 99}; exit 0";
    }

    static int Main(string[] args) {
        if(args.Length!=3 && (args.Length!=4 || (args[3]!="loss" && args[3]!="tunnel" && args[3]!="mcp" && args[3]!="tunnel_protected")) && (args.Length!=6 || (args[3]!="tunnel_protected" && args[3]!="tunnel_sealed" && args[3]!="mcp_sealed"))) return 2;
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
                if(args.Length>=4 && (args[3]=="tunnel" || args[3]=="mcp" || args[3]=="tunnel_protected" || args[3]=="tunnel_sealed" || args[3]=="mcp_sealed")) {
                    bool separatePrep=args.Length==6;
                    bool sealDependencies=args[3]=="tunnel_sealed" || args[3]=="mcp_sealed";
                    bool protectedSource=args[3]=="tunnel_protected" || sealDependencies;
                    string sealedDependencies=null, sealedTools=null;
                    bool fullMcp=args[3]=="mcp" || args[3]=="mcp_sealed";
                    string suite=fullMcp?"mcp":"mcp_tunnel";
                    // Fixed native Node entry only; no candidate-defined command or supervisor credential.
                    var guest=Path.Combine(root,"guest");
                    var source=protectedSource?Path.Combine(root,"protected-source"):Path.Combine(guest,"source");
                    var scratch=Path.Combine(guest,"run");
                    var tools=Path.Combine(root,"tools");
                    var node=Path.Combine(tools,"node.exe");
                    var npm=Path.Combine(tools,@"node_modules\npm\bin\npm-cli.js");
                    var entry=Path.Combine(source,fullMcp?@"tests\tools\mcp-contract.test.mjs":@"tests\mcp-tunnel-launcher.test.mjs");
                    var windows=Environment.GetFolderPath(Environment.SpecialFolder.Windows);
                    var system=Path.Combine(windows,"System32");
                    var programFiles=Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
                    var commonData=Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
                    if(!Path.IsPathRooted(programFiles)||!Directory.Exists(programFiles)||!Path.IsPathRooted(commonData)||!Directory.Exists(commonData)) throw new InvalidOperationException("SYSTEM_DIRECTORY_IDENTITY_MISSING");
                    var git=File.ReadAllText(Path.Combine(root,"git-dir.txt")).Trim();
                    if(!Path.IsPathRooted(git) || !File.Exists(Path.Combine(git,"git.exe")) || !File.Exists(node) || !File.Exists(npm) || !File.Exists(entry)) throw new InvalidOperationException("FIXTURE_INPUT_MISSING");
                    // A batch token does not load the user's registry hive by itself.
                    // DPAPI and Windows PowerShell command discovery need the real
                    // disposable account profile, not a fabricated USERPROFILE.
                    var loaded=new ProfileInfo {size=Marshal.SizeOf(typeof(ProfileInfo)),flags=1,user=user};
                    stage="guest_profile_load";
                    Require(LoadUserProfile(token,ref loaded),"load_guest_profile");
                    try {
                    uint length=32768;
                    var profilePath=new StringBuilder((int)length);
                    Require(GetUserProfileDirectory(token,profilePath,ref length),"guest_profile_path");
                    var profile=profilePath.ToString();
                    if(!Path.IsPathRooted(profile) || String.Equals(profile,Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("GUEST_PROFILE_MISMATCH");
                    var cache=Path.Combine(scratch,"guest-module-analysis-cache");
                    // No inherited GitHub token, OIDC, or supervisor environment.
                    var env=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase) {
                        {"APPDATA",Path.Combine(profile,"AppData","Roaming")},{"CI","1"},{"COMSPEC",Path.Combine(system,"cmd.exe")},
                        {"GIT_CONFIG_GLOBAL","NUL"},{"GIT_CONFIG_NOSYSTEM","1"},{"GIT_TERMINAL_PROMPT","0"},{"HOME",profile},{"LOCALAPPDATA",Path.Combine(profile,"AppData","Local")},
                        {"PSModuleAnalysisCachePath",cache},{"PSModulePath",Path.Combine(system,@"WindowsPowerShell\v1.0\Modules")},{"NPM_CONFIG_CACHE",Path.Combine(scratch,"npm-cache")},{"PATH",tools+";"+git+";"+system+";"+Path.Combine(system,@"WindowsPowerShell\v1.0")},{"PATHEXT",".COM;.EXE;.BAT;.CMD"},
                        {"ProgramFiles",programFiles},{"ProgramW6432",programFiles},{"ProgramData",commonData},{"SystemDrive",Path.GetPathRoot(windows).TrimEnd('\\')},{"SystemRoot",windows},{"TEMP",scratch},{"TMP",scratch},{"USERPROFILE",profile},{"WINDIR",windows},
                        {"WRITER_WORKBENCH_ISOLATED_TEST_JOURNAL","1"},{"WRITER_WORKBENCH_ISOLATED_TEST_CHECKPOINT","1"},{"WRITER_WORKBENCH_ISOLATED_TEST_TRANSACTION","1"}
                    };
                    if(protectedSource) {
                        // A controlled child deliberately drops GIT_CONFIG_*.
                        // Use only the fresh disposable account's global config,
                        // not a process-wide override or a shared trust exception.
                        env.Remove("GIT_CONFIG_GLOBAL");
                    }
                    var block=new StringBuilder(); foreach(var item in env) block.Append(item.Key+"="+item.Value+"\0"); block.Append("\0");
                    var environment=block.ToString();
                    // Populate only the guest's own cache as the guest. Never
                    // import or trust this cache from the supervisor process.
                    var powershell=Path.Combine(system,@"WindowsPowerShell\v1.0\powershell.exe");
                    string warm="$ErrorActionPreference='Stop'; Write-Output 'guest-powershell-ready'; "
                        + "$deadline=[DateTime]::UtcNow.AddSeconds(40); $cache=$env:PSModuleAnalysisCachePath; "
                        + "while ([DateTime]::UtcNow -lt $deadline) { if ([IO.File]::Exists($cache)) { $length=([IO.FileInfo]::new($cache)).Length; if ($length -gt 0) { [Console]::WriteLine('GUEST_CACHE_BYTES='+$length); break } }; [Threading.Thread]::Sleep(250) }; "
                        + "if (-not [IO.File]::Exists($cache)) { [Console]::WriteLine('GUEST_CACHE_NOT_WRITTEN') }";
                    var warmArgs="-NoLogo -NoProfile -NonInteractive -EncodedCommand "+Convert.ToBase64String(Encoding.Unicode.GetBytes(warm));
                    if(!Run(token,sid,root,"guest_profile_prepare","",0,120000,false,log,powershell,warmArgs,source,environment)) return 1;
                    if(protectedSource) {
                        var guestGit=Path.Combine(git,"git.exe");
                        var globalConfig=Path.Combine(profile,".gitconfig");
                        if(File.Exists(globalConfig)) throw new InvalidOperationException("DISPOSABLE_GIT_CONFIG_EXISTS");
                        string configure="config --global --add safe.directory \""+source.Replace('\\','/')+"\"";
                        if(!Run(token,sid,root,"protected_git_config","",0,10000,false,log,guestGit,configure,source,environment)) return 1;
                        // This is the same controlled environment boundary as the
                        // shared-workspace resolver: no caller Git config overrides.
                        if(!Run(token,sid,root,"protected_git_identity","",0,10000,false,log,guestGit,"--no-pager -c core.fsmonitor=false rev-parse --verify HEAD",source,environment)) return 1;
                        var observed=Encoding.UTF8.GetString(Convert.FromBase64String(File.ReadAllText(Path.Combine(root,"protected_git_identity.stdout.b64")))).Trim();
                        var expected=File.ReadAllText(Path.Combine(root,"candidate-sha.txt")).Trim();
                        if(expected.Length!=40 || observed!=expected) throw new InvalidOperationException("PROTECTED_GIT_HEAD_MISMATCH");
                        log.WriteLine("PROTECTED_GIT_IDENTITY_PASS");
                    }
                    string npmArgs="\""+npm+"\" ci --ignore-scripts --no-audit --no-fund";
                    if(separatePrep) {
                        // Dependency preparation has a different standard-user SID.
                        // No test guest can read its password or writable cache.
                        var prepUser=args[4]; var prepSid=args[5];
                        if(prepSid==sid) throw new InvalidOperationException("DEPENDENCY_IDENTITY_COLLISION");
                        var prepSecret=Path.Combine(root,"prep-password.txt");
                        var prepPassword=File.ReadAllText(prepSecret); File.Delete(prepSecret);
                        IntPtr prepToken=IntPtr.Zero;
                        try {
                            Require(LogonUser(prepUser,Environment.MachineName,prepPassword,4,0,out prepToken),"dependency_batch_logon");
                            prepPassword=null; CheckToken(prepToken,prepSid);
                            var prepProfile=new ProfileInfo {size=Marshal.SizeOf(typeof(ProfileInfo)),flags=1,user=prepUser};
                            Require(LoadUserProfile(prepToken,ref prepProfile),"dependency_profile_load");
                            try {
                                uint prepLength=32768;
                                var prepProfilePath=new StringBuilder((int)prepLength);
                                Require(GetUserProfileDirectory(prepToken,prepProfilePath,ref prepLength),"dependency_profile_path");
                                var pp=prepProfilePath.ToString();
                                if(!Path.IsPathRooted(pp)||String.Equals(pp,profile,StringComparison.OrdinalIgnoreCase)) throw new InvalidOperationException("DEPENDENCY_PROFILE_COLLISION");
                                var prepScratch=Path.Combine(root,"prep-run");
                                var prepEnv=new SortedDictionary<string,string>(env,StringComparer.OrdinalIgnoreCase);
                                prepEnv["APPDATA"]=Path.Combine(pp,"AppData","Roaming");
                                prepEnv["LOCALAPPDATA"]=Path.Combine(pp,"AppData","Local");
                                prepEnv["HOME"]=pp; prepEnv["USERPROFILE"]=pp;
                                prepEnv["TEMP"]=prepScratch; prepEnv["TMP"]=prepScratch;
                                prepEnv["PSModuleAnalysisCachePath"]=Path.Combine(prepScratch,"module-cache");
                                prepEnv["NPM_CONFIG_CACHE"]=Path.Combine(prepScratch,"npm-cache");
                                // npm preparation does not need Git trust or the guest's profile.
                                prepEnv["GIT_CONFIG_GLOBAL"]="NUL";
                                var prepBlock=new StringBuilder(); foreach(var item in prepEnv) prepBlock.Append(item.Key+"="+item.Value+"\0"); prepBlock.Append("\0");
                                if(!Run(prepToken,prepSid,root,"npm_prepare","",0,600000,false,log,node,npmArgs,source,prepBlock.ToString())) return 1;
                                if(sealDependencies) {
                                    stage="seal_prepared_dependencies";
                                    sealedDependencies=SealPreparedTree(root,source);
                                    sealedTools=TreeDigest(tools,null);
                                    log.WriteLine("SEALED_DEPENDENCY_TREE_SHA256="+sealedDependencies);
                                    log.WriteLine("COPIED_NODE_TOOLCHAIN_SHA256="+sealedTools);
                                    var denialArgs="-NoLogo -NoProfile -NonInteractive -EncodedCommand "+Convert.ToBase64String(Encoding.Unicode.GetBytes(DependencyDenialScript(source)));
                                    if(!Run(prepToken,prepSid,root,"sealed_prep_denial","",0,10000,false,log,powershell,denialArgs,source,prepBlock.ToString())) return 1;
                                }
                            } finally { Require(UnloadUserProfile(prepToken,prepProfile.handle),"dependency_profile_unload"); }
                        } finally { Close(prepToken); }
                    } else if(!Run(token,sid,root,"npm_prepare","",0,600000,false,log,node,npmArgs,source,environment)) return 1;
                    if(protectedSource) {
                        // Test the actual guest token, including directory delete-child rights.
                        // No candidate-controlled script is used for this check.
                        string probe="$ErrorActionPreference='Stop'; $entry="+QuotePs(entry)+"; $source="+QuotePs(source)+"; $canary=[IO.Path]::Combine($source,'.r16-protected-canary'); $tmp=[IO.Path]::Combine($source,'tests','.tmp','r16-write-probe'); "
                            + "if([IO.File]::ReadAllBytes($entry).Length -lt 1){exit 90}; try { $h=[IO.File]::Open($entry,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite); $h.Dispose(); exit 91 } catch [UnauthorizedAccessException] {}; "
                            + "try { [IO.File]::Delete($canary); exit 92 } catch [UnauthorizedAccessException] {}; if(-not [IO.File]::Exists($canary)){exit 93}; "
                            + "try { [IO.File]::WriteAllText([IO.Path]::Combine($source,'.r16-forbidden-write'),'bad'); exit 94 } catch [UnauthorizedAccessException] {}; "
                            + "[IO.File]::WriteAllText($tmp,'ok'); [IO.File]::Delete($tmp); ";
                        if(separatePrep) {
                            probe += "$dependency=[IO.Path]::Combine($source,'node_modules','@modelcontextprotocol','sdk','package.json'); if([IO.File]::ReadAllBytes($dependency).Length -lt 1){exit 95}; "
                                + "try { $h=[IO.File]::Open($dependency,[IO.FileMode]::Open,[IO.FileAccess]::Write,[IO.FileShare]::ReadWrite); $h.Dispose(); exit 96 } catch [UnauthorizedAccessException] {}; "
                                + "try { [IO.File]::WriteAllText([IO.Path]::Combine($source,'node_modules','.r16-forbidden-write'),'bad'); exit 97 } catch [UnauthorizedAccessException] {}; "
                                + "try { [IO.File]::Delete($dependency); exit 98 } catch [UnauthorizedAccessException] {}; if(-not [IO.File]::Exists($dependency)){exit 99}; [Console]::WriteLine('PROTECTED_DEPENDENCY_DENIAL_PASS'); ";
                        }
                        probe += "[Console]::WriteLine('PROTECTED_SOURCE_DENIAL_PASS'); exit 0";
                        string probeArgs="-NoLogo -NoProfile -NonInteractive -EncodedCommand "+Convert.ToBase64String(Encoding.Unicode.GetBytes(probe));
                        if(!Run(token,sid,root,"protected_source_probe","",0,10000,false,log,powershell,probeArgs,source,environment)) return 1;
                    }
                    if(!Run(token,sid,root,suite,"",0,fullMcp?2700000:1200000,false,log,node,"\""+entry+"\"",source,environment)) return 1;
                    if(sealDependencies) {
                        stage="sealed_tree_postcheck";
                        if(TreeDigest(Path.Combine(source,"node_modules"),null)!=sealedDependencies || TreeDigest(tools,null)!=sealedTools)
                            throw new InvalidOperationException("SEALED_TREE_CHANGED");
                        log.WriteLine("SEALED_DEPENDENCY_POSTCHECK_PASS");
                    }
                    } finally {
                        stage="guest_profile_unload";
                        Require(UnloadUserProfile(token,loaded.handle),"unload_guest_profile");
                    }
                    log.WriteLine(fullMcp?"RAW_OBSERVER_MCP_PILOT_PASS":"RAW_OBSERVER_TUNNEL_PILOT_PASS");
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
                Run(token,sid,root,"cancel","[Threading.Thread]::Sleep(90000)",0,10000,true,log);
                if(File.ReadAllText(Path.Combine(root,"sentinel.txt"))!="synthetic-protected-sentinel") throw new InvalidOperationException("SENTINEL_CHANGED");
                log.WriteLine("RAW_OBSERVER_PILOT_PASS");
                return 0;
            } catch(Exception e) { log.WriteLine("RAW_OBSERVER_PILOT_FAIL stage="+stage+" type="+e.GetType().Name+" hresult="+e.HResult.ToString("X8")+" message="+e.Message); return 1; }
            finally { Close(token); }
        }
    }
}

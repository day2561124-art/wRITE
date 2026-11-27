// Dedicated, operator-installed Session 0 station resource provider.
// No guest execution, arbitrary RPC, file staging, shell, or requester paths.
// Each authenticated pipe lease creates only a new station and desktop.
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Text;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;

internal static class NexaStationLeaseProvider {
    [StructLayout(LayoutKind.Sequential)] struct SecurityAttributes {
        public int Size;
        public IntPtr Descriptor;
        public int Inherit;
    }
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr CreateWindowStation(string name, uint flags, uint access, ref SecurityAttributes attributes);
    [DllImport("user32.dll")] static extern IntPtr GetProcessWindowStation();
    [DllImport("user32.dll", SetLastError=true)] static extern bool SetProcessWindowStation(IntPtr station);
    [DllImport("user32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern IntPtr CreateDesktop(string name, IntPtr device, IntPtr mode, uint flags, uint access, ref SecurityAttributes attributes);
    [DllImport("user32.dll", SetLastError=true)] static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("user32.dll", SetLastError=true)] static extern bool CloseWindowStation(IntPtr station);
    [DllImport("userenv.dll", CharSet=CharSet.Unicode)]
    static extern int DeriveAppContainerSidFromAppContainerName(string name, out IntPtr sid);
    [DllImport("advapi32.dll")] static extern IntPtr FreeSid(IntPtr sid);
    [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string value, uint revision, out IntPtr descriptor, out uint size);
    [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr pointer);
    static void Check(bool ok, string stage) {
        if (!ok) throw new InvalidOperationException(stage + " Win32=" + Marshal.GetLastWin32Error());
    }
    static SecurityAttributes Security(string sddl, out IntPtr descriptor) {
        uint size;
        Check(ConvertStringSecurityDescriptorToSecurityDescriptor(sddl, 1, out descriptor, out size), "security descriptor");
        return new SecurityAttributes { Size=Marshal.SizeOf(typeof(SecurityAttributes)), Descriptor=descriptor, Inherit=0 };
    }
    [DllImport("advapi32.dll", SetLastError=true)]
    static extern bool GetTokenInformation(IntPtr token, int type, out int value, int size, out int required);

    static readonly SecurityIdentifier SystemSid = new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null);
    static readonly string PipeName = "NexaStationLeaseV1";
    const int IdleMilliseconds = 20000, LeaseMilliseconds = 145000, MaxLeases = 32;

    static int ReadByteBounded(PipeStream pipe, int milliseconds) {
        byte[] b=new byte[1];
        var pending=pipe.BeginRead(b,0,1,null,null);
        using (var wait = pending.AsyncWaitHandle) {
            if(!wait.WaitOne(milliseconds)) throw new TimeoutException("Lease protocol deadline");
            return pipe.EndRead(pending)==1 ? b[0] : -1;
        }
    }

    static bool IsExpectedCaller(NamedPipeServerStream pipe, SecurityIdentifier user) {
        bool accepted=false;
        pipe.RunAsClient(delegate {
            using(var identity=WindowsIdentity.GetCurrent(true)) {
                if(identity==null || identity.User==null || !identity.User.Equals(user)) return;
                if(new WindowsPrincipal(identity).IsInRole(WindowsBuiltInRole.Administrator)) return;
                int container, session, required;
                if(!GetTokenInformation(identity.Token,29,out container,4,out required) || container!=0) return;
                if(!GetTokenInformation(identity.Token,12,out session,4,out required) || session!=0) return;
                accepted=true;
            }
        });
        return accepted;
    }

    static NamedPipeServerStream Listen(SecurityIdentifier user) {
        var acl=new PipeSecurity();
        acl.SetOwner(SystemSid);
        acl.SetAccessRuleProtection(true,false);
        acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid,null),PipeAccessRights.FullControl,AccessControlType.Deny));
        acl.AddAccessRule(new PipeAccessRule(SystemSid,PipeAccessRights.FullControl,AccessControlType.Allow));
        acl.AddAccessRule(new PipeAccessRule(user,PipeAccessRights.ReadWrite|PipeAccessRights.ReadPermissions|PipeAccessRights.Synchronize,AccessControlType.Allow));
        return new NamedPipeServerStream(PipeName,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous,128,128,acl);
    }

    static void ServeLease(NamedPipeServerStream pipe, SecurityIdentifier user, TextWriter evidence) {
        // Wire: one acquire byte, 32 lowercase hex ASCII bytes generated by
        // the provider, one release byte, one cleanup acknowledgement.
        // No caller-supplied names, paths, commands or access rules.
        if(ReadByteBounded(pipe,5000)!=65 || !IsExpectedCaller(pipe,user)) throw new InvalidOperationException("Unauthorized lease request");
        string id=Guid.NewGuid().ToString("N");
        IntPtr station=IntPtr.Zero, desktop=IntPtr.Zero, stationSd=IntPtr.Zero, desktopSd=IntPtr.Zero, sid=IntPtr.Zero;
        IntPtr prior=GetProcessWindowStation();
        bool switched=false, released=false, cleaned=true;
        try {
            Marshal.ThrowExceptionForHR(DeriveAppContainerSidFromAppContainerName("NexaLease"+id,out sid));
            string package=new SecurityIdentifier(sid).Value;
            var ws=Security("D:P(A;;GA;;;SY)(A;;0x00020123;;;"+user.Value+")(A;;0x00020123;;;"+package+")S:(ML;;NW;;;LW)",out stationSd);
            station=CreateWindowStation("NexaLeaseStation"+id,0,0x000F037F,ref ws);
            int creationError=Marshal.GetLastWin32Error();
            Check(station!=IntPtr.Zero,"create per-run station");
            if(creationError==183) throw new InvalidOperationException("Station already existed");
            Check(SetProcessWindowStation(station),"select per-run station");
            switched=true;
            var ds=Security("D:P(A;;GA;;;SY)(A;;0x00020087;;;"+user.Value+")(A;;0x00020087;;;"+package+")S:(ML;;NW;;;LW)",out desktopSd);
            desktop=CreateDesktop("NexaLeaseDesktop",IntPtr.Zero,IntPtr.Zero,0,0x000F01FF,ref ds);
            Check(desktop!=IntPtr.Zero,"create per-run desktop");
            Check(SetProcessWindowStation(prior),"restore provisioner station");
            switched=false;
            byte[] reply=Encoding.ASCII.GetBytes(id);
            pipe.Write(reply,0,reply.Length); pipe.Flush();
            evidence.WriteLine("acquired="+id+"; package="+package);
            evidence.Flush();
            int terminal=ReadByteBounded(pipe,LeaseMilliseconds);
            if(terminal!=82 && terminal!=-1) throw new InvalidOperationException("Invalid lease terminal");
            released=terminal==82;
        } finally {
            if(switched && !SetProcessWindowStation(prior)) cleaned=false;
            if(desktop!=IntPtr.Zero && !CloseDesktop(desktop)) cleaned=false;
            if(station!=IntPtr.Zero && !CloseWindowStation(station)) cleaned=false;
            if(stationSd!=IntPtr.Zero) LocalFree(stationSd);
            if(desktopSd!=IntPtr.Zero) LocalFree(desktopSd);
            if(sid!=IntPtr.Zero) FreeSid(sid);
            evidence.WriteLine("closed="+id+"; released="+released+"; cleaned="+cleaned);
            evidence.Flush();
            if(!cleaned) throw new InvalidOperationException("Provider handle cleanup failed");
        }
        if(released) { pipe.WriteByte(75); pipe.Flush(); }
    }

    static int Main(string[] args) {
        // Only the fixed installed task supplies the authorized local SID.
        // There is no request inbox, caller-selected filesystem path or action.
        if(args.Length!=1 || Process.GetCurrentProcess().SessionId!=0 || !Environment.Is64BitProcess) return 64;
        using(var identity=WindowsIdentity.GetCurrent()) { if(!identity.IsSystem) return 64; }
        SecurityIdentifier user;
        try { user=new SecurityIdentifier(args[0]); }
        catch(ArgumentException) { return 64; }
        if(!user.IsAccountSid() || user.IsWellKnown(WellKnownSidType.LocalSystemSid)) return 64;
        string root=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"WriterWorkbench-NexaStationLease-v1");
        string exe=Path.Combine(root,"station-lease-provider.exe");
        if(!String.Equals(Path.GetFullPath(Process.GetCurrentProcess().MainModule.FileName),exe,StringComparison.OrdinalIgnoreCase)) return 64;
        if((File.GetAttributes(root)&FileAttributes.ReparsePoint)!=0 ||
           (File.GetAttributes(exe)&FileAttributes.ReparsePoint)!=0) return 64;
        string log=Path.Combine(root,"station-leases.log");
        if(File.Exists(log) && (File.GetAttributes(log)&FileAttributes.ReparsePoint)!=0) return 64;
        // Bounded diagnostic evidence only, not a replacement for the operation journal.
        // The installation directory is protected from the requesting account.
        try {
            using(var output=new FileStream(log,FileMode.Create,FileAccess.Write,FileShare.Read))
            using(var evidence=new StreamWriter(output,new UTF8Encoding(false))) {
                evidence.AutoFlush=true;
                evidence.WriteLine("provider_session=0; owner=SYSTEM");
                for(int count=0;count<MaxLeases;count++) {
                    using(var pipe=Listen(user)) {
                        var pending=pipe.BeginWaitForConnection(null,null);
                        using(var wait=pending.AsyncWaitHandle) {
                            if(!wait.WaitOne(IdleMilliseconds)) return 0;
                            pipe.EndWaitForConnection(pending);
                        }
                        ServeLease(pipe,user,evidence);
                    }
                }
                return 0;
            }
        } catch(Exception e) {
            Console.Error.WriteLine("Station lease provider failed: "+e.Message);
            return 2;
        }
    }
}

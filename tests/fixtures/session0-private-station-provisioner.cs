// Disposable Windows CI fixture ONLY. Never install as a service or execute
// on the production host. No guest execution, RPC, file staging, or shell.
// A distinct station and desktop are retained until a bounded lease expires.
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Threading;

internal static class Session0PrivateStationFixture {
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
    static int Main(string[] args) {
        // The fixture accepts only its disposable account SID and admin-owned
        // evidence directory. It never accepts an executable or guest command.
        if (args.Length != 2 || Process.GetCurrentProcess().SessionId != 0) return 64;
        using (var identity = WindowsIdentity.GetCurrent()) {
            if (!identity.IsSystem) return 64;
        }
        var user = new SecurityIdentifier(args[0]);
        if (!user.IsAccountSid() || user.IsWellKnown(WellKnownSidType.LocalSystemSid)) return 64;
        string root = Path.GetFullPath(args[1]);
        if (!Path.GetFileName(root).StartsWith("NexaDiag-", StringComparison.Ordinal) ||
            !String.Equals(Path.GetDirectoryName(root).TrimEnd('\\'), Path.GetPathRoot(root).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase)) return 64;
        IntPtr station=IntPtr.Zero, desktop=IntPtr.Zero, stationSd=IntPtr.Zero, desktopSd=IntPtr.Zero, sid=IntPtr.Zero;
        IntPtr prior=GetProcessWindowStation();
        bool switched=false;
        string ready=Path.Combine(root, "station-ready.txt");
        string error=Path.Combine(root, "station-error.txt");
        string stopped=Path.Combine(root, "station-stopped.txt");
        int result=0;
        try {
            Marshal.ThrowExceptionForHR(DeriveAppContainerSidFromAppContainerName("NexaDiagFixedProfile", out sid));
            string package=new SecurityIdentifier(sid).Value;
            // These descriptors apply only to newly created objects. No
            // modification of WinSta0, service station or existing desktop.
            // No All Application Packages / Everyone ACE. No hook, clipboard,
            // shutdown, or WRITE_DAC rights for the test user or package.
            var ws=Security("D:P(A;;GA;;;SY)(A;;0x00020123;;;"+user.Value+")(A;;0x00020123;;;"+package+")S:(ML;;NW;;;LW)", out stationSd);
            station=CreateWindowStation("NexaDiagPrivateStation", 0, 0x000F037F, ref ws);
            int creationError=Marshal.GetLastWin32Error();
            Check(station!=IntPtr.Zero, "create independent station");
            if (creationError==183) throw new InvalidOperationException("Station already existed");
            Check(SetProcessWindowStation(station), "select private station");
            switched=true;
            var ds=Security("D:P(A;;GA;;;SY)(A;;0x00020087;;;"+user.Value+")(A;;0x00020087;;;"+package+")S:(ML;;NW;;;LW)", out desktopSd);
            desktop=CreateDesktop("NexaDiagPrivateDesktop", IntPtr.Zero, IntPtr.Zero, 0, 0x000F01FF, ref ds);
            Check(desktop!=IntPtr.Zero, "create private desktop");
            Check(SetProcessWindowStation(prior), "restore provisioner station");
            switched=false;
            File.WriteAllText(ready, "session=0; owner=SYSTEM; private_station=NexaDiagPrivateStation; package="+package);
            var lease=Stopwatch.StartNew();
            while (lease.ElapsedMilliseconds<240000 && !File.Exists(Path.Combine(root,"station-stop.txt"))) Thread.Sleep(200);
            if (!File.Exists(Path.Combine(root,"station-stop.txt"))) throw new TimeoutException("Fixture lease expired");
        } catch(Exception e) {
            File.WriteAllText(error,e.Message);
            result=2;
        } finally {
            if(switched && !SetProcessWindowStation(prior)) result=3;
            if(desktop!=IntPtr.Zero && !CloseDesktop(desktop)) result=3;
            if(station!=IntPtr.Zero && !CloseWindowStation(station)) result=3;
            if(stationSd!=IntPtr.Zero) LocalFree(stationSd);
            if(desktopSd!=IntPtr.Zero) LocalFree(desktopSd);
            if(sid!=IntPtr.Zero) FreeSid(sid);
            File.WriteAllText(stopped, "exit="+result);
        }
        return result;
    }
}

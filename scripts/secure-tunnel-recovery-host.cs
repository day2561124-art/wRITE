using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// Compiled as WindowsApplication: the scheduler never creates a console host.
// The manager intentionally discards stdio. Use NUL rather than async pipes:
// a surviving Runtime must not hold an ancestor's pipe or delay host exit.
internal static class SecureTunnelRecoveryHost
{
    [StructLayout(LayoutKind.Sequential)]
    struct SecurityAttributes {
        public int size; public IntPtr descriptor; public int inherit;
    }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct Startup {
        public int size; public string reserved, desktop, title;
        public uint x,y,xSize,ySize,xCount,yCount,fill,flags;
        public ushort show,reservedSize;
        public IntPtr reservedData,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct StartupEx { public Startup info; public IntPtr attributes; }
    [StructLayout(LayoutKind.Sequential)]
    struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern IntPtr CreateFileW(string name,uint access,uint share,ref SecurityAttributes security,uint disposition,uint flags,IntPtr template);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool CreateProcessW(string application,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr environment,string cwd,ref StartupEx startup,out ProcessInfo process);
    [DllImport("kernel32.dll",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
    [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr handle,uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    static readonly IntPtr Invalid=new IntPtr(-1);

    private static void Close(IntPtr handle) {
        if(handle!=IntPtr.Zero && handle!=Invalid) CloseHandle(handle);
    }
    private static string Quote(string value)
    {
        if (value.IndexOfAny(new[] { '"', '\r', '\n', '\0' }) >= 0)
            throw new ArgumentException();
        return "\"" + value.TrimEnd('\\') + "\"";
    }

    [STAThread]
    private static int Main(string[] args)
    {
        IntPtr input=IntPtr.Zero,output=IntPtr.Zero,error=IntPtr.Zero,list=IntPtr.Zero,handles=IntPtr.Zero;
        bool initialized=false;
        ProcessInfo child=new ProcessInfo();
        try
        {
            if (args.Length != 2) return 2;
            string manager=Path.GetFullPath(args[0]);
            string data=Path.GetFullPath(args[1]);
            string executable=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),
                @"WindowsPowerShell\v1.0\powershell.exe");
            var security=new SecurityAttributes {size=Marshal.SizeOf(typeof(SecurityAttributes)),inherit=1};
            input=CreateFileW("NUL",0x80000000,7,ref security,3,0x80,IntPtr.Zero);
            output=CreateFileW("NUL",0x40000000,7,ref security,3,0x80,IntPtr.Zero);
            error=CreateFileW("NUL",0x40000000,7,ref security,3,0x80,IntPtr.Zero);
            if(input==Invalid || output==Invalid || error==Invalid) return 1;
            IntPtr bytes=IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref bytes);
            if(bytes==IntPtr.Zero) return 1;
            list=Marshal.AllocHGlobal(bytes);
            if(!InitializeProcThreadAttributeList(list,1,0,ref bytes)) return 1;
            initialized=true;
            handles=Marshal.AllocHGlobal(3*IntPtr.Size);
            Marshal.WriteIntPtr(handles,0,input);
            Marshal.WriteIntPtr(handles,IntPtr.Size,output);
            Marshal.WriteIntPtr(handles,2*IntPtr.Size,error);
            // Inherit only NUL endpoints, not the scheduler/observer's pipes.
            if(!UpdateProcThreadAttribute(list,0,new IntPtr(0x20002),handles,new IntPtr(3*IntPtr.Size),IntPtr.Zero,IntPtr.Zero)) return 1;
            var startup=new StartupEx {info=new Startup {size=Marshal.SizeOf(typeof(StartupEx)),flags=0x100,input=input,output=output,error=error},attributes=list};
            var command=new StringBuilder(Quote(executable)+" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "+Quote(manager)
                +" -Action Reconcile -Json -DataDirectory "+Quote(data));
            // No shell, no console, current user's environment and token.
            if(!CreateProcessW(executable,command,IntPtr.Zero,IntPtr.Zero,true,0x08080000,IntPtr.Zero,Path.GetDirectoryName(manager),ref startup,out child)) return 1;
            uint state=WaitForSingleObject(child.process,170000);
            if(state==258) {
                // Only the exact manager handle; never Runtime/Listener descendants.
                if(!TerminateProcess(child.process,3)) return 1;
                if(WaitForSingleObject(child.process,5000)!=0) return 1;
                return 3;
            }
            uint code;
            if(state!=0 || !GetExitCodeProcess(child.process,out code)) return 1;
            return unchecked((int)code);
        }
        catch { return 1; } // No dialogs or raw exceptions from an unattended task.
        finally {
            Close(child.thread); Close(child.process);
            if(initialized) DeleteProcThreadAttributeList(list);
            if(list!=IntPtr.Zero) Marshal.FreeHGlobal(list);
            if(handles!=IntPtr.Zero) Marshal.FreeHGlobal(handles);
            Close(input); Close(output); Close(error);
        }
    }
}

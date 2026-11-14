using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

namespace WriterWorkbench {
    // A narrow HTTP listener launcher, running as the current user. The handle
    // list deliberately excludes inherited ancestor pipes, not just stdio slots.
    public static class McpHttpOwnedProcessV1 {
        [StructLayout(LayoutKind.Sequential)]
        struct SECURITY_ATTRIBUTES { public int nLength; public IntPtr lpSecurityDescriptor; [MarshalAs(UnmanagedType.Bool)] public bool bInheritHandle; }
        [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
        struct STARTUPINFO {
            public int cb; public string lpReserved, lpDesktop, lpTitle;
            public uint dwX,dwY,dwXSize,dwYSize,dwXCountChars,dwYCountChars,dwFillAttribute,dwFlags;
            public ushort wShowWindow,cbReserved2; public IntPtr lpReserved2,hStdInput,hStdOutput,hStdError;
        }
        [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX { public STARTUPINFO StartupInfo; public IntPtr lpAttributeList; }
        [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess,hThread; public uint dwProcessId,dwThreadId; }
        [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
        static extern IntPtr CreateFileW(string name,uint access,uint share,ref SECURITY_ATTRIBUTES security,uint disposition,uint flags,IntPtr template);
        [DllImport("kernel32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)]
        static extern bool SetFilePointerEx(IntPtr file,long distance,out long position,uint method);
        [DllImport("kernel32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)]
        static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
        [DllImport("kernel32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)]
        static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
        [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
        [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)]
        static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,[MarshalAs(UnmanagedType.Bool)] bool inherit,uint flags,IntPtr environment,string cwd,ref STARTUPINFOEX startup,out PROCESS_INFORMATION process);
        [DllImport("kernel32.dll")] [return:MarshalAs(UnmanagedType.Bool)] static extern bool CloseHandle(IntPtr handle);
        static readonly IntPtr Invalid=new IntPtr(-1);
        static void Close(IntPtr handle) { if(handle!=IntPtr.Zero&&handle!=Invalid) CloseHandle(handle); }
        static string Quote(string value) { if(value.IndexOf('"')>=0) throw new ArgumentException("Invalid executable path."); return "\""+value+"\""; }
        static IntPtr Open(string name,uint access,uint disposition,ref SECURITY_ATTRIBUTES security) {
            IntPtr handle=CreateFileW(name,access,7,ref security,disposition,0x80,IntPtr.Zero);
            if(handle==Invalid) throw new Win32Exception(Marshal.GetLastWin32Error()); return handle;
        }
        public static int Start(string node,string root,int port,string stdout,string stderr) {
            if(port<1||port>65535) throw new ArgumentException("Expected a valid MCP port.");
            root=Path.GetFullPath(root);
            string script=Path.Combine(root,"server","src","mcp-http-server.mjs"),config=Path.Combine(root,"config","mcp-http.example.json");
            if(!File.Exists(config)) throw new ArgumentException("Expected Writer Workbench MCP config.");
            return StartNode(node,root,script," --config "+Quote(config)+" --port "+port.ToString(System.Globalization.CultureInfo.InvariantCulture),stdout,stderr);
        }
        public static int StartWorkbenchOAuth(string node,string root,string stdout,string stderr) {
            root=Path.GetFullPath(root);
            return StartNode(node,root,Path.Combine(root,"apps","gm-adapter","security-main.mjs"),"",stdout,stderr);
        }
        static int StartNode(string node,string root,string script,string arguments,string stdout,string stderr) {
            if(!Path.IsPathRooted(node)||!File.Exists(node)||!String.Equals(Path.GetFileName(node),"node.exe",StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("Expected Node executable.");
            if(!Directory.Exists(root)||!File.Exists(script)) throw new ArgumentException("Expected Node service entry point.");
            stdout=Path.GetFullPath(stdout); stderr=Path.GetFullPath(stderr);
            IntPtr input=IntPtr.Zero,output=IntPtr.Zero,error=IntPtr.Zero,list=IntPtr.Zero,handles=IntPtr.Zero; bool initialized=false;
            PROCESS_INFORMATION process=new PROCESS_INFORMATION();
            try {
                SECURITY_ATTRIBUTES security=new SECURITY_ATTRIBUTES(); security.nLength=Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)); security.bInheritHandle=true;
                input=Open("NUL",0x80000000,3,ref security);
                output=Open(stdout,0x40000000,4,ref security); error=Open(stderr,0x40000000,4,ref security);
                long ignored; if(!SetFilePointerEx(output,0,out ignored,2)||!SetFilePointerEx(error,0,out ignored,2)) throw new Win32Exception(Marshal.GetLastWin32Error());
                IntPtr bytes=IntPtr.Zero; InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref bytes);
                if(bytes==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
                list=Marshal.AllocHGlobal(bytes); if(!InitializeProcThreadAttributeList(list,1,0,ref bytes)) throw new Win32Exception(Marshal.GetLastWin32Error()); initialized=true;
                handles=Marshal.AllocHGlobal(3*IntPtr.Size); Marshal.WriteIntPtr(handles,0,input); Marshal.WriteIntPtr(handles,IntPtr.Size,output); Marshal.WriteIntPtr(handles,2*IntPtr.Size,error);
                if(!UpdateProcThreadAttribute(list,0,new IntPtr(0x20002),handles,new IntPtr(3*IntPtr.Size),IntPtr.Zero,IntPtr.Zero)) throw new Win32Exception(Marshal.GetLastWin32Error());
                STARTUPINFOEX startup=new STARTUPINFOEX(); startup.StartupInfo.cb=Marshal.SizeOf(typeof(STARTUPINFOEX)); startup.StartupInfo.dwFlags=0x101;
                startup.StartupInfo.hStdInput=input; startup.StartupInfo.hStdOutput=output; startup.StartupInfo.hStdError=error; startup.lpAttributeList=list;
                StringBuilder command=new StringBuilder(Quote(node)+" "+Quote(script)+arguments);
                // Environment=null preserves the caller's existing scoped environment.
                if(!CreateProcessW(node,command,IntPtr.Zero,IntPtr.Zero,true,0x08080200,IntPtr.Zero,root,ref startup,out process)) throw new Win32Exception(Marshal.GetLastWin32Error());
                return checked((int)process.dwProcessId);
            } finally {
                Close(process.hThread); Close(process.hProcess);
                if(initialized) DeleteProcThreadAttributeList(list); if(list!=IntPtr.Zero) Marshal.FreeHGlobal(list); if(handles!=IntPtr.Zero) Marshal.FreeHGlobal(handles);
                Close(input); Close(output); Close(error);
            }
        }
    }
}

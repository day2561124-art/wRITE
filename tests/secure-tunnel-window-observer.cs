using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// Observe SHOW events, including windows too brief for polling. Run on the
// interactive desktop; never infer window absence from task's Hidden setting.
public sealed class SecureTunnelWindowObserver : IDisposable
{
    private delegate void Callback(IntPtr hook, uint evt, IntPtr hwnd, int obj, int child, uint thread, uint time);
    [StructLayout(LayoutKind.Sequential)] private struct Message {
        public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam;
        public uint time; public int x; public int y; public uint privateValue;
    }
    [DllImport("user32.dll")] private static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr module, Callback callback, uint pid, uint tid, uint flags);
    [DllImport("user32.dll")] private static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll")] private static extern int GetClassName(IntPtr window, StringBuilder value, int size);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll")] private static extern int GetMessage(out Message msg, IntPtr window, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out Message msg, IntPtr window, uint min, uint max, uint remove);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint tid, uint msg, UIntPtr w, IntPtr l);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern IntPtr CreateWindowEx(uint ex, string cls, string title, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr param);
    [DllImport("user32.dll")] private static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern void NotifyWinEvent(uint evt, IntPtr window, int obj, int child);
    private readonly List<string> events = new List<string>();
    private readonly Thread worker;
    private readonly ManualResetEvent ready = new ManualResetEvent(false);
    private uint threadId;
    private bool installed;
    private readonly bool selfTest;
    public SecureTunnelWindowObserver() : this(false) { }
    private SecureTunnelWindowObserver(bool selfTest) {
        this.selfTest = selfTest;
        worker = new Thread(Observe); worker.IsBackground = true; worker.Start();
        if (!ready.WaitOne(5000) || !installed) throw new InvalidOperationException("WINDOW_HOOK_UNAVAILABLE");
    }
    private void Observe() {
        threadId = GetCurrentThreadId();
        Callback callback = delegate(IntPtr hook, uint evt, IntPtr hwnd, int obj, int child, uint tid, uint time) {
            if (obj != 0 || child != 0) return;
            var name = new StringBuilder(256); GetClassName(hwnd, name, name.Capacity);
            string cls = name.ToString();
            if (cls != "ConsoleWindowClass" && cls != "CASCADIA_HOSTING_WINDOW_CLASS" && !(selfTest && cls == "Static")) return;
            uint pid; GetWindowThreadProcessId(hwnd, out pid);
            lock (events) events.Add(cls + ":" + pid);
        };
        IntPtr handle = SetWinEventHook(0x8002, 0x8002, IntPtr.Zero, callback, 0, 0, 0);
        installed = handle != IntPtr.Zero;
        // Force creation of this thread's message queue before signalling readiness.
        Message msg;
        PeekMessage(out msg, IntPtr.Zero, 0, 0, 0);
        ready.Set();
        if (installed) {
            while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) { }
            UnhookWinEvent(handle);
        }
        GC.KeepAlive(callback);
    }
    public string[] Events { get { lock (events) return events.ToArray(); } }
    public static void VerifyHook() {
        using (var probe = new SecureTunnelWindowObserver(true)) {
            // A hidden standard control plus a synthetic SHOW notification tests
            // actual WinEvent delivery without displaying a console/window.
            IntPtr window = CreateWindowEx(0, "Static", "", 0, 0, 0, 0, 0, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
            if (window == IntPtr.Zero) throw new InvalidOperationException("WINDOW_OBSERVER_SELFTEST_FAILED");
            try {
                NotifyWinEvent(0x8002, window, 0, 0);
                for (int i = 0; i < 100 && probe.Events.Length == 0; i++) Thread.Sleep(10);
                if (probe.Events.Length == 0) throw new InvalidOperationException("WINDOW_OBSERVER_SELFTEST_FAILED");
            } finally { DestroyWindow(window); }
        }
    }
    public void Dispose() {
        PostThreadMessage(threadId, 0x0012, UIntPtr.Zero, IntPtr.Zero);
        worker.Join(5000); ready.Dispose();
    }
}

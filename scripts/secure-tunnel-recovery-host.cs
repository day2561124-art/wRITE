using System;
using System.Diagnostics;
using System.IO;

// Compiled as WindowsApplication: the scheduler never creates a console host.
internal static class SecureTunnelRecoveryHost
{
    private static string Quote(string value)
    {
        if (value.IndexOfAny(new[] { '"', '\r', '\n', '\0' }) >= 0)
            throw new ArgumentException();
        return "\"" + value.TrimEnd('\\') + "\"";
    }

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 2) return 2;
            string manager = Path.GetFullPath(args[0]);
            string data = Path.GetFullPath(args[1]);
            var start = new ProcessStartInfo {
                FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),
                    @"WindowsPowerShell\v1.0\powershell.exe"),
                Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File " + Quote(manager)
                    + " -Action Reconcile -Json -DataDirectory " + Quote(data),
                WorkingDirectory = Path.GetDirectoryName(manager),
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                ErrorDialog = false
            };
            using (var process = new Process { StartInfo = start })
            {
                process.OutputDataReceived += delegate { }; // Never retain credentials/error bodies.
                process.ErrorDataReceived += delegate { };
                process.Start();
                process.BeginOutputReadLine();
                process.BeginErrorReadLine();
                if (!process.WaitForExit(170000)) {
                    process.Kill(); // Only this manager; never Runtime/Listener descendants.
                    return 3;
                }
                // A detached Runtime can inherit a pipe handle. Waiting for EOF
                // after the manager exits would then wait for the Runtime itself.
                process.CancelOutputRead();
                process.CancelErrorRead();
                return process.ExitCode;
            }
        }
        catch { return 1; } // No dialogs or raw exceptions from an unattended task.
    }
}

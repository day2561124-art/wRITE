# Pi Workspace PowerShell Contract

The GPT-selected `workspace.powershell` capability runs `powershell_run` through Pi with a durable ExecutionIntent and idempotency receipt. It is not a privileged or direct-host bypass. `host.powershell` retains its prior host-maintenance semantics; `powershell_admin_run` and production lifecycle actions still require separate authority.

Admission requires an active, locked, isolated worktree and exact, trusted workstream/workspace identity. Pi binds `workspace_id`; the caller cannot override it. Rejected cases include shared Main, mismatched IDs, unlocked/inactive workspaces, incorrect capability/tool, or missing write permission.

The underlying PowerShell runner limits command length, workspace-relative realpath CWD, timeout, output, and known destructive commands. It runs as the non-elevated Writer Workbench process identity and journals the operation.

**Security limitation:** Restricting the current working directory does *not* confine filesystem effects. A command or its children can access paths beyond that worktree with the process token. This is not an OS-level sandbox or a completed H1 security boundary. Use least privilege, approved command targets, and separate authorization for host services, production restart, admin execution, and UNKNOWN operation reconciliation.

Acceptance: Pi post-seal tests, affected regression, diff check, controlled integration, remote push verification, then separately authorized runtime activation and live catalog verification. Source integration by itself does not alter the running MCP Parent.

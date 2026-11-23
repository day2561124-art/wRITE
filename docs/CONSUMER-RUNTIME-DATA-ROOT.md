# Isolated consumer runtime data

An embedding application can set `WRITE_DATA_ROOT` **before importing** the runtime to an absolute, independent directory. It must not be an ancestor or child of the source repository. The generic runtime keeps all data directories, agent runs, World state/history, traces, transaction journals, and locks under this configured root. The default, when not set, remains the repository's own `data/` directory.

This variable must be controlled by the trusted service operator and never copied from an untrusted web request. Paths that escape both the code repository and the configured data root remain rejected, including symlink escapes. Invalid and overlapping roots fail closed at module initialization.

The configuration is process-scoped and should be set in the service bootstrap before importing any runtime module. Data previously written to the default storage location are **not moved automatically**; consumers must migrate their own session data with verified copying and explicit lineage checks. Do not silently create a fresh session to replace a missing existing one.

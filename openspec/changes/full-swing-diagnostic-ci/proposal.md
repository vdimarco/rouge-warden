# Keep performance benchmarks diagnostic

The user explicitly requires no FPS-benefit or performance-benchmark merge gate. CI still requires the software-rendered `swing-meter.e2e.mjs` benchmark; docs-only PR #791 failed when it timed out before reporting a sample. Remove that benchmark step from required CI while preserving six jobs and every functional check. Keep the manual benchmark and diagnostic instrumentation available. No runtime or graphics change.

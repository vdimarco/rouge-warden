# Isolated VibeUE pilot

[VibeUE](https://github.com/kevinpbuckley/VibeUE) is pinned to
`dc051be7c49b08e613ca7a2196fe9f39c9b52119` (2026-10-01), version 5.0,
MIT license. It is an editor-only native MCP expansion for UE 5.8.

The local source is `/home/von/.local/share/nord-tools/vibeue-pilot/upstream`.
The external `built/VibeUE` beside it contains a real copy of that source,
compiled with the installed UE 5.8.3 Linux toolchain. NORD's `.uproject`,
runtime, content and live services are not changed by this pilot. The host's MCP
autostart is disabled; its reserved opt-in port is 8002, distinct from NORD's 8001.

## Build

Run the engine build directly. The upstream `BuildAndLaunchGame.sh` also stops
matching editors and launches another, so it is unsuitable for this CPU-only step.

```bash
pilot=/home/von/.local/share/nord-tools/vibeue-pilot
engine=/home/von/.local/share/Epic/UE_5.8.3
nice -n 10 "$engine/Engine/Build/BatchFiles/Linux/Build.sh" \
  UnrealEditor Linux Development -Project="$pilot/HostProject/HostProject.uproject" \
  -Plugin="$pilot/built/VibeUE/VibeUE.uplugin" \
  -NoUBA -MaxParallelActions=3 -NoHotReloadFromIDE -WaitMutex
```

Build evidence is retained in `$pilot/evidence/`; the first symlink-layout failure
is preserved separately from the real-copy attempt. This builds only the isolated
plugin against precompiled engine modules, without compiling NORD.

## CPU smoke

The completed compatibility trial **failed promotion**: the plugin built and
loaded, and all checked APIs returned successful responses, but trace analysis
logged `[MemAlloc] Invalid Tag on Thread 2 (Tracker=0)!` and
`[MemAlloc] TagTracker errors: 25235`; the commandlet exited **1**. Explicit startup
trace channels did not resolve this. No active-game adoption, rendered NORD drive
or MCP endpoint acceptance followed. The API JSON's `passed` field does not
override this failed process/log result.

Coordinate editor lifecycle with other work before reproducing. This command loads
the plugin in a separate NullRHI Python commandlet; it opens no MCP endpoint and
does not accept rendering or performance. The script asserts the isolated host
identity, engine version, plugin load and API responses, then writes a
fresh report to `HostProject/Saved/Tests/VibeUE/`.
It also starts/stops and reads back one uniquely named CPU trace. Raw responses
are retained in the report when a check fails.

```bash
pilot=/home/von/.local/share/nord-tools/vibeue-pilot
engine=/home/von/.local/share/Epic/UE_5.8.3
smoke=/home/von/Work/rouge-warden-codex-nord-unreal/games/nord-unreal/Tools/VibeUE/smoke.py
nice -n 19 timeout --signal=TERM --kill-after=15s 180s \
  "$engine/Engine/Binaries/Linux/UnrealEditor-Cmd" \
  "$pilot/HostProject/HostProject.uproject" \
  -PLUGIN="$pilot/built/VibeUE/VibeUE.uplugin" -EnablePlugins=VibeUE \
  -NullRHI -Unattended -NoP4 -NoSound -NoAddToRecentProjects \
  -trace=frame,cpu,log,bookmark -ModelContextProtocolPort=8002 \
  -run=pythonscript -script="$smoke" \
  -abslog="$pilot/evidence/smoke-$(date -u +%Y%m%dT%H%M%SZ).log"
```

Require exit 0, the `NORD_VIBEUE_SMOKE_PASSED` marker and the new JSON report.
Timeout or a report without orderly process exit is not acceptance.

Evidence in `$pilot/evidence/` retains all attempts. The first smoke reported
`TRACE_NOT_FINALIZED` from an immediate `StopTrace` file-size check, although its
3.6 MiB file existed by exit. Later attempts wait at most five seconds for the
trace writer before stopping; their successful stop responses are retained
separately from analysis errors. Attempt 2 reduced the blank host from AllToolsets
to EditorToolset and used an actual Python commandlet; attempt 3 tested external
loading with explicit channels. Both commandlets exited 1 from trace-analysis
errors. The final report is
`HostProject/Saved/Tests/VibeUE/smoke-20261014T162453588188Z.json`; the decisive log
is `evidence/smoke-20261014-attempt3-external.log`.

## Pending trial after the trace failure is resolved

Start the isolated host only in a coordinated GPU window, verify port 8002 is
free, then explicitly start its native MCP endpoint with
`-ModelContextProtocolStartServer -ModelContextProtocolPort=8002`. Verify the
project through `unreal.WorkflowService.get_environment()` before other calls.
Use native `list_toolsets`, `describe_toolset`, `call_tool` to discover
`VibeUE.PerformanceService`, `VibeUE.TransactionService` and
`VibeUE.WorkflowService`; Python also exposes:

```python
import unreal
unreal.WorkflowService.get_environment()
unreal.PerformanceService.frame_timing(60.0)
unreal.PerformanceService.start_trace("isolated-pilot", "frame,cpu,gpu,log")
# Reproduce a bounded workload across editor ticks.
unreal.PerformanceService.stop_trace()
unreal.PerformanceService.analyse("trace", "")
unreal.TransactionService.get_state()
```

The final smoke proves external discovery and enabling: the host has no VibeUE
descriptor entry or project-local plugin, and loads the compiled module using
`-PLUGIN=<external VibeUE.uplugin> -EnablePlugins=VibeUE`. UE 5.8.3's
`Runtime/Projects/Private/PluginManager.cpp` separately handles the search path
and enabled-plugin list. The external module manifest and installed engine both
use BuildId `55116800`. This permits a later opt-in session without a NORD
`.uproject` edit or binary copy; it does not make an active-game launch read-only.

Do not run the NORD profiling step until this compatibility failure is resolved.
Use an isolated project/content snapshot for the first game trial, retain its
evidence, and keep the existing `Scripts/profile_package.py` checks for the actual
cooked build. No NORD launch command was executed in this pilot.

At this pin, `StartStandalone` launches new-process PIE, not the cooked package.
Its graceful close implementation is Windows-only; Linux `StopStandalone` may
force termination and report failed trace finalization. Use an in-process trace
for the initial capability trial and validate the returned capture before use.

## Reviewed boundaries

No API key is needed for local editor/performance services. Terrain queries send
coordinates and a user key to vibeue.com. Research tools call Jina, DuckDuckGo and
OpenStreetMap; Fab helpers can reuse the signed-in Epic account. These network
tools are outside the pilot. No credentials were configured or printed.

The native MCP endpoint is local and unauthenticated: keep it loopback-only and
connect trusted clients. Python execution and asset-changing services are powerful
editor operations. The startup code registers tools/skills, maintains local
readiness/journal files, and clears the plugin-owned screenshot directory; it
does not automatically modify NORD assets in this isolated host. This is a focused
source review, not a complete security audit.

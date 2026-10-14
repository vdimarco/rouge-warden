# Captured editor wait owner

The captured game-thread wait is inside `FlushRenderingCommands` during Slate's draw prepass. The trace proves the enclosing hierarchy; the exact triggering window/callsite and pending render/RHI operation remain unresolved.

`Slate::Prepass → CSV_DrawPrePass → FlushRenderingCommands → Sync_RenderingThread → Frame Sync Time → GameThreadWaitForTask → Game thread idle time → CsvEventWait (Non-CP)`

Of 3,908 finite event-wait slices (6023.5703 ms), 3,295 slices / 5999.8875 ms (99.6068%) occupy this hierarchy. All containing intervals validate. Across 171 finite draw prepasses, median prepass is 35.7713 ms, median contained wait is 34.5476 ms and median remainder is 1.1882 ms. Poll slices are portions of longer waits, not separate frames.

Installed `RenderingThread.cpp:1274` flushes pending rendering commands then calls frame-end synchronization; `:1158` waits for the render task's completion event. `GenericPlatformProcess.cpp:460` emits the pthread event wait counter. This identifies render synchronization as the observed enclosing wait, without claiming a particular GPU or shader cause.

The flush follows short widget `SlatePrepass` scopes. Source contains a conditional autosized-window resize path through `SWindow.cpp:1002`, `LinuxWindow.cpp:851`, `SlateApplication.cpp:7022` and `FSlateRHIRenderer::FlushCommands`; the export has no window identity or native resize stack, so that trigger is not proven.

The export completed with 5,294,604 GameThread events. Insights reported 870 unconsumed transport bytes at analysis end; open/infinite terminal scopes were excluded. Source hashes, input hashes, representative intervals and limitations are in `wait-owner.json`. This instrumented editor trace establishes neither graphics/FPS acceptance nor a production bottleneck. No engine, GPU or service process was launched by this analysis.

# River Rush stall recovery

The player reports intermittent freezing. A real WebGL draw exception leaves the
screen marked playing but permanently stops animation scheduling. Startup model
uploads and expensive water shading also produce long frame stalls in browser
profiling. Preserve the approved procedural whitewater, character and controls,
while making the render loop recoverable and reducing work during active play.

Scope: animation-loop exception safety, graceful renderer recovery, model/GPU
preparation, water cost, resize/quality behavior and focused browser verification.
Keep the existing cabinet, lane timing, collision rules and downhill course.

## Additional accepted input scope
The player also requested side-to-side dragging anywhere on the screen. Expand gesture handling across the active gameplay surface, including over HUD and button regions, while retaining deliberate button taps and keyboard controls. Recognized drags must suppress accidental button activation.

The player additionally requested the lane arrows at the leftmost and rightmost ends of the controls. Use Left, Jump, Duck, Right ordering and preserve the responsive layout and action labels.

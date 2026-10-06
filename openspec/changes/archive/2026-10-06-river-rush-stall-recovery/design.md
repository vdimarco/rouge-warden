## Evidence and approach
A one-shot exception in WebGL drawElements stops the existing requestAnimationFrame
chain permanently. Separate scheduling from rendering; retry a transient render
failure with a reset graphics state and pause into the existing usable 2D fallback
when rendering repeatedly fails. Audio errors must not stop simulation. Disposal
must release old contexts and late model resources without pausing a new run.

Profile model arrivals and GPU texture/program preparation before changing their
loading behavior. Prepare resources outside active simulation frames and limit
concurrent integration. Make the lighter water path genuinely cheaper, retaining
seeded channel shape, downhill grade, waves and recognizable whitewater. Quality
adaptation must react to sustained/severe slow frames without treating hidden or
paused intervals as GPU pressure, and avoid redundant drawing-buffer allocations.

## Verification
Inject one failed WebGL draw, repeated draws and an audio failure in a real browser;
assert transient recovery or resumable fallback and working lane/jump/duck input.
Exercise resize, blur/visibility resume and repeated Home/Start. Compare cold/warm
frame intervals, render CPU intervals and graphics uploads before/after under the
same headless configuration. Verify river geometry, skeletal motion, pause pixels,
reduced motion, missing assets, and phone/desktop/landscape budgets. Software GPU
measurements establish reproducible relative cost, not a physical-device FPS.
Publish the tested bundle and verify production hashes, recovery and arcade launch.

Asset preparation has a 15-second loading deadline. Models or the panorama still pending become terminal fallbacks; queued work and retries stop. Late results are disposed and cannot install assets during play. Loaded models and the 3D course remain available.

Whole-screen gestures move from canvas-only handlers to the active app surface. Keep one primary pointer and the existing swipe thresholds/spring; capture supports a held cross-lane drag and reversal. Button taps commit on release without a fixed delay. Once a drag is recognized, suppress the native click at its origin so dragging over controls cannot accidentally pause, jump or duck. Cancel and lifecycle transitions clear capture and pending gesture state.

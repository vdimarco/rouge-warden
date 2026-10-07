# River Rush stall recovery and whole-screen steering

A failed graphics draw used to stop the requestAnimationFrame chain permanently: the screen still said Playing and input was accepted, but the run never advanced. The focused browser check reproduces that failure by throwing once from the actual WebGL draw call. Model arrival also interrupted active play with expensive map uploads and first-use shader work.

The loop schedules its next frame before graphics or audio work. One graphics failure resets the renderer and retries; repeated failures or context loss preserve a paused run that can resume with the 2D renderer. Audio errors disable sound without stopping simulation or controls.

The hidden title-screen canvas prepares the world before Start becomes available. Two workers load models, maps upload one per preparation frame, and both water variants and downstream world districts warm before the player's clock starts. Home and Start reuse that scene. A 15-second asset-loading deadline keeps a nonresponding download from blocking Start indefinitely; unfinished assets use the existing 3D primitive/sprite fallbacks and late results are discarded.

Rendering adapts sooner to expensive active frames, uses a precompiled cheaper water shader under pressure, and avoids duplicate drawing-buffer resizes. The native water keeps analytic fine normals; the cheaper path retains moving crests, bank foam, rock eddies, wakes and landing ripples. Seeded width, downhill course, raft displacement, game speed, controls, continuous paddling and distinct duck anatomy stay unchanged. GPU cleanup includes instanced buffers, detached water materials, textures and skeletons.

Horizontal dragging now belongs to the active gameplay surface, including HUD, header and control areas. A held gesture can cross lanes and reverse without lifting. Recognized drags suppress the button click beneath them; deliberate taps and keyboard activation retain their intended action. Pointer taps and drags return focus to gameplay for the Space jump shortcut; keyboard-focused buttons retain Enter/Space activation. Pointer cancellation and leaving play clear the gesture.

The bottom control row places Left and Right arrows at its outer ends, with labeled Jump and Duck controls between them on all supported layouts.

## Verification

- 43 engine, course, hydrodynamics, animation, delayed-input and rendering-budget tests pass.
- `qa/river-rush/freeze-recovery.mjs` injects actual WebGL/audio failures and checks time and lane/jump/duck input afterward. It covers phone and desktop, three resize layouts, exact paused pixels, blur/visibility and three Home/Start cycles with no extra GLB requests or menu drawing. Static map uploads and shader preparation stop before play; Float32 skeletal updates remain continuous.
- `qa/river-rush/scene3d.mjs` checks three layouts, actual keyboard/touch, log jumps and branch ducks, reduced motion, 503 retry, missing art/model fallbacks, no WebGL and lost context.
- `qa/river-rush/temple-rig.mjs` exercises native shader coverage, continuous stroke phase and paddle hand constraints, steering reversal, anatomical jump/duck differences, paused pixels and reduced motion.
- `qa/river-rush/control-layout.mjs` checks outer-arrow placement, visible action labels, responsive geometry and actual button taps.
- `qa/river-rush/drag-anywhere.mjs` verifies whole-screen pointer steering and preserved controls with real browser events across phone, desktop and landscape.
- `qa/river-rush/rapids.mjs` renders 24 pool/chute/bend/narrows cases across three layouts and two shaders, checking river framing, downhill geometry, budgets and exact paused pixels. Native whitewater screenshots were inspected.
- `qa/river-rush/stalls.mjs` compares the same seeded 130-frame renderer exercise before and after the change. The separate preparation phase produced zero heavy map uploads or shader links during active frames, with stable program/texture/buffer counts.

The isolated headless SwiftShader comparison measured initial active-frame CPU peaks of 643 → 13ms for the software path and 1058 → 17ms for native shader coverage. Sustained frame means were 148 → 69ms and 317 → 198ms respectively. Preparation itself took 3.46/5.43 seconds outside gameplay. An earlier noisy concurrent run had native intervals over one second without uploads or resource growth; the isolated repeat stayed under 350ms. These are diagnostic software-GPU measurements, not physical phone frame rates. Physical device performance and real app switching remain unmeasured; visibility and blur are emulated.

Production evidence and the bounded-download check are recorded in `stall-recovery-verification.json` after deployment. The existing procedural river verification remains a separate historical record.

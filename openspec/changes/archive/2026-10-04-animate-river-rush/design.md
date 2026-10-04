# Design

Use a renderer-owned WeakMap keyed by each run for smoothed reach poses and short event effects. Advance effects only with simulation time; pause and terminal states freeze the canvas. Draw bounded procedural foam, paddle ripples and spray around the existing character/raft artwork, with speed-dependent wake and raft pitch. Key catches travel onto the raft, treasure flashes and impacts produce a brief splash and small local recoil.

Reuse the forest, ivory and gold palette. Use the living menu video and enter menu/dialog content without moving hit targets during play. Under prefers-reduced-motion, remove decorative canvas motion, shake, particles and CSS animations, retaining course scrolling, position changes and static gameplay feedback. Read that preference live rather than only at mount.

Higgsfield Seedance animates the approved menu image with matching start/end references. The repository's local API credentials are unavailable in this workspace, so the explicitly requested Higgsfield work uses the connected account. Store only the resulting optimized silent video and provenance, never generation credentials. Show the approved poster if the video fails, reduced motion is enabled, or data-saving is requested. Pause video offscreen and under dialogs.

Surge uses Shift or a separate touch button. A 35-point charge buys 1.8 seconds of increased speed with a balance cost; starting charge allows an early try. Clear near misses recharge it and build a short combo. Collision breaks the combo, and falling blocks Surge. An input edge prevents one held button from repeatedly spending charge. The existing reach/unlock keys stay intact.

Check desktop 1536×1024 and phone 390×844, pause frame stability, action-effect expiry/reset, preference changes and rendering cost. Particle and foam counts are fixed; effects expire in at most 1.3 seconds with a bounded queue.

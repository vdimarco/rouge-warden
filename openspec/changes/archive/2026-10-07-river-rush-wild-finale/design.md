Maps are 4,200 / 5,400 / 6,600 m (16,200 total), retaining current start speeds,
caps, responsive lane spring and jump/duck windows. Four course acts begin at
0 / .20 / .48 / .76 progress. Smooth shared geography intensity, varied seeded
episodes and recovery stretches make the latter river visibly and mechanically
wilder while every row retains a legal route and delayed-input players can
finish unshielded. Keep the last 150 m hazard-free with a 130 m coin approach.

A pure course profile carries seed, map and length. CPU placement, buoyancy,
GPU geometry and derivatives use the same continuous profile. No mutable global
course state. Stronger late bends, chutes, standing waves and whitewater stay
bounded, downriver and legible; pauses freeze and reduced motion remains usable.

The finish spans the navigation corridor and is visible in advance, with a
large map-specific checkered banner, substantial themed bases, beacons and
paired approach markers. Its course coordinate equals the exact gameplay
finish. Geometry/materials/textures are prepared before play; use bounded
instancing and preserve <=65 draw calls, <125k software/<300k hardware triangles.
Support portrait phone, landscape and desktop plus the 2D fallback.

Coin awards use actual analytic raft overlap at the crossing for all runs.
Magnet/Rush may not bypass lateral contact. Repurpose the timed coin power as
a clearly named bonus for contact-collected coins, preserving eight seconds
and protection/speed mechanics. Verify vertical/jump and delayed HUD feedback
against what is shown before finalizing the contact model; no invisible remote
award is permitted. Ground coins miss when normalized jump height exceeds .28;
raised coins retain the existing appropriate jump/launch reward. Contact events
update the HUD immediately and flight timing uses the actual crossing time.
Golden world coins and their rims disappear at contact. A separate prepared
24-instance white score-token batch compensates for camera depth and shrinks
from a nominal 15 to 5 screen pixels, preventing near-camera perspective growth.
Its instance buffer is exercised during preparation. Course/score-capture
HUD panels remain separate on phone, desktop and landscape layouts.
Tests cover all powers, late/reversed steering and
30/60/120 Hz. Real play and isolated fixtures are recorded separately.

Raise public distance constraint/RLS/API bounds to 16,200 and retain prior
scores/unlocks/idempotent guest submissions. Keep score/coin bounds unless
real finite-run evidence requires a change. Rebuild, publish, verify exact
live assets and actual play, then reconcile and archive the completed change.

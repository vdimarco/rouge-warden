# Design

## Shared wildlife motion

A deterministic distance-based pose helper supplies lane, height, direction and
predicted contact lane to the engine and both renderers. Crocodiles repeatedly
cross the river and remain in motion at contact; their phase passes through the
reward lane at contact so raised gold remains physically attainable. A marked
contact lane and action tell make a well-timed jump a reliable alternative to
the more demanding dodge. Later maps increase weave frequency. Fish leap from
water with articulated fins/tails and splash cues; their existing low-hazard
envelope supports jump or dodge. Birds enter from beyond either bank and dive
to the high-hazard envelope for duck or dodge. They must visibly descend, not
just flap above a fixed track.

The generator rotates the three species on sparse single-hazard rows after
the tutorial. It keeps the advertised jump-chain rows and existing recovery
space, replans reward spacing at final distance, and never moves emitted gold.
Relics retain their settling motion and exact physical contact rules.

## Prepared rendering and branches

Reuse the prepared bounded wildlife instance pools and expose diagnostic
species/pose/contact-lane samples. Pause freezes the entire trajectory;
reduced motion quiets decorative animation but preserves essential motion.
Package Meshy output as local, optimized resources with recorded provenance.
Integrate fuller branching wood and bark detail while keeping connecting wood
above nonhazard lanes and the low duck limb in its established lane. Fit the
generated dense core to the actual duck contact using a shorter midriver
attachment, high connecting controls and smooth depth taper. The complete low
wood comes from Meshy; the original bank connector remains. Share fit constants
between the CPU geometry checks and shader, and preserve the original local
tree as the fallback. Prepare
assets, materials and shader variants before Start. If loading fails or times
out, the established playable local branch fallback remains available.

## Mobile hints

Place a compact noninteractive animated hint in a left HUD stack beside the
right distance panel. Avoid score, power badges, map panel and edge controls;
remove the large central river card. Verify 390x844, 360x640, desktop and short
landscape rectangles and screenshots with visible upcoming hazards.

## Verification

Check shared trajectory continuity/reversals/side origin/leap height, exact
crossing contacts, jump rewards, delayed-input complete stages and bounded
generation. Browser fixtures compare visible pose and markers at several
trajectory phases, stopped pixels and resource counts. Natural App play uses
real keyboard/pointer handlers and no clock/entity mutation. Verify mobile
hint geometry, screenshot the Meshy limb near the raft, and compare published
asset bytes with the committed build. Software Chromium is not a hardware
frame-rate measurement. OpenSpec CLI is unavailable; validate Markdown
requirement/scenario structure and archive merging directly.

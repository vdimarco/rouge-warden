# Monster Mash — selected image fidelity

final result: passed

Source visual truth: `public/tidebreak/styles/rick-and-morty.webp` (1158×2048).
Browser-rendered implementation: `/workspace/scratch/97335c9ef15e/monster-reference-matched.png` (390×690 CSS and image pixels, deviceScaleFactor 1).
Combined full-view evidence: `docs/monster-reference-qa.webp`; source normalized to 390×690 next to the Chromium-rendered game.
State: Nessie, town realm, opening lane. The source is a concept still; the implementation contains real combat and therefore has varying enemy positions, health, currency and notices.

## Comparison history

- P1: original mesh capture had tiny creatures and sparse scenery. Replaced its default presentation with separate reference-conditioned illustrations and depth sorting. Final evidence shows the long green Nessie silhouette, densely framed purple-roofed village, dark pines and carved crystal tower.
- P1: the bridge was twice the reference height; the tower was oversized. Reduced their world-space display heights to 250 and 245 respectively. Reference-aspect comparison now places bridge, hero and tower at comparable vertical positions.
- P1: width-only camera scaling clipped the distant tower on the shorter reference viewport. Bounded scale by both viewport dimensions. Final comparison retains the distant tower and the entire player.
- P2: magenta matte fringes. Applied two-pixel chroma-edge despill, alpha trimming and WebP validation to all 23 assets. Inspected the isolated bridge and stones plus the final full scene.
- P2: oversized ability discs and excessive HUD chrome. Replaced line icons with generated circular illustrations; reduced discs, removed the header bar and wordmark, retained the circular map and compact shop strip.
- P2: added cover intersected diagonal lanes. Removed cover near the upper/lower lane joins. Geometry tests and twelve complete bot matches pass.

## Required fidelity surfaces

- Typography: existing Barlow has the narrow, legible game-label proportions. Status text is small and subdued; hero/realm labels, currency and actual cooldowns remain readable. The source does not specify objective, score or instructional typography; those are live-game additions.
- Layout: vertical lane and oblique illustrated scene; Nessie below center; distant purple tower; horizontal creek with a vertical stone bridge; houses left, woods right; circular map upper right and ability fan lower right. The six-slot inventory and accessible controls need more room than the source's three cosmetic slots. These are intentional functional differences.
- Colors: muted olive ground, warm brown-gray cobbles, purple roofs/crystals, dark teal pines, amber windows and cyan creek/ability art. Minimap team colors are mint and violet.
- Image quality: 23 generated assets conditioned on the exact selected source, full silhouettes and coherent inked details. No rasterized gameplay screenshot is used as a background. Actors and scenery move/occlude independently. Existing generated terrain textures repeat across the actual larger map.
- Copy: source illustration text is not copied as fake interface content. Actual score, gold, health, objectives, skills, item recipes and build trade-offs remain accurate. No comedy rewrite was retained.

Focused review: isolated bridge/stone transparency and the full-resolution sprites were inspected before integration; ability and hero regions are legible at the normalized comparison scale. Source and runtime bank details are not identical. This is a playable reconstruction using the source's visual assets/language, not a pixel-identical still.

## Verification

Local Chromium browser: real simultaneous touch movement and aiming, release, pause, keyboard combat, quick buy, component purchases, recipe discounts, build switching, sale, eight relics, trade-offs, map waypoints, town-to-woods transition and all four hero restarts. Viewports: 390×844, 320×568, 844×390 and 1440×900. Separate visual comparison at 390×690. Final run has no console or HTTP errors. All 23 WebP files decode. Item suite and 12 complete deterministic matches pass. No physical-device frame-rate claim.

## Follow-up polish

P3: more terrain/shore variations can reduce repetition on long routes; additional side-facing animation frames can make turns smoother. These do not block the current visual reconstruction or gameplay.

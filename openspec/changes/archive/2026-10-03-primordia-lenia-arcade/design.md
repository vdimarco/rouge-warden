# Design

## Simulation
- Two Lenia channels share one toroidal grid: A (prey, Orbium rule R=13, bump4, gaus 0.15/0.017) and B (hunters, max-fleet rule gaus 0.337/0.057 at R=10, patterns scaled by 10/13). The grid is 256×128 in landscape and 128×256 in portrait, so the whole dish is on screen at once.
- Convolution runs on the CPU with a radix-2 FFT. Both channels pack into one complex transform (A + iB). Separate kernel spectra are applied with the even/odd split, so one forward and one inverse transform serve both channels. About 5 ms per step in Node.
- The dish steps 22 times per second in epoch I, rising 6.5% per epoch to a cap of 38. The renderer blends the last two steps, so motion stays smooth at 60 fps.
- Hunter tissue overlapping prey makes the prey decay (hunters eat prey).

## Keeping the dish playable
- Orbium collisions can explode into a maze that fills the dish. An agar layer fixes this: prey growth needs nutrient, prey uses it up, and depleted agar makes prey decay. A stationary bloom starves; a moving glider stays on fresh agar.
- A quorum toxin per channel builds while a channel's mass is over its limit and clears fast when it drops back. Blooms and red tides last seconds, not minutes.
- Hunters ignore the agar. The game drags them, and a dragged body would sit on agar it already ate and starve.

## Hunters that hunt
- A growth bias did not steer the solitons. Instead, each hunter's whole body (and only its body) slides up to 0.15 cells per step toward the player with semi-Lagrangian advection. Lenia is translation-invariant, so the creature keeps living. In Frenzy the drift reverses and hunters flee. Hunters also repel each other, because two hunters that touch melt into a red tide.

## Creatures as entities
- After every step, connected blobs above 0.15 are matched to persistent entities by predicted position. That gives names, golden marks, boss bars and kill detection. A creature bitten below 42% (prey) or 50% (hunter) of its peak mass falls apart and counts as devoured. Bloom fragments must live 0.8 s before they count.

## Rendering and sound
- WebGL2 fragment shader: relief lighting from the field gradient, mip-level glow, agar shading, Frenzy gold edges. Canvas 2D fallback when WebGL2 is missing.
- A 2D overlay draws the player (a chomping protist with a flagellum), warnings, particles that stream into the mouth, popups and labels.
- Web Audio only: a drone, a soft arpeggio whose tempo follows the epoch, eating notes that climb a pentatonic scale with the combo, and a Frenzy bass pulse.

## Art direction
- Dark-field microscope: deep teal agar, cyan prey with white cores, hot magenta hunters, gold for Frenzy and golden prey. Syne for display, Space Grotesk for UI.

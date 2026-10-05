# River Rush runner design

The user requested a full rebuild because the treasure race was boring, with the continuous decisions and quick retries of Subway Surfers. The old reach/unlock/escape race is replaced by an original three-lane whitewater runner. The approved face, long hair and modest brown loincloth are preserved.

## Visual direction
The production concept is `concepts/endless-runner.png` (1024×1536). Vivid turquoise water, sunlit jungle banks, distant ruins, gold coins, dark forest translucent controls, and geometric sans score typography. Gameplay uses DM Sans with white/ivory score text, gold multiplier, mint protection and Rush. The existing Bodoni/Georgia cinematic title and Higgsfield loop remain.

Assets: Higgsfield-generated landscape `runner-river.png`; ImageGen portrait `runner-portrait.png`; RGBA `runner-sprites.png` containing ride/jump/duck hero poses, boulder, log, branch gate, coin, magnet and shield. Unequal generated atlas rows are mapped through explicit rectangles rather than clipping full silhouettes. All objects use generated artwork. Canvas primitives are limited to perspective placement, navigational lane lines, water motion/wakes, shadow, protective aura, power feedback and particles. Representational scenery and characters are not drawn with code.

The photographic environment remains intact while projected objects, moving foam and wakes establish forward motion. A first scanline texture experiment was removed after native browser inspection exposed blocky artifacts. The character faces the camera to preserve the requested likeness. Intentional concept differences: compact rounded panels instead of painted HUD strips; the branch gate is a one-lane or three-lane traversable obstacle; Rush and active challenge indicators are functional additions; gold trails reflect the actual seeded course rather than decorative coins. Separate portrait/landscape environments avoid stretching jungle banks.

## Gameplay and pacing
Three discrete lanes. Keyboard: A/D or ←/→, W/↑/Space jump, S/↓ duck, Shift Rush, Escape/P pause, Enter retry. Touch: four-direction swipes, lane/jump/duck buttons, Rush button. Taps are queued and consumed once; lane state changes immediately with approximately 100 ms visual settling. Jump lasts .86 s, duck .82 s; opposite actions cancel immediately and repeated input near action end buffers for .2 s.

Speed starts at 22 m/s and rises to 42 m/s over roughly 111 seconds; Rush multiplies it by 1.32. Obstacle rows arrive around 1.17 s apart initially, tapering to .97 s. Ordinary rows have one or two hazards and a clear lane. Every twelve rows a full log barrier followed by a branch barrier demands jump then duck; the legal action route remains reachable. Coin trails encourage route choices and raised coins reward jumps. Successful actions score 100×multiplier and charge Rush. Eight consecutive coins raise the multiplier, up to ×5, with a 2.8 s collection gap breaking the streak; the HUD bar shows remaining streak time.

Rush requires 100 charge and lasts four seconds, clears obstacles and attracts coins from all lanes. It cannot recharge itself. Magnet lasts eight seconds and appears roughly once per thirteen rows. Shield absorbs one impact and grants 1.1 s grace; each run begins shielded and further pickups appear roughly once per seventeen rows. Trick, coin and distance challenges rotate within a run, reward 500 points and charge (outside Rush), and set targets relative to the moment they start.

Screens: loading/error, living menu, instructions, playing, pause and wipeout/result. The result explains the actual obstacle and offers immediate retry, best score, coins and distance. Versioned validated storage preserves the existing cabinet key while separating runner records from legacy race scores. Pause/hidden page/completion freeze simulation. Reduced motion disables decorative movement but keeps course/action feedback. WebMCP is guarded and offers read-only run status plus start/pause tools; the browser tests supply a shim solely to observe state while using real input.

## Visual comparison ledger
Compare the production concept and browser `game-concept.png` at their native 1024×1536 viewport, plus 390×844, 844×390 and 1536×1024.
1. Layout: upper score/coin/streak band; lower character; four aligned bottom actions; horizon opens the upcoming course. Smaller phone HUD and landscape controls preserve the action area.
2. Typography: bold sans score and gold multiplier preserve the hierarchy; geometric system/DM Sans replaces the generated italic lettering. Menu serif remains intentionally distinct.
3. Palette: turquoise/forest/gold retained; white/mint protection and Rush feedback distinguish active powers. Dark HUD backgrounds improve contrast over foliage.
4. Assets: generated jungle/ruins and individual coins/logs/gates/rocks match the concept; the requested face/long hair/loincloth is visible in all three poses. No generic avatar substitute.
5. Copy/responsiveness: live score replaces sample numbers; Jump/Duck labels and arrow icons remain. Added charge/challenge/protection copy explains actual mechanics. All actions remain reachable on phone and landscape; no horizontal overflow.

Validation results and actual deployment are recorded in verification.md.

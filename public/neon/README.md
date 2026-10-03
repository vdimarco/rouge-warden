# Neon Ronin

Serve `public` and open `/neon/`. No build or external assets are required.

## The duel

Each round is a sword duel against one to five ronin. Rounds 1 and 2 have one ronin, rounds 3 and 4 have two, and so on up to five. Every fourth round has a captain with more health.

- A ronin attacks only when it is in reach and on screen. Only one ronin attacks at a time.
- Each windup warns you three ways: a tone that rises until the blade lands, a red pulse at the screen edge, and a short buzz on phones that can vibrate. A sweep growls low and pulses amber.
- A parry opens the ronin's guard at once. Time slows for half a second, the view leans in and the blades ring. Cut while CUT NOW shows.
- A block adds 1 to the guard bar. A timed dodge adds 2. At 4 the guard breaks. No guard stops a sweep, so dodge it.
- A cut against a closed guard also adds a little pressure. A cut goes to an open guard in reach first.
- Overdrive charges from parries, blocks and cuts. A charged cut deals 3 damage and slows time.

## Touch

Choose PLAY WITH TOUCH. Drag the left stick to run. Swipe across the screen to cut. Hold GUARD as the blade falls: a guard pressed in the last 0.6 s before impact is a parry, and a guard held longer is a block. Push the stick to its edge to dodge.

On a touch screen the view turns to the attacker during its windup, and gently to your target at other times. Drag the look pad on the right to look around. The lock-on waits for a moment after you drag. Arrows at the screen edge point to ronin out of view.

## Phone sword (gyro)

Choose PLAY WITH GYRO and allow motion access over HTTPS. Hold a comfortable grip for calibration. The phone acts as the hilt: its relative orientation moves and rotates the blade. Reset view sets the current grip as neutral. Resume also recalibrates. A rotation keeps the locked layout and your grip.

Catch the incoming cut across the blade: upright against a horizontal cut, sideways against a vertical cut. The dotted guide shows the blocking position. Setting the blade in the last 0.28 s before impact parries. Swing through the opponent to cut. The phone must return to a slower movement before another cut can fire. Guard and overdrive buttons are hidden in gyro mode. The stick stays for dodges.

If the first sensor sample does not come within 3 s, the game pauses and switches to touch. A short stall in the sensor data never switches it. If samples stop during play, the game pauses and switches to touch. Combat waits during calibration.

## Computer

Choose PLAY WITH MOUSE. Move the mouse to aim and turn. Click or drag to cut. Hold the right button to guard. WASD moves. Space rolls. E uses overdrive. Escape pauses.

## The daily duel

Everyone who plays on the same day meets the same attacks and is offered the same circuits after each round. The seed is the local date. Add `?seed=<letters, digits, - or _>` to the address to replay another seed. The end card shows the round, how close you came (for example, "Captain at 3/9 HP"), your best round for this seed, and a line with a link to copy and share. Your best score and your best round for the seed stay in this browser.

## Open 3D world

The default WebGL scene is the Portal Badlands, an alien biome. The Cyber Ghibli style shows a walkable courtyard with lanes, a market, a canal and bridges. Choose the style in the menu. It reuses the repository's standalone Three.js module. Generated models load from `models/` when they are available, and the game keeps its built-in figures if they fail.

If WebGL initialization fails, the game uses its fixed-view fallback with the photographic street, duelist and grip assets.

## Handle-pivot sword mapping

The physical top edge of the phone defines the sword axis. Calibrate with the phone upright, screen toward you, in a comfortable grip. The on-screen sword pivots from the handle. Its fixed-length 3D direction is projected into the view, so forward and backward tilts change its visible length. Blocking tests intersection with the incoming cut path, including low horizontal guards.

Cut speed comes from blade-axis movement, not total phone rotation. Turning around the handle axis cannot score a cut. A cut needs at least 12 degrees of travel and contact with the target. A reversal rearms the swing, so backhand cuts work. Sensor discontinuities recalibrate. Phone orientation cannot measure reliable absolute hand translation or provide physical resistance.

## Verification

From the repository root:

`node --test qa/neon/combat.test.cjs qa/neon/district.test.mjs qa/neon/duel.test.mjs qa/neon/onscreen.test.mjs`

29 tests pass:

- `combat.test.cjs` (19 tests) runs game.js and its modules in Node, with a stand-in for the 3D district. It covers touch and gyro cutting, blocking and calibration, the 0.6 s touch parry window, the lock-on, the warning before every blow, the parry hit-stop and slow motion, the gyro stall fix, the hints for each control, the ROUND wording, the menu, the daily seed and the end card.
- `district.test.mjs` (one test file with many checks) builds the real Three.js scene with a stand-in for the GPU renderer. It covers movement, collision, the view test, the lock-on, circling that stays in view, and the cut target.
- `duel.test.mjs` (7 tests) covers the duel rules: each defense, the warning time before every hit, groups, and the seed.
- `onscreen.test.mjs` (2 tests) is a Node version of the off-screen check: a passive touch player in rounds 1, 3, 5 and 9 sees every windup start on screen, and a player who parries and dodges clears round 1 without a hit.

`qa/neon/neon.e2e.mjs` drives the page in Chromium with Playwright. Serve `public/` first, then run `LAB_URL=http://localhost:8786/lab/ node qa/neon/neon.e2e.mjs`. It checks the phone menu at 390×844, touch play, gyro mode with a virtual phone, and the computer layout. `SHOTS=<folder>` saves screenshots.

Real-device feel, phone speakers and vibration still need playtesting on a phone.

# Neon Ronin

Serve `public` and open `/neon/`. No build or external assets are required.

## Phone sword controls

Choose **Play with gyro** and allow motion access over HTTPS. Hold a comfortable grip for calibration. The phone acts as the hilt: its relative orientation moves and rotates the blade. Recenter sets the current grip as neutral. Rotation or resume also recalibrates.

Catch the incoming cut across the blade: upright against a horizontal cut, sideways against a vertical cut. The dotted guide shows the blocking position. The actual blade segment must cover that position with the correct angle. A steady block stops damage; setting the blade just before impact parries and exposes the enemy.

Swing through the opponent to cut. The projected blade must sweep through the opponent, and the phone must return to a slower movement before another cut can fire. A charged overdrive fires on the next successful cut. Guard and overdrive buttons are hidden in gyro mode.

Use small wrist movements with a firm grip. The game pauses and returns to touch controls if sensor updates stop. Permission denial and missing sensor data also provide touch controls. Combat waits during calibration.

## Touch and keyboard

Choose Play with touch, or switch from gyro in the settings. Swipe along the enemy's bright line. Hold Guard just before impact for a parry. Early touch guards reduce damage. Arrows cut; Space guards; E uses overdrive; Escape pauses.

## Progress and verification

District clears offer random circuits. Health and speed rise with districts; every fifth district has enforcers. Best score saves locally at the end of a run. Audio starts on the play gesture and can be muted.

Run `node --test qa/neon/combat.test.cjs` from the repository root. Six tests cover combat, pose-based blocking, blade sweeps, gyro rearming, automatic overdrive, stale sensors, permission denial, calibration, compass wrap, landscape calibration and touch fallback.

Browser execution remains blocked by the build environment (`socket() failed: Operation not permitted`). Tests use simulated orientation events and a mock canvas. Physical-device feel, motion permissions on iOS/Android, visual layout and balance still require playtesting.

## Photorealistic scene

`art/street.webp`, `art/duelist.webp` and `art/grip.webp` are generated image assets committed with the game. Canvas composites them with rain, enemy approach/recoil, a reflective steel blade and live gyro control. This is a layered 2D presentation rather than a 3D environment. Procedural art remains available while images load or if a file fails. Assets use WebP; character and grip preserve alpha.

Generated with the built-in image tool. Prompt set: a human-eye-level rain-lit cyberpunk alley with clear foreground; a full-body graphite-armoured duelist with cyan/magenta rim lighting on transparency; a first-person gloved right hand holding a vertical katana hilt on transparency. No UI or logos in the assets.

Seven Node tests pass, including loaded and failed image render paths with mock canvas at portrait and landscape sizes. Browser/physical-device visual QA remains unverified because local browser execution is blocked by socket permissions.

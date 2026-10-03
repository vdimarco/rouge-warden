# Neon Ronin

Serve `public` and open `/neon/`. No build or external assets are required.

## Phone sword controls

Choose **Play with gyro** and allow motion access over HTTPS. Hold a comfortable grip for calibration. The phone acts as the hilt: its relative orientation moves and rotates the blade. Recenter sets the current grip as neutral. Rotation or resume also recalibrates.

Catch the incoming cut across the blade: upright against a horizontal cut, sideways against a vertical cut. The dotted guide shows the blocking position. The actual blade segment must cover that position with the correct angle. A steady block stops damage; setting the blade just before impact parries and exposes the enemy.

Swing through the opponent to cut. The projected blade must sweep through the opponent, and the phone must return to a slower movement before another cut can fire. A charged overdrive fires on the next successful cut. Guard and overdrive buttons are hidden in gyro mode.

Use small wrist movements with a firm grip. The game pauses and returns to touch controls if sensor updates stop. Permission denial and missing sensor data also provide touch controls. Combat waits during calibration.

## Touch and keyboard

Choose Play with touch, or switch from gyro in the settings. Swipe along the enemy's bright line. Hold Guard just before impact for a parry. Early touch guards reduce damage. Arrows cut; Space guards; E uses overdrive; Escape pauses.

## Open 3D district

The default WebGL scene is a walkable district with connected lanes, a market, a canal and bridges. Warm windows, rooftop plants, lanterns and cel-shaded buildings give the neon setting a softer illustrated look. It reuses the repository's standalone Three.js vendor module.

Drag the left stick to walk and the right edge to look around. WASD also moves. Gyro continues to control the sword independently of the camera. Buildings stop movement. Sentinels approach in world space; combat requires proximity and facing the opponent. Spirit lights restore health and charge, then respawn after 30 seconds. The district has outer boundaries and is not an infinite world. Enemies use direct pursuit with collision sliding, so scenery can obstruct them.

If WebGL initialization fails, the game identifies its fixed-view fallback and uses the existing photographic street, duelist and grip assets. These generated WebP assets are retained for compatibility.

District clears offer random circuits. Health and speed rise with districts; every fifth district has enforcers. Best score saves locally at the end of a run. Audio starts on the play gesture and can be muted.

## Verification

Run `node --test qa/neon/combat.test.cjs qa/neon/district.test.mjs` from the repository root. Eight combat tests exercise simulated sensor events and mock canvas rendering. The district test uses real Three.js scene and vector math with a mocked GPU renderer, covering movement, building collision, combat range/facing, pause input reset, collectible debounce and viewport resizing.

Browser execution is blocked by the build environment (`socket() failed: Operation not permitted`). Actual GPU rendering, mobile layout, performance and physical-device gyro feel still need playtesting.

## Handle-pivot sword mapping

The physical top edge of the phone defines the sword axis. Calibrate with the phone upright, screen toward you, in a comfortable grip. The on-screen sword pivots from the handle. Its fixed-length 3D direction is projected into the view, so forward/backward tilts change its visible length. Blocking tests intersection with the incoming cut path, including low horizontal guards.

Cut speed comes from blade-axis movement, not total phone rotation. Turning around the handle axis cannot score a cut. A cut needs at least 12 degrees of travel and contact with the target. A reversal rearms the swing, supporting backhand cuts; cooldown still limits repeated hits. Sensor discontinuities recalibrate. Phone orientation cannot measure reliable absolute hand translation or provide physical resistance.

Eight automated tests pass. Real-device feel remains unverified.

## Fast movement and style selection

The left stick now runs at 10.5 world units per second (previously 3.8). Analog stick distance controls speed; direction changes apply immediately. Movement checks collisions in steps of at most 0.15 units, including on slow frames. Simulation accepts up to 100 ms per frame to avoid slowing movement at 15–25 FPS. Longer stalls remain capped.

Static scenery is merged by material: 978 meshes become 39 batches. Animated objects stay separate. Both render layers cap device pixel ratio at 1.25, WebGL MSAA is off, and the menu avoids backdrop blur. These lower render cost; actual phone frame rate is unmeasured.

Choose Cyber Ghibli or Rick and Morty in the start menu. The selection saves locally. Rick and Morty adds a violet sky, flat pastel colors, ink edges, a green portal and cartoon eyes to the 3D scene. The existing art style stays the default. Style changes restore the original material colors when switching back.

The Rick and Morty option is a custom runtime style. Higgsfield's preset lookup did not resolve a matching entry. An environment art request was submitted with GPT Image 2 (job `c0a9c08a-97e4-4106-a00b-63e75395799c`), but result retrieval failed twice with a service error. No generated art is included in this change and the game does not depend on that job.

Nine Node tests pass. The district test also verifies batching, reversible style changes, equal travel at 15/30/60 Hz, and wall collision at running speed. GPU rendering is mocked.

## Phone controls the view

In gyro mode, phone rotation changes the camera as well as the sword. Sideways blade motion also turns the view. Camera response uses 45 ms smoothing, with pitch limited to keep the horizon stable. The right look pad is hidden while gyro is active; the left stick moves relative to the current view. Recenter preserves the current view and sets the present grip as neutral. Touch mode restores drag-to-look. Sensor loss and resume keep the existing calibration flow. Automated scene tests cover camera motion, recentering, angle wrap and pitch limits; physical-device feel remains unverified.

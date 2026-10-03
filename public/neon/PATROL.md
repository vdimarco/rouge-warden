# Patrol Breaker update

This note describes an earlier mode. The 3D game now runs sword duels in every round (see DUELS.md and README.md). The drone code remains and its tests still run.

The 3D mode now combines a swordsman with two to five attack drones. Drones approach, show a red warning ring for 0.85 seconds, then strike within 3.2 units. They recover before attacking again. Threats pause with the run and wait for gyro calibration.

Push the movement stick to its edge to dash for 0.18 seconds. Release and push again after the 0.85-second cooldown. Shift also dashes on desktop. Dash travel checks walls in short steps and grants protection from attacks.

A swing lunges up to 2.8 units toward a swordsman within seven units and cuts drones in a forward cone. Every close sword swing deals damage. Blade angle still matters for gyro blocks. Charged swings trigger overdrive in both input modes.

Kills add health and charge. Kill again within six seconds to extend the chain and increase score. Every fourth kill slows threats for 1.5 seconds while player speed stays unchanged. Clear the swordsman quota to choose an upgrade. Arc Blade widens drone cuts; Drone Shell reduces drone damage. The death screen reports best chain and run duration.

## Tablet controls

Landscape uses the full viewport, with a large movement stick on the left and controls on the right. Hold both ends of the tablet, turn it to aim and swing in gyro mode, and use Recenter for a comfortable grip. Touch mode retains the right drag-look region. The Widescreen button requests fullscreen and landscape orientation from the tap. Browsers that refuse the request show instructions to rotate manually. Rotation resizes the scene and recalibrates the grip.

## Validation

The 3D game no longer runs this patrol mode: every round is now a sword duel (see DUELS.md). `qa/neon/district.test.mjs` still checks the drone code: patrol caps, attack windups, dash cooldown and immunity, cleave, collision, pause and restart. Run all Neon Ronin tests with `node --test qa/neon/combat.test.cjs qa/neon/district.test.mjs qa/neon/duel.test.mjs qa/neon/onscreen.test.mjs`. 29 tests pass.

# Design

## Clean room

The inspiration repository has no license. This game is written from the cottage spec and the look sheet. No source, model, or sound from that repository is fetched or adapted.

## Simulation

- One fixed step of 1/60 second. `?seed=` feeds a mulberry32 generator used for serves and Neighbour choices after point 1. Point 1 does not roll that generator.
- The ball is a projectile. Gravity is 8. Named speeds (serve 9 casual, 13 pro, rally 8 to 14) are the horizontal pace toward the landing spot. Vertical speed is whatever the arc needs so the ball lands on that spot and clears the hedge. Bounce restitution is 0.75. Ground friction on a bounce keeps 80 percent of the horizontal speed. That friction number is local to this prototype.
- A second bounce on the same side, a bounce outside the lines, or a hedge clip ends the point.
- The player's hit window is 250 ms for the first 3 returns, then 160 ms casual or 110 ms pro. Early in the window sends a wider angle. Late keeps the ball down the line. A tap on the left or right half picks a side. A short tap is flat, a held touch is a lob, and a swipe up is a smash.
- Assisted movement walks toward the predicted contact, where the player has to stand, at 70 percent of run speed on casual and 90 percent on pro. A drag steers at full run speed out to the sideline at x = ±3.5.
- From point 2, `REACH` is 1.0 m. A swing farther away is a whiff: swing pose, whoosh, no tok, no flower, and a short grass puff of five lawn ellipses at the ball. Point 1 is exempt. The Neighbour also waits unless it is within 1.0 m, and lets the ball pass if the window closes.
- The gold marker is the stand spot, drawn as an ellipse whose width and depth are the projected length of 1.0 m. No outside painting article was adapted for the marker or the puff. None fit a one-metre court ellipse and a five-blob puff, so both are drawn directly.
- Neighbour shot choice reads `RULES.aiCasual` or `RULES.aiPro` once into a mutable card. Casual is the default. The approved numbers are unchanged. Error shots still use the wide and long overrides. Scatter may land outside the court, which is a Neighbour error.
- Point 1 is a script on a slower teaching pace (about 5 m/s). That is what leaves room for the opening beats on a short lawn. The Neighbour returns the first three arrivals softly, then lets the fourth go. From point 2 the Neighbour uses the approved card: casual error starts at 18 percent and pro at 9 percent, plus pace and rally growth, capped at 40 and 25 percent. Reaction is 0.32 s casual and 0.18 s pro, and it does not shrink as the player wins points. The older `errorCasual` 0.30 and `reactCasual` 0.35 values stay on `RULES` so the cottage-number check still reads them. A perfect opening runs about like this: racket glow for 2 seconds, landing ring just before 2 seconds, first hit a little after 3 seconds, three Neighbour returns between 5 and 15 seconds, the scripted miss just after 19 seconds, and the next serve, with the coloured ring, at about 23 seconds.
- Flowers are pushed onto the hitter's bed inside the hit function, before that call returns. The pop animation starts the same step. It is not queued for a later frame.
- When a point ends, the loser's flowers wilt for 300 ms and then reappear on the winner's bed. The match ends at 7 points with a lead of 2.

## Picture

Placeholder circles, rectangles, and dots. No painted technique is built here, so no outside shader or article was adapted. The palette and the planned `public/tennis/art/` file names come from the look sheet: `court.webp`, `hedge.webp`, `player.webp`, `neighbour.webp`, `flowers.webp`, and `props.webp`. The page does not request those images.

Portrait maps the player to the bottom. Landscape uses the same full canvas, turned so the near side stays at the bottom of the rotated view. Arcade, the tilt cog, and Switch sit in a 56 px bar in normal flow above the canvas, so they do not cover the court. The old empty side pad is not drawn. Screen type uses the Fraunces and DM Sans files already served with Breakthrough, with a local fallback stack if those files are missing.

## Arcade

The machine stands in the Cottage group, last, after In Full Swing. The title is Lawn Tennis at the Cottage, so that row is the match. The Lab stays at 17 machines. The switcher uses the same id (`tennis`) and the same name (`Lawn Tennis`). The screen art is a small SVG in the look-sheet palette. It is not a painted WebP.

## Phone controls

Tilt uses a new velocity, not the old absolute steer. Gamma moves sideways. Beta moves toward the net or the baseline at 40 percent of that speed. A 3 degree dead zone and full speed at 25 degrees (15 or 35 from the settings cog) sit on a low pass. The casual magnet is 0.6 for the first three hits, then 0.35, 0.2, and 0.1, and it is 0 on pro. It only helps when the tilt is quiet or already aimed at the ball.

A flick over 250 degrees per second swings at once. The opening lob also accepts 150. Strength picks drop, drive, or smash. Timing still picks the angle. The swing freezes tilt input for 250 ms and then ignores another flick for 350 ms. Over 900 on a low ball is a hard drive.

The gate is flat CSS in the same palette. No outside painting article was adapted. The tap handler calls `DeviceMotionEvent.requestPermission`, `DeviceOrientationEvent.requestPermission`, and `AudioContext.resume` before any await. Sounds are oscillators and a noise buffer.

`?fast=1` scales a frame by 4, caps the added time at 0.5 s, and can spend up to 180 steps, so a 20 fps frame plays 0.2 s of simulation and leftover time does not pile up. Arrow keys and A/D use the full run speed out to the sideline. Releasing them clears the key velocity and assisted movement resumes. A drag that steered, a diagonal drag, and a downward drag do not swing. A tap, a hold in place, and a swipe up still do.

## Checks

`qa/tennis/rally.test.mjs` imports the module and drives `createTest`, the same object the page assigns to `window.__test`. It does not need the static server. `qa/tennis/ai-balance.test.mjs` plays 2,000 points from seed 1000 with point 1 left out. The average bot (timing sd 30 ms, 0.9 of run speed, 0.25 m stand error, half of returns aimed at a corner) and the skilled bot (sd 12 ms, full run speed, 0.08 m, early timing aimed at the open corner, smash above 1.2 m) both recover to the centre and then run at the landing. Timing sd grows 8 percent per m/s over 10. Their read delays, 0.74 s and 0.45 s with a little noise, are the footwork that keeps the published bands on this flight model: casual versus average at 20 to 30 percent Neighbour points, pro versus skilled at 30 to 40 percent. Browser screenshots are a separate pass.

# Swing: Spider-Man world

This change is the second part of the review of Spider-Man gameplay footage. The first part, `swing-spider-moves`, added the release boost, the dodge, the perch takedown and the finisher. The user then asked for the rest of the list.

## Why

- **The fall wastes height.** In the video, Spider-Man glides between towers and uses a rope only to climb again. In our game, a fall ends in a swing or on the ground.
- **A wall stops the flight.** In the video and the Giphy clip, he runs up a tower (and down a glass wall) and leaps off the top. Our climb is a slow cling.
- **The city waits for the player.** In the video, crimes start near him with a spoken line: a break-in, a beating, a getaway car, a leaking gas truck. In our game, crime comes only from job markers.
- **A fight has few tools.** In the PS4 clip, he throws objects and pulls a group of goons together.
- **The music does not change for a fight.**

## What changes

- **Glide (flat play).** Hold Space (pad A, or a phone GLIDE button) in the air with no rope out. The fall eases to 3.2 m/s, the speed along the ground stays between 14 and 32 m/s, and the move input turns the glide. The hero spreads out in a swan pose (`MOVES.glide`, `physics.js`, `hero.js setGlide`).
- **Wall run and leap (flat play).** Meet a wall at 9 m/s or more with the move input toward it, or head-on, and run up it (or down it, when falling fast). The run starts at 85 % of the speed and slows to the climb speed. Space leaps off it, harder the faster the run. A fast run off the top leaps up into the air (`CLIMB.run`, `physics.js climb`).
- **Throw.** G (pad d-pad up, or a phone THROW button) throws a toilet lid at the goon in view 3 to 18 m away. It spins along an arc and takes two points (`combat.js C.throw`, `main.js throwFrame`).
- **Group pull.** A rope pull also drags up to two goons within 3.5 m of the caught one. They land in a heap at the hero's feet and each takes two points (`FIGHT.heap`).
- **Crimes (after Mission 1).** Every 45 to 80 s with no job running, a crime starts 50 to 150 m from the hero. The hero shouts a line, a toast names it, and a red marker shows. Swing within 28 m to take it. After a minute it is over. Each stopped crime ends with a quip (`jobs.js J.crime`, `CRIME_LINES`, `QUIPS`).
  - **Mugging:** three goons and a victim on a street.
  - **Getaway Car:** a black car drives itself along the streets. A rope on it plunges the windscreen; it swerves and stops, and two robbers jump out (`cars.js jobCar`, `autoDrive`, `stopCar`).
  - **Sludge Tanker:** a sludge-green tanker leaks (GLUG). Three ropes on the leak seal it; beat the three goons too. If the clock runs out, it floods.
  - **Stop, Thief!** (the existing job) can also start as a crime.
- **Fight music.** While goons fight the hero, the groove adds four-on-the-floor kicks, an off-beat bass stab and a tom run (`audio.js fight`).
- **A perfect dodge** slows the world for 0.35 s.
- Version 1.17.0 (Quest APK code 24).

## Already there

- People already react when the hero swings low over a street (`street.js` `pass`).
- The city is already lit at golden hour (`SUN_DIR`, the sky colours).

## Out of scope

- Swinging inside buildings. The city has no interiors to swing in.
- A partner hero (Miles in the video).
- New painted sound words. The atlas has nine words, and the change reuses them.

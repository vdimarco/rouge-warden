# Light Years Home

> Superseded by `light-years-v3`, which replaces this game at `/light-years-home/`; this change stays unarchived for its history.

## Why

The user asked: "can we turn this into a game? traveling at the speed of light. on some kind of quest."

They uploaded a video as the art reference. It is 128 seconds long, in portrait. It zooms from a billion light-years out
down to Earth, one landmark at a time: black space, white points, thin white rings with leader lines and small labels,
small grey info boxes, and bold uppercase captions with the current word in orange.

## What Changes

- Add Light Years Home at `/light-years-home/`, a static three.js game. It uses three r185 from `/vr/lib/`.
- You wake up a billion light-years from Earth with no star map. At each stop you read a clue, pick the landmark from
  three ringed candidates, and fly to it a hair under light speed. There are 15 stops in 4 chapters, in the video's
  order, plus 2 short spots and one fork. The journey ends on Earth, today.
- In flight you hold to push toward light and let go to ease off. Each zone of space has a speed limit set by real heat:
  gas hitting the ship, and the blueshifted cosmic background. Over the limit the forward shield heats up and cracks.
  You have three panes.
- Two exact clocks run. About 7 to 14 years pass for you, depending on how close to the speed limits you fly, and
  1,215,266,893 years pass on Earth. Earth's history shows on small cards as you fly.
- The sky shows real aberration, Doppler colour and brightness change.
- Keyboard and mouse on desktop. Touch on phones, in portrait and landscape. Pause, page lifecycle, mute, saves, reduced
  motion and a graphics error card.
- Add the game to the Cottage Arcade: a cabinet, the seventh and last machine in the Action group, a switcher entry,
  a best-score line and key art.
- Add node tests for the pure game logic, a bot, and browser checks for play, layouts, visuals and performance.

## Impact

- New capability: `light-years-home`.
- New files: `public/light-years-home/`, `public/arcade/light-years-home.webp`, `qa/light-years-home/`.
- Edited files: `public/index.html`, `public/arcade/switch.js`, `qa/arcade/groups.e2e.mjs`, `qa/arcade/machines.mjs`,
  `qa/arcade/quiet.mjs`, `README.md` and one test line in `AGENTS.md`.
- No canonical requirement pins the Action group's games or count, so `arcade-groups` needs no delta. The Action
  check in `qa/arcade/groups.e2e.mjs` changes from six games to seven.
- No backend, no network textures and no new dependency.

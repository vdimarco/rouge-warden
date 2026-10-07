# Design

## Trial rings

- The ring mesh grows from 9 to 12 instances. Slots 9 to 11 hold each trial's first ring as a START ring (style 7: green, breathing, a brighter disc) while no trial runs. The trial labels move over the START rings and read "Fly through the green ring".
- `crossed(r, prev, scale)` is the shared plane-crossing test. It ignores a move longer than 8 m in one frame, since that is a teleport and not a flight. While no trial runs, `trialsUpdate` tests every START ring (radius times 1.15) and starts the trial on a pass. The pad still works.
- `progress.trial` gains `total` and `next`. `ui.js` `nearestTarget()` points the compass at `next` during a trial, and the flat HUD pill shows "ring/total · time".
- `ringPassed` adds a WHOOSH word 6 m past the ring (larger on the last), `ui.flash()` (a green or gold inset glow on the flat HUD, using the Web Animations API, off under reduced motion), and a "Ring n of total" line. `finishTrial` says "<trial> done! <time>".

## Full screen

Esc leaves full screen with the pointer lock. `wantFs` remembers that flat play asked for it, so the click or key that resumes asks again. `goFullscreen()` runs inside the PLAY click, before pointer lock, and asks for `requestFullscreen({ navigationUI: "hide" })` (or the webkit name). It ignores a refusal. `exitPlay()` leaves full screen. An iPhone has no full screen API for pages and plays in the page.

## The flat map

On a flat screen the table model was a speck at a grazing angle, half covered by the spoken line. In flat play, `openMap()` now hides the model (`map.root.visible = false`) and `domMapList()` builds a grid: a canvas plan (`domMapDraw`) and a side panel with a key, the travel list and Back. The plan maps x/z to pixels with one scale that fits the land plus a strip of the lake, north up. It draws the building tiers (six colours by roof height), the Dome and the Needle, the existing pin badges (`pinSprites()` canvases), a green ring around each trial pin, and the player's arrow from `HD.yaw`. Pointer moves hit-test the pins (16 px, or 26 px on touch) for the tooltip and the hover size, and a click on a travel pin calls `act("pin:<id>")`. It redraws on resize. Portrait puts the side panel under the plan.

## Sound

A workflow ran three independent investigations (a static trace, a live measurement in Chromium with the desktop autoplay rule, and git history), and skeptics tried to refute each claim. The only cause of total silence on a desktop was a saved arcade-wide mute: localStorage "arcade.sound" = false, written by the arcade's speaker button and by Wild, Fish and the Lab. createAudio falls back to it when the game has no setting of its own. The engine then starts with output gain 0 and a suspended context, and nothing on the title shows it. It was not a regression: audio.js has not changed since the game's first commit. The shared switch stays, because every game promises to honour it. The game now makes it visible and quick to change:

- A SOUND: ON/OFF button on the title (main.js wireTitle, soundLabel). The pause menu's Sound button updates it too.
- M toggles the sound in flat play (desktop.js Q.mute, inp.muteDown, main.js).
- PLAY with the sound off shows a toast, so the opening's spoken lines do not cover it: "Sound is off. Press M to turn it on." (or, on a phone, use the pause menu).
- Other things made the start sound broken. The PLAY click now plays a "ui" click. The desktop opening's city ambience is 0.6 instead of 0.2: it measured near -42 dBFS before and over -40 now. toggle() sets E.ran from the context state, so its confirmation click plays while resume() is on its way.
- Recovery: the statechange listener calls wake() when the context leaves "running" with the sound on and not held. A capture-phase pointerdown or keydown retries resume() while audio.stalled.
- osc() keeps the frequency under 0.49 × the sample rate. The trial ring's pitch rises with each ring and pushed an overtone to 22,144 Hz at ring 10, and play.mjs flagged the browser's clamping warning.
- iOS: navigator.audioSession.type = "playback", and a silent looping WAV element started inside the tap (older iOS), so the ring/silent switch does not mute Web Audio.

How to check: qa/vr/sound.e2e.mjs taps the engine output with an AnalyserNode in Chromium (--autoplay-policy=user-gesture-required). It checks a fresh desktop (the click call, the opening level), a muted arcade (the title label, the toast, M, the saved choice) and the title button.

## The air wall grab

`physics.js` `wall()` records how hard the chest came at a wall (`touch.into`) and the speed without the fall (`len3(vx, max(vy, 0), vz)`). In the air, `grab()` runs when that speed is under `CLIMB.brushSpeed` (8 m/s), or when `into` is at least `CLIMB.headOn` (0.4) of it. A fast swing that brushes a wall keeps going, and a fall steered into a wall still catches it. The tap-only phone bot measured 18.9 m/s on main and 20.9 m/s with the rule.

## Version

1.6.0 in `config.js`, `sw.js` and the Quest APK (code 5).

## How to check

- `qa/vr/rings-map.e2e.mjs` checks:
  - full screen on PLAY;
  - a START ring starting a trial, with the count, the compass and the glow;
  - the finish line;
  - a teleport across a START ring, which starts nothing;
  - the plan map: drawn, the table hidden, the places listed;
  - a list hover naming its pin;
  - travel by clicking a pin.
- `qa/vr/sound.e2e.mjs`: the output level in Chromium with the desktop autoplay rule.
- `qa/vr/physics.test.mjs`: the grab rule both ways.
- `qa/vr/phone-swing.e2e.mjs`: tap-only speed, and a 360 px phone.

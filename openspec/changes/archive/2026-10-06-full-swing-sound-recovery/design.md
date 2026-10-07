# Design

## The state (`createAudio` in audio.js)

- `wanted`: init() ran with Web Audio present (a click asked for sound). With no Web Audio at all there is nothing to retry,
  so the sound never counts as stalled (the tests that remove `AudioContext` keep their Sound toggle).
- `stalled`: wanted, on, not held (a hidden page), and one of: no live engine; a context that is not running and whose last
  resume() is more than WAKE (1.5 s) old; a running context whose clock has not moved for FROZEN (3 s) of wall time. Each
  call of `frozen()` notes a move of `ctx.currentTime`, so any two calls can tell (update() calls it every frame).
- `running` = on and not stalled: what the menus show as "on". Before the first click it is on.
- `resume()` drops an engine with a frozen clock (closes it) and builds a new one; it notes `restartedAt` when it fixed a
  stall. `restarted` is true for 1 s after that.
- `toggle()` to on builds a new engine when there is none, or its clock is frozen.
- `init()` logs `console.warn("In Full Swing: the sound did not start", err)` when the engine or the context fails.

## The buttons (main.js, ui.js)

The pointerdown and keydown retry in main.js runs before the click, so by the click the sound may already be fixed. The
title button, the pause menu button and M check `audio.isOn && (audio.stalled || audio.restarted)`: then they call resume()
and do not toggle. Otherwise they toggle as before.

## The scenes (main.js `cutsceneFrame`)

The scene frame sets the listener at the scene camera, wind 0 at the body height, both ropes 0, and calls `audio.update(dt)`.

## How it was checked

`sound.e2e` with real Web Audio in Chromium:
- The first engine build throws (a patched `createDynamicsCompressor`): the sound is stalled and the title says
  SOUND: ON, NOT PLAYING; the next key builds it and the output is heard. Then the context is closed: the next key builds a
  new one, heard again. On the old code the sound stayed silent with SOUND: ON.
- The opening scene played after PLAY: the music step goes on (8 to 8 on the old code; about 18 steps in 3 s now) and the
  output is heard.

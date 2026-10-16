# Design

## Sources

- **On twos.** Sony Pictures Imageworks animated most of "Into the Spider-Verse" on twos: 12 drawings a second, each held for two frames at 24 fps. They found ones too smooth, and they used no motion blur: the stepped poses carry the motion. Sources: the SIGGRAPH 2019 production session "Swing into Another Dimension" (Danny Dimian and others, [history.siggraph.org](https://history.siggraph.org/?p=89078)) and [Cartoon Brew, "If It's Not Broke, Break It"](https://www.cartoonbrew.com/feature-film/if-its-not-broke-break-it-sony-imageworks-renegade-approach-to-spider-man-into-the-spider-verse-167321.html). In a game, Insomniac's Into the Spider-Verse suit in "Spider-Man: Miles Morales" plays Miles' animation at a lower frame rate in a full-rate game, and lets the player turn it off ([Push Square](https://www.pushsquare.com/news/2020/10/marvels_spider-man_miles_morales_gets_amazing_into_the_spider-verse_suit), [GameRevolution](https://www.gamerevolution.com/?p=664503)). We adapted that suit: the pose steps, the body and the camera stay smooth. A critic noted that Miles starts at 12 fps and ends at 24 fps once he is in control. A full focus meter puts the hero on ones for that reason.
- **Colour plates.** The same SIGGRAPH session says the hand of the artist shows in every frame, "including misalignments and bleeding colors". The film puts misregistered colour where a camera would blur. No public shader from the film fits a forward WebGL pass, so the slip here is our own: the red and the blue plates move apart along one diagonal by a depth term.
- **Camera shake.** The trauma model from Squirrel Eiserloh, "Math for Game Programmers: Juicing Your Cameras With Math" (GDC 2016, [Game Developer](https://www.gamedeveloper.com/programming/video-sprucing-up-cameras-with-math)), as in [Bevy's 2D screen shake example](https://bevy.org/examples/camera/2d-screen-shake/): events add trauma 0 to 1, it decays, the shake is its square, and the shake moves the drawn camera only.
- **Hit-stop.** The common fighting-game freeze on a landed blow. The times (45 ms to 120 ms) are three to seven frames at 60 Hz.
- **Impact frames, spider-sense, the zip strike.** These come from the film and from Insomniac's games (a web strike to the next enemy). No source code fit. They are built on what the game has.

## The Verse pass rides on the bloom composite

`bloom.js` already renders the scene to a half-float target and draws one full-screen composite. The Verse effects go into that composite, so they cost no extra full-screen draw when bloom is on. With bloom off (a phone by default), the scene still renders to the target and the composite runs with the glow levels bound to a black 1x1 texture. That adds the offscreen resolve on a phone. The pass does three texture reads more than before (the plates) plus one depth read.

The scene target gets a `DepthTexture` (depth with stencil, since the target has a stencil buffer). three r185 resolves the depth of a multisampled target into it. The shader turns the depth to view metres with the camera's near and far planes.

The slip is `smoothstep(focus * 1.6, focus * 14, d)` plus 0.6 of a near term under `focus * 0.6`, times the plate size in pixels. The focus is the camera's distance to the hero (the pivot) plus 0.4 m, or 6 m in first person. The plate size is 2.6 px at 1080 lines, plus up to 2.2 px with speed from 14 m/s to 34 m/s, plus 4 px after a burst, decaying over a third of a second. It scales with the drawing buffer height.

The world's halftone dots stay in the world (`comic.js` says why: stereo rivalry in a headset). The Verse pass is flat play only, so screen-space work is safe there.

## The impact frame is limited

A flash is a photosensitivity risk. The frame is 0.07 s long, and two flashes are at least 0.5 s apart, so there are never more than two a second (WCAG 2.3.1 allows three). Calm turns flashes off. The two inks are the game's ink (`0x140a18`) and a red hold. The HUD is DOM and stays as it is.

## Twos hold the pose, not the body

`H.update` runs a full pose only when 1/12 s has gathered. Between poses it moves `root` by the player's motion and moves the hand, head, foot and palm points by the same amount, so ropes, words and the climb keep their places. The facing is part of the pose and steps too. The full update gets the gathered time as its `dt`, so springs and timers keep the same speed. A yank, an attack, a hit or a roll poses at once, so a press never waits up to 83 ms for its pose. A wall climb stays on ones: its hands and feet are planted on holds in the world, and a held pose would slide them over the wall. A jump of over 2 m in one frame (a teleport or a respawn) poses at once, and the time gathered before it does not count.

## Hit-stop and shake run in real time

The loop skips `tick` while `hitStopT` runs, but it still draws. `flatcam.post(rdt)` applies the bank and the shake to the drawn camera with real time, and main calls `flatcam.restore()` after the draw, so aim and taps never see the lean or the shake. `post` runs only in play and never during a test shot or a comic scene, which place the camera themselves. Tests step `tick` directly, so they read `hitStop` from `G.test.action()` and draw with `G.test.render(dt)` to let the real-time effects fade.

## The zip strike reuses the attack input

The zip needs no new button. It starts only while a combo runs and nobody is in reach, so it never takes a rope throw from a swing, and a rope pull on a goon still opens a fight. The zip sets the hero's velocity before each physics step, so walls still stop him. The hit happens in reach (1.8 m). The hero bounces back and up so the next press finds the next goon, not the same one on the floor.

## The bank

`flatcam` low-passes the horizontal acceleration across the view and rolls by 0.006 rad per m/s², clamped at 7 degrees. A swing on a 20 m rope at 20 m/s pulls about 20 m/s² and leans about 5 degrees. The bank is off in first person, on the ground, in a car, and with Calm or Off.

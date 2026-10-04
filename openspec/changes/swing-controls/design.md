# Design

This design covers play on a flat screen: a mouse and keyboard, a game pad and a phone. Headset play does not change. `physics.js`, `city.js` and the rest pose of the chase camera do not change.

## What the code does today

I read the code on main. These facts drive the design.

| Area | Today | Gap |
|---|---|---|
| Swing aim, third person | `viewAim` in `main.js` casts a ray through the screen centre. A hit on an up-facing surface within 12 m of the hero, or a miss that points down at ground within 12 m, becomes the same bearing 32 degrees up (`AIM_UP`, `AIM_NEAR`). | The screen centre is the hero's chest, so every swing goes 32 degrees up along the view. The design notes of `swing-hero-comic` call this a stopgap and say an auto target must replace it. |
| Mouse and keyboard | `desktop.js`: the left button fires the left rope and the right button fires the right rope, both at the aim ray. Shift or the wheel reels. F yanks (3.5 m/s). Space jumps, or yanks in the air. Tab opens the map. Esc pauses. | No target shows. A trackpad player has no swing key. Ctrl+F counts as F. The "Rope trigger: Toggle" setting of a headset save also changes flat play. |
| Game pad | `standardPad()`: LT and RT hold the left and right rope. LB and RB reel. A jumps. X yanks. Start opens the menu. Both sticks work, with a dead zone on each axis. | Nothing sets `input.viewDown`, so Y does nothing. There is no map button. A trigger near 0.5 can flutter and let go of the rope. The tutorial tells a pad player to hold Shift. |
| Phone | `mobile.js` and the phone rules in `main.js`: one tap swings, the rope lets go by itself, a tap at the sky calls `assistAim`, a tap on a clog plunges it, a climb pad shows on a wall. | The centre ring sits on the hero in third person, so no target shows. There is no view button. Nothing vibrates. The first tutorial line asks the player to tap the gold ring, which is above the screen at the start. The buttons are small and plain. |
| Camera | The chase camera looks down 15.5 degrees at rest. The vertical field of view is 70 degrees. | The top edge of the screen is 19.5 degrees above the horizon. Good anchors sit 25 to 45 degrees up, so they are above the screen. |
| Speed | The desktop preset uses `SWING` physics. The phone adds `PHONE.physics`, a speed kick on attach and an auto release. | A new desktop player does not get far. See "Evidence". |

## Evidence from a throwaway bot

I ran a bot in Node with `physics.js` and `city.js` only. The code is not in the repo. The bot holds W. It presses the swing input when both ropes are idle, at the best of a fan of rays. It lets go when the swing has risen 30 degrees past the bottom of the arc. It runs 30 s from seven start views: the start yaw plus -30 to +30 degrees in steps of 10. A building counts by the `bid` of its collider.

- Plain desktop physics: 0 of 7 runs reach three buildings. The mean speed is 7 m/s. The distance is 55 to 150 m.
- An attach kick (speed across the rope toward the view, as `phoneBoost` does) of 6 m/s gives 4 of 7. 8 m/s gives 5 of 7. 10 m/s gives 6 of 7 (three buildings at 14 to 28 s, 135 to 224 m). 12 m/s gives 6 of 7. 14 m/s gives 4 of 7.
- A hop off the roof makes no clear difference to the pass rate (6 of 7 with and without it at 10 m/s). It still makes the first swing feel right, so the hop stays.
- The first swing from the start roof is short on the real game. On a phone the hero hops, the rope attaches at 0.28 s (speed 22 m/s), the hero lands on the 8 m of roof ahead, and the rope lets go. The next press carries on from the roof edge. The kick pays off in the chain of swings in the air.
- The start roof with the default camera: the best target has a screen height (NDC y) of 1.0 to 1.5 in all five start views of the prototype. That is on or above the top edge of the screen. I also measured the real game. The gold ring projects to NDC (-0.22, 1.43) at 960 by 540, and to (0, 1.27) on a phone at 390 by 844. So a player cannot see the ring, or tap it, at the start.
- Of 600 roof states with random view bearings, the old phone assist finds a target in 381 (64 percent). The first search tier alone finds one in 313. Both tiers find one in 424 (71 percent). The old assist wins in 3 states. The second tier fixes that by including every ray of the old assist.

The numbers set three decisions: a desktop attach kick of 10 m/s (a start value), a view lift while the player swings, and a second search tier that includes the old assist.

## The input table

One table for every flat device. "Swing input" means the swing button of that device. A change from today is marked in the next table.

| Action | Keyboard and mouse | Standard game pad | Phone |
|---|---|---|---|
| Swing (hold to stay on the rope) | Left mouse button, or E | RT (R2) | Tap a building. Or press SWING, or tap anywhere on the city |
| Second rope (hold) | Right mouse button, or Q | LT (L2) | None. A tap with a rope out moves the rope to the tapped building |
| Let go | Release the swing input that holds the rope | Release RT or LT | The rope lets go by itself. Or press LET GO (the SWING button, once it shows LET GO) |
| Yank, or pump a clog | F. Space in the air with a rope out. Three yanks flush a clog | RB (R1), or X (Square) | None to press. A rope on a clog pumps by itself. The fling on release replaces the yank. Optional: pull the phone |
| Reel in (hold) | Shift, or the mouse wheel | LB (L1) | Automatic (auto pull). Optional: pull the phone |
| Jump | Space on the ground | A (Cross) on the ground | Automatic: a swing from a roof hops off |
| Climb up, climb down | W and S, or the up and down arrows | Left stick up, down | Climb pad: up and down arrows (hold) |
| Move along a wall | A and D, or the left and right arrows | Left stick left, right | Climb pad: left and right arrows (hold) |
| Jump off a wall | Space. Or swing: a rope swings you off | A. Or swing | JUMP on the climb pad. Or tap: a rope swings you off |
| Move (walk, steer in the air) | W A S D, or the arrows | Left stick | None on the ground. In the air the view follows your flight |
| Look | Mouse (pointer lock) | Right stick | Drag on the city. Optional: motion aim |
| View (third or first person) | V | Y (Triangle) | VIEW button |
| Map (press again to close) | Tab, or M | Back (Share) | Pause, then Map |
| Menu (pause) | Esc | Start (Options) | Pause button |
| Recenter | None | None | Center, only while motion aim is on |

### What Space and A do in each state

| State | Space and pad A |
|---|---|
| On the ground | Jump (5.2 m/s up) |
| On a wall | Jump off the wall (6 m/s out and 6 m/s up). The wall regrab delay stays |
| In the air, a rope flying or attached | Yank on every attached rope (pull 2.5 m/s). Unchanged from main |
| In the air, no rope | Nothing |

### What the swing input does in each state

| State when the swing input goes down | Result |
|---|---|
| Both ropes idle, on the ground, target found | Hop off, fire one rope at the target, kick on attach |
| Both ropes idle, in the air, target found | Fire one rope at the target, kick on attach |
| Both ropes idle, no target | Wait 0.3 s for a target (`SWING.fireHold`), then a dry fire and a hint line |
| One rope is out and the other input holds it | Fire the idle hand at the next target. Choose a different building when one qualifies. No kick |
| Both ropes are out | Ignore the press. No dry fire |
| On a wall | Fire at a building away from the wall. The rope swings you off the wall |
| The input goes up | Let go of the rope that input holds. The other rope stays |

The left mouse button, when a rope is out: the button that holds a rope is down, so it has nothing to press. If the right button holds the rope, a new left press fires the idle hand. Each button lets go of its own rope only.

### Changes from today, and why

| Item | Before | After | Why |
|---|---|---|---|
| Swing aim | Both buttons fire at the screen centre | Both buttons fire at the auto target | The centre is the hero's chest in third person. A target the player can see replaces the 32 degree guess |
| Which hand fires | Left button: left hand. Right button: right hand | The hand on the side of the target. Ties alternate. The right button, with both ropes idle, fires the right hand | The rope arm of the hero then does not cross the body. The first press of the left button still fires the left hand when the target is ahead |
| E and Q | Not used | E swings. Q is the second rope | A trackpad player cannot hold a click and move a finger. E and Q sit next to W A S D |
| Yank key | F | F (kept) | Players know F. E is more reachable, but it is not clearly better, and E now swings |
| Space | Jump, wall jump, air yank | Same | Players know it. It keeps the thumb on one key. Making Space a swing key would clash with the air yank |
| Wheel | Reel | Same | Kept |
| Map key | Tab | Tab or M. A second press closes the map | Tab is a browser focus key. M is the usual map key. A pad player needs a close button |
| Keys with Ctrl, Meta or Alt | Count as the plain key | Do nothing | Ctrl+F, Ctrl+R and Cmd+W must not yank, steer or close |
| Rope trigger setting | A headset "Toggle" setting also changes flat play | Flat play always holds | The setting is not in the flat Comfort menu, so a flat player cannot undo it |
| Pad RB | Reel | Yank | A yank is a quick press that a player repeats. A bumper is reachable with both thumbs on the sticks |
| Pad LB | Reel | Reel | Kept. RB moved to the yank |
| Pad X | Yank | Yank (kept as a second key) | Players know it |
| Pad Y | Nothing | View | `input.viewDown` had no source. V needs a pad form |
| Pad Back | Nothing | Map | The map needs a pad form. Start closes it too |
| Pad sticks | Dead zone on each axis | Radial dead zone. A curve on the look stick | A square dead zone makes diagonal drift. A curve gives fine control near the middle |
| Pad triggers | One threshold, 0.5 | Down at 0.5, up below 0.3 | A trigger near 0.5 must not flutter and let go of the rope |
| Phone VIEW | None | A VIEW button | The eye form of V |
| Phone Center | Always shown | Shown only while motion aim is on | It does nothing else. Its room goes to VIEW |
| Phone centre ring | A ring at the screen centre | A ring on the target. The centre ring shows only in first person | The centre is the hero in third person |
| Phone buttons | Small, plain | At least 48 by 48 CSS px, in the comic style of the HUD | A thumb needs the room. The look matches the key art |
| Phone vibration | None | 15 ms on attach, 25 ms on a yank, 40 ms on a pump | A touch screen gives no feel. A short buzz confirms a catch when the sound is off |
| Title label on touch | PLAY ON PHONE | PLAY WITH TOUCH | A tablet or a touch laptop is not a phone. The label says which scheme starts |

I do not add a stick or a walk control to the phone. Main replaced the floating stick with the one-thumb scheme on purpose. I do not add a "turn your phone" card. Main plays in portrait and in landscape.

## The auto target

`public/vr/js/target.js` is new. It is pure: it takes `city` and plain `{x, y, z}` objects, and it does not import three or touch the DOM. A Node test can import it, as `physics.js` is imported today.

### Inputs

`main.js` fills one context object each frame and reuses it. The picker never keeps it.

| Field | Meaning |
|---|---|
| `head` | The aim origin: the head, `{x, y, z}` |
| `cam` | The camera position |
| `yaw`, `pitch` | The view, in radians. Yaw 0 faces -z |
| `fov`, `aspect` | Vertical field of view in degrees, and width over height |
| `vel` | The body velocity |
| `chestY` | Height of the chest (feet plus `P.chest`) |
| `onGround`, `wall` | `wall` is `null` or `{nx, nz}`, the outward normal of the wall you hold |
| `time` | Seconds |
| `specials` | The list from `ropes.targets()` (clogs, pipes) |
| `ring` | `null`, or the gold ring (`city.goldRing`) while tutorial step 0 runs |
| `avoidBid` | `null`, or the `bid` of the building a rope is attached to: the next target avoids it |
| `bias` | `null`, or `{yaw}`: the bearing of a phone tap that missed |

### Candidates, tier 1

1. Compute the preferred elevation: the camera pitch plus 35 degrees, clamped to 35 to 60 degrees. While the body falls faster than 3 m/s, add up to 12 degrees (full at 15 m/s), to a top of 72 degrees.
2. The preferred bearing is the view yaw. With a `bias`, it is the bias yaw. On a wall, if the view faces the wall (the dot of the view forward and the wall normal is under 0.2), it is the bearing of the wall's outward normal.
3. Cast rays from `head` in a fan. The azimuth runs -35 to +35 degrees in steps of 7. The elevation runs from the preferred value minus 25 to plus 25 degrees in steps of 10, kept inside 20 to 75 degrees. The azimuth narrows to the horizontal half field of view times 0.92 when that is smaller, so in portrait the fan never leaves the screen sideways. At most 66 rays.
4. Each ray is `city.raycast(...)` out to 88 m. Call `city.raycast` through the `city` object on every call, so a test can replace it.
5. Reject a hit that is closer than 9 m, farther than 80 m, 4 m or less above the chest, a roof or a floor (`ny` over 0.7), or a roof antenna.

### Candidates, tier 2 (only if tier 1 finds nothing)

Cast the rays of the old phone assist, to both sides and with no view limit: yaw offsets 0, 22, 45 and 75 degrees, pitches 16, 28, 42 and 56 degrees. Accept a hit 9 m or more away, in reach, and more than 3 m above the chest. Tier 2 makes the picker a superset of the old assist. On a wall, tier 2 uses the bearing chosen in step 2.

### Score

Higher is better. The numbers match `score()` in `rope.js`, so players who know the aim assist feel the same preferences.

```
s = 1
  - 0.55 * angle          angle from the preferred direction, 0 to 1 over the fan
  - 0.35 * distance       0 inside 25 to 60 m, then grows to 1 over 25 m
  + 0.25 * up             min(1, metres above the chest / 20)
  + 0.15 * ahead * k      cosine to the velocity, k = min(1, speed / 10), when speed is over 3 m/s
  + 0.10 * wall           for a wall (|ny| under 0.35)
```

Every number is a start value in `TARGET` in `config.js`. The bots in `target.test.mjs` and `flat.mjs` tune them.

### Specials

A clog, a pipe or the gold ring wins over every building when all of these hold:

- It is within 60 m. The gold ring uses 80 m.
- It is within 22 degrees of the camera forward, measured at the camera (what the player sees). The gold ring uses 35 degrees.
- A ray from the head reaches it with no collider in the way. This is the line-of-sight rule of `rope.js`.
- A pipe faces the head within 60 degrees of its outward normal (`PIPE_COS` in `rope.js`).

The gold ring counts only while tutorial step 0 runs, and its target point is the centre of the ring. Among specials, the one nearest the view axis wins. The 60 m range keeps the three `hero.mjs` aim checks for clogs on a lower roof (14 to 60 m) true. The result carries `special: true` and the tag. `ropes.aim` then snaps to the same special, because the aim ray ends on its centre.

### Hysteresis

The picker keeps the held target. Each search first re-casts a ray from the head to the held point. The target stays valid when the same collider is hit within 2 m of the old distance and the reach rules still hold. A challenger replaces a valid held target only when its score is more than 20 percent higher (`SWING.targetSwitchMargin`) and the held target is at least 0.2 s old. An invalid held target is replaced at once. A special replaces a building at once. The picker searches at most every 50 ms and re-checks the held target every frame with one ray.

### Hand choice and the second rope

- The hand follows the side of the target. The side is the angle from the view axis to the target, seen from above. A target more than 6 degrees to the left picks the left hand. More than 6 degrees to the right picks the right hand. Otherwise the hand that did not fire last fires.
- With both ropes idle, the right mouse button, Q and LT fire the right hand at the same target.
- If a rope is attached, the picker sets `avoidBid` to its building. The result is the next target. It is also the target of the second rope. When no other building qualifies, the picker returns the same building.
- On a phone the hand is always the right hand (index 1), because `phoneRelease` and `phoneBoost` read rope 1.

### How it replaces the near-ground stopgap

`main.js` deletes `AIM_UP` and `AIM_NEAR` and the ground branch of `viewAim`. `viewAim` stays as an exact ray through a pixel.

`flatInput` chooses the aim ray of every hand, before the test overrides run:

| Case | Aim ray |
|---|---|
| Third person, swing input or SWING button | Toward the auto target. With no target, along the view forward |
| First person, no tap | The exact ray through the screen centre if it hits a building point that can hold a swing. Otherwise toward the auto target |
| A phone tap, any view | The exact ray through the tapped pixel if it hits a building point that can hold a swing. Otherwise toward the auto target, with the tap bearing as `bias` |

A point can hold a swing when three things are true. The hit is 9 to 88 m away. It is not a roof or a floor (`ny` over 0.7). It is more than 3 m above the chest. Any tag counts, so an exact tap on a roof antenna works. A clog or pipe under the pixel wins through `ropes.aim`, as today.

Why the exact ray comes first: a player who points at a building wants that building. Why a roof at the hero's feet fails the test: that is the near-ground case. The auto target answers it, so the tap on the hero still swings up and ahead.

The phone safety net stays. `phoneAim` calls `ropes.aim` and, when the result cannot hold a swing, calls the picker with the aim ray's bearing as `bias` (in place of `assistAim`). A test that points the aim straight up (`G.test.aimAt`) still reaches a building through this net. A desktop kind does not use the net: `flatInput` has chosen the ray, and a test override must win.

### The marker on each device

The marker shows the target of the next swing. It shows while a rope is attached too, and then it marks the next building (`avoidBid`). It hides when both ropes are out, in the intro, when paused, and when there is no target.

| Device | Marker |
|---|---|
| Keyboard and mouse, game pad | The world reticle of `rope.js` on the surface (yellow ring, green with points on a clog). A comic lock-on ring (`#lockRing`) at the screen position of the target, 44 px across. `desktop.js` draws the ring |
| Phone | The world reticle. A comic lock-on ring (`.phone-target`) 56 px across. `mobile.js` draws it. The SWING button dims while there is no target |

Why two rings: the world reticle is 1.5 degrees wide. That is about 12 px at 960 by 540, too small to find. The lock-on ring does not depend on the screen size.

The ring sits at the NDC position `{x, y}` that `main.js` computes from the camera. When the target is outside the screen (NDC beyond 1), the ring turns into an arrow on the screen edge, pointing at the target. The arrow keeps clear of the top buttons and the SWING panel on a phone. A clog marker is sludge green with points. Reduced motion stops the pulse.

### No target

- No world reticle and no lock-on ring show.
- A mouse or pad swing input waits 0.3 s for a target, then dry-fires: the cup flies 6 m and drops (`SWING.dryFly`). A phone tap dry-fires at once, as today.
- Desktop and pad: the subtitle says "No building to swing from. Look up at one." at most once every 10 s.
- Phone: the SWING button dims, and `mobile.miss()` shows its hint line.
- A held button that sees a target within 0.3 s fires at it.

### On a wall

A player on a wall presses the swing input. The picker uses the wall rule of step 2 and the tier 2 rays if tier 1 finds nothing. The rope then swings the player off the wall (`fire` calls `leaveWall`). The `swing-climbing` requirements stay as they are.

### The view lift

At the default pitch the best anchors are above the screen. So `flatcam.js` eases the pitch up toward +8 degrees (0.14 rad, `PHONE.follow.pitch`). It does this while a rope is flying or attached, or while the body is in the air above 6 m/s. The player must not have moved the look input for 0.7 s. It never lowers the pitch by itself and it does not reset the follow timer. On a phone `phoneFollow` already does this, so the flag is off there. With the lift, the top edge is 43 degrees above the horizon, and a target at the preferred 35 degrees is on screen.

### Budget

- At most 66 rays per tier 1 search and 28 per tier 2 search. At most 20 searches a second.
- No allocation in `update`. The result and the context are reused objects.
- `target.test.mjs` counts the calls to `city.raycast`.

## The swing assist for the mouse and the pad

Two assists run only for a rope that a real swing input fired. A rope fired by `G.test.press` gets neither, so the numbers of `hero.mjs`, `play.mjs` and `swing.mjs` stay as they are. `desktop.js` marks the frame with `hands[i].swingDown`.

- Hop: from the ground, `shoot` adds `jumpDown` and 5 m/s toward the target, as it does on a phone. A clog, a pipe or the crack gets no hop.
- Both assists push a ring event (`hop` and `kick`, as the phone pushes `fling`), so a test can see them.
- Kick: on attach, `phoneBoost` is generalised. It adds speed across the rope toward the view until the speed along that direction is `DESKTOP.attachSpeed` (10 m/s). It does nothing when the anchor is straight ahead, when the other rope is attached, or on a special or sticky target. The pure function `attachKick` in `target.js` holds the maths, so Node can test it. The phone keeps `PHONE.attachSpeed` (17 m/s).

There is no auto release on the desktop. Letting go at the right moment is the skill, and a headset player does the same.

## Desktop and pad input

`desktop.js` merges the keyboard, the mouse, the pad and the phone panel. It outputs these logical inputs:

- Swing 1 (left button, E, RT) and swing 2 (right button, Q, LT).
- On a press, `desktop.js` asks `D.chooseHand(which)` (set by `main.js`) for a free hand. It holds that hand's trigger until the input goes up. With no free hand it ignores the press. Without a callback, swing 1 uses the left hand and swing 2 the right hand.
- `hands[i].swingDown` is true for the one frame of a real press.
- `inp.viewDown` is true for the one frame of a Y press or a VIEW press.
- `inp.mapDown` from Tab, M and Back. `main.js` closes an open map on the next press.
- `inp.kind` is "mouse", "pad" or "touch". It follows the device in use, as today.

Pad details: radial dead zone of 0.15 (`PAD.dead`). The look stick output is `((|v| - dead) / (1 - dead)) ^ PAD.curve` times `PAD.lookRate`. The move stick uses the same dead zone and a unit limit. A trigger goes down at 0.5 and up below 0.3. A pad with a mapping other than "standard" is ignored, as today.

Pad rumble: `D.rumble(strong, ms)` plays a "dual-rumble" effect on the pad in use, when `vibrationActuator` exists. Attach: 0.3 for 30 ms. Yank: 0.4 for 40 ms. Pump: 0.6 for 60 ms.

### The first-minute hint strip

`desktop.js` makes `#keyHints`, a comic caption strip at the bottom of the screen. `main.js` calls `D.hints(on)` each frame. It is on while the state is "play", the saved tutorial is not finished (`!save.tutorial`), and fewer than 60 s of play time have passed. It reads the kind each frame.

- Mouse: HOLD LEFT MOUSE: SWING. W: STEER. F: YANK. SPACE: JUMP.
- Pad: HOLD RT: SWING. LEFT STICK: STEER. RB: YANK. A: JUMP.

The strip is at most 36 px high and sits under the subtitle. It never covers the score pills or the spoken line.

## Words

`config.js` holds the lines. `LINES_PAD` has the same keys and counts as `LINES_DESKTOP`, as `ui.mjs` checks.

`LINES_DESKTOP` changes these lines. The others stay.

- tutorial 0: "Look at the gold ring. Hold the left mouse button."
- tutorial 1: "Swing out. Let go as you rise."
- tutorial 2: "Swing again before you land."
- tutorial 5: "Move the mouse to look around."
- tutorial 7: "That green light is a clog. Look at it and swing."
- clog 0: "That's a clog. Look at it and swing."
- clog 1: "Press F three times to pump."

`LINES_PAD` is new.

- intro 0: "Shoes off. Plunger up."
- intro 1: "Hear that? Something is backing up."
- intro 2: "Aim at the crack. Hold RT."
- intro 3: "Now press RB to yank."
- intro 4: "Clear the space around you."
- intro 5: "Give yourself some room."
- tutorial 0: "Look at the gold ring. Hold RT."
- tutorial 1: "Swing out. Let go as you rise."
- tutorial 2: "Swing again before you land."
- tutorial 3: "Hold LB to reel in."
- tutorial 4: "Press RB to yank."
- tutorial 5: "Push the right stick to look around."
- tutorial 6: "Your score is at the top of the screen."
- tutorial 7: "That green light is a clog. Look at it and swing."
- clog 0: "That's a clog. Look at it and swing."
- clog 1: "Press RB three times to pump."
- clog 2: "Flushed."
- clog 3: "The city thanks you. Quietly."
- king and splash: the shared lines.

`LINES_PHONE` changes tutorial 0 to "Tap SWING to swing at the gold ring." The phone lines still name no mouse, key, trigger, pinch or grip.

`ui.sayLine` picks the table in this order: hands, then phone (kind "touch" or `easySwing`), then pad, then mouse, then the controller lines.

### How to play

Agent B writes these sections in `index.html`. The hands and controller sections stay. `boot.mjs` needs the words "pinch" and "Shift" in the dialog, and both stay.

Keyboard and mouse:

- The game picks a building for you. Look toward the buildings you want. A ring marks the target.
- Hold the left mouse button, or <kbd>E</kbd>, to swing. Let go to let go of the rope.
- Hold the right mouse button, or <kbd>Q</kbd>, to add a second rope.
- Hold <kbd>Shift</kbd> or turn the wheel to reel in.
- Press <kbd>F</kbd> to yank. Three yanks plunge a clog.
- <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys walk and steer in the air. The mouse looks around.
- <kbd>Space</kbd> jumps. In the air it yanks. On a wall it jumps off.
- Fly or walk into a wall to hold on. <kbd>W</kbd> and <kbd>S</kbd> climb. <kbd>A</kbd> and <kbd>D</kbd> go along it. A rope swings you off.
- <kbd>V</kbd> switches between the view behind the hero and the first-person view.
- <kbd>Tab</kbd> or <kbd>M</kbd> opens the map. <kbd>Esc</kbd> pauses.

Game pad (a standard pad, such as Xbox or PlayStation):

- Hold RT (R2) to swing. Hold LT (L2) to add a second rope. Let go to let go.
- Hold LB (L1) to reel in. Press RB (R1) or X (Square) to yank.
- The left stick walks, steers and climbs. The right stick looks around.
- A (Cross) jumps. On a wall it jumps off.
- Y (Triangle) switches the view. Back (Share) opens the map. Start (Options) pauses.

Phone:

- Tap a building to swing from it. Or press SWING, and the game picks a building. A ring marks the target.
- The rope lets go by itself and flings you on. Tap again while you fly.
- A tap on a clog plunges it.
- Drag to look around. VIEW switches the view.
- Hit a wall to hold on. Hold the arrows to climb. Tap JUMP to jump off.
- Motion aim is optional. Center sets it straight again.

## Numbers in `config.js`

Agent A adds these. They are start values. The bots tune them. Units are metres, seconds, degrees (as marked) and radians.

```js
export const TARGET = {
  rate: 0.05,                                                   // s between searches
  fan: { az: 35, azStep: 7, elSpan: 25, elStep: 10, elMin: 20, elMax: 75, view: 0.92 },
  wide: { yaw: [0, 22, 45, 75], pitch: [16, 28, 42, 56], above: 3 },   // tier 2: the old phone assist
  lift: { base: 35, min: 35, max: 60, fall: 12, fallFrom: 3, fallTo: 15, top: 72 },   // preferred elevation, degrees
  reach: { min: 9, best: [25, 60], max: 80, exact: 88 },
  above: 4,
  weight: { angle: 0.55, distance: 0.35, up: 0.25, ahead: 0.15, wall: 0.1 },
  special: { angle: 22, range: 60, pipeFacing: 60 },
  ring: { angle: 35, range: 80 },                               // the gold ring in tutorial step 0
  hold: { margin: 0.2, dwell: 0.2 },                            // margin is SWING.targetSwitchMargin
  side: 6,                                                      // degrees: below this, the hands alternate
  noneLine: 10,                                                 // s between the "No building" lines
};
export const DESKTOP = { attachSpeed: 10, hop: 5 };             // the kick (m/s), the hop toward the target (m/s)
export const PAD = { dead: 0.15, curve: 1.5, lookRate: Math.PI, trigger: { on: 0.5, off: 0.3 }, rumble: { attach: [0.3, 30], yank: [0.4, 40], pump: [0.6, 60] } };
export const HINT = { seconds: 60 };
// and in PHONE: buzz: { attach: 15, yank: 25, pump: 40 }
```

## The interface between agent A and agent B

Agent A owns the auto target and the desktop and pad input. Agent B owns the phone panel and the page. This section is frozen. A change to it needs both owners to agree. With it fixed, the two agents edit no common file.

### Files

| Agent | Owns (edits) |
|---|---|
| A | `public/vr/js/target.js` (new), `desktop.js`, `main.js`, `config.js`, `flatcam.js`, `ui.js` (the `sayLine` table and its import line only), `sw.js`, `qa/vr/flat.mjs` (new), `qa/vr/target.test.mjs` (new), `qa/vr/hero.mjs`, `qa/vr/boot.mjs`, `qa/vr/ui.mjs`, `quest/twa-manifest.json`, `.github/workflows/swing-browser.yml` |
| B | `public/vr/js/mobile.js`, `public/vr/index.html`, `qa/vr/mobile.test.mjs`, `qa/vr/mobile.e2e.mjs`, `qa/vr/phone-swing.e2e.mjs`, `qa/vr/phone-controls.e2e.mjs` (new) |
| Nobody | `physics.js`, `city.js`, `rope.js`, `hands.js`, `hero.js`, `game.js`, `qa/vr/lib.mjs`, `qa/vr/climb.e2e.mjs`, `qa/vr/play.mjs`, `qa/vr/pwa.mjs` |

`config.js` is A's alone. B's words are written in "Words" above, so A pastes them. `sw.js`, the version and the CI file are edited once by A at the end (task A9). Each test file keeps its own helpers. If an agent needs a change in a file it does not own, it asks the other owner. It does not edit the file.

### Calls and fields

| Name | Defined by | Used by | Shape |
|---|---|---|---|
| `mobile.sample(dt)` | B (exists) | A, in `desktop.js` | Existing fields plus `view`: `true` for the one sample after the VIEW button is pressed |
| `mobile.marker(m)` | B | A, in `main.js` | `m` is `null`, or `{x, y, kind, dist}`. `x` and `y` are NDC (-1 to 1, y up, may lie outside for an off-screen target). `kind` is "swing", "clog", "pipe" or "crack". `dist` is metres |
| `mobile.buzz(ms)` | B | A, in `main.js` | Vibrate `ms` ms when `navigator.vibrate` exists. At most one buzz every 40 ms. No buzz while the page is hidden |
| `mobile.target(valid, attached)` | B (exists) | A | Only the dead-latch safety stays. The ring and the dim belong to `marker` |
| `mobile.enabled`, `reset`, `start`, `miss`, `released`, `idle`, `rush`, `climbing` | B (exist) | A | Unchanged |
| `D.marker(m)` | A | A, in `main.js` | Same `m`. Draws `#lockRing`. `main.js` calls `(D.mobile.enabled ? D.mobile : D).marker(m)` |
| `D.hints(on)`, `D.rumble(strong, ms)`, `D.chooseHand` | A | A | Inside A's files |
| `inp.kind` | A | all | "mouse", "pad" or "touch" |
| `inp.easySwing` | A (exists) | B's tests | `true` on a phone |
| `inp.viewDown` | A | `main.js`, `flatcam` | `true` for one frame. A sets it from pad Y and `mobile.sample().view`. The V key reaches `flatcam` on its own |
| `inp.phoneFire`, `inp.phoneAim` | A (exist) | `main.js` | Unchanged. The SWING button gives `aim` of `null`. A tap gives `{x, y}` |
| `hands[i].swingDown` | A | `main.js` | `true` for the one frame of a real swing press |
| `document.body.dataset.view` | A (exists) | B's CSS | "first" or "third" |
| `#playFlat[data-label-touch]` | B | A, in `wireTitle` | The label on a touch device. `main.js` falls back to "PLAY ON PHONE" when the attribute is missing |
| `#phoneControls.target-ready`, `[data-action=throw].no-target`, `.phone-target`, `[data-action=view]` | B | B's tests | Class and attribute names that the join test reads |
| `G.test.target()` | A | both | `{ on, target, hand, side, ndc, inView, pref, avoid, picks, rays }`. `on` is `false` outside flat play |
| `G.test.input()` | A | both | Existing snapshot plus `viewDown` and each hand's `swingDown` |

`mobile.marker` is the only way A talks to the phone ring. A computes the NDC. B places the ring, the arrow and the dim.

## Checks

### Scenario to test

| Capability | Scenario | Proven by |
|---|---|---|
| Auto target | Start roof, hold the swing input, ring first | `flat.mjs` (real mouse events) |
| Auto target | Reach rules, no roofs, no antenna as an auto pick | `target.test.mjs` (5,000 sampled states) |
| Auto target | Portrait fan inside the screen | `target.test.mjs` (aspect 390 over 844) |
| Auto target | Falling lifts the preferred elevation | `target.test.mjs` (`pref` for a falling and a resting body) |
| Auto target | Clog, pipe and ring priority, line of sight | `target.test.mjs`, and the three `hero.mjs` aim checks |
| Auto target | Hysteresis | `target.test.mjs` (sweep of small view moves) |
| Auto target | Hand by side, second rope | `flat.mjs`, `target.test.mjs` (`hand`, `avoidBid`) |
| Auto target | Exact aim first, in first person and on a tap | `flat.mjs` (first person), `mobile.e2e.mjs` (tap off centre, tap on the hero) |
| Auto target | The tap on the hero never takes the roof | `mobile.e2e.mjs`, `hero.mjs` default aim |
| Auto target | Marker on every device | `flat.mjs` (ring and reticle on the target), `phone-controls.e2e.mjs` (ring, arrow, dim) |
| Auto target | No target | `flat.mjs` (replaced `city.raycast`), `mobile.e2e.mjs` (miss stays on the roof) |
| Auto target | On a wall | `flat.mjs` (swing off a wall), `climb.e2e.mjs` (phone tap off a wall) |
| Auto target | Superset of the old assist | `target.test.mjs` (no state where the old fan finds a target and the picker does not) |
| Auto target | Budget, no `three` import | `target.test.mjs` (ray count, import in Node) |
| Desktop | Swing input, release lets go, E and Q | `flat.mjs` |
| Desktop | Space in each state | `flat.mjs`, `climb.e2e.mjs` (wall) |
| Desktop | F, Shift, wheel | `flat.mjs` |
| Desktop | Modifier keys do nothing | `flat.mjs` |
| Desktop | Flat play ignores the headset rope-trigger setting | `flat.mjs` |
| Desktop | Hop and kick, only for a real input | `flat.mjs` (the `hop` and `kick` events), `target.test.mjs` (`attachKick`) |
| Desktop | Hint strip, size and place | `flat.mjs` |
| Desktop | First-time bot: three buildings in 30 s | `target.test.mjs` (7 start views), `flat.mjs` (3 start views, real inputs) |
| Gamepad | Every button and axis | `flat.mjs` (fake `navigator.getGamepads`) |
| Gamepad | Dead zone, curve, trigger hysteresis | `flat.mjs` |
| Gamepad | Rumble | `flat.mjs` (spy on `playEffect`) |
| Gamepad | Kind and words | `flat.mjs`, `ui.mjs` |
| Phone | SWING button uses the auto target | `mobile.e2e.mjs` |
| Phone | VIEW button | `mobile.test.mjs` (`view` edge), `phone-controls.e2e.mjs` (join) |
| Phone | Vibration | `mobile.test.mjs`, `phone-controls.e2e.mjs` (spy on `navigator.vibrate`) |
| Phone | Touch size, layout, no overlap, no sideways scroll | `phone-controls.e2e.mjs`, `phone-swing.e2e.mjs` |
| Phone | Words, How to play, title labels | `phone-controls.e2e.mjs`, `ui.mjs` |
| Phone | No turn card, both orientations play | `phone-controls.e2e.mjs` |
| Phone | First-time bot: taps only, three buildings in 30 s | `phone-controls.e2e.mjs` |
| Camera | V, Y and VIEW toggle once | `hero.mjs` (exists), `flat.mjs`, `phone-controls.e2e.mjs` |
| Camera | The view lifts and never lowers | `flat.mjs` |
| Headset | No lock ring, no strip, no change | `hero.mjs` VR run (A adds two assertions: `G.test.target().on` is false, and no `#lockRing` or `#keyHints` is visible), `xr.mjs`, `swing.mjs` |

### The first-time bot

The bot uses only the swing input and W. It never reels, yanks, jumps, looks or uses the second rope.

- Start: the start roof, tutorial not finished, the default view (the start yaw plus an offset).
- Press the swing input when no rope is out and a target exists.
- Let go when the body is rising, moving away from the anchor, and 30 degrees or more past the bottom of the arc. Also let go after 4 s.
- A building counts once, by the `bid` of its collider (a collider with no `bid` counts by `id`).
- Pass: three different buildings attached, in 30 s of game time, with no respawn.
- `target.test.mjs`: seven offsets (-30 to +30 degrees in steps of 10). The offset 0 and the offsets +10 and -10 must pass. At least 6 of 7 must pass.
- `flat.mjs`: the offsets -10, 0 and +10, with real mouse and key events. All three must pass.
- If the bot fails, tune in this order: the weights in `TARGET`, then `DESKTOP.attachSpeed` (not above 14), never `physics.js`.

The phone bot uses only taps (the SWING button and taps on the city), the same pass rule, in `phone-controls.e2e.mjs`. The old 12 s run in `phone-swing.e2e.mjs` stays (mean 15 m/s, 140 m).

### Assertions of existing tests that change

| Test | Change | Why |
|---|---|---|
| `boot.mjs` | The pad kind check presses button 1 (B), not button 3 (Y) | Y now toggles the view. B has no action. The kind check still needs a pressed button |
| `ui.mjs` | The check that "mouse and pad read the desktop lines" becomes "mouse reads the desktop lines and pad reads `LINES_PAD`". The `LINES_PHONE` key check also covers `LINES_PAD` | A pad player now has its own words |
| `mobile.test.mjs` | The stub `Element` gets `style` and `classList.contains`. No assertion value changes. New asserts are added | `mobile.js` now sets styles |
| `hero.mjs` | The three aim checks keep their assertions. Their comments say "auto target", not "ground rule". If the view lift moves a pitch reading during a swing, that check sets the pitch itself | The stopgap is gone. The checks guard the same behaviour |
| `mobile.e2e.mjs`, `phone-swing.e2e.mjs`, `climb.e2e.mjs` | None. Every threshold stays: 15 m/s mean, 140 m in 12 s, the tap within 8 m of the tapped building, the anchor 5 m over the roof | These are contracts. If the picker lowers a number, tune `TARGET`, not the threshold. On main today `phone-swing.e2e.mjs` reads a mean of 18.9 m/s, 190 m and 3 flings, so the margin is 26 percent on speed and 36 percent on distance |
| `pwa.mjs` | None | `target.js` joins the `sw.js` list and the version moves, so the test passes as it is |

`play.mjs`, `swing.mjs`, `xr.mjs` and `perf.mjs` use `G.test.press` and `aimAt`, which skip the assists. They do not change.

### Visual checks

- DOM and world markers: `getBoundingClientRect` of the ring and the projection of `G.test.target()` agree within 3 px. The world reticle comes from `G.ropes.info().reticles`.
- Layout: no overlap between the hint strip, the subtitle, the score pills, the top buttons and the SWING panel. Sizes: 640 by 360, 960 by 540, 1280 by 720, 844 by 390 and 390 by 844. The page does not scroll sideways.
- Touch size: every visible phone button is at least 48 by 48 CSS px.
- Screenshots at the five sizes go to `SHOTS` and are read by the person who does the change: the ring on the target, the edge arrow at the start roof, the strip, the green clog ring, the dimmed SWING button.

## Risks

- The start values in `TARGET` and `DESKTOP` may need tuning. The bots are the gate, and the order of tuning is fixed above.
- `desktop.js` makes DOM. It must not write `localStorage`. `main.js` owns the save.
- The lock-on ring costs one DOM transform a frame. `perf.mjs` does not measure DOM. Check on a phone.
- The view lift changes where the camera sits during a swing. `hero.mjs` has pitch checks to watch.
- A pad has an unknown button layout. Only `mapping === "standard"` is read.

## Not in this change

- Touch-screen laptops. `mobile.js` treats any device with a touch point as a phone, so the mouse buttons do nothing there. See the open question in `proposal.md`.
- A walk stick on the phone.
- Pad control of the pause menu and the map pins. Start closes both.
- Mouse sensitivity, invert Y and remapping.
- Tablet layouts beyond the two phone sizes.

## Checks that need real hardware

Nobody has run these. The cloud session has no device.

- A real phone: thumb reach to SWING, VIEW and the arrows in both orientations. Vibration. The ring and the arrow over a moving city. Motion aim.
- A real mouse with pointer lock, a trackpad (E and Q), and a Windows or Mac keyboard for Ctrl and Cmd keys.
- A real pad: Xbox and PlayStation layouts, the trigger values, drift, rumble.
- Speakers and headphones: unchanged, but listen once.
- A Quest: unchanged play, no ring, no strip.

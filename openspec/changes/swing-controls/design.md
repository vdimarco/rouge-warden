# Design

This design covers play on a flat screen: a mouse and keyboard, a game pad and a phone. Headset play does not change. `physics.js`, `city.js`, `rope.js` and the rest pose of the chase camera do not change.

## What the code does today

I read the code on main. These facts drive the design.

| Area | Today | Gap |
|---|---|---|
| Swing aim, third person | `viewAim` in `main.js` casts a ray through the screen centre. A hit on an up-facing surface within 12 m of the hero, or a miss that points down at ground within 12 m, becomes the same bearing 32 degrees up (`AIM_UP`, `AIM_NEAR`). | The screen centre is the hero's chest. The design notes of `swing-hero-comic` call the rule a stopgap and say an auto target must replace it. |
| The opening | `flatInput` runs in the opening too, in first person. Both mouse buttons fire at the exact centre ray. `ropes` is in "special" mode, so only the crack, clogs and pipes take a cup. | An auto target must not bend that ray. The player must hit the crack. |
| Mouse and keyboard | `desktop.js`: the left button fires the left rope and the right button fires the right rope. Shift or the wheel reels. F yanks (3.5 m/s). Space jumps, or yanks in the air. Tab opens the map and nothing closes it. Esc pauses. | No target shows. A trackpad player has no swing key. Ctrl+F counts as F. Any wheel event reels, so a pinch or a flick reels. The click that resumes from a pause also fires a rope. |
| Game pad | `standardPad()`: LT and RT hold the left and right rope. LB and RB reel. A jumps. X yanks. Start opens the menu. | Nothing sets `input.viewDown`, so Y does nothing. A trigger near 0.5 can flutter and let go. The tutorial tells a pad player to hold Shift. |
| Touch detection | `mobile.enabled` and `TOUCH_ONLY` are true when `navigator.maxTouchPoints > 0` (`TOUCH_ONLY` also tests `any-pointer: coarse`). | A touch laptop, a 2-in-1 or a handheld PC plays the phone scheme. The mouse buttons, the pointer lock and the pad all do nothing there. |
| Phone | `mobile.js` and the phone rules in `main.js`: one tap swings, the rope lets go by itself, a tap at the sky calls `assistAim`, a tap on a clog plunges it, a climb pad shows on a wall. | The centre ring sits on the hero in third person. There is no view button and no vibration. The first tutorial line asks for a tap on the gold ring, which is above the screen at the start. Motion aim is on by default on Android, so four buttons can share the top row. The buttons are plain. |
| Camera | The chase camera looks down 15.5 degrees at rest. The vertical field of view is 70 degrees. | The top edge of the screen is 19.5 degrees above the horizon. Good anchors sit 25 to 45 degrees up, so they are above the screen. |
| The rope in flight | `ropeInput` in `physics.js` lets go of a flying rope the moment `hand.holding` is false. A cup needs up to 0.3 s to land. | A click of 80 ms cancels the cup. |
| Physics | Flat play uses `FLAT_SWING = { ...SWING, climb: CLIMB }` with the "desktop" preset caps (35 m/s). A touch rope on a wall grabs the wall, lets go of the ropes and stops the body. | A bot that ignores climbing measures the wrong game. |

## Evidence from a throwaway bot

The bot is not in the repo. A3 rebuilds it as `qa/vr/target.test.mjs`. It ran in Node with `physics.js`, `city.js` and a prototype of the picker: tier 1, a tier 2 without the cone, the gold ring, and the variety rule where marked. These are its conditions.

- Physics: `{ ...SWING, climb: CLIMB }`, speed caps 35 and 35, as the game uses.
- The bot holds W. It presses the swing input when a rope is idle and a target exists. A cling on a wall ends with the next press.
- Camera model: the default chase pitch, the follow turn of `flatcam.js` (time constant 1.2 s, only above 6 m/s and after 1.5 s with no look input), the view lift, a field of view that widens with speed, and a camera that turns to look away from a wall.
- Imperfect play: the bot lets go 30 degrees (plus or minus 25 degrees at random) past the bottom of the arc. It waits 0.2 to 0.4 s before each press and each release. It lets go after 0.5 s of dragging on a roof or a street, and after 4.5 s on any rope.
- Tutorial step 0 is on, so the gold ring is a special for the first press.
- Starts: the start roof at seven headings (-30 to +30 degrees in steps of 10) with six random seeds each (42 runs, of which 18 are at -10, 0 and +10). Also the 25 safe roofs of `city.safe` with six random headings each (150 runs).
- Pass: three different buildings (by `bid`) in 30 s of game time.

| Setting | Start roof, 42 runs | Start roof, -10 to +10, 18 runs | 150 random starts | Median and 90th percentile of the time to three buildings |
|---|---|---|---|---|
| Hop 5 m/s, no variety rule, kick 0 | 17 | 2 | 98 | 10.2 s, 19.6 s |
| Hop 5 m/s, no variety rule, kick 10 | 19 | 1 | 122 | 9.0 s, 16.5 s |
| No hop, no variety rule, kick 10 | 34 | 10 | 121 | 9.4 s, 18.0 s |
| No hop, variety rule, kick 0 | 40 | 16 | 126 | 9.5 s, 16.1 s |
| No hop, variety rule, kick 10 | 42 | 18 | 133 | 8.1 s, 15.6 s |
| No hop, variety rule, kick 14 | 24 | 0 | 130 | 7.4 s, 16.5 s |
| Hop 5 m/s, variety rule, kick 10 | 30 | 6 | 135 | 7.8 s, 15.5 s |

The "variety rule" takes 0.6 from the score of a building that held one of the last two ropes. Levers on the last row: with no second search tier the random starts fall to 111, with no ground release to 130, with climbing off the start roof passes 42 of 42 and the random starts fall to 125.

What the numbers say:

- A first estimate said the attach kick moves a plain bot from 0 of 7 to 6 of 7. That bot ignored climbing and made no mistakes. With the real flat physics the kick alone does not decide the result. On random starts it adds 7 to 24 of 150 runs. At the start roof it helps little, and 14 m/s is worse than 10 m/s there.
- A bot with no variety rule swings back and forth on the same tower and fails. The rule adds 12 to 19 of the 150 random runs and decides the start roof.
- A hop off the roof hurts at the start roof. The first swing lands on the same roof again. The hop moves from "kept for feel" to a tuning value that starts at 0 on a computer. The phone keeps its hop.
- The second search tier adds 24 of the 150 random runs. It stays, and it must match the old phone assist, including its cone.
- A bot that never looks is a floor for a human. It still must pass, because it is the one check that needs no person.
- A quick Node model of the phone passed only 24 of 42 start-roof runs. It does not model dragging to look, taps on exact pixels or the real aim path. B3 measures the phone in the browser. Do not read that model as a result.
- `city.raycast` costs about 1.2 microseconds per ray in Node (20,000 random rays from the start roof). One tier 2 search of 700 rays costs about 0.9 ms.
- The start roof with the default camera: the best target has a screen height (NDC y) of 1.0 to 1.5, on or above the top edge. The gold ring is 44 degrees from the camera forward, at NDC (-0.22, 1.43) at 960 by 540 and (0, 1.27) on a phone at 390 by 844. The player cannot see or tap the ring at the start.

The numbers set these decisions: a variety rule, a view lift, a second search tier that ports the old assist, a release cue, a latch for a quick press, a kick of 10 m/s as a start value and a hop that starts at 0. The bots in `target.test.mjs` and `flat.mjs` decide the final values.

## Which scheme a device plays

- A device with no touch point plays the mouse and pad scheme.
- A device with touch points and no fine pointer (`any-pointer: fine` is false) plays the phone scheme. This is a phone or a tablet.
- A device with touch points and a fine pointer (a touch laptop, a 2-in-1, a handheld PC) shows two buttons on the title: PLAY WITH TOUCH and PLAY WITH MOUSE AND KEYBOARD. The player chooses. PLAY WITH MOUSE AND KEYBOARD calls `mobile.use(false)`. From then on `mobile.enabled` is false, the pointer lock works, the pad is read and the phone panel stays hidden. PLAY WITH TOUCH calls `mobile.use(true)`, so a player who chose the mouse and then leaves to the title and presses PLAY WITH TOUCH gets the phone scheme back, with `body[data-device]` set to touch. RE-ENTER keeps the scheme that was in use.
- On every touch device `#playFlat` keeps its position and its touch behaviour, so the three phone tests, which fake only `maxTouchPoints`, run unchanged.

Why a choice and not a guess: a stricter test needs the three phone e2e tests to fake `matchMedia` too. A choice leaves them alone and needs no guess about hardware.

A phone or tablet with a Bluetooth pad stays on the touch scheme. The pad does nothing there. See "Not in this change".

## The input table

One table for every flat device. "Swing input" means the swing control of that device. The next tables list what changes from today, and why.

| Action | Keyboard and mouse | Standard game pad | Phone |
|---|---|---|---|
| Swing (hold to stay on the rope) | Left mouse button, or E | Right trigger (RT, R2) | Tap a building. Or press SWING, or tap anywhere on the city |
| Second rope (hold) | Right mouse button, or Q | Left trigger (LT, L2) | None. A tap with a rope out moves the rope to the tapped building |
| Let go | Release the swing input that holds the rope. A cue says when | Release RT or LT. A cue says when | The rope lets go by itself. Or press LET GO |
| Yank, or pump a clog | F. Space in the air with a rope out. Three yanks flush a clog | Right bumper (RB, R1), or X (Square) | None to press. A rope on a clog pumps by itself. The fling on release replaces the yank. Optional: pull the phone |
| Reel in (hold) | Shift, or the mouse wheel | Left bumper (LB, L1) | Automatic. Optional: pull the phone |
| Jump | Space on the ground | A (Cross) on the ground | Automatic: a swing from a roof hops off |
| Climb up, climb down | W and S, or the up and down arrows | Left stick up, down | Climb pad: up and down arrows (hold) |
| Move along a wall | A and D, or the left and right arrows | Left stick left, right | Climb pad: left and right arrows (hold) |
| Jump off a wall | Space. Or swing: a rope swings you off | A. Or swing | JUMP on the climb pad. Or tap: a rope swings you off |
| Move (walk, steer in the air) | W A S D, or the arrows | Left stick | None on the ground. In the air the view follows your flight |
| Look | Mouse (pointer lock) | Right stick | Drag on the city. Optional: motion aim |
| Aim a swing exactly | V for first person, then the crosshair | Y for first person, then the crosshair | Tap the building |
| View (third or first person) | V | Y (Triangle) | VIEW button |
| Map (press again to close) | Tab | None. Start, then the Map button, with a mouse | Pause, then Map |
| Menu (pause) | Esc | Start (Options) toggles it | Pause button |
| Recenter | None | None | Center, only while motion aim is on |

The pad names in the game say "right trigger", "right bumper", "left bumper" and "the bottom button", so one line fits an Xbox pad and a PlayStation pad. How to play lists both sets of names.

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
| The opening | The exact centre ray decides. Left button or E: left hand. Right button or Q: right hand. No picker, no kick |
| Both ropes idle, target found | Fire one rope at the target. A kick on attach. A hop only if `DESKTOP.hop` is above 0 and the body is on the ground |
| Both ropes idle, no target | Wait 0.3 s (`SWING.fireHold`) for a target, then a dry fire along the view and a hint line |
| One rope is out and the other input holds it | Fire the idle hand at the next target. Choose a different building when one qualifies. No kick |
| Both ropes are out | Ignore the press. No dry fire |
| On a wall | Fire at a building away from the wall. The rope swings you off the wall. The view turns toward the swing |
| The input goes up | Let go of the rope that input holds, unless the cup is still flying. Then the cup lands first |

A click that is shorter than the flight of the cup still attaches the rope. The rope lets go on the first frame after the attach. The result is one short tug, never a silent failure.

The left mouse button, when a rope is out: the button that holds a rope is down, so it has nothing to press. If the right button holds the rope, a new left press fires the idle hand. Each input lets go of its own rope only.

### Changes from today, and why

| Item | Before | After | Why |
|---|---|---|---|
| Swing aim | Both buttons fire at the screen centre | Both buttons fire at the auto target | The centre is the hero's chest in third person. A visible target replaces the 32 degree guess |
| Which hand fires | Left button: left hand. Right button: right hand | The hand on the side of the target. Ties alternate. In the opening the old mapping holds | The rope arm of the hero then does not cross the body |
| E and Q | Not used | E swings. Q is the second rope | A trackpad player cannot hold a click and move a finger. E and Q sit next to W A S D |
| Quick press | A press shorter than the cup flight cancels the cup | The cup always lands | A first-time player clicks. A silent miss reads as a broken game |
| Yank key | F | F, kept | Players know F. E is more reachable, but E now swings |
| Space | Jump, wall jump, air yank | Same | Players know it. It keeps the thumb on one key |
| Wheel | Any event reels 0.15 s | Events with Ctrl or Meta do nothing. A flick reels at most 0.3 s in any 0.5 s | A trackpad pinch is Ctrl plus wheel. Scroll momentum is a long stream of events |
| Map key | Tab opens it | Tab. A second press closes it | M stays the mute key from `full-swing-rings-map-sound` (#182). A key player needs a close key |
| Keys with Ctrl, Meta or Alt | Count as the plain key | Do nothing | Ctrl+F, Ctrl+R and Cmd+W must not yank, steer or close |
| Rope trigger setting | Honoured in flat play, but only a headset menu shows it | Honoured in flat play on a computer and a pad. The flat Comfort menu shows "Rope trigger" for a mouse and a pad, and not for a phone | A player who cannot hold a button needs it. E, Q and the triggers follow it. The phone auto releases and ignores it, so its Comfort page has neither this row nor "Release cue" |
| Resume click | The click that resumes from a pause also fires a rope | That click starts no swing. A click that asks for the pointer lock starts no swing | A stray rope, and with a kick a stray jump, is a bug |
| Closing the map | Nothing closes it from the keyboard, and the pointer stays unlocked | Tab and Esc close it. Tab asks for the lock again | Mouse look needs the lock |
| Page keys in a pause | Tab, Space and the arrows are swallowed whenever flat play is on | They keep their page meaning while paused or while a dialog has focus | A key player must reach the menu buttons |
| Pad RB | Reel | Yank | A yank is a quick press that a player repeats. A bumper is reachable with both thumbs on the sticks |
| Pad LB | Reel | Reel | Kept. RB moved to the yank |
| Pad X | Yank | Yank, kept | Players know it |
| Pad Y | Nothing | View | `input.viewDown` had no source |
| Pad Back | Nothing | Nothing | The map lists pins and needs a pointer. A button that opens a dead end is worse than none |
| Pad sticks | Dead zone on each axis | Radial dead zone. A curve on the look stick | A square dead zone makes diagonal drift. A curve gives fine control near the middle |
| Pad triggers | One threshold, 0.5 | Down at 0.5, up below 0.3 | A trigger near 0.5 must not flutter and let go |
| Hop off a roof on a computer | None | `DESKTOP.hop`, start value 0 | A bot lands back on the start roof with a hop. The phone keeps its hop |
| Kick on attach | None | `DESKTOP.attachSpeed`, start value 10 m/s | A bot gains 7 to 24 of 150 random runs. The value is tuned by the bot |
| Release cue | None | The ring pulses and a caption says LET GO when the swing is in its release window | A first-time player has no sign for when to let go. The phone has the auto release |
| Aim assist setting | Sets the cone of `ropes.aim` | Sets the width of the picker fan: 21, 28 or 35 degrees each side | After this change the cone no longer decides a flat swing. The setting must still do something |
| Phone VIEW | None | A VIEW button | The eye form of V |
| Phone Center | Always shown | Shown only while motion aim is on | It does nothing else. Motion aim is on by default on Android, so Center shows there |
| Phone centre ring | A ring at the screen centre | A ring on the target. The centre ring shows only in first person | The centre is the hero in third person |
| Phone buttons | Small, plain | Every touch area at least 48 by 48 CSS px (the top row: boxes 46 px high with a 50 px hit area), in the comic style of the HUD | A thumb needs the room. The look matches the key art. The top row stays 46 px high because `phone-swing.e2e.mjs` reads a taller top button as a second row |
| Catch feedback | Haptics on a headset only | Phone: vibration, and a pop of the ring on every device | iPhone has no `navigator.vibrate`. The pop works everywhere |
| Title labels | PLAY ON PHONE | PLAY WITH TOUCH, and PLAY WITH MOUSE AND KEYBOARD on a touch device with a fine pointer | A tablet is not a phone. A touch laptop needs a choice |

I do not add a stick or a walk control to the phone. Main replaced the floating stick with the one-thumb scheme on purpose. I do not add a "turn your phone" card. Main plays in portrait and in landscape.

## The auto target

`public/vr/js/target.js` is new. It is pure: it takes `city` and plain `{x, y, z}` objects, and it does not import three or touch the DOM. A Node test can import it, as `physics.js` is imported today.

### Inputs

`main.js` fills one context object and reuses it. The picker never keeps it.

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
| `specials` | The list from `ropes.targets()`, filled once per search (clogs, pipes) |
| `ring` | `null`, or the gold ring (`city.goldRing`) while tutorial step 0 runs |
| `avoidBid` | `null`, or the `bid` of the building a rope is attached to |
| `recent` | The `bid` values of the last two buildings that held a rope, with the time each let go. The picker keeps them |
| `exact` | `null`, or the hit of the exact centre ray `{x, y, z, nx, ny, nz, t, collider}` (first person) |
| `aimWidth` | The fan azimuth for the Aim assist setting: 21, 28 or 35 degrees |

`target.js` exports these functions. They are inside agent A's files, so they are not part of the frozen interface.

| Function | Job |
|---|---|
| `createTarget(city, cfg)` | Makes the picker. It holds the held target, the `recent` list and the reused result |
| `update(ctx)` | The marker search. Tier 1, then tier 2 (rate limited), then tier 3 in third person. Re-casts the held target every frame |
| `pick(ctx, opts)` | An immediate search for a press. `opts` holds `avoidBid`, `exact` and `bias` |
| `tap(ctx, ray, opts)` | The phone tap rules |
| `hand(result, ctx)` | 0 or 1 |
| `releaseWindow(body, rope)` | The release cue |
| `kick(body, rope, yaw, speed)` | Adds speed to `body.vel`. Returns true when it did |
| `reset()`, `info()` | Clear the state. Give the data for `G.test.target()` |

A building has the `bid` of its collider. A collider with no `bid`, or a `bid` below 0 (the expressway, the Needle), counts by `city.colliders[id]`'s own `id`. A rope target carries only `{tag, id}`, so the picker looks the `bid` up in `city.colliders[id]`.

### The swing test

A hit holds a swing when all of these are true.

- It is `tier.min` to `tier.max` metres from the head.
- It is more than `tier.above` metres above the chest.
- Its normal has `ny` of 0.7 or less. A roof or a floor never holds a swing.
- Its collider tag is not "antenna". A thin pole is a poor anchor.

Each tier has its own bounds. They are in `TARGET`.

| Tier | Distance | Above the chest | Used for |
|---|---|---|---|
| 1, the fan | 9 to 80 m | more than 4 m | The first choice |
| 2, the wide search | 9 to 88 m | more than 3 m | The old phone assist, ported with its cone. The fallback |
| 3, the exact ray | 9 to 88 m | more than 3 m | The last resort in third person. The first choice in first person and on a tap |

The reach test of `target.test.mjs` checks each tier against its own bounds.

### Tier 1: the fan

1. Compute the preferred elevation: the camera pitch plus 35 degrees, clamped to 35 to 60 degrees. While the body falls faster than 3 m/s, add up to 12 degrees (full at 15 m/s), to a top of 72 degrees.
2. The preferred bearing is the view yaw. With a `bias`, it is the bias yaw. On a wall, if the dot of the view forward and the wall normal is under 0.2, it is the bearing of the wall's outward normal.
3. Cast rays from `head` in a fan. The azimuth runs from minus `aimWidth` to plus `aimWidth` in steps of 7 degrees. The elevation runs from the preferred value minus 25 to plus 25 degrees in steps of 10, kept inside 20 to 75 degrees. At most 66 rays.
4. Each ray is `city.raycast(...)` out to 88 m. Call it through the `city` object every time, so a test can replace it.
5. Reject a hit that fails the tier 1 swing test.
6. Reject a hit whose screen position is outside the view. The camera maps the hit to NDC. The hit must be in front of the camera, and its NDC x must be within plus or minus 0.92. A hit above the top edge is allowed: the marker shows an arrow. On a wall this step is skipped, because the wall's outward side lies behind the chase camera.

The azimuth of the fan alone does not keep a target on a portrait screen. A ray 45 degrees up, seen by a camera that looks down 15.5 degrees, lands wide on the screen. Step 6 limits the screen position directly. It keeps the target on the screen sideways at any pitch and aspect.

### Tier 2: the wide search (the old phone assist)

Tier 2 runs only when tier 1 finds nothing. It ports `assistAim` of `main.js` and the cone of `ropes.aim` in `rope.js`.

- `yaw0` is the velocity heading when the horizontal speed is above 4 m/s, else the view yaw. It never comes from a `bias` taken from a steep ray.
- The directions are the yaw offsets 0, -22, 22, -45, 45, -75, 75 degrees from `yaw0`, each with the pitches 28, 42, 56 and 16 degrees. That is 28 directions, in this order.
- For each direction, cast the exact ray. If it hits within 88 m, that hit is the only candidate of the direction. If it misses, or hits beyond 88 m, cast the 24 rays of the cone (three rings of 8 at 8, 16 and 24 degrees, the middle ring turned half a step, as `rope.js` builds `RAYS`). Ignore a cone hit on an up-facing surface below the head.
- A candidate holds a swing when it passes the tier 2 swing test and lies more than 2 m ahead of the body along `yaw0`.
- The first candidate in order wins. It is not scored. This is the order the old assist used.
- It runs at most 5 times a second for the marker (`TARGET.rateWide`), and at once on a press or a tap.

Tier 2 has no view limit. A tier 2 target can be to the side or behind the camera. The marker shows an arrow then.

### Tier 3: the exact ray

Tier 3 casts the exact ray through the screen centre. It accepts a hit that passes the tier 3 swing test. In third person it runs only when tiers 1 and 2 find nothing. In first person it runs first (see "Exact aim first"). The centre of the third person view is the hero's chest, so the hit is usually the street or a roof, and the test rejects it. A building straight ahead passes.

### Score (tier 1)

Higher is better.

```
s = 1
  - 0.55 * angle          angle from the preferred direction, 0 to 1 over the fan
  - 0.35 * distance       0 inside 25 to 60 m, then grows to 1 over 25 m
  + 0.25 * up             min(1, metres above the chest / 20)
  + 0.15 * ahead * k      cosine to the velocity, k = min(1, speed / 10), when speed is over 3 m/s
  + 0.10 * wall           for a wall (|ny| under 0.35)
  - 0.60 * recent         for a building that held one of the last two ropes, for 8 s
```

These weights are start values. They do not match `score()` in `rope.js`, which uses 0.3 for distance, a threshold of 2 m/s for speed and no wall or variety term. The bots tune them. The variety term is a score penalty, not a ban. When only one building qualifies, the picker still picks it.

### Specials

A clog, a pipe or the gold ring wins over every building when all of these hold.

- A clog or pipe is within 60 m. The gold ring is within 80 m.
- A clog or pipe is within 22 degrees of the camera forward, measured at the camera. Once it is the target, it stays a special until it is more than 28 degrees away. The two angles stop a clog on the edge of the cone from flipping the target on every frame.
- The gold ring is within 35 degrees of the view bearing, measured around the vertical axis, at any elevation. At the start the ring sits above the top edge of the screen. An angle measured at the camera forward would miss it.
- A ray from the head reaches it with no collider in the way. This is the line-of-sight rule of `rope.js`.
- A pipe faces the head within 60 degrees of its outward normal (`PIPE_COS` in `rope.js`).

The gold ring counts only while tutorial step 0 runs. Its target point is the first point a ray from the head to the ring centre hits on the tower face. Among specials, the one nearest the view axis wins. A tap uses a different rule (see "A phone tap"). The 60 m range keeps the `hero.mjs` aim checks for clogs on a lower roof (14 to 60 m) true.

### Hysteresis

The picker keeps the held target. Each search first re-casts a ray from the head to the held point. The target stays valid when the same collider is hit within 2 m of the old distance and the reach rules still hold. A challenger replaces a valid held target only when its score is more than 20 percent higher (`SWING.targetSwitchMargin`) and the held target is at least 0.2 s old. An invalid held target is replaced at once. A special replaces a building at once. The fan search runs at most every 50 ms. The held target costs one ray every frame.

### Hand choice and the second rope

- The hand follows the side of the target. The side is the angle from the view axis to the target, seen from above. A target more than 6 degrees to the left picks the left hand. More than 6 degrees to the right picks the right hand. Otherwise the hand that did not fire last fires.
- With both ropes idle, the right mouse button, Q and LT fire the right hand at the same target.
- If a rope is attached, the picker sets `avoidBid` to its building. The result is the next target. It is also the target of the second rope. When no other building qualifies, a computer or pad second rope may take the same building. A phone has one rope: the result carries `same: true`, and `main.js` keeps the rope and calls `mobile.miss(true)`. A tap never re-fires a rope at its own anchor.
- On a phone the hand is always the right hand (index 1), because `phoneRelease` and `phoneBoost` read rope 1.
- In the opening the hand follows the old mapping and `chooseHand` is not set.

### Who decides

In flat play the picker decides. `ropes.aim` serves only the world reticle.

- `main.js` turns a pick into the same fields `ropes.aim` returns (`x, y, z, nx, ny, nz, tag, id, dist, valid, special`). It passes that result to `shoot` and to `fire`. Nothing re-decides it. The cone and the 16 degree special snap of `ropes.aim` play no part.
- With a pick, the hand rays point at it on every frame. `ropes.aim` then returns the same point and its reticle sits there.
- With no pick, the hand rays point straight up, so the reticle hides, and `ok` is false whatever `ropes.aim` returns. A dry fire flies along the view forward.
- A test aim override (`G.test.aimAt`) wins. With an override on a hand, the old path runs for that hand: `ropes.aim` decides, as today. The `hero.mjs`, `play.mjs`, `fx.mjs`, `comfort.mjs`, `boot.mjs` and `climb.e2e.mjs` checks fire that way, and they stay as they are.
- The picker is off unless `G.state === "play"`. In the opening and in a pause, `flatInput` keeps the exact centre ray and `ropes.aim` decides, as today. A real press at the crack attaches.

### Exact aim first

- First person, mouse or pad: if the exact centre ray hits a point that passes the tier 3 swing test, the rope goes to that point. Otherwise the fan runs. The marker sits on the point the next swing will use, so in this case it sits on the crosshair point.
- Third person: the fan runs first. Tier 3 is the last resort.
- A phone tap: see below.

### A phone tap

1. Cast the tapped ray from the camera. Search the specials around that ray: a clog or pipe within 16 degrees of the ray (`TARGET.special.tap`), with line of sight. The one nearest the ray wins. The tap keeps the tapped ray and fires at that special. This keeps "a tap plunges a clog" true when the clog sits on a lower roof and the ray hits the roof behind it.
2. Else, if the ray hits a point that passes the tier 3 swing test, fire at that exact point.
3. Else, fire at the marked target (the held pick of the picker). A tap that misses goes where the ring is. The bias is not used here.
4. Else, with no marked target, run a search with a `bias`: the bearing of the tapped ray. A ray steeper than 70 degrees from the horizontal (a horizontal part below 0.34) gives no bias, and the search uses the velocity heading or the view yaw. This is why a test that aims straight up still finds a building.
5. Else, a miss: `mobile.miss()`.

With a rope out, steps 2 to 4 skip the building that holds it. If only that building qualifies, the result is `same` and the rope stays.

### How it replaces the near-ground stopgap

`main.js` deletes `AIM_UP`, `AIM_NEAR` and the ground branch of `viewAim`. `viewAim` stays as an exact ray through a pixel and it also keeps the hit in `AIM_HIT`. A tap on the hero or the floor no longer swings at 32 degrees. It reaches step 3 or 4 of "A phone tap". The SWING button has no tapped pixel and goes to the marked target.

### The marker

The marker shows the point the next swing will use. It shows while a rope is attached too, and then it marks the next building (`avoidBid`). It hides when both ropes are out, in the opening, when paused, and when there is no target.

The marker is `m = { x, y, kind, dist, behind, go }`.

- `x` and `y` are NDC (-1 to 1, y up). They may lie outside for a target off the screen.
- `kind` is "swing", "clog", "pipe", "crack" or "ring" (the gold ring).
- `dist` is metres.
- `behind` is true when the target is behind the camera plane. Then `x` is the sign of the target's side (-1 to 1) and `y` is -1.5.
- `go` is true while the release window is open (computer and pad only).

| Device | Marker |
|---|---|
| Keyboard and mouse, game pad | The world reticle of `rope.js` on the surface. A comic lock-on ring (`#lockRing`) at the screen position of the target, 44 px across. `desktop.js` draws it |
| Phone | The world reticle. A comic lock-on ring (`.phone-target`) 56 px across. `mobile.js` draws it. The SWING button dims while there is no target |

Colours: yellow for a building, sludge green with points for a clog or a pipe, gold for the ring and the crack.

Why two rings: the world reticle is 1.5 degrees wide. That is about 12 px at 960 by 540. The lock-on ring does not depend on the screen size.

**The safe window.** The ring and the arrow never sit on the HUD. Each renderer clamps to a safe window and reads it from the DOM.

- Top: the lower edge of the top HUD plus 8 px. That is `.fs-top` on a computer. On a phone it is the larger of `.fs-top` and `.phone-top`.
- Bottom: the upper edge of the spoken line while it shows, on a computer. On a phone it is the smaller of the top of `.phone-bottom` and the top of `.fs-sub`. Minus 8 px.
- Left and right: the safe-area insets plus 8 px, and the box of the climb pad while it shows.
- The renderer reads the boxes at most 10 times a second and on a resize.

When the projected centre of the target lies inside the window, the ring sits on it. Otherwise the ring becomes an arrow on the border of the window. The arrow sits where the line from the screen centre to the target crosses the border, and it points at the target. A target above the screen puts the arrow on the top border at the target's side. A target with `behind` puts it on the bottom border and points down.

**The catch pop.** On attach, yank and pump the ring grows to 1.4 times for 120 ms and returns. Under reduced motion the ring does not scale. It flips to the brighter colour for 120 ms. Every device shows it. It replaces vibration where the browser has none.

**The release cue.** On a computer or a pad, `releaseWindow(body, rope)` in `target.js` is true in one of two cases. The rope must be attached to a building. A clog, a pipe or the crack never gives a cue.

- The swing case: the body is in the air, rising, and moving away from the point under the anchor, and the angle from straight down is 25 to 60 degrees (`TARGET.cue`).
- The drag case: the body is on a roof or a street and has been dragged along it for 0.5 s with the rope attached. The drag time starts again from 0 whenever the body is off the ground, and the drag case holds only on the ground. A body that walks off the roof edge with the rope on gets no cue on its first frame in the air.

While the window is open, `m.go` is true. The ring pulses and a caption reads LET GO. With no ring, the caption sits at the top of the safe window. The flat Comfort menu has "Release cue: On / Off" (`settings.cue`, default on). The phone does not show the cue, because it lets go by itself.

### No target

- No world reticle and no lock-on ring show.
- A mouse or pad swing input waits 0.3 s for a target, then dry-fires: the cup flies 6 m along the view and drops (`SWING.dryFly`). A phone tap dry-fires at once, as today.
- Computer and pad: the line "No building to swing from here. Face the city, or step off the edge." shows at most once every 10 s. A view toward the lake, or a roof with nothing taller near it, also gives no target. So the line does not tell the player to look up.
- Phone: the SWING button dims, and `mobile.miss()` shows its hint line.
- A held button that sees a target within 0.3 s fires at it.

### On a wall

A player on a wall presses the swing input. The picker uses the wall rule of tier 1 step 2 and skips the screen limit. A target usually lies behind the chase camera, which looks into the wall. So the marker shows the `behind` arrow. When a real swing fires from a wall in third person and the target is off the screen or behind the camera, `flatcam.turnTo(yaw, 0.4)` turns the view toward the swing over 0.4 s. A phone tap aims through a visible pixel, so it turns the view only when the exact point is off the screen. The rope then swings the player off the wall (`fire` calls `leaveWall`). The `swing-climbing` requirements stay as they are.

### The view lift

At the default pitch the best anchors are above the screen. `flatcam.js` eases the pitch up toward +8 degrees (0.14 rad, `PHONE.follow.pitch`). It does this when all of these hold.

- A rope is flying or attached, or the body is in the air above 6 m/s.
- The player has not moved the look input for 0.7 s.
- A special is not the target and no special lies within 35 degrees of the camera forward and within range. A clog in view must stay in view. The lift of 23.5 degrees (from -15.5 to +8) would pull a clog out of its 22 degree cone and flip the target. `main.js` sets the flag with `info().specialNear` of the picker.

The lift never lowers the pitch by itself and it does not reset the follow timer. On a phone `phoneFollow` already does this, so the flag is off there. It is off in first person. With the lift, the top edge is 43 degrees above the horizon, and a target at the preferred 35 degrees is on screen.

### Budget

- Tier 1: at most 66 rays a search, at most 20 searches a second.
- Tier 2: at most 700 rays a search (28 directions, each up to 25 rays), at most 5 searches a second without a press. About 0.9 ms in Node per search.
- Tier 3: one ray. The held target: one ray each frame.
- `ropes.targets()` copies its list. The picker calls it once per search, not once per frame. No other allocation in `update`. The result and the context are reused objects.
- `target.test.mjs` counts the calls to `city.raycast`.

## Swing assists for the mouse and the pad

Two assists run only for a rope that a real swing input fired. A rope fired by `G.test.press` gets neither, so the numbers of `hero.mjs`, `play.mjs` and `swing.mjs` stay as they are.

- `desktop.js` marks the frame of a real press with `hands[i].swingDown`. `main.js` then sets a latch for that rope in `shoot`. The latch lasts until the rope detaches or goes idle. The kick reads the latch, not `swingDown`, because the kick runs at the attach event, a few frames later. A held press that waits up to 0.3 s for a target sets the latch when it fires.
- **Latch of the cup.** While the latched rope is flying, `main.js` keeps `holding` true for physics. Without it, `ropeInput` would cancel a cup when a short click ends. After the cup lands, the rope follows the button.
- **Kick:** on attach, `phoneBoost` is generalised. It adds speed across the rope toward the view until the speed along that direction is `DESKTOP.attachSpeed` (start value 10 m/s). It does nothing when the anchor is straight ahead, when the other rope is attached, or on a special or sticky target. A swing off a wall gets the kick, because `fire` has already left the wall. The pure function `kick` in `target.js` holds the maths. The phone keeps `PHONE.attachSpeed` (17 m/s).
- **Hop:** from the ground, if `DESKTOP.hop` is above 0, `shoot` adds `jumpDown` and that many m/s toward the target. The start value is 0. A clog, a pipe or the crack never gets a hop.
- Both assists push a ring event (`hop` and `kick`, as the phone pushes `fling`), so a test can see them.

There is no auto release on a computer. The release cue tells the player when. A headset player has no cue either, and the headset does not change.

### The start roof (decision D1)

Holding only the swing input does not take the hero off the start roof. The rope attaches to the tower at the gold ring, the kick slides the hero across the roof, and friction stops him on it. A hop did not help in the bot study (the first swing lands on the same roof again). Physics does not change. So the first mouse line and the key strip tell the player to hold W with the left mouse button (E also works), and the pad lines tell the player to hold the left stick up with the right trigger. With the stick or W the hero walks to the edge while the rope pulls, and the rope takes him off the roof.

Measured by `flat.mjs` on this build, in game time from the press: with W and the left button the hero is in the air after 3.1 to 3.3 s. With the left stick up and RT it is 3.1 to 3.3 s. With the swing input alone the hero is still on the roof after 6 s. The check bound is 4 s. `flat.mjs` also checks the cue: while the rope drags the hero along the roof the LET GO caption shows, and the first frame in the air gives none.

## Desktop and pad input

`desktop.js` merges the keyboard, the mouse, the pad and the phone panel. It outputs these logical inputs.

- Swing 1 (left button, E, RT) and swing 2 (right button, Q, LT).
- On a press, `desktop.js` asks `D.chooseHand(which)` (set by `main.js` in play only) for a free hand. It holds that hand's trigger until the input goes up. With no free hand it ignores the press. Without a callback, swing 1 uses the left hand and swing 2 the right hand.
- `hands[i].swingDown` is true for the one frame of a real press.
- `inp.viewDown` is true for the one frame of a Y press or a VIEW press.
- `inp.mapDown` from Tab. M stays `inp.muteDown` (#182). `main.js` closes an open map on the next press with `ui.closePause()`.
- `inp.kind` is "mouse", "pad" or "touch". It follows the device in use, as today.

**The lock and the resume click.** A mouse button that is already down when the lock starts, or the click that resumes a pause, starts no swing. `D.lock()` marks the click that asked for the lock, and the `mousedown` that follows is dropped. The next press works. A browser may refuse a lock request after Esc until the next click, so the first click after Esc re-locks and fires nothing. Tab, M and a key that closes a pause call `D.lock()` in the same tick. The key press is the user activation. A pad press may not count as one. Then the next click re-locks.

**The wheel.** An event with `ctrlKey` or `metaKey` does nothing. A stream of events reels at most 0.3 s in any 0.5 s (`DESKTOP.wheel`).

**Page keys.** While `G.state` is "paused", or while the focus is inside a dialog, `desktop.js` does not call `preventDefault` on Tab, Space or the arrows.

**Pad.** Radial dead zone of 0.15 (`PAD.dead`). The look stick output is `((|v| - dead) / (1 - dead)) ^ PAD.curve` times `PAD.lookRate`. The move stick uses the same dead zone and a unit limit. A trigger goes down at 0.5 and up below 0.3. A pad with a mapping other than "standard" is ignored. The pad plays after play starts. The title needs a click, a tap or Enter on the focused button, because a pad press is not a reliable user gesture for the audio.

**Pad rumble.** `D.rumble(strong, ms)` plays a "dual-rumble" effect on the pad in use, when `vibrationActuator` exists. Attach: 0.3 for 30 ms. Yank: 0.4 for 40 ms. Pump: 0.6 for 60 ms. `feedback` calls it only when the input mode is "desktop" and the kind is "pad". It never runs in a headset session. `feedback` calls `D.mobile.buzz` only when `inp.easySwing` is true.

**Rope trigger.** With "Toggle", the swing inputs keep the old toggle logic of `main.js`: a press fires, the next press of that input lets go. E, Q and the triggers follow it. The phone ignores it.

### The first-minute hint strip

`desktop.js` makes `#keyHints`, a comic caption strip at the bottom of the screen. `main.js` calls `D.hints(on)` each frame. It is on while the state is "play", the saved tutorial is not finished (`!save.tutorial`), fewer than 60 s of play time have passed, and the kind is "mouse" or "pad". It never shows on touch. The phone has its own `.phone-hint`.

- Mouse: HOLD W AND LEFT MOUSE (OR E): SWING. LET GO WHEN THE RING SAYS GO. MOUSE: LOOK.
- Pad: HOLD LEFT STICK UP AND RIGHT TRIGGER: SWING. LET GO WHEN THE RING SAYS GO. RIGHT STICK: LOOK.

The first item names W (or the left stick) because the swing input alone does not take the hero off the start roof (see "The start roof"). The strip has three items, so its text fits inside the strip at 640 by 360 and `flat.mjs` checks that the text is not cut off.

The strip is at most 36 px high and sits 10 px above the bottom edge. While it shows, `desktop.js` adds a class to the body that raises `.fs-sub` by 52 px and `.fs-toast` with it. The tail of the speech bubble hangs 27 px below the box of `.fs-sub`, so the check measures the tail too. The strip never covers the score pills. It has no JUMP slot, because a swing needs no jump key. F and the yank come in the tutorial.

## Words

`config.js` holds the lines. `LINES_PAD` has the same keys and counts as `LINES_DESKTOP`, as `ui.mjs` checks. Every table with a desktop key set gets a `wall` group for the first wall line, which moves from `main.js` into the tables.

`LINES_DESKTOP` changes these lines. The others stay. `intro` is unchanged, because the opening keeps the exact aim.

- tutorial 0: "Look at the gold ring. Hold W and the left mouse button."
- tutorial 1: "Swing out. Let go when the ring says GO."
- tutorial 2: "Swing again before you land."
- tutorial 5: "Move the mouse to look around."
- tutorial 7: "That green light is a clog. Look at it and swing."
- clog 0: "That's a clog. Look at it and swing."
- clog 1: "Press F three times to pump."
- wall 0: "On the wall. W and S climb, A and D go along it. Space jumps off." (the same text as today, so `climb.e2e.mjs` still matches `/W and S climb/`)

`LINES_PAD` is new.

- intro 0 to 5: "Shoes off. Plunger up." "Hear that? Something is backing up." "Aim at the crack. Hold the right trigger." "Now press the right bumper to yank." "Clear the space around you." "Give yourself some room."
- tutorial 0: "Look at the gold ring. Hold the left stick up and the right trigger."
- tutorial 1: "Swing out. Let go when the ring says GO."
- tutorial 2: "Swing again before you land."
- tutorial 3: "Hold the left bumper to reel in."
- tutorial 4: "Press the right bumper to yank."
- tutorial 5: "Push the right stick to look around."
- tutorial 6: "Your score is at the top of the screen."
- tutorial 7: "That green light is a clog. Look at it and swing."
- clog 0: "That's a clog. Look at it and swing."
- clog 1: "Press the right bumper three times to pump."
- clog 2 and 3: "Flushed." "The city thanks you. Quietly."
- wall 0: "On the wall. Push the left stick to climb. Press the bottom button to jump off."
- king and splash: the shared lines.

`LINES_PHONE` changes tutorial 0 to "Tap SWING to swing at the gold ring." and adds `wall 0`: "On the wall. Hold the arrows to climb. Tap JUMP to jump off." The phone lines still name no mouse, key, trigger, pinch or grip.

`ui.sayLine` picks the table in this order: hands, then phone (kind "touch" or `easySwing`), then mouse, then pad, then the controller lines. The check of `phone-swing.e2e.mjs` calls `sayLine('tutorial', i, 'mouse')` and expects phone words. That works today because `easySwing` is true on a phone, and the order keeps it.

The cling event in `feedback` says `ui.sayLine("wall", 0)` once. A phone shows no line there, as today.

### How to play

Agent B writes these sections in `index.html`. The sections are: Headset controllers (the old "Controllers", renamed), Hands, Keyboard and mouse, Game pad, Phone and touch. The section for the device in use comes first. `document.body.dataset.device` is "touch", "mouse" or "pad", and agent A sets it in `wireTitle` and when a pad connects or is used. B's CSS orders the sections with it. `boot.mjs` needs the words "pinch" and "Shift" in the dialog, and both stay.

Keyboard and mouse:

- The game picks a building for you. Look toward the buildings you want. A ring marks the target.
- Hold the left mouse button, or <kbd>E</kbd>, to swing. On a roof, hold <kbd>W</kbd> too, so you run off the edge. Let go when the ring says GO.
- Hold the right mouse button, or <kbd>Q</kbd>, to add a second rope.
- Hold <kbd>Shift</kbd> or turn the wheel to reel in.
- Press <kbd>F</kbd> to yank. Three yanks plunge a clog.
- <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys walk and steer in the air. The mouse looks around.
- <kbd>Space</kbd> jumps. In the air it yanks. On a wall it jumps off.
- Fly or walk into a wall to hold on. <kbd>W</kbd> and <kbd>S</kbd> climb. <kbd>A</kbd> and <kbd>D</kbd> go along it. A rope swings you off.
- <kbd>V</kbd> switches between the view behind the hero and the first-person view. In first person the crosshair aims the rope exactly.
- <kbd>Tab</kbd> opens the map. Press it again to close it. <kbd>M</kbd> turns the sound off and on. <kbd>Esc</kbd> pauses.

Game pad (a standard pad, such as Xbox or PlayStation):

- Press PLAY with the mouse, a tap or Enter. The pad works after that.
- Hold the right trigger (RT, R2) to swing. On a roof, push the left stick up too. Hold the left trigger (LT, L2) to add a second rope. Let go when the ring says GO.
- Hold the left bumper (LB, L1) to reel in. Press the right bumper (RB, R1) or X (Square) to yank.
- The left stick walks, steers and climbs. The right stick looks around.
- A (Cross) jumps. On a wall it jumps off.
- Y (Triangle) switches the view. Start (Options) pauses and resumes.

Phone and touch:

- Tap a building to swing from it. Or press SWING, and the game picks a building. A ring marks the target.
- The rope lets go by itself and flings you on. Tap again while you fly.
- A tap on a clog plunges it.
- Drag to look around. VIEW switches the view.
- Hit a wall to hold on. Hold the arrows to climb. Tap JUMP to jump off.
- Motion aim is optional. Center sets it straight again.

The title shows `#deskNote` on a computer (the swing, W, and "a game pad works after you press PLAY"), `#touchNote` on a touch-only device, and `#hybridNote` on a touch device with a fine pointer. B makes the three elements. A shows and hides them in `wireTitle`.

## The phone panel

- The top row has up to four buttons: MOTION, CENTER (only while motion aim is on), VIEW and PAUSE. Motion aim is on from PLAY on Android, and after Allow on iOS. So the usual row on Android has all four.
- Width budget: the row never wraps and never overflows. Every touch area is at least 48 by 48 px. The top-row boxes are 46 px high with a hit area of 50 px (an `::after` box 2 px past each side, inside the 6 px gap), because `phone-swing.e2e.mjs`, which this change does not edit, reads a taller top button as a second row. Every other button box is 48 by 48 px or more. Labels are at most 6 letters (Bangers 18 px), padding 0 8 px, border 3 px, hard shadow 3 px, gap 6 px. At 360 px wide the four buttons fit between the safe areas. B tests the row with the sensors granted and denied, at 360 by 740, 390 by 844 and 844 by 390.
- `.fs-top` starts below the row: top is the safe inset plus 74 px (12 px of padding, the 46 px row, its shadow and a gap).
- In portrait the score pills go in one row (24 px numbers, no small suffix) when the width is under 480 px. The safe window of the marker is at least 55 percent of the height at 390 by 844 and 45 percent at 844 by 390. B tunes the pills until the check passes.
- A spoken line never covers the SWING panel, as today. Its tail hangs 27 px under its box, and the spoken line leaves room for one line of hint over SWING, so each hint line except the wall line fits on one line of a 360 px phone (about 42 letters at most). The wall line can take two lines; the wall layout check measures it at 390 by 844 and 844 by 390. A hint that wraps lifts the panel into the tail. `phone-controls.e2e.mjs` measures the tail against the panel for every hint line at 360 by 740, 390 by 844 and 844 by 390. There is no footnote under the SWING button (the old line "Tap to swing, the rope lets go by itself, drag to look" was removed to give the safe window more height).

## Numbers in `config.js`

Agent A adds these. They are start values. The bots tune them. Units are metres, seconds, degrees (as marked) and radians.

```js
export const TARGET = {
  rate: 0.05, rateWide: 0.2,                                    // s between searches (tier 1, tier 2)
  fan: { az: { low: 21, med: 28, high: 35 }, azStep: 7, elSpan: 25, elStep: 10, elMin: 20, elMax: 75, screenX: 0.92 },
  tier1: { min: 9, max: 80, above: 4 },
  tier2: { min: 9, max: 88, above: 3, yaw: [0, -22, 22, -45, 45, -75, 75], pitch: [28, 42, 56, 16], cone: 24, ahead: 2, minSpeed: 4 }, // the old phone assist
  tier3: { min: 9, max: 88, above: 3 },
  lift: { base: 35, min: 35, max: 60, fall: 12, fallFrom: 3, fallTo: 15, top: 72 },   // preferred elevation, degrees
  weight: { angle: 0.55, distance: 0.35, up: 0.25, ahead: 0.15, wall: 0.1 },
  recent: { penalty: 0.6, count: 2, secs: 8 },
  special: { enter: 22, leave: 28, range: 60, pipeFacing: 60, tap: 16 },
  ring: { bearing: 35, range: 80 },                             // the gold ring in tutorial step 0
  hold: { margin: SWING.targetSwitchMargin, dwell: 0.2 },        // a challenger must score this much higher (0.2) to replace the held target
  bias: { steepHoriz: 0.34 },                                   // a tap ray with a smaller horizontal part gives no bias
  cue: { from: 25, to: 60, drag: 0.5 },                         // degrees past the bottom; s dragged on the ground
  side: 6,                                                      // degrees: below this, the hands alternate
  noneLine: 10,                                                 // s between the "No building" lines
};
export const DESKTOP = { attachSpeed: 10, hop: 0, wheel: { reel: 0.15, cap: 0.3, per: 0.5 } }; // kick (m/s), hop toward the target (m/s, 0 = off)
export const PAD = { dead: 0.15, curve: 1.5, lookRate: Math.PI, trigger: { on: 0.5, off: 0.3 }, rumble: { attach: [0.3, 30], yank: [0.4, 40], pump: [0.6, 60] } };
export const HINT = { seconds: 60 };
export const FLATCAM = { followTau: 1.2, holdLook: 1.5, pitch0: -Math.asin(1.2 / 4.5), arm: 4.5, lift: 0.14 }; // moved out of flatcam.js so the bot and the game share them
// and in PHONE: buzz: { attach: 15, yank: 25, pump: 40 }
```

## The interface between agent A and agent B

Agent A owns the auto target and the desktop and pad input. Agent B owns the phone panel and the page. This section is frozen. A change to it needs both owners to agree. With it fixed, the two agents edit no common file.

### Files

| Agent | Owns (edits) |
|---|---|
| A | `public/vr/js/target.js` (new), `desktop.js`, `main.js`, `config.js`, `flatcam.js`, `ui.js` (the `sayLine` table and its import line, and the `desk` branch of the Comfort page: the "Rope trigger" and "Release cue" rows, for a mouse and a pad and not for a phone), `sw.js`, `qa/vr/flat.mjs` (new), `qa/vr/target.test.mjs` (new), `qa/vr/hero.mjs`, `qa/vr/boot.mjs`, `qa/vr/ui.mjs`, `quest/twa-manifest.json`, `.github/workflows/swing-browser.yml` |
| B | `public/vr/js/mobile.js`, `public/vr/index.html`, `qa/vr/mobile-panel.test.mjs` (new), `qa/vr/phone-controls.e2e.mjs` (new) |
| Nobody (read and run, never edit) | `physics.js`, `city.js`, `rope.js`, `hands.js`, `hero.js`, `game.js`, `qa/vr/lib.mjs`, `qa/vr/climb.e2e.mjs`, `qa/vr/play.mjs`, `qa/vr/pwa.mjs`, `qa/vr/mobile.test.mjs`, `qa/vr/mobile.e2e.mjs`, `qa/vr/phone-swing.e2e.mjs` |

`config.js` is A's alone. B's words are written in "Words" above, so A pastes them. `sw.js`, the version and the CI file are edited once by A at the end (task A9). Each test file keeps its own helpers. If an agent needs a change in a file it does not own, it asks the other owner. It does not edit the file. The three phone tests that B must keep green belong to nobody, so neither agent edits them.

### Calls and fields

| Name | Defined by | Used by | Shape |
|---|---|---|---|
| `mobile.enabled` | B | A | A getter. True on a touch device unless `use(false)` ran. The disabled stub returns false |
| `mobile.use(on)` | B | A, in `wireTitle` | `use(false)` turns the touch scheme off (PLAY WITH MOUSE AND KEYBOARD). `use(true)` turns it back on (PLAY WITH TOUCH). No-op on the stub |
| `mobile.sample(dt)` | B (exists) | A, in `desktop.js` | Existing fields plus `view`: `true` for the one sample after the VIEW button is pressed |
| `mobile.marker(m)` | B | A, in `main.js` | `m` is `null` or `{x, y, kind, dist, behind, go}` as in "The marker". B places the ring, the arrow and the dim, and clamps to the safe window |
| `mobile.pop()` | B | A, in `main.js` | The catch pop of the ring |
| `mobile.buzz(ms)` | B | A, in `main.js` | Vibrate `ms` ms when `navigator.vibrate` exists. At most one buzz every 40 ms. No buzz while the page is hidden |
| `mobile.target(valid, attached)` | B (exists) | A | Only the dead-latch safety stays. The ring and the dim belong to `marker` |
| `mobile.reset`, `start`, `miss`, `released`, `idle`, `rush`, `climbing` | B (exist) | A | Unchanged |
| The disabled stub | B | A | The object `createMobile` returns on a device with no touch point implements every method above as a no-op (`marker`, `pop`, `buzz`, `use`), so `main.js` calls them with no guard |
| New code in `mobile.js` | B | `mobile.test.mjs` | Guards `style` and `classList.contains` the way `rush()` guards `rushEl`. The old stub of `mobile.test.mjs` runs unchanged |
| `D.marker(m)`, `D.pop()`, `D.cue(on)` | A | A, in `main.js` | Same `m`. `D.marker` draws `#lockRing`, and `m.go` pulses it. `D.cue(on)` shows the LET GO caption, also when there is no ring. `main.js` calls `(D.mobile.enabled ? D.mobile : D)` for `marker` and `pop` |
| `D.hints(on)`, `D.rumble(strong, ms)`, `D.chooseHand`, `D.lock()` | A | A | Inside A's files |
| `inp.kind` | A | all | "mouse", "pad" or "touch" |
| `inp.easySwing` | A (exists) | B's tests | `true` on a phone |
| `inp.viewDown` | A | `main.js`, `flatcam` | `true` for one frame. A sets it from pad Y and `mobile.sample().view`. The V key reaches `flatcam` on its own |
| `inp.phoneFire`, `inp.phoneAim` | A (exist) | `main.js` | Unchanged. The SWING button gives `aim` of `null`. A tap gives `{x, y}` |
| `hands[i].swingDown` | A | `main.js` | `true` for the one frame of a real swing press |
| `document.body.dataset.view` | A (exists) | B's CSS | "first" or "third" |
| `document.body.dataset.device` | A | B's CSS | "touch", "mouse" or "pad" |
| `#playFlat[data-label-touch]` | B | A, in `wireTitle` | The label on a touch device. `main.js` falls back to "PLAY WITH TOUCH" when the attribute is missing |
| `#playMouse`, `#touchNote`, `#deskNote`, `#hybridNote` | B (elements, hidden) | A, in `wireTitle` | A sets `hidden` and the click handler. `#playMouse` calls `D.mobile.use(false)` and then `startDesktop()` |
| `#phoneControls.target-ready`, `[data-action=throw].no-target`, `.phone-target`, `[data-action=view]` | B | B's tests | Class and attribute names that the join test reads |
| `G.test.target()` | A | both | `{ on, tier, target, hand, side, ndc, inView, behind, pref, avoid, cue, specialNear, picks, rays }`. `on` is `false` outside flat play and in the opening |
| `G.test.input()` | A | both | Existing snapshot plus `viewDown` and each hand's `swingDown` |

`mobile.marker` is the only way A talks to the phone ring. A computes the NDC. B places the ring, the arrow and the dim. A guards the headset: `feedback` calls `buzz`, `pop` and `rumble` only in flat play.

## Checks

### Scenario to test

| Capability | Scenario | Proven by |
|---|---|---|
| Auto target | Start roof, hold the swing input, ring first. At 16 by 9 and 390 by 844 | `target.test.mjs` (the pick), `flat.mjs` (real mouse events) |
| Auto target | Reach rules of each tier, no roofs, no antenna | `target.test.mjs` (5,000 sampled states, each tier against its own bounds) |
| Auto target | The target stays inside the screen sideways | `target.test.mjs` (390 by 844 and 960 by 540, at the default pitch and at +8 degrees) |
| Auto target | Falling lifts the preferred elevation | `target.test.mjs` (`pref` for a falling and a resting body) |
| Auto target | Clog, pipe and ring priority, line of sight, enter 22 and leave 28 | `target.test.mjs`, and the `hero.mjs` aim checks |
| Auto target | Hysteresis and the variety rule | `target.test.mjs` (sweep of small view moves, a turn across a clog edge, two buildings that tie) |
| Auto target | Hand by side, second rope, `same` on a phone | `flat.mjs`, `target.test.mjs` (`hand`, `avoidBid`, `same`) |
| Auto target | Exact aim first in first person; tier 3 in third person | `flat.mjs` |
| Auto target | A phone tap: the special on the tapped ray, the exact point, the marked target, the bias, a vertical ray | `target.test.mjs` (`tap`), `mobile.e2e.mjs` (tap off centre, tap on the hero), `phone-controls.e2e.mjs` (tap on a clog on a lower roof) |
| Auto target | The picker decides: a pick of none with a real roof in view does not fire | `flat.mjs` (stubbed picker result of none, real city) |
| Auto target | A test aim override still wins | `hero.mjs`, `boot.mjs`, `play.mjs` (unchanged) |
| Auto target | The opening keeps its aim | `flat.mjs` (real left button and fake pad RT at the crack, then F and RB pump it) |
| Auto target | Marker on every device, safe window, arrow, `behind`, pop, cue | `flat.mjs` (ring and reticle on the target), `phone-controls.e2e.mjs` (ring, arrow, dim, safe window) |
| Auto target | No target | `flat.mjs` (replaced `city.raycast`), `mobile.e2e.mjs` (miss stays on the roof) |
| Auto target | On a wall | `flat.mjs` (cling, swing, marker visible, view faces the swing), `climb.e2e.mjs` (phone tap off a wall) |
| Auto target | Superset of the old assist, with its cone | `target.test.mjs` (a reference copy of `assistAim` and the cone, 5,000 states, views that differ from the velocity heading) |
| Auto target | Budget, no `three` import | `target.test.mjs` (ray count, import in Node) |
| Desktop | Swing input, release lets go, E and Q | `flat.mjs` |
| Desktop | A quick click and a quick RT tap still attach | `flat.mjs` (an 80 ms click and an 80 ms tap at 40 m, the rope lets go after the attach) |
| Desktop | Space in each state | `flat.mjs`, `climb.e2e.mjs` (wall) |
| Desktop | F, Shift, wheel, wheel with Ctrl, a wheel flick | `flat.mjs` |
| Desktop | Modifier keys do nothing | `flat.mjs` |
| Desktop | The Rope trigger setting works in flat play | `flat.mjs`, `ui.mjs` (the row shows) |
| Desktop | Resume click and lock click start no swing. Tab then Tab keeps the lock | `flat.mjs` |
| Desktop | Page keys keep their meaning in a pause | `flat.mjs` |
| Desktop | Kick, latch, hop off by default, only for a real input | `flat.mjs` (the `hop` and `kick` events), `target.test.mjs` (`kick`) |
| Desktop | Hint strip, size, place, tail, touch exclusion | `flat.mjs`, `phone-controls.e2e.mjs` (hidden on touch) |
| Desktop | First-time bot: three buildings in 30 s | `target.test.mjs` (gates below), `flat.mjs` (3 start views, real inputs) |
| Desktop | A touch device with a fine pointer chooses its scheme | `flat.mjs` (`maxTouchPoints` 5, both buttons show, the mouse button gives kind "mouse" and a working pad) |
| Gamepad | Every button and axis | `flat.mjs` (fake `navigator.getGamepads`) |
| Gamepad | Dead zone, curve, trigger hysteresis | `flat.mjs` |
| Gamepad | Rumble | `flat.mjs` (spy on `playEffect`) |
| Gamepad | Kind, words, wall line | `flat.mjs`, `ui.mjs` |
| Gamepad | Start toggles pause, B and Back do nothing, a pad with no standard mapping is ignored | `flat.mjs` |
| Phone | SWING button uses the auto target | `mobile.e2e.mjs` |
| Phone | VIEW button | `mobile-panel.test.mjs` (`view` edge), `phone-controls.e2e.mjs` (join) |
| Phone | Vibration and the pop | `mobile-panel.test.mjs`, `phone-controls.e2e.mjs` (spy on `navigator.vibrate`) |
| Phone | Touch size, top row budget with sensors on and off, no overlap, no sideways scroll | `phone-controls.e2e.mjs`, `phone-swing.e2e.mjs` |
| Phone | Words, How to play order, title labels | `phone-controls.e2e.mjs`, `ui.mjs` |
| Phone | No turn card, both orientations play | `phone-controls.e2e.mjs` |
| Phone | First-time bot: taps only, three buildings in 30 s | `phone-controls.e2e.mjs` |
| Camera | V, Y and VIEW toggle once | `hero.mjs` (exists), `flat.mjs`, `phone-controls.e2e.mjs` |
| Camera | The view lifts, never lowers, and stops for a clog | `flat.mjs` |
| Camera | The view turns toward a swing from a wall | `flat.mjs` |
| Headset | No lock ring, no strip, no pad rumble, no change | `hero.mjs` VR run (A adds two assertions: `G.test.target().on` is false, and no `#lockRing` or `#keyHints` is visible), `xr.mjs`, `swing.mjs` |

### The first-time bots

Both bots use only the swing input and W. They never reel, yank, jump, look or use the second rope. The conditions are in "Evidence", with two changes: the picker is the real `target.js`, and the camera constants come from `FLATCAM` in `config.js`.

- Bot 1 follows the cue. It lets go `0.2` to `0.4` s after `releaseWindow` opens.
- Bot 2 ignores the cue. It lets go 30 degrees (plus or minus 25 degrees at random) past the bottom of the arc, after the same delay.
- Both let go after 4.5 s, and after 0.5 s of dragging on the ground (the drag time starts again from 0 whenever the body leaves the ground, as in the game).
- Both press again after a delay of 0.2 to 0.4 s.
- A cling on a wall ends with the next press.
- Pass: three different buildings (by `bid`, else by collider id) in 30 s of game time, with no respawn and no death.
- Gates in `target.test.mjs`, for each bot: at the start roof at -10, 0 and +10 degrees (3 headings, 6 seeds): at least 17 of 18 pass. On the 150 random starts (25 safe roofs, 6 headings, seed 7): at least 120 pass. The median time of the passing runs is 15 s or less. The prototype passed 18 of 18, 133 of 150 and a median of 8.1 s, for bot 2.
- Gates in `flat.mjs`: the start roof at -10, 0 and +10 degrees, real mouse and key events, all three pass.
- If a bot misses its gate, tune in this order: the weights in `TARGET`, the variety penalty, `DESKTOP.attachSpeed` (0 to 12), `DESKTOP.hop` (0 to 5). Never change `physics.js`. If the gate still fails, A stops and reports the measured rates to the person (open question 3 in `proposal.md`). A does not lower a gate alone.

The phone bot uses only taps (the SWING button and taps on the city), 30 s from the start roof facing the gold ring at -10, 0 and +10 degrees, in `phone-controls.e2e.mjs`. All three must pass. If B measures less, B reports the rate and the cause before the gate changes. The old 12 s run in `phone-swing.e2e.mjs` stays (mean 15 m/s, 140 m).

### Assertions of existing tests that change

| Test | Change | Why |
|---|---|---|
| `boot.mjs` | The pad kind check presses button 1 (B), not button 3 (Y) | Y now toggles the view. B has no action. The kind check still needs a pressed button |
| `ui.mjs` | The check that "mouse and pad read the desktop lines" becomes "mouse reads the desktop lines and pad reads `LINES_PAD`". The `LINES_PHONE` key check also covers `LINES_PAD` and the `wall` group. New checks: the flat Comfort page shows "Rope trigger" and "Release cue" | A pad player now has its own words. The two rows are new |
| `hero.mjs` | The three aim checks keep their assertions. Their comments say "auto target", not "ground rule". If the view lift moves a pitch reading during a swing, that check sets the pitch itself. Two VR assertions are added | The stopgap is gone. The checks guard the same behaviour |
| `mobile.test.mjs` | None. It stays unmodified and must pass | `mobile.js` guards `style` and `classList.contains` |
| `mobile.e2e.mjs`, `phone-swing.e2e.mjs`, `climb.e2e.mjs` | None. Every threshold stays: 15 m/s mean, 140 m in 12 s, the tap within 8 m of the tapped building, the anchor 5 m over the roof, the first wall line `/W and S climb/` | These are contracts. If the picker lowers a number, tune `TARGET`, not the threshold. On main today `phone-swing.e2e.mjs` reads a mean of 18.9 m/s, 190 m and 3 flings, so the margin is 26 percent on speed and 36 percent on distance |
| `pwa.mjs` | None | `target.js` joins the `sw.js` list and the version moves, so the test passes as it is |

The phone contract tests that use `G.test.aimAt` (the sky tap, the clog tap, the invalid retarget, the miss) keep working because a test override wins and the old path runs for that hand.

`play.mjs`, `swing.mjs`, `xr.mjs` and `perf.mjs` use `G.test.press` and `aimAt`, which skip the assists. They do not change.

### Visual checks

- DOM and world markers: `getBoundingClientRect` of the ring and the projection of `G.test.target()` agree within 3 px. The world reticle comes from `G.ropes.info().reticles`.
- Safe window: sample targets at NDC y from 0.3 to 1.5 and x from -1.5 to 1.5, with the HUD showing a spoken line, at 390 by 844 and 844 by 390 on a phone, and at 960 by 540 on a computer. Neither the ring nor the arrow overlaps a score pill, a top button, the spoken line, the SWING panel or the climb pad.
- Layout: no overlap between the hint strip, the subtitle with its tail, the score pills, the top buttons and the SWING panel. Sizes: 640 by 360, 960 by 540, 1280 by 720, 844 by 390, 390 by 844 and 360 by 740. The page does not scroll sideways. The tail is measured with `elementFromPoint` at the tail tip.
- Touch size: the touch area of every visible phone button (found with `elementFromPoint`) is at least 48 by 48 CSS px. The top-row boxes are 46 px high, and a touch 1 px outside any side of such a box still hits the button. Every other button box is 48 by 48 or more.
- Screenshots at the sizes go to `SHOTS` and are read by the person who does the change: the ring on the target, the edge arrow at the start roof, the arrow behind the camera on a wall, the strip, the green clog ring, the LET GO caption, the dimmed SWING button.

## Risks

- The start values in `TARGET` and `DESKTOP` may need tuning. The bots are the gate, and the order of tuning is fixed above. The throwaway study shows the start roof at the default heading is the hard case.
- Tier 2 costs up to 700 rays a search. On a phone the cost per ray may be 5 times the Node figure. `perf.mjs` does not measure it. Check on a phone.
- `desktop.js` makes DOM. It must not write `localStorage`. `main.js` owns the save, including `settings.cue`.
- The lock-on ring costs one DOM transform a frame. Check on a phone.
- The view lift changes where the camera sits during a swing. `hero.mjs` has pitch checks to watch.
- A pad has an unknown button layout. Only `mapping === "standard"` is read.
- The two older changes are still active. See `proposal.md` for the order of archive.

## Not in this change

- A phone or tablet with a Bluetooth pad. The pad does nothing on a touch-only device.
- A walk stick on the phone.
- Pad control of the pause menu, the title and the map. The pad toggles the pause with Start. The menu needs a mouse, a key or a tap.
- Mouse sensitivity, invert Y and key remapping.
- Tablet layouts beyond the phone sizes.

## Checks that need real hardware

Nobody has run these. The cloud session has no device.

- A real phone, Android Chrome and iPhone Safari: thumb reach to SWING, VIEW and the arrows in both orientations. Vibration on Android. The catch pop on iPhone, which has no vibration. The ring and the arrow over a moving city. Motion aim, with all four top buttons.
- A touch laptop: the two title buttons, and the pad after PLAY WITH MOUSE AND KEYBOARD.
- A real mouse with pointer lock, a trackpad (E and Q, pinch and scroll momentum), and a Windows or Mac keyboard for Ctrl and Cmd keys.
- A real pad: Xbox and PlayStation layouts, the trigger values, drift, rumble.
- Speakers and headphones: unchanged, but listen once.
- A Quest: unchanged play, no ring, no strip.

## Joining `full-swing-rings-map-sound` (#182)

Main took #182 while this change was in design. It sets three things this change keeps:
- M is the mute key (`inp.muteDown`, by the letter on the key, so AZERTY works). The map stays on Tab only.
- VERSION is 1.6.0 on main, so this change raises it to 1.7.0 (Quest APK code 6) when it lands. If main moves the version again first, take the next minor number at merge time.
- CI also runs `qa/vr/rings-map.e2e.mjs` and `qa/vr/sound.e2e.mjs`. Both are contracts for this change, like the phone tests.
#182 also changed when a swing that brushes a wall grabs it (`brushSpeed`, `headOn` in config.js). The bot numbers in "Evidence" came from the physics before that change, so agent A measures the gates again on the current physics before tuning.

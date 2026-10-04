# Flat-screen controls: an auto target and one swing input on every device

In Full Swing (`public/vr/`) plays on a Meta Quest and on a flat screen. The player asked: "the controls on the game need to be improved, it should play nicely on mobile and desktop". Headset controls stay as they are. This change covers a mouse and keyboard, a game pad and a phone.

## Why

I read the code on main and ran a throwaway bot against the real flat physics. These are the findings.

- **The aim is a stopgap.** Flat play is third person, but both mouse buttons still fire at the screen centre, which is the hero's chest. `viewAim` in `main.js` hides this with a rule: a roof or a floor in view becomes a ray 32 degrees up. The design notes of `swing-hero-comic` say an auto target must replace that rule.
- **A new desktop player does not get far.** A bot uses only the swing input and W, with the real physics (rope plus wall climbing), a camera model and human-like release timing. At the start roof, at the default heading, it reaches three buildings in 30 s in 1 of 18 runs with the first design settings (a hop and a kick, no variety rule). The cause is a swing back and forth on one tower, not too little speed. A variety rule fixes most of it. A prototype with both passed 18 of 18 at the start roof and 133 of 150 on random starts.
- **The target is not on screen.** The chase camera looks down 15.5 degrees. The top of the screen is 19.5 degrees above the horizon. Good anchors are 25 to 45 degrees up.
- **A quick click fails.** `physics.js` lets go of a flying rope when the button goes up. A click is shorter than the 0.3 s a cup needs to land.
- **The pad is half done.** Nothing sets `input.viewDown`, so Y does nothing. A trigger near its threshold can let go of the rope. A pad player reads "Hold Shift to reel in".
- **The phone shows no target.** The centre ring sits on the hero. There is no view button and no vibration. The first tutorial line asks the player to tap a gold ring that is above the screen. The buttons are small and plain.
- **A touch laptop plays the phone scheme.** Any touch point turns the mouse buttons, the pointer lock and the pad off.
- **Small faults on the computer.** Ctrl+F counts as F. A pinch reels the rope. The click that resumes a pause also fires a rope. A trackpad player cannot hold a click and move a finger.

## What changes

- **An auto target** (`js/target.js`, new). It picks one building point for each swing from a fan of rays in front of the view. A second tier ports the old phone assist with its cone. It gives clogs, pipes and the gold ring priority, keeps its pick steady and prefers a new building to the last two. It replaces the near-ground rule and the phone's `assistAim`, and it decides every flat swing. Precise aim stays: first person (V) and a phone tap point at an exact building.
- **A marker** on every device: the world reticle plus a lock-on ring, an arrow on the edge of a safe window when the target is off screen or behind the camera, and a short pop on every catch.
- **One swing input** per device. The left mouse button or E, the right trigger on a pad, and SWING or a tap on a phone. The hand follows the side of the target. The right mouse button, Q and the left trigger add a second rope. A short press still lands the cup.
- **A release cue** for the mouse and the pad: the ring pulses and a caption says LET GO when the swing is in its release window.
- **An attach kick** of 10 m/s (a start value) for ropes that a real mouse or pad input fired. A hop off the roof is a tuning value that starts at 0.
- **A complete pad mapping**: Y for the view, RB for the yank, a radial dead zone, a look curve, trigger hysteresis, Start to toggle the pause, and rumble.
- **Keyboard fixes**: Tab opens and closes the map (M stays the mute key from #182), Ctrl, Meta and Alt keys do nothing, a pinch or a flick does not reel, the resume click starts no swing, page keys work in a pause, and the Rope trigger setting shows in the flat Comfort menu.
- **A view lift** in the chase camera while the player swings, so the next buildings are on screen. It stops for a clog. A swing from a wall turns the view toward the swing.
- **A phone panel**: a VIEW button, a lock-on ring, a dimmed SWING button when there is no target, vibration, bigger comic buttons, a top row that fits four buttons, and a Center button that shows only with motion aim.
- **A title choice** on a touch device with a fine pointer: PLAY WITH TOUCH or PLAY WITH MOUSE AND KEYBOARD.
- **Words and help**: new tutorial and clog lines for a mouse, and lines for a pad (`LINES_PAD`). A wall line in every table. A new first phone line. A first-minute hint strip for a computer. How to play for the keyboard, the pad and the phone, with the device in use first. New title labels and notes.
- **The version** goes to 1.7.0 (Quest APK code 6). Main is at 1.6.0 after #182.

## Out of scope

- The headset (VR and AR): controls, comfort and physics.
- `physics.js`, `city.js`, `rope.js` and the rest pose of the chase camera.
- A walk stick on the phone, and a "turn your phone" card. Main plays in portrait and in landscape, and its one-thumb scheme replaced the stick on purpose.
- Pad control of the title, the pause menu and the map. The pad toggles the pause with Start.
- A phone or tablet with a Bluetooth pad.
- Mouse sensitivity, invert Y and key remapping.

## Player-facing change

On a computer, the player looks toward the buildings and holds W with the left mouse button (W walks the hero off the start roof while the rope pulls). A yellow ring shows where the rope goes. When the ring says GO, the player lets go. A pad does the same with the left stick up and the right trigger. In first person, the crosshair aims the rope exactly. On a phone, the player taps a building or presses SWING, and a ring shows the target. A VIEW button switches the camera. The controls are listed in one table in `design.md`.

## Capabilities

- `swing-auto-target` (new): the picker, its tiers, the specials, the marker, the cue and the no-target case.
- `swing-desktop-controls` (new): the mouse and keyboard table, the assists, the hint strip, the title choice and the first-time bot.
- `swing-gamepad-controls` (new): the standard pad mapping.
- `swing-phone-controls` (new): the phone panel, its ring, VIEW, vibration, layout, words and the first-time bot.
- `swing-phone-aim` (modified): the tap, the ground rule and the tutorial words now use the auto target and the pad lines.
- `swing-flat-camera` (modified, and two requirements added): the view toggle has a pad form and a phone form, the title label changes, the view lifts while the player swings, and the view turns toward a swing from a wall.
- `swing-climbing` (modified): the first wall line comes in a form for each device.

## Order of work

Two agents work at the same time and edit no common file. The split and the interface are in `design.md`. Agent A does the picker, the desktop and pad input and the wiring in `main.js`. Agent B does the phone panel and the page. The tasks are in `tasks.md`.

The specs `swing-hero-comic` and `full-swing-phone-and-climbing` are still active changes, and `openspec/specs/` has no `swing-*` capability. The `MODIFIED` entries of this change need those requirements in `openspec/specs/` first. Both older changes have open boxes that need a device (see their `tasks.md`). Task J6 moves those boxes to a "Deferred" list, with the reason, and archives both changes. Then this change archives. If the owner prefers to leave the old changes open, task J6 turns the `MODIFIED` entries into `ADDED` entries with new names and lists the old requirements for removal.

## Decisions on the open questions

The lead took the designer's recommendations. Each one is easy to change later.
1. **The attach kick** is on for everyone on a computer and a pad, at 10 m/s to start (A3 tunes it from 0 to 12). The phone already has a kick.
2. **Archiving.** `swing-hero-comic` and `full-swing-phone-and-climbing` stay open until their device checks run. This change stays open too (task J6).
3. **If the first-time bot misses its gate,** agent A stops and reports the measured rates. The lead then decides between a lower gate and the phone's auto release for the first minute.
4. **The kick of a swing off a wall** (task K1) stays along the view for now. A kick toward the anchor failed the first-time bot gates. A person checks the wall swing on a computer and a phone before it changes.

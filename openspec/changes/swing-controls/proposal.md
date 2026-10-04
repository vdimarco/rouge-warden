# Flat-screen controls: an auto target and one swing input on every device

In Full Swing (`public/vr/`) plays on a Meta Quest and on a flat screen. The player asked: "the controls on the game need to be improved, it should play nicely on mobile and desktop". Headset controls stay as they are. This change covers a mouse and keyboard, a game pad and a phone.

## Why

I read the code on main and ran a throwaway bot against the physics. These are the findings.

- **The aim is a stopgap.** Flat play is third person, but both mouse buttons still fire at the screen centre, which is the hero's chest. `viewAim` in `main.js` hides this with a rule: a roof or a floor in view becomes a ray 32 degrees up. The design notes of `swing-hero-comic` say an auto target must replace that rule.
- **A new desktop player does not get far.** A bot uses only the swing input and W. On the plain physics it reaches three buildings in 30 s in 0 of 7 runs. With a speed kick of 10 m/s on attach it does so in 6 of 7 runs. The old plan for the controls asked for three buildings in 30 s.
- **The target is not on screen.** The chase camera looks down 15.5 degrees. The top of the screen is 19.5 degrees above the horizon. Good anchors are 25 to 45 degrees up.
- **The pad is half done.** Nothing sets `input.viewDown`, so Y does nothing. There is no map button. A trigger near its threshold can let go of the rope. A pad player reads "Hold Shift to reel in".
- **The phone shows no target.** The centre ring sits on the hero. There is no view button and no vibration. The first tutorial line asks the player to tap a gold ring that is above the screen. The buttons are small and plain.
- **Small faults on the computer.** Ctrl+F counts as F. A trackpad player cannot hold a click and move a finger. A headset save with "Rope trigger: Toggle" changes flat play.

## What changes

- **An auto target** (`js/target.js`, new). It picks one building point for each swing from a fan of rays in front of the view. It gives clogs, pipes and the gold ring priority and keeps its pick steady. It replaces the near-ground rule and the phone's `assistAim`. A building the player points at still gets the rope.
- **A marker** on every device: the world reticle plus a lock-on ring, and an arrow on the screen edge when the target is off screen.
- **One swing input** per device. The left mouse button or E, RT on a pad, and SWING or a tap on a phone. The hand follows the side of the target. The right mouse button, Q and LT add a second rope.
- **A swing assist** for the mouse and the pad: a hop off the roof and a 10 m/s kick on attach, for ropes that a real input fired.
- **A complete pad mapping**: Y for the view, Back for the map, RB for the yank, a radial dead zone, a look curve, trigger hysteresis and rumble.
- **Keyboard fixes**: M opens the map, Tab and M close it, Ctrl, Meta and Alt keys do nothing, flat play ignores the headset trigger option.
- **A view lift** in the chase camera while the player swings, so the next buildings are on screen.
- **A phone panel**: a VIEW button, a lock-on ring, a dimmed SWING button when there is no target, vibration, bigger comic buttons, and a Center button that shows only with motion aim.
- **Words and help**: new tutorial and clog lines for a mouse, and lines for a pad (`LINES_PAD`). A new first phone line. A first-minute hint strip for a computer. How to play for the keyboard, the pad and the phone. New title labels and notes.
- **The version** goes to 1.6.0 (Quest APK code 5).

## Out of scope

- The headset (VR and AR): controls, comfort and physics.
- `physics.js`, `city.js` and the rest pose of the chase camera.
- A walk stick on the phone, and a "turn your phone" card. Main plays in portrait and in landscape, and its one-thumb scheme replaced the stick on purpose.
- Pad control of the pause menu and the map pins. Start closes both.
- Mouse sensitivity, invert Y and key remapping.
- Touch-screen laptops. See the open question below.

## Player-facing change

On a computer, the player looks toward the buildings and holds the left mouse button. A yellow ring shows where the rope goes. The hero hops off the roof and swings. A pad does the same with RT. On a phone, the player taps a building or presses SWING, and a ring shows the target. A VIEW button switches the camera. The controls are listed in one table in `design.md`.

## Capabilities

- `swing-auto-target` (new): the picker, the specials, the marker and the no-target case.
- `swing-desktop-controls` (new): the mouse and keyboard table, the assists, the hint strip and the first-time bot.
- `swing-gamepad-controls` (new): the standard pad mapping.
- `swing-phone-controls` (new): the phone panel, its ring, VIEW, vibration, layout, words and the first-time bot.
- `swing-phone-aim` (modified): the tap and the ground rule now use the auto target.
- `swing-flat-camera` (modified, and one requirement added): the view toggle has a pad form and a phone form, and the view lifts while the player swings.

## Order of work

Two agents work at the same time and edit no common file. The split and the interface are in `design.md`. Agent A does the picker, the desktop and pad input and the wiring in `main.js`. Agent B does the phone panel and the page. The tasks are in `tasks.md`.

The specs `swing-hero-comic` and `full-swing-phone-and-climbing` are still active changes. Archive them first. This change then modifies `swing-phone-aim` and `swing-flat-camera` in `openspec/specs/`.

## Open questions

1. **The attach kick.** Without it, the desktop bot never reaches three buildings in 30 s. This change turns it on for everyone on a computer and a pad, at 10 m/s. Do you want it on for everyone, or as a setting that you can turn off? I recommend on for everyone. It makes swings faster than in a headset.
2. **Touch-screen laptops.** `mobile.js` treats any device with a touch point as a phone, so a touch laptop ignores the mouse buttons. A fix needs a choice on the title (touch or mouse) and a live switch in `mobile.js`. The old phone tests fake only `maxTouchPoints`, so a stricter test also changes them. Do you want this fix in this change, or later?

# Swing: clear touch gestures on a phone

After playing on a phone, the user reported: "Controls on touch on mobile are very, very confusing. Do I touch and hold? Do I tap? What is it? Please make it a lot more fluid."

## Why

- **A touch did nothing until the finger lifted.** A plunger flew only on the lift. While a finger stayed down, the game gave no sign that it had felt the touch.
- **A hold did nothing.** A player who held a finger down, as with a mouse button, saw no throw and got no rope. A rope also let go by itself at the bottom of the arc, whatever the player did, so there was no way to keep it.
- **A small slide cancelled the throw.** A finger that moved 12 px became a look drag and threw nothing, with no sign of why.
- **Nothing showed the gestures.** The only help was a one-line hint at the bottom of the screen and the How to play page.

## What changes

- **Tap, hold and drag all work, and each one answers at once** (`mobile.js`).
  - A **tap** throws the plunger, and the rope lets go by itself past the bottom of the arc, as before.
  - A **hold** throws the plunger 0.12 s after the finger goes down, while it is still down. The rope then stays while the finger stays: no let-go at the bottom of the arc, no hand-over to the other plunger, and no let-go while hanging still. Lift the finger after 0.35 s or more and the rope lets go with the same fling as the arc's let-go. A holding finger can drag to look.
  - A **drag** that starts within 0.12 s looks around and never throws.
- **A ring under each finger** shows what the finger does: grey while it waits, yellow with L or R once its plunger flies, and blue with LOOK while it looks.
- **A gesture card** (TAP, HOLD, DRAG, STICK) shows when phone play first starts. It goes away at the first touch on the city, or after 10 s. The save remembers it (`seen.phoneCoach`), so it shows once.
- **The words** in the hint line, the title's touch note and How to play explain tap and hold.
- Version 1.20.0 (Quest APK code 27).

## Out of scope

- The move stick, the climb pad, the driving pad and the action buttons keep their places and their behaviour.
- The mouse, the pad and the headset do not change.

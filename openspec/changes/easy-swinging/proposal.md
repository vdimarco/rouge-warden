# Easy swinging

A held swing in the chase view no longer waits for the player to pick a point. The web takes an anchor ahead of the hero and above them, on a building when one is close and in the sky when none is, so a swing works over open ground.

## Why

- The old web only landed when the aim found a building. Over a lake or an empty lot the cup dry-fired and the swing did nothing.
- Choosing the point, with the crosshair or by holding still and hoping the marker was right, made a chain of swings a puzzle instead of a motion.

## What changes

- A held swing in the chase view (mouse, keys, pad, or a finger held on the right half of a phone) attaches by itself. The player does not pick the point.
- The anchor is chosen in order: a tutorial or mission target within 16 body-heights, else the nearest building within 6 body-heights of the point 12 ahead and 14 up, else sky. The gold-ring tower is never sky while it is in range. A held building rope stays until the button comes up. The left button fires the left rope and the right button the right rope.
- The rope is the distance to that anchor, and never longer than 16 body-heights. Gravity makes the arc. Holding forward adds 15% speed once, at the bottom. Letting go keeps the speed and adds 10% up and forward. The next web waits 150 ms.
- If the arc would put the feet under 1.5 body-heights, the rope shortens so it does not.
- The web is an ink line from the hand toward the anchor, 2 px, sagging a little at the start and pulling straight as it goes taut, fading out over 150 ms. At the top of the swing, three or four thin paper lines trail the body.
- `window.__test.swing` reports whether a web is out, the anchor, the rope length and the speed.
- In a headset the view stays the headset pose. A stick snap or smooth turn still yaws the rig when the player asks, including during a swing. A swing starts from the trigger of that hand. The other hand's trigger and the grip do not start it.
- Version 1.24.2 (Quest APK code 33). The anchor distances, the rope cap, the speed adds, and the reswing wait are unchanged.

## Out of scope

- Wall running.
- A phone tap still aims at the building under the finger, and lets go by itself, as before.
- First person still uses the crosshair. A headset still uses the controller ray. `G.test.aimAt` still shoots the point a test names.
- No new buttons.

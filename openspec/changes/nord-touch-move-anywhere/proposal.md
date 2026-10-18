# Move and drive from anywhere on the phone

## Why
The owner asked to tap and drag anywhere on the screen to move. Movement used a fixed stick in the bottom-left corner, and a drag anywhere else turned the camera.

## Input preference (owner's choice)
- On foot, the first finger anywhere on the game moves the character.
- A second finger that drags turns the camera.
- The owner picked this over a split screen (left moves, right looks) and over move-only with no drag look.

## What changes
- On foot, a finger that lands on the game image, with no move finger down, places the move stick under that thumb. Direction is measured from where the finger landed.
- Any further finger on the game image turns the camera. Dragging a held action button still turns the camera, as before.
- A finger that starts on the drawn move stick works as before.
- A quick double tap anywhere latches sprint for the next hold, as the double tap on Move did.
- Help text: "Drag with a second finger to look."

## Follow-up request (driving and Menu)
The owner then asked for:
- ☰ Menu to move from the top-left corner into the empty bottom-right spot of the action buttons.
- The wheel to work as a stick: push up to accelerate, up-left to accelerate while turning left, down to brake and reverse, left and right to steer.
- Driving from anywhere, the same as walking: tap anywhere, then drag up, down, left or right.

### What changes
- `#touch-menu` moves into `.touch-primary` as its fourth round button, labeled Menu / Options. The top-left `.touch-navigation` group is removed.
- The wheel reads x and y from its center or from the landing point: x past 0.18 steers, y past 0.28 sends W (up) or S (down). Brake priority stays: S cancels W.
- In a car, the first finger on the game image places the wheel under it; a second finger looks. This replaces one-finger look in a car.
- The wheel art shifts up or down a little with the push, and Gas lights while the wheel accelerates.

# The mouse works the rod from anywhere, and the wheel reels

## Why

The player says that on a computer the mouse must press on the drawn rod in a fight, and that nothing says to scroll the mouse wheel to reel. The cast already takes a press anywhere. In a fight, a press off the rod only watched for a fast flick up. The fight words for the mouse fell back to the touch words ("Turn the crank to reel."), and the crank's hint said TURN EITHER WAY.

## What changes

- In a fight on a computer, a mouse press anywhere on the lake takes the rod, as a press on the drawn rod does. Up and down move the rod. A sideways move steers from where the press began. A press on the crank, the drag buttons, the HUD or another control keeps its own job. Touch and motion play do not change.
- The mouse words name the wheel: "Scroll the mouse wheel to reel.", "Drag up. Scroll as it comes down.", "Stop scrolling.", and "Scroll slowly." (and the other paces).
- The action card shows a mouse with its wheel rolling down for the reel move. It is still with reduced motion or Calm effects.
- On a computer the crank's hint says SCROLL / TO REEL.
- How to play says to scroll the mouse wheel to reel, and to drag anywhere to work the rod.

## Impact

- `public/fish/js/reel.js` (`RodPad` anywhere, the crank's `wheelHint`), `guide.js` (the mouse words), `main.js`, `index.html`.
- Spec: fish-fight (new: "Mouse play on a computer").
- `qa/fish/mouse.e2e.mjs` checks the press anywhere and the wheel words.
- The phone apps do not change.

# Big fish look big; small cues in the corner

## Why

The player says the fish look too small, even the heavy ones. A fish is drawn at its true length, so a 2 kg bass 11 m out is a few pixels long, and a heavy fish looks almost the same as a light one.

The player also says the indicators take too much room. The prompt is a wide card at the top middle, with a second line under it, and the rod cue over the reel often shows the same words again. The gauge is about half the width of a phone.

## What changes

- Out in the water, each fish is drawn bigger than life, and more so the heavier it is: 1.6x for a small fish, 2x at 1 kg, 2.7x at 5 kg, up to 3.2x. Near the rod it shrinks back to its true length, so the hand, the catch photo and the measuring board still show the true size. Junk keeps its size.
- The prompt becomes a small action card in the top corner opposite the gauge. Its picture moves as the phone, the rod or the crank must move. The words beside the picture are smaller. The how-to line under the card is smaller, and it hides when the rod cue over the reel says the same.
- The gauge is about 20% smaller (190 x 120 px at most; 220 x 140 px with Larger text). Its numbers move right of the state word, so nothing overlaps.
- Toasts in the reel move to the old prompt place: under the gauge in the tall reel, and at the top middle in the wide reel.

## Impact

- `public/fish/js/species.js` (`showScale`), `world.js`, `fish.js`, `main.js`, `reel.js`, `index.html`, `style.css`.
- Specs: fish-fight (new: "Heavy fish look heavy"), fish-feedback (new: "Action card in the corner"; changed: "Messages clear of the lure"), fish-menus-access (changed: "Layouts that fit").
- The store screenshots and videos show the old layout until they are made again.

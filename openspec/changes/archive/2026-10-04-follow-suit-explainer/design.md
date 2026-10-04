# Design

## Built from the game

The explainer is a React screen inside the game. It draws the same CSS cards (`CardFace`), the same Value and Mult boxes and the same gold ring. It uses no video, image or animation library, so the game keeps its rule of no image files. A video would also go stale when the rules or the look change.

## Storyboard

| Scene | Title | What moves | Length |
| --- | --- | --- | --- |
| 1 | Build a chain | Three cards leave the hand, one at a time, after a tap mark, and make a row | 6.5 s |
| 2 | Follow by suit or by rank | After 7♠: K♠ glows "Same suit" and joins, Q♦ shakes "No match", K♥ glows "Same rank" and joins | 7.5 s |
| 3 | 8s are wild | 8♣ joins after K♥, a suit picker names diamonds, then 4♦ joins | 7 s |
| 4 | Value and Mult | 6♣ 6♦ 7♦ 7♠ 8♠ (clubs) A♣: card points rise over each card, Value counts, each change of suit adds 1 Mult with a note | 8 s |
| 5 | Close a ring | A♣ and 6♣ glow, the cards move into a loop, Mult doubles with the ring chord | 6.5 s |
| 6 | Beat the target | 45 × 8 = 360, the total fills a bar past the target of 150, Table cleared | 7 s |
| 7 | Win the run | 8 stops of 3 tables with a host at each third table, then a shop with a charm and a stamp | 8 s |
| End | Ready to play? | A list of the rules, Play and Watch again | Waits |

The lengths live in `CONFIG.explainer`. The chains come from `addToChain`, and the scores from `scoreChain`, so the explainer cannot show a chain that breaks the rules or a score that the game would not give. Unit tests check both.

## Motion

Each scene is a pure function of its time `t`. A card has a list of key poses (place, turn, size, opacity, each at a time) and `pose(keys, t)` returns the pose between them with an ease. The screen draws a frame on each animation frame from a clock, so pause, back and next are only changes to the clock. With reduced motion, `pose` jumps a card to its next place when the move starts and fades it in, so the card never travels. Fades stay.

The animation area keeps a 10 by 9 shape and fits the space between the header and the caption (`container-type: size`). Places are in a 100 by 90 grid, so the layout is the same on every phone.

## Controls

- Story bars at the top, one for each scene.
- Back and Next at the bottom, in reach of a thumb. Skip and the sound button at the top.
- Holding a finger or the mouse on the animation pauses it.
- Arrows, Space and Escape on a keyboard.

## Ways in

- First visit: `follow-suit:intro-seen` is not in storage and the address has no seed. Closing the explainer in any way stores the key.
- The start screen: a How to play button under the lead line. The end card's Play starts a new run.
- A stop intro: a How to play button under the targets. The end card offers Back to the game.

## Checks

- Unit tests: the chains follow the rules, the scores match the engine, `pose` with and without reduced motion, the clock and the controls in jsdom, the stored key.
- `qa/explainer.e2e.mjs`: the first visit, seed links, the scene order, Next, Back, Skip and pause, the numbers on screen, the notes, reduced motion, the stop intro, and the layout at 4 phone sizes.
- The other browser checks store the key first, so they open the start screen as before.

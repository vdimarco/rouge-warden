# Design

## Comic scenes (cutscene.js, main.js)

- A scene is a list of panels: a duration, a shot (a camera push from one place and target to another), and any of a caption, a balloon and a title. The shots use the city's own places: the Needle, the King's perch, the nearest clog, the hero on the start roof.
- The page draws a DOM overlay over the canvas: letterbox bars, an inked frame, a caption box, a balloon and a title card. `body.cutscene` hides the HUD.
- The balloon is placed each frame from its world point projected through the camera, kept inside the frame, with its tail pointed at the point.
- main.js sets `G.state = "cutscene"` while a scene plays. The tick then runs only the scene, the city view and the hero's idle pose; the player, the ropes and the game hold still. At the end the chase camera is put back and the current line is said again.
- A press in the first 0.5 s does not skip, so the press that started play cannot end the scene.
- `save.seen` records the scenes seen (`opening`, `king`, `finale`, `districts`); `loadSave` checks its shape.
- The game calls `onStory(name, arg)` for the King waking, the finale and a district's first approach (within 150 m, not during training).

## Mission card and training (game.js, ui.js, config.js)

- `TRAINING` in config.js holds rows for three inputs: `mouse`, `pad` and `touch`. Each row has an id, words, keys and the line said while it is next (an index in the tutorial table of that input, or its own words).
- game.js keeps `progress.training` (`kind`, `items`, `now`, `done`) and ticks rows from game events:
  - `rope`: a rope attached 10 m or more over the chest;
  - `swing`: a let-go at 8 m/s or more;
  - `again`: a rope attached in the air after `rope` and `swing`;
  - `fast` (touch): a let-go at 15 m/s or more;
  - `reel`: 8 m reeled;
  - `yank`: a yank on a target that is not a clog or a pipe;
  - `look`: a turn of 1 rad in total;
  - `climb`: 2 m climbed on a wall;
  - `plunge`: the first clog flushed (the count is the pump count). The first flush ends the training whatever rows are still open, so `save.tutorial` is set as it was for the spoken tutorial.
- The line of the next row is said again every 20 s. The finish shows a toast and a gold flash and sets `save.tutorial`.
- The pump sticker reads `progress.pump` (`n`, `of`, `kind`), which game.js sets while a rope holds a clog or a pipe.
- `progress.objective` holds the mission card's text. It is computed twice a second.

## Layout

- Desktop: the mission card leads the score row on one line, so the row stays one row and the marker keeps the top of the screen. The training card sits at the lower left, above the key strip, so the spoken line under the score row stays clear of it. The marker keeps out of the card's corner (the card plus the ring's half width and 8 px).
- A phone, or a window under 820 by 520: main's score row stays one row of one height, so the marker keeps its share of the screen. The training card becomes a chip in that row (a box and the rows done), which takes the mission card's place while it shows. The mission card shows a short label (the district, or the pipes). With four score pills (a trial, or the King's hearts) neither shows; a wide window drops only the mission's next step.
- The spoken line is placed again at once when the phone panel comes or goes or the score row changes, so it never waits under a row that has shrunk.
- The score row takes its natural width up to 96 % of the window (`width: max-content`). Before, a box placed at `left: 50%` could use only half the window, so a fourth pill wrapped it onto two rows. A window 820 to 940 wide shows the mission's short label in place of its next step, so the row stays one row. The four-pill rules count score pills only (not the chip or the mission).
- The King's panels look in along the line from the Needle through his perch, so the spire stands behind him. His balloon sits beside him; other balloons sit above their speaker when there is room.

## How to check

- `qa/vr/training.e2e.mjs`: the card on a first run; each row ticked by a real action; the pump sticker's dots; the finish; the first flush ending the training with rows still open; the mission card; a phone in portrait.
- `qa/vr/cutscene.e2e.mjs`: each panel's words, the balloon inside the screen, the hero held still, the HUD hidden and back, the skip rules, a district briefing, the finale. It saves a screenshot of each panel to look at.

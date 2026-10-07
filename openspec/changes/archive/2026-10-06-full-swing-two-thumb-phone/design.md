# Design: two-thumb phone play

## Input (mobile.js)

- Every pointer that goes down on the canvas is tracked by its id. A pointer that moves more than 12 px (`SLOP`) from where it went
  down is a look drag. Any other pointer is a tap when it goes up: x < 50 % of the canvas is side 0 (the left plunger), else side 1.
- Real phones (a fix after the first device try: two thumbs threw one plunger). The moves, ups and cancels are read on the window,
  with no pointer capture, so a lost capture or an up over a button still ends the tap. `touchstart` and `touchmove` on the canvas
  and `gesturestart` on the document are cancelled, so iPhone Safari and Android Chrome start no pinch or zoom when a second
  thumb lands. A pointer the browser cancels within 0.5 s (`CANCEL_TAP`) with no drag throws as a tap. A pointer id that is still
  listed (its up was lost) is replaced by the new press.
- The sample has one slot per plunger: `fires[i]` (an edge), `aims[i]` (the tap point in NDC for that frame, or null) and
  `holds[i]` (the plunger is out). `tap(side, aim)` does the same from code; the tests use it where they pressed SWING.
- `released(side)` and `miss(side, keep)` act on one plunger. With no side, `released()` clears both (a wall, a respawn).
- The badges: `.phone-side[data-side=0|1]`, toggled `held`. They hide on a wall (the climb pad takes the left one's place). The
  lock-on ring keeps clear of them like the other HUD boxes.

## Play (desktop.js, main.js)

- desktop.js gives hand i its own fire edge, hold and tap ray.
- main.js applies the old phone rules (`i === 1` before) to both hands: the tap path, the auto pull, the pump on a clog, the catch
  speed and the auto-release clock (`phoneRopeT[i]` and the others are arrays).
- The hand-off: `firedAt[i]` is the game time of the last phone shot on side i. When phone rope i catches a building and rope j is
  attached to a building, j lets go `PHONE.handoff` (0.12 s) later unless `|firedAt[i] - firedAt[j]| <= PHONE.pair` (0.3 s).
  A rope thrown again cancels its own pending hand-off.
- An auto-release with the other plunger still attached lets go with no fling: the other one carries the swing and flings when it
  lets go.

## Checks

- `qa/vr/mobile.test.mjs` and `qa/vr/mobile-panel.test.mjs`: sides, two fingers, drag beside a tap, badges, released and miss per
  side.
- `qa/vr/phone-swing.e2e.mjs`: taps alone, a steady beat on alternate sides (0.5, 0.8, 1.2 s) stays fast and over the street, the
  hand-off (the old plunger lets go within 0.2 s of the new catch), two thumbs hold both.
- `qa/vr/mobile.e2e.mjs`, `qa/vr/phone-controls.e2e.mjs`, `qa/vr/layout.e2e.mjs`: real taps read the rope of the side tapped, the
  words, the badges and the layout at 390 by 844, 844 by 390 and 360 by 740.
- Not possible here: a real phone and real multi-touch on glass. The two-finger case runs as pointer events in Node, from code in
  the browser, and as CDP touch events in Chromium (two thumbs a moment apart, a touch cancel).

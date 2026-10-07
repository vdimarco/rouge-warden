# Design

## One finger, three gestures

Each finger on the city is a record in `drags` (`mobile.js`). It starts as *waiting*:

- It moves more than 12 px before 0.12 s: it becomes a *look*. It turns the view and never throws.
- It stays within 12 px for 0.12 s: `sample()` throws its plunger (`press`), and the finger *holds* that plunger (`pressing[side]`).
- It lifts first: it throws on the lift, as a tap (`lift`), and holds nothing.

0.12 s is short enough that a hold feels instant, and long enough that a drag starts before it. The old rule (throw on the lift) stays for taps, so a tap aims at the point where it lifted.

A held finger that lifts after 0.35 s from its touch-down sets `lets[side]`, an edge. A lift before 0.35 s was a tap that happened to pass 0.12 s, so the rope keeps going and lets go by itself. A finger that the browser cancels never lets go: the rope goes on as after a tap. A newer finger on the same side takes the hold over.

Press times come from the browser's event clock (`timeStamp`, and `performance.now()` in `sample()`), the same clock the old cancel rule used.

## Main

`desktop.js` passes `presses` as `inp.phoneHeld` and `lets` as `inp.phoneLetGo`.

- `phoneReleaseRope` skips the arc let-go, the stall let-go and the hand-off while `phoneHeld[i]`. The let-go after time on a roof stays, so a held rope never drags the hero over roofs.
- `phoneHandoff` does not start a hand-off for a held rope.
- `phoneLift` runs before the physics steps. When `phoneLetGo[i]` is set, it releases an attached rope with the arc's fling (`phoneLetGo`, which the arc let-go now shares), or with no fling on a roof. It also cancels a cup that still flies. It must run before physics: the mobile panel drops the hold in the same frame, and physics releases a rope whose hand does not hold, with no fling.

## Feedback

- Three `.phone-touch` rings in the phone panel follow the fingers. `data-mode` (wait, rope, look) and `data-side` (0, 1) choose the look in CSS.
- The hint changes to "Holding on. Lift your thumb to let go." once a finger has held its rope for 0.35 s.
- The gesture card (`.phone-coach`) takes no touches. `mobile.js` writes `G.save.seen.phoneCoach` and calls `G.saveNow()`, so main still does all the writing to localStorage.

## Checks

- `qa/vr/mobile.test.mjs`: hold to keep and lift to let go, a held finger looks, a drag never throws, a cancelled hold, two held thumbs.
- `qa/vr/phone-hold.e2e.mjs` (real touch events through Chrome DevTools): the card, a tap's rope lets go by itself, a hold throws with a yellow R ring, the held rope stays past the bottom of the arc, the lift lets go with a fling, and a drag shows a LOOK ring and throws nothing.

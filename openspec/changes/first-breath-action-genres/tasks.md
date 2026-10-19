# Tasks

Each stage builder edits only its own files: `core/stages/<id>.js`, `<id>.tune.js`, `<id>.facts.js`, `<id>.text.js`
and `qa/first-breath/stage-<id>.test.mjs`. Shared files (`core/lib/action.js`, `core/lib/actionbot.js`,
`core/draw.js`, `core/run.js`, `core/bots.js`, `core/carry.js`, `ui/*`, `render/*`) belong to the foundation builder
or the integrator; ask for a change there rather than editing them. Numbers come from `design.md` section 5; record
any tuned value in the tune file header and in `design.md` 3.1. API names come from `contract.md`.

## 0. Plan and foundation

- [x] 0.1 Write `proposal.md`, `design.md`, `tasks.md` and the spec deltas; validate with `openspec validate first-breath-action-genres --strict`.
- [x] 0.2 Foundation: `contract.md`, `core/lib/action.js` and `core/lib/actionbot.js` (move, dash, auto-fire, pooled bullets, foes, patterns, telegraphs, pickups, waves, zone, hp and knock-out, juice, bot).
  Also `goalSteer` (the stage goal pull of `design.md` 4.11) and `actionSteer`'s `keep` and `picks` options; `qa/first-breath/action.test.mjs` (16 checks).
- [x] 0.3 Foundation: the `move` gesture and the dash press in `ui/input.js`; `core/bots.js` presses for `dash`.
- [x] 0.4 Foundation: the action part of the draw list in `core/draw.js` (`LIMITS` and caps) and its paper drawing in `render/items.js`; palette tokens for the new things (`design.md` 4.8) in `render/palette.js`, checked by `paper.test.mjs`.
  The items are in `render/action.js` (re-exported by `render/items.js`); `ACTION_TONES` there gives every token a default, `ROLES[stage].action` overrides.
- [x] 0.5 Foundation: the knock-out flow in `core/run.js` (the Almost card with the rest line, Try again, Go on to `meta.goOn`, Goal 0 and no grade word); `meta.canFail` for stages 1 to 5 and 7.
  Go on calls `jump(st, meta.goOn)` when the result has `metrics.ko` (contract.md 4); each stage sets its own `meta.canFail` and `meta.goOn`.
- [ ] 0.8 Foundation: stage 1's press in `ui/input.js` and `core/bots.js` (a press while turning drifts, a press while straight uses the item; on desktop Space held while turning drifts with its keyup as the release, and E or Shift uses the item).
- [ ] 0.6 Foundation: HUD hp pips, shield sparks, stage 1's place slot with its "racing", gate and item tags, the boss bar and the edge arrow in `ui/hud.js`; number pops as DOM tags.
  Done: hp pips, shield pips, the boss bar (`action.boss`, `hud.boss`) and number pops (`ui/pops.js`). Left: stage 1's racing, gate and item tags and the edge arrow (with stages 1 and 4).
- [x] 0.7 Foundation: stage 5 rebuilt as the shooter (`design.md` 5.5, `contract.md`).

## 1. Stage 1, The Race (`swim`): the v1 race with kart parts on top

Keep everything `design.md` 5.1 lists under "What stays as it is" (the pack, the steering, the waves, the fork and cool loop, the tube's current and lane, the checkpoints, the glow walls, the place slot, the catch-up), with its numbers and tests.

- [x] 1.1 Update `qa/first-breath/race-sim.mjs` to the bending track and the new rules first, keeping its v1 model; freeze the numbers only when the ref is 1st and the mid bot in the top 3 in at least 18 of 20 seeds.
- [x] 1.2 The track: the v1 womb, gate, fork and cool loop, and the warm tube with bends B1 to B6 (a hairpin at B3), 4,600 u to the meeting place; progress along the centre line, so the v1 current, lane, checkpoints and glow walls work unchanged.
- [x] 1.3 The turning camera (the v1 spans and sideways ease, plus turning with the track); the next bend, gate and the fork on screen 1.5 s ahead.
- [x] 1.4 The drift with the v1 turn rate (no grip limit): start by a press while turning, the slide, charge to blue, orange and pink, release by straightening, lifting or pressing; the boosts.
- [x] 1.5 Item boxes in three rows, the place-weighted table, and the five items (Spark, Shield, Rush, Warm glow, Goo); one held at a time; a Warm glow makes you ready as a glow wall does.
- [x] 1.6 Slipstream and slingshot; white cells in the womb; spin-outs and slips; the v1 bumps and catch-up kept.
- [x] 1.7 Knockout gates (1,300, 2,800 and 4,000 u; 14, 8 and 5, or at 30, 60 and 85 s), the cool tide from 12 s, resting by the wall (in place of v1's rest 500 u behind you); the place, "racing", gate and item tags; the finish for the first 3.
- [x] 1.8 The rival policy: v1 `botSteer` at the v1 skill ladder, plus the lane through bends, drifts, items and drafting; tune to the target pacing (gates at about 18, 38 and 50 s for the mid bot).
- [x] 1.9 The Almost card lines (out, cap, or a finish outside the top 3), Go on with `carried`; score parts; carry out (`sperm.glow` from a glow wall or a Warm glow); facts in priority order; new facts `swim.acid`, `swim.cells`, `swim.mucus` (`checked` only after the source re-read).
- [x] 1.10 `botSteer` and the one-button result (top 3 in at least 18 of 20).
- [x] 1.11 `stage-swim.test.mjs`: keep the v1 checks that still hold, including the steering matching `race-sim.mjs` on a straight; add the new ones (design 5.1); gates passing.

## 2. Stage 2, The Egg (`egg`): a radial brick breaker with bullet-hell patterns

Keep everything `design.md` 5.2 lists under "What stays" (the arc and its controls, the arc over a sperm, sticking and burrowing, the gold sperm's rules, fusion), with its tests.

- [x] 2.1 The opening with no taps: the follicle opens by itself on her 3rd beat; the guard starts by about 4.7 s. Remove the 8 swim-in waves and the beat-timed seal.
- [x] 2.2 The glow: serve, the arc return angle (k × 55°), the rim at 54 u turning it within 14° of the centre, speed by returns, the lost glow (a pip and a serve 1.0 s later), the 10 s refresh, at most 6. Built with the rim at 48 u (the field scaled to fit landscape; the tune header records it).
- [x] 2.3 The formations: W1 to W4 with plain, tough and capped rivals, dots for hits left, re-forming rings, divers under the v1 sticking rules; waves on time or sooner when cleared; at most 36 in formation; drift-offs as v1's bounce.
- [x] 2.4 Enzyme spark patterns (aimed streams, fans, curtains, rings, the turning stream) with telegraphs through the action layer; the arc blocks and returns them into rivals; a spark on the shell costs a pip with the 20 u mercy clear; the 50-spark cap.
- [x] 2.5 Shell pips (6, Assist 9) and the three ways to lose one; the brightness-only crack; the knock-out with "Your shell needs a rest." and Go on to the gold sperm alone.
- [x] 2.6 Power-ups by kind, falling at 12 u/s and caught only by the arc: Multi, Wide, Pierce, Slow, Mend; the pity drop. Drawn as cream paper stars with a gold glow and a DOM word tag (a cut icon per kind is still to do).
- [x] 2.7 The seal charge (DOM ring, full at 12, keeps 2) and its release by a press: sparks to gold sparkles, a hit off each rival inside.
- [x] 2.8 The swarm: 20 rivals, the boss bar, three phases at a third and two thirds, its drift-off at 4 left or 14 s, taking every formation with it.
- [x] 2.9 The rush: the gold sperm 1.0 s + 0.3 s per place after the swarm, with 4 rivals at least 60° apart within 1.5 s; "Only one may enter. Let yours in."; the clean pick; entry by 60 s into the guard.
- [x] 2.10 The seal: "Tap to seal your shell.", the fresh press, 2.0 s by itself, the v1 wave out to the screen edge, 250 Flourish per charge kept.
- [x] 2.11 Combo and DOM number pops; score parts (rivals' hits, pips, best combo, rush credit; Flourish for a clean pick and charges kept); facts in priority order, new fact `egg.caps`; new strings checked by `text.test.mjs` (no "brick" or "break" shown). `egg.choice` became a result fact (no room among the captions); the strings are checked in `stage-egg.test.mjs`.
- [x] 2.12 `botSteer`: glow first (aimed at the most hits at skill 0.7 or more), then sparks, then power-ups, then the v1 target; never the gold zone; the seal charge and the seal press.
- [x] 2.13 `stage-egg.test.mjs`: keep the v1 checks that still hold; add the new ones (design 5.2); gates passing.

## 3. Stage 3, The Embryo: first cells (`split`): roguelike

- [x] 3.1 Rooms Day 1 to Day 4 with their germs, timers, exits and "Clear!"; the moments and gaDay spans.
  Rooms are boxes down the tube (no arena; the stage keeps you, germs and shots inside); chasers lunge along a line tell, splitters pop into two small chasers, puffers fire sticky spores; the exit is a squeeze that opens.
- [x] 3.2 Splits at each room's end; shots per volley by cell count; the ball keeps its size.
  Days 1 to 3 split (2, 4, 8, then 16 cells); after Day 4 the cells pack tight. The camera and you glide to the next room during the split.
- [x] 3.3 The nine gifts with levels, gift bubbles (`design.md` 4.6), the bot's preference.
  Shared addition: `action.gifts` (core/draw.js, render/action.js `drawGifts`), the tags as word pops; contract.md section 5. Sparkles mend a pip every 8.
- [x] 3.4 The Knot with three phases, the boss bar, the 18 s drift-off; the hollow filling.
  200 hp, phases at 60% and 24%; drawn as a clump (`look: "clump"` in render/action.js).
- [x] 3.5 The hatch and outro; the knock-out with "Your cells need a rest.", Go on to `hatch`.
- [x] 3.6 Score parts, facts in priority order, new fact `split.frame`.
  `split.inner` goes out as the Knot's room starts (its first phase change leaves no room to read it); `split.frame` re-read and checked.
- [x] 3.7 `stage-split.test.mjs` rewritten (a test per gift), gates passing.
  Also the stage 3 gate in `sim.test.mjs`; `clock.test`, `run.test`, `draw.test` and `facts.test` updated for the new stage. Browser checks in `layout.e2e.mjs` and `perf.e2e.mjs` for stage 3 are not written yet.

## 4. Stage 4, The Placenta (`root`): action-adventure

- [x] 4.1 Nestle (3 spots, 5 s idle pull).
- [x] 4.2 The seeded lining map (12 × 12 tiles): soft, open and firm tissue; tunnels; knots; 8 pools by kind; every pool reachable.
- [x] 4.3 The grapple (cone, reach, pull, retract), reach at 3 pools and strong roots at 5.
- [x] 4.4 Linking with the glow along the roots, the compass ping and edge arrow (drawn on the canvas by `render/lining.js`, inside a margin clear of the HUD; not yet a DOM tag the layout check can find), auto-link from 30 s.
- [x] 4.5 Germs and guard germs; root sparks.
- [x] 4.6 The first heartbeat with 8 pulses that pop germs near the tree; `grow` as v1.
- [x] 4.7 The knock-out with "You need a rest.", Go on to `heart`; score parts; facts; new fact `root.frame`; carry out.
- [x] 4.8 Tunnels baked per tile, re-baked only when crossed (with the renderer owner).
- [x] 4.9 `botSteer` (a Dijkstra path field to the nearest pool, grapple when it saves path); `stage-root.test.mjs` rewritten, gates passing (and the stage 4 gate in `sim.test.mjs`).

## 5. Stage 5, First Trimester (`grow`)

- [x] 5.1 As `contract.md` (the foundation builder); add `grow.frame` to the result facts.
  `grow.frame` ships `checked: false` until its page is re-read (9.6). The stage 5 gate is in `sim.test.mjs`.

## 6. Stage 6, Second Trimester (`answer`): rhythm

- [x] 6.1 Three lanes: drag and arrow lane moves; the arrow press counts as the kick; the 0.12 s touch flick rule.
  A tap also kicks in the lane column it lands in (tune header); `input.e2e.mjs` plays it by arrows, taps and flicks.
- [x] 6.2 `hear` and `beat` (6 kicks in the middle lane).
- [x] 6.3 Six phrases with lanes, call ripples and answer ghosts, "{Carer} feels you." and the hand glow.
- [x] 6.4 The sing-along with the jump note and the fever: a streak meter of 8 pips under your ring, the fever's
  word, its chord and warm lanes, each kick playing her note back, and a small shake on the jump note.
- [x] 6.5 `eyes` and `outro` as v1; `song.lit` from the phrases and the sing-along.
- [x] 6.6 Score parts, Assist (any lane counts), one-button lanes, facts in priority order.
- [x] 6.7 `stage-answer.test.mjs` rewritten, gates passing (and the stage 6 gate in `sim.test.mjs`).

## 7. Stage 7, Third Trimester (`turn`): survivor

- [x] 7.1 The arena easing from 54 to 38 u; you, the kick, Y darts at level 1.
- [x] 7.2 Foes and the wave table with swarmer rings and the Big Germ; the foe and spark caps.
- [x] 7.3 Sparkles, the grow meter, six levels, the seven antibody gifts with gift bubbles.
- [x] 7.4 The clear at 60 s, the turn (drag down or by itself at 6 s), the rest with the hum, the outro.
- [x] 7.5 The knock-out with "You need a rest.", Go on to `turn`; score parts; facts; new facts `turn.antibody`, `turn.months`, `turn.frame`.
- [x] 7.6 Antibodies drawn streaming from the placenta disc (`nestleX`, `treeSeed`).
- [x] 7.7 `botSteer` (kite, sweep, kick, the turn); `stage-turn.test.mjs` rewritten, gates passing.
- [x] 7.8 Play pass after the restart: drifters in pairs from 24 s (the horde peaks near 30 germs), an antibody pick in every offer, no number pops over the gift tags, the placenta disc a little in from the wall (its ring clear of the prompt in landscape); the bot's gift goal fresh for each offer and its kite kept to the middle band in portrait; the stage 7 sim gate also checks skill 0.7; layout, perf and smoke checks and screenshots at 390 × 844, 844 × 390 and 1440 × 900.

## 8. Stage 8, Birth (`birth`): endless runner

- [x] 8.1 The channel, three lanes, the camera (you at 25% in portrait), lane moves by drag and keys.
- [x] 8.2 Eight waves with surges and rests, the speed ramp, the tuck.
- [x] 8.3 The fold generator (always passable, spacing, tight gaps from wave 3), bumps that only slow you.
- [x] 8.4 The four gates (Tuck, Turn, Lift, Turn back) and `turnDir`; calm bubbles.
- [x] 8.5 The light as v1; folds stop at wave 8's end; no closed ring round the light.
- [x] 8.6 Score parts (not shown at the end), facts, one-button, Assist.
- [x] 8.7 `botSteer`; `stage-birth.test.mjs` rewritten, gates passing.

## 9. Integration

- [ ] 9.1 `core/stages/index.js` and `core/run.js` play the whole run with the new stages; `meta.goOn` for stages 2, 3, 4 and 7.
- [ ] 9.2 Shield sparks from `carry.sparks` in every action stage; no gift carries.
- [ ] 9.3 Captions: every new line and fact in `ui/captions.js` order; `pacing.test.mjs` passes; facts with no room set to `result`.
- [ ] 9.4 Sound: the new one-shots (`design.md` 4.9) through the womb bus, with captions.
- [ ] 9.5 Text: every new string passes `text.test.mjs` (banned words, pronouns, the race words, sentence length).
- [ ] 9.6 Facts: re-read each new fact's source and set `checked: true` only then; `facts.test.mjs` passes.
- [ ] 9.7 Stage cards: verbs and gesture icons for the move gesture.
- [x] 9.8 Difficulty and feel at the peaks: stages 5 and 8 grade by hits and bumps (skill 1.0 Great or better, 0.7 mostly Great, 0.5 mostly Good; the `sim.test.mjs` grade spread); stage 1's gate quotas 8, 5 and 4; stage 7's Beat gift lifts her heart, darts end at the wall, and the portrait caption band comes back down.

## 10. QA

- [ ] 10.1 Node: `for f in qa/first-breath/*.test.mjs; do node $f || echo FAIL $f; done`.
- [ ] 10.2 Bot runs: `node qa/first-breath/bot.mjs 20 0.7 1` and the gates of `design.md` 4.5 in `sim.test.mjs`.
- [ ] 10.3 Browser (server up, Chromium with `--disable-gpu`): `smoke`, `boot`, `layout`, `input`, `screens`, `perf`, `visual` and `sound` e2e checks.
- [ ] 10.4 Screenshots of every stage at 390 × 844, 844 × 390 and 1440 × 900 in both tiers (`shots.mjs`), including each stage's busiest moment.
- [ ] 10.5 Play every stage by hand at the three layouts; note what feels off and tune.
- [ ] 10.6 Validate the change again with `openspec validate first-breath-action-genres --strict`.
- [ ] 10.7 State in the pull request which checks did not run (real phones, touch latency, phone speakers).
- [ ] 10.8 Archive the change once every task is done, and review the canonical specs it writes.

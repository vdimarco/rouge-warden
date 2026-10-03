# Breakthrough atmosphere

## Why

BREAKTHROUGH already plays as a 12-turn climate strategy roguelike, but the world, cards, breakthroughs, and endings read as a flat interface. The run should feel like a hand-painted century: the landscape has to move, and it has to answer the player's choices.

## What changes

- Paint a layered, animated world in `public/breakthrough/` with four blended visual states: Damaged, Strained, Transitioning, and Thriving.
- Restyle technology cards as illustrated paper artifacts, and add a lightweight scientist comment on each turn.
- Give meta-breakthroughs a full-screen reveal, especially Planetary Grid, Carbon Mining, Land Dividend, and Electric Everywhere.
- Give each of the six endings its own closing picture, timeline, and short alternate history.
- Add a BREAKTHROUGH cabinet to the Cottage Arcade homepage. The homepage currently launches neither `public/breakthrough/` nor `public/breakthrough2/`. The new cabinet opens `/breakthrough/`. `public/breakthrough2/` stays untouched.

## Out of scope

- Simulation math, turn count, seed behavior, and the `window.__test` contract used by `qa/breakthrough/play.mjs`.
- Any edit under `public/breakthrough2/`.

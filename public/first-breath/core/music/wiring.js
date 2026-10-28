// First Breath score: which stingers the run's events play (openspec/changes/first-breath-score/design.md 3.1, 6).
// main.js plays what stingsFor() returns for each event, and qa/first-breath/music-engine.test.mjs replays whole bot
// runs through it to count them, so the check reads the game's own mapping. Pure: no clocks, no state of its own
// beyond the memory main.js keeps for one stage attempt.
//
//   a stage end (the overlay)   the cue's end stinger, then the grade's (Good, Great, Glowing); none for a knock-out
//   act.ko, stage 1's rest      ko
//   act.win                     win: the egg's swarm drifts off, the Knot pops, the big germ pops, the Big Germ pops.
//                               Stage 7 plays it once, at the Big Germ's pop; its clear comes shortly before the
//                               button and the grade, so it plays none there (tasks 5.23)
//   a gate passed (stage 1)     gate, from its `place` sound (there is no gate-pass event)
//   an item used (stage 1)      item
//   a gift taken (stage 3)      gift
//   a pool you link (stage 4)   gift on the first pool you link and on the last of the pools, when you link it; the
//                               pools between and the pools the roots reach by themselves play none (tasks 5.22)
//   birth's light               light
//   the cry (the ending)        warm, WARM_AFTER_CRY_S after it starts
// The boss stinger comes from a stage's mood turning boss, not from an event (main.js).
import { CUES, cueFor } from "./score.js";

export const WARM_AFTER_CRY_S = 0.9;     // the warm chord comes this long after the cry starts

// What one stage attempt remembers: main.js makes a fresh one at each stage start (a Try again too).
export function stingMemory() {
  return { links: 0, yours: 0, won: false };
}

// The stingers one run event plays, in order: [{ id, at }], `at` in core seconds (the event's own `at` when it has one,
// a beat-locked sound laid ahead, else its t). `mem` is the attempt's stingMemory(); `state` is the stage's state as
// the host has it when it handles the event (stage 4 reads how many pools there are, stage 7 whether the Big Germ
// has popped).
export function stingsFor(ev, mem, state = null) {
  if (!ev || typeof ev !== "object") return [];
  const m = mem || stingMemory();
  const at = Number.isFinite(ev.at) ? ev.at : ev.t;
  switch (ev.name) {
    case "screen": {
      if (ev.screen !== "overlay" || !ev.data) return [];
      const cue = CUES[cueFor(ev.data.id)], out = [];
      if (cue && cue.end) out.push({ id: cue.end, at: ev.t });
      if (ev.data.grade) out.push({ id: String(ev.data.grade).toLowerCase(), at: ev.t });
      return out;
    }
    case "moment": return ev.stage === "birth" && ev.id === "light" ? [{ id: "light", at }] : [];
    case "out": return [{ id: "ko", at }];
    case "item": return ev.kind === "use" ? [{ id: "item", at }] : [];
    case "sfx": break;
    default: return [];
  }
  const id = ev.id;
  if (id === "act.ko") return [{ id: "ko", at }];
  if (id === "act.win") {
    if (ev.stage !== "turn") return [{ id: "win", at }];
    // stage 7: only the Big Germ's pop (it pops before the clear, and the clear's act.win finds it already played)
    if (m.won || !(state && state.bigPopped)) return [];
    m.won = true;
    return [{ id: "win", at }];
  }
  if (ev.stage === "swim" && id === "place") return [{ id: "gate", at }];
  if (ev.stage === "split" && id === "act.up") return [{ id: "gift", at }];
  if (ev.stage === "root" && id === "root.link") {
    // every link with a sound counts (yours at gain 1, the roots' own at 0.6); a pool you link plays the gift when it
    // is your first, or when it is the last of the pools
    m.links++;
    if (!(ev.gain >= 1)) return [];
    const first = m.yours++ === 0;
    const pools = state && Array.isArray(state.pools) ? state.pools.length : 0;
    return first || (pools > 0 && m.links === pools) ? [{ id: "gift", at }] : [];
  }
  if (ev.stage === "ending" && id === "cry") return [{ id: "warm", at: at + WARM_AFTER_CRY_S }];
  return [];
}

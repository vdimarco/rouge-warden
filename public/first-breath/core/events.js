// First Breath: the event names and emit() (design.md 16.6). Each event is { name, t, ...data }, with t in stage
// seconds; a stage pushes it onto state.events and the host drains the list after each step. Pure.
//
// Contract choices: EVENTS maps each name to itself (EVENTS.judge === "judge"), so a typo reads as undefined in a
// test; emit never throws (a stage step never throws), so an unknown name is still pushed and isEvent() lets tests
// catch it; a finite `t` in data stamps the event at that exact time (a judge inside the step), else t is state.t.

const NAMES = ["moment", "prompt", "subgoal", "judge", "points", "fact", "caption", "sfx", "milestone", "song",
  "place", "bump", "fork", "arrive", "bounce", "stick", "loose", "held", "goldIn", "nudge", "enter", "seal", "done"];

export const EVENTS = Object.freeze(Object.fromEntries(NAMES.map((n) => [n, n])));

// The milestone ids (16.6).
export const MILESTONES = Object.freeze(["ready", "fertilized", "implanted", "heart", "fetus", "hearing", "eyes",
  "headDown", "born", "breath"]);

const KNOWN = new Set(NAMES);
export const isEvent = (name) => KNOWN.has(name);

// Push one event and return it.
export function emit(state, name, data) {
  if (!Array.isArray(state.events)) state.events = [];
  const d = data && typeof data === "object" ? data : {};
  const ev = { ...d, name, t: Number.isFinite(d.t) ? d.t : state.t };
  state.events.push(ev);
  return ev;
}

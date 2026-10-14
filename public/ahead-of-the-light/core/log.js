// Ahead of the Light: the run log (final.md 13): the run summary, the cause and the goal, and the Copy log text.
// SPINE STUB (WP0): a safe do-nothing body with the 18.4 signature. WP5 owns this file. Pure.

// Copy log: plain text for a run and its races. Stub: one line.
export function runLogText(run, races) {
  return `AHEAD OF THE LIGHT · SEED ${run ? run.seed : '?'} · LEG ${run ? run.leg + 1 : 0}`;
}

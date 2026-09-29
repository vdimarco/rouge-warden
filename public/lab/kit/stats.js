// Play time and counts for each toy, kept in this browser (localStorage "lab.stats.<toy>"). The lab page shows them,
// so a playtester can tell the crew how long a toy held them. Time counts only while a run is on and the tab shows.
export const TOYS = ["plunge", "creek", "tilt", "rules"];
const key = (toy) => "lab.stats." + toy;
const blank = () => ({ ms: 0, runs: 0, best: null, acts: {} });

export function readStats(toy) {
  try { return Object.assign(blank(), JSON.parse(localStorage.getItem(key(toy)) || "null") || {}); } catch (e) { return blank(); }
}

export function stats(toy) {
  const d = readStats(toy);
  let playing = false, t0 = 0;
  const save = () => { try { localStorage.setItem(key(toy), JSON.stringify(d)); } catch (e) { /* storage off */ } };
  const tick = () => { if (playing && t0) { const now = performance.now(); d.ms += now - t0; t0 = now; } };
  setInterval(() => { if (playing) { tick(); save(); } }, 5000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { tick(); t0 = 0; save(); } else if (playing) t0 = performance.now();
  });
  return {
    play() { if (!playing) { playing = true; t0 = performance.now(); } },
    stop() { tick(); playing = false; t0 = 0; save(); },
    run() { d.runs++; save(); },
    act(name, n = 1) { d.acts[name] = (d.acts[name] || 0) + n; },
    // keep v if it beats the best so far; true when it does
    best(v, better = (a, b) => a > b) {
      if (d.best == null || better(v, d.best)) { d.best = v; save(); return true; }
      return false;
    },
    get data() { tick(); return d; },
  };
}

export function fmtTime(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return m ? `${m} min ${s} s` : `${s} s`;
}

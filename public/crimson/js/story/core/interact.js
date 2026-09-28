// js/story/core/interact.js : the "press E" options near the hero. The nearest option within its radius
// (flat distance, minus 0.3 m for each point of prio: a mission prompt beats a vehicle's GET IN beside it) whose mode matches the hero's wins. Heights must be within
// 2.5 m when both sides give a y, so a prompt on the bridge deck never shows in the wash below (D6).
export function createInteract() {
  const opts = new Map(); let seq = 0, cur = null;
  return {
    add(o) { const id = o.id || `i${++seq}`; opts.set(id, { r: 2.5, mode: 'foot', hold: 0, prio: 0, label: 'USE', ...o, id }); return id; },
    remove(id) { opts.delete(id); if (cur && cur.id === id) cur = null; },
    clear(tag) { for (const [id, o] of opts) if (!tag || o.tag === tag) opts.delete(id); if (cur && !opts.has(cur.id)) cur = null; },
    get current() { return cur; },
    get list() { return [...opts.values()]; },
    update(hero) {
      cur = null;
      if (!hero || !hero.pos) return cur;
      let best = Infinity;
      for (const o of opts.values()) {
        if (o.mode !== 'any' && o.mode !== hero.mode) continue;
        if (o.when && !o.when()) continue;
        const p = typeof o.pos === 'function' ? o.pos() : o.pos;
        if (!p) continue;
        if (Number.isFinite(p.y) && Number.isFinite(hero.pos.y) && Math.abs(p.y - hero.pos.y) >= 2.5) continue;
        const d = Math.hypot(p.x - hero.pos.x, p.z - hero.pos.z) - o.prio * 0.3;
        if (d <= o.r && d < best) { best = d; cur = o; }
      }
      return cur;
    },
  };
}

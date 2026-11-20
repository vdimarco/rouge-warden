// Gloam Downs: the combat run's figures in the page. The foe files load once (with the first place of a run) and stay; the boss files
// load when asked. poolFor() lists a place's slots for pool.js makePool(); lineup() stands every awake-able slot in a row in front of a
// point, for a person (or a test) to look at them: ?run&test&lineup, then __gloam.lineup().
import { loadFigures } from './world.js';
import { readFigures } from './pool.js';

const cache = {};
export function figures(base, which, onProgress) {
  cache[which] ||= loadFigures(base, which, onProgress).then(f => { readFigures(f.json); return f; }).catch(err => { delete cache[which]; throw err; });
  return cache[which];
}
export const loaded = which => !!cache[which];

// the slots of a place's pool, in its order (foes.json.gz pools): the Barrow Reeve and its candles come from the boss file, and are
// left out until it has loaded
export function poolFor(id, foes, boss, codes = foes.json.pools[id] || '') {
  const slots = [];
  for (const code of codes) {
    const src = code === 'B' || code === 'C' ? boss : foes;
    if (src?.json.types[code]) slots.push({ code, type: src.json.types[code], src });
  }
  return slots;
}
// one of each figure: the pool of the lineup view
export const LINEUP = 'SPMIBCL';

/* Stand the slots in a row on the walk map: the foes 4.5 m in front of at = { x, z, yaw } (the lamplighter), the Barrow Reeve 3.5 m
   behind them, the carried light over the Reeve's head, the grave candles in an arc behind. Each foe shows clip at t; markers: true
   lays its rings and lanes at full size. Returns where each slot stands. */
export function lineup(pool, walk, at, { clip = 'rest', t = 0, spread = 1.7, ahead = 4.5, markers = false } = {}) {
  const fw = [Math.sin(at.yaw), Math.cos(at.yaw)], rt = [Math.cos(at.yaw), -Math.sin(at.yaw)], face = at.yaw + Math.PI;
  const floor = (x, z) => walk.support(x, z, walk.top(x, z) + 0.01) ?? walk.top(x, z);
  const point = (d, a) => { const x = at.x + fw[0] * d + rt[0] * a, z = at.z + fw[1] * d + rt[1] * a; return { x, y: floor(x, z), z, yaw: face, floor: floor(x, z) }; };
  const foes = pool.slots.filter(s => 'SPMI'.includes(s.code)), out = [];
  foes.forEach((s, i) => {
    const p = point(ahead, (i - (foes.length - 1) / 2) * spread), c = s.type.clips[clip] ? clip : 'rest';
    pool.wake(s, p, c, t);
    if (markers) for (const b of s.type.bones) {
      if (b.parent !== 'ground' || b.name === 'shadow') continue;
      // a lane runs out ahead of the foe, piece after piece; a ring lies round its feet
      const d = /^lane\d$/.test(b.name) ? b.pivot[2] - s.type.feet[2] : 0;
      pool.marker(s, b.name, { x: p.x - fw[0] * d, y: p.y, z: p.z - fw[1] * d, yaw: face });
    }
    out.push({ i: s.i, code: s.code, clip: c, ...p });
  });
  const B = pool.slots.find(s => s.code === 'B'), L = pool.slots.find(s => s.code === 'L'), C = pool.slots.find(s => s.code === 'C');
  if (B) {
    const p = point(ahead + 3.5, 0), c = B.type.clips[clip] ? clip : 'rest';
    pool.wake(B, p, c, t);
    out.push({ i: B.i, code: 'B', clip: c, ...p });
    if (C) {
      pool.wake(C, p, null);
      pool.placeGroups(C, C.type.groups.map((g, k) => { const a = -1.2 + (k / (C.type.groups.length - 1)) * 2.4, q = point(ahead + 3.5 + Math.cos(a) * 2.6, Math.sin(a) * 2.6); return [q.x, q.y, q.z]; }));
    }
  }
  if (L) {
    const p = point(ahead + 1.5, 0);
    pool.wake(L, p, 'rest', t);
    pool.place(L, 'light', [p.x, p.y + 1.6, p.z]);
    out.push({ i: L.i, code: 'L', ...p });
  }
  return out;
}

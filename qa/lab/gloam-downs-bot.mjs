// Gloam Downs: the pacing bot. Each bot plays whole runs, one after another, until its first win or 12 runs, with the page's own rules:
// the run (run.js), the lamplighter's moves (moves.js), the seed's mix of the zones with the elite's zone, Ember 3's extra foe and the
// guard's second wave (mix.js, as makeFight uses it), the foes and their elites (foes.js, elites.js), the combo and its glim
// (combo.js), the relics (relics.js), and the Lamp-room's upgrades and unlocks bought between runs, on the real walk maps of the five
// places. No browser.
//   The way: the bot walks each place's route (games/gloam-downs/lib/zones.mjs ROUTES) from the start to the beacon, and wakes the zones
//   it passes as a player does. A bot of skill 0.8 or more also takes every wisp and fights every zone: it turns off the way for the
//   nearest one left within 24 m. It walks to a relic an elite drops. When the beacon stays dark it goes to the keepers.
//   The fight: it walks to a foe that sees it (or one within 3 m), turns to face it, and presses Attack on every other step in reach.
//   It reads a wind-up (a foe's move or an elite's special move) 0.70 - 0.45k s after it starts (±0.1 s), misses one 0.45 (1 - k)^1.3
//   of the time, fights on until about 0.15 s before the hit lands, and then rolls away; a coal's ring it walks out of. It drinks under
//   30 + 20k% health when no wind-up is near.
//   Stuck: no progress for 2 s and it jumps for 1 s; no progress for 4 s and a skilled bot gives up the wisp or zone it went for, or
//   the bot is put at its next point (a nudge). A foe it cannot reach for 8 s: it is put beside it (a nudge). A nudge counts the time
//   a walk there takes at 3 m/s, and 2 or 3 s more, so a nudge never makes the run shorter. About 7 nudges a run come from the same
//   climbs, where the straight walk to the next point meets a step it cannot take (Gaol points 8, 9 and 14, Fen 5 and 8, Bell Knoll 6,
//   Crow Wall 17). NUDGE=1 prints each nudge.
//   The boss: Barrow Crown's zones are fought on the real map; the Barrow Reeve's fight is not stepped here. It is drawn from the boss
//   bot's own results (qa/lab/gloam-downs-boss.sim.mjs, in add-gloam-downs design.md): a win at full health 52% of tries at skill 0.3,
//   93% at 0.5 and all at 0.7 and up, scaled by the health the bot arrives with, and a fight of 55 to 78 s.
// Run: node qa/lab/gloam-downs-bot.mjs [bots = 20] [skill = 0.5] [first seed = 1]   (MAXRUNS=12, VERBOSE=1)
import fs from 'node:fs';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { makeWalk, makeBody, PARAMS } from '../../public/lab/gloam-downs/play.js';
import { startRun, makeRunner, buy, buyUnlock, chooseWick, maxOf, flasksOf, glimFactor, emberOf, UPGRADES, UNLOCKS, BASE } from '../../public/lab/gloam-downs/run.js';
import * as RS from '../../public/lab/gloam-downs/run-save.js';
import { makeFoes, phaseOf } from '../../public/lab/gloam-downs/foes.js';
import { specialPhase } from '../../public/lab/gloam-downs/elites.js';
import { sees } from '../../public/lab/gloam-downs/moves.js';
import { mixZones } from '../../public/lab/gloam-downs/mix.js';
import { makeCombo } from '../../public/lab/gloam-downs/combo.js';
import { mulberry, hash2 } from '../../public/lab/kit/rng.js';
import { ROUTES, POOLS } from '../../games/gloam-downs/lib/zones.mjs';

const W = fileURLToPath(new URL('../../public/lab/gloam-downs/worlds/', import.meta.url));
const BOTS = +(process.argv[2] || 20), SKILL = +(process.argv[3] || 0.5), SEED0 = +(process.argv[4] || 1);
const MAXRUNS = +(process.env.MAXRUNS || 12), VERBOSE = !!process.env.VERBOSE;
const PLACE_LIMIT = 12 * 60 * 60; // 12 minutes of game time in one place is a loss (a bot that cannot get on)
const SIDE = 24, WALK = 3.0; // a skilled bot's reach off the way for a wisp or a zone (m); the walk speed a nudge is counted at (m/s)
const why = { route: 0, foe: 0, wisp: 0, zone: 0 }; // the nudges by kind, and the wisps and zones a skilled bot gave up

const places = {};
function place(id) {
  if (places[id]) return places[id];
  const meta = JSON.parse(fs.readFileSync(`${W}${id}.json`, 'utf8'));
  const raw = new Uint8Array(zlib.gunzipSync(fs.readFileSync(`${W}${id}.walk.bin.gz`)));
  const walk = makeWalk(meta.walk, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength >> 1));
  return (places[id] = { meta, walk });
}
// the boss bot's results (add-gloam-downs design.md): wins over tries and the fight's median length, by skill
const BOSS = [[0.3, 199 / 385, 55.2], [0.5, 200 / 214, 63.0], [0.7, 1, 69.6], [0.9, 1, 77.8]];
const lerp = (k, i) => { if (k <= BOSS[0][0]) return BOSS[0][i]; for (let j = 1; j < BOSS.length; j++) if (k <= BOSS[j][0]) { const a = BOSS[j - 1], b = BOSS[j], u = (k - a[0]) / (b[0] - a[0]); return a[i] + (b[i] - a[i]) * u; } return BOSS.at(-1)[i]; };

// what the bot buys between runs, in this order: the cheapest affordable first among the next of each
const WANT = ['up:mantle', 'up:flask', 'un:kflask', 'up:edge', 'up:draught', 'un:shelf', 'un:rising', 'up:ash', 'un:tongue', 'un:heart', 'un:last', 'un:parry'];
function shop(rs) {
  for (let guard = 0; guard < 40; guard++) {
    const opts = WANT.map(w => {
      const [k, id] = w.split(':');
      if (k === 'up') { const u = UPGRADES.find(x => x.id === id), l = rs.up[id] || 0; return l < u.costs.length ? { w, cost: u.costs[l] } : null; }
      return (rs.unlocks || []).includes(id) ? null : { w, cost: UNLOCKS.find(x => x.id === id).cost };
    }).filter(Boolean).filter(o => o.cost <= rs.bank);
    if (!opts.length) return;
    const o = opts[0], [k, id] = o.w.split(':');
    if (k === 'up') buy(rs, id); else buyUnlock(rs, id);
  }
}
// the wick the bot takes from an offer
const WICK_RANK = ['keen', 'long', 'oil', 'heels', 'tongue', 'last', 'heavy', 'heart', 'shave'];
const pickWick = offer => offer.slice().sort((a, b) => WICK_RANK.indexOf(a) - WICK_RANK.indexOf(b))[0];

/* ---------------- one place ---------------- */
function playPlace(rs, id, bot) {
  const { meta, walk } = place(id), k = bot.skill, rnd = bot.rnd;
  const body = makeBody(walk, meta.spawn, meta.bounds, { ...PARAMS });
  // as the page's makeFight: the seed's mix of the zones (the elite's zone, Ember 3's extra foe, the guard's second wave) and the combo
  const zones = mixZones(id, meta.zones, POOLS[id], rs.run.seed, { ember: rs.run.ember ?? 0 });
  const combo = makeCombo({ emit: null, best: rs.run.combo ?? 0 });
  const F = makeFoes({ walk, meta: { ...meta, zones }, slots: POOLS[id], seed: rs.run.seed, combo });
  const R = makeRunner({ walk, meta, body, rs, targets: F.targets, lightable: F.lightable, drop: F.drop, think: F.think, onLight: F.bank });
  F.bind(R);
  const s = body.s, route = ROUTES[id].map(p => p.slice()), boss = id === 'barrows';
  const arenaAt = boss ? route.findIndex(p => Math.hypot(p[0] - 18, p[2] + 22) < 1) : -1;
  let wi = 1, t0 = rs.run.time, best = Infinity, bestAt = 0, nudges = 0, steps = 0, out = null, dark = null, lastHit = 0;
  const read = new Map(); // a wind-up read: its foe and start step -> { at, miss }
  const wisps = new Set(), seen = new Set(); // wisps taken or given up; zones woken or given up
  const goalOf = () => {
    // a relic on the ground, the keepers when the beacon is dark, a wisp near the way (skill 0.8 and up), or the route's next point
    const g = R.relics.view().ground[0];
    if (g) return [g.x, g.y, g.z];
    if (dark && !F.lightable().ok) return dark;
    if (k >= 0.8) {
      // a skilled player takes every wisp and fights every zone: the nearest one left within 24 m of here, else the way on
      let best = null, bd = SIDE;
      for (let i = 0; i < meta.wisps.length; i++) {
        if (R.wisps.has(i) || wisps.has(i)) continue;
        const p = meta.wisps[i].p, d = Math.hypot(p[0] - s.x, p[2] - s.z);
        if (d < bd) { best = p; bd = d; }
      }
      for (const Z of F.zones) {
        if (Z.boss || seen.has(Z.id) || Z.members.every(f => f.out)) continue;
        const d = Math.hypot(Z.c[0] - s.x, Z.c[2] - s.z);
        if (d < bd) { best = Z.c; bd = d; }
      }
      if (best) return best;
    }
    return route[Math.min(wi, route.length - 1)];
  };
  const toward = (p, slow = false) => { const dx = p[0] - s.x, dz = p[2] - s.z, d = Math.hypot(dx, dz) || 1; return { mx: dx / d, mz: -dz / d, slow }; };
  // the wind-ups that threaten the lamplighter now: { f, left (steps to the hit), from (where to roll away from) }
  function threats() {
    const list = [];
    for (const f of F.foes) {
      if (f.out || !f.alive) continue;
      if (f.special) {
        const P = specialPhase(f.special.def, f.special.t);
        if (P.ph !== 'w') continue;
        const d = Math.hypot(f.x - s.x, f.z - s.z);
        if (f.special.def.kind === 'coals' ? f.markers?.some(m => Math.hypot(m.x - s.x, m.z - s.z) < m.full + 0.6) : d < 4.5 + (f.special.def.kind === 'bent' ? 6 : 0))
          list.push({ f, key: `${f.id}:s:${f.special.t - P.at}`, left: P.n - P.at + (f.special.def.kind === 'coals' ? 43 : 0), from: f.special.def.kind === 'coals' && f.marker ? [f.marker.x, f.marker.z] : [f.x, f.z], at: P.at });
        continue;
      }
      if (f.state !== 'move' || !f.move) continue;
      const M = f.T.moves[f.move];
      if (phaseOf(M, f.mt) !== 'wind') continue;
      const d = Math.hypot(f.x - s.x, f.z - s.z);
      const near = f.move === 'lob' ? f.marker && Math.hypot(f.marker.x - s.x, f.marker.z - s.z) < M.ring + 0.6 : d < (M.range || 3) + 1.5;
      if (!near) continue;
      list.push({ f, key: `${f.id}:${f.move}:${f.mt === 0 ? steps : steps - f.mt}`, left: M.wind - f.mt + (f.move === 'lob' ? M.flight + M.release : 0), from: f.move === 'lob' ? [f.marker.x, f.marker.z] : [f.x, f.z], at: f.mt });
    }
    return list;
  }
  function act() {
    const run = rs.run, hp = run.hp / maxOf(rs), live = F.targets();
    // a wind-up read in time: roll away about 9 steps before the hit
    for (const t of threats()) {
      let r = read.get(t.key);
      if (!r) { r = { at: Math.round((0.7 - 0.45 * k + (rnd() - 0.5) * 0.2) * 60), miss: rnd() < 0.45 * Math.pow(1 - k, 1.3) }; read.set(t.key, r); }
      if (r.miss || t.at < r.at) continue;
      if (t.left <= 10 || (t.f.special?.def.kind === 'coals' || t.f.move === 'lob')) {
        const dx = s.x - t.from[0], dz = s.z - t.from[1], d = Math.hypot(dx, dz) || 1;
        const side = t.f.move === 'charge' || t.f.special?.def.kind === 'bent';
        const ux = side ? -dz / d : dx / d, uz = side ? dx / d : dz / d;
        if (t.f.move === 'lob' || t.f.special?.def.kind === 'coals') return { mx: ux, mz: -uz };
        return { roll: true, mx: ux, mz: -uz };
      }
      // not yet: it fights on until the roll is due
      break;
    }
    if (hp < 0.3 + 0.2 * k && run.flasks > 0 && R.fighter.f.move !== 'drink' && steps % 4 === 0) return { heal: true };
    // the nearest foe in the fight
    let foe = null, fd = 9;
    // a foe that sees the lamplighter (a sleeping zone's foe on its ledge is left alone), or one within 3 m
    for (const t of live) { const d = Math.hypot(t.x - s.x, t.z - s.z); if (d < fd && Math.abs(t.y - s.y) < 2.5 && (t.aware || d < 3)) { foe = t; fd = d; } }
    if (foe) {
      // a foe the bot cannot reach (over deep water, on a ledge) for 8 s: it is put beside it, as a nudge
      if (steps - lastHit > 480) {
        lastHit = steps;
        const dx = s.x - foe.x, dz = s.z - foe.z, l = Math.hypot(dx, dz) || 1;
        let x = foe.x + (dx / l) * 1.2, z = foe.z + (dz / l) * 1.2, y = walk.support(x, z, foe.y + 1);
        if (y === null || Math.abs(y - foe.y) > 0.8) { x = foe.x + 0.6; z = foe.z; y = walk.support(x, z, foe.y + 1) ?? foe.y; }
        const far = Math.hypot(x - s.x, z - s.z);
        if (process.env.NUDGE) console.log('foe nudge', id, foe.id, foe.type, foe.state, +fd.toFixed(2), +(foe.y - s.y).toFixed(2), foe.fly ? 'fly' : '', R.fighter.f.move);
        body.place([x, y + 0.3, z], Math.atan2(foe.x - x, foe.z - z));
        nudges++; why.foe++; rs.run.time += 2 + far / WALK;
      }
      if (fd - foe.r > 1.5) return toward([foe.x, foe.y, foe.z]);
      // in reach: Attack on every other step, and turn to face the foe first (a swing at the air never lands)
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(foe.x - s.x, foe.z - s.z) - s.yaw), Math.cos(Math.atan2(foe.x - s.x, foe.z - s.z) - s.yaw)));
      if (off > 0.5 || fd - foe.r > 1.0) return toward([foe.x, foe.y, foe.z], true);
      return { attack: steps % 2 === 0, ...toward([foe.x, foe.y, foe.z]), mx: 0, mz: 0 };
    }
    const g = goalOf();
    return toward(g);
  }
  let boss0 = false, jumped = false, jumpTo = 0;
  while (rs.run && steps < PLACE_LIMIT) {
    const a = act();
    steps++;
    if (jumpTo > 0) { jumpTo--; a.jump = jumpTo % 20 < 10; }
    for (const e of R.step(a, 0)) {
      if (e.type === 'dark') dark = e.at;
      if (e.type === 'hit') { lastHit = steps; combo.hit(e.kind === 'relic' ? 'relic' : e.kind); }
      if (e.type === 'hurt') { combo.end(); bot.hurt += e.dmg; }
      if (e.type === 'wisp') wisps.add(e.i);
      if (e.type === 'beacon' || e.type === 'win') out = e;
      if (e.type === 'dead') out = e;
    }
    combo.tick(true);
    if (combo.best > (rs.run?.combo || 0) && rs.run) rs.run.combo = combo.best;
    if (out) break;
    for (const Z of F.zones) if (Z.awake || (!Z.boss && Math.hypot(Z.c[0] - s.x, Z.c[2] - s.z) < 1.5)) seen.add(Z.id);
    // the next point of the way, and a nudge when stuck
    const p = route[Math.min(wi, route.length - 1)];
    if (Math.hypot(p[0] - s.x, p[2] - s.z) < 1.2 && wi < route.length - 1) { wi++; best = Infinity; }
    const g = goalOf(), d = Math.hypot(g[0] - s.x, g[2] - s.z);
    for (let i = 0; i < meta.wisps.length; i++) if (!R.wisps.has(i) && Math.hypot(meta.wisps[i].p[0] - s.x, meta.wisps[i].p[2] - s.z) < 1.2) wisps.add(i);
    const fighting = F.targets().some(t => t.aware && Math.hypot(t.x - s.x, t.z - s.z) < 9 && Math.abs(t.y - s.y) < 2.5);
    if (d < best - 0.3 || fighting) { best = Math.min(best, d); bestAt = steps; }
    else if (steps - bestAt > 120 && !jumped) { jumped = true; jumpTo = 60; }
    else if (steps - bestAt > 240) {
      // stuck for 4 s, a jump tried: a skilled bot gives up a wisp or a zone off the way; else it is put at its point, and the time
      // a walk there takes at the walk speed is counted, with 3 s more
      const zone = F.zones.find(Z => Z.c === g), wisp = meta.wisps.findIndex(w => w.p === g);
      if (zone) { seen.add(zone.id); why.zone++; }
      else if (wisp >= 0) { wisps.add(wisp); why.wisp++; }
      else {
        const far = Math.hypot(g[0] - s.x, g[2] - s.z);
        if (process.env.NUDGE) console.log('route nudge', id, wi, g.map(v => +v.toFixed(1)), [s.x, s.y, s.z].map(v => +v.toFixed(1)), +far.toFixed(1), s.ground);
        body.place([g[0], g[1] + 0.5, g[2]], s.yaw);
        nudges++; why.route++;
        rs.run.time += 3 + far / WALK;
        if (g === route[Math.min(wi, route.length - 1)] && wi < route.length - 1) wi++;
      }
      best = Infinity; bestAt = steps; jumped = false;
    }
    // Barrow Crown: at the arena the boss fight, from the boss bot's results
    if (boss && !boss0 && wi > arenaAt) {
      boss0 = true;
      const h = rs.run.hp / maxOf(rs);
      bot.arrive.push({ h, flasks: rs.run.flasks });
      const pWin = lerp(k, 1) * (0.55 + 0.45 * h), len = lerp(k, 2) * (0.9 + rnd() * 0.25);
      rs.run.time += len;
      bot.bossFights.push(len);
      if (rnd() > pWin) { out = { type: 'dead' }; R.kill([]); break; }
      rs.run.bossDown = true;
      rs.run.carried += Math.floor(BASE.boss * glimFactor(emberOf(rs.run)));
      rs.run.foes += 1;
    }
  }
  if (!out && rs.run) { if (VERBOSE) console.log('stuck', id, JSON.stringify({ at: [s.x, s.y, s.z].map(v => +v.toFixed(1)), wi, dark, light: F.lightable(), live: F.targets().map(t => [t.id, t.state, +t.x.toFixed(1), +t.y.toFixed(1), +t.z.toFixed(1), t.hp, sees(walk, s, t), walk.support(t.x, t.z, t.y + 1), t.cool, t.aware]), act: act(), hp: rs.run.hp, fl: rs.run.flasks, ground: s.ground, th: threats().map(t => [t.key, t.left, t.at]), melee: [...F.melee].map(g => g.id), tgt: R.fighter.f.target?.id, move: R.fighter.f.move, ground: R.relics.view().ground })); R.kill([]); out = { type: 'dead', stuck: true }; }
  combo.end();
  return { out, time: (rs.run?.time ?? rs.ended?.time ?? 0) - t0, nudges, elite: R.eliteDown || false };
}

/* ---------------- one bot ---------------- */
function playBot(b) {
  const rs = RS.fresh();
  const bot = { skill: SKILL, rnd: mulberry(hash2(b, 0xb07, 7)), bossFights: [], arrive: [], hurt: 0 };
  const runs = [];
  for (let r = 0; r < MAXRUNS; r++) {
    shop(rs);
    startRun(rs, hash2(b, r, 0x5eed) || 1);
    if (rs.run.offer) chooseWick(rs, pickWick(rs.run.offer));
    const per = {};
    let nudges = 0;
    while (rs.run) {
      const id = rs.run.place;
      const res = playPlace(rs, id, bot);
      per[id] = +(res.time / 60).toFixed(2);
      nudges += res.nudges;
      if (rs.run?.offer) chooseWick(rs, pickWick(rs.run.offer));
      if (res.out?.type === 'dead' || res.out?.type === 'win' || !rs.run) break;
    }
    const e = rs.ended;
    runs.push({ won: e.won, place: e.place, time: +(e.time / 60).toFixed(2), banked: e.banked, relics: e.relics.length, per, nudges });
    if (VERBOSE) console.log(`bot ${b} run ${r + 1}: ${e.won ? 'WIN' : 'died in ' + e.place} ${(e.time / 60).toFixed(1)} min, banked ${e.banked}, relics ${e.relics.join(',') || '-'}, nudges ${nudges}`);
    rs.ended = null;
    if (e.won) break;
  }
  return { runs, boss: bot.bossFights, arrive: bot.arrive, hurt: bot.hurt };
}

const t0 = Date.now(), bots = [];
for (let b = SEED0; b < SEED0 + BOTS; b++) bots.push(playBot(b));
const med = v => { const s = v.slice().sort((a, c) => a - c); return s.length ? s[Math.floor(s.length / 2)] : null; };
const firstReach = bots.filter(x => x.runs[0].won || x.runs[0].place !== 'gaol').length;
const winRun = bots.map(x => (x.runs.at(-1).won ? x.runs.length : null));
const wins = winRun.filter(Boolean);
const winTimes = bots.map(x => x.runs.at(-1)).filter(r => r.won).map(r => r.time);
const reached = {};
for (const x of bots) for (const r of x.runs) reached[r.place] = (reached[r.place] || 0) + 1;
console.log(`${BOTS} bots, skill ${SKILL}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`first run reaches The Crow Wall: ${firstReach} of ${BOTS} (${Math.round((100 * firstReach) / BOTS)}%)`);
console.log(`won within ${MAXRUNS} runs: ${wins.length} of ${BOTS}; median first-win run ${med(wins) ?? '-'} (of those that won)`);
console.log(`winning run: median ${med(winTimes) ?? '-'} min of game time; boss fight (from the boss bot) median ${(med(bots.flatMap(x => x.boss)) ?? 0).toFixed(1)} s`);
console.log(`runs ended in: ${Object.entries(reached).map(([p, n]) => `${p} ${n}`).join(', ')}`);
const per = {};
for (const x of bots) for (const r of x.runs) for (const [p, t] of Object.entries(r.per)) (per[p] ||= []).push(t);
console.log(`minutes a place (median): ${Object.entries(per).map(([p, v]) => `${p} ${med(v)}`).join(', ')}`);
const arr = bots.flatMap(x => x.arrive);
console.log(`at the arena: health ${(100 * med(arr.map(a => a.h))).toFixed(0)}% (median), flasks left ${med(arr.map(a => a.flasks))}; damage taken a run (mean) ${(bots.reduce((a, x) => a + x.hurt, 0) / bots.flatMap(x => x.runs).length).toFixed(0)}`);
console.log(`nudges: ${JSON.stringify(why)} (route and foe are nudges; wisp and zone were given up)`);
console.log(`nudges a run (mean): ${(bots.flatMap(x => x.runs).reduce((a, r) => a + r.nudges, 0) / bots.flatMap(x => x.runs).length).toFixed(1)}; relics a run (mean): ${(bots.flatMap(x => x.runs).reduce((a, r) => a + r.relics, 0) / bots.flatMap(x => x.runs).length).toFixed(2)}`);

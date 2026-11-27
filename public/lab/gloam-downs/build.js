// Gloam Downs: what a build adds to the run (gloam-downs-hub design.md "Part B"). Sure cuts, the ward shell and its cap, Horn lamp, the
// panes that read the fight (Cinder, Spill, Rush, Thirst, Shard and Cracked glass), the wicks that read it (Sure hand, Char wick, Count
// wick, Shell wick), the colour sets, and the hooks the gear builder calls (markSure, addShell). No DOM, so the page, the Node tests and
// the bot use it as it is.
// makeBuild(R) makes the build of one runner and keeps it on R.build; the runner reads it in its stats (the bonus, a sure cut, the
// haste) and in hurt() (the shell), and steps it at the end of its own step. Every time here is in play steps of 1/60 s.
import { ABILITIES, PANES, MOVE_COLOUR, COLOUR_IDS } from './growth.js';
import { BLADES, OFFHANDS, traitsOf, traitOf } from './gear.js';
import { RELICS } from './relics.js';
import { makeCombo } from './combo.js';
import { statusHit, STATES } from './status.js';
import { paneOf, maxOf, WICKS, UPGRADES } from './run.js';
import { mulberry, hash2 } from '../kit/rng.js';

const S = sec => Math.round(sec * 60);
const pane = id => PANES.find(p => p.id === id);
const wick = id => WICKS.find(w => w.id === id);
// the numbers that are not in the tables: a sure cut's factor and its added hit stop, the shell's cap of the max health (with the Ward
// set), what each colour set does, and the blade's hits (the hits a sure cut, Thirst glass and Whetstone read)
export const BUILD_RULES = {
  sure: { k: 1.5, stop: 1 },
  shell: { cap: 0.4, wardCap: 0.5 },
  set: { need: 3, flame: { burn: S(2), r: 2 }, ward: { shell: 10 }, gloam: { cool: S(1) } },
  blade: ['cut1', 'cut2', 'fin', 'rise', 'plunge']
};
// the colour of a relic, by its move (growth.js MOVE_COLOUR)
const RELIC_MOVE = { 'first cut': 'blade', 'second cut': 'blade', finisher: 'blade', plunge: 'plunge', roll: 'roll', 'near miss': 'miss', flask: 'flask' };
export const relicColour = id => MOVE_COLOUR[RELIC_MOVE[RELICS.find(r => r.id === id)?.move]] || null;
// Whetstone's chance of a sure cut: 4% a level
export const whetChance = up => (UPGRADES.find(u => u.id === 'whet').sure) * (up?.whet | 0);
// Horn lamp: every shell 20% bigger a level
export const hornK = up => 1 + UPGRADES.find(u => u.id === 'horn').shell * (up?.horn | 0);
/* the run's colours over the held blade, the held off-hand, the slotted abilities, the set panes and the held relics. The blade and
   the off-hand are the gear's (gear-play.js R.gear), else the run's own, else the Lamp blade and none */
export function colourCount(R) {
  const rs = R.rs, run = rs.run, n = { flame: 0, ward: 0, gloam: 0 };
  if (!run) return n;
  const add = c => { if (c in n) n[c]++; };
  add(R.gear?.colour?.() ?? BLADES.find(b => b.id === (run.blade?.id || 'lamp'))?.colour);
  const off = R.gear?.offhand?.()?.id ?? run.offhand?.id;
  if (off) add(OFFHANDS.find(o => o.id === off)?.colour);
  for (const a of run.abilities || []) if (a) add(ABILITIES.find(x => x.id === a.id)?.colour);
  for (const p of rs.panes || []) if (p && paneOf(rs, p)) add(pane(p)?.colour);
  for (const r of run.relics || []) add(relicColour(r));
  return n;
}
// Steady's share of the sure-cut chance: 6% for each Steady on the held blade, off-hand and abilities (traits on two items add)
export function steadyChance(run) {
  let n = 0;
  for (const x of [run?.blade, run?.offhand, ...(run?.abilities || [])]) if (x) for (const id of traitsOf(x)) if (id === 'steady') n += traitOf('steady').sure;
  return n;
}
export const setsOf = R => { const n = colourCount(R); return COLOUR_IDS.filter(c => n[c] >= BUILD_RULES.set.need); };

export function makeBuild(R) {
  const rs = R.rs, clock = R.clock;
  const B = { rs, shells: [], sureUntil: -1, combo: makeCombo({ emit: null }), haste: 0, spill: new Map(), lastEv: null, started: false, sets: [], sureLog: 0 };
  R.build = B;
  const run = () => rs.run;
  const has = id => (run()?.wicks || []).includes(id);
  const holds = id => (run()?.relics || []).includes(id);
  const max = () => maxOf(rs);
  const cue = (ev, name, more = {}) => { const c = { cue: name, step: clock.step, play: clock.play, ...more }; R.log.push(c); ev.push({ type: 'cue', ...c, logged: true }); };
  const live = () => R.targets().filter(t => t.alive);
  /* ---------------- sure cuts ----------------
     A blade hit is sure when one of these says so: a sure cut readied (Shutter's next hit in 3 s, the Buckler's parry), Sure hand on a
     stunned, held or blind foe, or Whetstone's 4% a level from the seed's `sure` stream (one roll each blade hit, its own counter, so
     no other draw moves it). -> true when this hit is sure */
  const sureRoll = r => { r.sureRolls = (r.sureRolls | 0) + 1; return mulberry(hash2(r.seed | 0, r.sureRolls, 0x5c0e))(); };
  B.sure = (t, kind) => {
    const r = run();
    if (!r || !BUILD_RULES.blade.includes(kind)) return false;
    let sure = false;
    if (B.sureUntil >= clock.play) { sure = true; B.sureUntil = -1; }
    const st = t?.status;
    if (!sure && has('sure') && (st?.stun > 0 || st?.hold > 0 || st?.blind > 0 || t?.state === 'stun')) sure = true;
    // Whetstone's 4% a level and Steady's 6% on each held item add into one chance, one roll a blade hit from the sure stream
    const whet = whetChance(rs.up) + steadyChance(r);
    if (whet > 0 && sureRoll(r) < whet) sure = true;
    return sure;
  };
  // the gear's hook (Buckler's parry, a trait): the next blade hit within `steps` is sure
  B.markSure = (steps = Infinity) => { B.sureUntil = Number.isFinite(steps) ? clock.play + steps : Infinity; };
  /* ---------------- the ward shell ----------------
     A pool of points that takes damage before health. Each source has its own time; all together hold at most 40% of the max health
     (50% with the Ward set). Horn lamp makes each 20% bigger a level. o.onEnd(ev) runs when that shell breaks or its time ends (Ember
     shell's burst). -> the points added */
  B.total = () => B.shells.reduce((a, x) => a + x.n, 0);
  B.capOf = () => Math.round(max() * (B.sets.includes('ward') ? BUILD_RULES.shell.wardCap : BUILD_RULES.shell.cap));
  B.addShell = (n, steps = Infinity, from = 'shell', o = {}) => {
    if (!run() || !(n > 0)) return 0;
    const room = B.capOf() - B.total(), add = Math.min(room, Math.round(n * hornK(rs.up)));
    if (add <= 0) return 0;
    B.shells.push({ n: add, full: add, left: steps, from, onEnd: o.onEnd || null });
    return add;
  };
  // a blow on the lamplighter: the shells take it first, the one that ends soonest first. -> what is left for the health
  B.absorb = (d, ev = R.out) => {
    let left = d;
    for (const x of B.shells.slice().sort((a, b) => a.left - b.left)) {
      if (left <= 0) break;
      const k = Math.min(x.n, left);
      x.n -= k; left -= k;
      if (x.n <= 0) end(x, ev, true);
    }
    return left;
  };
  function end(x, ev, broke) {
    const i = B.shells.indexOf(x);
    if (i < 0) return;
    B.shells.splice(i, 1);
    if (broke) cue(ev, 'shell', { broke: true, from: x.from });
    x.onEnd?.(ev);
  }
  /* ---------------- the bonus ----------------
     Cinder glass below 30% health and Cracked glass until it cracks add to the blade's sum (run.js stats and R.bonus) */
  B.bonus = () => {
    const r = run();
    if (!r) return 0;
    let k = 0;
    if (paneOf(rs, 'cinder') && r.hp < pane('cinder').below * max()) k += pane('cinder').dmg;
    if (paneOf(rs, 'cracked') && (r.cracked | 0) < pane('cracked').hits) k += pane('cracked').dmg;
    return k;
  };
  // Rush glass's haste: walk and run 25% faster while it lasts (moves.js reads it)
  B.hasteK = () => (B.haste > 0 ? 1 + pane('rush').haste : 1);
  /* ---------------- what a step did ----------------
     The runner calls step(ev) at the end of its own step; the page may call it again after (main.js), which does nothing */
  function charOn(t, n, ev) { if (t?.alive && n > 0) statusHit(t, 'char', n, { ev, from: [R.fighter.body.s.x, R.fighter.body.s.z] }); }
  function burnOn(t, steps) { if (t?.alive) statusHit(t, 'burn', steps, { dps: STATES.burnDps }); }
  // Spill glass: a burst of fire where a foe was put out; a chain stops after 3 bursts
  function spill(e, ev) {
    const P = pane('spill'), m = B.spill.get(e.foe), chain = m && clock.step - m.at <= 3 ? m.chain : { n: 0 };
    B.spill.delete(e.foe);
    if (chain.n >= P.chain) return;
    chain.n++;
    ev.push({ type: 'abilityFx', kind: 'burst', id: 'spill', at: [e.x, e.y, e.z], r: P.r });
    cue(ev, 'slam', { pane: 'spill' });
    for (const t of live()) {
      if (Math.hypot(t.x - e.x, t.z - e.z) - (t.r || 0) > P.r || Math.abs(t.y - e.y) > 2) continue;
      if (t.id) B.spill.set(t.id, { chain, at: clock.step });
      const dmg = t.hit(P.dmg, { from: [e.x, e.z], push: 0, knock: 0, kind: 'ability', ability: 'spill', interrupt: true });
      if (dmg !== false) ev.push({ type: 'hit', kind: 'relic', ability: 'spill', target: t, dmg });
      burnOn(t, S(P.burn));
    }
  }
  // a hit taken (run.js hurt): the Count wick's combo ends, and the third hit in a place cracks Cracked glass until the next beacon
  B.hurt = (ev = R.out) => {
    const r = run();
    B.combo.end();
    if (r && paneOf(rs, 'cracked') && (r.cracked | 0) < pane('cracked').hits) {
      r.cracked = (r.cracked | 0) + 1;
      if (r.cracked >= pane('cracked').hits) { cue(ev, 'crack', { pane: 'cracked' }); R.notes.push('<b>Cracked glass</b> cracks · nothing until the next beacon'); }
    }
  };
  B.step = (ev = R.out) => {
    if (ev === B.lastEv) return;
    B.lastEv = ev;
    const r = run();
    if (!r || R.dead) return;
    const play = ev.play !== false, n0 = ev.length;
    B.combo.tick(play);
    B.sets = setsOf(R);
    // Shell wick: a 15 shell at the place's start (the first play step, after the start card)
    if (!B.started) { B.started = true; if (has('shellw')) B.addShell(wick('shellw').shell, Infinity, 'shellw'); }
    if (play) {
      if (B.haste > 0) B.haste--;
      for (const x of B.shells.slice()) if (Number.isFinite(x.left) && --x.left <= 0) end(x, ev, false);
    }
    for (const e of ev.slice()) {
      if (e.type === 'hit' && e.target && !e.tick) {
        // the combo of the Count wick: each 12th hit throws a free Lantern bomb at 75% at the nearest foe within 6 m
        if (B.combo.hit(e.kind === 'relic' ? 'relic' : e.kind) && has('count') && B.combo.n % wick('count').every === 0) countBomb(ev);
        const blade = BUILD_RULES.blade.includes(e.kind);
        // Thirst glass: below 50% health, a blade hit heals 15% of its damage
        if (blade && paneOf(rs, 'thirst') && r.hp < pane('thirst').below * max() && e.dmg > 0) {
          // the share adds up over the hits, and the health takes the whole points
          B.thirst = (B.thirst || 0) + e.dmg * pane('thirst').heal;
          const k = Math.floor(B.thirst + 1e-9);
          if (k > 0) { B.thirst -= k; r.hp = Math.min(max(), r.hp + k); }
        }
        // Char wick: the finisher adds 2 Char; Char edge: the first cut adds 1 (2 kindled with the Char wick)
        if (e.kind === 'fin' && has('charw')) charOn(e.target, wick('charw').char, ev);
        if (e.kind === 'cut1' && holds('charedge')) charOn(e.target, has('charw') ? 2 : 1, ev);
        // Shard glass: a sure cut adds 2 Char
        if (e.sure && paneOf(rs, 'shard')) charOn(e.target, pane('shard').char, ev);
      } else if (e.type === 'foeOut') {
        if (paneOf(rs, 'spill')) spill(e, ev);
        // Rush glass: 1.5 s of haste, and the next roll starts at once
        if (paneOf(rs, 'rush')) { B.haste = S(pane('rush').time); R.fighter.rush?.(); }
        // the Flame set: a burning foe put out passes 2 s of burn to the nearest foe within 2 m
        if (e.burning && B.sets.includes('flame')) {
          let best = null, bd = BUILD_RULES.set.flame.r;
          for (const t of live()) { const d = Math.hypot(t.x - e.x, t.z - e.z) - (t.r || 0); if (d <= bd) { bd = d; best = t; } }
          if (best) burnOn(best, BUILD_RULES.set.flame.burn);
        }
      } else if (e.type === 'zoneClear') {
        if (has('shellw')) B.addShell(wick('shellw').shell, Infinity, 'shellw');
        if (B.sets.includes('ward')) B.addShell(BUILD_RULES.set.ward.shell, Infinity, 'ward');
      } else if (e.type === 'ability' && e.what === 'use' && e.slot >= 0 && B.sets.includes('gloam')) {
        // the Gloam set: each ability use cools the other by 1 s
        R.abilities?.coolBy(BUILD_RULES.set.gloam.cool, 1 - e.slot);
      }
    }
    // what this step added after the runner read its events (a Char burst's cue): logged here, as the runner logs its own
    for (const e of ev.slice(n0)) if (e.type === 'cue' && !e.logged) { const { type, logged, cue: name, ...more } = e; e.logged = true; R.log.push({ cue: name, step: clock.step, play: clock.play, ...more }); }
  };
  function countBomb(ev) {
    const s = R.fighter.body.s;
    let best = null, bd = wick('count').range;
    for (const t of live()) { const d = Math.hypot(t.x - s.x, t.z - s.z) - (t.r || 0); if (d <= bd) { bd = d; best = t; } }
    if (best && R.abilities?.freeBomb) R.abilities.freeBomb(best, wick('count').power, ev);
  }
  // what the HUD and the tests read
  B.view = () => ({ shell: B.total(), cap: B.capOf(), shells: B.shells.map(x => ({ n: x.n, from: x.from, left: Number.isFinite(x.left) ? +(x.left / 60).toFixed(2) : null })), sets: B.sets.slice(), colours: colourCount(R), haste: B.haste, cracked: run()?.cracked | 0, bonus: +B.bonus().toFixed(3) });
  return B;
}
// the HUD's pale band over the health bar: the shell's share of the max health (0 with no build)
export const shellShare = B => (B && B.shells.length ? Math.max(0, Math.min(1, B.total() / Math.max(1, maxOf(B.rs)))) : 0);
// the gear builder's hooks: the next blade hit sure, and a shell from a trait or an off-hand
export const markSure = (R, steps = Infinity) => R?.build?.markSure(steps);
export const addShell = (R, n, steps = Infinity, from = 'gear') => R?.build?.addShell(n, steps, from) ?? 0;
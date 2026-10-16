// Ahead of the Light: the HUD (final.md 15.2, 15.3, 6.2). Top left, your speed with its nines ("0.9916c", the newest
// 9 orange, big for a new best gear this run, grey for a moment when one is lost); top right, your place among the
// named ships and the next one's gap ("2ND" over "HOUND +0.8 S"); on leg 8, the landing's need. And the one caption
// line: bold capitals in karaoke chunks (light-years-home's core/captions.js: at most 3 words and 18 characters a
// chunk, the current word orange), through a priority queue: a higher caption replaces a lower one at once, a lower
// one never replaces a higher one in its first 0.6 s, and each waits only so long. captionsFor turns a frame's
// events and the leg's cues into captions, each the first time it matters.
import { chunk, timings, wordAt } from '../../light-years-home/core/captions.js';
import { beatsPerS } from '../core/ringmath.js';
import { GATE_NAMES } from '../core/chart.js';
import { CARD } from '../core/cards.js';
import { FACT } from '../core/route.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Caption priorities, high to low (15.3).
export const PRI = Object.freeze({ end: 10, gear: 9, gate: 8, glare: 7, light: 6, act: 5, nemesis: 4, meter: 3,
  teach: 2, bark: 1, fact: 0.5 });
const HOLD_AFTER = 0.8;          // s a caption stays after its last word
const GUARD = 0.6;               // s a higher caption is safe from a lower one

// ---------------------------------------------------------------- speed and place

// Speed as text with all its nines (lab B's speedText): { text: '0.9916c', nines }.
export function speedText(eta) {
  const b = Math.tanh(Math.max(0, finite(eta) ? eta : 0));
  const n = b > 0 ? Math.max(0, Math.floor(-Math.log10(1 - b) + 1e-9)) : 0;
  const dec = Math.max(4, n + 1);
  const v = Math.floor(b * 10 ** dec) / 10 ** dec;
  return { text: `${v.toFixed(dec)}c`, nines: n };
}

// The speed's HTML: the gear's newest 9 orange; `lost` (a gear just dropped) greys that digit.
export function speedHtml(eta, gear, lost = -1) {
  const { text } = speedText(eta);
  const hot = gear > 0 ? 1 + gear : -1, grey = lost > 0 ? 1 + lost : -1;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (i === hot && ch === '9') out += `<b>${ch}</b>`;
    else if (i === grey && i !== hot) out += `<i>${ch}</i>`;
    else out += ch;
  }
  return out;
}

export const ordinal = (n) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'TH' : ['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH';
  return `${n}${s}`;
};

// Your place among you and the named ships still flying, and the next named ship's gap in seconds ("HOUND +0.8 S":
// the one just ahead, or just behind when you lead). → { place, next } or null with no named ships.
export function placeOf(race, tune) {
  if (!race) return null;
  const you = race.ships[0];
  const named = race.ships.filter((s) => s !== you && (s.kind === 'regular' || s.kind === 'boss')
    && !s.caught && !s.wrecked);
  if (!named.length) return null;
  const bps = Math.max(1e-6, beatsPerS(you.eta, tune, you.lightspeed));
  let place = 1, ahead = null, behind = null;
  for (const s of named) {
    const g = (s.dist - you.dist) / bps;
    if (g > 0) { place++; if (!ahead || g < ahead.g) ahead = { s, g }; }
    else if (!behind || g > behind.g) behind = { s, g };
  }
  const n = ahead || behind;
  const g = Math.round(n.g * 10) / 10;
  return { place, next: `${n.s.name || String(n.s.id).toUpperCase()} ${g >= 0 ? '+' : '−'}${Math.abs(g).toFixed(1)} S` };
}

// ---------------------------------------------------------------- the HUD

export function createHud({ speed, place, land, captions, tune, slow = false } = {}) {
  const H = { cur: null, queue: [], time: 0, slow, last: { speed: '', place: '', land: '', cap: '' },
    lost: { gear: -1, until: 0 }, big: 0, gear: 0, counts: {} };

  // ---------- captions ----------
  // say(text, { pri, tag, wait (s it may wait to show), type (the event type it answers, for feedback) })
  function say(text, { pri = PRI.teach, tag = null, wait = 2.5, type = null, hold = HOLD_AFTER } = {}) {
    if (!text) return false;
    const item = { text: String(text).toUpperCase(), pri, tag, until: H.time + wait, type, hold };
    const cur = H.cur;
    if (!cur || pri > cur.pri || (pri >= cur.pri && H.time - cur.t0 >= GUARD)) { show(item); return true; }
    if (H.queue.some((q) => q.text === item.text)) return false;
    H.queue.push(item);
    if (H.queue.length > 6) H.queue.sort((a, b) => b.pri - a.pri).length = 6;
    return true;
  }
  function show(item) {
    const chunks = chunk(item.text);
    item.tm = timings(chunks, H.slow);
    item.chunks = chunks;
    item.t0 = H.time;
    item.end = item.tm.total + item.hold;
    H.cur = item;
    if (item.type) H.counts[item.type] = (H.counts[item.type] || 0) + 1;
    draw(true);
  }
  function draw(force = false) {
    const c = H.cur;
    let html = '';
    if (c) {
      const at = wordAt(c.tm, H.time - c.t0);
      const words = String(c.chunks[at.chunk] || '').split(/\s+/);
      const tag = c.tag ? `<span class="tag">${esc(c.tag)}</span>` : '';
      html = tag + words.map((w, i) => (i === at.word && !at.done ? `<span class="now">${esc(w)}</span>` : esc(w))).join(' ');
      const key = `${c.t0}|${at.chunk}|${at.done ? -1 : at.word}`;
      if (!force && key === H.last.cap) return;
      H.last.cap = key;
    } else {
      if (!force && H.last.cap === '') return;
      H.last.cap = '';
    }
    if (captions) {
      captions.innerHTML = html;
      captions.classList.toggle('on', Boolean(c));
    }
  }
  function frame(dt) {
    H.time += Math.max(0, dt || 0);
    const c = H.cur;
    if (c && H.time - c.t0 >= c.end) {
      H.cur = null;
      H.queue = H.queue.filter((q) => q.until >= H.time);
      if (H.queue.length) {
        let k = 0;
        for (let i = 1; i < H.queue.length; i++) if (H.queue[i].pri > H.queue[k].pri) k = i;
        show(H.queue.splice(k, 1)[0]);
        return;
      }
    }
    draw();
    if (speed && H.big && H.time > H.big) { speed.classList.remove('big'); H.big = 0; }
  }
  function clearCaptions() { H.cur = null; H.queue = []; draw(true); }

  // ---------- speed, place, the landing's need ----------
  function update(race, { landText = null } = {}) {
    if (!race) return;
    const you = race.ships[0];
    if (you.gear < H.gear) { H.lost = { gear: H.gear, until: H.time + 0.8 }; }
    H.gear = you.gear;
    const lost = H.time < H.lost.until ? H.lost.gear : -1;
    const s = speedHtml(you.eta, you.gear, lost);
    if (speed && s !== H.last.speed) { speed.innerHTML = s; H.last.speed = s; }
    const p = placeOf(race, tune);
    const ph = p ? `${ordinal(p.place)}<small>${esc(p.next)}</small>` : '';
    if (place && ph !== H.last.place) { place.innerHTML = ph; H.last.place = ph; }
    const lt = landText || '';
    if (land && lt !== H.last.land) { land.textContent = lt; land.hidden = !lt; H.last.land = lt; }
  }
  // a new best gear this run: big digits for 0.9 s
  function bigGear() {
    if (!speed) return;
    speed.classList.remove('big');
    void speed.offsetWidth;
    speed.classList.add('big');
    H.big = H.time + 0.9;
    H.counts.gearUp = (H.counts.gearUp || 0) + 1;
  }
  function reset() {
    clearCaptions();
    H.gear = 0; H.lost = { gear: -1, until: 0 };
    H.last.speed = ''; H.last.place = ''; H.last.land = '';
    if (land) { land.textContent = ''; land.hidden = true; }
  }

  return {
    say, frame, update, reset, clearCaptions, bigGear,
    setSlow(v) { H.slow = Boolean(v); },
    get caption() { return H.cur ? { text: H.cur.text, pri: H.cur.pri, tag: H.cur.tag } : null; },
    counts: () => ({ ...H.counts }),
    state: H,
  };
}

// ---------------------------------------------------------------- what to say

// The run's teaching and first-time memory (one object a run; leg holds the per-leg flags).
export function createCaptionMemory() { return { run: {}, leg: {}, cuesSeen: new Set(), fires: 0 }; }
export function newLegMemory(mem) { mem.leg = {}; mem.cuesSeen = new Set(); mem.fires = 0; }

// Words for the leg's cues (11.5; WP8's list). first: only the first time in a run.
const CUES = {
  highway: { text: 'HIGHWAY' }, wallRide: { text: 'WALL RIDE' }, jet: { text: 'RIDE THE JET' },
  jetEnd: { text: 'THE KNOTS LOOK FASTER THAN LIGHT', first: true },
  crowd: { text: 'KEEP OUT OF THE CROWDED CENTRE' }, dust: { text: 'IN THE DUST, TRUST THE TICKS' },
  oberth: { text: 'BURN AT THE BOTTOM · OBERTH × 2' }, voyagers: { text: 'THE VOYAGERS SWUNG ROUND JUPITER' },
  land: { text: 'LAND BEFORE THE LIGHT', pri: PRI.gate }, beltRun: { text: 'BELT RUN' },
  trapezium: { text: 'TRAPEZIUM' }, void: { text: 'NO GAS · NO DRAG · BURN IT ALL', pri: PRI.act },
};

// The captions a frame's events (and the cues you crossed) call for. ctx: { race, mem, runs (finished runs before
// this one), desk, button, barks, toy, fires (cardFires(race)), prevDist }. Returns [{ text, pri, tag, wait, type }].
export function captionsFor(events, ctx) {
  const { race, mem } = ctx;
  if (!race) return [];
  const out = [];
  const you = race.ships[0];
  const first = ctx.runs === 0, teach = ctx.runs < 3;
  const once = (scope, key) => { if (mem[scope][key]) return false; mem[scope][key] = true; return true; };
  const add = (text, pri, type, extra = {}) => out.push({ text, pri, type, ...extra });
  const nameOf = (id) => {
    const s = race.ships.find((x) => x.id === id);
    return s && s.name ? s.name : String(id || '').toUpperCase();
  };
  const gate = GATE_NAMES[race.legNo] || 'THE LANDMARK';

  // the cues you crossed this frame
  if (!ctx.toy) {
    for (const it of race.leg.items) {
      if (it.kind !== 'cue' || mem.cuesSeen.has(it.id)) continue;
      if (it.beat > you.dist) continue;
      mem.cuesSeen.add(it.id);
      if (it.beat < (ctx.prevDist ?? 0) - 2) continue;              // a leg resumed past it
      const n = it.name, d = it.data || {};
      if (n === 'steer' && first && once('run', 'steer')) add(ctx.desk ? '← → TO STEER' : 'DRAG TO STEER', PRI.teach, 'cue');
      else if (n === 'burn' && first && once('run', 'burn')) {
        add(ctx.desk ? 'THE LIGHT IS GAINING · ↑ TO BURN' : 'THE LIGHT IS GAINING · FLICK UP TO BURN', PRI.teach, 'cue');
      } else if (n === 'ram' && first && once('run', 'ram')) add('RAM IT INTO THE KNOT', PRI.teach, 'cue');
      else if (n === 'gateCall' && teach) add('THREAD OR DOCK', PRI.gate, 'cue');
      else if (CUES[n] && (!CUES[n].first || once('run', `cue:${n}`))) add(CUES[n].text, CUES[n].pri || PRI.teach, 'cue');
      else if (n === 'fact' && FACT[d.fact] && once('run', `fact:${d.fact}`)) add(FACT[d.fact].text, PRI.fact, 'cue', { wait: 1.0 });
    }
  }

  for (const e of events) {
    const mine = e.ship === you.id;
    switch (e.type) {
      case 'caught': if (mine) add('CAUGHT', PRI.end, e.type); break;
      case 'wreck': if (mine) add('WRECKED', PRI.end, e.type); break;
      case 'land': if (mine) add(e.ok ? 'HOME' : 'CAUGHT ON THE DOORSTEP', PRI.end, e.type); break;
      case 'lightspeed': if (mine) add('LIGHT SPEED', PRI.gear, e.type); break;
      case 'headlight': if (mine && e.full) add('HEADLIGHT', PRI.gear, e.type); break;
      case 'thread':
        if (mine && !e.miss && !e.pair) add(`${gate} HOLDS THE LIGHT BACK`, PRI.gate, e.type);
        break;
      case 'glareIn':
        if (mine && (e.first || once('leg', 'glare'))) {
          mem.leg.glare = true;
          add(first ? 'IN THE GLARE · ONE HIT AND IT HAS YOU' : 'IN THE GLARE', PRI.glare, e.type);
        }
        break;
      case 'eaten': if (e.caption && e.line) add(e.line, PRI.light, e.type); break;
      case 'scorch': if (mine) add('SCORCHED', PRI.act, e.type); break;
      case 'takedown':
        if (e.by === you.id) add(e.trapped ? 'TRAPPED' : 'TAKEDOWN', PRI.act, e.type);
        break;
      case 'nemesis': add(`${nameOf(e.id || e.ship)} IS YOUR NEMESIS`, PRI.nemesis, e.type); break;
      case 'shieldPop': if (mine && once('leg', 'shield')) add('SHIELD DOWN', PRI.meter, e.type); break;
      case 'lastHull': if (mine && once('run', 'lastHull')) add('LAST HULL', PRI.meter, e.type); break;
      case 'redIn':
        if (mine && once('run', 'red')) {
          add(you.shield >= 1 ? 'THE RED ZONE COSTS YOUR SHIELD' : 'THE RED ZONE COSTS HULL', PRI.meter, e.type);
        }
        break;
      case 'graze': case 'hair':
        if (mine && first && !ctx.toy && once('run', 'skim')) add('SKIM FOR SPEED', PRI.teach, e.type);
        break;
      case 'push':
        if (mine && first && !ctx.toy && mem.run.skim && race.t > 4 && once('run', 'holdLight')) {
          add('SKIM TO HOLD THE LIGHT BACK', PRI.teach, e.type);
        }
        break;
      case 'window':
        if (mine && teach && !ctx.toy && once('run', 'press')) {
          add(ctx.desk ? 'SPACE AS IT PASSES' : ctx.button ? 'TAP THE BUTTON AS IT PASSES' : 'PRESS AS IT PASSES',
            PRI.teach, e.type);
        }
        break;
      case 'grab': if (mine && first && !ctx.toy && once('run', 'hold')) add('HOLD', PRI.teach, e.type); break;
      case 'wake': if (mine && first && !ctx.toy && once('run', 'tuck')) add('TUCK IN BEHIND', PRI.teach, e.type); break;
      case 'draftFull': if (mine && first && !ctx.toy && once('run', 'pull')) add('PULL OUT', PRI.teach, e.type); break;
      case 'slingshot': if (mine && teach && !ctx.toy && once('run', 'sling')) add('SLINGSHOT', PRI.teach, e.type); break;
      case 'drafted':
        if (mine && teach && once('run', 'drafted')) add(`${nameOf(e.by)} IS DRAFTING YOU · WEAVE`, PRI.teach, e.type);
        break;
      case 'bark':
        if (ctx.barks !== false && e.text) {
          add(e.text, PRI.bark, e.type, { tag: `${e.name || nameOf(e.ship)} ·`, wait: 1.0 });
        }
        break;
      default:
    }
  }
  // a fusion's or legendary's first trigger this run takes the caption slot
  const fires = ctx.fires || [];
  for (let i = mem.fires; i < fires.length; i++) {
    const c = CARD[fires[i].id];
    if (c && (c.kind === 'fusion' || c.kind === 'legend') && once('run', `fire:${c.id}`)) add(c.name, PRI.act, 'cardFire');
  }
  mem.fires = fires.length;
  // the first run: the light, named early in leg 1
  if (first && !ctx.toy && race.legNo === 0 && race.t > 2.5 && once('run', 'burst')) {
    add('A GAMMA-RAY BURST IS BEHIND YOU', PRI.teach, 'light');
  }
  return out;
}


const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;
const laneX = lane => 72 + lane * 138;
const fmt = n => Math.round(n).toLocaleString('en-US');
// The sea in perspective. A point d beats ahead of the ship has scale s (1 at the ship) and height y on screen.
const HORIZON = 150, SHIP_Y = 321, DEPTH = 4, PANEL = 383;
const proj = d => { const s = DEPTH / (DEPTH + Math.max(d, -DEPTH * .7)); return { s, y: HORIZON + (SHIP_Y - HORIZON) * s }; };
const wide = (x, s) => 210 + (x - 210) * s;
const M_PER_BEAT = 8, SAIL = 1.6;
export default function createGame(api) {
  const random = api.rng || Math.random;
  const best = Number(api.best) || 0;
  const organs = [
    { id: 'left', name: 'LEFT FIN', x: 73, y: 554, color: '#9de7e8', key: 'ArrowLeft' },
    { id: 'right', name: 'RIGHT FIN', x: 347, y: 554, color: '#9de7e8', key: 'ArrowRight' },
    { id: 'shield', name: 'SHIELD', x: 128, y: 447, color: '#c1b6ff', key: 'ArrowUp' },
    { id: 'sail', name: 'SAIL', x: 292, y: 447, color: '#ffcaa4', key: 'ArrowDown' },
  ];
  const heart = { x: 210, y: 566 };
  // The voyage is made of short patterns on beat lines, from the seed only, so one seed always gives one sea.
  const hazards = [], lanterns = [];
  let made = 8;
  const add = (b, type, lanes) => { for (const lane of lanes) hazards.push({ beat: b, type, lane, done: false, hit: false, calm: false, warnAt: -1, at: -1 }); };
  const light = (b, lane) => lanterns.push({ beat: b, lane, done: false, got: false });
  const others = l => [0, 1, 2].filter(k => k !== l);
  function pattern() {
    const b = made, level = Math.floor(b / 32), rest = level >= 4 ? 1 : level >= 2 ? 2 : 3;
    const a = Math.floor(random() * 3), o = (a + 1 + Math.floor(random() * 2)) % 3, r = random() * (level >= 3 ? 1 : level >= 1 ? .74 : .48);
    if (r < .2) { add(b, 'reef', [a]); light(b, o); made += 2 + rest; } // one reef, and a light in another lane
    else if (r < .34) { add(b, 'storm', [1]); made += 2 + rest; } // a storm fills every lane: raise the shield
    else if (r < .48) { for (let k = 0; k < 3; k++) light(b + k, a); made += 3 + rest; } // a run of lights
    else if (r < .62) { add(b, 'reef', others(a)); light(b, a); made += 2 + rest; } // a reef pair: one lane is open
    else if (r < .74) { add(b, 'reef', [a]); add(b + 2, 'reef', [o]); made += 4 + rest; } // a zigzag
    else if (r < .86) { add(b, 'storm', [1]); add(b + 2, 'reef', [a]); made += 4 + rest; } // a storm, then a reef
    else { const e = random() < .5 ? 0 : 2; add(b, 'reef', others(e)); add(b + 2, 'reef', others(2 - e)); light(b + 2, 2 - e); made += 4 + rest; } // a gate: dash across two lanes
  }
  const motes = Array.from({ length: 26 }, () => ({ x: 20 + random() * 380, d: random() * 12, p: random() * TAU }));
  let t = 0, beat = 0, bpm = 75, metres = 0, score = 0, lane = 1, visualX = laneX(1), hp = 3, energy = 100, charge = 0, holding = false, selected = -1, done = false;
  let shieldB = 0, sailB = 0, shieldAt = -9, invulnerable = 0, collected = 0, pulses = 0, onBeats = 0, pulse = null, flash = 0, combo = 0, bestMult = 1, closes = 0, hits = 0;
  let lastStatus = '', hold = 0, check = 0, dawns = 0, prevDawn = 0, nextDawn = 400, dawnT = -1, healed = false, bump = 0, bumpDir = 0, endT = 0;
  let dubbed = true, beatFx = 0, lastPulse = null, closeBeat = -1, bestSaid = false, first = 0, firstLight = 0;
  let pointer = { ...heart };
  const glow = [0, 0, 0, 0], laneLeft = [-9, -9, -9], pops = [];
  const mult = () => Math.min(6, 1 + Math.floor(combo / 3));
  const beatLen = () => 60 / bpm;
  const say = (text, x, y, color = '#fff1c7', size = 16) => pops.push({ text, x, y, color, size, t: 0 });
  const tell = (s, secs = 0) => { api.status(s); lastStatus = s; hold = Math.max(hold, secs); };
  function report() {
    if (hold > 0) return;
    let next = null;
    for (let i = first; i < hazards.length && !next; i++) if (!hazards[i].done && !hazards[i].calm) next = hazards[i];
    const ahead = next ? next.beat - beat : 99;
    let s = `Dawn in ${fmt(Math.ceil(Math.max(0, nextDawn - metres) / 10) * 10)} m. Sail on the beat to go farther.`;
    if (t < 7) s = 'Hold the heart, drag to an organ, and let go when the ring meets the heart.';
    else if (next && ahead < 4.5) {
      const line = hazards.slice(first).filter(h => h.beat === next.beat && h.type === 'reef').map(h => h.lane);
      const name = l => ['left', 'centre', 'right'][l];
      s = next.type === 'storm' ? 'Storm ahead. Raise the SHIELD on the beat.' : line.length > 1 ? `Reefs ahead. Only the ${name([0, 1, 2].find(l => !line.includes(l)))} lane is open.` : `Reef ahead in the ${name(next.lane)} lane. Use a fin on the beat.`;
    }
    if (s !== lastStatus) { api.status(s); lastStatus = s; }
  }
  // A pulse on the beat lands at once and is strong. Off the beat it crawls down the vein and is weak.
  function activate(index, power) {
    const phase = beat % 1, off = Math.min(phase, 1 - phase) * beatLen(), onBeat = off <= Math.max(.07, Math.min(.13, beatLen() * .16));
    if (pulse && !pulse.arrived) arrive(pulse); // a pulse still in the vein lands first
    if (index < 2 && (index ? lane === 2 : lane === 0)) { edge(index); return; } // a fin at the edge costs nothing
    const cost = ((index < 2 ? 7 : 9) + power * 6) * (onBeat ? .6 : 1); // the beat makes a pulse cheaper
    if (energy < cost) { tell('The heart needs energy. Catch lights, or wait a moment.', 1); flash = .4; api.tone(150, .12, 'triangle', .05); return; }
    energy -= cost; pulses++;
    if (onBeat) { combo++; onBeats++; } else combo = 0;
    bestMult = Math.max(bestMult, mult());
    pulse = { index, power, onBeat, progress: onBeat ? 1 : 0, fx: .22, arrived: false };
    lastPulse = { onBeat, t, phase, organ: organs[index].id, power };
    const f = [260, 330, 390, 520][index];
    if (onBeat) { api.tone(f * 2, .14 + power * .08, 'sine', .1); api.tone(f * 3, .12, 'sine', .05, .03); arrive(pulse); }
    else api.tone(f, .1 + power * .08, 'triangle', .06);
  }
  function edge(index) {
    bump = .3; bumpDir = index ? 1 : -1; glow[index] = .6;
    api.tone(140, .08, 'square', .03); api.buzz(15);
    say('EDGE', visualX, SHIP_Y - 50, '#c9e7e8', 14);
  }
  function arrive(p) {
    p.arrived = true;
    const o = organs[p.index]; glow[p.index] = 1; api.burst(o.x, o.y, o.color, p.onBeat ? 16 : 6);
    if (p.index < 2) {
      const dir = p.index ? 1 : -1, steps = p.onBeat && p.power >= .45 ? 2 : 1, to = clamp(lane + dir * steps, 0, 2);
      if (to === lane) { edge(p.index); return; }
      for (let l = lane; l !== to; l += dir) laneLeft[l] = t;
      if (Math.abs(to - lane) === 2) { say('DASH', laneX(to), SHIP_Y - 54, '#c9fbff', 16); api.noise({ duration: .25, volume: .05, from: 3000, to: 900, type: 'bandpass', q: .8 }); }
      lane = to;
    }
    if (o.id === 'shield') { shieldB = p.onBeat ? 2.5 + p.power * 1.5 : .8; shieldAt = t; api.tone(494, .2, 'sine', .06); }
    if (o.id === 'sail') { sailB = p.onBeat ? 4 + p.power * 4 : 1.5; api.noise({ duration: .5, volume: .04, from: 600, to: 2400, type: 'bandpass', q: .6 }); }
  }
  function hurt(reason, kind) {
    hp--; hits++; invulnerable = 1; flash = .55; combo = 0;
    api.shake(5, .3); api.buzz(70); api.noise({ duration: .35, volume: .1, from: 700, to: 80 }); api.tone(88, .25, 'sawtooth', .05); api.burst(visualX, SHIP_Y, '#ff938d', 22);
    say(kind === 'reef' ? 'REEF HIT' : 'STORM HIT', visualX, SHIP_Y - 54, '#ffb3ad', 16);
    tell(reason, 1.5);
    if (hp <= 0) end();
  }
  // A line of hazards reaches the ship. A hit beats a near miss: one line gives one verdict.
  function resolve(i) {
    const b = hazards[i].beat, line = [];
    for (let j = i; j < hazards.length && hazards[j].beat === b; j++) { hazards[j].done = true; hazards[j].at = t; if (!hazards[j].calm) line.push(hazards[j]); }
    if (!line.length || done) return;
    const reefHit = line.find(h => h.type === 'reef' && h.lane === lane), storm = line.find(h => h.type === 'storm');
    if (storm && shieldB > 0) { storm.blocked = true; api.burst(visualX, SHIP_Y - 10, '#d8caff', 22); api.tone(660, .13, 'sine', .08); }
    const struck = reefHit || (storm && !storm.blocked ? storm : null);
    if (struck) { if (invulnerable <= 0) { struck.hit = true; hurt(struck.type === 'reef' ? 'A reef cracked the hull. Change lane with a fin on the beat.' : 'The storm struck. Raise the SHIELD on the beat just before it arrives.', struck.type); } return; }
    if (line.some(h => h.type === 'reef' && t - laneLeft[h.lane] < .4) || storm && t - shieldAt < .4) close(b);
  }
  function close(b) {
    if (closeBeat === b) return;
    closeBeat = b; closes++;
    api.slow(.3, .3); api.noise({ duration: .3, volume: .05, from: 2600, to: 600, type: 'bandpass', q: 1 }); api.buzz(20);
    say('CLOSE', visualX, SHIP_Y - 58, '#fff1c7', 18);
  }
  function dawn() {
    dawns++; dawnT = 0; prevDawn = nextDawn; nextDawn += 500 + 100 * dawns; healed = hp < 3; hp = Math.min(3, hp + 1);
    for (let i = first; i < hazards.length; i++) if (!hazards[i].done && hazards[i].beat < beat + 5) hazards[i].calm = true;
    api.slow(.4, 1.6); api.chord([220, 277, 330, 440, 554, 659], 2.4, 'sine', .14); api.buzz(40);
    tell(`Dawn ${dawns}. The sea is calm for a moment${healed ? ', and a heart comes back' : ''}. The beat gets faster from here.`, 3);
  }
  function end() {
    done = true; endT = 0; holding = false; charge = 0;
    api.chord([220, 185, 147], 1.4, 'triangle', .08);
    const ahead = Math.max(0, nextDawn - metres);
    api.metric(`${fmt(metres)} m · ×${bestMult} best · ${fmt(score)}`);
    api.finish({
      score: Math.round(score), unit: 'points', win: dawns > 0,
      title: dawns ? `${dawns} ${dawns === 1 ? 'dawn' : 'dawns'} at sea` : 'The heart needs another voyage',
      detail: `You sailed ${fmt(metres)} m with a best multiplier of ×${bestMult}, and caught ${collected} ${collected === 1 ? 'light' : 'lights'}. The next dawn was ${fmt(ahead)} m ahead.`,
    });
  }
  // A rising warning, 1 s before a line of hazards reaches the ship.
  function warn(line) {
    if (line.some(h => h.type === 'storm')) { api.noise({ duration: .8, volume: .06, from: 240, to: 1500, type: 'bandpass', q: 2 }); api.tone(330, .12, 'triangle', .07); api.tone(415, .12, 'triangle', .07, .12); api.tone(494, .16, 'triangle', .08, .24); }
    else { api.tone(523, .09, 'triangle', .06); api.tone(659, .09, 'triangle', .06, .1); api.tone(784, .12, 'triangle', .07, .2); }
  }

  const rounded = (ctx, x, y, w, h, r, fill, stroke) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
  const text = (ctx, str, x, y, size = 12, color = '#e7f4ed', weight = 500, align = 'center') => { ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.fillText(str, x, y); };
  const outlined = (ctx, str, x, y, size, color, weight = 750, align = 'center') => { ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,16,24,.6)'; ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y); };
  function path(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x, a.y - 75, b.x, b.y + 58, b.x, b.y); }
  function heartShape(ctx, x, y, size, color) {
    ctx.beginPath(); ctx.moveTo(x, y + size * 0.7); ctx.bezierCurveTo(x - size * 1.4, y - size * 0.1, x - size * 0.7, y - size * 1.1, x, y - size * 0.5); ctx.bezierCurveTo(x + size * 0.7, y - size * 1.1, x + size * 1.4, y - size * 0.1, x, y + size * 0.7); ctx.fillStyle = color; ctx.fill();
  }
  function drawShip(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((laneX(lane) - x) * 0.0018 + (done ? endT * .5 : 0));
    if (shieldB > 0) { ctx.beginPath(); ctx.ellipse(0, -2, 35 + Math.sin(t * 7) * 2, 45, 0, 0, TAU); ctx.fillStyle = 'rgba(176,171,255,.15)'; ctx.fill(); ctx.strokeStyle = '#dad4ff'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.arc(0, -2, 50, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, shieldB / 4)); ctx.strokeStyle = 'rgba(218,212,255,.6)'; ctx.lineWidth = 3; ctx.stroke(); }
    if (sailB > 0) { for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 7, 24); ctx.lineTo(-14 + i * 9, 45 + Math.sin(t * 10 + i) * 10); ctx.strokeStyle = '#ffc99a'; ctx.lineWidth = 2; ctx.stroke(); } }
    ctx.beginPath(); ctx.moveTo(0, -31); ctx.bezierCurveTo(-26, -10, -19, 23, 0, 31); ctx.bezierCurveTo(19, 23, 26, -10, 0, -31); ctx.fillStyle = '#4f8791'; ctx.fill(); ctx.strokeStyle = '#b7e3d7'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.quadraticCurveTo(-42, 10 + Math.sin(t * 6) * 5, -32, 22); ctx.lineTo(-8, 17); ctx.fillStyle = '#a1d3ca'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.quadraticCurveTo(42, 10 + Math.sin(t * 6) * 5, 32, 22); ctx.lineTo(8, 17); ctx.fill();
    const billow = sailB > 0 ? 12 : 0;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -33 - billow * .4); ctx.quadraticCurveTo(26 + billow, -13, 0, -2); ctx.fillStyle = sailB > 0 ? '#ffd9b0' : '#f2d4ae'; ctx.fill(); ctx.strokeStyle = '#ffe6c4'; ctx.lineWidth = 1; ctx.stroke();
    heartShape(ctx, 0, 9, 6 + beatFx * 2, '#ffaeab'); ctx.restore();
  }
  function reef(ctx, x, y, s, h) {
    const split = h.hit ? Math.min(1, (t - h.at) * 3) * 9 * s : 0;
    for (const side of h.hit ? [-1, 1] : [0]) {
      ctx.save(); ctx.translate(x + side * split, y + Math.abs(side) * split * .4); ctx.scale(s, s); if (side) ctx.rotate(side * .12 * split / 9);
      ctx.beginPath();
      if (side <= 0) { ctx.moveTo(-37, 15); ctx.lineTo(-24, -9); ctx.lineTo(-12, -2); ctx.lineTo(0, -31); }
      if (side >= 0) { if (side) ctx.moveTo(0, -31); ctx.lineTo(14, -9); ctx.lineTo(22, -16); ctx.lineTo(39, 16); }
      ctx.lineTo(0, 16); ctx.closePath();
      ctx.fillStyle = h.calm ? 'rgba(47,87,98,.4)' : '#2f5762'; ctx.fill(); ctx.strokeStyle = h.calm ? 'rgba(219,156,168,.35)' : h.hit ? '#ff9c9c' : '#db9ca8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath(); ctx.ellipse(x, y + 17 * s, 43 * s, 6 * s, 0, 0, TAU); ctx.strokeStyle = 'rgba(162,214,218,.7)'; ctx.lineWidth = 1; ctx.stroke();
  }
  function hazard(ctx, h) {
    const d = h.beat - beat; if (d > 11 || d < -1.4) return;
    const { s, y } = proj(d), fade = clamp((11 - d) / 2, 0, 1);
    ctx.globalAlpha = fade * (h.calm ? .5 : 1);
    if (h.type === 'reef') { reef(ctx, wide(laneX(h.lane), s), y, s, h); if (d > .6 && d < 6 && !h.calm) outlined(ctx, 'REEF', wide(laneX(h.lane), s), y + 34 * s + 8, 12, '#f0bdc0'); }
    else {
      const x0 = wide(16, s), x1 = wide(404, s);
      ctx.fillStyle = h.calm ? 'rgba(169,160,250,.05)' : `rgba(169,160,250,${.12 + (h.warnAt >= 0 ? .1 : 0)})`; ctx.fillRect(x0, y - 15 * s, x1 - x0, 31 * s);
      ctx.beginPath(); for (let x = x0; x <= x1 + 1; x += 12 * s) { const yy = y + Math.sin(x * 0.06 / s + t * 10) * 6 * s; if (x === x0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); }
      ctx.strokeStyle = h.blocked ? '#9fe6ff' : '#d8c9ff'; ctx.lineWidth = 2; ctx.stroke();
      if (d > .6 && !h.calm) outlined(ctx, 'STORM · SHIELD', 210, y - 22 * s - 4, 14, '#ece2ff');
    }
    ctx.globalAlpha = 1;
  }
  function draw(ctx) {
    ctx.save();
    const leg = clamp((metres - prevDawn) / (nextDawn - prevDawn), 0, 1);
    const dawnA = dawnT < 0 ? 0 : dawnT < 1.6 ? Math.min(1, dawnT / .3) : clamp(1 - (dawnT - 1.6) / 2.4, 0, 1);
    const bright = Math.max(leg * .6, dawnA);
    // Night lifts as you sail toward the next dawn.
    const bg = ctx.createLinearGradient(0, 80, 0, 390); bg.addColorStop(0, `rgba(11,35,54,${.3 - bright * .26})`); bg.addColorStop(1, `rgba(9,35,49,${.86 - bright * .36})`); ctx.fillStyle = bg; ctx.fillRect(0, 0, 420, 680);
    const sun = ctx.createRadialGradient(210, HORIZON, 4, 210, HORIZON, 280);
    sun.addColorStop(0, `rgba(255,216,160,${.12 + bright * .6})`); sun.addColorStop(.4, `rgba(255,170,140,${bright * .28})`); sun.addColorStop(1, 'rgba(255,170,140,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, 420, PANEL);
    if (dawnA > 0) {
      const sy = HORIZON + 14 - Math.min(1, dawnT / 1.6) * 30, disc = ctx.createRadialGradient(210, sy, 4, 210, sy, 60);
      disc.addColorStop(0, `rgba(255,250,228,${dawnA})`); disc.addColorStop(.35, `rgba(255,222,160,${.8 * dawnA})`); disc.addColorStop(1, 'rgba(255,200,150,0)');
      ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(210, sy, 60, 0, TAU); ctx.fill();
      ctx.save(); ctx.globalAlpha = .2 * dawnA; ctx.fillStyle = '#fff0cf';
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .3 + Math.sin(t * .5 + i) * .03; ctx.beginPath(); ctx.moveTo(210, sy); ctx.lineTo(210 + Math.cos(a - .04) * 520, sy + Math.sin(a - .04) * 520); ctx.lineTo(210 + Math.cos(a + .04) * 520, sy + Math.sin(a + .04) * 520); ctx.fill(); }
      ctx.restore();
      ctx.save(); ctx.globalAlpha = dawnA; ctx.shadowColor = 'rgba(120,60,40,.6)'; ctx.shadowBlur = 14; ctx.font = '400 40px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e2'; ctx.fillText(`Dawn ${dawns}`, 210, 112); ctx.restore();
      ctx.globalAlpha = dawnA; outlined(ctx, healed ? 'The sea is calm · a heart comes back' : 'The sea is calm', 210, 136, 14, '#fff0d6', 650); ctx.globalAlpha = 1;
    }
    // The sea: lanes run to the sun, and a line crosses them on every beat.
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 420, PANEL); ctx.clip();
    const far = proj(11), near = proj(-1.4);
    for (const x of [141, 279]) { ctx.beginPath(); ctx.moveTo(wide(x, far.s), far.y); ctx.lineTo(wide(x, near.s), near.y); ctx.strokeStyle = 'rgba(170,228,223,.16)'; ctx.setLineDash([3, 9]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); }
    const lines = new Set();
    for (let i = Math.max(0, first - 8); i < hazards.length; i++) if (!hazards[i].calm) lines.add(hazards[i].beat);
    for (let k = Math.ceil(beat - 1.3); k <= beat + 10; k++) {
      const d = k - beat, { s, y } = proj(d), busy = lines.has(k);
      ctx.globalAlpha = clamp((11 - d) / 3, 0, 1) * (busy ? .55 : .2) + (Math.abs(d) < .12 ? .3 : 0);
      ctx.beginPath(); ctx.moveTo(wide(18, s), y); ctx.lineTo(wide(402, s), y); ctx.strokeStyle = busy ? '#ffd7c8' : '#bfeee8'; ctx.lineWidth = 1; ctx.stroke();
    }
    for (const m of motes) { const d = ((m.d - beat) % 12 + 12) % 12 - 1.3, { s, y } = proj(d); ctx.globalAlpha = (.1 + Math.sin(t * 1.8 + m.p) * .07) * clamp((11 - d) / 3, 0, 1); ctx.beginPath(); ctx.ellipse(wide(m.x, s), y, 10 * s, 1.2 * s, 0, 0, TAU); ctx.fillStyle = bright > .4 ? '#ffe9c0' : '#b9ffff'; ctx.fill(); }
    ctx.globalAlpha = 1;
    if (bright > .25) { // the sun lays a path of light on the water
      const path = ctx.createLinearGradient(0, HORIZON, 0, PANEL); path.addColorStop(0, `rgba(255,226,170,${(bright - .25) * .55})`); path.addColorStop(1, 'rgba(255,226,170,0)');
      ctx.fillStyle = path; ctx.beginPath(); ctx.moveTo(203, HORIZON); ctx.lineTo(217, HORIZON); ctx.lineTo(300, PANEL); ctx.lineTo(120, PANEL); ctx.closePath(); ctx.fill();
    }
    const lightAt = l => { const d = l.beat - beat; if (d > 11 || d < -1.4 || l.got) return; const { s, y } = proj(d); ctx.globalAlpha = clamp((11 - d) / 2, 0, 1); const x = wide(laneX(l.lane), s); ctx.shadowBlur = 18 * s; ctx.shadowColor = '#ffedb1'; ctx.fillStyle = '#ffedb1'; ctx.beginPath(); ctx.ellipse(x, y - 12 * s + Math.sin(t * 4) * 3 * s, 5 * s + 1, 8 * s + 1, 0, 0, TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; };
    // far to near: what is ahead of the ship, then the ship, then what has just passed it
    for (let i = lanterns.length - 1; i >= firstLight; i--) if (lanterns[i].beat > beat) lightAt(lanterns[i]);
    for (let i = hazards.length - 1; i >= Math.max(0, first - 8); i--) if (hazards[i].beat > beat) hazard(ctx, hazards[i]);
    const bx = bump > 0 ? bumpDir * Math.sin((.3 - bump) / .3 * Math.PI) * 14 : 0;
    ctx.globalAlpha = done ? clamp(1 - endT * .9, 0, 1) : 1;
    if (invulnerable <= 0 || Math.floor(t * 12) % 2 === 0 || done) drawShip(ctx, visualX + bx, SHIP_Y + (done ? endT * 26 : 0));
    ctx.globalAlpha = 1;
    for (let i = Math.max(0, first - 8); i < hazards.length && hazards[i].beat <= beat; i++) hazard(ctx, hazards[i]);
    for (let i = Math.max(0, firstLight - 6); i < lanterns.length && lanterns[i].beat <= beat; i++) lightAt(lanterns[i]);
    ctx.restore();
    // Top: the score multiplier from beats in a row, and the way to the next dawn.
    rounded(ctx, 10, 10, 124, 54, 10, 'rgba(6,18,26,.55)');
    outlined(ctx, `×${mult()}`, 22, 46, 28, mult() > 1 ? '#ffe0b8' : '#d7e5df', 800, 'left');
    text(ctx, 'COMBO', 74, 30, 12, '#b8cbd0', 650, 'left');
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(80 + i * 13, 46, 4, 0, TAU); ctx.fillStyle = mult() >= 6 || i < combo % 3 ? '#ffd2a6' : 'rgba(255,210,166,.2)'; ctx.fill(); }
    rounded(ctx, 262, 10, 148, 54, 10, 'rgba(6,18,26,.55)');
    outlined(ctx, `DAWN IN ${fmt(Math.max(0, nextDawn - metres))} m`, 400, 32, 14, '#ffe6c4', 750, 'right');
    text(ctx, `${bpm} BPM`, 400, 53, 12, '#c9d9d5', 650, 'right');
    // The panel: a living ship.
    rounded(ctx, 22, PANEL, 376, 279, 28, 'rgba(9,27,41,.94)', '#65848b');
    const hint = !holding ? 'DRAG TO AN ORGAN · LET GO ON THE BEAT' : selected < 0 ? 'DRAG OUT · LET GO HERE TO CANCEL' : `LET GO ON THE BEAT · ${organs[selected].name}`;
    text(ctx, hint, 210, PANEL + 25, 14, '#d7e5df', 700);
    for (let i = 0; i < organs.length; i++) {
      const o = organs[i]; path(ctx, heart, o); ctx.strokeStyle = '#284f60'; ctx.lineWidth = 10; ctx.stroke(); path(ctx, heart, o); ctx.strokeStyle = holding && selected === i ? o.color : '#638792'; ctx.lineWidth = holding && selected === i ? 3 : 1; ctx.stroke();
    }
    if (holding) { ctx.beginPath(); ctx.moveTo(heart.x, heart.y); ctx.lineTo(pointer.x, pointer.y); ctx.strokeStyle = 'rgba(255,226,190,.35)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]); }
    if (pulse) {
      const o = organs[pulse.index];
      if (pulse.onBeat || pulse.arrived) { ctx.globalAlpha = clamp(pulse.fx / .22, 0, 1); path(ctx, heart, o); ctx.strokeStyle = o.color; ctx.lineWidth = pulse.onBeat ? 6 : 3; ctx.shadowColor = o.color; ctx.shadowBlur = 16; ctx.stroke(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
      else {
        const u = pulse.progress, v = 1 - u;
        const x = v ** 3 * heart.x + 3 * v * v * u * heart.x + 3 * v * u * u * o.x + u ** 3 * o.x;
        const y = v ** 3 * heart.y + 3 * v * v * u * (heart.y - 75) + 3 * v * u * u * (o.y + 58) + u ** 3 * o.y;
        ctx.shadowColor = o.color; ctx.shadowBlur = 12; ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(x, y, 4 + pulse.power * 3, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
      }
    }
    for (let i = 0; i < organs.length; i++) {
      const o = organs[i], active = holding && selected === i;
      ctx.beginPath(); ctx.ellipse(o.x, o.y, 31 + glow[i] * 4, 29 + glow[i] * 4, i < 2 ? (i === 0 ? -0.35 : 0.35) : 0, 0, TAU); ctx.fillStyle = active ? '#385563' : '#1b3e50'; ctx.fill(); ctx.strokeStyle = o.color; ctx.globalAlpha = active || glow[i] > 0 ? 1 : 0.55; ctx.lineWidth = active ? 2.5 : 1.2; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = o.color; ctx.lineWidth = 2; ctx.beginPath();
      if (i < 2) { const dir = i === 0 ? -1 : 1; ctx.moveTo(o.x - dir * 9, o.y - 9); ctx.lineTo(o.x + dir * 8, o.y); ctx.lineTo(o.x - dir * 9, o.y + 9); ctx.stroke(); }
      else if (i === 2) { ctx.moveTo(o.x, o.y - 13); ctx.lineTo(o.x - 12, o.y - 7); ctx.quadraticCurveTo(o.x - 11, o.y + 8, o.x, o.y + 15); ctx.quadraticCurveTo(o.x + 11, o.y + 8, o.x + 12, o.y - 7); ctx.closePath(); ctx.stroke(); }
      else { ctx.moveTo(o.x - 9, o.y + 13); ctx.lineTo(o.x - 9, o.y - 15); ctx.lineTo(o.x + 13, o.y + 6); ctx.lineTo(o.x - 9, o.y + 6); ctx.stroke(); }
      text(ctx, o.name, o.x, o.y + 46, 12, o.color, 750);
    }
    let chip = 0; // what the last pulses still do, between the two boxes at the top
    if (shieldB > 0) { rounded(ctx, 142, 12, 112, 22, 8, 'rgba(40,34,80,.72)'); text(ctx, `SHIELD ${(shieldB * beatLen()).toFixed(1)} s`, 198, 28, 12, '#e4d9ff', 750); chip++; }
    if (sailB > 0) { rounded(ctx, 142, 12 + chip * 27, 112, 22, 8, 'rgba(74,46,30,.72)'); text(ctx, `SAIL ×${SAIL} m`, 198, 28 + chip * 27, 12, '#ffd3ad', 750); }
    // The heart beats, and a ring closes on it: let go when the ring meets the heart.
    const phase = beat % 1, radius = 32 + beatFx * 4 + charge * 5;
    ctx.beginPath(); ctx.arc(heart.x, heart.y, radius + 7, 0, TAU); ctx.fillStyle = `rgba(255,164,167,${.08 + beatFx * .2})`; ctx.fill();
    if (!done) { const ring = radius + 4 + (1 - phase) * 42; ctx.beginPath(); ctx.arc(heart.x, heart.y, ring, 0, TAU); ctx.strokeStyle = `rgba(255,214,200,${.25 + (1 - Math.min(phase, 1 - phase) * 2) * .55})`; ctx.lineWidth = 2 + (phase > .8 ? 1.5 : 0); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(heart.x, heart.y, radius, 0, TAU); ctx.fillStyle = '#5d3b53'; ctx.fill(); ctx.strokeStyle = '#f6b2b7'; ctx.lineWidth = 1.5; ctx.stroke();
    heartShape(ctx, heart.x, heart.y, 22 + beatFx * 4, '#ffc6ba');
    if (holding) { ctx.beginPath(); ctx.arc(heart.x, heart.y, radius + 8, -Math.PI / 2, -Math.PI / 2 + TAU * charge); ctx.strokeStyle = charge >= .45 ? '#ffe2be' : '#d9b9a6'; ctx.lineWidth = 4; ctx.stroke(); }
    const recent = lastPulse && t - lastPulse.t < .7;
    text(ctx, holding ? (charge >= .45 ? 'CHARGED' : `${Math.round(charge * 100)}%`) : recent ? (lastPulse.onBeat ? 'ON THE BEAT' : 'OFF THE BEAT') : 'PULSE', 210, 622, 14, holding && charge >= .45 || recent && lastPulse.onBeat ? '#ffe5c1' : recent ? '#b9a3b0' : '#d8cbd6', 750);
    rounded(ctx, 34, 637, 250, 5, 2, '#243d49'); rounded(ctx, 34, 637, 250 * energy / 100, 5, 2, '#d8a2a4');
    text(ctx, 'ENERGY', 34, 655, 12, '#b8cbd0', 650, 'left');
    for (let i = 0; i < 3; i++) heartShape(ctx, 321 + i * 24, 640, 7, i < hp ? '#ffb9b0' : '#425561');
    for (const p of pops) { ctx.globalAlpha = clamp(1.2 - p.t, 0, 1); outlined(ctx, p.text, p.x, p.y - p.t * 24, p.size, p.color); }
    ctx.globalAlpha = 1;
    if (flash > 0) { ctx.fillStyle = `rgba(255,135,126,${flash * 0.18})`; ctx.fillRect(0, 0, 420, 680); }
    if (done) { ctx.globalAlpha = clamp(endT * 1.5, 0, 1); outlined(ctx, `THE NEXT DAWN WAS ${fmt(Math.max(0, nextDawn - metres))} m AHEAD`, 210, 96, 15, '#ffe6c4', 750); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  report();
  return {
    update(dt) {
      t += dt;
      if (done) endT += dt;
      const prev = beat;
      beat += dt * bpm / 60 * (done ? Math.max(.2, 1 - endT * .8) : 1);
      if (!done) {
        const dm = (beat - prev) * M_PER_BEAT * (sailB > 0 ? SAIL : 1);
        metres += dm; score += dm * mult();
        const tempo = Math.min(130, 75 + 5 * Math.floor(metres / 150)); // the tempo rises every 150 m
        if (tempo !== bpm) { bpm = tempo; say('TEMPO UP', 336, 96, '#ffe6c4', 14); api.tone(440, .08, 'triangle', .05); api.tone(554, .1, 'triangle', .05, .08); }
        if (best > 0 && score > best && !bestSaid) { bestSaid = true; say('NEW BEST', 210, 200, '#ffe7a8', 18); api.tone(784, .2, 'sine', .08); api.tone(1047, .3, 'sine', .08, .12); }
      }
      // The heartbeat: lub on the beat, dub a moment later. Phone speakers can play both.
      if (Math.floor(beat) > Math.floor(prev)) { api.tone(110, .13, 'triangle', .15); api.tone(220, .06, 'sine', .05); api.noise({ duration: .08, volume: .05, from: 900, to: 120 }); beatFx = 1; dubbed = false; }
      if (!dubbed && beat % 1 >= .22) { dubbed = true; api.tone(165, .1, 'triangle', .11); beatFx = Math.max(beatFx, .6); }
      beatFx = Math.max(0, beatFx - dt * 5);
      while (made < beat + 14) pattern();
      visualX += (laneX(lane) - visualX) * Math.min(1, dt * 12);
      shieldB = Math.max(0, shieldB - (beat - prev)); sailB = Math.max(0, sailB - (beat - prev));
      invulnerable = Math.max(0, invulnerable - dt); flash = Math.max(0, flash - dt); hold = Math.max(0, hold - dt); bump = Math.max(0, bump - dt);
      if (dawnT >= 0 && (dawnT += dt) > 4.5) dawnT = -1;
      if (!done) energy = Math.min(100, energy + dt * 9);
      for (let i = 0; i < glow.length; i++) glow[i] = Math.max(0, glow[i] - dt * 1.8);
      if (holding) charge = Math.min(1, charge + dt / 1.05);
      if (pulse) { if (!pulse.arrived) { pulse.progress += dt / .42; if (pulse.progress >= 1) arrive(pulse); } else if ((pulse.fx -= dt) <= 0) pulse = null; }
      for (const p of pops) p.t += dt;
      while (pops.length && pops[0].t > 1.2) pops.shift();
      while (first < hazards.length && hazards[first].done) first++;
      while (firstLight < lanterns.length && lanterns[firstLight].done) firstLight++;
      for (let i = first; i < hazards.length && hazards[i].beat <= beat + 4; i++) {
        const h = hazards[i];
        if (h.done || h.calm || h.warnAt >= 0 || (h.beat - beat) * beatLen() > 1) continue;
        const line = [];
        for (let j = i; j < hazards.length && hazards[j].beat === h.beat; j++) if (!hazards[j].calm) { hazards[j].warnAt = t; line.push(hazards[j]); }
        if (!done) warn(line);
      }
      for (let i = first; i < hazards.length && hazards[i].beat <= beat; i++) if (!hazards[i].done) resolve(i);
      for (let i = firstLight; i < lanterns.length && lanterns[i].beat <= beat; i++) {
        const l = lanterns[i];
        if (l.done) continue;
        l.done = true;
        if (!done && l.lane === lane) { l.got = true; collected++; energy = Math.min(100, energy + 14); api.tone(780, .11, 'sine', .06); api.tone(1040, .12, 'sine', .05, .06); api.burst(visualX, SHIP_Y - 15, '#ffe5a3', 12); }
      }
      if (!done && metres >= nextDawn) dawn();
      if (!done && (check -= dt) <= 0) { check = .25; report(); api.metric(`${fmt(metres)} m · ×${mult()} · ${fmt(score)}`); }
    }, draw,
    pointer(type, p) {
      if (type === 'cancel') { holding = false; charge = 0; selected = -1; return; }
      if (done) return;
      // Within 44 px of the heart nothing is chosen, so letting go there cancels the pulse.
      const pick = q => Math.hypot(q.x - heart.x, q.y - heart.y) < 44 ? -1 : organs.reduce((b, o, i) => Math.hypot(q.x - o.x, q.y - o.y) < Math.hypot(q.x - organs[b].x, q.y - organs[b].y) ? i : b, 0);
      if (type === 'down' && p.y < PANEL) { say('THE HEART IS BELOW', 210, PANEL - 14, '#d7e5df', 14); api.tone(196, .05, 'sine', .03); }
      else if (type === 'down') { holding = true; charge = 0.08; pointer = p; selected = pick(p); api.tone(196, .05, 'sine', .04); }
      else if (type === 'move' && holding) { pointer = p; const s = pick(p); if (s !== selected) { selected = s; if (s >= 0) api.tone([260, 330, 390, 520][s], .04, 'sine', .03); } }
      else if (type === 'up' && holding) {
        pointer = p; selected = pick(p); holding = false;
        if (selected < 0) { api.tone(220, .08, 'sine', .04); api.tone(165, .1, 'sine', .03, .06); say('CANCELLED', heart.x, 520, '#d8cbd6', 14); }
        else activate(selected, charge);
        charge = 0;
      }
    },
    key(type, key) { const index = organs.findIndex(o => o.key === key); if (index < 0 || done) return; if (type === 'down' && !holding) { holding = true; charge = 0.08; selected = index; api.tone(196, .05, 'sine', .04); } else if (type === 'up' && holding && selected === index) { holding = false; activate(index, charge); charge = 0; } },
    getState: () => ({
      game: 'heartship', time: t, beat, phase: beat % 1, bpm, metres, distance: metres, score: Math.round(score), mult: mult(), combo, bestMult, lane, hp, energy,
      shield: shieldB * beatLen(), shieldBeats: shieldB, sail: sailB * beatLen(), sailBeats: sailB, holding, charge, selected: selected < 0 ? 'heart' : organs[selected].id,
      collected, pulses, onBeats, closes, hits, dawns, nextDawn, done, invulnerable, status: lastStatus, lastPulse: lastPulse && { ...lastPulse },
      hazards: hazards.map(h => ({ ...h })), lanterns: lanterns.map(l => ({ ...l })), organs: organs.map(o => ({ ...o })), heart, pulse: pulse ? { ...pulse } : null,
    }),
  };
}

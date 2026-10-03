const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const NOTES = [262, 294, 330, 392, 440, 523];
// A storm drifts at a steady speed and turns back at each end of its path.
const drift = a => Math.asin(Math.sin(a)) * 2 / Math.PI;
const fmt = n => Math.round(n).toLocaleString('en-US');

export default function createGame(api) {
  const { W = 420, H = 680 } = api;
  const random = api.rng || Math.random;
  const best = Number(api.best) || 0;
  // The flock flies at FLOCK_Y on screen. A finger at LOW gives the slowest climb, a finger at HIGH the fastest.
  const FLOCK_Y = 400, LOW = 636, HIGH = 486, LIFT = 52;
  const birds = Array.from({ length: 8 }, (_, i) => ({
    x: 184 + (i % 4) * 14, vx: 0, lane: (i % 4 - 1.5) * 13, weight: i < 5 ? 1 : 1.8, phase: random() * TAU,
    state: 'flock', t: 0, dy: i < 5 ? -6 : 16, spin: 0, knockAt: -1, by: -1, safe: 0,
  }));
  // The forest below the sky. It blooms at each dawn.
  const trees = Array.from({ length: 30 }, (_, i) => ({ x: i * 14.5 + random() * 8, h: 60 + random() * 90, bloom: random() * .6, pink: random() < .5 }));
  // The sky is made one set of six rings at a time, from the seed only, so one seed always gives one sky.
  const rings = [], storms = [];
  let topAlt = 0, topX = 210;
  function makeSet(s) {
    for (let i = 0; i < 6; i++) {
      const gap = s === 0 && i === 0 ? 240 : i === 0 ? 380 : 250 + random() * 70 - Math.min(30, s * 6);
      const swing = (random() < .5 ? -1 : 1) * (80 + random() * 110);
      let x = topX + swing; if (x < 95 || x > 325) x = topX - swing;
      x = clamp(x, 95, 325);
      const from = { alt: topAlt, x: topX }; topAlt += gap; topX = x;
      const still = s === 0 && i < 2;
      rings.push({ set: s, idx: i, alt: topAlt, cx: x, x, amp: still ? 0 : Math.min(50, 12 + s * 8 + random() * 12), om: TAU / (5 + random() * 3), ph: random() * TAU, hw: Math.max(56, 78 - s * 5), passed: false, hit: false, through: 0, points: 0, perfect: false });
      if (i === 0) continue; // no storm before the first ring, and a calm sky after each dawn
      const n = random() < (s - 1) * .25 ? 2 : 1; // two storms in a gap from the third set on
      for (let k = 0; k < n; k++) {
        const f = n === 1 ? .32 + random() * .14 : k ? .56 + random() * .08 : .24 + random() * .08;
        const amp = 70 + random() * 60, speed = (26 + random() * 24) * (1 + s * .12), ph = random() * TAU;
        storms.push({ alt: from.alt + gap * f, lx: from.x + (x - from.x) * f, amp, om: speed * Math.PI / (2 * amp), ph, r: s ? 22 + Math.min(12, s * 2) + random() * 4 : 18 + random() * 3, x: from.x + (x - from.x) * f + amp * drift(ph), warned: false, warnAt: -1 });
      }
    }
  }
  makeSet(0); makeSet(1);
  let time = 0, altitude = 0, targetX = 210, fingerY = 612, touch = false, held = false, lift = 0;
  let level = 0, dawns = 0, dawnT = -1, cameHome = false, score = 0, streak = 0, bestStreak = 0, sung = 0, knocked = 0, caught = 0, lost = 0;
  let ended = false, endT = 0, lastAlt = 0, lastTime = 0, lastKnock = -1, check = 0, bestSaid = false, hints = 0;
  const keys = new Set(), pops = [];
  const sy = a => FLOCK_Y - (a - altitude);
  const tell = s => api.status?.(s);
  const say = (text, x, alt, color = '#fff0c9', size = 16) => pops.push({ text, x: clamp(x, 60, W - 60), alt, color, size, t: 0 });
  const members = () => birds.filter(b => b.state === 'flock');
  const alive = () => birds.filter(b => b.state === 'flock' || b.state === 'tumble').length;
  const base = () => 46 + Math.min(20, level * 3);
  const inSet = () => rings.filter(g => g.set === level && g.passed).length;
  tell('Hold anywhere and slide to steer the flock. Raise your finger to climb faster.');
  api.metric?.('0 · 8 birds · dawn in 6');

  function update(dt) {
    dt = Math.min(dt, .04);
    time += dt;
    if (ended) endT += dt;
    if (dawnT >= 0 && (dawnT += dt) > 2.4) dawnT = -1;
    if (keys.has('l')) targetX = clamp(targetX - 260 * dt, 50, W - 50);
    if (keys.has('r')) targetX = clamp(targetX + 260 * dt, 50, W - 50);
    held = !ended && (touch || keys.size > 0);
    const want = !held ? 0 : touch ? clamp((LOW - fingerY) / (LOW - HIGH), 0, 1) : keys.has('u') ? 1 : keys.has('n') ? 0 : .4;
    lift += (want - lift) * Math.min(1, dt * 3);
    altitude += (base() + lift * LIFT) * (ended ? .55 : 1) * dt;
    const flock = members(), cx = flock.length ? flock.reduce((s, b) => s + b.x, 0) / flock.length : targetX;
    for (const b of birds) {
      if (b.state === 'flock' && !ended) {
        const wind = Math.sin(time * 1.05 + b.phase) * (held ? 5 : 13);
        const desired = clamp(targetX + b.lane + wind, 30, W - 30);
        b.vx += ((desired - b.x) * (held ? 12 : 3) / b.weight - b.vx * 6) * dt;
        b.x = clamp(b.x + b.vx * dt, 24, W - 24);
        b.dy += (Math.sin(time * 2.4 + b.phase) * 6 + (b.weight > 1 ? 16 : -6) - b.dy) * Math.min(1, dt * 6);
        b.safe = Math.max(0, b.safe - dt);
      } else if (b.state === 'flock') { b.x += b.vx * dt; b.dy -= dt * 30; } // at the end the choir scatters
      else if (b.state === 'tumble') {
        b.t += dt; b.spin += dt * 9; b.vx *= Math.exp(-2.4 * dt); b.x = clamp(b.x + b.vx * dt, 18, W - 18); b.dy += dt * 26;
        if (!ended && b.t > .3 && Math.abs(b.x - targetX) < 32 && Math.abs(b.x - cx) < 48) catchBird(b); // the wind and the flock reach it
        else if (b.t > 2) loseBird(b);
      } else { b.t += dt; b.dy += dt * 70; b.x += b.vx * dt; }
    }
    // Every storm darkens and rumbles when the flock comes near: at least 0.7 s before it can touch a bird.
    const reach = (base() + LIFT) * .7;
    for (const [i, s] of storms.entries()) {
      if (s.alt < altitude - 420) continue;
      if (s.alt > altitude + 760) break;
      s.x = s.lx + s.amp * drift(s.om * time + s.ph);
      if (!s.warned && altitude >= s.alt - s.r - 20 - reach) {
        s.warned = true; s.warnAt = time;
        api.noise?.({ duration: 1.1, volume: .05 + .05 * clamp(1 - Math.abs(s.x - cx) / 220, 0, 1), from: 340, to: 55, type: 'lowpass', q: 1.4 });
      }
      if (ended) continue;
      for (const b of birds) if (b.state === 'flock' && !b.safe) { const dx = b.x - s.x, da = altitude - b.dy - s.alt; if (dx * dx + da * da < (s.r + 7) ** 2) knock(b, i, dx); }
    }
    for (const g of rings) {
      if (g.alt > altitude + 760) break;
      if (g.alt < altitude - 500) continue;
      g.x = g.cx + g.amp * Math.sin(g.om * time + g.ph);
      if (!g.passed && !ended && altitude >= g.alt) pass(g);
    }
    if (!ended && alive() < 5) finishRun();
    for (const p of pops) p.t += dt;
    while (pops.length && pops[0].t > 1.6) pops.shift();
    if (!ended && best > 0 && score > best && !bestSaid) { bestSaid = true; say('NEW BEST', W / 2, altitude + 170, '#ffe7a8', 18); api.tone?.(784, .2, 'sine', .08); api.tone?.(1047, .3, 'sine', .08, .12); }
    if ((check -= dt) <= 0) { check = .25; api.metric?.(`${fmt(score)} · ${alive()} birds · dawn in ${6 - inSet()}`); }
  }
  function knock(b, i, dx) {
    b.state = 'tumble'; b.t = 0; b.spin = 0; b.knockAt = time; b.by = i; b.vx = Math.sign(dx || 1) * 95; knocked++;
    if (time - lastKnock > .25) { api.chord?.([98, 117, 147], .6, 'triangle', .1); api.buzz?.(40); api.shake?.(3, .2); }
    lastKnock = time; api.burst?.(b.x, FLOCK_Y + b.dy, '#c9b6ff', 10);
    if (!(hints & 1)) { hints |= 1; tell('A storm knocked a bird out. Move the wind to it within 2 seconds to catch it.'); }
  }
  function catchBird(b) {
    b.state = 'flock'; b.vx *= .3; b.safe = 1; caught++;
    api.burst?.(b.x, FLOCK_Y + b.dy, '#d8fff1', 12);
    const recent = pops.find(p => p.caught && p.t < .5); // birds caught together share one label and one sound
    if (recent) { recent.caught++; recent.text = `${recent.caught} CAUGHT`; return; }
    api.tone?.(784, .14, 'sine', .09); api.tone?.(1047, .2, 'sine', .08, .08);
    say('CAUGHT', b.x, altitude - b.dy + 26, '#d8fff1', 14); pops[pops.length - 1].caught = 1;
  }
  function loseBird(b) {
    b.state = 'lost'; b.t = 0; lost++;
    const recent = pops.find(p => p.lost && p.t < .5); // birds lost together share one label and one sound
    if (recent) { recent.lost++; recent.text = `${recent.lost} LOST`; return; }
    api.tone?.(330, .25, 'triangle', .06); api.tone?.(220, .45, 'triangle', .06, .14);
    say('LOST', b.x, altitude - b.dy + 20, '#e6a3b4', 14); pops[pops.length - 1].lost = 1;
  }
  function pass(g) {
    g.passed = true;
    const flock = members(), thru = flock.filter(b => Math.abs(b.x - g.x) < g.hw), y = sy(g.alt);
    g.through = thru.length; g.hit = thru.length >= 5;
    if (g.hit) {
      // Points: birds through × a centre bonus up to ×2 × a climb bonus up to ×2.
      const off = Math.abs(thru.reduce((s, b) => s + b.x, 0) / thru.length - g.x), rate = (g.alt - lastAlt) / Math.max(.2, time - lastTime);
      const centre = 1 + clamp(1 - off / 45, 0, 1), climb = 1 + clamp((rate - base()) / LIFT, 0, 1);
      g.points = Math.round(10 * thru.length * centre * climb); g.perfect = off <= 12; score += g.points; sung++;
      streak = g.perfect ? streak + 1 : 0; bestStreak = Math.max(bestStreak, streak);
      const n = NOTES[g.idx];
      if (g.perfect) api.chord?.([n, n * 1.25, n * 1.5, n * 2].slice(0, Math.min(4, streak)), .8, 'sine', .15); else api.tone?.(n, .35, 'sine', .13);
      api.burst?.(g.x, y, '#ffe5a1', g.perfect ? 30 : 18); api.buzz?.(g.perfect ? 25 : 12);
      say(`+${g.points}`, g.x, g.alt + 34, '#ffe7a8', 18);
      if (g.perfect) say(streak > 1 ? `PERFECT ×${streak}` : 'PERFECT', g.x, g.alt + 62, '#fff6d8', 16);
      if (g.idx < 5) tell(g.perfect ? 'You flew through the centre. Keep the streak for a bigger chord.' : `${thru.length} birds sang. Fly through the centre and climb fast for more points.`);
    } else {
      // A ring needs five birds. With fewer, it gives no points and the streak ends.
      streak = 0; g.points = 0;
      api.tone?.(155, .3, 'triangle', .07); api.tone?.(117, .5, 'triangle', .06, .14);
      say('MISSED', g.x, g.alt + 34, '#e6a3b4', 16);
      tell(thru.length ? `Only ${thru.length} ${thru.length === 1 ? 'bird' : 'birds'} passed. A ring needs five to sing.` : 'No bird passed the ring. A ring needs five to sing.');
    }
    lastAlt = g.alt; lastTime = time;
    if (g.idx === 5) dawn();
  }
  function dawn() {
    dawns++; level++; dawnT = 0; makeSet(level + 1);
    api.slow?.(.35, 2); api.chord?.(NOTES, 2.6, 'sine', .16); api.buzz?.(35);
    const back = birds.find(b => b.state === 'lost');
    cameHome = !!back;
    if (back) { back.state = 'flock'; back.x = clamp(targetX + (back.x < targetX ? -130 : 130), 30, W - 30); back.vx = 0; back.dy = 50; }
    tell(`Dawn ${dawns}. The forest blooms${back ? ', and a lost bird comes home' : ''}. The next sky is stormier.`);
  }
  function finishRun() {
    ended = true; endT = 0; touch = false; keys.clear();
    const left = 6 - inSet();
    rings.filter(g => g.hit).slice(-5).forEach((g, i) => api.tone?.(NOTES[g.idx], .6, 'sine', .07, .2 + i * .18));
    api.noise?.({ duration: 1.5, volume: .07, from: 420, to: 50 });
    for (const b of birds) if (b.state === 'flock') b.vx = (b.x < W / 2 ? -1 : 1) * (40 + Math.abs(b.lane) * 3);
    api.finish?.({
      score: Math.round(score), unit: 'points', win: dawns > 0,
      title: dawns ? `${dawns} ${dawns === 1 ? 'dawn' : 'dawns'} over the forest` : 'The storm scattered the choir',
      detail: `You sang ${sung} ${sung === 1 ? 'ring' : 'rings'}${bestStreak > 1 ? `, with ${bestStreak} perfect in a row` : ''}. The next dawn was ${left} ${left === 1 ? 'ring' : 'rings'} away.`,
    });
  }

  // The forest below the flock: a sun that rises behind two rows of trees, and blossoms that open with `open` (0 to 1).
  function forest(ctx, open, alpha) {
    ctx.save(); ctx.globalAlpha = alpha;
    const glow = ctx.createLinearGradient(0, H - 260, 0, H);
    glow.addColorStop(0, 'rgba(255,214,150,0)'); glow.addColorStop(1, `rgba(255,205,150,${.2 + open * .45})`);
    ctx.fillStyle = glow; ctx.fillRect(0, H - 260, W, 260);
    const sunY = H - 70 - open * 60, sun = ctx.createRadialGradient(W / 2, sunY, 10, W / 2, sunY, 150);
    sun.addColorStop(0, 'rgba(255,246,214,.95)'); sun.addColorStop(.25, 'rgba(255,214,150,.6)'); sun.addColorStop(1, 'rgba(255,190,150,0)');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(W / 2, sunY, 150, 0, TAU); ctx.fill();
    for (const [layer, color, tall] of [[0, '#2c4a4c', 1.17], [1, '#0c2629', 1]]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
      for (const f of trees) { const x = f.x + layer * 7, h = f.h * tall; ctx.lineTo(x - 11, H - h * .55); ctx.lineTo(x, H - h); ctx.lineTo(x + 11, H - h * .55); }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    }
    for (const [i, f] of trees.entries()) for (const k of [0, 1]) {
      const o = clamp(open * 1.7 - f.bloom - k * .3, 0, 1); if (o <= 0) continue;
      const x = f.x + (k ? 6 : 0), y = H - f.h * (k ? .5 : .8), r = 3 + o * 6;
      ctx.fillStyle = f.pink !== !!k ? '#ffc4d6' : '#ffe2a0';
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU + i; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * .7, y + Math.sin(a) * r * .7, r * .55, r * .35, a, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(x, y, 1.5 + o, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  function bird(ctx, b, i) {
    if (b.weight > 1) {
      const aura = ctx.createRadialGradient(0, 0, 1, 0, 0, 25);
      aura.addColorStop(0, 'rgba(255,222,141,.55)'); aura.addColorStop(1, 'rgba(255,200,70,0)');
      ctx.fillStyle = aura; ctx.fillRect(-25, -25, 50, 50);
      ctx.fillStyle = '#ffd17b'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 10, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff2bb'; ctx.beginPath(); ctx.ellipse(-1, -2, 3, 6, -.2, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#dcaa66'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.quadraticCurveTo(-8, 19, 0, 21); ctx.moveTo(4, 9); ctx.quadraticCurveTo(9, 16, 3, 21); ctx.stroke();
    } else {
      const wing = Math.sin(time * 7 + b.phase) * 6;
      ctx.fillStyle = i % 2 ? '#c4f8ef' : '#e3eefa';
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(-8, -10 - wing, -18, -4 - wing); ctx.quadraticCurveTo(-10, 7, 0, 5); ctx.quadraticCurveTo(11, 8, 18, -4 - wing); ctx.quadraticCurveTo(7, -9 - wing, 0, 4); ctx.fill();
      ctx.fillStyle = '#f7ffe8'; ctx.beginPath(); ctx.ellipse(0, 0, 3, 7, 0, 0, TAU); ctx.fill();
    }
  }
  function label(ctx, text, x, y, size = 12, color = '#e9f2f0', align = 'center', weight = 650) {
    ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,18,26,.55)'; ctx.strokeText(text, x, y); ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  function draw(ctx) {
    ctx.save();
    const gloom = Math.min(.24, level * .05), endA = ended ? clamp(endT / .8, 0, 1) : 0;
    const dawnA = dawnT < 0 ? 0 : dawnT < .7 ? Math.min(1, dawnT / .25) : clamp(1 - (dawnT - .7) / 1.7, 0, 1);
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, `rgba(7,26,45,${(.15 + gloom) * (1 - dawnA * .8)})`); shade.addColorStop(1, `rgba(8,27,35,${(.58 + gloom) * (1 - dawnA * .6)})`);
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    if (dawnA > 0) {
      const sun = ctx.createRadialGradient(W / 2, H + 60, 20, W / 2, H + 60, 720);
      sun.addColorStop(0, `rgba(255,222,160,${.75 * dawnA})`); sun.addColorStop(.45, `rgba(250,176,156,${.32 * dawnA})`); sun.addColorStop(1, 'rgba(250,170,150,0)');
      ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = .22 * dawnA; ctx.fillStyle = '#ffe9bf';
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .21 + Math.sin(time * .6 + i) * .03; ctx.beginPath(); ctx.moveTo(W / 2, H + 40); ctx.lineTo(W / 2 + Math.cos(a - .035) * 900, H + 40 + Math.sin(a - .035) * 900); ctx.lineTo(W / 2 + Math.cos(a + .035) * 900, H + 40 + Math.sin(a + .035) * 900); ctx.fill(); }
      ctx.restore();
    }
    // Wind threads stay behind the flock so the wind direction is easy to read.
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const y = ((i * 59 + altitude * .7) % (H + 80)) - 40;
      const x = (i * 83 % W) + Math.sin(time + i) * 18;
      ctx.strokeStyle = `rgba(174,226,237,${held ? .24 : .1})`;
      ctx.beginPath(); ctx.moveTo(x, y + 48);
      ctx.quadraticCurveTo(x + (targetX - 210) * .12, y + 24, x + (targetX - 210) * .24, y);
      ctx.stroke();
    }
    const open = ended ? inSet() / 6 : clamp(dawnT / .7, 0, 1);
    if (dawnA > 0 || endA > 0) forest(ctx, open, Math.max(dawnA, endA * .9));
    if (dawnA > 0) {
      for (let i = 0; i < 18; i++) { const px = (i * 61 + 17) % W + Math.sin(time * 2 + i) * 12, py = H - 40 - (dawnT * (90 + i * 9) + i * 17) % 420; ctx.globalAlpha = dawnA * .8; ctx.fillStyle = i % 2 ? '#ffc4d6' : '#ffe9b0'; ctx.beginPath(); ctx.ellipse(px, py, 4, 2.4, time * 2 + i, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    // Storms: the dark core is the part that knocks birds out. It darkens and flashes as the flock comes near.
    const reach = (base() + LIFT) * .7;
    for (const s of storms) {
      const y = sy(s.alt);
      if (y > H + 90) continue;
      if (y < -90) break;
      const near = !s.warned || s.alt + s.r < altitude - 30 ? 0 : .5 + .5 * clamp(1 - (s.alt - s.r - 20 - altitude) / reach, 0, 1);
      const glow = ctx.createRadialGradient(s.x, y, s.r * .5, s.x, y, s.r * 2.4);
      glow.addColorStop(0, `rgba(${90 - 50 * near},${80 - 50 * near},${150 - 70 * near},${.45 + .3 * near})`); glow.addColorStop(1, 'rgba(40,40,90,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(s.x, y, s.r * 2.4, 0, TAU); ctx.fill();
      // Cloud puffs roll around the core. They are only cloud: the core inside the bright rim is the part that hits.
      ctx.fillStyle = `rgba(${34 - 20 * near},${30 - 18 * near},${62 - 34 * near},${.5 + .35 * near})`;
      for (let j = 0; j < 7; j++) { const a = j / 7 * TAU + time * .4 + s.ph; ctx.beginPath(); ctx.arc(s.x + Math.cos(a) * s.r * .95, y + Math.sin(a) * s.r * .6, s.r * (.55 + .12 * Math.sin(time * 1.3 + j)), 0, TAU); ctx.fill(); }
      ctx.fillStyle = `rgba(${48 - 30 * near},${40 - 28 * near},${92 - 52 * near},${.75 + .2 * near})`; ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, TAU); ctx.fill();
      for (let j = 0; j < 4; j++) {
        ctx.strokeStyle = `rgba(${191 + 40 * near},${161 + 40 * near},236,${.6 - j * .1})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(s.x, y, s.r * (.3 + j * .2), s.r * (.2 + j * .15), time * .3 + j * .5, .3 + time * (1 + s.om), 4.8 + time * (1 + s.om)); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(222,206,255,${.4 + .5 * near})`; ctx.lineWidth = 1.5 + near; ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, TAU); ctx.stroke();
      if (near > .5 && Math.sin(time * 17 + s.ph * 5) > .7) {
        const flash = ctx.createRadialGradient(s.x, y, 2, s.x, y, s.r * 1.6);
        flash.addColorStop(0, 'rgba(240,232,255,.5)'); flash.addColorStop(1, 'rgba(240,232,255,0)');
        ctx.fillStyle = flash; ctx.beginPath(); ctx.arc(s.x, y, s.r * 1.6, 0, TAU); ctx.fill();
        const k = Math.sin(s.ph * 9 + Math.floor(time * 6)) * .3;
        ctx.strokeStyle = '#fbf6ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(s.x + s.r * (k - .3), y - s.r * 1.1);
        ctx.lineTo(s.x + s.r * (.15 - k), y - s.r * .2); ctx.lineTo(s.x - s.r * .2, y - s.r * .05); ctx.lineTo(s.x + s.r * (.3 + k), y + s.r * .9); ctx.stroke();
      }
      if (level === 0 && !s.warned) label(ctx, 'STORM', s.x, y - s.r * 1.6 - 6, 12, '#ddd2ff');
    }
    const next = rings.find(g => !g.passed);
    for (const g of rings) {
      const y = sy(g.alt);
      if (y > H + 100) continue;
      if (y < -110) break;
      const ry = g.hw * .42;
      ctx.globalAlpha = g.passed ? .28 : 1;
      const bloom = ctx.createRadialGradient(g.x, y, 20, g.x, y, g.hw * 1.25);
      bloom.addColorStop(0, 'rgba(250,206,110,.015)'); bloom.addColorStop(.77, 'rgba(250,206,110,.04)'); bloom.addColorStop(.85, 'rgba(250,206,110,.16)'); bloom.addColorStop(1, 'rgba(250,206,110,0)');
      ctx.fillStyle = bloom; ctx.beginPath(); ctx.arc(g.x, y, g.hw * 1.25, 0, TAU); ctx.fill();
      ctx.strokeStyle = g.passed ? (g.hit ? '#8bdfc0' : '#c27c8d') : '#f8d897'; ctx.lineWidth = g === next ? 3 : 2;
      ctx.beginPath(); ctx.ellipse(g.x, y, g.hw, ry, 0, 0, TAU); ctx.stroke();
      for (let j = 0; j < 9; j++) { const a = j / 9 * TAU + time * .12; ctx.fillStyle = '#ffecb5'; ctx.beginPath(); ctx.arc(g.x + Math.cos(a) * g.hw, y + Math.sin(a) * ry, 2, 0, TAU); ctx.fill(); }
      if (!g.passed) { ctx.strokeStyle = 'rgba(255,240,200,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(g.x, y, 12, 5, 0, 0, TAU); ctx.stroke(); }
      ctx.globalAlpha = 1;
      if (g === next && alive() <= 6 && !ended) label(ctx, alive() === 5 ? 'ALL 5 MUST PASS' : `5 OF ${alive()} MUST PASS`, g.x, y - ry - 12, 14, '#fff0c9');
    }
    for (const [i, b] of birds.entries()) {
      if (b.state === 'lost' && b.t > 1) continue;
      const y = FLOCK_Y + b.dy;
      ctx.save(); ctx.translate(b.x, y);
      if (b.state === 'tumble') {
        ctx.strokeStyle = 'rgba(232,244,255,.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 17, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - b.t / 2)); ctx.stroke();
        if (b.t > .3 && !ended) label(ctx, 'CATCH', 0, 32, 12, '#e8f4ff');
        ctx.rotate(b.spin); ctx.globalAlpha = .85;
      } else if (b.state === 'lost') { ctx.globalAlpha = 1 - b.t; ctx.rotate(b.t * 3); }
      else ctx.rotate(clamp(b.vx * .009, -.32, .32));
      bird(ctx, b, i);
      ctx.restore();
    }
    for (const p of pops) { ctx.globalAlpha = clamp(1.6 - p.t, 0, 1); label(ctx, p.text, p.x, sy(p.alt) - p.t * 26, p.size, p.color, 'center', 750); }
    ctx.globalAlpha = 1;
    if (dawnA > 0) {
      ctx.globalAlpha = dawnA;
      ctx.shadowColor = 'rgba(120,60,40,.6)'; ctx.shadowBlur = 14;
      ctx.font = '400 40px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff6e2'; ctx.fillText(`Dawn ${dawns}`, W / 2, 170);
      ctx.shadowBlur = 0;
      label(ctx, 'The forest blooms', W / 2, 198, 15, '#fff0d6');
      if (cameHome) label(ctx, 'A lost bird comes home', W / 2, 220, 15, '#e2fff6');
      ctx.globalAlpha = 1;
    }
    if (endA > 0) { ctx.globalAlpha = endA; const left = 6 - inSet(); label(ctx, `THE NEXT DAWN WAS ${left} ${left === 1 ? 'RING' : 'RINGS'} AWAY`, W / 2, 132, 15, '#ffe9c4', 'center', 700); ctx.globalAlpha = 1; }
    // Top left: the climb bonus you earn now, and the flock you still have. Top right: the rings to the next dawn.
    const hud = 1 - dawnA * .85;
    ctx.globalAlpha = hud;
    ctx.fillStyle = 'rgba(6,18,26,.5)'; rounded(ctx, 10, 10, 160, 54, 10); ctx.fill(); rounded(ctx, 246, 10, 164, 30, 10); ctx.fill();
    label(ctx, `CLIMB ×${(1 + lift).toFixed(1)}`, 20, 31, 14, lift > .66 ? '#fff0c9' : '#d2e8ea', 'left', 700);
    for (const [i, b] of birds.entries()) {
      const x = 25 + i * 12, on = b.state === 'flock', tumble = b.state === 'tumble';
      ctx.globalAlpha = hud * (tumble ? (Math.sin(time * 14) > 0 ? 1 : .3) : 1);
      ctx.fillStyle = on || tumble ? (b.weight > 1 ? '#ffd17b' : '#d9f6f0') : 'rgba(0,0,0,0)'; ctx.strokeStyle = on || tumble ? 'rgba(0,0,0,0)' : 'rgba(217,246,240,.5)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, 49, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = hud;
    label(ctx, 'NEED 5', 120, 54, 12, '#d2e8ea', 'left', 650);
    const done = inSet();
    for (let i = 0; i < 6; i++) {
      const g = rings.find(r => r.set === level && r.idx === i), x = 262 + i * 16;
      ctx.lineWidth = 1.5; ctx.strokeStyle = g?.passed ? (g.hit ? '#c3efbd' : '#d98ea4') : i === done ? '#ffe2a0' : 'rgba(226,231,224,.45)';
      ctx.fillStyle = g?.passed && g.hit ? 'rgba(195,239,189,.55)' : 'rgba(0,0,0,0)';
      ctx.beginPath(); ctx.ellipse(x, 25, 6, 3.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = '#ffd98f'; ctx.beginPath(); ctx.arc(359, 25, 5, 0, TAU); ctx.fill();
    label(ctx, 'DAWN', 369, 30, 12, '#ffe2a0', 'left', 700);
    // Bottom: the wind pad. It fades out at a dawn and at the end, when there is nothing to steer.
    ctx.globalAlpha = hud * (1 - endA);
    ctx.fillStyle = 'rgba(9,26,40,.78)'; rounded(ctx, 24, H - 112, W - 48, 88, 24); ctx.fill();
    ctx.strokeStyle = held ? 'rgba(194,241,228,.65)' : 'rgba(203,221,229,.22)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,229,232,.3)'; ctx.beginPath(); ctx.moveTo(56, H - 68); ctx.lineTo(W - 56, H - 68); ctx.stroke();
    const kx = clamp(targetX, 56, W - 56), ky = held && touch ? clamp(fingerY, HIGH, H - 40) : H - 68;
    if (ky < H - 112) { ctx.strokeStyle = 'rgba(209,248,231,.35)'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(kx, H - 112); ctx.lineTo(kx, HIGH); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = held ? '#d1f8e7' : '#749ca9'; ctx.beginPath(); ctx.arc(kx, ky, held ? 12 : 8, 0, TAU); ctx.fill();
    label(ctx, held ? 'SLIDE TO STEER · RAISE TO CLIMB' : 'HOLD AND SLIDE TO GUIDE THE WIND', W / 2, H - 38, 14, '#d2e8ea', 'center', 650);
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function pointer(type, p) {
    if (type === 'cancel') { touch = false; keys.clear(); return; }
    if (ended) return;
    if (type === 'down' || type === 'move' && touch) {
      if (type === 'down') api.noise?.({ duration: .35, volume: .025, from: 1800, to: 700, type: 'bandpass', q: .7 });
      touch = true; targetX = clamp(p.x, 50, W - 50); fingerY = p.y;
    } else if (type === 'up') touch = false;
  }
  // Keys: left and right steer while held, up climbs fast, down climbs slowly, space holds the wind.
  const KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'n', s: 'n', S: 'n', ' ': 'h' };
  function key(type, k) {
    const c = KEYS[k];
    if (!c || ended && type === 'down') return;
    if (type === 'down' && !keys.size) api.noise?.({ duration: .35, volume: .025, from: 1800, to: 700, type: 'bandpass', q: .7 });
    if (type === 'down') keys.add(c); else keys.delete(c);
  }
  return {
    update, draw, pointer, key,
    getState: () => ({
      game: 'stormchoir', phase: ended ? 'ended' : 'playing', time, altitude, climb: base() + lift * LIFT, lift, level, dawns, dawnT, score: Math.round(score), sung, streak, bestStreak, knocked, caught, lost,
      alive: alive(), flock: members().length, held, targetX, keys: [...keys],
      birds: birds.map(b => ({ x: b.x, y: FLOCK_Y + b.dy, dy: b.dy, weight: b.weight, state: b.state, t: b.t, knockAt: b.knockAt, by: b.by })),
      rings: rings.map(g => ({ ...g, y: sy(g.alt) })), storms: storms.map(s => ({ ...s, y: sy(s.alt) })), nextRing: rings.find(g => !g.passed) || null,
    }),
  };
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

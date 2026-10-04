const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2, G = 780, K = 2.6, VMAX = 820, CATCH = 34, PX = 10, SLOW = .2;
export const RULES = { G, K, VMAX, CATCH, PX, SLOW };
// What a body does to the throw it makes: beetles push the spark sideways, moths float it on half gravity, seeds lift it.
export const KINDS = {
  beetle: { color: '#dfa884', label: 'BEETLE', tip: 'throws sideways', teach: 'Beetles add their walk to your throw.', push: 2.4, carry: 0, lift: 0, grav: 1 },
  moth: { color: '#8fe5de', label: 'MOTH', tip: 'floats the spark', teach: 'From a moth, gravity pulls the spark at half strength.', push: 1, carry: 1, lift: 0, grav: .5 },
  seed: { color: '#f1de9a', label: 'SEED', tip: 'throws high', teach: 'Seeds lift your throw, more when they rise.', push: .6, carry: 1.6, lift: 150, grav: 1 },
};
// The climb has its own seeded random, so the way you play never changes it.
const mulberry = (s) => () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// Where a body is at world time t, and how fast it moves. Beetles walk along a branch, moths fly a loop, seeds bob and drift.
export function hostAt(h, t) {
  const a = h.w * t + h.ph;
  if (h.type === 'beetle') return { x: h.bx + Math.sin(a) * h.span, alt: h.ba, vx: Math.cos(a) * h.span * h.w, va: 0 };
  if (h.type === 'moth') return { x: h.bx + Math.sin(a) * h.ax, alt: h.ba + Math.sin(2 * a) * h.ay, vx: Math.cos(a) * h.ax * h.w, va: Math.cos(2 * a) * 2 * h.ay * h.w };
  return { x: h.bx + Math.sin(a / 2) * h.drift, alt: h.ba + Math.sin(a) * h.amp, vx: Math.cos(a / 2) * h.drift * h.w / 2, va: Math.cos(a) * h.amp * h.w };
}
// The bodies for one seed. Each comes from the one below it, so one seed always gives the same climb.
// Higher up, the gaps grow and the bodies move faster.
export function makeHosts(rand) {
  const hosts = [{ id: 0, type: 'beetle', bx: 210, ba: 0, span: 34, w: .8, ph: rand() * TAU }];
  function add() {
    const a = hosts[hosts.length - 1], b = hosts[hosts.length - 2], grow = 1 + Math.min(1.4, a.ba / 9000), r = rand();
    let type = r < .36 ? 'beetle' : r < .68 ? 'moth' : 'seed';
    if (type === a.type && b?.type === a.type) type = type === 'beetle' ? 'moth' : type === 'moth' ? 'seed' : 'beetle';
    const dir = a.bx < 150 ? 1 : a.bx > 270 ? -1 : rand() < .5 ? -1 : 1;
    const bx = clamp(a.bx + dir * (40 + rand() * 150), 70, 350), room = Math.min(bx - 34, 386 - bx);
    const h = { id: hosts.length, type, bx, ba: a.ba + 120 + rand() * 60 + Math.min(90, a.ba * .006), ph: rand() * TAU, w: (.7 + rand() * .6) * grow };
    if (type === 'beetle') h.span = Math.min(30 + rand() * 40, room);
    else if (type === 'moth') { h.ax = Math.min(24 + rand() * 30, room); h.ay = 12 + rand() * 16; }
    else { h.amp = 16 + rand() * 18; h.drift = Math.min(14 + rand() * 22, room); }
    hosts.push(h);
  }
  return { hosts, ensure(top) { while (hosts[hosts.length - 1].ba < top) add(); } };
}
// The throw: (finger − body) × K, capped, plus the body's own motion for its kind.
export function launch(h, at, aim) {
  const k = KINDS[h.type]; let vx = (aim.x - at.x) * K, va = (aim.alt - at.alt) * K; const m = Math.hypot(vx, va);
  if (m > VMAX) { vx *= VMAX / m; va *= VMAX / m; }
  return { vx: vx + at.vx * k.push, va: va + (h.type === 'seed' ? Math.max(0, at.va) : at.va) * k.carry + k.lift, grav: G * k.grav };
}

export default function createGame(api) {
  const { W = 420, H = 680 } = api, BASE = H - 230;
  const climb = makeHosts(mulberry(Math.floor((api.rng || Math.random)() * 4294967296))), hosts = climb.hosts, best = Number(api.best) || 0;
  let time = 0, cur = 0, cam = 0, light = 100, top = 0, aiming = false, aim = null, keyAim = null, flight = null, back = null, ended = false, zNow = 1;
  let caught = 0, misses = 0, streak = 0, perfects = 0, milestone = 0, zoom = null, endAt = null, beat = 0, warned = false, metricT = 0, message = '', catchDist = null;
  const seen = new Set(['beetle']), labels = [], bits = [], trail = [{ x: 210, alt: 0 }], squash = new Map();
  climb.ensure(1400);
  const sy = (alt) => BASE - (alt - cam);
  const pos = (h) => hostAt(h, time);
  const tell = (s) => { if (s !== message) { message = s; api.status?.(s); } };
  const metres = () => Math.floor(top / PX);
  const drain = () => 3 + .5 * metres() / 100, lowAt = () => Math.max(25, drain() * 3);
  const metric = () => api.metric?.(`${metres()} m · Light ${Math.max(0, Math.ceil(light))}%`);
  const toWorld = (p) => ({ x: (p.x - W / 2) / zNow + W / 2, alt: cam + (BASE - ((p.y - BASE) / zNow + BASE)) });
  const puff = (x, alt, color, n = 12, v = 120) => { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = v * (.3 + Math.random() * .7); bits.push({ x, alt, vx: Math.cos(a) * s, va: Math.sin(a) * s, life: .4 + Math.random() * .5, color }); } if (bits.length > 160) bits.splice(0, bits.length - 160); };
  tell('Hold, drag above your beetle, and let go to throw the spark.'); metric();

  function aimPoint() {
    if (keyAim) { const at = pos(hosts[cur]); return { x: at.x + keyAim.dx, alt: at.alt + keyAim.da }; }
    return aim ? toWorld(aim) : null;
  }
  function release(p) {
    aiming = false;
    // A press made while the spark flies is kept. If you let go before a body catches it, nothing is thrown.
    if (ended || flight || back || !p) return;
    const h = hosts[cur], at = pos(h), v = launch(h, at, p);
    if (Math.hypot(p.x - at.x, p.alt - at.alt) < 14) { api.tone?.(300, .05, 'sine', .03); tell('Drag away from your body to aim, then let go.'); return; }
    flight = { from: cur, x: at.x, alt: at.alt, vx: v.vx, va: v.va, grav: v.grav, t: 0, path: [], close: null };
    squash.set(h.id, -.6);
    api.noise?.({ duration: .25, volume: .045, from: 2200, to: 500, type: 'bandpass', q: 1.2 }); api.tone?.(520 + Math.hypot(v.vx, v.va) * .3, .07, 'sine', .05);
    if (!caught && !misses) tell('A body above catches the spark if it passes inside its ring.');
  }
  function land(h, d) {
    const p = pos(h); flight = null; cur = h.id; h.visited = true; caught++;
    top = Math.max(top, h.ba); trail.push({ x: p.x, alt: p.alt });
    const perfect = d <= 10, centre = d <= 16, notes = [392, 440, 494, 587, 659, 784, 880, 988, 1175]; catchDist = d;
    streak = centre ? streak + 1 : 0; if (perfect) perfects++;
    light = Math.min(100, light + (perfect ? 14 : centre ? 10 : 5));
    squash.set(h.id, 1); api.slow?.(.05, .07); api.buzz?.(perfect ? 25 : 12);
    // A centre catch plays the next note up. A streak climbs the scale.
    api.tone?.(centre ? notes[Math.min(notes.length - 1, streak - 1)] : 262, .24, 'sine', .11);
    if (perfect) api.tone?.(notes[Math.min(notes.length - 1, streak - 1)] * 2, .18, 'sine', .05, .06);
    puff(p.x, p.alt, KINDS[h.type].color, perfect ? 24 : 14, perfect ? 170 : 110);
    labels.push({ text: perfect ? 'PERFECT' : centre ? 'GOOD' : 'CLOSE', sub: `+${perfect ? 14 : centre ? 10 : 5} light`, x: p.x, alt: p.alt + 44, t: 0, color: perfect ? '#fff3b5' : centre ? '#e7f6d6' : '#cfd9d3' });
    const m = Math.floor(metres() / 100);
    if (m > milestone) {
      // Every 100 m the view pulls back for 1 s and shows the trail of bodies the spark has lived in.
      milestone = m; zoom = { at: null }; api.slow?.(.35, 1); api.chord?.([392, 494, 587, 784], 1.3, 'sine', .11);
      tell(`${m * 100} m. Look back at the bodies that carried you.`);
    } else if (!seen.has(h.type)) { seen.add(h.type); tell(`A ${h.type} caught the spark. ${KINDS[h.type].teach}`); }
    else tell(streak > 1 ? `${streak} centre catches in a row.` : perfect ? 'A perfect catch.' : 'Caught. Read how the next body moves, then throw.');
    metric();
  }
  function miss() {
    const f = flight; flight = null; misses++; streak = 0; light -= 15;
    back = { x: f.x, alt: f.alt, t: 0 };
    labels.push({ text: 'MISS', sub: '−15 light', x: clamp(f.x, 40, W - 40), alt: Math.max(f.alt, pos(hosts[cur]).alt) + 40, t: 0, color: '#ffc3b4' });
    api.tone?.(150, .22, 'triangle', .08); api.tone?.(110, .3, 'triangle', .06, .08); api.shake?.(3, .2); api.buzz?.(40);
    tell('Missed. The spark goes back to your last body, and you lose 15 light.');
    metric();
  }
  function stepFlight(dt) {
    const f = flight; f.t += dt;
    f.va -= f.grav * dt; f.x += f.vx * dt; f.alt += f.va * dt;
    if (f.x < 12 && f.vx < 0 || f.x > W - 12 && f.vx > 0) { f.vx *= -.6; f.x = clamp(f.x, 12, W - 12); api.tone?.(170, .05, 'triangle', .04); }
    f.path.push({ x: f.x, alt: f.alt }); if (f.path.length > 36) f.path.shift();
    // A body higher than the one you left catches the spark at its closest pass within reach. No body below can.
    let near = null;
    for (const h of hosts) {
      if (h.ba <= hosts[f.from].ba + 20 || h.visited || Math.abs(h.ba - f.alt) > 140) continue;
      const p = pos(h), d = Math.hypot(p.x - f.x, p.alt - f.alt);
      if (d < CATCH && (!near || d < near.d)) near = { h, d };
    }
    if (f.close && (!near || near.h !== f.close.h || near.d > f.close.d + .01)) return land(f.close.h, f.close.d);
    if (near) f.close = near;
    if (f.alt < hosts[f.from].ba - 320 || f.t > 3.2) miss();
  }
  function end() {
    ended = true; aiming = false; aim = null; keyAim = null; flight = null; back = null; light = 0;
    const m = metres();
    metric(); tell(`Your light went out at ${m} m.`);
    api.noise?.({ duration: 1.2, volume: .06, from: 700, to: 120 });
    api.finish?.({ score: m, unit: 'm', win: m > best, title: best > 0 && m > best ? 'Your highest climb yet' : 'The spark is resting',
      detail: `You carried the spark ${m} m through ${caught} ${caught === 1 ? 'body' : 'bodies'}, with ${perfects} perfect ${perfects === 1 ? 'catch' : 'catches'} and ${misses} ${misses === 1 ? 'miss' : 'misses'}. The next 100 m mark was ${100 - m % 100} m above you.` });
  }
  function update(dt) {
    dt = Math.min(dt, .04);
    // Holding slows the world to a fifth, but the light drains in real time.
    const wdt = dt * (aiming && !ended ? SLOW : 1);
    time += wdt;
    for (const [id, s] of squash) { const n = s * Math.exp(-dt * 9); if (Math.abs(n) < .01) squash.delete(id); else squash.set(id, n); }
    for (const l of labels) l.t += dt; while (labels.length && labels[0].t > 1.3) labels.shift();
    for (const b of bits) { b.life -= dt; b.x += b.vx * dt; b.alt += b.va * dt; b.va -= 120 * dt; } for (let i = bits.length - 1; i >= 0; i--) if (bits[i].life <= 0) bits.splice(i, 1);
    if (flight) stepFlight(wdt);
    if (back) { back.t += wdt / .35; if (back.t >= 1) back = null; }
    if (!ended) {
      light -= dt * drain();
      // Low light: a heartbeat that speeds up. It starts at least 3 s before the light runs out, unless a miss takes the light at once.
      if (light < lowAt()) {
        beat -= dt; if (beat <= 0) { beat = .45 + light / 40; api.tone?.(98, .12, 'sine', .1); api.tone?.(82, .14, 'sine', .08, .14); }
        if (!warned) { warned = true; tell('Your light is low. Catch near the centre of a body to refill it.'); }
      } else warned = false;
      metricT -= dt; if (metricT <= 0) { metricT = .25; metric(); }
      if (light <= 0) end();
    }
    const focus = ended ? pos(hosts[cur]).alt : flight ? Math.max(flight.alt - 40, pos(hosts[cur]).alt - 60) : pos(hosts[cur]).alt;
    cam += (focus - cam) * Math.min(1, dt * 4);
    climb.ensure(cam + H * 2);
  }

  function draw(ctx, t) {
    if (zoom && zoom.at == null) zoom.at = t; if (ended && endAt == null) endAt = t;
    let z = 1; if (zoom) { const u = (t - zoom.at) / 1; if (u >= 1 || u < 0) zoom = null; else z = 1 - .5 * Math.sin(Math.PI * u); }
    if (endAt != null) z = Math.min(z, 1 - .4 * Math.min(1, (t - endAt) / 1.2));
    zNow = z;
    const lo = cam - (H - BASE) / z - 80, hi = cam + BASE / z + 80, low = !ended && light < lowAt();
    ctx.save();
    const tint = ctx.createLinearGradient(0, 0, 0, H); tint.addColorStop(0, 'rgba(8,30,29,.16)'); tint.addColorStop(1, 'rgba(13,24,26,.6)');
    ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 23; i++) {
      const x = (i * 71 + Math.sin(time * .3 + i) * 17 + W) % W, y = ((i * 103 + cam * .38 - time * 8) % 720 + 720) % 720;
      ctx.fillStyle = `rgba(235,233,174,${.12 + (Math.sin(time + i) + 1) * .14})`; ctx.beginPath(); ctx.arc(x, y, 1 + i % 2, 0, 7); ctx.fill();
    }
    ctx.save(); ctx.translate(W / 2, BASE); ctx.scale(z, z); ctx.translate(-W / 2, -BASE);
    // Height marks every 10 m, a line every 100 m, and your best.
    ctx.textAlign = 'right'; ctx.font = '12px system-ui';
    for (let m = Math.max(0, Math.floor(lo / PX / 10) * 10); m * PX < hi; m += 10) {
      const y = sy(m * PX); ctx.fillStyle = 'rgba(232,226,246,.32)'; ctx.fillRect(m % 50 ? W - 10 : W - 18, y, m % 50 ? 8 : 16, 1.5);
      if (m % 100 === 0 && m > 0) { ctx.strokeStyle = milestone * 100 >= m ? 'rgba(255,233,170,.5)' : 'rgba(255,233,170,.25)'; ctx.lineWidth = 2; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.moveTo(-W, y); ctx.lineTo(2 * W, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#ffe9b0'; ctx.font = '600 14px system-ui'; ctx.fillText(`${m} m`, W - 22, y - 7); ctx.font = '12px system-ui'; }
      else if (m % 50 === 0 && m > 0) ctx.fillText(`${m} m`, W - 22, y + 4);
    }
    if (best > 0 && best * PX > lo && best * PX < hi) { const y = sy(best * PX); ctx.strokeStyle = 'rgba(255,243,206,.55)'; ctx.lineWidth = 1.5; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(-W, y); ctx.lineTo(2 * W, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff3ce'; ctx.textAlign = 'left'; ctx.fillText(`YOUR BEST · ${best} m`, 12, y - 6); }
    // The trail of bodies the spark has lived in. When the view pulls back, a wave of light runs up it.
    const glow = zoom || endAt != null ? 1 : 0, wave = zoom ? (t - zoom.at) / .9 : endAt != null ? (t - endAt) / 1.3 : -1;
    ctx.strokeStyle = `rgba(255,224,150,${.22 + glow * .35})`; ctx.lineWidth = 2 + glow * 1.5; ctx.setLineDash([5, 7]); ctx.beginPath();
    trail.forEach((p, i) => { if (i) ctx.lineTo(p.x, sy(p.alt)); else ctx.moveTo(p.x, sy(p.alt)); }); ctx.stroke(); ctx.setLineDash([]);
    trail.forEach((p, i) => { const lit = glow ? Math.max(0, 1 - Math.abs(wave * trail.length - i) / 3) : 0; ctx.fillStyle = `rgba(255,236,170,${.35 + glow * .3 + lit * .35})`; ctx.beginPath(); ctx.arc(p.x, sy(p.alt), 3 + glow * 1.5 + lit * 5, 0, 7); ctx.fill(); });
    const fromAlt = hosts[cur].ba;
    for (const h of hosts) {
      if (h.ba < lo - 60 || h.ba > hi + 60) continue;
      const p = pos(h), y = sy(p.alt), k = KINDS[h.type], open = h.ba > fromAlt + 20 && !ended;
      if (h.type === 'beetle') {
        ctx.strokeStyle = 'rgba(111,145,105,.65)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(h.bx - h.span - 26, y + 20); ctx.quadraticCurveTo(h.bx, y + 35, h.bx + h.span + 26, y + 20); ctx.stroke();
      }
      if (h.type === 'seed') for (let j = 0; j < 4; j++) {
        const yy = y + 60 + ((j * 23 - time * 24) % 70);
        ctx.strokeStyle = 'rgba(175,216,199,.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - 28 + j * 18, yy); ctx.quadraticCurveTo(p.x - 18 + j * 18, yy - 15, p.x - 25 + j * 18, yy - 32); ctx.stroke();
      }
      // Each body above you shows its catch ring.
      if (open) { ctx.strokeStyle = 'rgba(232,226,246,.28)'; ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.arc(p.x, y, CATCH, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      ctx.save(); ctx.translate(p.x, y);
      if (h.id === cur && !flight && !back) {
        const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 52); halo.addColorStop(0, `rgba(255,227,156,${low ? .2 + Math.sin(time * 20) * .1 : .45})`); halo.addColorStop(1, 'rgba(255,227,156,0)'); ctx.fillStyle = halo; ctx.fillRect(-60, -60, 120, 120);
      }
      const s = squash.get(h.id) || 0; ctx.scale(1 + s * .3, 1 - s * .25);
      ctx.globalAlpha = h.ba < fromAlt - 5 ? .55 : 1;
      drawBody(ctx, h.type, time + h.ph, k.color, p.vx);
      ctx.globalAlpha = 1; ctx.restore();
      if (h.id === cur && !flight && !back && !ended) {
        ctx.fillStyle = '#fff5c5'; ctx.shadowColor = '#fff5bb'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(p.x, y - 5, low ? 3.5 + Math.sin(time * 18) : 4.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        const tag = `${k.label} · ${k.tip}`; ctx.font = '600 12px system-ui'; const half = ctx.measureText(tag).width / 2 + 8;
        ctx.textAlign = 'center'; ctx.fillStyle = k.color; ctx.fillText(tag, clamp(p.x, half, W - half), y + 52);
      }
    }
    // While you aim: the first third of the throw's path, from your body toward your finger.
    const ap = aiming && !flight && !back && !ended ? aimPoint() : null;
    if (ap) {
      const h = hosts[cur], at = pos(h), v = launch(h, at, ap), pts = [];
      let x = at.x, a = at.alt, vx = v.vx, va = v.va;
      for (let k = 0; k < 120; k++) { const d = 1 / 60; va -= v.grav * d; x += vx * d; a += va * d; if (x < 12 && vx < 0 || x > W - 12 && vx > 0) vx *= -.6; pts.push([x, a]); if (a < at.alt - 320) break; }
      const n = Math.max(2, Math.ceil(pts.length / 3));
      ctx.strokeStyle = 'rgba(232,226,246,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(at.x, sy(at.alt)); ctx.lineTo(ap.x, sy(ap.alt)); ctx.stroke();
      for (let i = 0; i < n; i += 2) { ctx.fillStyle = `rgba(255,240,190,${.9 - i / n * .7})`; ctx.beginPath(); ctx.arc(pts[i][0], sy(pts[i][1]), 3 - i / n * 1.5, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#fff0c6'; ctx.beginPath(); ctx.arc(ap.x, sy(ap.alt), 6, 0, 7); ctx.fill();
    }
    if (flight || back) {
      const f = flight || { x: back.x + (pos(hosts[cur]).x - back.x) * back.t, alt: back.alt + (pos(hosts[cur]).alt - back.alt) * back.t, path: [] }, y = sy(f.alt);
      f.path.forEach((q, i) => { ctx.fillStyle = `rgba(254,224,152,${i / f.path.length * .5})`; ctx.beginPath(); ctx.arc(q.x, sy(q.alt), 1 + i / f.path.length * 2.5, 0, 7); ctx.fill(); });
      const fire = ctx.createRadialGradient(f.x, y, 0, f.x, y, 22); fire.addColorStop(0, back ? 'rgba(255,214,200,.85)' : 'rgba(255,249,206,.95)'); fire.addColorStop(.25, 'rgba(255,214,113,.5)'); fire.addColorStop(1, 'rgba(255,203,103,0)'); ctx.fillStyle = fire; ctx.fillRect(f.x - 22, y - 22, 44, 44);
    }
    if (ended) { const p = pos(hosts[cur]), u = endAt != null ? Math.min(1, (t - endAt) / 1.4) : 0, y = sy(p.alt) + u * 60; ctx.globalAlpha = 1 - u; ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.arc(p.x, y, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    for (const b of bits) { ctx.globalAlpha = Math.min(1, b.life * 2); ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(b.x, sy(b.alt), 2.2, 0, 7); ctx.fill(); } ctx.globalAlpha = 1;
    ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,10,26,.75)';
    for (const l of labels) { const y = sy(l.alt) - l.t * 30, x = clamp(l.x, 60, W - 60); ctx.globalAlpha = Math.max(0, 1 - l.t / 1.3); ctx.textAlign = 'center'; ctx.fillStyle = l.color; ctx.font = '800 20px system-ui'; ctx.lineWidth = 4; ctx.strokeText(l.text, x, y); ctx.fillText(l.text, x, y); ctx.font = '600 13px system-ui'; ctx.lineWidth = 3; ctx.strokeText(l.sub, x, y + 17); ctx.fillText(l.sub, x, y + 17); } ctx.globalAlpha = 1;
    ctx.restore();
    // The light bar and the height, on a soft dark band so they stay readable over the bodies.
    const band = ctx.createLinearGradient(0, 0, 0, 70); band.addColorStop(0, 'rgba(12,10,24,.55)'); band.addColorStop(1, 'rgba(12,10,24,0)'); ctx.fillStyle = band; ctx.fillRect(0, 0, W, 70);
    const bw = 150, lx = W - 16 - bw, fill = Math.max(0, light) / 100;
    ctx.fillStyle = 'rgba(10,30,31,.6)'; ctx.fillRect(lx, 16, bw, 8);
    ctx.fillStyle = low ? `rgba(255,${120 + Math.sin(time * 16) * 60 | 0},110,.95)` : '#ffe7a3'; ctx.fillRect(lx, 16, bw * fill, 8);
    ctx.textAlign = 'right'; ctx.font = '600 12px system-ui'; ctx.fillStyle = low ? '#ffc9bd' : 'rgba(255,240,205,.85)'; ctx.fillText(`LIGHT ${Math.max(0, Math.ceil(light))}%`, W - 16, 40);
    ctx.textAlign = 'left'; ctx.fillStyle = '#f5f0df'; ctx.font = '600 22px system-ui'; ctx.fillText(`${metres()} m`, 16, 34);
    ctx.font = '12px system-ui'; ctx.fillStyle = 'rgba(232,226,246,.75)'; ctx.fillText(`Next mark at ${(milestone + 1) * 100} m`, 16, 52);
    if (low) { const v = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75); v.addColorStop(0, 'rgba(40,0,10,0)'); v.addColorStop(1, `rgba(60,8,18,${.35 + Math.sin(time * 6) * .1})`); ctx.fillStyle = v; ctx.fillRect(0, 0, W, H); }
    if (!caught && !ended && !flight) { ctx.textAlign = 'center'; ctx.font = '600 14px system-ui'; ctx.fillStyle = 'rgba(244,240,226,.9)'; ctx.fillText(aiming ? 'LET GO TO THROW' : 'HOLD · DRAG UP · LET GO', W / 2, H - 40); }
    ctx.restore();
  }

  function pointer(type, p) {
    if (ended) return;
    if (type === 'down') { aiming = true; aim = { ...p }; keyAim = null; }
    else if (type === 'move' && aiming) aim = { ...p };
    else if (type === 'up' && aiming) { aim = { ...p }; release(aimPoint()); aim = null; }
    else if (type === 'cancel') { aiming = false; aim = null; }
  }
  // Keys: hold Space or Enter to aim, move the aim with the arrows, and let go to throw.
  function key(type, k) {
    if (ended) return;
    if (k === ' ' || k === 'Enter') {
      if (type === 'down' && !aiming) { aiming = true; aim = null; keyAim = { dx: 0, da: 170 }; }
      else if (type === 'up' && keyAim) { release(aimPoint()); keyAim = null; }
      return;
    }
    if (type !== 'down' || !keyAim) return;
    if (k === 'ArrowLeft') keyAim.dx -= 15; if (k === 'ArrowRight') keyAim.dx += 15; if (k === 'ArrowUp') keyAim.da += 15; if (k === 'ArrowDown') keyAim.da -= 15;
  }
  return { update, draw, pointer, key, destroy() {},
    getState: () => ({ game: 'borrowed', phase: ended ? 'ended' : flight ? 'flight' : back ? 'return' : 'playing', current: cur, light, low: !ended && light < lowAt(), height: metres(), caught, misses, streak, perfects, catchDist, milestone, aiming, time, cam, zoom: !!zoom,
      label: labels.length ? labels[labels.length - 1].text : null, spark: flight ? { x: flight.x, alt: flight.alt, vx: flight.vx, va: flight.va, t: flight.t, from: flight.from } : null,
      hosts: hosts.slice(0, Math.max(40, cur + 12)).map((h) => { const p = pos(h); return { ...h, x: p.x, alt: p.alt, y: sy(p.alt), vx: p.vx, va: p.va, visited: !!h.visited }; }) }) };
}

function drawBody(ctx, type, t, color, vx) {
  ctx.save();
  if (type === 'beetle') {
    ctx.strokeStyle = '#ddb394'; ctx.lineWidth = 1.5;
    for (let i = -1; i <= 1; i++) { const step = Math.sin(t * 7 + i) * 4; ctx.beginPath(); ctx.moveTo(-8, i * 7); ctx.lineTo(-17, i * 9 + step); ctx.lineTo(-20, i * 10 + 6); ctx.moveTo(8, i * 7); ctx.lineTo(17, i * 9 - step); ctx.lineTo(20, i * 10 + 6); ctx.stroke(); }
    ctx.fillStyle = '#7e4f42'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 18, .04, 0, 7); ctx.fill();
    const shell = ctx.createLinearGradient(-13, 0, 12, 0); shell.addColorStop(0, '#5c655b'); shell.addColorStop(.45, '#dca477'); shell.addColorStop(1, '#84564b'); ctx.fillStyle = shell; ctx.beginPath(); ctx.ellipse(0, -2, 12, 15, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#573a32'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 12); ctx.stroke();
    ctx.fillStyle = '#ac825f'; ctx.beginPath(); ctx.ellipse(0, -17, 7, 5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#dab38a'; ctx.beginPath(); ctx.moveTo(-4, -21); ctx.lineTo(-9, -28); ctx.moveTo(4, -21); ctx.lineTo(9, -28); ctx.stroke();
  } else if (type === 'moth') {
    ctx.rotate(clamp(vx * .007, -.25, .25));
    const flap = .8 + Math.sin(t * 5) * .18;
    ctx.scale(flap, 1);
    ctx.fillStyle = '#6aacae'; ctx.beginPath(); ctx.moveTo(0, 4); ctx.bezierCurveTo(-15, -32, -43, -28, -28, 1); ctx.bezierCurveTo(-39, 26, -11, 20, 0, 4); ctx.bezierCurveTo(16, 27, 40, 21, 28, 1); ctx.bezierCurveTo(42, -28, 14, -33, 0, 4); ctx.fill();
    ctx.fillStyle = '#b9eddb'; ctx.beginPath(); ctx.ellipse(-19, -7, 9, 13, -.8, 0, 7); ctx.ellipse(19, -7, 9, 13, .8, 0, 7); ctx.fill();
    ctx.fillStyle = '#44666b'; ctx.beginPath(); ctx.arc(-21, -7, 3, 0, 7); ctx.arc(21, -7, 3, 0, 7); ctx.fill();
    ctx.fillStyle = '#e6ebc5'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 13, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#e6ebc5'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -10); ctx.quadraticCurveTo(-9, -24, -12, -19); ctx.moveTo(2, -10); ctx.quadraticCurveTo(9, -24, 12, -19); ctx.stroke();
  } else {
    ctx.rotate(Math.sin(t * .6) * .2);
    ctx.strokeStyle = '#eee3b3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, -15); ctx.stroke();
    for (let i = 0; i < 13; i++) { const a = Math.PI + i / 12 * Math.PI; const x = Math.cos(a) * 25, y = Math.sin(a) * 21 - 8; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = '#f3ebc6'; ctx.beginPath(); ctx.ellipse(x, y, 2.5, 5, a + Math.PI / 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#c7a46a'; ctx.beginPath(); ctx.ellipse(0, 13, 5, 10, -.2, 0, 7); ctx.fill();
  }
  ctx.restore();
}

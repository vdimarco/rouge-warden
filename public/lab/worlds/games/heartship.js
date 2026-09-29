const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const laneX = lane => 72 + lane * 138;
export default function createGame(api) {
  const organs = [
    { id: 'left', name: 'LEFT FIN', x: 73, y: 554, color: '#9de7e8', key: 'ArrowLeft' },
    { id: 'right', name: 'RIGHT FIN', x: 347, y: 554, color: '#9de7e8', key: 'ArrowRight' },
    { id: 'shield', name: 'SHIELD', x: 128, y: 447, color: '#c1b6ff', key: 'ArrowUp' },
    { id: 'sail', name: 'SAIL', x: 292, y: 447, color: '#ffcaa4', key: 'ArrowDown' },
  ];
  const heart = { x: 210, y: 566 };
  const hazards = [110, 190, 300, 420, 540, 700, 820].map((d, i) => ({ distance: d, type: [1, 3, 5].includes(i) ? 'storm' : 'reef', lane: Math.floor(api.rng() * 3), resolved: false, variant: api.rng() }));
  const lanterns = [70, 245, 365, 485, 620, 765, 860].map(d => ({ distance: d, lane: Math.floor(api.rng() * 3), resolved: false }));
  const motes = Array.from({ length: 25 }, () => ({ x: api.rng() * 420, y: api.rng() * 340, p: api.rng() * 6.28 }));
  let t = 0, distance = 0, lane = 1, visualX = 210, hp = 3, energy = 100, charge = 0, holding = false, selected = 2, done = false;
  let shield = 0, boost = 0, invulnerable = 0, collected = 0, pulses = 0, pulse = null, flash = 0, beat = -1, combo = 0, lastStatus = '';
  let pointer = { ...heart };
  const glow = [0, 0, 0, 0];
  function report(force = false) {
    const next = hazards.find(h => !h.resolved), gap = next ? next.distance - distance : Infinity;
    let status = 'Hold the heart. Drag to an organ, then release. Fins dodge reefs; shield stops storms.';
    if (t > 4 && next) status = next.type === 'storm' ? `Storm in ${Math.ceil(gap / (boost > 0 ? 34 : 22))}s. Charge a SHIELD pulse as it approaches.` : `Reef in the ${['left', 'centre', 'right'][next.lane]} lane. Send a FIN pulse to steer clear.`;
    else if (t > 4) status = 'Dawn is ahead. Use the SAIL to ride the final current.';
    if (force || status !== lastStatus) { api.status(status); lastStatus = status; }
    api.metric(`${Math.floor(distance)} / 900m · ${hp} hearts · ${collected} lights`);
  }
  function activate(index, power) {
    const cost = 13 + power * 8;
    if (energy < cost) { api.status('The heart needs energy. Let it rest for a moment.'); flash = 0.4; return; }
    energy -= cost; pulses++;
    const beatPhase = (t * 1.25) % 1;
    const onBeat = beatPhase < 0.2 || beatPhase > 0.83;
    if (onBeat) combo++; else combo = 0;
    pulse = { index, power: clamp(power + (onBeat ? 0.2 : 0), 0.1, 1.2), progress: 0, onBeat };
    api.tone([260, 330, 390, 520][index], 0.12 + power * 0.1, 'sine', 0.09);
  }
  function arrive(p) {
    const o = organs[p.index]; glow[p.index] = 1; api.burst(o.x, o.y, o.color, p.onBeat ? 16 : 8);
    if (o.id === 'left') lane = Math.max(0, lane - 1);
    if (o.id === 'right') lane = Math.min(2, lane + 1);
    if (o.id === 'shield') shield = 2.2 + p.power * 2.4;
    if (o.id === 'sail') boost = 3 + p.power * 3;
  }
  function hurt(reason) {
    if (invulnerable > 0 || done) return;
    hp--; invulnerable = 1; flash = 0.55;
    api.tone(88, 0.23, 'sawtooth', 0.04); api.burst(visualX, 326, '#ff938d', 22);
    if (hp <= 0) { done = true; api.finish({ title: 'The heart needs another voyage', detail: `${Math.floor(distance)}m travelled. ${reason} Restart with a fresh route.`, score: Math.floor(distance) + collected * 70 }); }
    else api.status(reason);
  }
  const rounded = (ctx, x, y, w, h, r, fill, stroke) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } };
  const text = (ctx, str, x, y, size = 12, color = '#e7f4ed', weight = 500, align = 'center') => { ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.fillText(str, x, y); };
  function path(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.bezierCurveTo(a.x, a.y - 75, b.x, b.y + 58, b.x, b.y); }
  function heartShape(ctx, x, y, size, color) {
    ctx.beginPath(); ctx.moveTo(x, y + size * 0.7); ctx.bezierCurveTo(x - size * 1.4, y - size * 0.1, x - size * 0.7, y - size * 1.1, x, y - size * 0.5); ctx.bezierCurveTo(x + size * 0.7, y - size * 1.1, x + size * 1.4, y - size * 0.1, x, y + size * 0.7); ctx.fillStyle = color; ctx.fill();
  }
  function drawShip(ctx, x, y) {
    ctx.save(); ctx.translate(x, y); ctx.rotate((laneX(lane) - x) * 0.0018);
    if (shield > 0) { ctx.beginPath(); ctx.ellipse(0, -2, 35 + Math.sin(t * 7) * 2, 45, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(176,171,255,.15)'; ctx.fill(); ctx.strokeStyle = '#dad4ff'; ctx.lineWidth = 2; ctx.stroke(); }
    if (boost > 0) { for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 7, 24); ctx.lineTo(-14 + i * 9, 45 + Math.sin(t * 10 + i) * 10); ctx.strokeStyle = '#ffc99a'; ctx.lineWidth = 2; ctx.stroke(); } }
    ctx.beginPath(); ctx.moveTo(0, -31); ctx.bezierCurveTo(-26, -10, -19, 23, 0, 31); ctx.bezierCurveTo(19, 23, 26, -10, 0, -31); ctx.fillStyle = '#4f8791'; ctx.fill(); ctx.strokeStyle = '#b7e3d7'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.quadraticCurveTo(-42, 10 + Math.sin(t * 6) * 5, -32, 22); ctx.lineTo(-8, 17); ctx.fillStyle = '#a1d3ca'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.quadraticCurveTo(42, 10 + Math.sin(t * 6) * 5, 32, 22); ctx.lineTo(8, 17); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -33); ctx.quadraticCurveTo(26, -13, 0, -2); ctx.fillStyle = '#f2d4ae'; ctx.fill(); ctx.strokeStyle = '#ffe6c4'; ctx.lineWidth = 1; ctx.stroke();
    heartShape(ctx, 0, 9, 6, '#ffaeab'); ctx.restore();
  }
  function draw(ctx) {
    ctx.save();
    const bg = ctx.createLinearGradient(0, 80, 0, 390); bg.addColorStop(0, 'rgba(11,35,54,.22)'); bg.addColorStop(1, 'rgba(9,35,49,.86)'); ctx.fillStyle = bg; ctx.fillRect(0, 0, 420, 680);
    text(ctx, 'CARRY YOUR LIVING SHIP TO DAWN', 210, 93, 10, '#d4deda', 650);
    for (let i = 0; i < 3; i++) {
      const x = laneX(i); ctx.beginPath(); ctx.moveTo(x, 105); ctx.lineTo(x, 368); ctx.strokeStyle = 'rgba(170,228,223,.13)'; ctx.setLineDash([2, 11]); ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]);
      text(ctx, ['L', 'C', 'R'][i], x, 367, 9, '#b5d4d0');
    }
    for (const p of motes) { ctx.globalAlpha = 0.1 + Math.sin(t * 1.8 + p.p) * 0.07; ctx.beginPath(); ctx.ellipse(p.x, 106 + ((p.y + distance * 2) % 245), 10, 1, 0, 0, Math.PI * 2); ctx.fillStyle = '#b9ffff'; ctx.fill(); } ctx.globalAlpha = 1;
    for (const l of lanterns) {
      if (l.resolved) continue; const y = 321 - (l.distance - distance) * 2.05; if (y < 110 || y > 356) continue;
      const x = laneX(l.lane); ctx.shadowBlur = 18; ctx.shadowColor = '#ffedb1'; ctx.fillStyle = '#ffedb1'; ctx.beginPath(); ctx.ellipse(x, y + Math.sin(t * 4) * 3, 5, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (const h of hazards) {
      if (h.resolved) continue; const y = 321 - (h.distance - distance) * 2.05; if (y < 112 || y > 355) continue;
      if (h.type === 'reef') {
        const x = laneX(h.lane); ctx.beginPath(); ctx.moveTo(x - 37, y + 15); ctx.lineTo(x - 24, y - 9); ctx.lineTo(x - 12, y - 2); ctx.lineTo(x, y - 31); ctx.lineTo(x + 14, y - 9); ctx.lineTo(x + 22, y - 16); ctx.lineTo(x + 39, y + 16); ctx.closePath(); ctx.fillStyle = '#2f5762'; ctx.fill(); ctx.strokeStyle = '#db9ca8'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(x, y + 17, 43, 6, 0, 0, Math.PI * 2); ctx.strokeStyle = '#a2d6da'; ctx.lineWidth = 1; ctx.stroke(); text(ctx, 'REEF', x, y + 34, 9, '#f0bdc0', 700);
      } else {
        ctx.fillStyle = 'rgba(169,160,250,.12)'; ctx.fillRect(16, y - 13, 388, 31); ctx.beginPath(); for (let x = 18; x <= 402; x += 16) { const yy = y + Math.sin(x * 0.06 + t * 10) * 6; if (x === 18) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.strokeStyle = '#d8c9ff'; ctx.lineWidth = 2; ctx.stroke();
        text(ctx, 'STORM · SHIELD', 210, y - 20, 10, '#ece2ff', 750);
      }
    }
    const next = hazards.find(h => !h.resolved);
    if (next && next.distance - distance > 103) text(ctx, next.type === 'storm' ? '↑ STORM APPROACHING' : `↑ REEF · ${['LEFT', 'CENTRE', 'RIGHT'][next.lane]}`, 210, 122, 10, next.type === 'storm' ? '#d8cbff' : '#f2c8bb', 700);
    if (invulnerable <= 0 || Math.floor(t * 12) % 2 === 0) drawShip(ctx, visualX, 321);
    rounded(ctx, 22, 383, 376, 279, 28, 'rgba(9,27,41,.94)', '#65848b');
    text(ctx, holding ? 'RELEASE TO SEND YOUR PULSE' : 'HOLD THE HEART · DRAG TO AN ORGAN', 210, 407, 9, '#d7e5df', 700);
    for (let i = 0; i < organs.length; i++) {
      const o = organs[i]; path(ctx, heart, o); ctx.strokeStyle = '#284f60'; ctx.lineWidth = 10; ctx.stroke(); path(ctx, heart, o); ctx.strokeStyle = holding && selected === i ? o.color : '#638792'; ctx.lineWidth = holding && selected === i ? 3 : 1; ctx.stroke();
    }
    if (pulse) {
      const o = organs[pulse.index], u = pulse.progress, v = 1 - u;
      const x = v ** 3 * heart.x + 3 * v * v * u * heart.x + 3 * v * u * u * o.x + u ** 3 * o.x;
      const y = v ** 3 * heart.y + 3 * v * v * u * (heart.y - 75) + 3 * v * u * u * (o.y + 58) + u ** 3 * o.y;
      ctx.shadowColor = o.color; ctx.shadowBlur = 22; ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(x, y, 6 + pulse.power * 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    for (let i = 0; i < organs.length; i++) {
      const o = organs[i], active = holding && selected === i;
      ctx.beginPath(); ctx.ellipse(o.x, o.y, 31 + glow[i] * 4, 29 + glow[i] * 4, i < 2 ? (i === 0 ? -0.35 : 0.35) : 0, 0, Math.PI * 2); ctx.fillStyle = active ? '#385563' : '#1b3e50'; ctx.fill(); ctx.strokeStyle = o.color; ctx.globalAlpha = active || glow[i] > 0 ? 1 : 0.55; ctx.lineWidth = active ? 2.5 : 1.2; ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = o.color; ctx.lineWidth = 2; ctx.beginPath();
      if (i < 2) { const dir = i === 0 ? -1 : 1; ctx.moveTo(o.x - dir * 9, o.y - 9); ctx.lineTo(o.x + dir * 8, o.y); ctx.lineTo(o.x - dir * 9, o.y + 9); ctx.stroke(); }
      else if (i === 2) { ctx.moveTo(o.x, o.y - 13); ctx.lineTo(o.x - 12, o.y - 7); ctx.quadraticCurveTo(o.x - 11, o.y + 8, o.x, o.y + 15); ctx.quadraticCurveTo(o.x + 11, o.y + 8, o.x + 12, o.y - 7); ctx.closePath(); ctx.stroke(); }
      else { ctx.moveTo(o.x - 9, o.y + 13); ctx.lineTo(o.x - 9, o.y - 15); ctx.lineTo(o.x + 13, o.y + 6); ctx.lineTo(o.x - 9, o.y + 6); ctx.stroke(); }
      text(ctx, o.name, o.x, o.y + 44, 9, o.color, 750);
    }
    const heartbeat = Math.pow((1 + Math.cos(t * Math.PI * 2 * 1.25)) / 2, 5);
    const radius = 32 + heartbeat * 3 + charge * 5;
    ctx.beginPath(); ctx.arc(heart.x, heart.y, radius + 7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,164,167,.08)'; ctx.fill();
    ctx.beginPath(); ctx.arc(heart.x, heart.y, radius, 0, Math.PI * 2); ctx.fillStyle = '#5d3b53'; ctx.fill(); ctx.strokeStyle = '#f6b2b7'; ctx.lineWidth = 1.5; ctx.stroke();
    heartShape(ctx, heart.x, heart.y, 22 + heartbeat * 3, '#ffc6ba');
    if (holding) { ctx.beginPath(); ctx.arc(heart.x, heart.y, radius + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge); ctx.strokeStyle = '#ffe2be'; ctx.lineWidth = 4; ctx.stroke(); text(ctx, `${Math.round(charge * 100)}%`, 210, 618, 10, '#ffe5c1', 700); }
    else text(ctx, pulse?.onBeat ? 'ON THE BEAT' : 'PULSE', 210, 618, 10, '#d8cbd6', 750);
    rounded(ctx, 34, 637, 250, 5, 2, '#243d49'); rounded(ctx, 34, 637, 250 * energy / 100, 5, 2, '#d8a2a4');
    text(ctx, 'ENERGY', 34, 653, 8, '#b8cbd0', 600, 'left');
    for (let i = 0; i < 3; i++) heartShape(ctx, 321 + i * 24, 640, 7, i < hp ? '#ffb9b0' : '#425561');
    if (shield > 0) text(ctx, `SHIELD ${shield.toFixed(1)}s`, 78, 344, 9, '#e4d9ff', 750);
    if (boost > 0) text(ctx, `SAIL ${boost.toFixed(1)}s`, 340, 344, 9, '#ffd3ad', 750);
    if (flash > 0) { ctx.fillStyle = `rgba(255,135,126,${flash * 0.18})`; ctx.fillRect(0, 80, 420, 583); }
    ctx.restore();
  }
  report(true);
  return {
    update(dt) {
      if (done) return; t += dt; distance = Math.min(900, distance + dt * (boost > 0 ? 34 : 22)); energy = Math.min(100, energy + dt * 8);
      visualX += (laneX(lane) - visualX) * Math.min(1, dt * 8); shield = Math.max(0, shield - dt); boost = Math.max(0, boost - dt); invulnerable = Math.max(0, invulnerable - dt); flash = Math.max(0, flash - dt);
      for (let i = 0; i < glow.length; i++) glow[i] = Math.max(0, glow[i] - dt * 1.8);
      if (holding) charge = Math.min(1, charge + dt / 1.05);
      if (pulse) { pulse.progress += dt * 3.6; if (pulse.progress >= 1) { arrive(pulse); pulse = null; } }
      const b = Math.floor(t * 1.25); if (b !== beat) { beat = b; api.tone(80, 0.065, 'sine', 0.018); }
      for (const h of hazards) {
        if (!h.resolved && distance >= h.distance) {
          h.resolved = true;
          if (h.type === 'storm') { if (shield > 0) { api.burst(visualX, 310, '#d8caff', 22); api.tone(660, 0.13, 'sine', 0.07); } else hurt('Use SHIELD just before the storm reaches your ship.'); }
          else if (lane === h.lane) hurt('Use LEFT FIN or RIGHT FIN to avoid a reef.');
        }
      }
      for (const l of lanterns) if (!l.resolved && distance >= l.distance) { l.resolved = true; if (l.lane === lane) { collected++; energy = Math.min(100, energy + 12); api.tone(780, 0.11, 'sine', 0.06); api.burst(visualX, 306, '#ffe5a3', 12); } }
      if (distance >= 900 && !done) { done = true; api.finish({ title: 'Your heartship reached dawn', detail: `${collected} ${collected === 1 ? 'lantern' : 'lanterns'} gathered with ${hp} ${hp === 1 ? 'heart' : 'hearts'} left. A fresh sea awaits your next voyage.`, score: 900 + collected * 120 + hp * 100 }); }
      if (!done) report();
    }, draw,
    pointer(type, p) {
      if (done) return;
      if (type === 'down' && p.y >= 383) { holding = true; charge = 0.08; pointer = p; selected = organs.reduce((best, o, i) => Math.hypot(p.x - o.x, p.y - o.y) < Math.hypot(p.x - organs[best].x, p.y - organs[best].y) ? i : best, 2); }
      else if (type === 'move' && holding) { pointer = p; selected = organs.reduce((best, o, i) => Math.hypot(p.x - o.x, p.y - o.y) < Math.hypot(p.x - organs[best].x, p.y - organs[best].y) ? i : best, selected); }
      else if (type === 'up' && holding) { pointer = p; selected = organs.reduce((best, o, i) => Math.hypot(p.x - o.x, p.y - o.y) < Math.hypot(p.x - organs[best].x, p.y - organs[best].y) ? i : best, selected); holding = false; activate(selected, charge); charge = 0; }
      else if (type === 'cancel') { holding = false; charge = 0; }
    },
    key(type, key) { const index = organs.findIndex(o => o.key === key); if (index < 0 || done) return; if (type === 'down' && !holding) { holding = true; charge = 0.08; selected = index; } else if (type === 'up' && holding) { holding = false; activate(index, charge); charge = 0; } },
    getState: () => ({ game: 'heartship', time: t, distance, lane, hp, energy, shield, boost, holding, charge, selected: organs[selected].id, collected, pulses, done, hazards: hazards.map(h => ({ ...h })), lanterns: lanterns.map(l => ({ ...l })), organs: organs.map(o => ({ ...o })), heart, pulse: pulse ? { ...pulse } : null }),
  };
}

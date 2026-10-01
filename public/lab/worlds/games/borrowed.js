const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const kinds = {
  beetle: { color: '#dfa884', label: 'BEETLE', lesson: 'The beetle turns speed into a rolling start.', speed: 1.05, span: 45 },
  moth: { color: '#8fe5de', label: 'MOTH', lesson: 'Moth wings hold your momentum as they glide.', speed: .65, span: 62 },
  seed: { color: '#f1de9a', label: 'SEED', lesson: 'Seeds catch the updraft and lift your next leap.', speed: .5, span: 28 },
  beacon: { color: '#fff3b5', label: 'HEART OF THE GROVE', lesson: '', speed: 0, span: 0 },
};

export default function createGame(api) {
  const { W = 420, H = 680 } = api;
  const random = api.rng || Math.random;
  const layout = [['beetle', 108, 0], ['moth', 286, 146], ['seed', 132, 295], ['beetle', 290, 451], ['moth', 138, 613], ['seed', 285, 774], ['beacon', 210, 949]];
  const bodies = layout.map(([type, bx, ba], id) => ({ id, type, bx, ba, x: bx, alt: ba, phase: random() * 6.28, vx: 0, va: 0, carryX: 0, carryA: 0, visited: id === 0 }));
  let time = 0, current = 0, camera = 0, aim = null, aiming = false, flight = null;
  let light = 100, transfers = 0, ended = false, metricClock = 0, glow = 0, lastCarriedSpeed = 0;
  const sy = a => H - 145 - (a - camera);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.alt - b.alt);
  const tell = s => api.status?.(s);
  tell('Drag from your glowing creature to the moth above. Release to carry your spark.');
  api.metric?.('Beetle · 0 / 6 leaps · Light 100%');

  function candidates() {
    if (flight) return [];
    const from = bodies[current];
    return bodies.filter(b => b.id !== current && dist(b, from) <= 285 && (b.type !== 'beacon' || bodies.filter(b => b.visited).length >= 5));
  }
  function targetAt(p) {
    if (!p) return null;
    return candidates().map(b => ({ b, d: Math.hypot(b.x - p.x, sy(b.alt) - p.y) })).filter(v => v.d < 63).sort((a, b) => a.d - b.d)[0]?.b || null;
  }
  function update(dt) {
    if (ended) return;
    dt = Math.min(dt, .04);
    const worldDt = dt * (aiming ? .2 : 1);
    time += worldDt;
    glow = Math.max(0, glow - dt);
    light = Math.max(0, light - worldDt * .6);
    for (const b of bodies) {
      const k = kinds[b.type], oldX = b.x, oldA = b.alt;
      b.carryX *= Math.exp(-worldDt * .9); b.carryA *= Math.exp(-worldDt * .6);
      b.x = clamp(b.bx + Math.sin(time * k.speed + b.phase) * k.span + b.carryX, 43, W - 43);
      b.alt = b.ba + (b.type === 'moth' ? Math.sin(time * .7 + b.phase) * 18 : b.type === 'seed' ? 18 + Math.sin(time * .6 + b.phase) * 29 : 0) + b.carryA;
      b.vx = (b.x - oldX) / Math.max(worldDt, .001);
      b.va = (b.alt - oldA) / Math.max(worldDt, .001);
      // Initial placement must not become a false burst of momentum.
      b.vx = clamp(b.vx, -85, 85); b.va = clamp(b.va, -60, 60);
    }
    let focus = bodies[current].alt;
    if (flight) {
      flight.elapsed += dt;
      const p = Math.min(1, flight.elapsed / flight.duration), b = bodies[flight.target];
      flight.x = flight.startX * (1 - p) + b.x * p + Math.sin(p * Math.PI) * flight.vx * .2;
      flight.alt = flight.startAlt * (1 - p) + b.alt * p + Math.sin(p * Math.PI) * (36 + Math.max(0, flight.va) * .3);
      focus = flight.alt;
      if (p >= 1) {
        current = b.id; b.visited = true; transfers++;
        b.carryX = clamp(flight.vx * (b.type === 'moth' ? .4 : .22), -24, 24);
        b.carryA = b.type === 'seed' ? 30 + Math.max(0, flight.va) * .3 : Math.max(0, flight.va) * .18;
        lastCarriedSpeed = Math.round(Math.hypot(flight.vx, flight.va));
        light = Math.min(100, light + 8); flight = null; glow = .8;
        api.burst?.(b.x, sy(b.alt), kinds[b.type].color, 18);
        api.tone?.([196, 247, 294, 330, 392, 494, 587][b.id], .23, 'sine', .11);
        tell(kinds[b.type].lesson + ' Aim for the next bright host.');
        if (b.type === 'beacon') {
          ended = true;
          api.finish?.({ title: 'One spark. Many lives.', detail: `You carried the spark home through ${transfers} leaps. ${bodies.filter(v => v.visited && v.type !== 'beacon').length} creatures shared the journey.`, score: Math.round(light * 10) + bodies.filter(v => v.visited).length * 150 });
        }
      }
    }
    camera += (Math.max(0, focus - 240) - camera) * Math.min(1, dt * 5.2);
    metricClock -= dt;
    if (metricClock <= 0) {
      api.metric?.(`${kinds[bodies[current].type].label} · ${bodies.filter(b => b.visited).length - 1} / 6 leaps · Light ${Math.ceil(light)}%`);
      metricClock = .25;
    }
    if (light <= 0 && !ended) {
      ended = true;
      api.finish?.({ title: 'The spark is resting', detail: 'Your next journey starts with the beetle. Hold to slow time, then release over a glowing host.', score: transfers * 150 });
    }
  }

  function draw(ctx) {
    ctx.save();
    const tint = ctx.createLinearGradient(0, 0, 0, H); tint.addColorStop(0, 'rgba(8,30,29,.16)'); tint.addColorStop(1, 'rgba(13,24,26,.7)');
    ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 23; i++) {
      const x = (i * 71 + Math.sin(time * .3 + i) * 17 + W) % W;
      const y = ((i * 103 + camera * .38 - time * 8) % 720 + 720) % 720;
      ctx.fillStyle = `rgba(235,233,174,${.12 + (Math.sin(time + i) + 1) * .14})`; ctx.beginPath(); ctx.arc(x, y, 1 + i % 2, 0, 7); ctx.fill();
    }
    const reachable = candidates(), targeted = aiming ? targetAt(aim) : null;
    const from = bodies[current];
    for (const b of bodies) {
      const y = sy(b.alt), k = kinds[b.type];
      if (y < -110 || y > H + 90) continue;
      const isReachable = reachable.some(r => r.id === b.id);
      if (isReachable) {
        ctx.strokeStyle = targeted?.id === b.id ? '#fbf1bb' : 'rgba(203,232,206,.3)'; ctx.lineWidth = targeted?.id === b.id ? 2 : 1;
        ctx.setLineDash([3, 7]); ctx.beginPath(); ctx.arc(b.x, y, 35 + Math.sin(time * 2) * 2, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        if (!b.visited) { ctx.fillStyle = '#deedd8'; ctx.font = '600 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(b.type === 'beacon' ? 'BRING THE SPARK HOME' : 'NEXT HOST', b.x, y - 48); }
      }
      if (b.type === 'beetle') {
        ctx.strokeStyle = 'rgba(111,145,105,.65)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(b.bx - 66, y + 20); ctx.quadraticCurveTo(b.bx, y + 35, b.bx + 65, y + 20); ctx.stroke();
        ctx.strokeStyle = 'rgba(186,181,130,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.bx - 62, y + 18); ctx.quadraticCurveTo(b.bx, y + 29, b.bx + 63, y + 18); ctx.stroke();
      }
      if (b.type === 'seed') {
        for (let j = 0; j < 4; j++) {
          const yy = y + 60 + ((j * 23 - time * 24) % 70);
          ctx.strokeStyle = 'rgba(175,216,199,.18)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.bx - 28 + j * 18, yy); ctx.quadraticCurveTo(b.bx - 18 + j * 18, yy - 15, b.bx - 25 + j * 18, yy - 32); ctx.stroke();
        }
      }
      ctx.save(); ctx.translate(b.x, y);
      if (b.id === current && !flight) {
        const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 48 + glow * 20); halo.addColorStop(0, 'rgba(255,227,156,.45)'); halo.addColorStop(1, 'rgba(255,227,156,0)'); ctx.fillStyle = halo; ctx.fillRect(-68, -68, 136, 136);
      }
      drawBody(ctx, b.type, time + b.phase, k.color, b.vx);
      if (b.visited && b.id !== current) { ctx.fillStyle = '#ddedc0'; ctx.beginPath(); ctx.arc(24, -19, 3, 0, 7); ctx.fill(); }
      if (b.id === current && !flight) {
        ctx.fillStyle = '#fff5c5'; ctx.shadowColor = '#fff5bb'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, -5, 4.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff3cd'; ctx.font = '600 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('YOU', 0, 43);
      }
      ctx.restore();
    }
    if (aiming && aim && !flight) {
      const tx = targeted ? targeted.x : aim.x, ty = targeted ? sy(targeted.alt) : aim.y;
      const fy = sy(from.alt);
      ctx.strokeStyle = targeted ? '#f9edb3' : 'rgba(211,229,216,.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 7]);
      ctx.beginPath(); ctx.moveTo(from.x, fy); ctx.quadraticCurveTo((from.x + tx) / 2 + from.vx * .12, Math.min(fy, ty) - 50, tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = targeted ? '#fcf1c4' : '#aac1ba'; ctx.beginPath(); ctx.arc(tx, ty, 7, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff0c6'; ctx.textAlign = 'center'; ctx.font = '600 11px system-ui'; ctx.fillText(targeted ? 'RELEASE TO TRANSFER' : 'AIM AT A GLOWING HOST', W / 2, H - 142);
    }
    if (flight) {
      const y = sy(flight.alt);
      ctx.strokeStyle = 'rgba(254,224,152,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(flight.startX, sy(flight.startAlt)); ctx.quadraticCurveTo((flight.startX + flight.x) / 2, Math.min(sy(flight.startAlt), y) - 36, flight.x, y); ctx.stroke();
      const fire = ctx.createRadialGradient(flight.x, y, 0, flight.x, y, 22); fire.addColorStop(0, 'rgba(255,249,206,.95)'); fire.addColorStop(.25, 'rgba(255,214,113,.5)'); fire.addColorStop(1, 'rgba(255,203,103,0)'); ctx.fillStyle = fire; ctx.fillRect(flight.x - 22, y - 22, 44, 44);
    }
    ctx.fillStyle = 'rgba(10,30,31,.84)'; rounded(ctx, 24, H - 109, W - 48, 84, 22); ctx.fill();
    ctx.strokeStyle = 'rgba(188,221,198,.22)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = kinds[from.type].color; ctx.font = '700 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(kinds[from.type].label, 44, H - 80);
    ctx.fillStyle = '#d3e3da'; ctx.font = '11px system-ui'; ctx.fillText(aiming ? 'Time slows while you aim.' : 'Drag to a host. Release to leap.', 44, H - 60);
    ctx.fillStyle = 'rgba(220,229,205,.65)'; ctx.font = '10px system-ui'; ctx.fillText(transfers ? `Momentum carried: ${lastCarriedSpeed}` : 'Touch a host to preview your next leap.', 44, H - 42);
    ctx.strokeStyle = 'rgba(222,234,205,.2)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(W - 18, 210); ctx.lineTo(W - 18, 330); ctx.stroke();
    for (let i = 0; i < bodies.length; i++) { ctx.fillStyle = bodies[i].visited ? '#e2e9ae' : '#566963'; ctx.beginPath(); ctx.arc(W - 18, 330 - i * 20, i === current ? 5 : 3, 0, 7); ctx.fill(); }
    ctx.restore();
  }

  function pointer(type, p) {
    if (ended || flight) return;
    if (type === 'down') { aiming = true; aim = { ...p }; }
    if (type === 'move' && aiming) aim = { ...p };
    if (type === 'cancel') { aiming = false; aim = null; }
    if (type === 'up' && aiming) {
      aim = { ...p };
      const target = targetAt(aim), from = bodies[current];
      aiming = false;
      if (target) {
        flight = { target: target.id, startX: from.x, startAlt: from.alt, x: from.x, alt: from.alt, vx: from.vx, va: from.va, elapsed: 0, duration: .58 };
        api.tone?.(660, .06, 'sine', .055);
        tell('Your momentum travels with the spark.');
      } else {
        tell('Release over a bright host within reach. Hold to slow time as it moves.');
      }
      aim = null;
    }
  }
  function key(type, key) {
    if (type !== 'down' || ended || flight) return;
    if (key === ' ' || key === 'Enter') {
      const target = candidates().filter(b => b.id > current).sort((a, b) => a.id - b.id)[0];
      if (target) { const p = { x: target.x, y: sy(target.alt) }; pointer('down', p); pointer('up', p); }
    }
  }
  return { update, draw, pointer, key, getState: () => ({ game: 'borrowed', phase: ended ? 'ended' : flight ? 'flight' : 'playing', current, light, transfers, aiming, time, camera, lastCarriedSpeed, bodies: bodies.map(b => ({ id: b.id, type: b.type, x: b.x, y: sy(b.alt), alt: b.alt, vx: b.vx, va: b.va, visited: b.visited, reachable: candidates().some(c => c.id === b.id) })) }) };
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
  } else if (type === 'seed') {
    ctx.rotate(Math.sin(t * .6) * .2);
    ctx.strokeStyle = '#eee3b3'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(0, -15); ctx.stroke();
    for (let i = 0; i < 13; i++) { const a = Math.PI + i / 12 * Math.PI; const x = Math.cos(a) * 25, y = Math.sin(a) * 21 - 8; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = '#f3ebc6'; ctx.beginPath(); ctx.ellipse(x, y, 2.5, 5, a + Math.PI / 2, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#c7a46a'; ctx.beginPath(); ctx.ellipse(0, 13, 5, 10, -.2, 0, 7); ctx.fill();
  } else {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 65); g.addColorStop(0, 'rgba(255,229,145,.5)'); g.addColorStop(1, 'rgba(255,229,145,0)'); ctx.fillStyle = g; ctx.fillRect(-65, -65, 130, 130);
    ctx.strokeStyle = '#b9c297'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 50); ctx.quadraticCurveTo(-7, 24, 0, 0); ctx.stroke();
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + Math.sin(t) * .05; ctx.save(); ctx.rotate(a); ctx.fillStyle = i % 2 ? '#eacb88' : '#fff0b3'; ctx.beginPath(); ctx.ellipse(0, -16, 7, 18, 0, 0, 7); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#ffefb4'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
  }
  ctx.restore();
}
function rounded(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

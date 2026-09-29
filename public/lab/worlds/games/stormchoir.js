const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function createGame(api) {
  const { W = 420, H = 680 } = api;
  const random = api.rng || Math.random;
  const birds = Array.from({ length: 8 }, (_, i) => ({
    x: 188 + (i % 4) * 13, vx: 0, lane: (i % 4 - 1.5) * 13,
    weight: i < 5 ? 1 : 1.8, phase: random() * Math.PI * 2,
  }));
  const gates = [115, 300, 138, 286, 118, 266].map((x, i) => ({
    x: x + (random() - .5) * 16, alt: 225 + i * 205, hit: false, passed: false,
  }));
  const storms = gates.slice(1).map((g, i) => ({ x: i % 2 ? 335 : 78, alt: g.alt - 88, r: 42 }));
  let time = 0, altitude = 0, camera = 0, targetX = 210, held = false, fingerY = 614;
  let health = 100, passed = 0, notes = 0, ended = false, lastGate = -1, check = 0;
  let damageFlash = 0;
  const sy = a => H - 145 - (a - camera);
  const tell = s => api.status?.(s);
  tell('Hold the wind pad. Move left or right to carry the flock through gold rings.');
  api.metric?.('0 / 6 songs · Flock 100%');

  function update(dt) {
    if (ended) return;
    dt = Math.min(dt, .04);
    time += dt;
    altitude += dt * (held ? 48 + clamp((H - fingerY) / 200, 0, 1) * 28 : 11);
    camera = Math.max(0, altitude - 252);
    damageFlash = Math.max(0, damageFlash - dt);
    let touchingStorm = false;
    for (const [i, b] of birds.entries()) {
      const wind = Math.sin(time * 1.05 + b.phase) * (held ? 5 : 13);
      const desired = clamp(targetX + b.lane + wind, 30, W - 30);
      b.vx += ((desired - b.x) * (held ? 6.5 : 1.8) / b.weight - b.vx * 4.1) * dt;
      b.x = clamp(b.x + b.vx * dt, 24, W - 24);
      for (const s of storms) {
        const dx = b.x - s.x, dy = altitude + Math.sin(time * 2 + i) * 9 - s.alt;
        if (dx * dx + dy * dy < (s.r + 8) ** 2) {
          health -= dt * 3.5;
          b.vx += Math.sign(dx || 1) * dt * 38;
          touchingStorm = true;
        }
      }
    }
    if (touchingStorm) damageFlash = .2;
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i];
      if (g.passed || altitude < g.alt) continue;
      g.passed = true;
      const count = birds.filter(b => Math.abs(b.x - g.x) < 83).length;
      notes += count;
      g.hit = count >= 5;
      lastGate = i;
      if (g.hit) {
        passed++;
        health = Math.min(100, health + 7);
        api.burst?.(g.x, sy(g.alt), '#ffe5a1', 22);
        api.tone?.([262, 294, 330, 392, 440, 523][i], .3, 'sine', .13);
        tell(i === 5 ? 'The forest is waking. Carry the flock into the dawn.' : `${count} voices joined the song. Follow the next gold ring.`);
      } else {
        health = Math.max(0, health - 13);
        tell('The heavy lanterns turn slowly. Start the next turn earlier.');
        api.tone?.(155, .14, 'triangle', .05);
      }
    }
    check -= dt;
    if (check <= 0) {
      api.metric?.(`${passed} / 6 songs · Flock ${Math.ceil(health)}%`);
      check = .25;
    }
    if (health <= 0 || altitude > 1395) {
      ended = true;
      const win = health > 0 && passed >= 4;
      api.finish?.({ title: win ? 'You brought the rain' : 'The flock needs your wind', detail: win ? `${passed} songs and ${notes} voices carried the rain home. The forest blooms beneath you.` : `${passed} of 6 songs reached the forest. Guide at least 5 creatures through each ring; 4 songs will awaken the forest.`, score: win ? notes * 100 + Math.round(health * 10) : notes * 100 });
    }
  }

  function draw(ctx) {
    ctx.save();
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(7,26,45,.15)'); shade.addColorStop(1, 'rgba(8,27,35,.58)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    // Wind threads remain behind the flock so direction is easy to read.
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const y = ((i * 59 + time * (held ? 42 : 18)) % (H + 80)) - 40;
      const x = (i * 83 % W) + Math.sin(time + i) * 18;
      ctx.strokeStyle = `rgba(174,226,237,${held ? .24 : .1})`;
      ctx.beginPath(); ctx.moveTo(x, y + 48);
      ctx.quadraticCurveTo(x + (targetX - 210) * .12, y + 24, x + (targetX - 210) * .24, y);
      ctx.stroke();
    }
    for (const s of storms) {
      const y = sy(s.alt);
      if (y < -80 || y > H + 70) continue;
      const glow = ctx.createRadialGradient(s.x, y, 8, s.x, y, 72);
      glow.addColorStop(0, 'rgba(107,99,176,.42)'); glow.addColorStop(1, 'rgba(60,65,133,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(s.x, y, 73, 0, 7); ctx.fill();
      for (let j = 0; j < 4; j++) {
        ctx.strokeStyle = `rgba(191,161,236,${.35 - j * .055})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(s.x, y, 25 + j * 8, 12 + j * 6, time * .25 + j * .5, .3 + time, 4.8 + time); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(215,206,255,.8)'; ctx.font = '9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('STORM', s.x, y + 55);
    }
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i], y = sy(g.alt);
      if (y < -110 || y > H + 100) continue;
      ctx.globalAlpha = g.passed ? .28 : 1;
      const bloom = ctx.createRadialGradient(g.x, y, 20, g.x, y, 102);
      bloom.addColorStop(0, 'rgba(250,206,110,.015)'); bloom.addColorStop(.77, 'rgba(250,206,110,.04)'); bloom.addColorStop(.85, 'rgba(250,206,110,.16)'); bloom.addColorStop(1, 'rgba(250,206,110,0)');
      ctx.fillStyle = bloom; ctx.beginPath(); ctx.arc(g.x, y, 103, 0, 7); ctx.fill();
      ctx.strokeStyle = g.passed ? (g.hit ? '#8bdfc0' : '#c27c8d') : '#f8d897'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(g.x, y, 85, 35, 0, 0, 7); ctx.stroke();
      for (let j = 0; j < 9; j++) {
        const a = j / 9 * Math.PI * 2 + time * .12;
        ctx.fillStyle = '#ffecb5'; ctx.beginPath(); ctx.arc(g.x + Math.cos(a) * 85, y + Math.sin(a) * 35, 2, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#fff0c9'; ctx.font = '600 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText(g.passed ? (g.hit ? 'SONG CARRIED' : 'MISSED') : `SONG ${i + 1}`, g.x, y - 49);
      ctx.globalAlpha = 1;
    }
    const flockY = sy(altitude);
    for (const [i, b] of birds.entries()) {
      const y = flockY + Math.sin(time * 2.4 + b.phase) * 8 + (i > 4 ? 17 : -6);
      ctx.save(); ctx.translate(b.x, y); ctx.rotate(clamp(b.vx * .009, -.32, .32));
      if (b.weight > 1) {
        const aura = ctx.createRadialGradient(0, 0, 1, 0, 0, 25);
        aura.addColorStop(0, 'rgba(255,222,141,.55)'); aura.addColorStop(1, 'rgba(255,200,70,0)');
        ctx.fillStyle = aura; ctx.fillRect(-25, -25, 50, 50);
        ctx.fillStyle = '#ffd17b'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 10, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff2bb'; ctx.beginPath(); ctx.ellipse(-1, -2, 3, 6, -.2, 0, 7); ctx.fill();
        ctx.strokeStyle = '#dcaa66'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-4, 9); ctx.quadraticCurveTo(-8, 19, 0, 21); ctx.moveTo(4, 9); ctx.quadraticCurveTo(9, 16, 3, 21); ctx.stroke();
      } else {
        const wing = Math.sin(time * 7 + b.phase) * 6;
        ctx.fillStyle = i % 2 ? '#c4f8ef' : '#e3eefa';
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(-8, -10 - wing, -18, -4 - wing); ctx.quadraticCurveTo(-10, 7, 0, 5); ctx.quadraticCurveTo(11, 8, 18, -4 - wing); ctx.quadraticCurveTo(7, -9 - wing, 0, 4); ctx.fill();
        ctx.fillStyle = '#f7ffe8'; ctx.beginPath(); ctx.ellipse(0, 0, 3, 7, 0, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // Safe thumb zone is part of the scene; it never hides a target.
    ctx.fillStyle = 'rgba(9,26,40,.78)'; rounded(ctx, 24, H - 112, W - 48, 88, 24); ctx.fill();
    ctx.strokeStyle = held ? 'rgba(194,241,228,.65)' : 'rgba(203,221,229,.22)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(200,229,232,.3)'; ctx.beginPath(); ctx.moveTo(56, H - 70); ctx.lineTo(W - 56, H - 70); ctx.stroke();
    ctx.fillStyle = held ? '#d1f8e7' : '#749ca9'; ctx.beginPath(); ctx.arc(clamp(targetX, 56, W - 56), H - 70, held ? 12 : 8, 0, 7); ctx.fill();
    ctx.fillStyle = '#d2e8ea'; ctx.textAlign = 'center'; ctx.font = '600 10px system-ui'; ctx.fillText(held ? 'MOVE THE WIND  ·  LIFT HIGHER TO CLIMB' : 'HOLD HERE AND GUIDE THE WIND', W / 2, H - 40);
    ctx.fillStyle = 'rgba(218,233,238,.7)'; ctx.font = '10px system-ui'; ctx.fillText('5 gliders  +  3 heavy lanterns', W / 2, H - 126);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = gates[i].passed ? (gates[i].hit ? '#c3efbd' : '#af768c') : 'rgba(226,231,224,.25)';
      ctx.beginPath(); ctx.arc(W - 18, 230 + i * 17, 3, 0, 7); ctx.fill();
    }
    if (damageFlash) { ctx.strokeStyle = 'rgba(210,145,230,.5)'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, W - 6, H - 6); }
    ctx.restore();
  }
  function pointer(type, p) {
    if (ended) return;
    if (type === 'down' || type === 'move' && held) {
      held = true; targetX = clamp(p.x, 50, W - 50); fingerY = clamp(p.y, 100, H);
      if (type === 'down' && altitude < 15) tell('Carry at least 5 creatures through each ring. Four songs will bring the rain.');
    } else if (type === 'up' || type === 'cancel') held = false;
  }
  function key(type, key) {
    if (type === 'down') {
      if (key === 'ArrowLeft' || key === 'a') { held = true; targetX = clamp(targetX - 45, 50, W - 50); }
      if (key === 'ArrowRight' || key === 'd') { held = true; targetX = clamp(targetX + 45, 50, W - 50); }
      if (key === ' ' || key === 'ArrowUp') held = true;
    } else if (type === 'up' && (key === ' ' || key === 'ArrowUp')) held = false;
  }
  return { update, draw, pointer, key, getState: () => ({ game: 'stormchoir', phase: ended ? 'ended' : 'playing', altitude, health, passed, notes, targetX, held, lastGate, birds: birds.map(b => ({ x: b.x, weight: b.weight })), gates: gates.map(g => ({ ...g, y: sy(g.alt) })), nextGate: gates.find(g => !g.passed) || null }) };
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

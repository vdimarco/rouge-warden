import { LENGTH, createRun, step, callFlock, birdPosition, chapter, clamp } from './crossing.js';

const $ = s => document.querySelector(s);
const canvas = $('#game'), ctx = canvas.getContext('2d');
const panel = $('#panel'), call = $('#call'), controls = $('#controls');
const pauseButton = $('#pause'), message = $('#message');
const art = {};
for (const name of ['lake', 'parent', 'chick', 'rock', 'boat', 'nest', 'mint-chick']) {
  art[name] = new Image(); art[name].src = new URL(`./art/${name}.webp`, import.meta.url).href;
}
let W = 0, H = 0, P = 0, offset = 0, run = null, paused = false;
let last = 0, audio, pointer = null, noticeUntil = 0, shake = 0, particles = [];
const keys = new Set();
function resize() {
  W = innerWidth; H = innerHeight; P = Math.min(W, H * .78, 680); offset = (W - P) / 2;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();
function tone(freq = 500, duration = .12, type = 'sine', volume = .045) {
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * .65, audio.currentTime + duration);
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
  } catch { /* Sound is optional; a blocked audio device must not stop the game. */ }
}
function notice(text, seconds = 3.8) { message.textContent = text; noticeUntil = (run?.elapsed || 0) + seconds; }
function start() {
  run = createRun(); paused = false; pointer = null; keys.clear(); particles = []; shake = 0;
  panel.hidden = true; controls.hidden = false; pauseButton.hidden = false;
  pauseButton.textContent = 'Ⅱ'; last = performance.now();
  tone(680, .3); if (audio) audio.resume().catch(() => {});
  notice('Find the golden chick. It will follow your turns.', 6); updateHud();
}
$('#start').onclick = start;
function gather() { if (run && !paused && callFlock(run)) { tone(880, .45, 'triangle'); consumeEvents(); updateHud(); } }
call.onclick = gather;
function steer(e) { if (run && !paused && !run.ended) run.target = clamp((e.clientX - offset) / P, .1, .9); }
canvas.addEventListener('pointerdown', e => { pointer = e.pointerId; canvas.setPointerCapture(e.pointerId); steer(e); });
canvas.addEventListener('pointermove', e => { if (pointer === e.pointerId) steer(e); });
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, () => { pointer = null; });
addEventListener('keydown', e => {
  if (e.key === ' ' && (e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) return;
  if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'Escape', 'p'].includes(e.key)) e.preventDefault();
  keys.add(e.key);
  if (e.key === ' ' && !e.repeat) gather();
  if ((e.key === 'Escape' || e.key === 'p') && !e.repeat) togglePause();
});
addEventListener('keyup', e => keys.delete(e.key));
function togglePause(force) {
  if (!run || run.ended) return;
  paused = typeof force === 'boolean' ? force : !paused; keys.clear(); pointer = null;
  pauseButton.textContent = paused ? '▶' : 'Ⅱ';
  pauseButton.setAttribute('aria-label', paused ? 'Resume crossing' : 'Pause crossing');
  if (paused) {
    panel.innerHTML = '<span class="eyebrow">TAKE A BREATHER</span><h1>LAKE<br>BREAK</h1><p>Your little weirdos can wait.</p><button id="resume">KEEP PADDLING</button>';
    panel.hidden = false; $('#resume').onclick = () => togglePause(false);
  } else { panel.hidden = true; last = performance.now(); }
  updateHud();
}
pauseButton.onclick = () => togglePause();
addEventListener('blur', () => { if (run && !run.ended) togglePause(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) togglePause(true); });
function finish() {
  let best = 0;
  try { best = Number(localStorage.getItem('loon-echo-home-best')) || 0; } catch {}
  if (run.won) { best = Math.max(best, run.chicks); try { localStorage.setItem('loon-echo-home-best', String(best)); } catch {} }
  const title = run.won ? (run.chicks ? 'HOME.<br>MOSTLY SANE.' : 'HOME.<br>VERY QUIET.') : 'SHORE<br>LEAVE.';
  panel.innerHTML = `<span class="eyebrow">${run.won ? 'CROSSING COMPLETE' : 'THE LAKE WON THIS ROUND'}</span><h1>${title}</h1><div class="result">${run.chicks} / 8</div><p>${run.won ? 'little weirdos brought home' : 'chicks still with you at the rest stop'}</p><p class="small">${run.rescued} rescued · ${run.lost} swam safely ashore<br>Most brought home: ${best}</p><p>${run.won ? 'Same lake. Another chance to bring the whole family.' : 'Leave room for your tail. CALL lets you ride through wakes.'}</p><button id="again">ONE MORE CROSSING</button>`;
  panel.hidden = false; controls.hidden = true; pauseButton.hidden = true;
  message.textContent = ''; $('#again').onclick = start;
  tone(run.won ? 920 : 190, .5, 'triangle');
}
function consumeEvents() {
  for (const event of run.events.splice(0)) {
    if (event.text) notice(event.text);
    if (event.kind === 'rescue') { tone(850, .2); burst(run.x, .52, '#f8df7c'); }
    if (event.kind === 'hit') { tone(120, .2, 'sawtooth', .035); shake = .3; burst(run.x, .58, '#edaaeb'); }
    if (event.kind === 'warning') tone(250, .35, 'triangle');
    if (event.kind === 'end') finish();
  }
}
function updateHud() {
  $('#flock').textContent = run.chicks ? `${run.chicks} little ${run.chicks === 1 ? 'weirdo' : 'weirdos'}` : 'Just you';
  $('#hearts').textContent = '♥ '.repeat(run.hearts) + '♡ '.repeat(3 - run.hearts);
  $('#hearts').setAttribute('aria-label', `${run.hearts} energy`);
  $('#chapter').textContent = chapter(run.elapsed);
  $('#progress').value = run.elapsed;
  call.disabled = paused || run.cooldown > 0;
  call.classList.toggle('active', run.call > 0);
  call.textContent = run.call > 0 ? 'HOLDING TOGETHER!' : run.cooldown > 0 ? `CALL IN ${Math.ceil(run.cooldown)}s` : 'CALL THE FLOCK';
  message.style.opacity = run.elapsed > noticeUntil ? '0' : '1';
}
function burst(x, y, color) { for (let i = 0; i < 15; i++) particles.push({x, y, vx:(Math.random() - .5) * .35, vy:(Math.random() - .5) * .3, life:1, color}); }
const px = x => offset + x * P;
function ellipse(x, y, rx, ry, color, line = '#162732') {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = 2.5; ctx.stroke(); }
}
function sprite(name, x, y, width, angle = 0) {
  const img = art[name];
  if (!img.complete || !img.naturalWidth) return false;
  const height = width * img.height / img.width;
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.drawImage(img, -width / 2, -height / 2, width, height); ctx.restore(); return true;
}
function bird(x, y, index, t, waiting = false) {
  const size = Math.min(index ? 28 : 29, P * (index ? .065 : .067));
  const sx = px(x), sy = y * H + Math.sin(t * 7 + index) * 1.8;
  ellipse(sx, sy + size * .36, size * .65, size * .18, '#8becbd25', null);
  const angle = run && !waiting ? clamp(run.target - x, -.25, .25) * .6 : Math.sin(t * 2) * .07;
  if (!sprite(index ? (index % 2 ? 'chick' : 'mint-chick') : 'parent', sx, sy, size, angle)) {
    ellipse(sx, sy, size * .4, size * .48, index ? '#efd774' : '#b5dddd');
    ellipse(sx - size * .16, sy - size * .22, size * .16, size * .2, '#fff');
    ellipse(sx + size * .16, sy - size * .22, size * .16, size * .2, '#fff');
    ellipse(sx, sy - size * .25, 2, 3, '#111');
  }
}
function drawBackground(t) {
  ctx.fillStyle = '#101e25'; ctx.fillRect(0, 0, W, H);
  const img = art.lake;
  if (img.complete && img.naturalWidth) {
    if (offset > 0) { ctx.globalAlpha = .18; ctx.drawImage(img, 0, 0, W, H); ctx.globalAlpha = 1; }
    ctx.drawImage(img, offset, 0, P, H);
  } else { ctx.fillStyle = '#23534f'; ctx.fillRect(offset, 0, P, H); }
  // Gentle moving ink ripples keep the lake alive without hiding incoming hazards.
  ctx.strokeStyle = '#b3f1cf21'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    const x = px(.17 + ((i * .137) % .66)), y = ((i * 79 + t * 14) % H);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 9, y + 4, x + 24, y); ctx.stroke();
  }
  if (offset) { ctx.strokeStyle = '#97e6a02b'; ctx.lineWidth = 2; ctx.strokeRect(offset, -2, P, H + 4); }
}
function drawObjects(t) {
  for (const o of run.objects) {
    if (o.type === 'rock') {
      if (!sprite('rock', px(o.x), o.y * H, P * .135)) ellipse(px(o.x), o.y * H, P * .06, H * .034, '#a78baf');
    } else if (o.type === 'chick') {
      const pulse = 1 + Math.sin(t * 5) * .08;
      ctx.save(); ctx.strokeStyle = '#ffe594'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.ellipse(px(o.x), o.y * H, P * .061 * pulse, P * .058 * pulse, 0, 0, 7); ctx.stroke(); ctx.restore();
      bird(o.x, o.y, 1, t, true);
      ctx.font = '800 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a7'; ctx.fillText('RESCUE', px(o.x), o.y * H - P * .072);
    } else if (o.type === 'boat') {
      if (o.age < 1.8) {
        const x = o.direction > 0 ? .08 : .92;
        ellipse(px(x), o.y * H, 16, 16, '#f7a9b6');
        ctx.fillStyle = '#152e34'; ctx.font = '900 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', px(x), o.y * H + 7);
      } else {
        ctx.save(); ctx.translate(px(o.x), o.y * H); ctx.scale(o.direction, 1);
        if (!sprite('boat', 0, 0, P * .25)) ellipse(0, 0, P * .1, H * .028, '#f2a6a4');
        ctx.restore();
      }
    } else if (o.type === 'wake') {
      ctx.strokeStyle = '#bef4d8'; ctx.lineWidth = 4;
      for (let side = 0; side < 2; side++) {
        const from = side ? o.gap + .16 : .03, to = side ? .97 : o.gap - .16;
        ctx.beginPath();
        for (let x = from; x <= to; x += .006) {
          const y = o.y * H + Math.sin(x * 75 + t * 6) * 4;
          if (x === from) ctx.moveTo(px(x), y); else ctx.lineTo(px(x), y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = '#bef4d8'; ctx.font = '800 10px system-ui'; ctx.textAlign = 'center'; ctx.fillText('CALM GAP', px(o.gap), o.y * H - 10);
    }
  }
}
function draw(ts) {
  requestAnimationFrame(draw);
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  if (run && !paused && !run.ended) {
    if (keys.has('ArrowLeft') || keys.has('a')) run.target -= dt * .7;
    if (keys.has('ArrowRight') || keys.has('d')) run.target += dt * .7;
    step(run, dt); consumeEvents(); updateHud();
  }
  const t = run?.elapsed || ts / 1000;
  drawBackground(t);
  ctx.save(); ctx.beginPath(); ctx.rect(offset, 0, P, H); ctx.clip();
  if (run) {
    if (!paused) shake = Math.max(0, shake - dt);
    if (shake) ctx.translate(Math.sin(ts * .07) * shake * 12, 0);
    drawObjects(t);
    if (run.elapsed > LENGTH - 8) {
      const y = clamp((run.elapsed - (LENGTH - 8)) / 8, 0, 1) * .27;
      ellipse(px(.5), y * H, P * .23, H * .07, '#9bc686');
      sprite('nest', px(.5), y * H, P * .2);
      ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f4efbc'; ctx.fillText('HOME, WEIRD HOME', px(.5), y * H - H * .085);
    }
    if (run.call > 0) {
      ctx.strokeStyle = '#c6fc8b'; ctx.lineWidth = 3; ctx.globalAlpha = .4 + .2 * Math.sin(t * 8);
      const b = birdPosition(run, run.chicks);
      ctx.beginPath(); ctx.ellipse(px(run.x), (.52 + b.y) * H / 2, P * .09, (b.y - .52) * H / 2 + 34, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (let i = run.chicks; i >= 0; i--) {
      const b = birdPosition(run, i);
      ctx.globalAlpha = run.invincible && Math.floor(t * 10) % 2 ? .4 : 1;
      bird(b.x, b.y, i, t);
    }
    ctx.globalAlpha = 1;
    for (const p of particles) {
      if (!paused) { p.life -= dt * 1.7; p.x += p.vx * dt; p.y += p.vy * dt; }
      ctx.globalAlpha = Math.max(0, p.life); ellipse(px(p.x), p.y * H, 3, 3, p.color, null);
    }
    particles = particles.filter(p => p.life > 0); ctx.globalAlpha = 1;
  }
  ctx.restore();
}
requestAnimationFrame(draw);

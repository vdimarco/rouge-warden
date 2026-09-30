import { createCamera, updateCamera, worldToScreen, screenToWorld, clamp } from './camera.js';
import { F } from './physics.js';
import { FIELD_DURATION, FIELD_RADIUS } from './adventure.js';

const TAU = Math.PI * 2;
const SPRITES = { ice: [5,132,436,421], amber: [396,143,489,391], violet: [837,133,414,422], asteroid: [14,681,425,420], portal: [808,673,437,434] };
const PALETTE = ['#7ee8ff', '#ffa967', '#cbb4ff', '#7dffd4', '#ff95bd', '#ffe4a0'];
const FIELD_COLORS = { pull: '#79f5ed', push: '#e8a5ff', invalid: '#ff9b82' };
const rand = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const point = (p) => Array.isArray(p) ? p : [p.x, p.y];
const circle = (g, x, y, radius) => { g.beginPath(); g.arc(x, y, Math.max(0, radius), 0, TAU); };

export function createRenderer(canvas, minimap) {
  const g = canvas.getContext('2d', { alpha: false });
  const mg = minimap?.getContext('2d');
  const camera = createCamera();
  const assets = {};
  const particles = [];
  const rings = [];
  const trail = [];
  let width = 1, height = 1, dpr = 1, mapW = 156, mapH = 116;
  let lastWorld = null, reducedMotion = false;
  const stars = Array.from({ length: 680 }, (_, i) => ({ x: rand(i * 3 + 1) * 4200 - 300, y: rand(i * 3 + 2) * 3400 - 300, r: 0.6 + rand(i * 3 + 3) * 1.7, a: 0.17 + rand(i * 7) * 0.55 }));

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    width = Math.max(1, bounds.width || globalThis.innerWidth || 1000);
    height = Math.max(1, bounds.height || globalThis.innerHeight || 700);
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    camera.width = width;
    camera.height = height;
    if (minimap) {
      const box = minimap.getBoundingClientRect();
      mapW = Math.max(100, box.width || 156);
      mapH = Math.max(64, box.height || 116);
      minimap.width = Math.round(mapW * dpr);
      minimap.height = Math.round(mapH * dpr);
    }
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  globalThis.addEventListener?.('resize', resize);
  resize();

  function loadAssets(sources = {}) {
    return Promise.all(Object.entries(sources).map(([key, url]) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { assets[key] = img; resolve(true); };
      img.onerror = () => resolve(false);
      img.src = url;
    })));
  }

  loadAssets({ nebula: new URL('./assets/deep-space.webp', import.meta.url).href, sprites: new URL('./assets/celestial-sprites.webp', import.meta.url).href });

  function sprite(name, x, y, w, h = w) {
    if (!assets.sprites) return false;
    g.save(); g.translate(x - w / 2, y + h / 2); g.scale(1, -1);
    g.drawImage(assets.sprites, ...SPRITES[name], 0, 0, w, h);
    g.restore(); return true;
  }

  function onEvent(event, run) {
    if (!event) return;
    const type = event.type || event.k;
    const x = event.x ?? run?.world?.ball?.x ?? 0;
    const y = event.y ?? run?.world?.ball?.y ?? 0;
    const fieldEvent = type === 'field-deploy' || type === 'field-expire';
    const color = fieldEvent ? FIELD_COLORS[event.kind] || FIELD_COLORS.pull : type === 'orbit' ? '#ffe6a6' : run?.sectors?.[run.sectorIndex]?.color || '#8deeff';
    const large = ['gate', 'clear', 'depart', 'arrive', 'won', 'pulse', 'save', 'recall', 'orbit', 'field-deploy'].includes(type);
    if (fieldEvent || ['relay', 'bumper', 'gate', 'clear', 'depart', 'arrive', 'won', 'pulse', 'save', 'recall', 'launch', 'orbit', 'rescue'].includes(type)) {
      rings.push({ x, y, age: 0, life: fieldEvent ? 0.55 : large ? 0.8 : 0.35, r: fieldEvent ? FIELD_RADIUS - 15 : large ? 220 : 75, inward: type === 'field-expire', color: type === 'relay' ? '#fff2b0' : color });
      if (!reducedMotion) {
        const count = large ? 26 : type === 'relay' ? 19 : 9;
        for (let i = 0; i < count; i++) {
          const a = rand(i + x + y) * TAU, speed = 65 + rand(i * 7 + x) * (large ? 400 : 240);
          particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, age: 0, life: 0.3 + rand(i * 3 + y) * 0.5, color: type === 'relay' ? '#ffe5a0' : color, size: 1.5 + rand(i * 8) * 2 });
        }
      }
    }
    if (['arrive', 'recall', 'drain', 'launch'].includes(type)) trail.length = 0;
    if (particles.length > 240) particles.splice(0, particles.length - 240);
    if (rings.length > 24) rings.shift();
  }

  function backdrop(run) {
    g.fillStyle = '#030911';
    g.fillRect(0, 0, width, height);
    if (assets.nebula) {
      const img = assets.nebula;
      const s = Math.max(width / img.width, height / img.height) * 1.18;
      const dw = img.width * s, dh = img.height * s;
      const px = clamp(camera.x / (run.table?.W || 3600), 0, 1);
      const py = clamp(camera.y / (run.table?.H || 2800), 0, 1);
      g.globalAlpha = 0.55;
      g.drawImage(img, (width - dw) * px, (height - dh) * (1 - py), dw, dh);
      g.globalAlpha = 1;
      g.fillStyle = '#0309143d'; g.fillRect(0, 0, width, height);
    } else {
      const haze = g.createRadialGradient(width * 0.68, height * 0.32, 0, width * 0.6, height * 0.4, width * 0.9);
      haze.addColorStop(0, '#113e4b'); haze.addColorStop(0.45, '#13182c'); haze.addColorStop(1, '#030911');
      g.fillStyle = haze; g.fillRect(0, 0, width, height);
    }
    for (let i = 0; i < 170; i++) {
      const star = stars[i];
      const x = ((star.x * 0.41 - camera.x * 0.085) % width + width) % width;
      const y = ((star.y * 0.4 + camera.y * 0.085) % height + height) % height;
      g.globalAlpha = star.a;
      g.fillStyle = i % 9 === 0 ? '#b9deff' : '#f8e9ce';
      g.fillRect(x, y, star.r * 0.65, star.r * 0.65);
    }
    g.globalAlpha = 1;
    const vignette = g.createRadialGradient(width / 2, height * 0.46, height * 0.15, width / 2, height * 0.5, Math.max(width, height) * 0.72);
    vignette.addColorStop(0, '#00000000'); vignette.addColorStop(1, '#00040fc9');
    g.fillStyle = vignette; g.fillRect(0, 0, width, height);
  }

  function visible(x, y, r = 100) {
    const v = camera.view;
    return x + r > v.left && x - r < v.right && y + r > v.bottom && y - r < v.top;
  }

  function label(text, x, y, color = '#acbfc6', size = 14) {
    if (camera.overview || !visible(x, y, 60)) return;
    g.save();
    g.translate(x, y); g.scale(1, -1);
    g.font = `500 ${size / Math.max(0.75, camera.scale)}px "Trebuchet MS", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color; g.fillText(text, 0, 0);
    g.restore();
  }

  function gravityField(room, run, active, clock) {
    const p = room.planet, radius = room.gravityRadius || 470;
    if (!visible(p.x, p.y, radius * 1.4)) return;
    const color = room.color || PALETTE[room.id % 6];
    const ballDistance = Math.hypot(run.world.ball.x - p.x, run.world.ball.y - p.y);
    const proximity = active ? clamp(1 - ballDistance / (radius * 1.3), 0, 1) : 0;
    const direction = room.orbitDirection || (room.id % 2 ? -1 : 1);
    g.save();
    // Broken, softly fading streamlines leave open space between each current.
    // They describe the field without looking like a solid collision boundary.
    const phase = reducedMotion ? 0 : clock * 0.065 * direction;
    for (let lane = 0; lane < 5; lane++) {
      const start = lane * 2.39 + room.id * 0.6 + phase;
      const distance = p.r + 95 + lane * (radius - p.r - 65) / 5;
      const span = 0.66 + lane * 0.12;
      for (let part = 0; part < 3; part++) {
        g.strokeStyle = color;
        g.globalAlpha = (active ? 0.11 + proximity * 0.09 : 0.055) * [0.35, 1, 0.45][part];
        g.lineWidth = (active ? 1.2 : 0.8) / Math.max(0.65, camera.scale);
        g.beginPath();
        g.ellipse(p.x, p.y, distance, distance * 0.96, lane * 0.14,
          start + part * span / 3, start + (part + 1) * span / 3);
        g.stroke();
      }
    }
    if (active && typeof run.table.gravity === 'function') {
      // Short moving wisps follow the same acceleration used by the ball.
      // A tide can bend their direction; repulsion points them away from the body.
      const count = reducedMotion ? 9 : 14;
      for (let i = 0; i < count; i++) {
        const a = i * 2.39996 + room.id * 0.55;
        const t = reducedMotion ? rand(i + room.id * 20) : (rand(i + room.id * 20) + clock * 0.1) % 1;
        const outward = p.kind === 'repel';
        const distance = p.r + 65 + (outward ? t : 1 - t) * (radius - p.r - 55);
        const x = p.x + Math.cos(a) * distance, y = p.y + Math.sin(a) * distance;
        const force = run.table.gravity({ x, y, vx: 0, vy: 0 });
        const magnitude = Math.hypot(force.x, force.y);
        if (magnitude < 1) continue;
        const nx = force.x / magnitude, ny = force.y / magnitude;
        const length = 12 + clamp(magnitude / 75, 0, 20);
        g.globalAlpha = Math.sin(t * Math.PI) * (0.2 + proximity * 0.16);
        g.strokeStyle = color; g.lineWidth = 1.1 / Math.max(0.65, camera.scale);
        g.beginPath(); g.moveTo(x - nx * length, y - ny * length); g.lineTo(x, y); g.stroke();
        g.beginPath(); g.moveTo(x - nx * 5 + ny * 3, y - ny * 5 - nx * 3);
        g.lineTo(x, y); g.lineTo(x - nx * 5 - ny * 3, y - ny * 5 + nx * 3); g.stroke();
      }
      // Sparse outer currents make the soft return force visible at the edge.
      const returnRadius = room.returnRadius || radius + 100;
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + 0.3;
        const x = p.x + Math.cos(a) * returnRadius, y = p.y + Math.sin(a) * returnRadius;
        const force = run.table.gravity({ x, y, vx: 0, vy: 0 });
        const magnitude = Math.hypot(force.x, force.y);
        if (magnitude < 1) continue;
        const nx = force.x / magnitude, ny = force.y / magnitude;
        g.globalAlpha = 0.1;
        g.beginPath(); g.moveTo(x - nx * 30, y - ny * 30);
        g.quadraticCurveTo(x - nx * 15 + ny * 7, y - ny * 15 - nx * 7, x, y); g.stroke();
      }
    }
    g.restore();
  }

  function planet(planet, index, color, clock, active, ball) {
    const { x, y, r } = planet;
    if (!visible(x, y, r * 3.1)) return;
    g.save();
    const near = active && Math.hypot(ball.x - x, ball.y - y) < r * 3.2;
    const glow = g.createRadialGradient(x, y, r * 0.65, x, y, r * 2.8);
    glow.addColorStop(0, near ? `${color}65` : `${color}36`); glow.addColorStop(0.45, near ? `${color}19` : `${color}0d`); glow.addColorStop(1, `${color}00`);
    g.fillStyle = glow; circle(g, x, y, r * 2.8); g.fill();
    if (assets.sprites) {
      const kind = index === 1 || index === 4 ? 'amber' : index === 3 || index === 5 ? 'violet' : 'ice';
      g.save();
      if (kind === 'amber') {
        // The circle follows the collision body; the shallow ring is decorative.
        g.beginPath(); g.arc(x, y, r * 1.03, 0, TAU);
        g.ellipse(x, y, r * 1.56, r * 0.47, 0.65, 0, TAU); g.clip();
        sprite(kind, x, y, r * 3.12, r * 2.5);
      } else {
        circle(g, x, y, r * 1.07); g.clip();
        sprite(kind, x, y, r * 2.19, r * 2.19);
      }
      g.restore();
    } else {
      const sphere = g.createRadialGradient(x - r * 0.38, y + r * 0.42, r * 0.02, x + r * 0.1, y - r * 0.12, r * 1.08);
      sphere.addColorStop(0, '#e7e6d6'); sphere.addColorStop(0.2, color); sphere.addColorStop(0.54, `${color}`); sphere.addColorStop(0.86, '#152a3a'); sphere.addColorStop(1, '#02070c');
      g.fillStyle = sphere; circle(g, x, y, r); g.fill();
      g.save(); circle(g, x, y, r); g.clip();
      g.strokeStyle = '#07111b38';
      g.lineWidth = r * 0.12;
      for (let i = 0; i < 6; i++) {
        g.beginPath(); g.ellipse(x + r * 0.12, y - r * 0.7 + i * r * 0.27, r * 1.15, r * 0.25, -0.25, 0, TAU); g.stroke();
      }
      g.restore();
    }
    g.strokeStyle = `${color}cc`; g.lineWidth = 1.6; circle(g, x, y, r); g.stroke();
    const shade = g.createRadialGradient(x - r * 0.35, y + r * 0.3, r * 0.2, x - r * 0.35, y + r * 0.3, r * 1.6);
    shade.addColorStop(0, '#00111f00'); shade.addColorStop(0.6, '#00081325'); shade.addColorStop(1, '#010309ef');
    g.fillStyle = shade; circle(g, x, y, r); g.fill();
    g.restore();
    if (active) label(planet.kind === 'repel' ? 'REPULSION' : planet.kind === 'tide' ? 'GRAVITY TIDE' : 'GRAVITY WELL', x, y - r - 34, color, 10);
  }

  function asteroid(b, index, color) {
    if (!visible(b.x, b.y, b.r + 10)) return;
    if (assets.sprites) {
      g.save(); circle(g, b.x, b.y, b.r * 1.05); g.clip();
      sprite('asteroid', b.x, b.y, b.r * 2.1, b.r * 2.1); g.restore();
      return;
    }
    const count = 10;
    g.save(); g.translate(b.x, b.y);
    g.beginPath();
    for (let n = 0; n < count; n++) {
      const a = n / count * TAU, radius = b.r * (0.83 + rand(index * 21 + n) * 0.17);
      const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
      if (n === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    const stone = g.createLinearGradient(-b.r, b.r, b.r, -b.r);
    stone.addColorStop(0, '#8e8a84'); stone.addColorStop(0.3, '#555b66'); stone.addColorStop(1, '#141d2a');
    g.fillStyle = stone; g.fill();
    g.strokeStyle = '#a4b9ca73'; g.lineWidth = 2; g.stroke();
    for (let n = 0; n < 3; n++) {
      const x = (rand(index + n * 33) - 0.5) * b.r;
      const y = (rand(index * 4 + n * 21) - 0.5) * b.r;
      circle(g, x, y, b.r * (0.09 + rand(n * 6 + index) * 0.14));
      g.fillStyle = '#050e164f'; g.fill(); g.strokeStyle = '#a1b1b020'; g.lineWidth = 1; g.stroke();
    }
    g.restore();
  }

  function relay(b, color, clock) {
    if (!visible(b.x, b.y, b.r * 3)) return;
    const active = b.hit;
    g.save();
    const glow = g.createRadialGradient(b.x, b.y, b.r * 0.3, b.x, b.y, b.r * 2.4);
    glow.addColorStop(0, active ? '#ffe8a173' : `${color}40`); glow.addColorStop(1, '#00000000');
    g.fillStyle = glow; circle(g, b.x, b.y, b.r * 2.4); g.fill();
    circle(g, b.x, b.y, b.r); g.fillStyle = active ? '#b29762' : '#183345'; g.fill();
    g.strokeStyle = active ? '#ffe9a0' : color; g.lineWidth = active ? 4 : 2.5; g.stroke();
    circle(g, b.x, b.y, b.r * 0.66); g.strokeStyle = active ? '#fff5c2' : '#ddeffc85'; g.lineWidth = 1; g.stroke();
    if (b.required > 1 && b.hits > 0 && !active) {
      g.strokeStyle = '#ffe29a'; g.lineWidth = 5;
      g.beginPath(); g.arc(b.x, b.y, b.r + 7, -Math.PI / 2, -Math.PI / 2 + TAU * b.hits / b.required); g.stroke();
    }
    g.fillStyle = active ? '#fff4c2' : '#c3e9fa';
    const r = b.r * 0.25;
    g.beginPath(); g.moveTo(b.x, b.y + r); g.lineTo(b.x + r, b.y); g.lineTo(b.x, b.y - r); g.lineTo(b.x - r, b.y); g.closePath(); g.fill();
    g.restore();
  }

  function gate(room, clock, active) {
    const gate = room.gate;
    if (!gate || !visible(gate.x, gate.y, gate.r * 2)) return;
    const color = room.color || PALETTE[room.id % 6];
    const open = gate.open;
    g.save();
    const glow = g.createRadialGradient(gate.x, gate.y, 0, gate.x, gate.y, gate.r * 1.6);
    glow.addColorStop(0, open ? `${color}2e` : '#020711'); glow.addColorStop(0.45, '#040a14'); glow.addColorStop(0.66, open ? `${color}75` : `${color}18`); glow.addColorStop(1, '#00000000');
    g.fillStyle = glow; circle(g, gate.x, gate.y, gate.r * 1.6); g.fill();
    if (assets.sprites) {
      g.save(); g.globalAlpha = open ? 0.95 : 0.47;
      circle(g, gate.x, gate.y, gate.r * 1.12); g.clip();
      sprite('portal', gate.x, gate.y, gate.r * 2.27); g.restore();
    }
    g.strokeStyle = open ? color : `${color}66`; g.lineWidth = open ? 4 : 2;
    circle(g, gate.x, gate.y, gate.r); g.stroke();
    const lit = room.relays?.filter((r) => r.hit).length || 0;
    for (let i = 0; i < 3; i++) {
      const start = i * TAU / 3 + 0.14;
      g.strokeStyle = i < lit ? '#ffe7a3' : '#56626b'; g.lineWidth = 6;
      g.beginPath(); g.arc(gate.x, gate.y, gate.r + 12, start, start + TAU / 3 - 0.28); g.stroke();
    }
    if (open) {
      g.save(); g.translate(gate.x, gate.y); g.rotate(reducedMotion ? 0 : clock * 0.4);
      g.strokeStyle = `${color}72`; g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { g.rotate(TAU / 3); g.beginPath(); g.ellipse(0, 0, gate.r * 0.7, gate.r * 0.22, 0, 0, TAU); g.stroke(); }
      g.restore();
    }
    g.restore();
    if (active) label(open ? 'JUMP' : `${lit} / 3 RELAYS`, gate.x, gate.y - gate.r - 43, open ? '#e5faff' : '#a6afb7', 12);
  }

  function rails(table) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const segments = table.walls.filter((s) => {
      if (s.enabled === false || (s.drop && !s.drop.up)) return false;
      const a = point(s.a), b = point(s.b);
      return visible((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(a[0] - b[0], a[1] - b[1]) / 2 + 15);
    });
    for (const active of [false, true]) {
      g.save(); g.globalAlpha = active || camera.overview ? 1 : 0.22;
      for (let pass = 0; pass < 3; pass++) {
        g.lineWidth = [13, 5, 1.4][pass];
        g.strokeStyle = ['#070f17', '#536477', '#d2ba82'][pass];
        g.beginPath();
        for (const s of segments) {
          if (Boolean(!table.isActive || table.isActive(s)) !== active) continue;
          const a = point(s.a), b = point(s.b); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
        }
        g.stroke();
      }
      g.restore();
    }
    for (const s of segments) {
      if (!s.sling && !s.kick) continue;
      const a = point(s.a), b = point(s.b);
      g.strokeStyle = '#9beff5'; g.lineWidth = 3; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    for (const p of table.posts || []) {
      if (p.planet || !visible(p.x, p.y, p.r + 10)) continue;
      circle(g, p.x, p.y, p.r); g.fillStyle = '#7c8d9d'; g.fill(); g.strokeStyle = '#e1d5b5'; g.lineWidth = 1.5; g.stroke();
    }
  }

  function flippers(run) {
    for (const f of run.world.flippers || []) {
      if (!visible(f.px, f.py, f.len + 30)) continue;
      const tx = f.px + Math.cos(f.th) * f.len, ty = f.py + Math.sin(f.th) * f.len;
      const nx = -Math.sin(f.th), ny = Math.cos(f.th);
      g.save(); g.globalAlpha = !run.table.isActive || run.table.isActive(f) || camera.overview ? 1 : 0.22;
      g.strokeStyle = '#060c15'; g.lineWidth = f.r1 * 2 + 7; g.lineCap = 'round';
      g.beginPath(); g.moveTo(f.px, f.py); g.lineTo(tx, ty); g.stroke();
      g.beginPath();
      g.moveTo(f.px + nx * f.r1, f.py + ny * f.r1);
      g.lineTo(tx + nx * f.r2, ty + ny * f.r2);
      g.arc(tx, ty, f.r2, f.th + Math.PI / 2, f.th - Math.PI / 2, true);
      g.lineTo(f.px - nx * f.r1, f.py - ny * f.r1);
      g.arc(f.px, f.py, f.r1, f.th - Math.PI / 2, f.th + Math.PI / 2, true);
      g.closePath();
      const metal = g.createLinearGradient(f.px, f.py + f.r1, f.px, f.py - f.r1);
      metal.addColorStop(0, '#fcf0ce'); metal.addColorStop(0.35, f.held ? '#d1ffff' : '#a8bbc8'); metal.addColorStop(1, '#2a5672');
      g.fillStyle = metal; g.fill();
      g.strokeStyle = f.held ? '#ceffff' : '#bcdfdf'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = f.held ? '#9affef' : '#506e85'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(f.px, f.py); g.lineTo(tx, ty); g.stroke();
      circle(g, f.px, f.py, f.r1 * 0.43); g.fillStyle = '#0a2639'; g.fill();
      g.restore();
    }
  }

  function temporaryField(well, clock, aiming = false) {
    if (!well || !Number.isFinite(well.x) || !Number.isFinite(well.y)) return;
    const { x, y } = well, radius = well.radius || FIELD_RADIUS;
    if (!visible(x, y, radius)) return;
    const valid = !aiming || well.valid !== false;
    const color = valid ? FIELD_COLORS[well.kind] || FIELD_COLORS.pull : FIELD_COLORS.invalid;
    const duration = well.duration || FIELD_DURATION;
    const remaining = aiming ? duration : clamp(well.remaining, 0, duration);
    const fade = aiming ? 0.72 : Math.min(1, remaining / 0.55);
    const scale = Math.max(0.5, camera.scale);
    const outward = well.kind === 'push';
    g.save();
    g.globalAlpha = fade;
    // The faint range ring is the true force radius. Its broken stroke keeps it
    // distinct from a rail; the diamond identifies this as a placed device.
    const glow = g.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `${color}27`); glow.addColorStop(0.3, `${color}15`);
    glow.addColorStop(0.74, `${color}07`); glow.addColorStop(1, `${color}00`);
    g.fillStyle = glow; circle(g, x, y, radius); g.fill();
    g.strokeStyle = `${color}${aiming ? '95' : '4d'}`;
    g.lineWidth = (aiming ? 1.2 : 0.85) / scale;
    g.setLineDash([3 / scale, 10 / scale]);
    circle(g, x, y, radius); g.stroke(); g.setLineDash([]);

    // Radial arrows show the direction without implying an orbit or a solid
    // boundary. Each wisp ends before the softened, force-free center.
    const count = reducedMotion ? 8 : 12;
    for (let i = 0; i < count; i++) {
      const angle = i * TAU / count + 0.17;
      const progress = reducedMotion || aiming ? 0.28 + (i % 3) * 0.22 : (clock * 0.38 + i * 0.31) % 1;
      const distance = 55 + (outward ? progress : 1 - progress) * (radius - 83);
      const nx = Math.cos(angle) * (outward ? 1 : -1), ny = Math.sin(angle) * (outward ? 1 : -1);
      const px = x + Math.cos(angle) * distance, py = y + Math.sin(angle) * distance;
      const length = (13 + Math.sin(progress * Math.PI) * 13) / scale;
      g.globalAlpha = fade * (0.2 + Math.sin(progress * Math.PI) * 0.48);
      g.strokeStyle = color; g.lineWidth = 1.15 / scale;
      g.beginPath(); g.moveTo(px - nx * length, py - ny * length); g.lineTo(px, py);
      g.moveTo(px - nx * 6 / scale + ny * 3 / scale, py - ny * 6 / scale - nx * 3 / scale);
      g.lineTo(px, py); g.lineTo(px - nx * 6 / scale - ny * 3 / scale, py - ny * 6 / scale + nx * 3 / scale); g.stroke();
    }

    g.globalAlpha = fade;
    const core = 17 / scale, ring = 29 / scale;
    g.fillStyle = '#061d2de6';
    g.strokeStyle = color; g.lineWidth = 1.6 / scale;
    g.beginPath(); g.moveTo(x, y + core); g.lineTo(x + core, y);
    g.lineTo(x, y - core); g.lineTo(x - core, y); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 5 / scale, y); g.lineTo(x + 5 / scale, y);
    if (outward) { g.moveTo(x, y - 5 / scale); g.lineTo(x, y + 5 / scale); }
    g.stroke();
    g.strokeStyle = `${color}3a`; g.lineWidth = 2 / scale;
    circle(g, x, y, ring); g.stroke();
    g.strokeStyle = color;
    g.beginPath(); g.arc(x, y, ring, Math.PI / 2, Math.PI / 2 + TAU * remaining / duration); g.stroke();
    g.restore();
    const text = aiming ? valid ? `${outward ? 'PUSH' : 'PULL'} · ${duration}s` : 'CHOOSE OPEN SPACE' : `${outward ? 'PUSH' : 'PULL'} · ${remaining.toFixed(1)}s`;
    label(text, x, y - 45 / scale, color, 11);
  }

  function trajectory(run, charge = 0, fieldAim = null) {
    const charging = run.phase === 'ready' && charge > 0 && typeof run.table.launchVelocity === 'function';
    if ((!charging && run.phase !== 'play') || camera.overview || typeof run.table.gravity !== 'function') return;
    const launch = charging ? run.table.launchVelocity(charge) : null;
    const ball = launch ? { ...run.world.ball, vx: launch.x, vy: launch.y } : run.world.ball;
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed < 90) return;
    const probe = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy };
    // Forecast acceleration, then stop before the next contact. Collisions and
    // later player inputs change the path, so this remains a short local guide.
    const dt = Math.min(0.025, 30 / speed), points = [];
    const isActive = object => !run.table.isActive || run.table.isActive(object);
    const circles = [...run.table.posts, ...run.table.bumpers].filter(c => isActive(c)
      && Math.hypot(c.x - ball.x, c.y - ball.y) < 850 + c.r);
    const walls = run.table.walls.filter(s => isActive(s) && s.enabled !== false && (!s.drop || s.drop.up));
    const flippers = run.world.flippers.filter(isActive), maxSpeed = run.table.maxSpeed ?? F.V_MAX;
    const distanceToSegment = (x, y, ax, ay, bx, by) => {
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    };
    const crosses = (ax, ay, bx, by, cx, cy, dx, dy) => {
      const c1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const c2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
      const c3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
      const c4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
      return c1 * c2 < 0 && c3 * c4 < 0;
    };
    const previewWell = fieldAim?.valid ? { ...fieldAim, radius: FIELD_RADIUS, remaining: FIELD_DURATION, duration: FIELD_DURATION, sector: run.sectorIndex } : undefined;
    for (let i = 0; i < 24; i++) {
      const force = typeof run.table.gravityAt === 'function'
        ? run.table.gravityAt(probe, i * dt, previewWell)
        : run.table.gravity(probe);
      const previous = { x: probe.x, y: probe.y };
      probe.vx += force.x * dt; probe.vy += force.y * dt;
      const magnitude = Math.hypot(probe.vx, probe.vy);
      if (magnitude > maxSpeed) { probe.vx *= maxSpeed / magnitude; probe.vy *= maxSpeed / magnitude; }
      probe.x += probe.vx * dt; probe.y += probe.vy * dt;
      probe.vx *= 1 - F.ROLL_DAMP * dt; probe.vy *= 1 - F.ROLL_DAMP * dt;
      const hitBody = circles.some(c => distanceToSegment(c.x, c.y, previous.x, previous.y, probe.x, probe.y) < c.r + 13.5);
      const hitWall = walls.some(s => {
        const a = point(s.a), b = point(s.b);
        return distanceToSegment(probe.x, probe.y, a[0], a[1], b[0], b[1]) < 14
          || crosses(previous.x, previous.y, probe.x, probe.y, a[0], a[1], b[0], b[1]);
      });
      const hitFlipper = flippers.some(f => distanceToSegment(probe.x, probe.y,
        f.px, f.py, f.px + Math.cos(f.th) * f.len, f.py + Math.sin(f.th) * f.len) < f.r1 + 13.5);
      if (hitBody || hitWall || hitFlipper || run.table.isDrain?.(probe)) break;
      points.push({ x: probe.x, y: probe.y });
    }
    g.save();
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], fade = 1 - i / 24;
      const color = previewWell ? FIELD_COLORS[previewWell.kind] || FIELD_COLORS.pull : '#c9f4ff';
      g.globalAlpha = fade * (previewWell ? 0.62 : 0.27); g.strokeStyle = color;
      g.lineWidth = (previewWell ? 1.5 : 1) / Math.max(0.55, camera.scale);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      if (i % 3 === 0) {
        g.globalAlpha = fade * 0.6; g.fillStyle = previewWell ? color : '#dffaff';
        circle(g, b.x, b.y, Math.max(2.1, 1.15 / camera.scale)); g.fill();
      }
    }
    g.restore();
  }

  function drawBall(run, dt, charge) {
    const b = run.world.ball, r = 13.5;
    const moving = ['play', 'flight'].includes(run.phase);
    if (moving && !reducedMotion) {
      const previous = trail.at(-1);
      if (!previous || Math.hypot(previous.x - b.x, previous.y - b.y) > 7) trail.push({ x: b.x, y: b.y, age: 0 });
    }
    for (const p of trail) p.age += dt;
    while (trail.length && (trail[0].age > 0.25 || trail.length > 26)) trail.shift();
    if (trail.length > 1) {
      g.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const p = trail[i], previous = trail[i - 1], strength = clamp(1 - p.age / 0.25, 0, 1);
        if (Math.hypot(p.x - previous.x, p.y - previous.y) > 180) continue;
        g.globalAlpha = strength * 0.65; g.strokeStyle = '#8ce8ff'; g.lineWidth = r * strength * 1.45;
        g.beginPath(); g.moveTo(previous.x, previous.y); g.lineTo(p.x, p.y); g.stroke();
      }
      g.globalAlpha = 1;
    }
    const aura = g.createRadialGradient(b.x, b.y, r * 0.3, b.x, b.y, r * 3.5);
    aura.addColorStop(0, '#f7ffffaa'); aura.addColorStop(0.25, '#99eaff70'); aura.addColorStop(1, '#6dcfff00');
    g.fillStyle = aura; circle(g, b.x, b.y, r * 3.5); g.fill();
    const sphere = g.createRadialGradient(b.x - r * 0.35, b.y + r * 0.35, r * 0.1, b.x, b.y, r * 1.06);
    sphere.addColorStop(0, '#ffffff'); sphere.addColorStop(0.35, '#dcf9ff'); sphere.addColorStop(0.7, '#7eabbf'); sphere.addColorStop(1, '#214c72');
    g.fillStyle = sphere; circle(g, b.x, b.y, r); g.fill(); g.strokeStyle = '#ffffff'; g.lineWidth = 1.4; g.stroke();
    if (run.phase === 'ready' && charge > 0) {
      circle(g, b.x, b.y, 28 + charge * 9); g.strokeStyle = '#ffe9a9'; g.lineWidth = 3;
      g.beginPath(); g.arc(b.x, b.y, 28 + charge * 9, -Math.PI / 2, -Math.PI / 2 + charge * TAU); g.stroke();
    }
  }

  function effects(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = 1 - p.age / p.life; g.fillStyle = p.color;
      circle(g, p.x, p.y, p.size); g.fill();
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const p = rings[i]; p.age += dt;
      if (p.age >= p.life) { rings.splice(i, 1); continue; }
      const t = p.age / p.life;
      g.globalAlpha = (1 - t) * 0.8; g.strokeStyle = p.color; g.lineWidth = 3 * (1 - t) + 0.5;
      circle(g, p.x, p.y, 15 + p.r * (p.inward ? 1 - t : t)); g.stroke();
    }
    g.globalAlpha = 1;
  }

  function map(run) {
    if (!mg) return;
    mg.setTransform(dpr, 0, 0, dpr, 0, 0);
    mg.clearRect(0, 0, mapW, mapH);
    mg.fillStyle = '#030a13b0'; mg.fillRect(0, 0, mapW, mapH);
    const padding = 8, scale = Math.min((mapW - padding * 2) / run.table.W, (mapH - padding * 2) / run.table.H);
    const ox = (mapW - run.table.W * scale) / 2, oy = (mapH - run.table.H * scale) / 2;
    const mx = (x) => ox + x * scale, my = (y) => mapH - oy - y * scale;
    // A constellation route gives orientation without implying boxed rooms.
    mg.lineWidth = 0.85;
    for (let i = 1; i < run.sectors.length; i++) {
      const previous = run.sectors[i - 1].planet, next = run.sectors[i].planet;
      mg.strokeStyle = run.sectors[i - 1].cleared ? '#a9d9ce77' : '#61778a4c';
      mg.setLineDash(run.sectors[i - 1].cleared ? [] : [1.5, 3]);
      mg.beginPath(); mg.moveTo(mx(previous.x), my(previous.y)); mg.lineTo(mx(next.x), my(next.y)); mg.stroke();
    }
    mg.setLineDash([]);
    run.sectors.forEach((room, index) => {
      const active = index === run.sectorIndex, color = room.color || PALETTE[index % 6];
      const x = mx(room.planet.x), y = my(room.planet.y), r = Math.max(2.5, room.planet.r * scale);
      if (active) {
        const glow = mg.createRadialGradient(x, y, 0, x, y, r + 9);
        glow.addColorStop(0, `${color}85`); glow.addColorStop(1, `${color}00`);
        mg.fillStyle = glow; circle(mg, x, y, r + 9); mg.fill();
        mg.strokeStyle = `${color}90`; mg.lineWidth = 0.8;
        mg.beginPath(); mg.ellipse(x, y, r + 6, r + 3, -0.45, 0.3, 2.5); mg.stroke();
      }
      circle(mg, x, y, r); mg.fillStyle = active ? color : room.cleared ? '#afc9b1' : room.visited ? '#6b838b' : '#445361'; mg.fill();
      for (const relay of room.relays) {
        circle(mg, mx(relay.x), my(relay.y), active ? 1.2 : 0.8);
        mg.fillStyle = relay.hit ? '#ffe6a6' : active ? `${color}77` : '#52637860'; mg.fill();
      }
      if (room.cleared) {
        mg.strokeStyle = '#ffe6a6'; mg.lineWidth = 1;
        mg.beginPath(); mg.moveTo(x - 1.5, y); mg.lineTo(x, y + 1.5); mg.lineTo(x + 2.4, y - 1.5); mg.stroke();
      }
    });
    const well = run.gravityWell;
    if (well?.remaining > 0) {
      const x = mx(well.x), y = my(well.y), r = Math.max(3, well.radius * scale);
      mg.strokeStyle = `${FIELD_COLORS[well.kind] || FIELD_COLORS.pull}85`; mg.lineWidth = 0.8;
      circle(mg, x, y, r); mg.stroke();
      mg.fillStyle = FIELD_COLORS[well.kind] || FIELD_COLORS.pull;
      mg.beginPath(); mg.moveTo(x, y - 2); mg.lineTo(x + 2, y); mg.lineTo(x, y + 2); mg.lineTo(x - 2, y); mg.closePath(); mg.fill();
    }
    circle(mg, mx(run.world.ball.x), my(run.world.ball.y), 2.5); mg.fillStyle = '#fff9df'; mg.fill();
  }

  function draw(run, dt = 1 / 60, options = {}) {
    if (!run?.world?.ball || !run?.table) return;
    const elapsed = clamp(dt, 0, 0.08);
    reducedMotion = Boolean(options.reducedMotion);
    if (lastWorld !== run.world) { trail.length = 0; particles.length = 0; rings.length = 0; lastWorld = run.world; }
    if (!options.freezeCamera || !camera.initialized || camera.world !== run.world) {
      updateCamera(camera, run, elapsed, options);
    } else {
      // Placement uses the exact same transform for drawing and hit testing.
      // Preserve its center and zoom while still accounting for canvas resize.
      const playHeight = Math.max(100, height - camera.top - camera.bottom);
      camera.centerY = camera.top + playHeight / 2;
      const halfW = width / camera.scale / 2, halfH = playHeight / camera.scale / 2;
      camera.view = { left: camera.x - halfW, right: camera.x + halfW, bottom: camera.y - halfH, top: camera.y + halfH };
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(run);
    g.save();
    g.translate(width / 2, camera.centerY);
    g.scale(camera.scale, -camera.scale);
    g.translate(-camera.x, -camera.y);
    for (const s of stars) {
      if (!visible(s.x, s.y, 3)) continue;
      g.fillStyle = `rgba(202,221,235,${s.a * 0.5})`; circle(g, s.x, s.y, s.r); g.fill();
    }
    const clock = run.clock || 0;
    for (let index = 0; index < run.sectors.length; index++) {
      const room = run.sectors[index];
      if (!visible(room.x, room.y + room.h / 2, Math.max(room.w, room.h) * 0.7)) continue;
      const color = room.color || PALETTE[index % 6];
      const active = index === run.sectorIndex;
      gravityField(room, run, active, clock);
      g.save(); g.globalAlpha = active || camera.overview ? 1 : 0.32;
      planet(room.planet, index, color, clock, active, run.world.ball);
      gate(room, clock, active);
      for (const target of room.relays || []) relay(target, color, clock);
      g.restore();
      if (active) label(room.name.toUpperCase(), room.x, room.y + room.h - 42, `${color}b0`, 12);
    }
    for (let i = 0; i < run.table.bumpers.length; i++) {
      const b = run.table.bumpers[i];
      g.save(); g.globalAlpha = b.sector === run.sectorIndex || camera.overview ? 1 : 0.3;
      if (!b.relay) asteroid(b, i, '#adbad1');
      g.restore();
    }
    rails(run.table);
    flippers(run);
    if (run.gravityWell?.remaining > 0) temporaryField(run.gravityWell, clock);
    if (options.fieldAim) temporaryField(options.fieldAim, clock, true);
    trajectory(run, options.charge || 0, options.fieldAim);
    const effectElapsed = options.freezeCamera ? 0 : elapsed;
    effects(effectElapsed);
    drawBall(run, effectElapsed, options.charge || 0);
    g.restore();
    map(run);
  }

  function toWorld(clientX, clientY) {
    const bounds = canvas.getBoundingClientRect();
    return screenToWorld(camera, (clientX - bounds.left) * width / (bounds.width || width), (clientY - bounds.top) * height / (bounds.height || height));
  }

  function toScreen(x, y) {
    const bounds = canvas.getBoundingClientRect(), local = worldToScreen(camera, x, y);
    return { x: bounds.left + local.x * (bounds.width || width) / width, y: bounds.top + local.y * (bounds.height || height) / height };
  }

  return { draw, resize, camera, loadAssets, onEvent, toWorld, toScreen, screenToWorld: toWorld, worldToScreen: (x, y) => worldToScreen(camera, x, y), destroy() { observer?.disconnect(); globalThis.removeEventListener?.('resize', resize); } };
}

import { createCamera, updateCamera, worldToScreen, screenToWorld, clamp } from './camera.js';
import { F } from './physics.js';
import { FIELD_DURATION, FIELD_RADIUS } from './adventure.js';
import { sampleTransit, visibleSectorIds, galaxyNode, transitEase } from './transit.js';
import { makeGalaxyTexture, makeOrbitDust } from './cosmic-textures.js';

const TAU = Math.PI * 2;
const SPRITES = { ice: [5,132,436,421], amber: [396,143,489,391], violet: [837,133,414,422], asteroid: [14,681,425,420], portal: [808,673,437,434] };
const MINERALS = { stone: [57,60,529,528], iron: [676,69,527,522], ice: [69,665,524,523], core: [677,671,522,518] };
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
  const dust = new Map();
  let galaxyTexture = null;
  let width = 1, height = 1, dpr = 1, mapW = 156, mapH = 116;
  let lastWorld = null, reducedMotion = false, lastFlight = null;
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

  loadAssets({ nebula: new URL('./assets/deep-space.webp', import.meta.url).href, sprites: new URL('./assets/celestial-sprites.webp', import.meta.url).href, horizon: new URL('./art/transit/event-horizon.webp', import.meta.url).href, organic: new URL('./art/organic/mineral-sprites.webp', import.meta.url).href });

  function sprite(name, x, y, w, h = w) {
    if (!assets.sprites) return false;
    g.save(); g.translate(x - w / 2, y + h / 2); g.scale(1, -1);
    g.drawImage(assets.sprites, ...SPRITES[name], 0, 0, w, h);
    g.restore(); return true;
  }

  function organicSprite(name, x, y, radius) {
    if (!assets.organic || !MINERALS[name]) return false;
    const rect = MINERALS[name], scale = radius * 2 / Math.max(rect[2], rect[3]);
    const w = rect[2] * scale, h = rect[3] * scale;
    g.save(); g.translate(x - w / 2, y + h / 2); g.scale(1, -1);
    g.drawImage(assets.organic, ...rect, 0, 0, w, h); g.restore(); return true;
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
        g.beginPath(); g.moveTo(x - nx * length, y - ny * length);
        g.quadraticCurveTo(x - nx * length * .5 + ny * 3, y - ny * length * .5 - nx * 3, x, y); g.stroke();
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
    // A lit crescent gives the planet an atmosphere without an interface outline.
    g.strokeStyle = `${color}8c`; g.lineWidth = 1.8;
    g.beginPath(); g.arc(x, y, r * 1.012, .30, Math.PI * .94); g.stroke();
    const shade = g.createRadialGradient(x - r * 0.35, y + r * 0.3, r * 0.2, x - r * 0.35, y + r * 0.3, r * 1.6);
    shade.addColorStop(0, '#00111f00'); shade.addColorStop(0.6, '#00081325'); shade.addColorStop(1, '#010309ef');
    g.fillStyle = shade; circle(g, x, y, r); g.fill();
    g.restore();
    if (active && (planet.kind === 'repel' || planet.kind === 'tide')) label(planet.kind === 'repel' ? 'REPULSION' : 'GRAVITY TIDE', x, y - r - 34, color, 10);
  }

  function asteroid(b, index, color) {
    if (!visible(b.x, b.y, b.r * 1.3)) return;
    g.save(); g.translate(b.x, b.y); g.rotate((rand(index * 13) - .5) * .9);
    if (assets.organic) {
      organicSprite(['stone', 'iron', 'ice'][index % 3], 0, 0, b.r * 1.03);
      g.restore(); return;
    }
    const count = 14, seed = index * 21;
    g.beginPath();
    for (let n = 0; n < count; n++) {
      const a = n / count * TAU, radius = b.r * (.87 + rand(seed + n) * .13);
      const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
      if (n === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
    const stone = g.createLinearGradient(-b.r, b.r, b.r, -b.r);
    stone.addColorStop(0, ['#a3aab1', '#bd9677', '#a7c6d6'][index % 3]);
    stone.addColorStop(.45, ['#515c6a', '#73594b', '#466981'][index % 3]); stone.addColorStop(1, '#111c2a');
    g.fillStyle = stone; g.fill(); g.save(); g.clip();
    if (assets.sprites) {
      g.globalAlpha = .76; sprite('asteroid', 0, 0, b.r * 2.15); g.globalAlpha = 1;
    }
    for (let n = 0; n < 6; n++) {
      const x = (rand(seed + n * 33) - .5) * b.r * 1.4;
      const y = (rand(seed * 4 + n * 21) - .5) * b.r * 1.4;
      circle(g, x, y, b.r * (.055 + rand(n * 6 + index) * .12));
      g.fillStyle = '#050e164f'; g.fill(); g.strokeStyle = '#c5d1d025'; g.lineWidth = .7; g.stroke();
    }
    g.restore(); g.restore();
  }

  function relay(b, color, clock) {
    if (!visible(b.x, b.y, b.r * 3)) return;
    const active = b.hit, t = reducedMotion ? 0 : clock;
    const warmth = active ? '#ffe1a1' : '#afdff2';
    g.save(); g.translate(b.x, b.y);
    const corona = g.createRadialGradient(0, 0, b.r * .22, 0, 0, b.r * 2.25);
    corona.addColorStop(0, active ? '#ffce7780' : `${color}65`);
    corona.addColorStop(.42, active ? '#e8a84a26' : `${color}20`); corona.addColorStop(1, '#00000000');
    g.fillStyle = corona; circle(g, 0, 0, b.r * 2.25); g.fill();
    // The luminous body is the collider. Wisps outside it are translucent gas.
    const surface = g.createRadialGradient(-b.r * .3, b.r * .36, 0, 0, 0, b.r);
    surface.addColorStop(0, active ? '#fff8d5' : '#e3f7ff');
    surface.addColorStop(.22, active ? '#f8d185' : '#92c2d3');
    surface.addColorStop(.62, active ? '#93623d' : '#375c72'); surface.addColorStop(1, '#0b1d2b');
    if (assets.organic) {
      g.save(); g.filter = active ? 'none' : 'saturate(.3) brightness(.86)';
      organicSprite('core', 0, 0, b.r * 1.02); g.restore();
    } else {
      g.fillStyle = surface; circle(g, 0, 0, b.r); g.fill();
      g.save(); circle(g, 0, 0, b.r); g.clip();
      for (let i = 0; i < 12; i++) {
        const angle = i * 2.399 + b.id, radius = b.r * (.2 + rand(i + b.id) * .6);
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        g.strokeStyle = i % 3 ? '#b6ebec40' : '#fff7d768'; g.lineWidth = 1 + i % 3;
        g.beginPath(); g.moveTo(x * .3, y * .3); g.quadraticCurveTo(x - y * .4, y + x * .4, x, y); g.stroke();
      }
      g.restore();
    }
    // Small, irregular plasma arcs retain a clear contact silhouette.
    for (let i = 0; i < 4; i++) {
      const start = i * 1.7 + b.id * .73 + Math.sin(t * .28 + i) * .13;
      g.strokeStyle = warmth; g.globalAlpha = active ? .56 : .30; g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, b.r * (1.03 + i * .025), start, start + .45 + i * .11); g.stroke();
    }
    g.globalAlpha = 1;
    // Charged targets carry a small star. Double-charge cores keep two marks.
    {
      const glow = g.createRadialGradient(-b.r * .16, b.r * .16, 0, 0, 0, b.r * .7);
      glow.addColorStop(0, active ? '#fffdecc0' : '#d7f8ffa0');
      glow.addColorStop(.35, active ? '#ffedaf45' : '#74cfe542');
      glow.addColorStop(1, active ? '#ffdc8000' : '#58bcdc00');
      g.fillStyle = glow; circle(g, 0, 0, b.r * .7); g.fill();
    }
    if (b.required > 1) for (let i = 0; i < b.required; i++) {
      circle(g, (i - .5) * 12, -b.r - 12, 3.2);
      g.fillStyle = i < b.hits ? '#fff0b1' : '#779ba1'; g.fill();
    }
    g.restore();
  }

  function gate(room, clock, active) {
    const gate = room.gate;
    if (!gate || !visible(gate.x, gate.y, gate.r * 2.2)) return;
    const open = gate.open, t = reducedMotion ? 0 : clock;
    const lit = room.relays?.filter(r => r.hit).length || 0;
    g.save(); g.translate(gate.x, gate.y);
    const glow = g.createRadialGradient(0, 0, gate.r * .65, 0, 0, gate.r * 1.95);
    glow.addColorStop(0, open ? '#ffd29b65' : '#8095b020');
    glow.addColorStop(.4, open ? '#c97e4c28' : '#60809810'); glow.addColorStop(1, '#00000000');
    g.fillStyle = glow; circle(g, 0, 0, gate.r * 1.95); g.fill();
    // An accretion flow, with broad soft bands and fine uneven filaments.
    g.rotate(-.35);
    for (let i = 0; i < 9; i++) {
      const radius = gate.r * (1.02 + i * .045);
      g.globalAlpha = (open ? .13 : .035) * (1 - i / 12);
      g.strokeStyle = i % 3 === 0 ? '#ffe4ba' : '#d6966a'; g.lineWidth = i < 4 ? 9 : 3;
      g.beginPath(); g.ellipse(0, 0, radius * 1.22, radius * .48, 0, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1;
    const dark = g.createRadialGradient(-gate.r * .1, gate.r * .1, 0, 0, 0, gate.r);
    dark.addColorStop(0, '#010208'); dark.addColorStop(.85, '#020710'); dark.addColorStop(1, open ? '#5d4539' : '#162331');
    g.fillStyle = dark; circle(g, 0, 0, gate.r); g.fill();
    if (open && assets.horizon) {
      const img = assets.horizon, scale = gate.r * 2.35 / Math.min(img.width, img.height);
      g.save(); circle(g, 0, 0, gate.r * 1.04); g.clip(); g.scale(1, -1);
      g.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale); g.restore();
    }
    for (let i = 0; i < 7; i++) {
      const start = i * .81 + Math.sin(t * .23 + i) * .07;
      g.globalAlpha = open ? .35 + rand(i) * .3 : .12;
      g.strokeStyle = i % 2 ? '#f0b276' : '#d1e1ed'; g.lineWidth = .6 + rand(i + 5) * 1.4;
      g.beginPath(); g.arc(0, 0, gate.r * (1.01 + rand(i) * .07), start, start + .55 + rand(i + 9) * .3); g.stroke();
    }
    g.globalAlpha = open ? .45 : .1; g.strokeStyle = '#ffe0b4'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, 0, gate.r * 1.43, gate.r * .38, 0, Math.PI, TAU); g.stroke();
    g.restore();
    if (active) label(open ? 'ENTER BLACK HOLE' : `${lit} / 3 RELAYS`, gate.x, gate.y - gate.r - 38, open ? '#f5e8cf' : '#a6afb7', 11);
  }

  function rails(table, sectorIndex) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const segments = table.walls.filter((s) => {
      if (s.sector !== sectorIndex || s.enabled === false || (s.drop && !s.drop.up)) return false;
      const a = point(s.a), b = point(s.b);
      return visible((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.hypot(a[0] - b[0], a[1] - b[1]) / 2 + 15);
    });
    g.save(); g.globalAlpha = 1;
    for (let pass = 0; pass < 3; pass++) {
      g.lineWidth = [13, 5, 1.4][pass];
      g.strokeStyle = ['#070f17', '#536477', '#d2ba82'][pass];
      g.beginPath();
      for (const s of segments) {
        const a = point(s.a), b = point(s.b); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      }
      g.stroke();
    }
    g.restore();
    for (const s of segments) {
      if (!s.sling && !s.kick) continue;
      const a = point(s.a), b = point(s.b);
      g.strokeStyle = '#9beff5'; g.lineWidth = 3; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    for (const p of table.posts || []) {
      if (p.sector !== sectorIndex || p.planet || !visible(p.x, p.y, p.r + 10)) continue;
      circle(g, p.x, p.y, p.r); g.fillStyle = '#7c8d9d'; g.fill(); g.strokeStyle = '#e1d5b5'; g.lineWidth = 1.5; g.stroke();
    }
  }

  function flippers(run) {
    for (const f of run.world.flippers || []) {
      if (f.sector !== run.sectorIndex || !visible(f.px, f.py, f.len + 30)) continue;
      const tx = f.px + Math.cos(f.th) * f.len, ty = f.py + Math.sin(f.th) * f.len;
      const nx = -Math.sin(f.th), ny = Math.cos(f.th);
      g.save(); g.globalAlpha = 1;
      // A gravity scoop curls under the physical paddle and guides the ball up.
      // Its motion uses physics time so Pause freezes the complete recovery cue.
      if (f.reverseFx > 0) {
        const fade = f.reverseFx, progress = 1 - fade, reach = f.len * .94;
        g.save(); g.globalAlpha = fade; g.lineCap = 'round';
        g.strokeStyle = '#ffd78b'; g.lineWidth = 5;
        g.beginPath();
        g.moveTo(f.px - f.side * 12, f.py - 18);
        g.bezierCurveTo(f.px - f.side * reach * .1, f.py - 136,
          f.px - f.side * reach * 1.35, f.py - 152,
          f.px - f.side * reach, f.py - 5 + progress * 80);
        g.stroke();
        g.globalAlpha = fade * .22; g.lineWidth = 20; g.stroke();
        g.restore();
      }
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

  function orbitDust(room) {
    if (!dust.has(room.id)) dust.set(room.id, makeOrbitDust(room.id, room.color));
    const diameter = room.gravityRadius * 2.7;
    if (!visible(room.planet.x, room.planet.y, diameter / 2)) return;
    g.save(); g.globalAlpha = .70;
    g.drawImage(dust.get(room.id), room.planet.x - diameter / 2, room.planet.y - diameter / 2, diameter, diameter);
    g.restore();
  }

  // The chart uses a spiral route, independent of engine coordinates. No rails,
  // targets or distant playfields appear here or behind the current level.
  function galaxyChart(ctx, run, chartWidth, chartHeight, { full = false, orbit = 0, transit = null } = {}) {
    const opacity = ctx.globalAlpha;
    const cx = chartWidth * 0.5, cy = chartHeight * (full ? 0.47 : 0.5);
    const radius = Math.min(chartWidth * 0.43, chartHeight * (full ? 0.50 : 0.59));
    const spin = full ? orbit : -0.08;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(spin);
    if (!galaxyTexture) galaxyTexture = makeGalaxyTexture();
    ctx.globalAlpha = opacity * (full ? .90 : .65);
    ctx.drawImage(galaxyTexture, -radius * 1.22, -radius * 1.22, radius * 2.44, radius * 2.44);
    ctx.globalAlpha = opacity;
    const nodes = run.sectors.map((room, index) => {
      const n = galaxyNode(index, run.sectors.length);
      return { x: n.x * radius, y: n.y * radius, room, index };
    });
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i];
      const activeRoute = transit && i === run.flight?.toSector;
      ctx.strokeStyle = activeRoute ? '#ffe4b6aa' : a.room.cleared ? '#8dd4cc66' : '#7890a030';
      ctx.lineWidth = activeRoute ? 1.6 : 0.8;
      ctx.setLineDash(activeRoute || a.room.cleared ? [] : [2, 5]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) * 0.17, (a.y + b.y) * 0.17, b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    nodes.forEach(({ x, y, room, index }) => {
      const current = index === run.sectorIndex, next = transit && index === run.flight?.toSector;
      const color = room.color || PALETTE[index % 6], r = full ? current || next ? 5 : 3.4 : current ? 3.4 : 2.1;
      if (current || next) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
        glow.addColorStop(0, `${color}88`); glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow; circle(ctx, x, y, r * 5); ctx.fill();
        ctx.strokeStyle = `${color}b0`; ctx.lineWidth = 0.9;
        circle(ctx, x, y, r + (full ? 7 : 3)); ctx.stroke();
      }
      if (current && run.gravityWell?.remaining > 0) {
        ctx.strokeStyle = FIELD_COLORS[run.gravityWell.kind] || FIELD_COLORS.pull; ctx.lineWidth = 1.2;
        circle(ctx, x, y, r + (full ? 12 : 6)); ctx.stroke();
      }
      const bodyRadius = full ? (current || next ? 9 : 6) : r;
      const sphere = ctx.createRadialGradient(x - bodyRadius * .35, y - bodyRadius * .35, 0, x, y, bodyRadius);
      sphere.addColorStop(0, current || next || room.cleared ? '#f7eddb' : '#99a9b7');
      sphere.addColorStop(.32, current || next || room.cleared ? color : '#5d7089'); sphere.addColorStop(1, '#0a1421');
      ctx.fillStyle = sphere; circle(ctx, x, y, bodyRadius); ctx.fill();
      if (full && (transit ? next : true)) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(-spin);
        const fontSize = Math.max(10, Math.min(13, chartWidth / 35));
        ctx.font = `500 ${fontSize}px "Trebuchet MS", sans-serif`;
        const textWidth = ctx.measureText?.(room.name)?.width || room.name.length * fontSize * 0.56;
        const screenX = cx + x * Math.cos(spin) - y * Math.sin(spin);
        const side = [0, 4].includes(index) ? -1 : [2, 3].includes(index) ? 1 : 0;
        const preferred = side < 0 ? -textWidth - 12 : side > 0 ? 12 : -textWidth / 2;
        const labelX = clamp(preferred, 12 - screenX, chartWidth - 12 - screenX - textWidth);
        const labelY = transit ? -22 : [1, 2, 5].includes(index) ? -23 : 27;
        ctx.textAlign = 'left';
        ctx.strokeStyle = '#020914d9'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        ctx.strokeText(room.name, labelX, labelY);
        ctx.fillStyle = current || next ? '#f5e8d5' : room.cleared ? '#b4d4c9' : '#92a8bc';
        ctx.fillText(room.name, labelX, labelY);
        ctx.restore();
      }
    });
    if (transit && run.flight) {
      const a = nodes[run.flight.fromSector], b = nodes[run.flight.toSector];
      const t = transitEase((transit.progress - 0.2) / 0.2), u = 1 - t;
      const x = u * u * a.x + 2 * u * t * (a.x + b.x) * 0.17 + t * t * b.x;
      const y = u * u * a.y + 2 * u * t * (a.y + b.y) * 0.17 + t * t * b.y;
      ctx.fillStyle = '#fff3ce'; circle(ctx, x, y, 3.2); ctx.fill();
    }
    ctx.restore();
  }

  function map(run) {
    if (!mg) return;
    mg.setTransform(dpr, 0, 0, dpr, 0, 0);
    mg.clearRect(0, 0, mapW, mapH);
    mg.fillStyle = '#030a13b0'; mg.fillRect(0, 0, mapW, mapH);
    galaxyChart(mg, run, mapW, mapH);
  }

  // A fixed pool gives stars real perspective depth. Every layer samples the
  // same travelled distance, so pausing freezes the whole flight exactly.
  const warpStars = Array.from({ length: 480 }, (_, i) => {
    const angle = rand(i * 7 + 919) * TAU;
    const radius = 0.018 + Math.sqrt(rand(i * 11 + 823)) * 1.38;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
      z: rand(i * 5 + 73), size: 0.45 + rand(i * 3 + 41) * 0.85,
      color: i % 13 === 0 ? '#ffe2b4' : i % 5 === 0 ? '#91baff' : '#c8f2ff' };
  });

  function flightStars(p, alpha, centerX, centerY) {
    if (alpha <= 0) return;
    const travel = Math.max(0, p - 0.26);
    const distance = travel * 0.22 + travel * travel * travel * 19;
    const acceleration = transitEase((p - 0.37) / 0.35);
    const braking = 1 - transitEase((p - 0.86) / 0.10);
    // Tail length follows the derivative of distance, giving each star a
    // continuous point-to-streak change as the ship accelerates.
    const shutter = (0.22 + 57 * travel * travel) * 0.008 * braking;
    const focal = Math.min(width, height) * (0.72 - acceleration * 0.18);
    const roll = Math.sin(travel * 6) * 0.032, cos = Math.cos(roll), sin = Math.sin(roll);
    const count = width < 700 ? 320 : warpStars.length;
    g.save(); g.globalCompositeOperation = 'screen'; g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const star = warpStars[i];
      const z = 0.055 + ((star.z - distance) % 1 + 1) % 1;
      const x = star.x * cos - star.y * sin, y = star.x * sin + star.y * cos;
      const sx = centerX + x * focal / z, sy = centerY + y * focal / z;
      const farZ = z + shutter * (0.55 + star.size);
      const tx = centerX + x * focal / farZ, ty = centerY + y * focal / farZ;
      if ((sx < -30 && tx < -30) || (sx > width + 30 && tx > width + 30) ||
          (sy < -30 && ty < -30) || (sy > height + 30 && ty > height + 30)) continue;
      const emerge = clamp((1.055 - z) * 5, 0, 1);
      const glow = alpha * emerge * (0.38 + Math.min(1, 0.24 / z) * 0.62);
      const thickness = Math.min(2.8, star.size * (0.35 + 0.30 / z));
      g.strokeStyle = star.color;
      if (i % 5 === 0 && acceleration > 0.25) {
        g.globalAlpha = glow * 0.18; g.lineWidth = thickness * 5;
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(sx, sy); g.stroke();
      }
      g.globalAlpha = glow; g.lineWidth = thickness;
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(sx, sy); g.stroke();
      if (shutter < 0.015 || i % 8 === 0) {
        g.fillStyle = '#eefaff'; circle(g, sx, sy, Math.min(1.7, thickness * 0.65)); g.fill();
      }
    }
    g.restore();
  }

  // The canopy stays close to the viewer while the galaxy moves past it. Its
  // narrow silhouette leaves the scene and the HTML skip control unobstructed.
  function flightCockpit(p, alpha, centerX, centerY) {
    if (alpha <= 0) return;
    const speed = transitEase((p - 0.38) / 0.35) * (1 - transitEase((p - 0.87) / 0.09));
    const unit = Math.min(width, height);
    g.save(); g.globalAlpha = alpha;
    const material = g.createLinearGradient(0, height * 0.7, 0, height);
    material.addColorStop(0, '#081520'); material.addColorStop(0.7, '#050b13'); material.addColorStop(1, '#01040a');
    g.fillStyle = material;
    g.beginPath(); g.moveTo(0, height * 0.66); g.lineTo(width * 0.07, height * 0.81);
    g.quadraticCurveTo(width * 0.14, height * 0.92, width * 0.30, height * 0.966);
    g.quadraticCurveTo(width * 0.5, height * 0.985, width * 0.70, height * 0.966);
    g.quadraticCurveTo(width * 0.86, height * 0.92, width * 0.93, height * 0.81);
    g.lineTo(width, height * 0.66); g.lineTo(width, height); g.lineTo(0, height); g.closePath(); g.fill();
    g.strokeStyle = '#79c7df'; g.globalAlpha = alpha * (0.24 + speed * 0.25); g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, height * 0.66); g.lineTo(width * 0.07, height * 0.81);
    g.quadraticCurveTo(width * 0.14, height * 0.92, width * 0.30, height * 0.966);
    g.quadraticCurveTo(width * 0.5, height * 0.985, width * 0.70, height * 0.966);
    g.quadraticCurveTo(width * 0.86, height * 0.92, width * 0.93, height * 0.81);
    g.lineTo(width, height * 0.66); g.stroke();
    // Slim upper canopy ribs and their inner reflections establish the glass.
    for (let side = -1; side <= 1; side += 2) {
      const edgeX = side < 0 ? 0 : width;
      g.globalAlpha = alpha * 0.88; g.strokeStyle = '#030812'; g.lineWidth = unit * 0.025;
      g.beginPath(); g.moveTo(edgeX, height * 0.18);
      g.quadraticCurveTo(width * (0.5 + side * 0.46), height * 0.035, width * (0.5 + side * 0.24), -8); g.stroke();
      g.globalAlpha = alpha * 0.3; g.strokeStyle = '#6aa1bb'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(edgeX - side * unit * 0.014, height * 0.18);
      g.quadraticCurveTo(width * (0.5 + side * 0.445), height * 0.042, width * (0.5 + side * 0.235), 0); g.stroke();
      // Paired illuminated strips are fixed to the dashboard, not the tunnel.
      const panelX = side < 0 ? width * 0.045 : width * 0.955;
      g.save(); g.translate(panelX, height * 0.942); g.rotate(side * -0.23);
      const panelWidth = Math.min(width * 0.14, 110);
      g.globalAlpha = alpha * 0.75; g.fillStyle = '#0c2935'; g.fillRect(side < 0 ? 0 : -panelWidth, 0, panelWidth, 2);
      g.fillStyle = '#99dce8';
      for (let i = 0; i < 11; i++) {
        g.globalAlpha = alpha * (i / 11 < speed ? 0.6 : 0.13);
        const x = side < 0 ? i * panelWidth / 11 : -(i + 1) * panelWidth / 11;
        g.fillRect(x, 6, Math.max(1, panelWidth / 11 - 3), i % 3 === 0 ? 6 : 3);
      }
      g.restore();
    }
    // A restrained projected navigation sight is anchored to the windshield.
    const aim = unit * 0.065;
    g.globalAlpha = alpha * 0.24; g.strokeStyle = '#9fdfe6'; g.lineWidth = 1;
    g.beginPath();
    g.moveTo(centerX - aim * 1.3, centerY); g.lineTo(centerX - aim, centerY);
    g.moveTo(centerX + aim, centerY); g.lineTo(centerX + aim * 1.3, centerY);
    g.moveTo(centerX, centerY - aim * 1.3); g.lineTo(centerX, centerY - aim);
    g.stroke();
    g.restore();
  }

  function cinematicTransit(run, timeline) {
    const { progress: p, galaxy, horizon, tunnel } = timeline;
    if (timeline.reducedMotion) {
      g.fillStyle = `rgba(2,5,12,${timeline.black})`; g.fillRect(0, 0, width, height);
      return;
    }
    // Screen-space layers are tied to simulation progress, never wall time.
    if (galaxy > 0) {
      g.save(); g.globalAlpha = galaxy;
      g.fillStyle = '#020712'; g.fillRect(0, 0, width, height);
      galaxyChart(g, run, width, height, { full: true, orbit: -0.32 + p * 1.2, transit: timeline });
      g.restore();
    }
    const centerX = width * (0.5 + Math.sin((p - 0.26) * 5) * 0.014);
    const centerY = height * (0.455 - Math.sin((p - 0.26) * 3) * 0.01);
    const flightAlpha = transitEase((p - 0.29) / 0.10) * (1 - transitEase((p - 0.87) / 0.10));
    if (horizon > 0) {
      g.save(); g.globalAlpha = horizon;
      g.fillStyle = '#02040b'; g.fillRect(0, 0, width, height);
      const dive = transitEase((p - 0.43) / 0.29);
      if (assets.horizon) {
        const img = assets.horizon, scale = Math.max(width / img.width, height / img.height) * (1.02 + dive * dive * 2.3);
        g.save(); g.translate(centerX, centerY); g.rotate(-0.035 + dive * 0.07);
        g.drawImage(img, -img.width * scale / 2, -img.height * scale / 2, img.width * scale, img.height * scale); g.restore();
      } else {
        // The procedural horizon preserves the approach if its art is offline.
        const radius = Math.min(width, height) * (0.13 + dive * dive * 0.92);
        const glow = g.createRadialGradient(centerX, centerY, radius * 0.45, centerX, centerY, radius * 2.7);
        glow.addColorStop(0, '#02040c00'); glow.addColorStop(0.34, '#ffc78128');
        glow.addColorStop(0.54, '#de7d3b20'); glow.addColorStop(0.78, '#568dd511'); glow.addColorStop(1, '#03040b00');
        g.fillStyle = glow; g.fillRect(0, 0, width, height);
        g.save(); g.translate(centerX, centerY); g.rotate(-0.12 + dive * 0.1);
        g.globalCompositeOperation = 'screen';
        for (let i = 0; i < 14; i++) {
          const spread = 1 + i * 0.085;
          g.strokeStyle = i % 4 === 0 ? '#badcf9' : i % 3 === 0 ? '#ffeaca' : '#db9259';
          g.globalAlpha = horizon * (0.065 + (14 - i) * 0.008);
          g.lineWidth = i < 3 ? 2.6 : 0.7;
          g.beginPath(); g.ellipse(0, 0, radius * spread * 1.85, radius * spread * 0.29, 0, 0, TAU); g.stroke();
        }
        g.globalCompositeOperation = 'source-over'; g.globalAlpha = horizon;
        g.fillStyle = '#01030a'; circle(g, 0, 0, radius * 0.96); g.fill();
        g.globalAlpha = horizon * 0.9;
        g.strokeStyle = '#ffdaaa'; g.lineWidth = 1.7;
        g.beginPath(); g.arc(0, 0, radius, Math.PI * 0.97, Math.PI * 2.13); g.stroke();
        g.strokeStyle = '#d7e9ff50'; g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, radius * 1.023, 0.10, Math.PI * 0.87); g.stroke();
        g.restore();
      }
      g.restore();
    }
    if (tunnel > 0) {
      g.save();
      const glow = g.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.85);
      glow.addColorStop(0, '#071421'); glow.addColorStop(0.12, '#0a192e');
      glow.addColorStop(0.4, '#102741'); glow.addColorStop(0.7, '#09132a'); glow.addColorStop(1, '#020711');
      g.globalAlpha = tunnel; g.fillStyle = glow; g.fillRect(0, 0, width, height);
      // Broad dust clouds provide scale behind the much faster foreground stars.
      if (assets.nebula) {
        const img = assets.nebula;
        const zoom = 1.20 + transitEase((p - 0.62) / 0.29) * 1.6;
        const scale = Math.max(width / img.width, height / img.height) * zoom;
        g.globalAlpha = tunnel * 0.5; g.globalCompositeOperation = 'screen';
        g.drawImage(img, centerX - img.width * scale * 0.49, centerY - img.height * scale * 0.46, img.width * scale, img.height * scale);
      }
      // The galactic dust lane fills peripheral vision as it slips past the
      // ship. It reuses the chart's cached texture, so this costs one image draw.
      if (galaxyTexture) {
        const sweep = transitEase((p - 0.62) / 0.28);
        const size = Math.max(width, height) * (1.75 + sweep * 1.4);
        g.save(); g.translate(centerX, centerY); g.rotate(-0.38);
        g.globalAlpha = tunnel * 0.27; g.globalCompositeOperation = 'screen';
        g.drawImage(galaxyTexture, -size * 0.42, -size * 0.45, size, size * 0.85);
        g.restore();
      }
      // Thin bowed filaments share the stars' vanishing point, like distant
      // nebula strands being stretched by the drive. No opaque tunnel walls.
      g.globalCompositeOperation = 'screen'; g.strokeStyle = '#73c5ea';
      const reach = Math.hypot(width, height), advance = Math.max(0, p - 0.62);
      for (let i = 0; i < 16; i++) {
        const angle = i / 16 * TAU + 0.18;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        g.globalAlpha = tunnel * (i % 3 === 0 ? 0.12 : 0.055); g.lineWidth = i % 3 === 0 ? 2 : 0.7;
        g.beginPath(); g.moveTo(centerX + dx * 16, centerY + dy * 16);
        g.bezierCurveTo(centerX + dx * reach * 0.16 - dy * advance * reach * 0.17,
          centerY + dy * reach * 0.16 + dx * advance * reach * 0.17,
          centerX + dx * reach * 0.42, centerY + dy * reach * 0.42,
          centerX + dx * reach, centerY + dy * reach); g.stroke();
      }
      // A single broad exit glow grows during braking, avoiding a flash cut.
      const arrival = transitEase((p - 0.82) / 0.10);
      if (arrival > 0) {
        const exit = g.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.min(width, height) * (0.1 + arrival * 0.55));
        exit.addColorStop(0, '#c5f4ff88'); exit.addColorStop(0.20, '#66cdeb38'); exit.addColorStop(1, '#3b82be00');
        g.globalAlpha = tunnel * arrival; g.fillStyle = exit; g.fillRect(0, 0, width, height);
      }
      g.restore();
    }
    flightStars(p, flightAlpha, centerX, centerY);
    g.save();
    const edge = g.createRadialGradient(centerX, centerY, Math.min(width, height) * 0.23, centerX, centerY, Math.max(width, height) * 0.76);
    edge.addColorStop(0, '#01030a00'); edge.addColorStop(1, '#01030acd');
    g.fillStyle = edge; g.globalAlpha = Math.max(galaxy, horizon, tunnel) * 0.63; g.fillRect(0, 0, width, height);
    g.restore();
    flightCockpit(p, flightAlpha, centerX, centerY);
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
    const timeline = run.phase === 'flight' && run.flight ? sampleTransit(run.flight.progress, reducedMotion) : null;
    const visibleIds = visibleSectorIds(run, options);
    if (canvas.dataset) {
      canvas.dataset.transitPhase = timeline?.phase || 'none';
      canvas.dataset.visibleSector = visibleIds.length ? String(visibleIds[0]) : 'none';
    }
    if (lastFlight !== run.flight) {
      trail.length = 0; particles.length = 0; rings.length = 0;
      lastFlight = run.flight;
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    backdrop(run);
    if (options.overview) {
      const shortLandscape = width > height && height <= 620;
      const sideCard = width > 760 || shortLandscape;
      const chartWidth = sideCard ? width - (shortLandscape ? 300 : 382) : width;
      const chartHeight = sideCard ? height - 70 : Math.max(220, height - 300);
      g.save(); g.translate(sideCard ? 10 : 0, sideCard ? 65 : 62);
      galaxyChart(g, run, chartWidth, chartHeight, { full: true }); g.restore();
      map(run);
      return;
    }
    if (visibleIds.length) {
      const sectorIndex = visibleIds[0], room = run.sectors[sectorIndex];
      // Flight rendering never reads the engine's interpolated route position.
      // That route is hidden; only the departure gate and arrival dock are shown.
      const renderRun = timeline ? { ...run, sectorIndex,
        phase: timeline.visible === 'destination' ? 'ready' : 'flight',
        world: { ...run.world, ball: { ...run.world.ball,
          ...(timeline.visible === 'destination' ? run.flight.to : run.flight.from), vx: 0, vy: 0 } } } : run;
      g.save();
      g.translate(width / 2, camera.centerY);
      g.rotate(camera.rotation || 0);
      g.scale(camera.scale, -camera.scale);
      g.translate(-camera.x, -camera.y);
      for (const star of stars) {
        if (!visible(star.x, star.y, 3)) continue;
        g.fillStyle = `rgba(202,221,235,${star.a * 0.5})`; circle(g, star.x, star.y, star.r); g.fill();
      }
      const clock = run.clock || 0, color = room.color || PALETTE[sectorIndex % 6];
      orbitDust(room);
      gravityField(room, renderRun, !timeline, clock);
      planet(room.planet, sectorIndex, color, clock, !timeline, renderRun.world.ball);
      gate(room, clock, !timeline);
      for (const target of room.relays || []) relay(target, color, clock);
      if (!timeline) label(room.name.toUpperCase(), room.x, room.y + room.h - 42, `${color}b0`, 12);
      for (let i = 0; i < run.table.bumpers.length; i++) {
        const bumper = run.table.bumpers[i];
        if (bumper.sector === sectorIndex && !bumper.relay) asteroid(bumper, i, '#adbad1');
      }
      rails(run.table, sectorIndex);
      flippers(renderRun);
      if (!timeline) {
        if (run.gravityWell?.remaining > 0) temporaryField(run.gravityWell, clock);
        if (options.fieldAim) temporaryField(options.fieldAim, clock, true);
        trajectory(run, options.charge || 0, options.fieldAim);
        effects(options.freezeCamera ? 0 : elapsed);
      }
      drawBall(renderRun, options.freezeCamera || timeline ? 0 : elapsed, options.charge || 0);
      g.restore();
    }
    if (timeline) {
      if (!timeline.reducedMotion && timeline.worldAlpha < 1) {
        g.fillStyle = `rgba(2,5,12,${1 - timeline.worldAlpha})`; g.fillRect(0, 0, width, height);
      }
      cinematicTransit(run, timeline);
    }
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

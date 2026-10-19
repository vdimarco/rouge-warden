// The room is painted once. Each frame copies it, then draws the ball, shadow, trail, bat, Neighbour and sparks.
// Painted sheets in ./art/ replace the hall, the Neighbour and the bat when they load. A miss falls back to the code drawing.

import { batHover, batPresentation } from './motion.js';
import { RULES } from './rules.js';

const INK = '#2B2A33';
const PAPER = '#F3E9D6';
const SEA = '#3E7C8F';
const SEA_DEEP = '#2C6274';
const OCHRE = '#C98B3C';
const SMOG = '#8A8378';
const GOLD = '#E8B94A';
const EMBER = '#B5472E';
const WOOD = '#8C5A32';

const ART_FILES = {
  hall: 'hall-backdrop.webp',
  table: 'table-texture.webp',
  ready: 'neighbour-ready.webp',
  forehand: 'neighbour-forehand.webp',
  backhand: 'neighbour-backhand.webp',
  bat: 'player-bat.webp',
};

// The hall sheet is 780 by 1398 with a thin paper frame. Crop past that frame.
const HALL_CROP = { left: 12 / 780, top: 24 / 1398, right: 12 / 780, bottom: 26 / 1398 };
// Zoom and bias the sheet upward so the pendant lamp clears the Neighbour.
// The wall behind the far end of the table stays plain.
const HALL_ZOOM = 1.28;
const HALL_LIFT = 0.9;

// Where the sheet is drawn. Portrait cover-fits. A wider canvas fits the same
// vertical slice by height, so the windows, lamp and wall stay in frame.
export function hallFrame(viewW, viewH, imgW = 780, imgH = 1398) {
  const sx = Math.round(imgW * HALL_CROP.left);
  const sy = Math.round(imgH * HALL_CROP.top);
  const sw = Math.max(1, Math.round(imgW * (1 - HALL_CROP.left - HALL_CROP.right)));
  const sh = Math.max(1, Math.round(imgH * (1 - HALL_CROP.top - HALL_CROP.bottom)));
  const widthDriven = viewW / sw > viewH / sh;
  const scale = (widthDriven ? viewH / sh : Math.max(viewW / sw, viewH / sh)) * HALL_ZOOM;
  const dw = sw * scale;
  const dh = sh * scale;
  return {
    widthDriven,
    sx,
    sy,
    sw,
    sh,
    dx: (viewW - dw) / 2,
    dy: -(dh - viewH) * HALL_LIFT,
    dw,
    dh,
  };
}

// Cropped-sheet fraction at a screen y. 0 is the top of the crop, 1 is the bottom.
export function hallSourceV(frame, screenY) {
  return (-frame.dy + screenY) / frame.dh;
}

// The forehand sheet holds the bat on the right, so a ball on the right uses it.
export function neighbourPose(swing, time) {
  if (!swing || !Number.isFinite(time) || !Number.isFinite(swing.t)) return 'ready';
  const age = time - swing.t;
  if (!(age >= 0 && age < 0.25)) return 'ready';
  return swing.x < 0 ? 'backhand' : 'forehand';
}

function imageReady(img) {
  return !!(img && img.complete && img.naturalWidth);
}

function rgb(color) {
  return 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')';
}

function sampleBand(img, frame, v) {
  const probe = document.createElement('canvas');
  probe.width = 4;
  probe.height = 4;
  const g = probe.getContext('2d', { willReadFrequently: true });
  const y = frame.sy + frame.sh * v;
  const band = Math.max(1, frame.sh * 0.05);
  const slice = Math.max(1, frame.sw * 0.06);
  g.drawImage(img, frame.sx, y, slice, band, 0, 0, 2, 4);
  g.drawImage(img, frame.sx + frame.sw - slice, y, slice, band, 2, 0, 2, 4);
  const data = g.getImageData(0, 0, 4, 4).data;
  let r = 0;
  let gc = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    gc += data[i + 1];
    b += data[i + 2];
    n += 1;
  }
  return [Math.round(r / n), Math.round(gc / n), Math.round(b / n)];
}

function paintHallWings(ctx, img, frame, w, h) {
  const top = sampleBand(img, frame, 0.24);
  const bottom = sampleBand(img, frame, 0.9);
  const field = ctx.createLinearGradient(0, 0, 0, h);
  field.addColorStop(0, rgb(top));
  field.addColorStop(0.46, rgb(top));
  field.addColorStop(1, rgb(bottom));
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, w, h);

  const seam = Math.min(88, frame.dx);
  ctx.save();
  ctx.filter = 'blur(16px)';
  ctx.globalAlpha = 0.9;
  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.dx - seam, 0, seam + 10, h);
  ctx.clip();
  ctx.translate(frame.dx, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, 0, frame.dy, frame.dw, frame.dh);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.dx + frame.dw - 10, 0, seam + 10, h);
  ctx.clip();
  ctx.translate(frame.dx + frame.dw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, -frame.dw, frame.dy, frame.dw, frame.dh);
  ctx.restore();
  ctx.restore();
}

function drawHall(ctx, img, w, h) {
  const frame = hallFrame(w, h, img.naturalWidth, img.naturalHeight);
  if (frame.widthDriven && frame.dx > 1) paintHallWings(ctx, img, frame, w, h);
  ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, frame.dx, frame.dy, frame.dw, frame.dh);
}

function paintTableWash(ctx, img, pts) {
  if (!imageReady(img)) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  ctx.save();
  poly(ctx, pts);
  ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.drawImage(img, minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY));
  ctx.restore();
}

export function project(x, y, z, w, h) {
  const depth = Math.max(-0.05, Math.min(1.2, z / RULES.tableLength));
  const k = (1 / RULES.farWidth) - 1;
  const s = 1 / (1 + Math.max(0, depth) * k);
  const nearW = Math.min(w * 0.9, h * 0.92);
  const sx = w * 0.5 + (x / RULES.halfWidth) * (nearW * 0.5) * s;
  const bottom = h - RULES.safePx;
  const top = Math.max(RULES.safePx + 8, h * 0.30);
  const sy0 = bottom + (top - bottom) * ((1 - s) / (1 - RULES.farWidth));
  const sy = sy0 - y * s * Math.min(h * 0.42, 340);
  return { x: sx, y: sy, s, tableY: sy0 };
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function drawStatic(ctx, w, h, art) {
  const hall = imageReady(art && art.hall);
  ctx.fillStyle = SMOG;
  ctx.fillRect(0, 0, w, h);

  const p = (x, y, z) => project(x, y, z, w, h);
  if (hall) {
    drawHall(ctx, art.hall, w, h);
  } else {
    const lamp = ctx.createRadialGradient(w * 0.5, h * 0.16, 10, w * 0.5, h * 0.22, w * 0.55);
    lamp.addColorStop(0, 'rgba(232, 185, 74, 0.55)');
    lamp.addColorStop(1, 'rgba(232, 185, 74, 0)');
    ctx.fillStyle = lamp;
    ctx.fillRect(0, 0, w, h);
    for (let i = -6; i <= 8; i++) {
      const z = -0.35 + i * 0.42;
      const a = p(-1.7, -0.02, z);
      const b = p(1.7, -0.02, z);
      ctx.strokeStyle = i % 2 === 0 ? '#B67932' : '#D39A4A';
      ctx.lineWidth = Math.max(1, 3 * a.s);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  const nearL = p(-RULES.halfWidth, 0, 0);
  const nearR = p(RULES.halfWidth, 0, 0);
  const farR = p(RULES.halfWidth, 0, RULES.tableLength);
  const farL = p(-RULES.halfWidth, 0, RULES.tableLength);
  const frontL = p(-RULES.halfWidth, -0.07, 0);
  const frontR = p(RULES.halfWidth, -0.07, 0);

  ctx.fillStyle = '#6E4A28';
  poly(ctx, [nearL, nearR, frontR, frontL]);
  ctx.fill();

  const sheen = ctx.createLinearGradient(0, farL.y, 0, nearL.y);
  sheen.addColorStop(0, '#6FA3B4');
  sheen.addColorStop(0.45, SEA);
  sheen.addColorStop(1, SEA_DEEP);
  ctx.fillStyle = sheen;
  poly(ctx, [nearL, nearR, farR, farL]);
  ctx.fill();
  paintTableWash(ctx, art && art.table, [nearL, nearR, farR, farL]);

  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const edge = [nearL, nearR, farR, farL, nearL];
  ctx.moveTo(edge[0].x, edge[0].y);
  for (let i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  const midL = p(-RULES.halfWidth, 0, RULES.netZ);
  const midR = p(RULES.halfWidth, 0, RULES.netZ);
  ctx.beginPath();
  ctx.moveTo(midL.x, midL.y);
  ctx.lineTo(midR.x, midR.y);
  ctx.stroke();
  const c0 = p(0, 0, 0.35);
  const c1 = p(0, 0, RULES.tableLength - 0.35);
  ctx.beginPath();
  ctx.moveTo(c0.x, c0.y);
  ctx.lineTo(c1.x, c1.y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(43, 42, 51, 0.18)';
  poly(ctx, [
    p(-RULES.halfWidth, 0, RULES.netZ - 0.08),
    p(RULES.halfWidth, 0, RULES.netZ - 0.08),
    p(RULES.halfWidth, 0, RULES.netZ + 0.16),
    p(-RULES.halfWidth, 0, RULES.netZ + 0.16),
  ]);
  ctx.fill();

  const netTopL = p(-RULES.halfWidth, RULES.netHeight, RULES.netZ);
  const netTopR = p(RULES.halfWidth, RULES.netHeight, RULES.netZ);
  const netBotL = p(-RULES.halfWidth, 0, RULES.netZ);
  const netBotR = p(RULES.halfWidth, 0, RULES.netZ);
  ctx.strokeStyle = 'rgba(43, 42, 51, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    ctx.beginPath();
    ctx.moveTo(netBotL.x + (netBotR.x - netBotL.x) * t, netBotL.y + (netBotR.y - netBotL.y) * t);
    ctx.lineTo(netTopL.x + (netTopR.x - netTopL.x) * t, netTopL.y + (netTopR.y - netTopL.y) * t);
    ctx.stroke();
  }
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(netBotL.x + (netTopL.x - netBotL.x) * t, netBotL.y + (netTopL.y - netBotL.y) * t);
    ctx.lineTo(netBotR.x + (netTopR.x - netBotR.x) * t, netBotR.y + (netTopR.y - netBotR.y) * t);
    ctx.stroke();
  }
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(netTopL.x, netTopL.y);
  ctx.lineTo(netTopR.x, netTopR.y);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(netBotL.x, netBotL.y);
  ctx.lineTo(netTopL.x, netTopL.y);
  ctx.moveTo(netBotR.x, netBotR.y);
  ctx.lineTo(netTopR.x, netTopR.y);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(netTopL.x, netTopL.y);
  ctx.lineTo(netTopR.x, netTopR.y);
  ctx.lineTo(netBotR.x, netBotR.y);
  ctx.lineTo(netBotL.x, netBotL.y);
  ctx.closePath();
  ctx.stroke();

  if (!hall) {
    const vignette = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.2, w * 0.5, h * 0.55, w * 0.75);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    paintGrain(ctx, w, h);
  }
}

function paintGrain(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(243, 233, 214, 0.05)';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) {
    const x = ((i * 97) % 1000) / 1000 * w;
    const y = ((i * 57 + (i % 11) * 13) % 1000) / 1000 * h;
    ctx.globalAlpha = 0.05 + (i % 5) * 0.012;
    ctx.fillStyle = i % 3 === 0 ? PAPER : INK;
    ctx.fillRect(x, y, 1.15, 1.15);
  }
  ctx.restore();
}

export function createView(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let layer = null;
  let key = '';
  let dprLimit = RULES.dprCap;
  let trailCap = 0;
  const trail = [];
  const sparks = [];
  let ring = 0;
  let ringAt = null;
  let ghostSeen = 4;
  let splat = null;
  let splatKey = '';
  let splatFade = 0;
  let splatSeen = -1;
  let splatFading = false;
  let splatMarks = 0;
  let slash = null;
  const art = {};
  let neighbourSwing = null;

  function preloadArt() {
    for (const name of Object.keys(ART_FILES)) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        art[name] = img;
        key = '';
      };
      img.onerror = () => {
        art[name] = null;
      };
      img.src = new URL('./art/' + ART_FILES[name], import.meta.url).href;
    }
  }
  preloadArt();

  function noteNeighbour(state) {
    const list = state.events || [];
    for (let i = 0; i < list.length; i++) {
      const ev = list[i];
      if (ev.type === 'pock' && ev.who === 'neighbour') neighbourSwing = { t: ev.t, x: ev.x };
    }
  }

  function pixelRatio() {
    const cssW = Math.max(1, canvas.clientWidth || 1);
    const allowed = Math.min(RULES.dprCap, window.devicePixelRatio || 1, dprLimit);
    // A 2560-wide view at device ratio 2 is an 8 megapixel blit. Cap the backing store.
    return Math.min(allowed, 2560 / cssW);
  }

  function setDprCap(n) {
    dprLimit = n;
    key = '';
  }

  function resize() {
    const dpr = pixelRatio();
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    key = '';
    return { w, h, dpr };
  }

  function ensure(w, h, dpr) {
    const next = w + 'x' + h + '@' + dpr;
    if (layer && key === next) return;
    layer = document.createElement('canvas');
    layer.width = Math.round(w * dpr);
    layer.height = Math.round(h * dpr);
    const g = layer.getContext('2d', { alpha: false });
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStatic(g, w, h, art);
    key = next;
    if (!splat || splatKey !== next) {
      const seen = splatSeen;
      splat = document.createElement('canvas');
      splat.width = layer.width;
      splat.height = layer.height;
      splatKey = next;
      splatFade = 0;
      splatSeen = seen;
      splatFading = false;
      splatMarks = 0;
    }
  }

  function setTrailCap(n) {
    trailCap = n;
  }

  function ghostsFor(kind) {
    if (trailCap > 0) return trailCap;
    if (kind === 'smash') return RULES.trailSmash;
    if (kind === 'drive') return RULES.trailDrive;
    return 3;
  }

  function frame(state, pose) {
    const dpr = pixelRatio();
    const w = canvas.clientWidth || 390;
    const h = canvas.clientHeight || 844;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) resize();
    ensure(w, h, dpr);
    const shake = state.shake ? ((state.time * 60) % 2 < 1 ? state.shake : -state.shake) : 0;
    const nudge = state.nudge || 0;
    ctx.setTransform(dpr, 0, 0, dpr, nudge + shake, shake * 0.3);
    ctx.drawImage(layer, 0, 0, w, h);
    blitSplats(ctx, state, w, h, dpr);
    const ball = state.ball;
    const shadow = project(ball.x, 0, ball.z, w, h);
    const lift = Math.max(0, ball.y);
    const rx = (7 + lift * 16) * shadow.s;
    const ry = Math.max(2, rx * (0.28 + Math.min(0.2, lift * 0.15)));
    const alpha = Math.max(0.12, 0.58 - lift * 0.38);
    ctx.fillStyle = `rgba(20, 16, 12, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    if (state.bounceRing > 0 && state.lastLanding) {
      ring = state.bounceRing;
      ringAt = project(state.lastLanding.x, 0, state.lastLanding.z, w, h);
    }
    if (ring > 0 && ringAt) {
      ctx.strokeStyle = `rgba(243, 233, 214, ${ring / 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ringAt.x, ringAt.y, 10 + (0.2 - ring) * 40, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const body = project(ball.x, ball.y, ball.z, w, h);
    const kind = state.lastShot && state.lastShot.kind;
    const perfect = state.lastShot && state.lastShot.band === 'perfect';
    const count = ghostsFor(kind);
    ghostSeen = count;
    trail.push({ x: body.x, y: body.y, s: body.s, perfect });
    if (trail.length > 10) trail.shift();
    const ghosts = trail.slice(-count);
    for (let i = 0; i < ghosts.length - 1; i++) {
      const g = ghosts[i];
      ctx.globalAlpha = (i + 1) / ghosts.length * 0.45;
      ctx.fillStyle = g.perfect ? GOLD : PAPER;
      ctx.beginPath();
      ctx.arc(g.x, g.y, Math.max(2, 6 * g.s), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const spin = (ball.spinLevel || 0) * (ball.spinType === 'back' ? -1 : 1);
    const spinAngle = state.time * (2 + spin * 6);
    const squash = state.squashed ? { x: 1.2, y: 0.8 } : { x: 1, y: 1 };
    const r = Math.max(4, 8 * body.s);
    const glow = ballGlow();
    const gr = r * 2.6;
    ctx.drawImage(glow, body.x - gr, body.y - gr, gr * 2, gr * 2);
    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.scale(squash.x, squash.y);
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = ball.spinType === 'back' ? EMBER : INK;
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, spinAngle, spinAngle + 1.4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.32, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (ball.spinLevel > 0) {
      ctx.strokeStyle = ball.spinType === 'back' ? EMBER : GOLD;
      ctx.globalAlpha = 0.35 + ball.spinLevel * 0.15;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(body.x, body.y, r + 4 + ball.spinLevel, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    drawNeighbour(ctx, w, h, state);
    drawBat(ctx, w, h, state, pose);
    drawSlash(ctx, state, w, h);
    drawSparks(ctx, state, w, h);
    drawHud(ctx, w, h, state);
    drawAim(ctx, pose);
  }

  function drawAim(ctx, pose) {
    const dot = pose && pose.dot;
    if (!dot || !Number.isFinite(dot.x) || !Number.isFinite(dot.y)) return;
    ctx.save();
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function stampSplat(state, w, h, dpr) {
    const land = state.lastLanding;
    if (!splat || !land || land.t === splatSeen) return;
    const g = splat.getContext('2d');
    if (splatFading) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, splat.width, splat.height);
      splatMarks = 0;
      splatFading = false;
    }
    splatSeen = land.t;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const at = project(land.x, 0, land.z, w, h);
    const kind = state.lastShot && state.lastShot.kind;
    g.globalAlpha = 1;
    g.fillStyle = kind === 'smash' ? EMBER : kind === 'push' ? SEA : kind === 'drive' ? OCHRE : INK;
    g.beginPath();
    g.ellipse(at.x, at.y, Math.max(4, 8 * at.s), Math.max(2, 3.4 * at.s), 0.3, 0, Math.PI * 2);
    g.fill();
    splatFade = 1;
    splatMarks += 1;
  }

  function blitSplats(ctx, state, w, h, dpr) {
    stampSplat(state, w, h, dpr);
    const ending = state.phase === 'pause' || state.phase === 'gameover';
    if (ending && splatFade > 0) splatFading = true;
    if (splatFading) {
      splatFade = Math.max(0, splatFade - (1 / 60) / 0.6);
      if (splatFade < 1e-4 && splat) {
        splatFade = 0;
        const g = splat.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, splat.width, splat.height);
        splatFading = false;
        splatMarks = 0;
      }
    }
    if (!(splatFade > 0) || !splat) return;
    ctx.save();
    ctx.globalAlpha = splatFade * 0.25;
    ctx.drawImage(splat, 0, 0, w, h);
    ctx.restore();
  }

  function drawSlash(ctx, state, w, h) {
    const shot = state.lastShot;
    if (shot && shot.struckAt != null && shot.band !== 'miss' && state.lastContact) {
      if (!slash || slash.id !== shot.struckAt) {
        const kind = shot.kind;
        slash = {
          id: shot.struckAt,
          t: shot.struckAt,
          kind,
          perfect: shot.band === 'perfect',
          color: kind === 'push' ? SEA : kind === 'smash' ? EMBER : OCHRE,
          len: 26 + Math.min(36, (shot.speed || 8) * 1.4),
          dir: shot.pullDeg < 0 ? -1 : 1,
        };
      }
    }
    if (!slash || !state.lastContact) return;
    const age = state.time - slash.t;
    if (age < 0 || age > 0.25) return;
    const at = project(state.lastContact.x, state.lastContact.y, state.lastContact.z, w, h);
    const alpha = 1 - age / 0.25;
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(slash.dir * 0.5);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (slash.perfect) {
      ctx.globalAlpha = alpha * 0.95;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 7;
      brush(ctx, slash.len + 4);
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = slash.color;
    ctx.lineWidth = 3.2;
    brush(ctx, slash.len);
    ctx.restore();
  }

  function drawNeighbour(ctx, w, h, state) {
    noteNeighbour(state);
    const ball = state.ball;
    const lean = Math.max(-0.35, Math.min(0.35, ball.x / RULES.halfWidth));
    const base = project(lean * 0.45, 0, RULES.tableLength + 0.05, w, h);
    const tall = 60;
    const huff = state.lastPointWinner === 'neighbour' && state.phase === 'pause' ? -6 : 0;
    const swinging = state.phase === 'outgoing' && ball.z > RULES.netZ;
    const poseName = neighbourPose(neighbourSwing, state.time);
    const sprite = imageReady(art[poseName]) ? art[poseName] : null;
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.fillStyle = 'rgba(43,42,51,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (sprite) {
      const ih = tall;
      const iw = ih * (sprite.naturalWidth / sprite.naturalHeight);
      ctx.drawImage(sprite, -iw * 0.5, -ih + huff, iw, ih);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#3E4C59';
    ctx.fillRect(-11, -tall + 28 + huff, 22, 26);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(-11, -tall + 28 + huff, 22, 26);
    ctx.fillStyle = OCHRE;
    ctx.fillRect(-12, -tall + 24 + huff, 24, 10);
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(0, -tall + 16 + huff, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-3, -tall + 16 + huff, 1.05, 0, Math.PI * 2);
    ctx.arc(3.1, -tall + 15.4 + huff, 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0.4, -tall + 19.2 + huff, 2.4, 0.25, Math.PI - 0.15);
    ctx.stroke();
    ctx.fillStyle = EMBER;
    ctx.beginPath();
    ctx.ellipse(0, -tall + 12 + huff, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.fillRect(-1.2, -tall + 34 + huff, 2.4, 2.4);
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const arm = swinging ? -26 : -8;
    ctx.moveTo(8, -tall + 32 + huff);
    ctx.lineTo(20, -tall + 32 + arm * 0.3 + huff);
    ctx.stroke();
    ctx.fillStyle = EMBER;
    ctx.beginPath();
    ctx.ellipse(22, -tall + 30 + arm * 0.25 + huff, 7, 9, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBat(ctx, w, h, state, pose) {
    const held = state.bat || { x: 0, depth: RULES.batHomeZ, roll: 0 };
    const face = batPresentation({
      roll: pose && Number.isFinite(pose.roll) ? pose.roll : held.roll,
      tiltY: pose && pose.tiltY,
      push: pose && pose.push,
      x: held.x,
    });
    const z = Math.max(RULES.batBackZ - 0.02, Math.min(RULES.batInZ + RULES.swingPush, held.depth + face.pushZ));
    const anchor = project(held.x, batHover(held.x), z, w, h);
    const width = Math.min(w, h) * (w > h * 1.15 ? 0.22 : 0.32) * (0.62 + 0.38 * anchor.s);
    const age = pose && pose.swingAt ? (performance.now() - pose.swingAt) / 140 : 2;
    const sweep = age >= 0 && age <= 1 ? Math.sin(age * Math.PI) : 0;
    const dir = pose && pose.swingDir === 'backhand' ? -1 : 1;
    const shadow = project(held.x, 0, z, w, h);
    ctx.save();
    ctx.fillStyle = 'rgba(20, 16, 12, 0.10)';
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y + 3, Math.max(14, width * 0.5), Math.max(5, width * 0.14), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 16, 12, 0.16)';
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y + 1, Math.max(8, width * 0.32), Math.max(3, width * 0.08), 0, 0, Math.PI * 2);
    ctx.fill();
    const hang = width * 0.62;
    const y = Math.min(anchor.y, h - RULES.safePx - hang);
    ctx.translate(anchor.x, y);
    ctx.rotate((face.rollDeg * Math.PI) / 180 + dir * sweep * 0.22);
    ctx.transform(1, 0, face.shear, face.scaleY, 0, 0);
    const batSprite = imageReady(art.bat) ? art.bat : null;
    if (batSprite) {
      const bh = width * 1.15;
      const bw = bh * (batSprite.naturalWidth / batSprite.naturalHeight);
      ctx.drawImage(batSprite, -bw * 0.5, -bh * 0.58, bw, bh);
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#6B3A22';
    ctx.fillRect(-7, 8, 14, width * 0.38);
    ctx.fillStyle = INK;
    ctx.fillRect(-6, width * 0.22, 12, width * 0.16);
    ctx.fillStyle = OCHRE;
    roundRect(ctx, -width * 0.5, -width * 0.42, width, width * 0.62, 10);
    ctx.fill();
    ctx.fillStyle = EMBER;
    roundRect(ctx, -width * 0.44, -width * 0.36, width * 0.88, width * 0.5, 8);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    roundRect(ctx, -width * 0.5, -width * 0.42, width, width * 0.62, 10);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(-width * 0.12, -width * 0.16, width * 0.12, width * 0.08, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSparks(ctx, state, w, h) {
    if (state.lastContact && state.lastShot && state.hitstop > 0.01) {
      const at = project(state.lastContact.x, state.lastContact.y, state.lastContact.z, w, h);
      const n = state.lastShot.kind === 'smash' ? 10 : state.lastShot.kind === 'push' ? 4 : 7;
      if (!sparks.length || sparks[0].id !== state.lastShot.struckAt) {
        sparks.length = 0;
        for (let i = 0; i < n; i++) {
          sparks.push({
            id: state.lastShot.struckAt,
            x: at.x,
            y: at.y,
            a: (i / n) * Math.PI * 2,
            d: 6 + (state.lastShot.kind === 'smash' ? 16 : 8),
          });
        }
      }
    }
    ctx.fillStyle = GOLD;
    for (const spark of sparks) {
      ctx.globalAlpha = Math.max(0, state.hitstop / 0.08);
      ctx.beginPath();
      ctx.arc(spark.x + Math.cos(spark.a) * spark.d, spark.y + Math.sin(spark.a) * spark.d, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(ctx, w, h, state) {
    ctx.fillStyle = INK;
    if (state.phase === 'count' && state.count) {
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.font = '600 140px "Fraunces", Palatino, serif';
      ctx.fillText(String(state.count), w * 0.5, h * 0.40);
      ctx.font = '600 28px "Fraunces", Palatino, serif';
      ctx.fillText('Ready', w * 0.5, h * 0.40 + 44);
    }
    if (state.feedback && state.feedback.length) {
      ctx.textAlign = 'center';
      ctx.font = '600 16px "Fraunces", Palatino, serif';
      ctx.fillText(state.feedback.join(' '), w * 0.5, h - 96);
    }
    if (state.paused) {
      ctx.textAlign = 'center';
      ctx.font = '600 18px "Fraunces", Palatino, serif';
      ctx.fillText('Paused', w * 0.5, 80);
    }
    if (state.gameOver) {
      ctx.textAlign = 'center';
      ctx.font = '600 22px "Fraunces", Palatino, serif';
      const who = state.gameWinner === 'you' ? 'You win' : 'Neighbour wins';
      ctx.fillText(who, w * 0.5, 80);
    }
  }

  function lastSlash() {
    if (!slash) return null;
    return {
      kind: slash.kind,
      color: slash.color,
      len: slash.len,
      dir: slash.dir,
      perfect: !!slash.perfect,
      t: slash.t,
    };
  }

  return {
    frame,
    resize,
    setTrailCap,
    setDprCap,
    pixelRatio,
    ghostCount: () => ghostSeen,
    lastSlash,
    splatCount: () => splatMarks,
  };
}

let glowSprite = null;
function ballGlow() {
  if (glowSprite) return glowSprite;
  glowSprite = document.createElement('canvas');
  glowSprite.width = 64;
  glowSprite.height = 64;
  const g = glowSprite.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(243, 233, 214, 0.55)');
  grad.addColorStop(1, 'rgba(243, 233, 214, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return glowSprite;
}

function brush(ctx, len) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6;
    const t1 = (i + 1) / 6;
    const y0 = -len * 0.5 + len * t0;
    const y1 = -len * 0.5 + len * t1;
    const bow0 = Math.sin(t0 * Math.PI) * len * 0.16;
    const bow1 = Math.sin(t1 * Math.PI) * len * 0.16;
    ctx.moveTo(bow0 * 0.35, y0);
    ctx.quadraticCurveTo(len * 0.2, (y0 + y1) * 0.5, bow1, y1);
  }
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

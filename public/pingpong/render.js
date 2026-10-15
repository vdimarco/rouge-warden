// The room is painted once. Each frame copies it, then draws the ball, shadow, trail, bat, Neighbour and sparks.

import { batPresentation } from './motion.js';
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

function drawStatic(ctx, w, h) {
  ctx.fillStyle = SMOG;
  ctx.fillRect(0, 0, w, h);

  const lamp = ctx.createRadialGradient(w * 0.5, h * 0.16, 10, w * 0.5, h * 0.22, w * 0.55);
  lamp.addColorStop(0, 'rgba(232, 185, 74, 0.55)');
  lamp.addColorStop(1, 'rgba(232, 185, 74, 0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, w, h);

  const p = (x, y, z) => project(x, y, z, w, h);
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

  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const edge = [nearL, nearR, farR, farL, nearL];
  ctx.moveTo(edge[0].x, edge[0].y);
  for (let i = 1; i < edge.length; i++) ctx.lineTo(edge[i].x, edge[i].y);
  ctx.stroke();
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

  const vignette = ctx.createRadialGradient(w * 0.5, h * 0.55, w * 0.2, w * 0.5, h * 0.55, w * 0.75);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

export function createView(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let layer = null;
  let key = '';
  let trailCap = 0;
  const trail = [];
  const sparks = [];
  let ring = 0;
  let ringAt = null;
  let ghostSeen = 4;

  function pixelRatio() {
    return Math.min(RULES.dprCap, window.devicePixelRatio || 1);
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
    drawStatic(g, w, h);
    key = next;
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
    drawSparks(ctx, state, w, h);
    drawHud(ctx, w, h, state);
  }

  function drawNeighbour(ctx, w, h, state) {
    const ball = state.ball;
    const lean = Math.max(-0.35, Math.min(0.35, ball.x / RULES.halfWidth));
    const base = project(lean * 0.45, 0, RULES.tableLength + 0.05, w, h);
    const tall = 60;
    const huff = state.lastPointWinner === 'neighbour' && state.phase === 'pause' ? -6 : 0;
    const swinging = state.phase === 'outgoing' && ball.z > RULES.netZ;
    ctx.save();
    ctx.translate(base.x, base.y);
    ctx.fillStyle = 'rgba(43,42,51,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3E4C59';
    ctx.fillRect(-11, -tall + 28 + huff, 22, 26);
    ctx.fillStyle = OCHRE;
    ctx.fillRect(-12, -tall + 24 + huff, 24, 10);
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(0, -tall + 16 + huff, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = EMBER;
    ctx.beginPath();
    ctx.ellipse(0, -tall + 12 + huff, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
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
    });
    const z = Math.max(RULES.batBackZ - 0.02, Math.min(RULES.batInZ + RULES.swingPush, held.depth + face.pushZ));
    const anchor = project(held.x, 0.03, z, w, h);
    const width = Math.min(w, h) * (w > h * 1.15 ? 0.22 : 0.32) * (0.62 + 0.38 * anchor.s);
    const age = pose && pose.swingAt ? (performance.now() - pose.swingAt) / 140 : 2;
    const sweep = age >= 0 && age <= 1 ? Math.sin(age * Math.PI) : 0;
    const dir = pose && pose.swingDir === 'backhand' ? -1 : 1;
    const shadow = project(held.x, 0, z, w, h);
    ctx.save();
    ctx.fillStyle = 'rgba(20, 16, 12, 0.28)';
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, Math.max(8, width * 0.34), Math.max(3, width * 0.09), 0, 0, Math.PI * 2);
    ctx.fill();
    const hang = width * 0.62;
    const y = Math.min(anchor.y, h - RULES.safePx - hang);
    ctx.translate(anchor.x, y);
    ctx.rotate((face.rollDeg * Math.PI) / 180 + dir * sweep * 0.22);
    ctx.transform(1, 0, face.shear, face.scaleY, 0, 0);
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
    ctx.font = '12px "DM Sans", "Gill Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('You ' + state.score.you, 12, 28);
    ctx.textAlign = 'right';
    ctx.fillText(state.score.neighbour + ' Neighbour', w - 64, 28);
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

  return { frame, resize, setTrailCap, pixelRatio, ghostCount: () => ghostSeen };
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

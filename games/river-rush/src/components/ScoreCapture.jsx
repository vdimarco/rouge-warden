import React, { useState } from 'react';
import { LEVELS } from '../game/levels.js';
import './adventure-extras.css';

const count = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
export function scoreCardData(game = {}) {
  const totals = game.campaign ?? game;
  const levelIndex = Math.max(0, Math.min(2, count(game.level?.index)));
  const levelsCleared = Math.min(3, count(totals.levelsCleared));
  const lastClear = levelIndex - (game.phase === 'won' ? 0 : 1);
  const firstClear = Math.max(0, lastClear - levelsCleared + 1);
  return {
    score: count(totals.score), coins: count(totals.coins), distance: count(totals.distance),
    levelsCleared,
    clearedMaps: LEVELS.filter(level => level.index >= firstClear && level.index <= lastClear).map(level => level.index),
    jumps: count(totals.jumps), ducks: count(totals.ducks), levelIndex,
    map: game.level?.name ?? LEVELS[levelIndex].name,
    victory: game.phase === 'won' && levelsCleared === 3,
    finished: game.phase === 'won' || game.phase === 'lost',
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

// Score art is drawn independently from WebGL so a discarded or lost drawing
// buffer never produces an empty download. A readable live frame is optional.
function liveFrame(canvas) {
  if (!canvas?.width || !canvas?.height) return null;
  try {
    const probe = document.createElement('canvas'); probe.width = 40; probe.height = 40;
    const ctx = probe.getContext('2d'); ctx.drawImage(canvas, 0, 0, 40, 40);
    const data = ctx.getImageData(0, 0, 40, 40).data;
    let visible = 0, low = 255, high = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 64) visible++;
      const light = (data[i] + data[i + 1] + data[i + 2]) / 3;
      low = Math.min(low, light); high = Math.max(high, light);
    }
    return visible > 400 && high - low > 28 ? canvas : null;
  } catch { return null; }
}

function drawRiver(ctx, theme, x, y, w, h) {
  ctx.save(); roundRect(ctx, x, y, w, h, 36); ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, theme.sky); sky.addColorStop(1, theme.fog);
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = theme.ground;
  ctx.beginPath(); ctx.moveTo(x, y + h * .52);
  for (let i = 0; i <= 16; i++) ctx.lineTo(x + i * w / 16, y + h * (.42 + Math.sin(i * 1.4) * .08));
  ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.fill();
  const river = ctx.createLinearGradient(0, y + h * .45, 0, y + h);
  river.addColorStop(0, theme.waterDeep); river.addColorStop(1, theme.waterEdge);
  ctx.fillStyle = river;
  ctx.beginPath(); ctx.moveTo(x + w * .5, y + h * .4);
  ctx.bezierCurveTo(x + w * .28, y + h * .63, x + w * .82, y + h * .6, x + w * .16, y + h);
  ctx.lineTo(x + w * .9, y + h);
  ctx.bezierCurveTo(x + w * 1.02, y + h * .72, x + w * .35, y + h * .66, x + w * .53, y + h * .4);
  ctx.closePath(); ctx.fill();
  ctx.lineCap = 'round';
  for (let i = 0; i < 20; i++) {
    const f = i / 20, px = x + w * (.52 + Math.sin(i * 2.3) * .13 * f), py = y + h * (.48 + f * .48);
    ctx.strokeStyle = i % 3 ? '#c8fff777' : '#ffffffbb'; ctx.lineWidth = 2 + f * 5;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.quadraticCurveTo(px + 12 + f * 35, py - 4, px + 28 + f * 55, py); ctx.stroke();
  }
  ctx.fillStyle = theme.index === 2 ? '#292c43' : '#163d28';
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const px = x + w * (side < 0 ? .09 + i * .027 : .83 + i * .022), py = y + h * (.62 + i * .055);
    const size = 38 + i * 9;
    if (theme.index === 1) {
      ctx.fillStyle = i % 2 ? '#81523d' : '#9b6548';
      ctx.beginPath(); ctx.moveTo(px - size, py + 24); ctx.lineTo(px - size * .7, py - size * 1.8); ctx.lineTo(px + size * .45, py - size * 2.1); ctx.lineTo(px + size, py + 24); ctx.fill();
    } else if (theme.index === 2) {
      ctx.fillRect(px - size * .25, py - size * 1.55, size * .5, size * 1.55);
      ctx.fillRect(px - size * .5, py - size * 1.7, size, size * .2);
    } else {
      ctx.fillRect(px - 6, py - size, 12, size * 1.25);
      ctx.beginPath(); ctx.ellipse(px, py - size, size, size * .65, -.2 * side, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

export function drawScoreCard(ctx, data, canvas) {
  const width = 1200, height = 1600, theme = LEVELS[data.levelIndex];
  ctx.clearRect(0, 0, width, height);
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#063e35'); background.addColorStop(1, '#021a19');
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#f9c65b99'; ctx.lineWidth = 2;
  roundRect(ctx, 32, 32, width - 64, height - 64, 44); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#f9c65b';
  ctx.font = '700 29px system-ui, sans-serif'; ctx.fillText('THE COTTAGE ARCADE', 600, 105);
  ctx.fillStyle = '#fff0c9'; ctx.font = 'bold 108px Georgia, serif'; ctx.fillText('River Rush.', 600, 235);
  drawRiver(ctx, theme, 80, 290, 1040, 440);
  const frame = liveFrame(canvas);
  if (frame) {
    ctx.save(); roundRect(ctx, 80, 290, 1040, 440, 36); ctx.clip();
    const cropHeight = Math.min(frame.height, frame.width * 440 / 1040), cropY = Math.max(0, frame.height * .48 - cropHeight / 2);
    ctx.drawImage(frame, 0, cropY, frame.width, cropHeight, 80, 290, 1040, 440); ctx.restore();
  }
  const overlay = ctx.createLinearGradient(0, 570, 0, 730);
  overlay.addColorStop(0, '#021a1900'); overlay.addColorStop(1, '#021a19dd');
  ctx.save(); roundRect(ctx, 80, 290, 1040, 440, 36); ctx.clip(); ctx.fillStyle = overlay; ctx.fillRect(80, 570, 1040, 160); ctx.restore();
  ctx.fillStyle = '#fff0c9'; ctx.font = '700 38px system-ui, sans-serif'; ctx.fillText(data.map, 600, 675);
  ctx.fillStyle = '#91ffe5'; ctx.font = '700 27px system-ui, sans-serif';
  ctx.fillText(data.victory ? 'ALL THREE RIVERS CONQUERED' : data.finished ? 'ADVENTURE SCORE' : 'MY RIVER ADVENTURE', 600, 808);
  ctx.fillStyle = '#f9c65b';
  const formatted = data.score.toLocaleString('en-US');
  ctx.font = `900 ${formatted.length > 10 ? 104 : 140}px system-ui, sans-serif`; ctx.fillText(formatted, 600, 970);
  ctx.fillStyle = '#d7e7d7'; ctx.font = '700 25px system-ui, sans-serif'; ctx.fillText('POINTS', 600, 1020);
  for (const [x, value, label] of [[325, data.coins.toLocaleString('en-US'), 'COINS'], [875, `${data.distance.toLocaleString('en-US')} m`, 'DISTANCE']]) {
    ctx.fillStyle = '#ffffff0a'; roundRect(ctx, x - 225, 1080, 450, 160, 24); ctx.fill();
    ctx.fillStyle = '#fff0c9'; ctx.font = '800 49px system-ui, sans-serif'; ctx.fillText(value, x, 1155);
    ctx.fillStyle = '#91ffe5'; ctx.font = '700 23px system-ui, sans-serif'; ctx.fillText(label, x, 1201);
  }
  for (let i = 0; i < 3; i++) {
    const x = 255 + i * 345, complete = data.clearedMaps.includes(i);
    ctx.strokeStyle = complete ? '#f9c65b' : '#97bab055'; ctx.lineWidth = 3;
    ctx.fillStyle = complete ? '#f9c65b' : '#ffffff08';
    ctx.beginPath(); ctx.arc(x, 1315, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = complete ? '#09241b' : '#d2e4d7'; ctx.font = '800 25px system-ui, sans-serif'; ctx.fillText(complete ? '✓' : String(i + 1), x, 1324);
    ctx.fillStyle = complete ? '#fff0c9' : '#a7c3b8'; ctx.font = '600 20px system-ui, sans-serif'; ctx.fillText(LEVELS[i].name, x, 1380);
  }
  ctx.fillStyle = '#d0e3d5'; ctx.font = '500 24px system-ui, sans-serif'; ctx.fillText(`${data.levelsCleared} / 3 maps cleared · ${data.jumps} perfect jumps · ${data.ducks} perfect ducks`, 600, 1450);
  ctx.fillStyle = '#f9c65b'; ctx.font = '600 25px system-ui, sans-serif'; ctx.fillText('arcade.uptick.systems/river-rush', 600, 1515);
}

export default function ScoreCapture({ game, canvasRef, compact = false }) {
  const [saving, setSaving] = useState(false), [message, setMessage] = useState('');
  async function save(event) {
    event.stopPropagation(); if (saving) return;
    setSaving(true); setMessage('');
    try {
      const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1600;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image drawing unavailable');
      const data = scoreCardData(game); drawScoreCard(ctx, data, canvasRef?.current);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image unavailable')), 'image/png'));
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `river-rush-${data.score}-points.png`; document.body.appendChild(link); link.click(); link.remove();
      // Keep the URL alive for browser download handling, then release it.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage('Score image ready.');
    } catch { setMessage('Couldn’t save the image. Please try again.'); }
    finally { setSaving(false); }
  }
  return <div className={`score-capture ${compact ? 'score-capture-compact' : ''}`}>
    <button type="button" className="adventure-extra-button" aria-label="Save score image" title="Save a PNG of your score" onClick={save} disabled={saving}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 7h4l2-3h6l2 3h4v13H3V7Z"/><circle cx="12" cy="13" r="4"/></svg>
      <span>{saving ? 'Saving…' : 'Save score image'}</span>
    </button>
    {message && <span className="score-capture-status" role="status">{message}</span>}
  </div>;
}

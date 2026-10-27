// The play shell's mission card. The host sends the same fields on the stream.
// A page can also call __nordShowMission, so an offline frame shows the card
// without a running game.

export function markerOffset(bearingDegrees, radius) {
  const turn = (Number(bearingDegrees) || 0) * Math.PI / 180;
  return { x: Math.sin(turn) * radius, y: -Math.cos(turn) * radius };
}

export function missionLines(card) {
  const title = String(card?.title || '').trim();
  const objective = String(card?.objective || '').trim();
  const stage = String(card?.stage || '').trim();
  const fail = String(card?.fail || '').trim();
  const meters = Math.max(0, Math.round(Number(card?.meters) || 0));
  return {
    title,
    objective,
    stage: stage ? `Stage ${stage}` : '',
    fail,
    distance: meters < 8 ? 'here' : `${meters} m`,
    bearing: Number(card?.bearing) || 0,
  };
}

export function paintMarker(context, bearing, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.36;
  context.clearRect(0, 0, width, height);
  context.beginPath();
  context.arc(cx, cy, Math.min(width, height) * 0.46, 0, Math.PI * 2);
  context.fillStyle = '#12141c';
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = '#fffaf0';
  context.stroke();
  context.fillStyle = '#fffaf0';
  context.font = '700 11px Arial, sans-serif';
  context.textAlign = 'center';
  context.fillText('N', cx, 14);
  context.beginPath();
  context.moveTo(cx, cy - 7);
  context.lineTo(cx - 5, cy + 6);
  context.lineTo(cx + 5, cy + 6);
  context.closePath();
  context.fill();
  const mark = markerOffset(bearing, radius);
  const x = cx + mark.x;
  const y = cy + mark.y;
  context.beginPath();
  context.moveTo(x, y - 6);
  context.lineTo(x + 6, y);
  context.lineTo(x, y + 6);
  context.lineTo(x - 6, y);
  context.closePath();
  context.fillStyle = '#ffe33f';
  context.fill();
  return { x, y };
}

export function showMission(card) {
  const root = document.getElementById('mission-card');
  if (!root) return;
  const lines = missionLines(card);
  root.hidden = !lines.title;
  const set = (id, text) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  };
  set('mission-title', lines.title);
  set('mission-objective', lines.objective);
  set('mission-stage', lines.stage);
  const fail = document.getElementById('mission-fail');
  if (fail) {
    fail.textContent = lines.fail;
    fail.hidden = !lines.fail;
  }
  set('mission-distance', lines.distance);
  const canvas = document.getElementById('mission-map');
  if (canvas && lines.title) {
    const context = canvas.getContext('2d');
    if (context) paintMarker(context, lines.bearing, canvas.width, canvas.height);
  }
}

export function payoutLines(amount) {
  const purse = Math.max(0, Math.round(Number(amount) || 0));
  if (!purse) return { amount: '', cue: '', notes: [] };
  return {
    amount: `+${purse}`,
    cue: 'CHING',
    notes: [{ hz: 880, ms: 90 }, { hz: 1320, ms: 160 }],
  };
}

export function showPayout(amount) {
  const root = document.getElementById('payout-pop');
  if (!root) return null;
  const lines = payoutLines(amount);
  root.hidden = !lines.amount;
  const cue = document.getElementById('payout-cue');
  const purse = document.getElementById('payout-amount');
  if (cue) cue.textContent = lines.cue;
  if (purse) purse.textContent = lines.amount;
  if (lines.notes.length && showPayout.last !== lines.amount) playCue(lines.notes);
  showPayout.last = lines.amount;
  return lines;
}

function playCue(notes) {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  try {
    const audio = playCue.audio || new Context();
    playCue.audio = audio;
    let at = audio.currentTime + 0.02;
    for (const note of notes) {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = note.hz;
      tone.type = 'square';
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + note.ms / 1000);
      tone.connect(gain).connect(audio.destination);
      tone.start(at);
      tone.stop(at + note.ms / 1000);
      at += note.ms / 1000;
    }
    if (audio.state === 'suspended') audio.resume().catch(() => {});
  } catch { /* a frame can show the word without a speaker */ }
}

export function jobLines(card, touch) {
  const head = String(card?.head || '').trim();
  let line = String(card?.line || '').trim();
  const key = 'R restarts';
  if (touch && line.endsWith(key)) line = `${line.slice(0, -key.length)}Menu · Recover`;
  return { head, line };
}

export function showJob(card, touch) {
  const root = document.getElementById('job-banner');
  if (!root) return null;
  const lines = jobLines(card, touch);
  root.hidden = !lines.head;
  root.dataset.result = lines.head === 'MISSION FAILED' ? 'failed' : 'done';
  const head = document.getElementById('job-head');
  const line = document.getElementById('job-line');
  if (head) head.textContent = lines.head;
  if (line) line.textContent = lines.line;
  return lines;
}

export function heatLines(card) {
  const down = String(card?.down || '');
  if (down === 'arrested') return { head: 'ARRESTED', line: 'To Poste de quartier 38', kind: 'down' };
  if (down === 'knocked') return { head: 'KNOCKED OUT', line: 'To Hôpital Notre-Dame', kind: 'down' };
  const stars = Math.max(0, Math.round(Number(card?.stars) || 0));
  if (!stars) return { head: '', line: '', kind: '' };
  return { head: 'WANTED', line: stars === 1 ? '1 star' : `${stars} stars`, kind: 'wanted' };
}

export function showHeat(card) {
  const root = document.getElementById('heat-plate');
  if (!root) return null;
  const lines = heatLines(card);
  root.hidden = !lines.head;
  root.dataset.kind = lines.kind;
  const head = document.getElementById('heat-head');
  const line = document.getElementById('heat-line');
  if (head) head.textContent = lines.head;
  if (line) line.textContent = lines.line;
  return lines;
}

if (typeof window !== 'undefined') window.__nordShowMission = showMission;
if (typeof window !== 'undefined') window.__nordShowPayout = showPayout;
if (typeof window !== 'undefined') window.__nordShowJob = card => showJob(card, document.body.classList.contains('touch-input'));
if (typeof window !== 'undefined') window.__nordShowHeat = showHeat;

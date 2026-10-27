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

export function columnLines(card) {
  return {
    title: String(card?.title || '').trim(),
    objective: String(card?.objective || '').trim(),
    info: String(card?.info || '').trim(),
  };
}

export function speechLines(text) {
  return { line: String(text || '').trim() };
}

export function weaponLines(name) {
  return { name: String(name || '').trim() };
}

// Same birth, rise, and fade as QuebecExhaust::At. Life 1.1s. Reeves, SIGGRAPH 1983.
export function exhaustPuff(age, slot) {
  const life = 1.1;
  const clamped = Math.min(life, Math.max(0, Number(age) || 0));
  const along = clamped / life;
  const grow = 0.16 + (0.55 - 0.16) * Math.min(1, along * 1.4);
  const fade = along > 0.75 ? (1 - along) / 0.25 : 1;
  return {
    back: clamped * 160,
    up: clamped * 180,
    swell: grow * fade,
    side: 14 * ((slot % 3) - 1),
  };
}

// Same birth, rise, and fade as QuebecScuff::At. Life 0.7s. Reeves, SIGGRAPH 1983.
export function scuffPuff(age, slot) {
  const life = 0.7;
  const clamped = Math.min(life, Math.max(0, Number(age) || 0));
  const along = clamped / life;
  const fade = along > 0.75 ? (1 - along) / 0.25 : 1;
  return {
    back: clamped * 84,
    up: 6 + clamped * 58,
    radius: (12 + clamped * 32) * fade,
    side: slot % 2 ? 8 : -8,
  };
}

export function showColumn(card) {
  const root = document.getElementById('job-column');
  if (!root) return null;
  const lines = columnLines(card);
  root.hidden = !lines.title;
  const title = document.getElementById('column-title');
  const objective = document.getElementById('column-objective');
  const info = document.getElementById('column-info');
  if (title) title.textContent = lines.title;
  if (objective) objective.textContent = lines.objective;
  if (info) info.textContent = lines.info;
  return lines;
}

export function showSpeech(text) {
  const root = document.getElementById('speech');
  if (!root) return null;
  const lines = speechLines(text);
  root.hidden = !lines.line;
  const line = document.getElementById('speech-line');
  if (line) line.textContent = lines.line;
  return lines;
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
if (typeof window !== 'undefined') window.__nordShowColumn = showColumn;
if (typeof window !== 'undefined') window.__nordShowSpeech = showSpeech;

export function showWeapon(name) {
  const root = document.getElementById('weapon-chip');
  if (!root) return null;
  const lines = weaponLines(name);
  root.hidden = !lines.name;
  const label = document.getElementById('weapon-name');
  if (label) label.textContent = lines.name;
  return lines;
}

if (typeof window !== 'undefined') window.__nordShowWeapon = showWeapon;

export function showScuff(ages) {
  const canvas = document.getElementById('scuff-dust');
  if (!canvas) return [];
  const list = String(ages || '').split(',').slice(0, 5).map(Number);
  const live = list.some((age) => age >= 0 && age < 0.7);
  canvas.hidden = !live;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  list.forEach((age, slot) => {
    if (!(age >= 0) || age >= 0.7) return;
    const puff = scuffPuff(age, slot);
    const x = 18 + puff.back * 0.55 + (slot % 2 ? 8 : 0);
    const y = canvas.height - 10 - puff.up * 0.42;
    const radius = Math.max(2, puff.radius * 0.22);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 250, 240, 0.9)';
    ctx.strokeStyle = '#0b0a16';
    ctx.lineWidth = 2;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  return list;
}

if (typeof window !== 'undefined') window.__nordShowScuff = showScuff;

export function showExhaust(ages) {
  const canvas = document.getElementById('exhaust-puff');
  if (!canvas) return [];
  const list = String(ages || '').split(',').slice(0, 6).map(Number);
  const live = list.some((age) => age >= 0 && age < 1.1);
  canvas.hidden = !live;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  list.forEach((age, slot) => {
    if (!(age >= 0) || age >= 1.1) return;
    const puff = exhaustPuff(age, slot);
    const x = canvas.width - 28 - puff.back * 0.42 + puff.side * 0.7;
    const y = canvas.height - 18 - puff.up * 0.32;
    const radius = Math.max(3, puff.swell * 36);
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 250, 240, 0.9)';
    ctx.strokeStyle = '#0b0a16';
    ctx.lineWidth = 2;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  return list;
}

if (typeof window !== 'undefined') window.__nordShowExhaust = showExhaust;

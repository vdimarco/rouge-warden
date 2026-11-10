/* 06 Alchemy Well: falling sand × falling blocks, as run by Dr. Fizzwick.
 * Pieces are made of materials. Once a piece locks, its blocks join a cellular simulation that
 * keeps running while you play: sand piles, water and oil flow, fire spreads through wood and oil,
 * acid eats what is under it, ice melts, steam rises. Full rows still clear.
 * Reactions charge a chain multiplier (up to ×3 on their own); rows purged during a chain cash it in
 * and push it higher. The first time each reaction happens it goes into the Discoveries notebook
 * with a small bonus. The well is a glass containment tank; a big chain makes it glow and rattle.
 */
(function () {
  const W = window.Wells;

  const BW = 14, BH = 26;
  const TICK = 100; // ms per simulation step
  const CHAIN_MS = 2200; // chain ends this long after the last reaction or clear
  // Scoring. Reactions are cheap and only charge the multiplier; clears are where the points are.
  const LINE_PTS = [0, 200, 500, 900, 1400];
  const REACT_PTS = 3;
  const REACTS_PER_STEP = 8; // reactions needed for +×0.5
  const REACT_CAP = 4; // reactions alone can lift the chain to level 4 (×3); only clears go further
  const MAX_CHAIN = 18;
  const DISCOVERY_PTS = 100;
  // Liquids: after this many ticks without falling they settle; a lone settled drop with air above evaporates.
  const SETTLE_TICKS = 22, EVAP_TICKS = 50;

  const DISPLAY = '"Rubik Mono One", "Space Mono", monospace';
  const MONO = '"Space Mono", ui-monospace, monospace';
  const TOXIC = '#a6ff2e', HOT = '#ff7a1f', HAZARD = '#ffcc1a';

  // kind: powder falls and piles, liquid falls then flows, solid is static, fire burns, gas rises.
  const MATS = {
    sand: { name: 'Sand', color: '#e2c16b', kind: 'powder', dens: 3, rule: 'Falls and slumps into piles. Sinks in water.' },
    water: { name: 'Water', color: '#2f7ff0', kind: 'liquid', dens: 2, rule: 'Pours into holes. Boils next to fire.' },
    oil: { name: 'Oil', color: '#5a3f6e', kind: 'liquid', dens: 1, rule: 'Floats on water. Extremely keen on fire.' },
    acid: { name: 'Acid', color: '#8ee03a', kind: 'liquid', dens: 2.5, rule: 'Eats the block under it, then is spent. Stone shrugs it off.' },
    wood: { name: 'Wood', color: '#93602f', kind: 'solid', rule: 'Stays put. Burns, and passes the fire on.' },
    stone: { name: 'Stone', color: '#80869a', kind: 'solid', rule: 'Immune to fire and acid. Only a purge removes it.' },
    ice: { name: 'Ice', color: '#a6e4ff', kind: 'solid', rule: 'Stays put. Melts to water near fire.' },
    fire: { name: 'Fire', color: '#ff7a1f', kind: 'fire', rule: 'Falls, lights wood and oil, melts ice, boils water, dies.' },
    steam: { name: 'Steam', color: '#dfe8ff', kind: 'gas', rule: 'Rises and fades. Pieces pass through it.' },
    ash: { name: 'Ash', color: '#6b6b78', kind: 'powder', dens: 3, rule: 'What fire leaves. Falls like sand.' },
  };
  const LEGEND = ['fire', 'wood', 'oil', 'sand', 'water', 'acid', 'ice', 'stone', 'steam', 'ash'];
  const PRIMARY = [['sand', 20], ['wood', 18], ['stone', 8], ['water', 12], ['fire', 9], ['oil', 9], ['acid', 8], ['ice', 8]];
  const MIXES = {
    sand: ['water', 'acid', 'stone'], wood: ['fire', 'oil', 'oil'], stone: ['acid', 'sand'], water: ['ice', 'sand'],
    fire: ['oil', 'wood'], oil: ['fire', 'wood'], acid: ['sand', 'water'], ice: ['water', 'stone'],
  };
  const kindOf = (b) => (b ? MATS[b.m].kind : null);
  const fills = (b) => b && b.m !== 'steam' && b.m !== 'fire'; // counts toward a full row

  // The Discoveries notebook. icon: material ids, '+', '>', or special glyphs (gone, row, x3, layer, wet).
  const DISCOVERIES = [
    { id: 'burn', name: 'Combustion', icon: ['fire', '+', 'wood', '>', 'fire'], note: 'Wood burns. So, it turns out, does the lab bench.', hint: 'Something hot, something timber.' },
    { id: 'flash', name: 'Flashover', icon: ['fire', '+', 'oil', '>', 'fire'], note: 'Oil is flammable. Note to self: hooray.', hint: 'Something hot, something slick.' },
    { id: 'steam', name: 'Steam', icon: ['fire', '+', 'water', '>', 'steam'], note: 'Fire plus water makes steam. The kettle was right all along.', hint: 'Something hot, something wet.' },
    { id: 'melt', name: 'Thaw', icon: ['fire', '+', 'ice', '>', 'water'], note: 'Ice melts near fire. Groundbreaking. Writing it down twice.', hint: 'Something hot, something cold.' },
    { id: 'ash', name: 'Cinders', icon: ['fire', '>', 'ash'], note: 'Fire leaves ash. Ash is very loyal. It stays.', hint: 'Let a fire burn out.' },
    { id: 'rot', name: 'Pickled timber', icon: ['acid', '+', 'wood', '>', 'gone'], note: 'Acid ate a plank. It did not even chew.', hint: 'Pour something sour on timber.' },
    { id: 'etch', name: 'Etching', icon: ['acid', '+', 'sand', '>', 'gone'], note: 'Acid dissolves sand. The beach is no longer safe.', hint: 'Pour something sour on grit or ice.' },
    { id: 'quench', name: 'Sour quench', icon: ['acid', '+', 'fire', '>', 'gone'], note: 'Acid put out a fire by eating it. Elegant. Disgusting.', hint: 'Drip something sour onto a flame.' },
    { id: 'stone', name: 'Stubborn stone', icon: ['acid', '+', 'stone', '>', 'stone'], note: 'Acid versus stone: stone wins. Rude.', hint: 'Find what acid cannot eat.' },
    { id: 'float', name: 'Layering', icon: ['oil', '+', 'water', '>', 'layer'], note: 'Oil floats on water. Like my hopes. Like my eyebrows.', hint: 'Mix two liquids of different weight.' },
    { id: 'sink', name: 'Wet sand', icon: ['sand', '+', 'water', '>', 'wet'], note: 'Sand sinks through water. Sandcastles: theoretically possible.', hint: 'Drop grit into a pool.' },
    { id: 'evap', name: 'Evaporation', icon: ['water', '>', 'steam'], note: 'A lonely drop gave up and drifted off. Relatable.', hint: 'Leave one drop all by itself.' },
    { id: 'purge', name: 'Containment purge', icon: ['row'], note: 'A full row just vanished. Do not tell the dean.', hint: 'Fill a row wall to wall.' },
    { id: 'chain', name: 'Chain reaction', icon: ['x3'], note: '×3 and the glass is humming. That is normal. Probably.', hint: 'Keep reactions going until ×3.' },
  ];
  const DISC = Object.fromEntries(DISCOVERIES.map((d) => [d.id, d]));

  const CLEAR_NOTES = [
    'Rows purged. The tank feels lighter. So do I.',
    'Containment holding. Mostly.',
    'Observation: full rows vanish. Further observation: hooray.',
    'Purge complete. Mopping is for interns.',
    'Another row gone. Science is subtraction.',
  ];
  const CHAIN_NOTES = ['Note to self: again, but bigger.', 'The glass rattled. I giggled. Both are data.', 'Hypothesis confirmed: more is more.', 'Eyebrows: singed. Results: excellent.'];

  function lifeFor(m) {
    if (m === 'fire') return 12 + Math.floor(Math.random() * 5);
    if (m === 'steam') return 14 + Math.floor(Math.random() * 10);
    return 0;
  }
  function mk(m, life) {
    const L = life == null ? lifeFor(m) : life;
    return { m, color: MATS[m].color, v: Math.random(), t: -1, dir: Math.random() < 0.5 ? -1 : 1, life: L, max: L, wander: 0, still: 0 };
  }

  // Steam does not block pieces.
  class AlchemyBoard extends W.Board {
    fits(p, rot = p.rot, x = p.x, y = p.y) {
      for (const c of W.pieceCells(p, rot, x, y)) {
        if (c.x < 0 || c.x >= this.w || c.y >= this.h) return false;
        if (c.y >= 0) { const b = this.cells[c.y][c.x]; if (b && b.m !== 'steam') return false; }
      }
      return true;
    }
  }

  // ---------- drawing ----------
  let NOW = 0; // frame time, set once per frame
  const SHEEN = Array.from({ length: 36 }, (_, i) => `hsla(${i * 10},95%,70%,0.42)`);
  const SAND = ['#d9b45c', '#e2c16b', '#e8ca78', '#dcb965'];
  const ASH = ['#3f3f47', '#46464f', '#4b4b54', '#42424a'];
  const STONE = ['#737a8a', '#7d8494', '#868d9c', '#7a8190'];
  const WOOD = ['#8a5a2b', '#93602f', '#9b6734', '#875628'];
  const FIRE_BASE = ['#d8321a', '#e8471c', '#f05a1e'];
  const PI2 = Math.PI * 2;

  function drawMat(ctx, b, px, py, s, board, x, y) {
    const t = NOW, v = b.v || 0;
    const airAbove = board ? !board.get(x, y - 1) : true;
    switch (b.m) {
      case 'sand': case 'ash': {
        const pal = b.m === 'sand' ? SAND : ASH;
        ctx.fillStyle = pal[(v * 4) | 0];
        ctx.fillRect(px, py, s, s);
        const g = Math.max(1.5, s * 0.08);
        ctx.fillStyle = b.m === 'sand' ? '#a77f36' : '#2a2a30';
        for (let i = 0; i < 5; i++) {
          const a = (v * 997 * (i + 1)) % 1, c = (v * 571 * (i + 3)) % 1;
          ctx.fillRect(px + 1 + a * (s - 3), py + 1 + c * (s - 3), g, g);
        }
        ctx.fillStyle = b.m === 'sand' ? '#fff0c4' : '#7c7c88';
        ctx.fillRect(px + ((v * 313) % 1) * (s - 3) + 1, py + ((v * 211) % 1) * (s - 3) + 1, g, g);
        if (b.m === 'ash' && v < 0.3 && Math.sin(t / 180 + v * 40) > 0.2) { ctx.fillStyle = '#ff8a2a'; ctx.fillRect(px + s * 0.5, py + s * 0.5, g, g); }
        if (airAbove && board) { ctx.fillStyle = 'rgba(255,245,215,0.28)'; ctx.fillRect(px, py, s, Math.max(1, s * 0.08)); }
        break;
      }
      case 'water': case 'oil': case 'acid': {
        const band = Math.max(1, s * 0.13);
        const ph = Math.sin(t / 280 + x * 0.9 + y * 0.6);
        if (b.m === 'water') {
          ctx.fillStyle = '#2f7ff0'; ctx.fillRect(px, py, s, s);
          ctx.fillStyle = '#2466cf'; ctx.fillRect(px, py + s * 0.6, s, s * 0.4);
          ctx.fillStyle = 'rgba(190,228,255,0.32)'; ctx.fillRect(px, py + s * (0.45 + 0.3 * ph), s, band);
          if (((t / 900 + v * 7) % 1) < 0.12) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(px + s * v, py + s * 0.3, 2, 2); }
        } else if (b.m === 'oil') {
          ctx.fillStyle = '#3a2650'; ctx.fillRect(px, py, s, s);
          ctx.fillStyle = '#2b1c3d'; ctx.fillRect(px, py + s * 0.55, s, s * 0.45);
          ctx.fillStyle = SHEEN[(((t / 45 + x * 4 + y * 2) | 0) % 36 + 36) % 36];
          ctx.fillRect(px, py + s * (0.35 + 0.22 * ph), s, band * 1.4);
        } else {
          ctx.fillStyle = '#6fc81c'; ctx.fillRect(px, py, s, s);
          ctx.fillStyle = '#8ee03a'; ctx.fillRect(px + 1, py + 1, s - 2, s * 0.55);
          ctx.fillStyle = 'rgba(240,255,200,0.85)';
          for (let i = 0; i < 2; i++) {
            const p = (t / (700 + i * 260) + v + i * 0.5) % 1;
            const bx = px + s * (0.2 + 0.6 * ((v * 7 + i * 0.37) % 1)), by = py + s * (0.92 - 0.85 * p);
            ctx.beginPath(); ctx.arc(bx, by, Math.max(1, s * (0.05 + 0.06 * p)), 0, PI2); ctx.fill();
          }
        }
        if (board && airAbove) {
          const wob = Math.sin(t / 210 + x * 1.3) * Math.max(0.6, s * 0.04);
          ctx.fillStyle = b.m === 'acid' ? 'rgba(230,255,170,0.75)' : b.m === 'oil' ? 'rgba(220,190,255,0.45)' : 'rgba(225,242,255,0.7)';
          ctx.fillRect(px, py + 1 + wob, s, Math.max(1.5, s * 0.09));
          if (b.m === 'acid' && ((t / 300 + v * 5) % 1) < 0.25) { ctx.fillRect(px + s * ((v * 13) % 1), py - s * 0.15, 2, 2); }
        }
        break;
      }
      case 'wood': {
        ctx.fillStyle = WOOD[(v * 4) | 0];
        ctx.fillRect(px, py, s, s);
        ctx.strokeStyle = '#5e3a17';
        ctx.lineWidth = Math.max(1, s * 0.06);
        const o1 = (0.22 + v * 0.25) * s;
        ctx.beginPath();
        ctx.moveTo(px + 1, py + o1); ctx.quadraticCurveTo(px + s * 0.5, py + o1 + s * (v - 0.5) * 0.3, px + s - 1, py + o1);
        ctx.moveTo(px + 1, py + o1 + s * 0.36); ctx.quadraticCurveTo(px + s * 0.5, py + o1 + s * 0.36 - s * (v - 0.5) * 0.3, px + s - 1, py + o1 + s * 0.36);
        ctx.stroke();
        if (v < 0.2) { ctx.beginPath(); ctx.ellipse(px + s * 0.66, py + s * 0.62, s * 0.11, s * 0.07, 0, 0, PI2); ctx.stroke(); }
        ctx.fillStyle = 'rgba(255,220,160,0.22)'; ctx.fillRect(px, py, s, Math.max(1, s * 0.08));
        ctx.fillStyle = 'rgba(40,20,5,0.45)'; ctx.fillRect(px, py + s - 1, s, 1); ctx.fillRect(px + s - 1, py, 1, s);
        break;
      }
      case 'stone': {
        ctx.fillStyle = '#353a45'; ctx.fillRect(px, py, s, s);
        ctx.fillStyle = STONE[(v * 4) | 0];
        ctx.beginPath(); ctx.roundRect(px + 1, py + 1, s - 2, s - 2, s * 0.28); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.ellipse(px + s * 0.36, py + s * 0.3, s * 0.2, s * 0.1, -0.4, 0, PI2); ctx.fill();
        ctx.strokeStyle = 'rgba(30,32,42,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px + s * (0.55 + v * 0.2), py + s * 0.45); ctx.lineTo(px + s * 0.62, py + s * 0.62); ctx.lineTo(px + s * 0.52, py + s * 0.82); ctx.stroke();
        break;
      }
      case 'ice': {
        ctx.fillStyle = '#8fd4f2'; ctx.fillRect(px, py, s, s);
        ctx.fillStyle = '#c4efff';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s * 0.7, py); ctx.lineTo(px, py + s * 0.7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + s * 0.18, py + s * 0.85); ctx.lineTo(px + s * 0.5, py + s * 0.5); ctx.lineTo(px + s * 0.85, py + s * 0.2);
        ctx.moveTo(px + s * 0.5, py + s * 0.5); ctx.lineTo(px + s * 0.8, py + s * 0.72);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
        if (((t / 1600 + v) % 1) < 0.07) {
          ctx.fillStyle = '#fff'; const cx = px + s * 0.3, cy = py + s * 0.3, r = s * 0.22;
          ctx.fillRect(cx - r, cy - 0.75, r * 2, 1.5); ctx.fillRect(cx - 0.75, cy - r, 1.5, r * 2);
        }
        break;
      }
      case 'fire': {
        const life = b.life == null ? 10 : b.life;
        ctx.globalAlpha = Math.min(1, life / 4 + 0.4);
        ctx.fillStyle = FIRE_BASE[Math.floor(t / 70 + v * 9) % 3];
        ctx.fillRect(px, py + s * 0.35, s, s * 0.65);
        const h1 = s * (0.55 + 0.4 * Math.abs(Math.sin(t / 90 + v * 20)));
        const h2 = s * (0.45 + 0.4 * Math.abs(Math.sin(t / 70 + v * 31)));
        ctx.fillStyle = '#ff8a24';
        ctx.beginPath();
        ctx.moveTo(px, py + s);
        ctx.lineTo(px + s * 0.22, py + s - h2);
        ctx.lineTo(px + s * 0.45, py + s * 0.5);
        ctx.lineTo(px + s * (0.6 + 0.12 * Math.sin(t / 110 + v * 5)), py + s - h1 - s * 0.1);
        ctx.lineTo(px + s * 0.8, py + s * 0.45);
        ctx.lineTo(px + s, py + s - h2 * 0.8);
        ctx.lineTo(px + s, py + s);
        ctx.fill();
        ctx.fillStyle = '#ffd25a';
        ctx.beginPath(); ctx.moveTo(px + s * 0.2, py + s); ctx.lineTo(px + s * (0.48 + 0.1 * Math.sin(t / 120 + v * 5)), py + s - h1 * 0.75); ctx.lineTo(px + s * 0.8, py + s); ctx.fill();
        ctx.fillStyle = '#fff4c8';
        ctx.fillRect(px + s * 0.4, py + s * 0.72, s * 0.2, s * 0.28);
        ctx.globalAlpha = 1;
        break;
      }
      case 'steam': {
        const a = 0.18 + 0.42 * Math.min(1, (b.life || 10) / 14);
        ctx.fillStyle = `rgba(236,250,246,${a.toFixed(2)})`;
        const dx = Math.sin(t / 300 + v * 10) * s * 0.14;
        ctx.beginPath();
        ctx.arc(px + s * 0.42 + dx, py + s * 0.55, s * 0.32, 0, PI2);
        ctx.arc(px + s * 0.66 + dx, py + s * 0.38, s * 0.24, 0, PI2);
        ctx.fill();
        break;
      }
    }
  }
  const drawMini = (ctx, b, px, py, s) => drawMat(ctx, b, px, py, s, null, 0, 0);

  function hiDpiCanvas(w, h) {
    const cv = document.createElement('canvas'), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { cv, ctx };
  }
  const swatch = (m, s = 16) => {
    const { cv, ctx } = hiDpiCanvas(s, s);
    cv.className = 'aw-swatch';
    ctx.fillStyle = '#08120f'; ctx.fillRect(0, 0, s, s);
    drawMat(ctx, mk(m, 10), 0, 0, s, null, 0, 0);
    return cv;
  };

  // Recipe icon for the notebook: a row of small cells and operators.
  function recipeIcon(d, s = 14) {
    const toks = d.icon, gap = 3;
    let w = 0;
    for (const k of toks) w += (k === '+' || k === '>' ? 8 : k === 'row' ? s * 3 : k === 'x3' ? s * 2.2 : s) + gap;
    const { cv, ctx } = hiDpiCanvas(Math.ceil(w), s);
    cv.className = 'aw-recipe';
    let x = 0;
    for (const k of toks) {
      if (k === '+' || k === '>') {
        ctx.strokeStyle = '#93a59c'; ctx.lineWidth = 1.5; ctx.beginPath();
        if (k === '+') { ctx.moveTo(x + 1, s / 2); ctx.lineTo(x + 7, s / 2); ctx.moveTo(x + 4, s / 2 - 3); ctx.lineTo(x + 4, s / 2 + 3); }
        else { ctx.moveTo(x, s / 2); ctx.lineTo(x + 7, s / 2); ctx.moveTo(x + 4, s / 2 - 3); ctx.lineTo(x + 7, s / 2); ctx.lineTo(x + 4, s / 2 + 3); }
        ctx.stroke(); x += 8 + gap; continue;
      }
      if (k === 'gone') {
        ctx.strokeStyle = TOXIC; ctx.setLineDash([2, 2]); ctx.lineWidth = 1;
        ctx.strokeRect(x + 1.5, 1.5, s - 3, s - 3); ctx.setLineDash([]); x += s + gap; continue;
      }
      if (k === 'row') {
        for (let i = 0; i < 3; i++) drawMat(ctx, mk(['sand', 'water', 'wood'][i], 10), x + i * s, 0, s, null, 0, 0);
        ctx.fillStyle = 'rgba(166,255,46,0.85)'; ctx.fillRect(x, s / 2 - 1, s * 3, 2);
        x += s * 3 + gap; continue;
      }
      if (k === 'x3') {
        ctx.font = `400 ${s - 2}px ${DISPLAY}`; ctx.textBaseline = 'middle'; ctx.fillStyle = HOT;
        ctx.fillText('×3', x, s / 2 + 1); x += s * 2.2 + gap; continue;
      }
      if (k === 'layer' || k === 'wet') {
        const top = k === 'layer' ? 'oil' : 'water', bot = k === 'layer' ? 'water' : 'sand';
        ctx.save(); ctx.beginPath(); ctx.rect(x, 0, s, s / 2); ctx.clip(); drawMat(ctx, mk(top, 10), x, 0, s, null, 0, 0); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(x, s / 2, s, s / 2); ctx.clip(); drawMat(ctx, mk(bot, 10), x, 0, s, null, 0, 0); ctx.restore();
        x += s + gap; continue;
      }
      drawMat(ctx, mk(k, 10), x, 0, s, null, 0, 0);
      x += s + gap;
    }
    return cv;
  }

  // Dr. Fizzwick, drawn. mood: 'grin' | 'wow' | 'oops'
  function drawDoc(ctx, S, mood) {
    ctx.clearRect(0, 0, S, S);
    const k = S / 64;
    ctx.save(); ctx.scale(k, k);
    // lab coat
    ctx.fillStyle = '#e8eee9';
    ctx.beginPath(); ctx.moveTo(6, 64); ctx.quadraticCurveTo(10, 46, 32, 45); ctx.quadraticCurveTo(54, 46, 58, 64); ctx.fill();
    ctx.fillStyle = '#2b3331';
    ctx.beginPath(); ctx.moveTo(26, 46); ctx.lineTo(32, 60); ctx.lineTo(38, 46); ctx.fill();
    ctx.fillStyle = TOXIC; ctx.fillRect(43, 53, 6, 2); // pen in pocket
    // hair: wild white tufts
    ctx.fillStyle = mood === 'oops' ? '#9aa39f' : '#f4f7f2';
    const tufts = [[14, 30, 4, 18], [12, 22, 8, 10], [18, 14, 14, 6], [28, 9, 24, 8], [40, 11, 38, 5], [48, 18, 54, 10], [50, 26, 58, 22], [50, 34, 57, 36]];
    for (const [ax, ay, tx, ty] of tufts) { ctx.beginPath(); ctx.moveTo(ax - 4, ay + 4); ctx.lineTo(tx, ty); ctx.lineTo(ax + 5, ay + 2); ctx.fill(); }
    // head
    ctx.fillStyle = '#f0c9a0';
    ctx.beginPath(); ctx.ellipse(32, 31, 14, 15, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = '#e4b386'; ctx.beginPath(); ctx.ellipse(33, 35, 3, 2.4, 0, 0, PI2); ctx.fill(); // nose
    // eyebrows
    ctx.strokeStyle = '#f4f7f2'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'wow') { ctx.moveTo(19, 17); ctx.lineTo(28, 15); ctx.moveTo(36, 15); ctx.lineTo(45, 17); }
    else { ctx.moveTo(19, 20); ctx.lineTo(28, 17); ctx.moveTo(36, 17); ctx.lineTo(45, 19); }
    ctx.stroke();
    // goggles
    ctx.fillStyle = '#20262a'; ctx.fillRect(16, 24, 32, 4);
    const lens = mood === 'wow' ? HOT : mood === 'oops' ? '#5d6a63' : TOXIC;
    for (const gx of [25, 39]) {
      ctx.fillStyle = '#20262a'; ctx.beginPath(); ctx.arc(gx, 26, 7.5, 0, PI2); ctx.fill();
      ctx.fillStyle = lens; ctx.beginPath(); ctx.arc(gx, 26, 5.5, 0, PI2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(gx - 2, 24, 1.6, 0, PI2); ctx.fill();
      if (mood !== 'oops') { ctx.fillStyle = '#0b0f0d'; ctx.beginPath(); ctx.arc(gx + 1, 27, mood === 'wow' ? 1.3 : 2, 0, PI2); ctx.fill(); }
    }
    // mouth
    if (mood === 'wow') {
      ctx.fillStyle = '#4a1a12'; ctx.beginPath(); ctx.ellipse(32, 41, 4, 4.5, 0, 0, PI2); ctx.fill();
    } else if (mood === 'oops') {
      ctx.strokeStyle = '#4a1a12'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(25, 41); ctx.lineTo(28, 39.5); ctx.lineTo(31, 41.5); ctx.lineTo(34, 39.5); ctx.lineTo(38, 41); ctx.stroke();
      ctx.fillStyle = 'rgba(40,40,40,0.55)'; ctx.beginPath(); ctx.arc(22, 36, 3, 0, PI2); ctx.arc(42, 33, 2.4, 0, PI2); ctx.fill();
    } else {
      ctx.fillStyle = '#4a1a12'; ctx.beginPath(); ctx.moveTo(23, 38); ctx.quadraticCurveTo(32, 48, 42, 37); ctx.quadraticCurveTo(32, 42, 23, 38); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(27, 39, 10, 2);
    }
    ctx.restore();
  }

  // Cached textures for the tank.
  function sprite(color, size = 64) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, size, size);
    return cv;
  }
  const FIRE_GLOW = sprite('rgba(255,140,40,0.9)');
  const ACID_GLOW = sprite('rgba(150,255,60,0.55)');
  const GREEN_GLOW = sprite('rgba(166,255,46,0.8)', 128);
  const ORANGE_GLOW = sprite('rgba(255,122,31,0.85)', 128);

  function cacheCanvas(W2, H2, paint) {
    const dpr = window.devicePixelRatio || 1;
    const cv = document.createElement('canvas');
    cv.width = Math.round(W2 * dpr); cv.height = Math.round(H2 * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(c);
    return cv;
  }
  function paintTankBack(c, Wp, Hp, s) {
    const g = c.createLinearGradient(0, 0, Wp, 0);
    g.addColorStop(0, '#050c0a'); g.addColorStop(0.5, '#0b1916'); g.addColorStop(1, '#050c0a');
    c.fillStyle = g; c.fillRect(0, 0, Wp, Hp);
    const v = c.createLinearGradient(0, 0, 0, Hp);
    v.addColorStop(0, 'rgba(166,255,46,0.05)'); v.addColorStop(0.5, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.25)');
    c.fillStyle = v; c.fillRect(0, 0, Wp, Hp);
    // back-wall grid
    c.strokeStyle = 'rgba(140,255,190,0.045)'; c.lineWidth = 1; c.beginPath();
    for (let x = 1; x < BW; x++) { c.moveTo(x * s + 0.5, 0); c.lineTo(x * s + 0.5, Hp); }
    for (let y = 1; y < BH; y++) { c.moveTo(0, y * s + 0.5); c.lineTo(Wp, y * s + 0.5); }
    c.stroke();
    // measuring scale on the right wall
    c.strokeStyle = 'rgba(166,255,46,0.3)'; c.fillStyle = 'rgba(166,255,46,0.38)';
    c.font = `700 ${Math.max(7, Math.round(s * 0.36))}px ${MONO}`; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.beginPath();
    for (let r = 1; r < BH; r++) {
      const yy = Hp - r * s + 0.5, long = r % 5 === 0;
      c.moveTo(Wp - (long ? s * 0.55 : s * 0.25), yy); c.lineTo(Wp, yy);
      if (long && r < BH - 4) c.fillText(String(r), Wp - s * 0.65, yy);
    }
    c.stroke();
  }
  function paintGlass(c, Wp, Hp, s) {
    // side shading: the glass curves away
    let g = c.createLinearGradient(0, 0, s * 0.8, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, s * 0.8, Hp);
    g = c.createLinearGradient(Wp, 0, Wp - s * 0.8, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(Wp - s * 0.8, 0, s * 0.8, Hp);
    // reflections
    g = c.createLinearGradient(Wp * 0.05, 0, Wp * 0.17, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(225,255,240,0.075)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(Wp * 0.05, 0, Wp * 0.12, Hp);
    c.fillStyle = 'rgba(225,255,240,0.06)'; c.fillRect(Wp * 0.205, 0, 2, Hp);
    c.fillStyle = 'rgba(225,255,240,0.05)'; c.fillRect(Wp * 0.88, 0, 3, Hp);
    // top rim
    c.fillStyle = 'rgba(225,255,240,0.14)'; c.fillRect(0, 0, Wp, 2);
    // max fill line
    const yy = 3 * s;
    c.save(); c.beginPath(); c.rect(0, yy - 2, Wp, 4); c.clip();
    c.fillStyle = 'rgba(16,16,12,0.6)'; c.fillRect(0, yy - 2, Wp, 4);
    c.fillStyle = 'rgba(255,204,26,0.55)';
    for (let x = -8; x < Wp + 8; x += 10) { c.beginPath(); c.moveTo(x, yy + 2); c.lineTo(x + 5, yy + 2); c.lineTo(x + 9, yy - 2); c.lineTo(x + 4, yy - 2); c.fill(); }
    c.restore();
    c.font = `700 ${Math.max(7, Math.round(s * 0.34))}px ${MONO}`; c.textBaseline = 'bottom'; c.textAlign = 'left';
    c.fillStyle = 'rgba(255,204,26,0.6)'; c.fillText('MAX FILL', 5, yy - 3);
  }

  function mount(sh) {
    const rng = W.rng();
    const board = new AlchemyBoard(BW, BH);
    const bag = W.bag(W.TYPES, rng);
    let tick = 0, simT = 0, score = 0, lines = 0, level = 1, over = true, best = 0;
    let clearing = null, queue = [], sinceFire = 0, dirty = true, lastFloat = 0;
    const chain = { level: 0, pts: 0, timer: 0, score: 0, burn: 0, dissolve: 0, melt: 0, boil: 0, clears: 0 };
    const mult = () => 1 + 0.5 * chain.level;
    const found = new Set();
    let ever = new Set();
    try { ever = new Set(JSON.parse(localStorage.getItem('alchemy-well-notebook') || '[]')); } catch (e) { /* storage blocked */ }
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // signature-moment state
    let glow = 0, glowShown = -1, rattle = 0, pop = 0, stamp = null;

    // ---------- sound ----------
    const lim = {};
    const ok = (k, ms) => { const n = performance.now(); if (n - (lim[k] || 0) < ms) return false; lim[k] = n; return true; };
    const blip = (f, at = 0, vol = 0.035) => W.tone({ f, f2: f * 2.1, dur: 0.07, type: 'sine', vol, at });
    const clink = (f = 2350, at = 0, vol = 0.03) => { W.tone({ f, dur: 0.14, type: 'sine', vol, at }); W.tone({ f: f * 1.51, dur: 0.09, type: 'sine', vol: vol * 0.5, at }); };
    const fizz = (dur = 0.22, vol = 0.03) => W.noise({ filter: 'highpass', freq: 3800, q: 0.7, dur, vol });
    const whoosh = (vol = 0.05) => W.noise({ filter: 'bandpass', freq: 280, freq2: 1800, q: 0.9, dur: 0.28, vol });
    const boom = (vol = 0.12) => { W.noise({ filter: 'lowpass', freq: 520, freq2: 50, q: 0.8, dur: 0.7, vol }); W.tone({ f: 90, f2: 34, dur: 0.55, type: 'sine', vol: vol * 0.9 }); };
    const glassRattle = (n = 4) => { for (let i = 0; i < n; i++) clink(2600 + Math.random() * 1600, i * 0.035 + Math.random() * 0.02, 0.012); };
    W.voice = {
      move: [1900, 0.015, 'sine', 0.01],
      rotate: () => blip(520 + Math.random() * 80, 0, 0.025),
      lock: () => { clink(2300 + Math.random() * 200); W.tone({ f: 150, f2: 90, dur: 0.06, type: 'triangle', vol: 0.04 }); },
      drop: () => W.noise({ filter: 'lowpass', freq: 380, freq2: 90, dur: 0.12, vol: 0.07 }),
      clear: () => { [420, 560, 760, 1020].forEach((f, i) => blip(f, i * 0.045, 0.04)); fizz(0.3, 0.02); },
      big: () => { [380, 500, 660, 880, 1180, 1500].forEach((f, i) => blip(f, i * 0.04, 0.045)); boom(0.08); },
      bad: () => { W.tone({ f: 320, f2: 50, dur: 0.6, type: 'sawtooth', vol: 0.05 }); fizz(0.6, 0.04); boom(0.1); },
      tick: () => blip(300 + Math.random() * 500, 0, 0.02),
      coin: (p) => blip(330 * p, 0, 0.045),
      win: () => { [523, 659, 784, 1046].forEach((f, i) => blip(f, i * 0.06, 0.04)); clink(3100, 0.26, 0.025); },
      hit: () => boom(0.08),
      buy: () => blip(700),
    };

    // ---------- view ----------
    let back = null, glass = null, cacheKey = '';
    function caches(Wp, Hp, s) {
      const key = `${Wp}x${Hp}x${s}x${window.devicePixelRatio || 1}`;
      if (key !== cacheKey) {
        cacheKey = key;
        back = cacheCanvas(Wp, Hp, (c) => paintTankBack(c, Wp, Hp, s));
        glass = cacheCanvas(Wp, Hp, (c) => paintGlass(c, Wp, Hp, s));
      }
    }

    const view = new W.BoardView(sh.canvas, board, {
      maxCell: 24,
      grid: false,
      textFont: DISPLAY,
      textStroke: '#04100b',
      background(ctx, Wp, Hp, s) {
        caches(Wp, Hp, s);
        ctx.fillStyle = '#050c0a'; ctx.fillRect(-20, -20, Wp + 40, Hp + 40);
        ctx.drawImage(back, 0, 0, Wp, Hp);
        if (glow > 0.02) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = Math.min(0.5, glow * 0.45);
          ctx.drawImage(chain.level >= REACT_CAP + 1 ? ORANGE_GLOW : GREEN_GLOW, -Wp * 0.4, Hp * 0.25, Wp * 1.8, Hp * 1.1);
          ctx.restore();
        }
      },
      drawBlock(ctx, b, px, py, s, x, y, o) {
        if (o.ghost) {
          // targeting brackets in the material's colour
          const c = MATS[b.m].color, L = s * 0.3, i = 2.5;
          ctx.strokeStyle = c; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px + i, py + i + L); ctx.lineTo(px + i, py + i); ctx.lineTo(px + i + L, py + i);
          ctx.moveTo(px + s - i - L, py + i); ctx.lineTo(px + s - i, py + i); ctx.lineTo(px + s - i, py + i + L);
          ctx.moveTo(px + s - i, py + s - i - L); ctx.lineTo(px + s - i, py + s - i); ctx.lineTo(px + s - i - L, py + s - i);
          ctx.moveTo(px + i + L, py + s - i); ctx.lineTo(px + i, py + s - i); ctx.lineTo(px + i, py + s - i - L);
          ctx.stroke(); ctx.globalAlpha = 1;
          return;
        }
        drawMat(ctx, b, px, py, s, board, x, y);
      },
      overlay(ctx, s) {
        const Wp = BW * s, Hp = BH * s;
        // light: fire glows, acid shines faintly
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let y = 0; y < BH; y++) {
          const row = board.cells[y];
          for (let x = 0; x < BW; x++) {
            const b = row[x];
            if (!b) continue;
            if (b.m === 'fire') { ctx.globalAlpha = 0.45; ctx.drawImage(FIRE_GLOW, x * s - s, y * s - s * 1.2, s * 3, s * 3); }
            else if (b.m === 'acid' && ((x + y) & 1)) { ctx.globalAlpha = 0.25; ctx.drawImage(ACID_GLOW, x * s - s * 0.5, y * s - s * 0.5, s * 2, s * 2); }
          }
        }
        ctx.restore();
        // active piece: dashed containment outline
        if (st.active) {
          const cells = W.pieceCells(st.active), set = new Set();
          for (const c of cells) set.add(c.y * 64 + c.x);
          ctx.save(); ctx.strokeStyle = 'rgba(166,255,46,0.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]); ctx.lineDashOffset = -NOW / 60;
          ctx.beginPath();
          for (const c of cells) {
            if (c.y < 0) continue;
            const px = c.x * s, py = c.y * s;
            if (!set.has((c.y - 1) * 64 + c.x)) { ctx.moveTo(px, py + 0.5); ctx.lineTo(px + s, py + 0.5); }
            if (!set.has((c.y + 1) * 64 + c.x)) { ctx.moveTo(px, py + s - 0.5); ctx.lineTo(px + s, py + s - 0.5); }
            if (!set.has(c.y * 64 + c.x - 1)) { ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + s); }
            if (!set.has(c.y * 64 + c.x + 1)) { ctx.moveTo(px + s - 0.5, py); ctx.lineTo(px + s - 0.5, py + s); }
          }
          ctx.stroke(); ctx.restore();
        }
        // purge flash
        if (clearing) {
          const k = 1 - clearing.t / clearing.total;
          for (const y of clearing.rows) {
            ctx.fillStyle = `rgba(166,255,46,${(0.25 + 0.45 * Math.abs(Math.sin(k * Math.PI * 2))).toFixed(2)})`;
            ctx.fillRect(0, y * s, Wp, s);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fillRect(0, y * s + s / 2 - 1, Wp * k, 2);
          }
        }
        // glass in front of everything
        ctx.drawImage(glass, 0, 0, Wp, Hp);
        if (glow > 0.02) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const col = chain.level > REACT_CAP ? '255,122,31' : '166,255,46';
          ctx.fillStyle = `rgba(${col},${(glow * 0.35).toFixed(3)})`;
          ctx.fillRect(0, 0, 3, Hp); ctx.fillRect(Wp - 3, 0, 3, Hp);
          ctx.restore();
        }
        // stack near the top: max-fill line pulses
        if (!over && board.stackHeight() > BH - 6) {
          ctx.fillStyle = `rgba(255,90,54,${(0.25 + 0.25 * Math.sin(NOW / 120)).toFixed(2)})`;
          ctx.fillRect(0, 3 * s - 2, Wp, 4);
        }
        // chain counter
        if (chain.level > 0) {
          const X = Wp - s * 0.9, sc = 1 + pop * 0.4;
          const col = chain.level > REACT_CAP ? HOT : TOXIC;
          W.text(ctx, 'CHAIN', X, 12, { align: 'right', size: Math.max(8, s * 0.42), color: col, stroke: '#04100b', strokeWidth: 3, font: DISPLAY, weight: 400 });
          ctx.save();
          ctx.translate(X, 41); ctx.scale(sc, sc);
          W.text(ctx, '×' + mult(), 0, 0, { align: 'right', size: 18 + Math.min(12, chain.level * 1.5), color: '#fff', stroke: col, strokeWidth: 5, font: DISPLAY, weight: 400 });
          ctx.restore();
          const bw = s * 4 * Math.max(0, chain.timer / CHAIN_MS);
          ctx.fillStyle = col; ctx.fillRect(X - bw, 60, bw, 3);
        }
        // end-of-chain stamp
        if (stamp) {
          const a = Math.min(1, stamp.t / 300), k = Math.min(1, (stamp.total - stamp.t) / 160);
          const sc = 1.7 - 0.7 * k;
          ctx.save(); ctx.globalAlpha = a; ctx.translate(Wp / 2, Hp * 0.42); ctx.rotate(-0.08); ctx.scale(sc, sc);
          ctx.fillStyle = 'rgba(4,16,11,0.78)'; ctx.fillRect(-Wp * 0.42, -30, Wp * 0.84, 62);
          ctx.strokeStyle = stamp.color; ctx.lineWidth = 3; ctx.strokeRect(-Wp * 0.42, -30, Wp * 0.84, 62);
          W.text(ctx, stamp.text, 0, -8, { size: Math.min(26, s * 1.1), color: stamp.color, stroke: '#04100b', strokeWidth: 4, font: DISPLAY, weight: 400 });
          W.text(ctx, stamp.sub, 0, 17, { size: Math.max(11, s * 0.55), color: '#fff', font: MONO, weight: 700 });
          ctx.restore();
        }
      },
      drawParticle(ctx, f, s) {
        const r = Math.max(1, f.size / 2);
        if (f.kind === 'bubble') {
          ctx.strokeStyle = f.color; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(f.x * s, f.y * s, r, 0, PI2); ctx.stroke();
          return;
        }
        if (f.color === '#ffd25a' || f.color === '#ffb547' || f.color === HOT) ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(f.x * s, f.y * s, r, 0, PI2); ctx.fill();
      },
    });
    function bubbles(x, y, n, color = TOXIC) {
      for (let i = 0; i < n; i++) {
        view.fx.push({ x: x + (Math.random() - 0.5) * 0.8, y, vx: (Math.random() - 0.5) * 1.2, vy: -(1.5 + Math.random() * 2.5), life: 500 + Math.random() * 500, max: 1000, color, size: 3 + Math.random() * 5, kind: 'bubble' });
      }
    }

    const st = new W.Stacker(board, {
      gravity: 480,
      lockDelay: 450,
      next() {
        while (queue.length < 4) queue.push(makePiece());
        const p = queue.shift();
        queue.push(makePiece());
        paintQueue();
        return p;
      },
      findClears: () => [], // clears are found by the simulation instead
      onLock(cells) { for (const c of cells) if (c.y >= 0) c.block.t = tick; },
      onHold() { paintQueue(); },
      onTopOut() { gameOver(); },
    });
    sh.stackerKeys(st, {}, { downStart: () => (st.soft = true), downEnd: () => (st.soft = false) });
    sh.pad({ left: () => st.move(-1), right: () => st.move(1), down: () => st.softDrop(), rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), hold: () => st.hold() });

    // ---------- side panels ----------
    const chainPanel = W.el('div', 'panel aw-chain', `<h3>Reaction pressure</h3>
      <div class="aw-chain-row"><span data-x class="aw-chain-x">×1</span><span data-sub class="aw-chain-sub">Tank is calm. Suspiciously calm.</span></div>
      <div class="aw-gauge"><div data-bar></div></div>
      <p class="aw-fine">Reactions charge the chain, up to ×3. Rows purged during a chain cash it in and push it higher. It fizzles ${(CHAIN_MS / 1000).toFixed(1)}s after the last one.</p>`);
    const notePanel = W.el('div', 'panel aw-notebook', `<h3>Discoveries <span data-n class="aw-count"></span></h3><div data-grid class="aw-grid"></div><p data-latest class="aw-latest"></p>`);
    const grid = notePanel.querySelector('[data-grid]'), nCount = notePanel.querySelector('[data-n]'), latest = notePanel.querySelector('[data-latest]');
    const entryEls = {};
    for (const d of DISCOVERIES) {
      const e = W.el('div', 'aw-entry');
      e.appendChild(recipeIcon(d));
      const name = W.el('span', 'aw-name', '???');
      e.appendChild(name);
      grid.appendChild(e);
      entryEls[d.id] = { e, name };
    }
    const legendPanel = W.el('details', 'panel aw-legend', '<summary><h3>Reagent safety sheet</h3></summary>');
    if (window.innerWidth >= 900) legendPanel.open = true;
    const list = W.el('div', 'aw-legend-list');
    for (const m of LEGEND) {
      const row = W.el('div', 'aw-legend-row');
      row.appendChild(swatch(m));
      row.appendChild(W.el('span', '', `<b>${MATS[m].name}</b> <span>${MATS[m].rule}</span>`));
      list.appendChild(row);
    }
    legendPanel.appendChild(list);
    sh.extra.append(chainPanel, notePanel);
    const cx = chainPanel.querySelector('[data-x]'), csub = chainPanel.querySelector('[data-sub]'), cbar = chainPanel.querySelector('[data-bar]');

    // the clipboard: Dr. Fizzwick's portrait above the lab notes
    const logPanel = sh.logEl.parentElement;
    logPanel.classList.add('aw-clipboard');
    const head = W.el('div', 'aw-doc');
    const doc = hiDpiCanvas(56, 56);
    doc.cv.className = 'aw-portrait';
    head.appendChild(doc.cv);
    head.appendChild(W.el('div', 'aw-doc-name', '<b>Dr. Fizzwick</b><span>Containment (pending)</span>'));
    logPanel.insertBefore(head, logPanel.firstChild);
    logPanel.after(legendPanel); // safety sheet goes under the clipboard
    let mood = '', moodT = 0;
    function setMood(m, ms = 1600) {
      moodT = ms;
      if (m !== mood) { mood = m; drawDoc(doc.ctx, 56, m); }
    }
    setMood('grin', 0);
    const note = (html) => sh.log(html);

    function paintNotebook(fresh) {
      nCount.textContent = `${found.size}/${DISCOVERIES.length}`;
      for (const d of DISCOVERIES) {
        const { e, name } = entryEls[d.id];
        const got = found.has(d.id), known = ever.has(d.id);
        e.classList.toggle('got', got);
        e.classList.toggle('known', !got && known);
        e.classList.toggle('fresh', d.id === fresh);
        name.textContent = got || known ? d.name : '???';
        e.title = got ? d.note : known ? `${d.name}: found in an earlier run. ${d.hint}` : d.hint;
      }
      if (fresh) latest.innerHTML = `<b>${W.esc(DISC[fresh].name)}</b> ${W.esc(DISC[fresh].note)}`;
      else if (!found.size) latest.textContent = 'Nothing written yet. Mix things. Write down what happens.';
    }

    function discover(id, x, y) {
      if (found.has(id) || over) return;
      found.add(id);
      if (!ever.has(id)) { ever.add(id); try { localStorage.setItem('alchemy-well-notebook', JSON.stringify([...ever])); } catch (e) { /* storage blocked */ } }
      const d = DISC[id];
      score += DISCOVERY_PTS;
      paintNotebook(id);
      note(`<span class="aw-tag">Discovery</span> <b>${W.esc(d.name)}</b> +${DISCOVERY_PTS}. ${W.esc(d.note)}`);
      // one EUREKA on screen at a time; simultaneous discoveries share it
      if (!view.texts.some((t) => t.text === 'EUREKA!' && t.life > 300)) view.float('EUREKA!', Math.min(BW - 3, Math.max(3, x + 0.5)), Math.max(2, y - 0.5), TOXIC, 14);
      bubbles(x + 0.5, y + 0.5, 8);
      W.sfx('win');
      setMood('wow');
      dirty = true;
    }

    function makePiece() {
      const type = bag();
      let m;
      if (sinceFire >= 8) m = 'fire';
      else {
        let r = rng() * PRIMARY.reduce((a, p) => a + p[1], 0);
        for (const [k, w] of PRIMARY) { r -= w; if (r <= 0) { m = k; break; } }
      }
      const n = W.SHAPES[type].cells.length;
      const mats = new Array(n).fill(m);
      if (rng.chance(0.3)) mats[rng.int(n)] = rng.pick(MIXES[m]);
      sinceFire = mats.includes('fire') ? 0 : sinceFire + 1;
      return W.piece(type, mats.map((x) => mk(x)));
    }
    const matsLabel = (p) => [...new Set(p.blocks.map((b) => MATS[b.m].name))].join(' + ');

    function paintQueue() {
      sh.queueEl.innerHTML = '';
      queue.slice(0, 3).forEach((p) => {
        const w = W.el('div', 'aw-q');
        w.appendChild(W.mini(p, 13, { drawBlock: drawMini }));
        w.appendChild(W.el('small', '', W.esc(matsLabel(p))));
        sh.queueEl.appendChild(w);
      });
      sh.holdEl.innerHTML = '';
      sh.holdEl.appendChild(W.mini(st.holdPiece, 13, { drawBlock: drawMini }));
    }

    function paint() {
      sh.hud([
        { label: 'Yield', value: score.toLocaleString(), tone: 'accent', wide: true },
        { label: 'Rows purged', value: lines },
        { label: 'Batch', value: level },
        { label: 'Best chain', value: '×' + (1 + 0.5 * best), tone: best >= 4 ? 'good' : '' },
        { label: 'Discoveries', value: `${found.size}/${DISCOVERIES.length}` },
      ]);
      dirty = false;
    }
    let lastX = '';
    function paintChain() {
      const x = '×' + mult();
      if (x !== lastX) {
        lastX = x;
        cx.textContent = x;
        cx.classList.toggle('on', chain.level > 0);
        cx.classList.toggle('hot', chain.level > REACT_CAP);
      }
      const parts = [];
      if (chain.burn) parts.push(`${chain.burn} burned`);
      if (chain.dissolve) parts.push(`${chain.dissolve} dissolved`);
      if (chain.melt) parts.push(`${chain.melt} melted`);
      if (chain.boil) parts.push(`${chain.boil} boiled`);
      if (chain.clears) parts.push(`${chain.clears} rows`);
      const sub = parts.length ? parts.join(' · ') + ` · +${chain.score}` : 'Tank is calm. Suspiciously calm.';
      if (csub.textContent !== sub) csub.textContent = sub;
      cbar.style.width = (chain.level || chain.pts ? Math.max(0, chain.timer / CHAIN_MS) * 100 : 0).toFixed(1) + '%';
    }

    // ---------- chain ----------
    function bumpChain(x, y, by) {
      const before = chain.level;
      chain.level = Math.min(MAX_CHAIN, chain.level + by);
      if (chain.level === before) return;
      if (chain.level > best) best = chain.level;
      const now = performance.now();
      if (now - lastFloat > 250) {
        lastFloat = now;
        view.float(`×${mult()}`, Math.min(BW - 1.5, Math.max(1.5, x + 0.5)), y, chain.level > REACT_CAP ? HOT : TOXIC, 14 + Math.min(12, chain.level));
      }
      pop = 1;
      rattle = Math.min(1, rattle + 0.25 + chain.level * 0.06);
      W.sfx('coin', 1 + chain.level * 0.12);
      glassRattle(2 + Math.min(5, chain.level));
      if (chain.level >= 3 && ok('boom', 250)) boom(0.05 + Math.min(0.07, chain.level * 0.008));
      if (chain.level >= REACT_CAP) discover('chain', x, y);
      if (chain.level >= 3) setMood('wow');
      dirty = true;
    }
    const REACT_SFX = {
      burn: () => ok('whoosh', 140) && whoosh(0.04),
      flash: () => ok('whoosh', 140) && whoosh(0.06),
      dissolve: () => ok('fizz', 110) && fizz(0.2, 0.03),
      melt: () => ok('melt', 90) && W.tone({ f: 1800 + Math.random() * 600, f2: 2600, dur: 0.07, type: 'sine', vol: 0.015 }),
      boil: () => ok('boil', 60) && blip(260 + Math.random() * 400, 0, 0.03),
    };
    function react(kind, x, y, color, sfx = kind) {
      chain[kind]++;
      chain.pts++;
      chain.timer = CHAIN_MS;
      const pts = Math.round(REACT_PTS * mult());
      score += pts;
      chain.score += pts;
      if (chain.pts >= REACTS_PER_STEP) { chain.pts = 0; if (chain.level < REACT_CAP) bumpChain(x, y, 1); }
      if (kind === 'dissolve' || kind === 'boil') bubbles(x + 0.5, y + 0.5, 2, color);
      else view.burst(x + 0.5, y + 0.5, color, 3, 4);
      REACT_SFX[sfx] && REACT_SFX[sfx]();
      dirty = true;
    }
    function endChain(quiet) {
      if (!quiet && chain.level >= 2) {
        const m = mult();
        note(`Chain <b>×${m}</b> +${chain.score.toLocaleString()}. ${W.esc(CHAIN_NOTES[rng.int(CHAIN_NOTES.length)])}`);
        if (chain.level >= 4) {
          stamp = { text: `CHAIN ×${m}`, sub: `+${chain.score.toLocaleString()} yield`, t: 1500, total: 1500, color: chain.level > REACT_CAP ? HOT : TOXIC };
          rattle = 1;
          boom(0.1);
          glassRattle(7);
          view.shake(6 + Math.min(10, chain.level));
          setMood('wow', 2000);
        }
      }
      Object.assign(chain, { level: 0, pts: 0, timer: 0, score: 0, burn: 0, dissolve: 0, melt: 0, boil: 0, clears: 0 });
      dirty = true;
    }

    // ---------- simulation ----------
    function simTick() {
      tick++;
      const cells = board.cells;
      const occ = new Set();
      if (st.active) for (const c of W.pieceCells(st.active)) if (c.y >= 0) occ.add(c.y * BW + c.x);
      const open = (x, y) => x >= 0 && x < BW && y >= 0 && y < BH && !occ.has(y * BW + x);
      const free = (x, y) => open(x, y) && !cells[y][x];
      // Can b move into (x,y)? Into empty space or gas, or by sinking through a lighter liquid.
      const enter = (b, x, y) => {
        if (!open(x, y)) return false;
        const o = cells[y][x];
        if (!o) return true;
        const k = kindOf(o);
        if (k === 'gas') return true;
        return k === 'liquid' && MATS[b.m].dens > MATS[o.m].dens;
      };
      const move = (x, y, nx, ny) => {
        const b = cells[y][x], o = cells[ny][nx];
        cells[ny][nx] = b;
        cells[y][x] = o || null;
        b.t = tick;
        if (o) {
          o.t = tick;
          if (o.m !== 'steam') {
            const kb = MATS[b.m].kind;
            if (kb === 'powder') discover('sink', nx, ny);
            else if (kb === 'liquid') discover('float', nx, ny);
          }
        }
      };
      const fall = (b, x, y, diag) => {
        if (enter(b, x, y + 1)) { move(x, y, x, y + 1); return true; }
        if (!diag) return false;
        const d = rng() < 0.5 ? -1 : 1;
        if (enter(b, x + d, y + 1)) { move(x, y, x + d, y + 1); return true; }
        if (enter(b, x - d, y + 1)) { move(x, y, x - d, y + 1); return true; }
        return false;
      };
      const lone = (x, y) => {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = board.get(x + dx, y + dy);
          if (n && MATS[n.m].kind === 'liquid') return false;
        }
        return true;
      };

      for (let y = BH - 1; y >= 0; y--) {
        const ltr = (tick + y) & 1;
        for (let i = 0; i < BW; i++) {
          const x = ltr ? i : BW - 1 - i;
          const b = cells[y][x];
          if (!b || b.t === tick) continue;
          const k = MATS[b.m].kind;
          if (k === 'powder') fall(b, x, y, true);
          else if (k === 'liquid') {
            if (b.m === 'acid') {
              const u = y + 1 < BH ? cells[y + 1][x] : null;
              if (u && u.m === 'stone') discover('stone', x, y);
              if (u && u.m !== 'stone' && kindOf(u) !== 'liquid' && kindOf(u) !== 'gas') {
                cells[y + 1][x] = null;
                cells[y][x] = null;
                react('dissolve', x, y + 1, TOXIC);
                discover(u.m === 'wood' ? 'rot' : u.m === 'fire' ? 'quench' : 'etch', x, y + 1);
                continue;
              }
            }
            if (fall(b, x, y, true)) { b.wander = 0; b.still = 0; continue; }
            // Settled liquid stays put; a lone settled drop with open air above evaporates.
            if (b.still) {
              b.still++;
              if (b.still > EVAP_TICKS && lone(x, y) && !board.get(x, y - 1) && y > 0) {
                cells[y][x] = b.m === 'water' ? Object.assign(mk('steam'), { t: tick }) : null;
                if (b.m === 'acid') { bubbles(x + 0.5, y + 0.5, 4); if (ok('fizz', 110)) fizz(0.25, 0.025); }
                else if (b.m === 'oil') view.burst(x + 0.5, y + 0.3, '#8a7a99', 4, 2);
                discover('evap', x, y);
              }
              continue;
            }
            if (++b.wander > SETTLE_TICKS) { b.still = 1; continue; }
            if (rng() < 0.8) {
              let d = b.dir, steps = rng() < 0.4 ? 2 : 1, cx2 = x;
              while (steps-- > 0) {
                if (enter(b, cx2 + d, y) && kindOf(cells[y][cx2 + d]) !== 'liquid') { move(cx2, y, cx2 + d, y); cx2 += d; }
                else { b.dir = -d; break; }
              }
            }
          } else if (k === 'fire') {
            b.life--;
            b.t = tick;
            for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
              const nx = x + dx, ny = y + dy;
              if (nx < 0 || nx >= BW || ny < 0 || ny >= BH) continue;
              const n = cells[ny][nx];
              if (!n || n.t === tick) continue;
              if (n.m === 'wood' && rng() < 0.3) {
                const f = mk('fire', 6 + rng.int(4)); f.t = tick; cells[ny][nx] = f;
                react('burn', nx, ny, '#ffb547');
                discover('burn', nx, ny);
              } else if (n.m === 'oil' && rng() < 0.8) {
                const f = mk('fire', 3 + rng.int(2)); f.t = tick; cells[ny][nx] = f;
                react('burn', nx, ny, HOT, 'flash');
                discover('flash', nx, ny);
              } else if (n.m === 'ice' && rng() < 0.35) {
                const w = mk('water'); w.t = tick; cells[ny][nx] = w;
                react('melt', nx, ny, '#a6e4ff');
                discover('melt', nx, ny);
              } else if (n.m === 'water' && rng() < 0.5) {
                const s = mk('steam'); s.t = tick; cells[ny][nx] = s;
                react('boil', nx, ny, '#dff0ec');
                discover('steam', nx, ny);
                b.life = 0;
                break;
              }
            }
            if (b.life <= 0) {
              if (rng() < 0.25) { cells[y][x] = Object.assign(mk('ash'), { t: tick }); discover('ash', x, y); }
              else cells[y][x] = null;
              if (rng() < 0.3) view.burst(x + 0.5, y + 0.3, '#ffd25a', 2, 3);
            } else if (free(x, y + 1)) move(x, y, x, y + 1);
          }
        }
      }
      // gas rises: top-down pass
      for (let y = 0; y < BH; y++) {
        for (let x = 0; x < BW; x++) {
          const b = cells[y][x];
          if (!b || b.m !== 'steam' || b.t === tick) continue;
          b.t = tick;
          if (--b.life <= 0 || y === 0) { cells[y][x] = null; continue; }
          if (free(x, y - 1)) { move(x, y, x, y - 1); continue; }
          const d = rng() < 0.5 ? -1 : 1;
          if (free(x + d, y - 1)) move(x, y, x + d, y - 1);
          else if (free(x + d, y)) move(x, y, x + d, y);
        }
      }
      // full rows
      const rows = [];
      for (let y = 0; y < BH; y++) if (cells[y].every(fills)) rows.push(y);
      if (rows.length) {
        clearing = { rows, t: 260, total: 260 };
        W.sfx(rows.length >= 3 ? 'big' : 'clear');
      }
      if (tick % 3 === 0) dirty = true;
    }

    function finishClear() {
      const rows = clearing.rows, n = rows.length;
      clearing = null;
      const base = n <= 4 ? LINE_PTS[n] : LINE_PTS[4] + 500 * (n - 4);
      const m = mult();
      const pts = Math.round(base * m);
      score += pts;
      chain.score += pts;
      chain.clears += n;
      chain.timer = CHAIN_MS;
      view.rowBurst(rows, (b) => (b ? MATS[b.m].color : TOXIC));
      for (const y of rows) bubbles(BW / 2, y + 0.5, 6);
      view.float(`+${pts}`, BW / 2, rows[0] + 0.5, m > 1 ? (chain.level > REACT_CAP ? HOT : TOXIC) : '#ffffff', 16 + n * 2 + Math.min(8, chain.level));
      view.shake(n >= 2 ? 6 + n * 2 : 3);
      rattle = Math.min(1, rattle + 0.2 * n);
      note(`Purged ${n} row${n > 1 ? 's' : ''} <b>+${pts.toLocaleString()}</b>${m > 1 ? ` at ×${m}` : ''}. ${W.esc(CLEAR_NOTES[rng.int(CLEAR_NOTES.length)])}`);
      board.removeRows(rows);
      discover('purge', BW / 2, rows[0]);
      bumpChain(BW / 2, rows[0] - 1, n);
      lines += n;
      const lv = 1 + Math.floor(lines / 8);
      if (lv !== level) { level = lv; sh.toast(`Batch ${level}: the reagents are getting impatient`); }
      st.o.gravity = Math.max(110, 480 - (level - 1) * 45);
      // rows shifting down can push into the falling piece; lift it clear
      const p = st.active;
      if (p) for (let i = 0; i < 4 && !board.fits(p); i++) p.y--;
      dirty = true;
    }

    // ---------- run ----------
    function gameOver() {
      if (over) return;
      if (chain.level) endChain();
      over = true;
      paint();
      view.shake(16);
      rattle = 1;
      setMood('oops', 1e9);
      note('Containment breach. Note to self: buy a bigger tank.');
      sh.overlay({
        title: 'Containment breach!',
        body: `<p class="aw-big">Yield <b>${score.toLocaleString()}</b></p>
          <p>${lines} rows purged · best chain ×${1 + 0.5 * best} · ${found.size}/${DISCOVERIES.length} discoveries.</p>
          <p class="aw-scrawl">Note to self: wood stacks are fuel, and fuel wants a match. Burn first, purge while the tank still glows.</p>`,
        button: 'Mop up, go again',
      }).then(newRun);
    }

    function newRun() {
      board.clear();
      st.reset();
      st.o.gravity = 480;
      tick = 0; simT = 0; score = 0; lines = 0; level = 1; best = 0; clearing = null; sinceFire = 3;
      glow = 0; rattle = 0; pop = 0; stamp = null;
      endChain(true);
      found.clear();
      queue = [];
      sh.logEl.innerHTML = '';
      over = false;
      while (queue.length < 4) queue.push(makePiece());
      paint();
      paintQueue();
      paintNotebook();
      setMood('grin', 0);
      note('Day 1. Hypothesis: nothing will catch fire. Confidence: low. Excitement: high.');
      st.spawn();
    }

    sh.debug = { board, st, view, chain, mk, found, getScore: () => score, getTick: () => tick, step: (n) => { for (let i = 0; i < n && !clearing; i++) simTick(); }, discover };
    sh.own(() => { sh.boardFrame.style.transform = ''; });
    sh.loop((dt) => {
      NOW = performance.now();
      if (!over) {
        st.update(dt);
        if (clearing) {
          clearing.t -= dt;
          if (clearing.t <= 0) finishClear();
        } else {
          simT += dt;
          while (simT >= TICK && !clearing) { simT -= TICK; simTick(); }
          if (clearing) simT = 0;
          if (chain.level || chain.pts) {
            chain.timer -= dt;
            if (chain.timer <= 0) endChain();
          }
        }
        paintChain();
        if (dirty) paint();
      }
      // signature: glow, swell, rattle
      const target = Math.min(1, chain.level / 7);
      glow += (target - glow) * Math.min(1, dt / 220);
      if (Math.abs(glow - glowShown) > 0.02) { glowShown = glow; sh.boardFrame.style.setProperty('--aw-glow', glow.toFixed(2)); sh.boardFrame.classList.toggle('aw-hot', chain.level > REACT_CAP); }
      pop = Math.max(0, pop - dt / 260);
      if (stamp) { stamp.t -= dt; if (stamp.t <= 0) stamp = null; }
      if (rattle > 0 && !reduced) {
        rattle = Math.max(0, rattle - dt / 700);
        const a = rattle * rattle;
        sh.boardFrame.style.transform = rattle > 0 ? `translate(${((Math.random() - 0.5) * 5 * a).toFixed(2)}px,${((Math.random() - 0.5) * 3 * a).toFixed(2)}px) rotate(${((Math.random() - 0.5) * 0.8 * a).toFixed(3)}deg)` : '';
      } else rattle = 0;
      if (moodT > 0) { moodT -= dt; if (moodT <= 0 && !over) setMood('grin', 0); }
      for (const f of view.fx) if (f.kind === 'bubble') f.vy -= 24 * dt / 1000;
      view.update(dt);
      view.draw(st);
    });

    paint();
    paintChain();
    paintNotebook();
    NOW = performance.now();
    view.draw(st);
    sh.overlay({
      title: 'Experiment No. 06',
      body: `<p class="aw-scrawl">Dr. Fizzwick's well. Everything I drop in keeps reacting after it lands. Marvellous. Possibly illegal.</p>
        <ul><li><b>Fire</b> lights wood and oil, melts ice, boils water.</li>
        <li><b>Acid</b> eats the block under it. Stone ignores it.</li>
        <li>Reactions charge the <b>chain</b> up to ×3. Full rows <b>purge</b> and cash it in.</li>
        <li>First time a reaction happens: it goes in the <b>notebook</b>, with a bonus.</li></ul>`,
      button: 'Begin experiment',
    }).then(newRun);
  }

  // Hub card key art: a glass tank mid-reaction on lab steel.
  function art(ctx, w, h) {
    NOW = 1234;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#222a28'); bg.addColorStop(1, '#141a19');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 2; y < h; y += 4) ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = '#0e1312'; ctx.fillRect(150, 0, 1, h - 12);
    // hazard band
    ctx.save(); ctx.beginPath(); ctx.rect(0, h - 12, w, 12); ctx.clip();
    ctx.fillStyle = '#111'; ctx.fillRect(0, h - 12, w, 12);
    ctx.fillStyle = HAZARD;
    for (let x = -12; x < w + 12; x += 16) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 8, h); ctx.lineTo(x + 20, h - 12); ctx.lineTo(x + 12, h - 12); ctx.fill(); }
    ctx.restore();
    // tank
    const s = 8, cols = 12, rows = 11, tx = 22, ty = 8;
    ctx.fillStyle = '#3a4543'; ctx.fillRect(tx - 6, ty - 4, cols * s + 12, rows * s + 10);
    ctx.fillStyle = '#081210'; ctx.fillRect(tx, ty, cols * s, rows * s);
    const lay = [
      '............',
      '............',
      '.....ff.....',
      '....ffff....',
      '...fwwwf....',
      'ooo.wwwwfo..',
      'aaaawwwwssss',
      'aaaassssssss',
      'wwwsssiiissw',
      'wwwwsiiiiwww',
      'kkkssssskkkk',
    ];
    const map = { f: 'fire', w: 'wood', o: 'oil', a: 'acid', s: 'sand', i: 'ice', k: 'stone' };
    const rr = W.rng(6);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const m = map[lay[y][x]];
      if (!m) continue;
      const b = mk(m, 10); b.v = rr();
      drawMat(ctx, b, tx + x * s, ty + y * s, s, null, x, y);
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6; ctx.drawImage(FIRE_GLOW, tx + 18, ty - 6, 60, 60);
    ctx.globalAlpha = 0.35; ctx.drawImage(GREEN_GLOW, tx - 20, ty + 30, 80, 60);
    ctx.restore();
    ctx.strokeStyle = 'rgba(240,255,200,0.8)'; ctx.lineWidth = 1;
    for (const [bx, by, r] of [[30, 44, 2], [38, 36, 1.5], [27, 30, 2.5], [42, 24, 1.5]]) { ctx.beginPath(); ctx.arc(tx + bx, ty + by, r, 0, PI2); ctx.stroke(); }
    ctx.fillStyle = 'rgba(230,255,240,0.1)'; ctx.fillRect(tx + 8, ty, 7, rows * s); ctx.fillRect(tx + 19, ty, 1.5, rows * s);
    ctx.fillStyle = '#9aa6a3';
    for (const [rx, ry] of [[tx - 3, ty - 1], [tx + cols * s + 3, ty - 1], [tx - 3, ty + rows * s + 3], [tx + cols * s + 3, ty + rows * s + 3]]) { ctx.beginPath(); ctx.arc(rx, ry, 1.8, 0, PI2); ctx.fill(); }
    // chain readout + flask
    ctx.font = `400 11px ${DISPLAY}`; ctx.fillStyle = TOXIC; ctx.textBaseline = 'alphabetic';
    ctx.fillText('CHAIN', 166, 34);
    ctx.font = `400 34px ${DISPLAY}`; ctx.lineWidth = 5; ctx.strokeStyle = HOT; ctx.strokeText('×4.5', 162, 70); ctx.fillStyle = '#fff'; ctx.fillText('×4.5', 162, 70);
    ctx.font = `700 10px ${MONO}`; ctx.fillStyle = '#c9d6cf';
    ctx.fillText('note to self:', 164, 92); ctx.fillStyle = TOXIC; ctx.fillText('hooray.', 164, 104);
  }

  W.register({
    id: 'alchemy-well',
    num: 6,
    title: 'Alchemy Well',
    mix: 'Falling sand × falling blocks',
    pitch: 'Dr. Fizzwick drops sand, water, wood, fire, acid, oil and ice into a glass tank. They keep reacting after they land. Write down every reaction. Try not to crack the glass.',
    palette: ['#e2c16b', '#2f7ff0', '#93602f', '#ff7a1f', '#8ee03a', '#a6e4ff', '#80869a'],
    shell: { logTitle: 'Lab notes' },
    art,
    mount,
  });
})();

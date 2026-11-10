/* 02 Madame Tetra's Parlour (was Hand of Pieces): Balatro hands on a turn-based well.
 * No gravity. You hold a hand of 5 tarot cards drawn from a deck; each card is a piece.
 * Pick one (1-5), move and rotate it at leisure, then set it down. A new card is dealt
 * into that slot. Each night you get 20 turns of the candle and 3 banishes (discards)
 * to reach the foretold fortune. Line clears score stars × fate by how many rows break.
 * Between nights you buy omens (jokers), and every omen bends a rule of the game.
 * Look: a fortune teller's tent. Velvet, candlelight, gilt filigree, gemstone blocks.
 */
(function () {
  const W = window.Wells;

  // Pentomino P and its mirror, used by the Crowned Pair omen (and flipped by the Looking Glass).
  // Names are prefixed so they never collide with shapes other games define.
  const defineShapes = () => {
    W.defineShape('hpP', 3, [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]], '#ff7ad9');
    W.defineShape('hpQ', 3, [[2, 0], [1, 0], [2, 1], [1, 1], [2, 2]], '#c9ef5a');
  };
  // Horizontal mirror pairs. Mirroring a piece at rotation r gives its pair at rotation -r.
  const MIRROR = { L: 'J', J: 'L', S: 'Z', Z: 'S', hpP: 'hpQ', hpQ: 'hpP' };

  // The major arcana. Each piece type is a card with a numeral, a name and a gemstone colour.
  const ARC = {
    I: { n: 'XVI', name: 'The Tower', short: 'TOWER', color: '#4fd8e8', gem: 'aquamarine' },
    O: { n: 'IX', name: 'The Hermit', short: 'HERMIT', color: '#ffcf4a', gem: 'topaz' },
    T: { n: 'XII', name: 'The Hanged Man', short: 'HANGED MAN', color: '#b17cff', gem: 'amethyst' },
    S: { n: 'VI', name: 'The Lovers', short: 'LOVERS', color: '#4fe08a', gem: 'emerald' },
    Z: { n: 'XV', name: 'The Devil', short: 'DEVIL', color: '#ff4d6d', gem: 'ruby' },
    J: { n: 'XVIII', name: 'The Moon', short: 'MOON', color: '#6f8bff', gem: 'sapphire' },
    L: { n: 'XIX', name: 'The Sun', short: 'SUN', color: '#ff9440', gem: 'fire opal' },
    M: { n: '0', name: 'The Fool', short: 'FOOL', color: '#efe6ff', gem: 'moonstone' },
    hpP: { n: 'III', name: 'The Empress', short: 'EMPRESS', color: '#ff7ad9', gem: 'rose quartz' },
    hpQ: { n: 'IV', name: 'The Emperor', short: 'EMPEROR', color: '#c9ef5a', gem: 'peridot' },
  };
  const arc = (t) => ARC[t] || { n: '?', name: t, short: t, color: '#ffffff' };
  const GOLD = '#e8c26a', GOLD_DIM = '#9c7a3a', CANDLE = ['#ffd27a', '#ffb347', '#ff8a4c', '#fff1c9', '#ffa0a8', '#ffe2a0'];

  const HANDS = [null,
    { name: 'A Whisper', chips: 30, mult: 1 },
    { name: 'A Sign', chips: 60, mult: 2 },
    { name: 'A Portent', chips: 100, mult: 3 },
    { name: 'A Prophecy', chips: 160, mult: 5 },
  ];
  const CHIPS_PER_BLOCK = 2;
  const TARGETS = [250, 600, 1100, 1900, 3000, 4600, 6800, 10000];
  const target = (n) => (n < TARGETS.length ? TARGETS[n] : Math.round(TARGETS[TARGETS.length - 1] * Math.pow(1.6, n - TARGETS.length + 1)));
  const PLACEMENTS = 20;
  const DISCARDS = 3;
  const MAX_JOKERS = 5;

  const roman = (n) => {
    if (n <= 0) return '0';
    const R = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let s = '';
    for (const [v, r] of R) while (n >= v) { s += r; n -= v; }
    return s;
  };
  const pickOf = (a) => a[Math.floor(Math.random() * a.length)];

  // Every omen changes how the game plays. Scoring omens use score(c); the rest are
  // checked by id where their rule applies (has('twin'), has('sticky') ...).
  const JOKERS = [
    { id: 'twin', name: 'The Gemini', cost: 6, desc: 'What the Tower builds, its twin builds again. Tower pieces place twice; the copy is free.' },
    { id: 'mono', name: 'The Lone Star', cost: 4, desc: 'One star falls from every third draw: it is a single block, the Fool.' },
    { id: 'mirror', name: 'The Looking Glass', cost: 4, desc: 'Press F to flip the chosen card: Sun and Moon, Lovers and Devil trade places.' },
    { id: 'sticky', name: 'The Spider’s Thread', cost: 5, desc: 'Nothing above a broken row falls. It hangs where it was.' },
    { id: 'bighand', name: 'The Open Palm', cost: 6, desc: 'Hold six cards instead of five.' },
    { id: 'recycler', name: 'The Wheel', cost: 5, desc: 'A banish costs nothing if that card could have broken a row.' },
    { id: 'paper', name: 'The Lantern', cost: 5, desc: 'The Hermit walks by night for free: it burns no turn of the candle.' },
    { id: 'penta', name: 'The Crowned Pair', cost: 5, desc: 'The Empress and Emperor join your deck (3 five-block cards). Each broken gem gives +2 more stars.' },
    { id: 'pockets', name: 'The Velvet Purse', cost: 4, desc: '+2 banishes every night.' },
    { id: 'hothand', name: 'The Flame', cost: 6, desc: '+3 fate for every banish you still hold.', score(c) { const n = c.discards; if (n) { c.mult += 3 * n; c.notes.push(`Flame +${3 * n} fate`); } } },
    { id: 'sweep', name: 'The Empty Cup', cost: 6, desc: '×3 fate if the well is empty after the break.', score(c) { if (c.emptyAfter) { c.mult *= 3; c.notes.push('Empty Cup ×3'); } } },
    { id: 'tetra', name: 'The Four Winds', cost: 7, desc: 'A Prophecy (four rows) gives ×3 fate.', score(c) { if (c.lines >= 4) { c.mult *= 3; c.notes.push('Four Winds ×3'); } } },
    { id: 'echo', name: 'The Bell', cost: 6, desc: 'The first break of each night rings twice: it scores double.' },
    { id: 'slowhand', name: 'The Hourglass', cost: 5, desc: '+15 stars for every turn of candle left.', score(c) { if (c.left) { c.chips += 15 * c.left; c.notes.push(`Hourglass +${15 * c.left}`); } } },
  ];

  // ---------- Madame Tetra's lines ----------
  const SAY = {
    hello: 'Sit, sit. Cross my palm with silver, and I shall deal your fate.',
    night: (r, t) => `Night ${r}. The cards demand ${t} fortune. I have already seen you reach it. Probably.`,
    fore1: [
      (a, at) => `${a} longs for ${at}.`,
      (a, at) => `I see ${a} at ${at}. A row breaks there.`,
      (a, at) => `${a} whispers of ${at}. Do listen.`,
    ],
    foreN: (a, at, n) => `${a} at ${at}… ${['', 'one', 'two', 'three', 'four'][n]} rows shatter. I have seen it.`,
    flavor: {
      I: 'The Tower stands alone. Give it a wall to lean on.',
      O: 'The Hermit asks only for a quiet corner.',
      T: 'The Hanged Man sees the well upside down. Turn him.',
      S: 'The Lovers lean on one another. So should your rows.',
      Z: 'The Devil tempts you toward a gap. Resist him.',
      J: 'The Moon hides its hook in the shadows. Mind it.',
      L: 'The Sun rises on the right of things. Usually.',
      M: 'The Fool fits anywhere. That is his whole trick.',
      hpP: 'The Empress demands room. Give it to her.',
      hpQ: 'The Emperor sits wide and expects tribute.',
    },
    clear: [null,
      ['A Whisper. Modest, but sincere.', 'One row. The spirits nod politely.', 'A small omen, prettily read.'],
      ['A Sign! The spirits applaud.', 'Two rows. I felt it in my rings.', 'Twice the glass sings. Lovely.'],
      ['A Portent! Even my candles lean in.', 'Three rows. Did I foretell it? I did.'],
      ['A PROPHECY. Exactly as I saw it. More or less.', 'Four rows! Write it down: Madame was right again.'],
    ],
    gap: ['Hmm. The cards do not forgive a gap like that.', 'A hollow under the glass. I saw it coming and said nothing.', 'Darling. The Devil lives in those gaps.'],
    tall: ['The stars pile up to your chin. Break something.', 'The well grows crowded. Even I cannot read through that.'],
    gutter: 'The candle gutters. Three turns left.',
    banish: ['Banished. The deck will offer another.', 'Away with it. I never liked that card.', 'Gone. Fate is negotiable, for a price.'],
    recycled: 'Free of charge. That one could have broken a row, you know.',
    noBanish: 'No banishes left. You must live with your cards.',
    twin: 'The Tower has a twin. Set it down; it costs you nothing.',
    win: ['Exactly as I predicted.', 'The night is read. I was magnificent.', 'Fortune met. Naturally.'],
    shop: 'Omens for sale. Each bends a rule; my prices bend nothing.',
    buy: ['A fine omen. It suits you almost as well as it suited me.', 'Sold. Treat it kindly; it has a temper.', 'Wise. I would have chosen the same.'],
    lose: {
      'Out of placements': 'The candle is out, darling. Fate keeps its own hours.',
      'The well filled up': 'The glass has reached the stars. The reading is over.',
    },
  };

  // ---------- drawing helpers (cached sprites) ----------
  const DPR = () => window.devicePixelRatio || 1;
  const mkCanvas = (w, h) => {
    const c = document.createElement('canvas'), d = DPR();
    c.width = Math.round(w * d); c.height = Math.round(h * d);
    c.style.width = w + 'px'; c.style.height = h + 'px';
    const g = c.getContext('2d');
    g.setTransform(d, 0, 0, d, 0, 0);
    return [c, g];
  };
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  // Four-point star (a twinkle), centre x,y, radius r.
  const star4 = (g, x, y, r, w = 0.28) => {
    g.beginPath();
    g.moveTo(x, y - r); g.quadraticCurveTo(x + r * w, y - r * w, x + r, y);
    g.quadraticCurveTo(x + r * w, y + r * w, x, y + r); g.quadraticCurveTo(x - r * w, y + r * w, x - r, y);
    g.quadraticCurveTo(x - r * w, y - r * w, x, y - r); g.closePath();
  };
  const seeded = (str) => W.rng([...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7));

  // A cut gemstone in a gilt setting: four bevel facets around a table, with a glint.
  const gemCache = new Map();
  function gemSprite(color, s) {
    const key = color + '|' + s + '|' + DPR();
    let c = gemCache.get(key);
    if (c) return c;
    let g;
    [c, g] = mkCanvas(s, s);
    const o = 1.2, i = Math.max(3.5, s * 0.27);
    const L = o, T = o, R = s - o, B = s - o, iL = i, iT = i, iR = s - i, iB = s - i;
    g.fillStyle = '#20120a';
    g.fillRect(0, 0, s, s);
    g.fillStyle = W.shade(color, 0.55); poly(g, [L, T, R, T, iR, iT, iL, iT]); g.fill();
    g.fillStyle = W.shade(color, 0.2); poly(g, [L, T, iL, iT, iL, iB, L, B]); g.fill();
    g.fillStyle = W.shade(color, -0.32); poly(g, [R, T, R, B, iR, iB, iR, iT]); g.fill();
    g.fillStyle = W.shade(color, -0.55); poly(g, [L, B, iL, iB, iR, iB, R, B]); g.fill();
    const tg = g.createLinearGradient(iL, iT, iR, iB);
    tg.addColorStop(0, W.shade(color, 0.42)); tg.addColorStop(0.5, color); tg.addColorStop(1, W.shade(color, -0.2));
    g.fillStyle = tg; g.fillRect(iL, iT, iR - iL, iB - iT);
    // facet edges
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 0.7;
    g.beginPath(); g.moveTo(L, T); g.lineTo(iL, iT); g.moveTo(R, T); g.lineTo(iR, iT); g.moveTo(L, B); g.lineTo(iL, iB); g.moveTo(R, B); g.lineTo(iR, iB); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.strokeRect(iL, iT, iR - iL, iB - iT);
    // glint on the table
    g.fillStyle = 'rgba(255,255,255,0.55)';
    poly(g, [iL + 1, iT + 1, iL + (iR - iL) * 0.45, iT + 1, iL + 1, iT + (iB - iT) * 0.45]); g.fill();
    // gilt setting
    g.strokeStyle = '#c9a24a'; g.lineWidth = 1; g.strokeRect(0.5, 0.5, s - 1, s - 1);
    g.strokeStyle = 'rgba(40,20,0,0.6)'; g.strokeRect(1.5, 1.5, s - 3, s - 3);
    gemCache.set(key, c);
    return c;
  }

  // The constellation of a piece: stars on each mino, lines between neighbours.
  function constellation(g, type, cx, cy, maxW, maxH, color, maxCell) {
    const rot = type === 'I' ? 1 : 0; // the Tower stands upright on its card
    const cells = W.shapeCells(type, rot);
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const w = Math.max(...xs) - minX + 1, h = Math.max(...ys) - minY + 1;
    const step = Math.min(maxW / (w + 0.4), maxH / (h + 0.4), maxCell || 14);
    const ox = cx - (w * step) / 2 + step / 2, oy = cy - (h * step) / 2 + step / 2;
    const pts = cells.map(([x, y]) => [ox + (x - minX) * step, oy + (y - minY) * step]);
    g.save();
    g.strokeStyle = hexA(color, 0.75); g.lineWidth = Math.max(0.8, step * 0.08);
    g.beginPath();
    cells.forEach(([x, y], a) => cells.forEach(([x2, y2], b) => {
      if (b > a && Math.abs(x - x2) + Math.abs(y - y2) === 1) { g.moveTo(pts[a][0], pts[a][1]); g.lineTo(pts[b][0], pts[b][1]); }
    }));
    g.stroke();
    g.shadowColor = color; g.shadowBlur = step * 0.7;
    for (const [x, y] of pts) {
      g.fillStyle = color; star4(g, x, y, step * 0.36, 0.22); g.fill();
      g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(x, y, Math.max(1, step * 0.09), 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // Gilt double border with corner diamonds, shared by faces and backs.
  function gilt(g, w, h) {
    g.strokeStyle = GOLD; g.lineWidth = 1.2; rr(g, 2.5, 2.5, w - 5, h - 5, 4); g.stroke();
    g.strokeStyle = hexA(GOLD, 0.55); g.lineWidth = 0.7; g.strokeRect(5.5, 5.5, w - 11, h - 11);
    g.fillStyle = GOLD;
    for (const [x, y] of [[5.5, 5.5], [w - 5.5, 5.5], [5.5, h - 5.5], [w - 5.5, h - 5.5]]) poly(g, [x, y - 2.4, x + 2.4, y, x, y + 2.4, x - 2.4, y]), g.fill();
  }

  // A tarot face: numeral, a night-sky window with the piece as a constellation, a name banner.
  function drawFace(g, type, w, h) {
    const A = arc(type), r = seeded(type);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#2c1745'); bg.addColorStop(1, '#170b28');
    g.fillStyle = bg; rr(g, 0, 0, w, h, 6); g.fill();
    gilt(g, w, h);
    const top = Math.round(h * 0.17), bot = Math.round(h * 0.8);
    const wx = 8, ww = w - 16;
    // window
    g.save();
    g.beginPath();
    g.moveTo(wx, bot); g.lineTo(wx, top + ww * 0.32); g.arc(w / 2, top + ww * 0.5, ww / 2, Math.PI + 0.5, -0.5); g.lineTo(wx + ww, bot); g.closePath();
    const sky = g.createRadialGradient(w / 2, (top + bot) / 2, 2, w / 2, (top + bot) / 2, ww);
    sky.addColorStop(0, hexA(A.color, 0.28)); sky.addColorStop(0.6, '#110722'); sky.addColorStop(1, '#0a0416');
    g.fillStyle = sky; g.fill();
    g.clip();
    g.fillStyle = 'rgba(255,240,220,0.55)';
    for (let i = 0; i < 14; i++) { const x = wx + r() * ww, y = top + r() * (bot - top), z = r() * 0.8 + 0.3; g.fillRect(x, y, z, z); }
    g.restore();
    g.strokeStyle = hexA(GOLD, 0.7); g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(wx, bot); g.lineTo(wx, top + ww * 0.32); g.arc(w / 2, top + ww * 0.5, ww / 2, Math.PI + 0.5, -0.5); g.lineTo(wx + ww, bot); g.stroke();
    constellation(g, type, w / 2, (top + ww * 0.25 + bot) / 2 + 1, ww - 6, bot - top - ww * 0.2, A.color, Math.min(14, w * 0.2));
    // numeral
    g.fillStyle = GOLD; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.max(9, Math.round(w * 0.16))}px "Cinzel Decorative", "Cinzel", serif`;
    g.fillText(A.n, w / 2, top / 2 + 2.5);
    // name banner
    const by = bot + (h - 6 - bot) / 2;
    g.fillStyle = '#120820'; g.fillRect(7, bot + 2, w - 14, h - 9 - bot - 2);
    g.font = `700 ${Math.max(7, Math.round(w * 0.12))}px "Cinzel Decorative", "Cinzel", serif`;
    const tw = g.measureText(A.short).width, maxw = w - 16;
    g.save(); g.translate(w / 2, by + 0.5);
    if (tw > maxw) g.scale(maxw / tw, 1);
    g.fillStyle = '#f3e3bf'; g.fillText(A.short, 0, 0);
    g.restore();
  }

  // The back of every card: a gold lattice and an all-seeing eye in a sunburst.
  function drawBack(g, w, h) {
    g.fillStyle = '#2a1242'; rr(g, 0, 0, w, h, 6); g.fill();
    g.save(); rr(g, 6, 6, w - 12, h - 12, 2); g.clip();
    g.strokeStyle = hexA(GOLD, 0.22); g.lineWidth = 0.7; g.beginPath();
    for (let k = -h; k < w + h; k += 8) { g.moveTo(k, 0); g.lineTo(k + h, h); g.moveTo(k, h); g.lineTo(k + h, 0); }
    g.stroke(); g.restore();
    gilt(g, w, h);
    const cx = w / 2, cy = h / 2, R = w * 0.3;
    g.fillStyle = '#1b0b2c'; g.beginPath(); g.arc(cx, cy, R + 3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 0.9;
    g.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r1 = R * 0.62, r2 = i % 2 ? R * 0.85 : R; g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); }
    g.stroke();
    g.beginPath(); g.moveTo(cx - R * 0.55, cy); g.quadraticCurveTo(cx, cy - R * 0.5, cx + R * 0.55, cy); g.quadraticCurveTo(cx, cy + R * 0.5, cx - R * 0.55, cy); g.stroke();
    g.fillStyle = GOLD; g.beginPath(); g.arc(cx, cy, R * 0.16, 0, Math.PI * 2); g.fill();
  }

  // An omen's sigil: a small constellation seeded by its id, in a gilt ring.
  function sigil(id, size) {
    const [c, g] = mkCanvas(size, size), r = seeded(id), m = size / 2;
    g.fillStyle = '#160a26'; g.beginPath(); g.arc(m, m, m - 1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 1; g.beginPath(); g.arc(m, m, m - 1.5, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = hexA(GOLD, 0.4); g.beginPath(); g.arc(m, m, m - 4, 0, Math.PI * 2); g.stroke();
    const n = 4 + r.int(3), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.9, d = (m - 8) * (0.35 + r() * 0.65); pts.push([m + Math.cos(a) * d, m + Math.sin(a) * d]); }
    g.strokeStyle = hexA('#f3e3bf', 0.55); g.lineWidth = 0.8; g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    if (r.chance(0.5)) g.closePath();
    g.stroke();
    g.shadowColor = GOLD; g.shadowBlur = 4; g.fillStyle = '#fff3d6';
    pts.forEach(([x, y], i) => { star4(g, x, y, i === 0 ? size * 0.11 : size * 0.07); g.fill(); });
    return c;
  }

  // Madame Tetra herself: a silhouette cameo, lit by a candle from below.
  function drawMadame(g, w, h) {
    const cx = w / 2, cy = h / 2;
    g.save();
    g.beginPath(); g.ellipse(cx, cy, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2);
    const bg = g.createRadialGradient(w * 0.75, h * 0.95, 4, w * 0.6, h * 0.7, h * 0.9);
    bg.addColorStop(0, '#ffb658'); bg.addColorStop(0.35, '#a2482e'); bg.addColorStop(1, '#2a1238');
    g.fillStyle = bg; g.fill();
    g.clip();
    const sx = w / 80, sy = h / 96;
    g.scale(sx, sy);
    // plume
    g.strokeStyle = '#120818'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(57, 24); g.bezierCurveTo(62, 14, 58, 6, 68, 0); g.stroke();
    g.fillStyle = '#120818'; g.beginPath(); g.moveTo(68, 0); g.bezierCurveTo(78, 6, 70, 16, 61, 20); g.bezierCurveTo(66, 12, 66, 6, 68, 0); g.fill();
    // silhouette: turban, profile, neck, shawl
    g.beginPath();
    g.moveTo(4, 96);
    g.bezierCurveTo(8, 84, 18, 80, 27, 76);
    g.lineTo(28, 66);
    g.bezierCurveTo(22, 60, 18, 52, 18, 46);
    g.bezierCurveTo(10, 42, 8, 30, 14, 22);
    g.bezierCurveTo(20, 12, 36, 8, 48, 12);
    g.bezierCurveTo(58, 15, 64, 22, 62, 32);
    g.bezierCurveTo(60, 35, 58, 37, 58, 39);
    g.bezierCurveTo(59, 42, 59, 45, 60, 47);
    g.lineTo(65, 53);
    g.bezierCurveTo(64, 55, 61, 55, 60, 56);
    g.bezierCurveTo(61, 57, 61, 58, 60, 59);
    g.bezierCurveTo(61, 60, 60, 62, 58, 62);
    g.bezierCurveTo(59, 64, 58, 67, 54, 68);
    g.bezierCurveTo(50, 69, 48, 70, 47, 72);
    g.lineTo(48, 78);
    g.bezierCurveTo(56, 82, 66, 86, 72, 96);
    g.closePath();
    g.fillStyle = '#140a1e'; g.fill();
    // candle rim-light along the face
    g.strokeStyle = 'rgba(255,190,110,0.55)'; g.lineWidth = 1.1; g.stroke();
    // turban wraps
    g.strokeStyle = 'rgba(232,194,106,0.55)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(16, 34); g.bezierCurveTo(30, 22, 48, 18, 61, 26); g.stroke();
    g.beginPath(); g.moveTo(15, 26); g.bezierCurveTo(28, 14, 44, 12, 56, 17); g.stroke();
    // jewel
    g.fillStyle = GOLD; g.beginPath(); g.arc(57, 26, 3.6, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(57, 26, 2.2, 0, Math.PI * 2); g.fill();
    // kohl-lined closed eye
    g.strokeStyle = GOLD; g.lineWidth = 1.1;
    g.beginPath(); g.moveTo(50, 45); g.quadraticCurveTo(53.5, 47.5, 57, 45); g.stroke();
    g.beginPath(); g.moveTo(51, 46.5); g.lineTo(50, 49); g.moveTo(53.5, 47.3); g.lineTo(53.3, 50); g.moveTo(56, 46.4); g.lineTo(56.6, 49); g.stroke();
    // hoop earring
    g.lineWidth = 1.4; g.beginPath(); g.arc(33, 62, 4.5, 0, Math.PI * 2); g.stroke();
    // shawl fringe
    g.strokeStyle = 'rgba(232,194,106,0.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(8, 88); g.bezierCurveTo(26, 80, 52, 80, 70, 92); g.stroke();
    g.restore();
    g.strokeStyle = GOLD; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = hexA(GOLD, 0.45); g.lineWidth = 0.8; g.beginPath(); g.ellipse(cx, cy, w / 2 - 5, h / 2 - 5, 0, 0, Math.PI * 2); g.stroke();
  }

  // A small candle for the hub art.
  function candle(g, x, y, hgt) {
    const glow = g.createRadialGradient(x, y - hgt - 6, 1, x, y - hgt - 6, 44);
    glow.addColorStop(0, 'rgba(255,190,100,0.45)'); glow.addColorStop(1, 'rgba(255,150,60,0)');
    g.fillStyle = glow; g.fillRect(x - 46, y - hgt - 52, 92, 92);
    const wax = g.createLinearGradient(x - 6, 0, x + 6, 0);
    wax.addColorStop(0, '#d9c49a'); wax.addColorStop(0.5, '#fff1d0'); wax.addColorStop(1, '#b49a6a');
    g.fillStyle = wax; g.fillRect(x - 6, y - hgt, 12, hgt);
    g.fillStyle = '#1a0d10'; g.fillRect(x - 0.6, y - hgt - 4, 1.2, 4);
    g.fillStyle = '#ffd27a'; g.beginPath(); g.moveTo(x, y - hgt - 17); g.quadraticCurveTo(x + 5, y - hgt - 6, x, y - hgt - 2); g.quadraticCurveTo(x - 5, y - hgt - 6, x, y - hgt - 17); g.fill();
    g.fillStyle = '#fff6e0'; g.beginPath(); g.ellipse(x, y - hgt - 6, 1.6, 3.4, 0, 0, Math.PI * 2); g.fill();
  }

  // ---------- sound: glass, bells, harp, gong ----------
  let busNode = null, busCtx = null;
  function bus() {
    const ctx = W.audio();
    if (!ctx) return undefined;
    if (busCtx !== ctx || !busNode) {
      const input = ctx.createGain();
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      conv.buffer = ir;
      const wet = ctx.createGain(); wet.gain.value = 0.32;
      input.connect(ctx.destination);
      input.connect(conv).connect(wet).connect(ctx.destination);
      busNode = input; busCtx = ctx;
    }
    return busNode;
  }
  const SCALE = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.5];
  const snd = {
    // bell: sine with inharmonic partials
    bell(f, vol = 0.04, dur = 1.1, at = 0) {
      const out = bus();
      W.tone({ f, dur, type: 'sine', vol, at, out });
      W.tone({ f: f * 2.76, dur: dur * 0.45, type: 'sine', vol: vol * 0.35, at, out });
      W.tone({ f: f * 5.4, dur: dur * 0.2, type: 'sine', vol: vol * 0.15, at, out });
    },
    pluck(f, vol = 0.05, at = 0) {
      const out = bus();
      W.tone({ f, dur: 0.9, type: 'triangle', vol, attack: 0.002, at, out });
      W.tone({ f: f * 2, dur: 0.45, type: 'sine', vol: vol * 0.45, attack: 0.002, at, out });
      W.tone({ f: f * 3, dur: 0.2, type: 'sine', vol: vol * 0.2, attack: 0.002, at, out });
      W.noise({ dur: 0.025, vol: vol * 0.4, filter: 'highpass', freq: 3500, at, out });
    },
    harp(col) {
      const i = Math.max(0, Math.min(SCALE.length - 3, Math.round(col)));
      snd.pluck(SCALE[i], 0.05);
      snd.pluck(SCALE[i + 2], 0.035, 0.045);
    },
    gong(base = 73, vol = 0.13, long = 3.2) {
      const out = bus();
      W.tone({ f: base * 1.02, f2: base, dur: long, type: 'sine', vol, attack: 0.012, out });
      W.tone({ f: base * 2.76, dur: long * 0.6, type: 'sine', vol: vol * 0.35, attack: 0.02, out });
      W.tone({ f: base * 5.4, dur: long * 0.35, type: 'sine', vol: vol * 0.18, attack: 0.02, out });
      W.tone({ f: base * 8.93, dur: long * 0.2, type: 'sine', vol: vol * 0.08, attack: 0.01, out });
      W.noise({ dur: 0.35, vol: vol * 0.4, filter: 'lowpass', freq: 500, out });
    },
    shatter(n = 1) {
      const out = bus();
      W.noise({ dur: 0.3 + n * 0.05, vol: 0.04 + n * 0.008, filter: 'highpass', freq: 3800, freq2: 7000, out });
      for (let i = 0; i < 6 + n * 3; i++) W.tone({ f: 2400 + Math.random() * 4200, dur: 0.06 + Math.random() * 0.18, type: 'sine', vol: 0.012, at: Math.random() * (0.18 + n * 0.05), out });
    },
    flip(i) { snd.bell([1046.5, 1174.7, 1318.5, 1568, 1760, 2093][i % 6], 0.026, 0.7); },
    swish(at = 0) { W.noise({ dur: 0.12, vol: 0.03, filter: 'bandpass', freq: 3000, freq2: 900, q: 0.8, at }); },
    banish() { snd.swish(); snd.bell(220, 0.035, 0.9, 0.04); },
    mirror() { snd.bell(1318.5, 0.03, 0.7); snd.bell(987.8, 0.025, 0.7, 0.07); },
  };
  const VOICE = {
    move: () => W.tone({ f: 2637, dur: 0.035, type: 'sine', vol: 0.008 }),
    rotate: () => { const out = bus(); W.tone({ f: 1760, dur: 0.14, type: 'sine', vol: 0.016, out }); W.tone({ f: 3520, dur: 0.07, type: 'sine', vol: 0.006, out }); },
    drop: null,
    lock: null, // the harp pluck is played in onLock, pitched by column
    clear: () => { snd.gong(82, 0.11, 2.6); },
    big: () => { snd.gong(55, 0.15, 3.8); [523.3, 659.3, 784, 1046.5].forEach((f, i) => snd.bell(f, 0.03, 1.6, 0.12 + i * 0.09)); },
    buy: () => { snd.bell(1046.5, 0.04, 1.2); snd.bell(1568, 0.03, 1.2, 0.09); },
    bad: () => { snd.bell(196, 0.05, 1.2); snd.bell(207.7, 0.04, 1.2, 0.03); },
    win: () => { [587.3, 740, 880, 1174.7, 1480].forEach((f, i) => snd.bell(f, 0.035, 1.4, i * 0.1)); snd.gong(98, 0.08, 2.8); },
    tick: () => { W.noise({ dur: 0.03, vol: 0.025, filter: 'highpass', freq: 3000 }); snd.bell(1568, 0.016, 0.4); },
    coin: () => { snd.bell(2093, 0.025, 0.5); snd.bell(2637, 0.018, 0.4, 0.05); },
    hit: null,
  };

  function mount(sh) {
    defineShapes();
    W.voice = Object.assign({}, VOICE);
    sh.own(() => { try { busNode && busNode.disconnect(); } catch (e) { /* gone */ } busNode = null; busCtx = null; });
    const rng = W.rng();
    const board = new W.Board(10, 20);
    // Leave room under the well for the hand of cards on wider screens.
    const cell = window.innerWidth >= 760
      ? Math.max(14, Math.min(30, Math.floor((window.innerHeight - 330) / 20), W.autoCell(10, 20, 30)))
      : W.autoCell(10, 20, 30);
    let run, hand = [], sel = 0, pile = [], draws = 0;
    let roundScore = 0, placementsLeft = 0, discardsLeft = 0, last = null, roundOver = false;
    let twinPending = null, firstClear = true;
    let prevHoles = 0, guttered = false, cracks = [], glowBoost = 0, twinkles = [], twinkleT = 0;

    const has = (id) => run.jokers.some((j) => j.id === id);
    const handSize = () => (has('bighand') ? 6 : 5);
    const deckTypes = () => W.TYPES.concat(W.TYPES).concat(has('penta') ? ['hpP', 'hpQ', 'hpP'] : []);
    const makePiece = (type, extra) => {
      const p = W.piece(type);
      p.blocks = p.blocks.map(() => Object.assign({ color: arc(type).color, ptype: type }, extra || {}));
      return p;
    };

    // ---------- the well: velvet, an astrolabe, gold pins, candlelight ----------
    let bgKey = '', bgCanvas = null, glowCanvas = null;
    function buildBg(Wd, Hd, s) {
      const [c, g] = mkCanvas(Wd, Hd), r = seeded('velvet');
      const base = g.createLinearGradient(0, 0, 0, Hd);
      base.addColorStop(0, '#1b0c2e'); base.addColorStop(0.6, '#140823'); base.addColorStop(1, '#10061b');
      g.fillStyle = base; g.fillRect(0, 0, Wd, Hd);
      // drape folds
      for (let x = 0; x < Wd; x++) {
        const v = Math.sin((x / Wd) * Math.PI * 4.5 + 0.6) * 0.6 + Math.sin((x / Wd) * Math.PI * 11) * 0.25;
        g.fillStyle = v > 0 ? `rgba(190,120,255,${v * 0.045})` : `rgba(0,0,0,${-v * 0.22})`;
        g.fillRect(x, 0, 1, Hd);
      }
      // velvet pile
      for (let i = 0; i < Wd * Hd * 0.03; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.12)'; g.fillRect(r() * Wd, r() * Hd, 1, 1); }
      // astrolabe
      const cx = Wd / 2, cy = Hd * 0.42, R = Wd * 0.44;
      g.strokeStyle = hexA(GOLD, 0.08); g.lineWidth = 1;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, R * 0.82, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cx, cy, R * 0.3, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, r2 = i % 6 ? R * 0.95 : R * 0.86; g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); }
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.moveTo(cx + Math.cos(a) * R * 0.3, cy + Math.sin(a) * R * 0.3); g.lineTo(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82); }
      g.stroke();
      g.beginPath(); g.ellipse(cx, cy + R * 0.1, R * 0.82, R * 0.42, 0, 0, Math.PI * 2); g.stroke();
      // faint stars
      for (let i = 0; i < 46; i++) {
        const x = r() * Wd, y = r() * Hd * 0.85, z = r();
        g.fillStyle = `rgba(255,236,200,${0.12 + z * 0.3})`;
        if (z > 0.86) { star4(g, x, y, 2.6); g.fill(); } else g.fillRect(x, y, 1, 1);
      }
      // gold pins at grid intersections
      g.fillStyle = hexA(GOLD, 0.22);
      for (let y = 1; y < board.h; y++) for (let x = 1; x < board.w; x++) { g.beginPath(); g.arc(x * s, y * s, 0.9, 0, Math.PI * 2); g.fill(); }
      // inner filigree
      g.strokeStyle = hexA(GOLD, 0.28); g.lineWidth = 1; g.strokeRect(3.5, 3.5, Wd - 7, Hd - 7);
      g.strokeStyle = hexA(GOLD, 0.12); g.strokeRect(6.5, 6.5, Wd - 13, Hd - 13);
      g.strokeStyle = hexA(GOLD, 0.35);
      for (const [x, y, sx, sy] of [[3.5, 3.5, 1, 1], [Wd - 3.5, 3.5, -1, 1], [3.5, Hd - 3.5, 1, -1], [Wd - 3.5, Hd - 3.5, -1, -1]]) {
        g.beginPath(); g.moveTo(x, y + sy * 22); g.bezierCurveTo(x + sx * 10, y + sy * 18, x + sx * 6, y + sy * 6, x + sx * 14, y + sy * 8);
        g.bezierCurveTo(x + sx * 18, y + sy * 9, x + sx * 16, y + sy * 14, x + sx * 12, y + sy * 13); g.stroke();
        g.beginPath(); g.moveTo(x + sx * 22, y); g.bezierCurveTo(x + sx * 18, y + sy * 10, x + sx * 6, y + sy * 6, x + sx * 8, y + sy * 14); g.stroke();
      }
      bgCanvas = c;
      // candle glow sprite
      const [gc, gg] = mkCanvas(Wd, Hd);
      const rg = gg.createRadialGradient(Wd / 2, Hd * 1.05, 4, Wd / 2, Hd * 1.05, Hd * 0.85);
      rg.addColorStop(0, 'rgba(255,170,80,0.42)'); rg.addColorStop(0.4, 'rgba(255,120,60,0.12)'); rg.addColorStop(1, 'rgba(255,100,60,0)');
      gg.fillStyle = rg; gg.fillRect(0, 0, Wd, Hd);
      glowCanvas = gc;
    }
    function background(ctx, Wd, Hd, s, t) {
      const key = Wd + 'x' + Hd + '@' + DPR();
      if (key !== bgKey) { bgKey = key; buildBg(Wd, Hd, s); }
      ctx.fillStyle = '#12081f'; ctx.fillRect(-20, -20, Wd + 40, Hd + 40);
      ctx.drawImage(bgCanvas, 0, 0, Wd, Hd);
      const flick = 0.62 + 0.14 * Math.sin(t * 0.0113) + 0.09 * Math.sin(t * 0.0271 + 1.3) + 0.05 * Math.sin(t * 0.063 + 0.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, flick + glowBoost);
      ctx.drawImage(glowCanvas, 0, 0, Wd, Hd);
      ctx.restore();
    }

    function drawBlock(ctx, b, px, py, s, x, y, o) {
      if (o.ghost) return; // the landing preview is drawn as a constellation in underlay()
      ctx.drawImage(gemSprite(b.color || '#ffffff', s), px, py, s, s);
      if (b.twin) {
        ctx.save(); ctx.strokeStyle = '#f4f0ff'; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, s * 0.2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }

    // The ghost: where the stars will align.
    function underlay(ctx, s) {
      const p = st.active;
      if (!p || st.clearing) return;
      const gy = st.ghostY();
      if (gy === p.y) return;
      const cells = W.pieceCells(p, p.rot, p.x, gy).filter((c) => c.y >= 0);
      const col = (p.blocks[0] && p.blocks[0].color) || GOLD;
      const t = performance.now();
      ctx.save();
      ctx.fillStyle = hexA(col, 0.07);
      for (const c of cells) ctx.fillRect(c.x * s + 1, c.y * s + 1, s - 2, s - 2);
      ctx.strokeStyle = hexA(col, 0.55); ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath();
      cells.forEach((a, i) => cells.forEach((b, j) => {
        if (j > i && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1) { ctx.moveTo(a.x * s + s / 2, a.y * s + s / 2); ctx.lineTo(b.x * s + s / 2, b.y * s + s / 2); }
      }));
      ctx.stroke(); ctx.setLineDash([]);
      cells.forEach((c, i) => {
        const tw = 0.75 + 0.25 * Math.sin(t * 0.006 + i * 1.7);
        ctx.fillStyle = hexA(col, 0.85 * tw);
        star4(ctx, c.x * s + s / 2, c.y * s + s / 2, s * 0.24 * tw); ctx.fill();
      });
      ctx.restore();
    }

    // Twinkles on settled gems, a candle-lit glint now and then.
    function overlay(ctx, s) {
      for (const k of twinkles) {
        const a = Math.sin((k.life / k.max) * Math.PI);
        ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#fffaf0'; ctx.shadowColor = '#ffd27a'; ctx.shadowBlur = 6;
        star4(ctx, k.x * s + s * 0.3, k.y * s + s * 0.3, s * 0.28 * a); ctx.fill(); ctx.restore();
      }
    }

    // Clearing rows warm up in candlelight while cracks run through the glass.
    function clearFlash(ctx, rows, k, s, Wd) {
      const p = 1 - k;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const y of rows) {
        ctx.fillStyle = `rgba(255,170,90,${0.08 + 0.2 * p})`;
        ctx.fillRect(0, y * s, Wd, s);
        const bx = (p * 1.4 - 0.2) * Wd;
        const lg = ctx.createLinearGradient(bx - s * 2, 0, bx + s * 2, 0);
        lg.addColorStop(0, 'rgba(255,230,180,0)'); lg.addColorStop(0.5, 'rgba(255,240,210,0.55)'); lg.addColorStop(1, 'rgba(255,230,180,0)');
        ctx.fillStyle = lg; ctx.fillRect(bx - s * 2, y * s, s * 4, s);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineJoin = 'round';
      const crackPath = () => {
        ctx.beginPath();
        for (const cr of cracks) {
          const n = Math.max(2, Math.floor(cr.length * Math.min(1, p * 1.6)));
          ctx.moveTo(cr[0][0] * s, cr[0][1] * s);
          for (let i = 1; i < n && i < cr.length; i++) ctx.lineTo(cr[i][0] * s, cr[i][1] * s);
        }
      };
      crackPath();
      ctx.strokeStyle = `rgba(30,8,20,${0.3 + 0.5 * p})`; ctx.lineWidth = 2.6; ctx.stroke();
      ctx.strokeStyle = `rgba(255,252,240,${0.5 + 0.5 * p})`; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    function drawParticle(ctx, f, s) {
      const age = (f.max - f.life) / 1000;
      if (f.kind === 'shard') {
        ctx.translate(f.x * s, f.y * s);
        ctx.rotate(f.rot + f.spin * age);
        const z = f.size * s;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = f.color;
        poly(ctx, [f.pts[0] * z, f.pts[1] * z, f.pts[2] * z, f.pts[3] * z, f.pts[4] * z, f.pts[5] * z]); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(f.pts[0] * z, f.pts[1] * z); ctx.lineTo(f.pts[2] * z, f.pts[3] * z); ctx.stroke();
        return;
      }
      // glints (and anything else): a four-point star
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = f.color;
      star4(ctx, f.x * s, f.y * s, (f.kind === 'glint' ? f.size * s : f.size * 0.8) * (0.6 + 0.4 * Math.sin(age * 20)));
      ctx.fill();
    }

    const view = new W.BoardView(sh.canvas, board, {
      cell, grid: false, ghost: false, background, drawBlock, underlay, overlay, clearFlash, drawParticle,
      textFont: '"Cinzel Decorative", "Cinzel", serif', textWeight: 700, textStroke: '#1a0b26',
    });

    function glints(x, y, n, color, speed = 3) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.3 + Math.random());
        view.fx.push({ kind: 'glint', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2.5, life: 400 + Math.random() * 500, max: 900, color: color || pickOf(CANDLE), size: 0.12 + Math.random() * 0.12 });
      }
    }
    function shatter(rows, rowBlocks) {
      rows.forEach((y, ri) => (rowBlocks[ri] || []).forEach((b, x) => {
        if (!b) return;
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * Math.PI * 2, v = 2.5 + Math.random() * 7.5;
          const pts = [];
          for (let q = 0; q < 3; q++) { const aa = (q / 3) * Math.PI * 2 + Math.random() * 1.2, d = 0.4 + Math.random() * 0.6; pts.push(Math.cos(aa) * d, Math.sin(aa) * d); }
          view.fx.push({
            kind: 'shard', x: x + 0.2 + Math.random() * 0.6, y: y + 0.2 + Math.random() * 0.6,
            vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, life: 650 + Math.random() * 700, max: 1350,
            color: k === 0 ? (b.color || GOLD) : pickOf(CANDLE), size: 0.22 + Math.random() * 0.26,
            rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 16, pts,
          });
        }
        if (Math.random() < 0.5) glints(x + 0.5, y + 0.5, 1, '#fff6e0', 5);
      }));
    }
    function makeCracks(rows) {
      cracks = [];
      for (const y of rows) {
        for (let k = 0; k < 2; k++) {
          const sx = 1 + Math.random() * (board.w - 2), dir = k ? 1 : -1, pts = [[sx, y + 0.5]];
          let cx = sx, cy = y + 0.5;
          while (cx > -0.5 && cx < board.w + 0.5) {
            cx += dir * (0.35 + Math.random() * 0.6);
            cy = Math.max(y + 0.1, Math.min(y + 0.9, cy + (Math.random() - 0.5) * 0.55));
            pts.push([cx, cy]);
          }
          cracks.push(pts);
          // a few short branches
          for (let b = 0; b < 3; b++) {
            const at = pts[1 + Math.floor(Math.random() * (pts.length - 2))];
            if (!at) continue;
            cracks.push([at, [at[0] + (Math.random() - 0.5) * 0.8, at[1] + (Math.random() < 0.5 ? -0.45 : 0.45)]]);
          }
        }
      }
    }

    function drawType() {
      draws++;
      if (has('mono') && draws % 3 === 0) return 'M';
      if (!pile.length) pile = rng.shuffle(deckTypes());
      return pile.pop();
    }

    const st = new W.Stacker(board, {
      gravity: 0,
      hold: false,
      clearDelay: 430,
      next() {
        if (twinPending) { const t = twinPending; twinPending = null; const p = makePiece('I', { twin: true }); p.twin = t; return p; }
        sel = Math.min(sel, hand.length - 1);
        return makePiece(hand[sel]);
      },
      onSpawn(p) {
        // The free Twin copy comes back in the same rotation and column.
        if (p.twin) {
          const { rot, x } = p.twin;
          if (board.fits(p, rot, x, p.y)) { p.rot = rot; p.x = x; }
          say(SAY.twin, 2);
        } else foretell(p.type);
        paint();
      },
      onLock(cells, p) {
        let sx = 0;
        for (const c of cells) { sx += c.x; delete c.block.twin; }
        snd.harp(sx / cells.length + (20 - Math.max(0, Math.min(...cells.map((c) => c.y)))) * 0.05);
        for (const c of cells) if (c.y >= 0) glints(c.x + 0.5, c.y + 0.5, 1, pickOf(CANDLE), 2);
        if (p.twin) { sh.log('The Tower’s twin is set down, free of charge.'); return; }
        const free = has('paper') && p.type === 'O';
        if (!free) placementsLeft--;
        else view.float('the lantern: free', p.x + p.n / 2, Math.max(1, p.y + 1), '#ffd27a', 13);
        if (has('twin') && p.type === 'I') twinPending = { rot: p.rot, x: p.x };
        hand[sel] = drawType();
      },
      onClear(rows, rowBlocks) {
        makeCracks(rows);
        scoreClear(rows, rowBlocks);
        clearBlocks = rowBlocks;
        if (has('sticky')) return false;
      },
      afterClear(rows) {
        // Spider's Thread: the rows we kept are emptied in place, so nothing above them falls.
        if (has('sticky')) for (const y of rows) board.cells[y].fill(null);
        shatter(rows, clearBlocks || []);
        snd.shatter(rows.length);
        glowBoost = Math.min(1.2, 0.35 + rows.length * 0.2);
        view.shake(rows.length >= 4 ? 16 : 3 + rows.length * 3);
        cracks = [];
        paint();
      },
      beforeSpawn() {
        paint();
        const holes = board.holes();
        if (holes - prevHoles >= 2) say(pickOf(SAY.gap), 2);
        else if (board.stackHeight() >= 14) say(pickOf(SAY.tall), 2);
        prevHoles = holes;
        if (roundScore >= target(run.round)) { winRound(); return false; }
        if (placementsLeft <= 0 && !twinPending) { loseRun('Out of placements'); return false; }
        if (placementsLeft <= 3 && !guttered) { guttered = true; say(SAY.gutter, 3); }
        return true;
      },
      onTopOut() { loseRun('The well filled up'); },
    });
    let clearBlocks = null;

    // ---------- Madame Tetra ----------
    const host = W.el('div', 'mt-host');
    host.innerHTML = '<div class="mt-portrait"></div><div class="mt-bubble"><span class="mt-name">Madame Tetra</span><p class="mt-say"></p></div>';
    const portrait = host.querySelector('.mt-portrait'), sayEl = host.querySelector('.mt-say');
    {
      const [pc, pg] = mkCanvas(72, 88);
      pc.style.width = '72px'; pc.style.height = '88px';
      drawMadame(pg, 72, 88);
      portrait.appendChild(pc);
    }
    sh.side.prepend(host);
    let sayPri = 0, sayT = 0;
    function say(text, pri = 1) {
      const now = performance.now();
      if (pri < sayPri && now - sayT < 2200) return;
      sayPri = pri; sayT = now;
      sayEl.textContent = text;
      sayEl.classList.remove('fresh'); host.classList.remove('speaking');
      void sayEl.offsetWidth;
      sayEl.classList.add('fresh'); host.classList.add('speaking');
    }

    // Best line this card could make right now: {n rows, centre column}.
    function foresee(type) {
      const p = W.piece(type);
      let best = null;
      for (let rot = 0; rot < 4; rot++) {
        for (let x = -3; x < board.w; x++) {
          if (!board.fits(p, rot, x, -4)) continue;
          let y = -4;
          while (board.fits(p, rot, x, y + 1)) y++;
          const cells = W.pieceCells(p, rot, x, y);
          if (cells.some((c) => c.y < 0)) continue;
          const mine = new Set(cells.map((c) => c.y * 100 + c.x));
          let n = 0;
          for (const r of new Set(cells.map((c) => c.y))) {
            let full = true;
            for (let cx = 0; cx < board.w && full; cx++) if (!board.cells[r][cx] && !mine.has(r * 100 + cx)) full = false;
            if (full) n++;
          }
          if (!n) continue;
          const score = n * 100 + y, cx = cells.reduce((a, c) => a + c.x, 0) / cells.length;
          if (!best || score > best.score) best = { n, cx, score };
        }
      }
      return best;
    }
    const canMakeLine = (type) => !!foresee(type);
    let foreCount = 0;
    function foretell(type) {
      if (!run || roundOver) return;
      const A = arc(type), f = foresee(type);
      foreCount++;
      if (f) {
        const at = f.cx < 2.6 ? 'the left wall' : f.cx > 6.4 ? 'the right wall' : 'the heart of the well';
        say(f.n >= 2 ? SAY.foreN(A.name, at, f.n) : SAY.fore1[foreCount % SAY.fore1.length](A.name, at), 1);
      } else if (foreCount % 2 === 1) say(SAY.flavor[type] || `${A.name}. Hm.`, 1);
    }

    // ---------- the hand of tarot cards ----------
    const handEl = W.el('div', 'mt-hand');
    handEl.innerHTML = '<div class="mt-fan" role="group" aria-label="Your hand of cards"></div><div class="tc-caption" aria-live="polite"></div>';
    const fan = handEl.querySelector('.mt-fan'), caption = handEl.querySelector('.tc-caption');
    sh.boardFrame.after(handEl);
    fan.addEventListener('click', (e) => {
      const t = e.target.closest('[data-i]');
      if (t) pick(+t.dataset.i);
    });
    const faceCache = new Map();
    let shown = [], dealNext = true, veiled = false;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    sh.own(() => { timers.forEach(clearTimeout); timers.clear(); });

    const cardSize = () => {
      const n = Math.max(5, hand.length || 5);
      const cw = Math.max(46, Math.min(68, Math.floor((view.W + 34) / n)));
      return [cw, Math.round(cw * 1.62)];
    };
    function cardCanvas(type, cw, ch) {
      const key = (type || '#back') + '|' + cw + '|' + DPR();
      let src = faceCache.get(key);
      if (!src) {
        let g;
        [src, g] = mkCanvas(cw, ch);
        if (type) drawFace(g, type, cw, ch); else drawBack(g, cw, ch);
        faceCache.set(key, src);
      }
      const [c, g] = mkCanvas(cw, ch);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(src, 0, 0);
      return c;
    }
    function makeCard(type, i, n, cw, ch) {
      const b = W.el('button', 'tc');
      b.type = 'button';
      if (type) b.dataset.i = i;
      const mid = (n - 1) / 2, off = i - mid;
      b.style.setProperty('--rot', `${off * 4.5}deg`);
      b.style.setProperty('--arc', `${off * off * 2.2}px`);
      b.style.setProperty('--i', i);
      b.style.setProperty('--from', `${-(i + 1) * cw * 0.9 - 30}px`);
      b.setAttribute('aria-label', type ? `Card ${i + 1}: ${arc(type).name}` : 'Face-down card');
      const inner = W.el('span', 'tc-inner');
      const face = W.el('span', 'tc-face'), back = W.el('span', 'tc-back');
      if (type) face.appendChild(cardCanvas(type, cw, ch));
      back.appendChild(cardCanvas(null, cw, ch));
      inner.append(face, back);
      b.appendChild(inner);
      if (type) b.insertAdjacentHTML('beforeend', `<span class="tc-key">${i + 1}</span>`);
      return b;
    }
    function syncHand() {
      const [cw, ch] = cardSize();
      fan.style.setProperty('--cw', cw + 'px');
      fan.style.setProperty('--ch', ch + 'px');
      if (!hand.length) {
        // before the first deal: the deck lies face down
        if (fan.children.length !== 5 || shown.length) {
          fan.innerHTML = '';
          for (let i = 0; i < 5; i++) { const c = makeCard(null, i, 5, cw, ch); c.classList.add('down'); c.disabled = true; fan.appendChild(c); }
          shown = [];
        }
      } else if (dealNext || hand.length !== shown.length) {
        // the signature: the whole hand fans out face down, then flips one card at a time
        dealNext = false;
        veiled = true;
        fan.innerHTML = '';
        hand.forEach((t, i) => {
          const c = makeCard(t, i, hand.length, cw, ch);
          c.classList.add('down', 'dealt');
          fan.appendChild(c);
          later(() => snd.swish(), i * 120);
          later(() => { c.classList.remove('down'); snd.flip(i); if (i === sel) { veiled = false; capt(); } }, 520 + i * 190);
        });
        shown = hand.slice();
      } else {
        hand.forEach((t, i) => {
          if (t === shown[i]) return;
          const c = makeCard(t, i, hand.length, cw, ch);
          c.classList.add('down', 'drawn');
          c.style.setProperty('--i', 0);
          fan.children[i].replaceWith(c);
          later(() => snd.swish(), 0);
          later(() => { c.classList.remove('down'); snd.flip(3); }, 240);
        });
        shown = hand.slice();
      }
      const twin = st.active && st.active.twin;
      [...fan.children].forEach((c, i) => {
        c.classList.toggle('on', !!hand.length && i === sel && !twin);
        c.classList.toggle('muted', !!twin);
      });
      capt();
    }
    function capt() {
      const twin = st.active && st.active.twin;
      if (!hand.length) caption.innerHTML = '<span class="tc-num">✧</span> The deck awaits';
      else if (veiled) caption.innerHTML = '<span class="tc-num">✧</span> The cards are dealt';
      else if (twin) caption.innerHTML = '<span class="tc-num">XVI</span> The Tower’s twin · free';
      else { const A = arc(hand[sel]); caption.innerHTML = `<span class="tc-num">${A.n}</span> ${W.esc(A.name)}`; }
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!sh.root.isConnected) return; faceCache.clear(); const cards = [...fan.children]; cards.forEach((c, i) => { const f = c.querySelector('.tc-face'); if (f && hand[i]) { f.innerHTML = ''; f.appendChild(cardCanvas(hand[i], ...cardSize())); } }); });

    // ---------- actions ----------
    function pick(i) {
      if (!st.canAct() || i >= hand.length) return;
      if (st.active && st.active.twin) { sh.toast('Set the Tower’s twin down first'); return; }
      if (i === sel) return;
      const old = st.active;
      sel = i;
      const p = makePiece(hand[sel]);
      st.spawn(p);
      // keep the column you were working in if the new piece fits there
      if (old && st.active && board.fits(p, 0, Math.min(board.w - p.n, Math.max(0, old.x)), p.y)) p.x = Math.min(board.w - p.n, Math.max(0, old.x));
      W.sfx('tick');
      paint();
    }
    const cycle = (d) => pick((sel + d + hand.length) % hand.length);

    function discard() {
      if (!st.canAct()) return;
      if (st.active.twin) { sh.toast('The Tower’s twin cannot be banished'); return; }
      const t = hand[sel];
      const free = has('recycler') && canMakeLine(t);
      if (!free && discardsLeft <= 0) { sh.toast('No banishes left', 'bad'); say(SAY.noBanish, 2); W.sfx('bad'); return; }
      if (!free) discardsLeft--;
      hand[sel] = drawType();
      sh.log(`${W.esc(arc(t).name)} banished${free ? ' · <b>free</b> (the Wheel)' : ''}`);
      if (free) { view.float('the wheel turns', board.w / 2, 3, '#ffd27a', 15); say(SAY.recycled, 2); } else say(pickOf(SAY.banish), 2);
      snd.banish();
      st.spawn(makePiece(hand[sel]));
      paint();
    }

    function flip() {
      if (!st.canAct()) return;
      if (!has('mirror')) { sh.toast('Flipping needs the Looking Glass'); return; }
      const p = st.active, to = MIRROR[p.type];
      if (!to) { sh.toast(`${arc(p.type).name} looks the same in the glass`); return; }
      const rot = (4 - p.rot) % 4;
      const q = makePiece(to, p.twin ? { twin: true } : null);
      for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]]) {
        if (board.fits(q, rot, p.x + kx, p.y + ky)) {
          q.rot = rot; q.x = p.x + kx; q.y = p.y + ky; q.twin = p.twin;
          st.active = q;
          if (!p.twin) hand[sel] = to;
          snd.mirror();
          glints(q.x + q.n / 2, q.y + 1, 8, arc(to).color, 4);
          say(`The Looking Glass turns ${arc(p.type).name} into ${arc(to).name}.`, 1);
          paint();
          return;
        }
      }
      sh.toast('No room to flip');
    }

    const actions = {
      left: () => st.move(-1), right: () => st.move(1), down: () => st.softDrop(),
      rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), hold: () => {},
      discard, flip, prev: () => cycle(-1), nextp: () => cycle(1),
    };
    for (let i = 0; i < 6; i++) actions['pick' + (i + 1)] = () => pick(i);
    const extra = { KeyD: 'discard', KeyF: 'flip', Tab: 'nextp' };
    for (let i = 1; i <= 6; i++) { extra['Digit' + i] = 'pick' + i; extra['Numpad' + i] = 'pick' + i; }
    sh.stackerKeys(st, actions, { extra });
    sh.pad(actions, [['◀', 'left', true], ['⟲', 'rotCCW'], ['⟳', 'rotCW'], ['▶', 'right', true], ['⤓', 'drop'], ['‹ Card', 'prev'], ['Card ›', 'nextp'], ['Banish', 'discard'], ['Mirror', 'flip']]);

    // ---------- side panels ----------
    const scorePanel = W.el('div', 'panel mt-reading');
    const jokerPanel = W.el('div', 'panel mt-omens');
    sh.extra.append(scorePanel, jokerPanel);

    function scoreClear(rows, rowBlocks) {
      const n = rows.length, h = HANDS[Math.min(4, n)];
      const blocks = rowBlocks.flat().filter(Boolean);
      const perBlock = CHIPS_PER_BLOCK + (has('penta') ? 2 : 0);
      const after = new W.Board(board.w, board.h);
      after.cells = board.cells.map((r) => r.slice());
      after.removeRows(rows);
      const c = {
        chips: h.chips + blocks.length * perBlock, mult: h.mult, lines: n, notes: [],
        discards: discardsLeft, left: Math.max(0, placementsLeft), emptyAfter: after.count() === 0,
      };
      for (const j of run.jokers) if (j.score) j.score(c);
      let total = Math.floor(c.chips * c.mult);
      if (firstClear && has('echo')) { total *= 2; c.notes.push('the Bell ×2'); }
      firstClear = false;
      roundScore += total;
      last = { chips: c.chips, mult: c.mult, total, hand: h.name, blocks: blocks.length, perBlock, notes: c.notes };
      const top = Math.min(...rows);
      view.float(h.name.toUpperCase(), board.w / 2, top - 2.2, n >= 3 ? '#fff1c9' : GOLD, n >= 4 ? 22 : n >= 2 ? 18 : 15);
      view.float(`${Math.round(c.chips)} × ${+c.mult.toFixed(1)}`, board.w / 2, top - 0.9, '#cfe6ff', 15);
      view.float(`+${total}`, board.w / 2, top + 0.6, '#ffd27a', n >= 3 ? 30 : 23);
      sh.log(`<b>+${total}</b> · ${h.name}${c.notes.length ? ' · ' + c.notes.map(W.esc).join(', ') : ''}`);
      say(pickOf(SAY.clear[Math.min(4, n)]), 3);
      paint();
    }

    function paint() {
      scorePanel.hidden = jokerPanel.hidden = !run;
      if (!run) { syncHand(); return; }
      const t = target(run.round);
      const pl = Math.max(0, placementsLeft);
      sh.hud([
        { label: 'Night', value: roman(run.round + 1) },
        { label: 'Silver', html: `${run.money}<small> pcs</small>`, tone: 'good' },
        { label: 'Fortune / foretold', html: `${roundScore.toLocaleString()} <small>/ ${t.toLocaleString()}</small>`, tone: roundScore >= t ? 'good' : 'accent', wide: true },
        { label: 'Candle', html: `<span class="mt-candle" aria-hidden="true"><i style="height:${Math.round((pl / PLACEMENTS) * 100)}%"></i></span>${pl}<small> turns</small>`, tone: pl <= 5 ? 'bad' : '' },
        { label: 'Banishes', value: discardsLeft, tone: discardsLeft ? '' : 'bad' },
      ]);
      syncHand();
      const pct = Math.min(100, (roundScore / t) * 100);
      scorePanel.innerHTML = `<h3>The Reading</h3>
        <div class="mt-thread" title="${Math.round(pct)}% of the foretold fortune"><i style="width:${pct}%"></i></div>
        ${last ? `<div class="mt-sum"><span class="st">${Math.round(last.chips)}</span><span class="op">×</span><span class="ft">${+last.mult.toFixed(2)}</span><span class="op">=</span><span>${last.total.toLocaleString()}</span></div>
          <div class="chips"><span class="chip">${last.hand}</span><span class="chip">${last.blocks} gems +${last.blocks * last.perBlock}</span>${last.notes.map((n) => `<span class="chip accent">${W.esc(n)}</span>`).join('')}</div>`
        : '<p class="mt-quiet">Break rows to read your fortune: <span class="st">stars</span> × <span class="ft">fate</span>.</p>'}
        <div class="mt-table">
          ${HANDS.slice(1).map((h, i) => `<span class="nm">${h.name}</span><span>${i + 1} row${i ? 's' : ''}</span><span><span class="st">${h.chips}</span> × <span class="ft">${h.mult}</span></span>`).join('')}
        </div><p class="mt-quiet">Each broken gem adds ${CHIPS_PER_BLOCK + (has('penta') ? 2 : 0)} stars.</p>`;
      jokerPanel.innerHTML = `<h3>Omens ${run.jokers.length}/${MAX_JOKERS}</h3>`;
      if (run.jokers.length) {
        const list = W.el('div', 'mt-omen-list');
        run.jokers.forEach((j) => {
          const row = W.el('div', 'mt-omen', `<span class="nm">${W.esc(j.name)}</span><span class="ds">${W.esc(j.desc)}</span>`);
          row.prepend(sigil(j.id, 34));
          list.appendChild(row);
        });
        jokerPanel.appendChild(list);
      } else jokerPanel.insertAdjacentHTML('beforeend', '<p class="mt-quiet">None yet. Each omen bends one rule. Madame sells them between nights.</p>');
    }

    // ---------- nights ----------
    function startRound() {
      board.clear();
      st.reset();
      roundScore = 0;
      placementsLeft = PLACEMENTS;
      discardsLeft = DISCARDS + (has('pockets') ? 2 : 0);
      last = null;
      roundOver = false;
      twinPending = null;
      firstClear = true;
      prevHoles = 0; guttered = false; cracks = [];
      pile = rng.shuffle(deckTypes());
      hand = [];
      while (hand.length < handSize()) hand.push(drawType());
      sel = 0;
      dealNext = true;
      sayPri = 0;
      say(SAY.night(roman(run.round + 1), target(run.round).toLocaleString()), 3);
      st.spawn();
      paint();
    }

    function winRound() {
      if (roundOver) return;
      roundOver = true;
      const interest = Math.min(5, Math.floor(run.money / 5));
      const spare = Math.floor(Math.max(0, placementsLeft) / 2);
      const earned = 4 + interest + spare + discardsLeft;
      run.money += earned;
      W.sfx('win');
      view.shake(8);
      glowBoost = 1.2;
      for (let i = 0; i < 24; i++) glints(Math.random() * board.w, board.h - Math.random() * 6, 1, pickOf(CANDLE), 6);
      sh.log(`Night ${roman(run.round + 1)} is read · <b>+${earned} silver</b>`);
      say(pickOf(SAY.win), 4);
      run.round++;
      paint();
      later(() => openShop(`The night is read. Madame pays you 4 silver, +${spare} for ${Math.max(0, placementsLeft)} turns of candle unburnt, +${discardsLeft} for banishes unspent, +${interest} interest.`), 1300);
    }

    function loseRun(why) {
      if (roundOver) return;
      roundOver = true;
      st.paused = true;
      paint();
      say(SAY.lose[why] || 'The reading is over.', 5);
      const what = why === 'Out of placements' ? 'The candle burned out' : 'The glass rose to the stars';
      sh.overlay({
        title: 'The Candle Gutters',
        body: `<p class="ov-lead">${what} on night ${roman(run.round + 1)}, at ${roundScore.toLocaleString()} of ${target(run.round).toLocaleString()} fortune.</p><p>Omens held: ${run.jokers.map((j) => W.esc(j.name)).join(', ') || 'none'}.</p>`,
        button: 'Another reading',
      }).then(newRun);
    }

    function openShop(intro) {
      const owned = () => new Set(run.jokers.map((j) => j.id));
      const roll = () => rng.shuffle(JOKERS.filter((j) => !owned().has(j.id))).slice(0, 3);
      let offers = roll(), reroll = 1;
      const body = W.el('div', 'modal-body mt-shop');
      say(SAY.shop, 2);
      const render = () => {
        body.innerHTML = `<p class="mt-quiet">${intro}</p>
          <div class="mt-purse"><span class="chip good">${run.money} silver in your purse</span>
          <button class="btn small" type="button" data-act="reroll"${run.money < reroll ? ' disabled' : ''}>Reshuffle the omens · ${reroll} silver</button></div>`;
        const h1 = W.el('h3', '', `Omens for sale (${run.jokers.length}/${MAX_JOKERS} held)`);
        const g1 = W.el('div', 'tiles');
        offers.forEach((j, i) => {
          const t = W.el('button', 'tile omen', `<span class="t-name">${W.esc(j.name)}</span><span class="t-desc">${W.esc(j.desc)}</span><span class="t-cost">${j.cost} silver</span>`);
          t.prepend(sigil(j.id, 46));
          t.type = 'button';
          t.disabled = run.money < j.cost || run.jokers.length >= MAX_JOKERS;
          t.addEventListener('click', () => { run.money -= j.cost; run.jokers.push(j); offers.splice(i, 1); W.sfx('buy'); say(pickOf(SAY.buy), 2); render(); paint(); });
          g1.appendChild(t);
        });
        if (!offers.length) g1.appendChild(W.el('p', 'mt-quiet', 'The cabinet is bare. Reshuffle for more.'));
        body.append(h1, g1);
        if (run.jokers.length) {
          const h3 = W.el('h3', '', 'Return an omen (half its silver)');
          const g3 = W.el('div', 'chips');
          run.jokers.forEach((j, i) => {
            const b = W.el('button', 'btn small', `${W.esc(j.name)} · +${Math.floor(j.cost / 2)}`);
            b.type = 'button';
            b.addEventListener('click', () => { run.money += Math.floor(j.cost / 2); run.jokers.splice(i, 1); W.sfx('coin'); render(); paint(); });
            g3.appendChild(b);
          });
          body.append(h3, g3);
        }
      };
      body.addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]');
        if (!a || a.dataset.act !== 'reroll') return;
        run.money -= reroll; reroll++; offers = roll(); snd.swish(); W.sfx('coin');
        render(); paint();
      });
      render();
      sh.modal({
        title: 'Madame’s Cabinet of Omens',
        body,
        wide: true,
        actions: [{ label: `Begin night ${roman(run.round + 1)} · foretold ${target(run.round).toLocaleString()}`, primary: true, onClick: startRound }],
      });
    }

    function newRun() {
      run = { round: 0, money: 4, jokers: [] };
      draws = 0;
      sh.logEl.innerHTML = '';
      startRound();
    }

    sh.loop((dt) => {
      st.update(dt);
      view.update(dt);
      glowBoost = Math.max(0, glowBoost - dt / 900);
      twinkleT -= dt;
      if (twinkleT <= 0) {
        twinkleT = 260 + Math.random() * 300;
        const x = Math.floor(Math.random() * board.w), y = board.h - 1 - Math.floor(Math.random() * Math.max(1, board.stackHeight()));
        if (board.cells[y] && board.cells[y][x]) twinkles.push({ x, y, life: 520, max: 520 });
      }
      for (const k of twinkles) k.life -= dt;
      twinkles = twinkles.filter((k) => k.life > 0);
      view.draw(st);
    });

    // Debug handle for headless playtests.
    sh.debug = {
      fill(rowsN = 4, gap = 0) {
        const types = W.TYPES;
        for (let y = board.h - rowsN; y < board.h; y++) for (let x = 0; x < board.w; x++) if (x !== gap) board.cells[y][x] = { color: arc(types[(x * 3 + y) % 7]).color, ptype: 'x' };
        prevHoles = board.holes();
        paint();
      },
      give(type) { hand[sel] = type; st.spawn(makePiece(type)); paint(); },
      money(n) { run.money = n; paint(); },
      night(n) { run.round = n; paint(); },
      win() { roundScore = target(run.round); winRound(); },
      omens(ids) { run.jokers = JOKERS.filter((j) => ids.includes(j.id)); paint(); },
      state: () => ({ hand: hand.slice(), sel, roundScore, placementsLeft, discardsLeft, round: run && run.round }),
    };

    run = null;
    hand = [];
    paint();
    view.draw(st);
    say(SAY.hello, 1);
    sh.overlay({
      title: 'Madame Tetra Will See You Now',
      body: `<p class="ov-lead">Sit, darling. Nothing falls in my parlour; the stars wait for you.</p>
        <ul><li>Press <b>1–5</b> or tap a card to draw its arcana onto the cloth. Move and turn it, then <b>Space</b> sets it down. A fresh card is dealt in its place.</li>
        <li><b>D</b> banishes the chosen card. ${DISCARDS} banishes a night.</li>
        <li>Break rows to read your fortune, <b>stars × fate</b>: a Whisper 30×1, a Sign 60×2, a Portent 100×3, a Prophecy 160×5, plus stars for each gem.</li>
        <li>Reach the foretold fortune within ${PLACEMENTS} turns of the candle, then spend silver on omens. Each omen bends a rule.</li></ul>`,
      button: 'Cross my palm',
    }).then(newRun);
  }

  W.register({
    id: 'hand-of-pieces',
    num: 2,
    title: 'Madame Tetra’s Parlour',
    mix: 'Tarot hands × turn-based stacking',
    pitch: 'Nothing falls. Draw from a hand of five tarot cards, set each piece down with care, and buy omens that bend the rules.',
    palette: ['#4fd8e8', '#ffcf4a', '#b17cff', '#ff4d6d', '#ff9440'],
    shell: { queue: false, hold: false, logTitle: 'Whispers', keysHint: '1–5 draw a card · ← → move · ↑ / Z turn · Space set down · D banish · F flip (Looking Glass) · Tab next card' },
    art(ctx, w, h) {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1d0c30'); bg.addColorStop(1, '#0f0619');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const v = Math.sin((x / w) * Math.PI * 7 + 0.4);
        ctx.fillStyle = v > 0 ? `rgba(190,120,255,${v * 0.05})` : `rgba(0,0,0,${-v * 0.25})`;
        ctx.fillRect(x, 0, 1, h);
      }
      const r = seeded('hub');
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,236,200,${0.15 + r() * 0.4})`; const x = r() * w, y = r() * h * 0.7; if (r() > 0.85) { star4(ctx, x, y, 2.4); ctx.fill(); } else ctx.fillRect(x, y, 1, 1); }
      // astrolabe arc behind the cards
      ctx.strokeStyle = hexA(GOLD, 0.16); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(w / 2, h + 10, 92, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h + 10, 104, Math.PI, 0); ctx.stroke();
      candle(ctx, 42, h - 8, 34);
      candle(ctx, w - 42, h - 8, 26);
      const cw = 46, ch = 74;
      const cards = [[null, -16], ['Z', -6], ['I', 6], [null, 16]];
      cards.forEach(([t, deg], i) => {
        ctx.save();
        ctx.translate(w / 2 + (i - 1.5) * 34, h + 24);
        ctx.rotate((deg * Math.PI) / 180);
        ctx.translate(-cw / 2, -ch - 30 + Math.abs(i - 1.5) * 3);
        ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#000'; rr(ctx, 0, 0, cw, ch, 6); ctx.fill();
        ctx.shadowColor = 'transparent';
        if (t) drawFace(ctx, t, cw, ch); else drawBack(ctx, cw, ch);
        ctx.restore();
      });
      ctx.strokeStyle = hexA(GOLD, 0.6); ctx.lineWidth = 1; ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
    },
    mount,
  });
})();

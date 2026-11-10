/* 01 Stackjack: "The Back Room". A 1940s card den after hours.
 * Pieces are cards in a deck you build. Each piece has a suit and a rank.
 * A cleared row scores as a hand by how many suits it holds. Score = chips × mult.
 * Cover the house's number within the card budget, then spend in the back room.
 */
(function () {
  const W = window.Wells;

  // ---------- suits: four pip shapes (100-unit boxes), each subpath filled on its own ----------
  const PIPS = [
    ['M50 6 C58 20 92 36 92 58 C92 72 82 80 71 80 C62 80 56 76 53 70 C54 80 57 88 64 94 L36 94 C43 88 46 80 47 70 C44 76 38 80 29 80 C18 80 8 72 8 58 C8 36 42 20 50 6 Z'],
    ['M50 90 C22 70 6 54 6 34 C6 18 17 8 30 8 C40 8 47 15 50 24 C53 15 60 8 70 8 C83 8 94 18 94 34 C94 54 78 70 50 90 Z'],
    ['M50 4 L84 50 L50 96 L16 50 Z'],
    ['M31 30 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 Z', 'M10 60 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 Z',
      'M52 60 a19 19 0 1 0 38 0 a19 19 0 1 0 -38 0 Z', 'M38 50 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0 Z',
      'M45 52 C45 74 40 86 32 95 L68 95 C60 86 55 74 55 52 Z'],
  ];
  const PATHS = PIPS.map((a) => a.map((d) => new Path2D(d)));
  // Pip ink, card-edge tint (the back peeking out) and card-stock tint all differ per suit.
  const SUITS = [
    { name: 'Spades', ink: '#1b1e2c', edge: '#2e4675', stock: '#eeeadf' },
    { name: 'Hearts', ink: '#b01f2b', edge: '#7d1720', stock: '#f5e2d2' },
    { name: 'Diamonds', ink: '#c0620a', edge: '#c38c27', stock: '#f6e7c1' },
    { name: 'Clubs', ink: '#16633a', edge: '#2a6f55', stock: '#e6ead3' },
  ];
  const pipSVG = (i, size = 14) => `<svg class="sj-pip" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${PIPS[i].map((d) => `<path d="${d}" fill="${SUITS[i].ink}"/>`).join('')}</svg>`;
  const fmtDesc = (d) => W.esc(d).replace('{H}', pipSVG(1, 13));
  const plainDesc = (d) => d.replace('{H}', 'heart');

  // Indexed by number of distinct suits in the row.
  const HANDS = [null,
    { name: 'Flush', chips: 40, mult: 8 },
    { name: 'Duo', chips: 20, mult: 4 },
    { name: 'Trio', chips: 10, mult: 2 },
    { name: 'Rainbow', chips: 0, mult: 1 },
  ];
  const LINE_X = [1, 1, 1.5, 2.5, 4];
  const TARGETS = [300, 800, 2000, 4500, 9000, 16000, 28000, 45000];
  const target = (n) => (n < TARGETS.length ? TARGETS[n] : Math.round(TARGETS[TARGETS.length - 1] * Math.pow(1.7, n - TARGETS.length + 1)));
  const PIECES_PER_ROUND = 36;
  const MAX_JOKERS = 5;
  const ENH = {
    glass: { name: 'Glass', desc: '×1.5 mult when cleared. One in four breaks.' },
    gold: { name: 'Gilt', desc: '+$1 each time it is cleared.' },
    bonus: { name: 'Marked', desc: '+25 chips each time it is cleared.' },
  };

  // The regulars. Same effects as before, new faces.
  const JOKERS = [
    { id: 'purist', name: 'The Deacon', flav: 'Plays one suit. Prays to it.', cost: 6, desc: 'Flush rows give ×2 mult each.', final(c) { const n = c.rows.filter((r) => r.hand.name === 'Flush').length; if (n) { c.mult *= 2 ** n; c.notes.push(`Deacon ×${2 ** n}`); } } },
    { id: 'quad', name: 'The Bookie', flav: 'Takes his cut of the big ones.', cost: 6, desc: 'Clearing 4 rows at once gives ×3 mult.', final(c) { if (c.rows.length >= 4) { c.mult *= 3; c.notes.push('Bookie ×3'); } } },
    { id: 'redline', name: 'The Widow', flav: 'Wears red. Always has.', cost: 5, desc: '+1 mult for every {H} card cleared.', row(c, r) { c.mult += r.blocks.filter((b) => b.suit === 1).length; } },
    { id: 'accountant', name: 'The Accountant', flav: 'Keeps two sets of books.', cost: 5, desc: 'Earn $1 for every row cleared.', final(c) { c.run.money += c.rows.length; c.notes.push(`Books +$${c.rows.length}`); } },
    { id: 'ladder', name: 'Fire Escape', flav: 'Long way down. Short way out.', cost: 4, desc: '+60 chips when an I piece makes the clear.', final(c) { if (c.lockType === 'I') { c.chips += 60; c.notes.push('Escape +60'); } } },
    { id: 'streak', name: 'The Hot Hand', flav: 'Never cools. Until he does.', cost: 6, desc: '+2 mult for each clear in a row without a dry drop.', final(c) { const n = c.run.combo - 1; if (n > 0) { c.mult += 2 * n; c.notes.push(`Hot Hand +${2 * n}`); } } },
    { id: 'sloppy', name: 'Sloppy Joe', flav: 'Leaves holes wherever he goes.', cost: 5, desc: '+1 mult for each hole left in your stack.', final(c) { if (c.holes) { c.mult += c.holes; c.notes.push(`Sloppy +${c.holes}`); } } },
    { id: 'heavy', name: 'The Heavy', flav: 'Counts everything twice.', cost: 5, desc: 'Cards of rank 6 or more score their chips twice.', row(c, r) { for (const b of r.blocks) if (b.rank >= 6) c.chips += b.rank; } },
    { id: 'minimal', name: 'The Loner', flav: 'Works better without company.', cost: 4, desc: '×1.5 mult for each empty seat at your table.', final(c) { const e = MAX_JOKERS - c.run.jokers.length; if (e) { const m = 1.5 ** e; c.mult *= m; c.notes.push(`Loner ×${m.toFixed(1)}`); } } },
    { id: 'skyline', name: 'The Penthouse', flav: 'Likes the view from up top.', cost: 4, desc: '+8 chips per row of stack height left after the clear.', final(c) { if (c.height) { c.chips += 8 * c.height; c.notes.push(`Penthouse +${8 * c.height}`); } } },
    { id: 'twotone', name: 'The Double', flav: 'Sees two suits. Calls it one.', cost: 7, desc: 'Duo rows score as Flush.', hand(k) { return k === 2 ? 1 : k; } },
    { id: 'thinner', name: 'The Mechanic', flav: 'Thin deck. Fast hands.', cost: 6, desc: '+3 mult for each card under 14 in your deck.', final(c) { const n = Math.max(0, 14 - c.run.deck.length); if (n) { c.mult += 3 * n; c.notes.push(`Mechanic +${3 * n}`); } } },
  ];
  const jokerSuit = (j) => [...j.id].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4;

  // The Dealer. Terse. Deadpan.
  const LINES = {
    first: (t) => `Table one. ${t} to cover. Cards are live.`,
    round: [
      (t) => `The house wants ${t}. Deal.`,
      (t) => `${t} to cover. The clock's running.`,
      (t) => `New table. ${t}. Same rules.`,
      (t) => `${t}. Don't make me count twice.`,
      (t) => `Stakes went up. ${t}.`,
    ],
    big: ['Now that\'s a hand.', 'The house noticed.', 'Pretty. Don\'t get used to it.', 'That\'ll leave a mark.', 'Somebody\'s been practising.', 'Clean.'],
    flush: ['One suit. Neat as a coffin.', 'Flush. Somebody\'s paying attention.'],
    bad: ['That one\'s going to haunt you.', 'You buried a hole. It\'ll keep.', 'Sloppy.', 'The well remembers.', 'I\'ve seen better drops off a bridge.'],
    high: ['You\'re near the ceiling.', 'Getting crowded up there.'],
    shop: ['Buy something or don\'t. The clock\'s running.', 'Regulars are for hire. Cash only.', 'Everything\'s for sale. Some of it\'s worth it.', 'Spend it before it spends you.'],
    hire: ['He works for you now. Mostly.', 'Good choice. Or not.', 'He\'ll want a drink.'],
    shatter: 'Glass breaks. Funny that way.',
    win: ['Covered. Step into the back.', 'You cleared it. Don\'t thank me.'],
    topout: ['Stacked to the ceiling. Table\'s closed.', 'The ceiling caught you. It usually does.'],
    dry: ['Out of cards. Out of luck. Same thing.', 'Shoe\'s empty. So are you.'],
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  let cardId = 0;
  const card = (type, suit, rank, enh) => ({ id: ++cardId, type, suit, rank, enh: enh || null });
  const toPiece = (c) => W.piece(c.type, W.SHAPES[c.type].cells.map(() => ({ color: SUITS[c.suit].edge, suit: c.suit, rank: c.rank, enh: c.enh, cardId: c.id })));

  // ---------- drawing: fonts, sprites, textures ----------
  let fontsReady = false;
  const FONT_SPECS = ['400 20px "Limelight"', '700 12px "Libre Baskerville"', 'italic 400 14px "Libre Baskerville"'];
  const fontsLoaded = () => (document.fonts ? Promise.all(FONT_SPECS.map((f) => document.fonts.load(f))).then(() => { fontsReady = true; }) : Promise.resolve());

  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function fillPip(g, suit, cx, cy, size, color) {
    g.save();
    g.translate(cx - size / 2, cy - size / 2);
    g.scale(size / 100, size / 100);
    g.fillStyle = color;
    for (const p of PATHS[suit]) g.fill(p);
    g.restore();
  }

  function paintCard(g, suit, rank, enh, s) {
    const S = SUITS[suit];
    const big = s >= 20;
    const m = big ? 1.2 : 0.6;
    const x = m, y = m, w = s - 2 * m, h = s - 2 * m - 0.8;
    const r = Math.max(1.5, s * 0.13);
    g.fillStyle = 'rgba(6,3,2,0.6)';
    rr(g, x + 0.4, y + 1.2, w, h, r); g.fill();
    g.fillStyle = S.edge;
    rr(g, x, y, w, h, r); g.fill();
    const e = big ? Math.max(2, s * 0.085) : 1.3;
    const fx = x + e, fy = y + e, fw = w - 2 * e, fh = h - 2 * e, fr = Math.max(1, r - e * 0.6);
    g.save();
    if (enh === 'glass') g.globalAlpha = 0.42;
    const grad = g.createLinearGradient(0, fy, 0, fy + fh);
    grad.addColorStop(0, W.shade(S.stock, 0.35));
    grad.addColorStop(1, W.shade(S.stock, -0.06));
    g.fillStyle = grad;
    rr(g, fx, fy, fw, fh, fr); g.fill();
    g.restore();
    if (enh === 'glass') {
      g.save();
      rr(g, fx, fy, fw, fh, fr); g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = big ? 1.6 : 1;
      g.beginPath(); g.moveTo(fx - 2, fy + fh * 0.55); g.lineTo(fx + fw * 0.55, fy - 2); g.stroke();
      g.lineWidth = big ? 0.9 : 0.6;
      g.beginPath(); g.moveTo(fx + fw * 0.2, fy + fh + 2); g.lineTo(fx + fw + 2, fy + fh * 0.2); g.stroke();
      g.restore();
    } else if (enh === 'gold') {
      g.strokeStyle = '#c99a34';
      g.lineWidth = big ? 1.4 : 1;
      rr(g, fx + 1.3, fy + 1.3, fw - 2.6, fh - 2.6, Math.max(1, fr - 1)); g.stroke();
      g.fillStyle = '#d9ad48';
      g.beginPath(); g.moveTo(fx + fw, fy + fh - s * 0.28); g.lineTo(fx + fw, fy + fh - fr); g.lineTo(fx + fw - s * 0.28, fy + fh); g.lineTo(fx + fw - fr, fy + fh); g.closePath(); g.fill();
    }
    if (big) {
      g.font = `700 ${Math.round(s * 0.36)}px "Libre Baskerville", Georgia, serif`;
      g.fillStyle = S.ink;
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.fillText(String(rank), fx + s * 0.04, fy + s * 0.01);
    }
    const ps = big ? s * 0.5 : s * 0.6;
    fillPip(g, suit, big ? x + w * 0.6 : s / 2, big ? y + h * 0.62 : s / 2 + 0.2, ps, S.ink);
    if (enh === 'bonus') {
      const cr = big ? s * 0.11 : s * 0.13, cx = fx + cr + (big ? 1.5 : 0.6), cy = fy + fh - cr - (big ? 1.5 : 0.6);
      drawChipFace(g, cx, cy, cr, CHIPS[0]);
    }
  }

  const CHIPS = [['#a3222a', '#efe4c8'], ['#17161a', '#efe4c8'], ['#ece2c8', '#8a1c24'], ['#24406a', '#efe4c8']];
  function drawChipFace(g, cx, cy, r, [base, spot]) {
    g.save();
    g.fillStyle = base;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = spot;
    g.lineWidth = r * 0.34;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath(); g.arc(cx, cy, r * 0.82, a - 0.22, a + 0.22); g.stroke();
    }
    g.lineWidth = Math.max(0.6, r * 0.08);
    g.setLineDash([r * 0.18, r * 0.14]);
    g.beginPath(); g.arc(cx, cy, r * 0.5, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  const spriteCache = new Map();
  function sprite(key, w, h, paint) {
    let c = spriteCache.get(key);
    if (c) return c;
    const dpr = window.devicePixelRatio || 1;
    c = mk(w * dpr, h * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    paint(g);
    if (spriteCache.size > 600) spriteCache.clear();
    spriteCache.set(key, c);
    return c;
  }
  const cardSprite = (suit, rank, enh, s) =>
    sprite(`c${suit}|${rank}|${enh || ''}|${s}|${window.devicePixelRatio || 1}|${fontsReady ? 1 : 0}`, s, s, (g) => paintCard(g, suit, rank, enh, s));
  const chipSprite = (i, r) => sprite(`chip${i}|${r}|${window.devicePixelRatio || 1}`, r * 2 + 2, r * 2 + 2, (g) => {
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.arc(r + 1, r + 1.6, r, 0, Math.PI * 2); g.fill();
    drawChipFace(g, r + 1, r + 1, r, CHIPS[i]);
  });
  // Chalk outline for the landing preview: two rough passes and a little dust.
  const chalkSprite = (s) => sprite(`chalk${s}|${window.devicePixelRatio || 1}`, s, s, (g) => {
    const r = W.rng(s * 131 + 7), i = s >= 20 ? 3 : 2, c = s * 0.16;
    const pts = [[i + c, i], [s - i - c, i], [s - i, i + c], [s - i, s - i - c], [s - i - c, s - i], [i + c, s - i], [i, s - i - c], [i, i + c]];
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      g.strokeStyle = pass ? 'rgba(240,234,218,0.35)' : 'rgba(240,234,218,0.7)';
      g.lineWidth = pass ? 0.8 : 1.3;
      g.beginPath();
      pts.forEach(([px, py], k) => {
        const [nx, ny] = pts[(k + 1) % pts.length];
        const steps = Math.max(1, Math.round(Math.hypot(nx - px, ny - py) / 3));
        for (let t = 0; t <= steps; t++) {
          const qx = px + ((nx - px) * t) / steps + (r() - 0.5) * 0.9, qy = py + ((ny - py) * t) / steps + (r() - 0.5) * 0.9;
          if (k === 0 && t === 0) g.moveTo(qx, qy); else g.lineTo(qx, qy);
        }
      });
      g.closePath();
      g.stroke();
    }
    g.fillStyle = 'rgba(240,234,218,0.4)';
    for (let k = 0; k < 6; k++) g.fillRect(i + r() * (s - 2 * i), s - i - 1 + r() * 2.5, 0.9, 0.9);
  });
  // Cigarette smoke: a soft clump of puffs, drawn faintly over the felt.
  let smokeC = null;
  function smokeSprite() {
    if (smokeC) return smokeC;
    smokeC = mk(220, 220);
    const g = smokeC.getContext('2d'), r = W.rng(42);
    for (let k = 0; k < 14; k++) {
      const x = 50 + r() * 120, y = 50 + r() * 120, rad = 26 + r() * 46;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(226,214,192,0.10)');
      gr.addColorStop(1, 'rgba(226,214,192,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 220, 220);
    }
    return smokeC;
  }

  // Green baize: twill weave + noise, a pool of lamplight, a vignette, faint seams on the card grid.
  function buildFelt(w, h, dpr, o = {}) {
    const c = mk(w * dpr, h * dpr), g = c.getContext('2d');
    g.fillStyle = '#1b462f';
    g.fillRect(0, 0, c.width, c.height);
    const img = g.getImageData(0, 0, c.width, c.height), d = img.data, r = W.rng(1940), cw = c.width;
    for (let i = 0, n = d.length / 4; i < n; i++) {
      const x = i % cw, y = (i / cw) | 0;
      const tw = ((x + y) & 3) < 2 ? 4 : -4;
      const v = (r() - 0.5) * 16 + tw;
      d[i * 4] += v * 0.55; d[i * 4 + 1] += v; d[i * 4 + 2] += v * 0.7;
    }
    g.putImageData(img, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lx = o.lampX == null ? w / 2 : o.lampX, ly = o.lampY == null ? h * 0.34 : o.lampY, lr = o.lampR || Math.max(w, h) * 0.6;
    const lamp = g.createRadialGradient(lx, ly, 0, lx, ly, lr);
    lamp.addColorStop(0, 'rgba(255,214,140,0.30)');
    lamp.addColorStop(0.45, 'rgba(255,196,120,0.12)');
    lamp.addColorStop(1, 'rgba(255,196,120,0)');
    g.fillStyle = lamp;
    g.fillRect(0, 0, w, h);
    const vg = g.createRadialGradient(lx, ly, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,8,5,0.72)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    if (o.cell) {
      const s = o.cell, ox = o.off || 0;
      g.fillStyle = 'rgba(0,0,0,0.16)';
      for (let x = ox + s; x < w - ox; x += s) g.fillRect(x - 0.5, ox, 1, h - 2 * ox);
      for (let y = ox + s; y < h - ox; y += s) g.fillRect(ox, y - 0.5, w - 2 * ox, 1);
      g.fillStyle = 'rgba(255,240,200,0.035)';
      for (let x = ox + s; x < w - ox; x += s) g.fillRect(x + 0.5, ox, 1, h - 2 * ox);
    }
    return c;
  }

  // Leather grain and felt swatches for the DOM (panels, frame, shop), as data URLs.
  let grainURL = null, feltURL = null;
  function textures() {
    if (!grainURL) {
      const c = mk(96, 96), g = c.getContext('2d'), img = g.createImageData(96, 96), d = img.data, r = W.rng(7);
      for (let i = 0; i < 96 * 96; i++) {
        const v = r();
        const dark = v < 0.5;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = dark ? 0 : 255;
        d[i * 4 + 3] = dark ? (0.5 - v) * 70 : (v - 0.5) * 22;
      }
      g.putImageData(img, 0, 0);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      for (let k = 0; k < 90; k++) { g.beginPath(); g.arc(r() * 96, r() * 96, 0.6 + r() * 1.4, 0, Math.PI * 2); g.fill(); }
      grainURL = c.toDataURL();
    }
    if (!feltURL) {
      const c = mk(128, 128), g = c.getContext('2d');
      g.fillStyle = '#1b462f';
      g.fillRect(0, 0, 128, 128);
      const img = g.getImageData(0, 0, 128, 128), d = img.data, r = W.rng(3);
      for (let i = 0; i < 128 * 128; i++) {
        const x = i % 128, y = (i / 128) | 0;
        const v = (r() - 0.5) * 16 + (((x + y) & 3) < 2 ? 4 : -4);
        d[i * 4] += v * 0.55; d[i * 4 + 1] += v; d[i * 4 + 2] += v * 0.7;
      }
      g.putImageData(img, 0, 0);
      feltURL = c.toDataURL();
    }
    return { grain: grainURL, felt: feltURL };
  }

  // The Dealer's portrait: fedora, shadowed face, lamplight on the brim, a cigarette.
  function drawDealer(g, w, h) {
    const bg = g.createRadialGradient(w * 0.5, -h * 0.15, 2, w * 0.5, h * 0.2, h * 1.05);
    bg.addColorStop(0, '#7a5530');
    bg.addColorStop(0.45, '#2c1b10');
    bg.addColorStop(1, '#0b0706');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // coat and shoulders
    g.fillStyle = '#0a0706';
    g.beginPath();
    g.moveTo(w * 0.02, h); g.quadraticCurveTo(w * 0.1, h * 0.72, w * 0.34, h * 0.68);
    g.lineTo(w * 0.66, h * 0.68); g.quadraticCurveTo(w * 0.9, h * 0.72, w * 0.98, h); g.closePath(); g.fill();
    // shirt and tie
    g.fillStyle = '#cdb994';
    g.beginPath(); g.moveTo(w * 0.42, h * 0.7); g.lineTo(w * 0.58, h * 0.7); g.lineTo(w * 0.5, h * 0.9); g.closePath(); g.fill();
    g.fillStyle = '#6e141b';
    g.beginPath(); g.moveTo(w * 0.48, h * 0.72); g.lineTo(w * 0.52, h * 0.72); g.lineTo(w * 0.535, h * 0.92); g.lineTo(w * 0.465, h * 0.92); g.closePath(); g.fill();
    // lapel rim light
    g.strokeStyle = 'rgba(226,170,96,0.35)';
    g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(w * 0.34, h * 0.69); g.lineTo(w * 0.46, h); g.moveTo(w * 0.66, h * 0.69); g.lineTo(w * 0.54, h); g.stroke();
    // face: mostly shadow, lamp catches the jaw
    g.fillStyle = '#1c130e';
    g.beginPath(); g.ellipse(w * 0.5, h * 0.52, w * 0.15, h * 0.19, 0, 0, Math.PI * 2); g.fill();
    g.save();
    g.beginPath(); g.ellipse(w * 0.5, h * 0.52, w * 0.15, h * 0.19, 0, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(214,156,92,0.55)';
    g.beginPath(); g.ellipse(w * 0.53, h * 0.68, w * 0.13, h * 0.09, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // hat: crown, band, brim
    g.fillStyle = '#100b09';
    g.beginPath();
    g.moveTo(w * 0.31, h * 0.4); g.lineTo(w * 0.35, h * 0.16); g.quadraticCurveTo(w * 0.5, h * 0.06, w * 0.65, h * 0.16);
    g.lineTo(w * 0.69, h * 0.4); g.closePath(); g.fill();
    g.fillStyle = '#5b1117';
    g.fillRect(w * 0.32, h * 0.32, w * 0.36, h * 0.07);
    g.fillStyle = '#0d0908';
    g.beginPath(); g.ellipse(w * 0.5, h * 0.41, w * 0.36, h * 0.075, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(240,196,120,0.75)';
    g.lineWidth = 1;
    g.beginPath(); g.ellipse(w * 0.5, h * 0.41, w * 0.36, h * 0.075, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.strokeStyle = 'rgba(240,196,120,0.4)';
    g.beginPath(); g.moveTo(w * 0.36, h * 0.17); g.quadraticCurveTo(w * 0.5, h * 0.07, w * 0.64, h * 0.17); g.stroke();
    // cigarette
    g.strokeStyle = '#e9dcc0';
    g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(w * 0.56, h * 0.63); g.lineTo(w * 0.76, h * 0.6); g.stroke();
  }

  function drawPokerChipStamp(g, cx, cy, r, text, rot) {
    g.save();
    g.translate(cx, cy);
    g.rotate(rot || 0);
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath(); g.arc(1.5, 2.5, r, 0, Math.PI * 2); g.fill();
    drawChipFace(g, 0, 0, r, CHIPS[0]);
    g.fillStyle = '#a3222a';
    g.beginPath(); g.arc(0, 0, r * 0.56, 0, Math.PI * 2); g.fill();
    g.font = `400 ${Math.round(r * 0.62)}px "Limelight", Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#f3e7cb';
    g.fillText(text, 0, r * 0.04);
    g.restore();
  }

  // Hub card key art: a corner of the table under the lamp.
  function art(ctx, w, h) {
    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.drawImage(buildFelt(w, h, dpr, { lampX: w * 0.45, lampY: h * 0.2, lampR: w * 0.7 }), 0, 0, w, h);
      const s = 20, x0 = 26, base = h - s - 7;
      const rows = [
        [[1, 5], [1, 7], [1, 3], [1, 6], [1, 4], [1, 8], [1, 2]],
        [[0, 4], [0, 4], [3, 6], null, [2, 5], [2, 5], [2, 3]],
        [null, [0, 7], null, null, null, [2, 6], null],
      ];
      rows.forEach((row, ry) => row.forEach((c, cx) => { if (c) ctx.drawImage(cardSprite(c[0], c[1], ry === 0 && cx === 5 ? 'gold' : null, s), x0 + cx * s, base - ry * s, s, s); }));
      // the falling J piece and its chalk ghost in the gap it will fill
      [[3, 0], [3, 1], [2, 1]].forEach(([cx, cy]) => ctx.drawImage(cardSprite(3, 5, null, s), x0 + cx * s, 4 + cy * s, s, s));
      [[3, 1], [3, 2], [2, 2]].forEach(([cx, ry]) => ctx.drawImage(chalkSprite(s), x0 + cx * s, base - ry * s, s, s));
      // brass sweep across the bottom (paying) row
      const gr = ctx.createLinearGradient(x0, 0, x0 + 7 * s, 0);
      gr.addColorStop(0, 'rgba(255,226,160,0)');
      gr.addColorStop(0.7, 'rgba(255,226,160,0.32)');
      gr.addColorStop(0.85, 'rgba(255,244,214,0.6)');
      gr.addColorStop(1, 'rgba(255,226,160,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x0, base, 7 * s, s - 1);
      // chip stacks, side on, with a face on top
      const stacks = [[212, 5, 0], [240, 8, 1], [266, 3, 2]];
      for (const [sx, n, ci] of stacks) {
        const [base0, spot] = CHIPS[ci];
        for (let k = 0; k < n; k++) {
          const y = h - 12 - k * 5;
          ctx.fillStyle = base0;
          rr(ctx, sx - 11, y - 2.5, 22, 5, 2); ctx.fill();
          ctx.fillStyle = spot;
          for (let t = 0; t < 3; t++) ctx.fillRect(sx - 9 + t * 7.5 + (k % 2) * 3, y - 1.5, 2.6, 3);
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(sx - 11, y + 2.1, 22, 0.8);
        }
        ctx.save();
        ctx.translate(sx, h - 12 - n * 5 + 2);
        ctx.scale(1, 0.38);
        drawChipFace(ctx, 0, 0, 11, CHIPS[ci]);
        ctx.restore();
      }
      drawPokerChipStamp(ctx, 236, 40, 25, '×8', -0.16);
      ctx.globalAlpha = 0.8;
      ctx.drawImage(smokeSprite(), 90, -70, 200, 200);
      ctx.restore();
    };
    paint();
    if (!fontsReady) fontsLoaded().then(paint);
  }

  // ---------- the game ----------
  function mount(sh) {
    const rng = W.rng();
    let run;
    const board = new W.Board(10, 20);
    const timers = new Set();
    const after = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    sh.own(() => timers.forEach(clearTimeout));

    const tx = textures();
    const docEl = document.documentElement;
    docEl.style.setProperty('--sj-grain', `url(${tx.grain})`);
    docEl.style.setProperty('--sj-felt', `url(${tx.felt})`);
    sh.own(() => { docEl.style.removeProperty('--sj-grain'); docEl.style.removeProperty('--sj-felt'); });

    // ----- sound: card snaps, felt thuds, chip clacks, an upright bass -----
    const snap = (freq, vol) => W.noise({ dur: 0.028, vol, filter: 'highpass', freq, q: 0.7 });
    const clack = (i = 0, at = 0, vol = 0.07) => {
      const f = 3300 + i * 140 + Math.random() * 300;
      W.noise({ dur: 0.03, vol, filter: 'bandpass', freq: f, q: 7, at });
      W.tone({ f: f * 0.72, dur: 0.025, type: 'sine', vol: vol * 0.18, at });
    };
    const thud = (vol = 0.12, at = 0) => {
      W.noise({ dur: 0.11, vol, filter: 'lowpass', freq: 360, q: 0.8, at });
      W.tone({ f: 96, f2: 56, dur: 0.1, type: 'sine', vol: vol * 0.5, at });
    };
    const bass = (f, at = 0, vol = 0.11, dur = 0.9) => {
      W.tone({ f: f * 1.025, f2: f, dur, type: 'sine', vol, at, attack: 0.008 });
      W.tone({ f: f * 2, dur: dur * 0.55, type: 'triangle', vol: vol * 0.45, at, attack: 0.006 });
      W.noise({ dur: 0.045, vol: vol * 0.45, filter: 'lowpass', freq: 900, at });
    };
    W.voice = {
      move: () => snap(3800, 0.035),
      rotate: () => { snap(2400, 0.05); W.noise({ dur: 0.018, vol: 0.025, filter: 'bandpass', freq: 5200, q: 3, at: 0.018 }); },
      drop: () => W.noise({ dur: 0.07, vol: 0.035, filter: 'bandpass', freq: 2400, freq2: 700, q: 1.2 }),
      lock: () => thud(0.11),
      clear: null,
      big: null,
      buy: () => { clack(0, 0, 0.06); clack(3, 0.06, 0.06); },
      coin: () => clack(6, 0, 0.05),
      tick: () => snap(6000, 0.012),
      bad: () => { bass(41.2, 0, 0.12, 1.2); bass(43.65, 0.12, 0.08, 1.1); },
      win: () => { [55, 69.3, 82.4, 110].forEach((f, i) => bass(f, i * 0.15, 0.09, 0.6)); },
      hit: null,
    };

    // ----- the felt -----
    let feltCache = null, feltKey = '';
    const M = 14; // margin so screen shake never shows an edge
    function paintFelt(ctx, Wd, H, s) {
      const dpr = view.dpr || 1, key = `${Wd}|${H}|${s}|${dpr}`;
      if (key !== feltKey) { feltKey = key; feltCache = buildFelt(Wd + 2 * M, H + 2 * M, dpr, { cell: s, off: M, lampY: M + H * 0.34, lampR: H * 0.62 }); }
      ctx.drawImage(feltCache, -M, -M, Wd + 2 * M, H + 2 * M);
    }
    let shadeCache = null, shadeKey = '';
    const SMOKE = [
      { x: 0.15, y: 0.3, vx: 0.011, vy: -0.004, sc: 1.2, a: 0.6, ph: 0 },
      { x: 0.75, y: 0.62, vx: -0.008, vy: -0.006, sc: 1.5, a: 0.5, ph: 2 },
      { x: 0.42, y: 0.95, vx: 0.006, vy: -0.009, sc: 1.1, a: 0.45, ph: 4 },
    ];
    function paintAir(ctx) {
      const Wd = view.W, H = view.H, dpr = view.dpr || 1, key = `${Wd}|${H}|${dpr}`;
      if (key !== shadeKey) {
        shadeKey = key;
        shadeCache = mk(Wd * dpr, H * dpr);
        const g = shadeCache.getContext('2d');
        g.scale(dpr, dpr);
        const vg = g.createRadialGradient(Wd / 2, H * 0.34, H * 0.3, Wd / 2, H * 0.5, H * 0.78);
        vg.addColorStop(0, 'rgba(10,5,3,0)');
        vg.addColorStop(1, 'rgba(10,5,3,0.34)');
        g.fillStyle = vg;
        g.fillRect(0, 0, Wd, H);
      }
      ctx.drawImage(shadeCache, 0, 0, Wd, H);
      const t = performance.now() / 1000, sm = smokeSprite();
      const wrap = (v) => ((v % 1.5) + 1.5) % 1.5 - 0.25;
      for (const p of SMOKE) {
        const px = wrap(p.x + p.vx * t) * Wd, py = wrap(p.y + p.vy * t) * H, sz = Wd * p.sc;
        ctx.globalAlpha = p.a * (0.75 + 0.25 * Math.sin(t * 0.35 + p.ph));
        ctx.drawImage(sm, px - sz / 2, py - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    }
    function drawCard(ctx, b, px, py, s, x, y, o) {
      if (o && o.ghost) { ctx.drawImage(chalkSprite(s), px, py, s, s); return; }
      if (b.suit == null) { ctx.fillStyle = '#3a2a22'; ctx.fillRect(px + 1, py + 1, s - 2, s - 2); return; }
      ctx.drawImage(cardSprite(b.suit, b.rank, b.enh, s), px, py, s, s);
    }
    // A clear: the rows warm under the lamp while a brass sweep runs across them, the dealer's hand raking it in.
    function sweep(ctx, rows, k, s, Wd) {
      const p = 1 - k;
      for (const y of rows) {
        ctx.fillStyle = `rgba(255,222,150,${0.1 + 0.3 * k})`;
        ctx.fillRect(0, y * s, Wd, s);
        const x = p * (Wd + s * 4) - s * 2;
        const g = ctx.createLinearGradient(x - s * 2, 0, x + s * 0.6, 0);
        g.addColorStop(0, 'rgba(255,226,160,0)');
        g.addColorStop(0.8, 'rgba(255,240,205,0.8)');
        g.addColorStop(1, 'rgba(255,226,160,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, y * s, Wd, s);
      }
    }
    function drawParticle(ctx, f, s) {
      if (f.chip) {
        ctx.globalAlpha = Math.min(1, f.life / 260);
        const r = Math.round(s * 0.3), sp = chipSprite(f.ci, r);
        const flip = Math.max(0.18, Math.abs(Math.cos(f.life * 0.009 + f.seed)));
        ctx.translate(f.x * s, f.y * s);
        ctx.rotate(f.seed);
        ctx.scale(1, flip);
        ctx.drawImage(sp, -r - 1, -r - 1, r * 2 + 2, r * 2 + 2);
        return;
      }
      // torn card stock
      ctx.translate(f.x * s, f.y * s);
      ctx.rotate(f.life * 0.012 + f.x);
      ctx.fillStyle = f.color;
      ctx.fillRect(-f.size * 0.6 - 1, -f.size * 0.8 - 1, f.size * 1.2 + 2, f.size * 1.6 + 2);
      ctx.fillStyle = '#f1e6cc';
      ctx.fillRect(-f.size * 0.6, -f.size * 0.8, f.size * 1.2, f.size * 1.6);
    }

    const view = new W.BoardView(sh.canvas, board, {
      grid: false,
      background: paintFelt,
      drawBlock: drawCard,
      overlay: paintAir,
      clearFlash: sweep,
      drawParticle,
      textFont: '"Libre Baskerville", Georgia, serif',
      textStroke: '#1a0b07',
      textWeight: 700,
    });
    fontsLoaded().then(() => { paintQueue(); });

    function rainChips(n) {
      for (let i = 0; i < n; i++) {
        view.fx.push({ chip: true, ci: Math.random() < 0.5 ? 0 : (Math.random() * 4) | 0, x: Math.random() * board.w, y: -0.5 - Math.random() * 6,
          vx: (Math.random() - 0.5) * 1.4, vy: 1 + Math.random() * 3, life: 1800 + Math.random() * 600, max: 2400, seed: Math.random() * 6.28, size: 0, color: '#fff' });
      }
      for (let i = 0; i < Math.min(10, n / 3); i++) clack(i % 5, 0.35 + Math.random() * 0.9, 0.035);
    }

    // ----- the Dealer -----
    const dealer = W.el('div', 'sj-dealer');
    dealer.innerHTML = '<div class="sj-face"><canvas></canvas><i class="sj-ember"></i></div><div class="sj-say"><span class="sj-who">The Dealer</span><span class="sj-line" aria-hidden="true"></span><span class="sj-sr" aria-live="polite"></span></div>';
    sh.boardCol.prepend(dealer);
    dealer.style.width = view.W + 26 + 'px';
    {
      const cv = dealer.querySelector('canvas'), dpr = window.devicePixelRatio || 1;
      cv.width = 44 * dpr; cv.height = 44 * dpr;
      const g = cv.getContext('2d'); g.scale(dpr, dpr);
      drawDealer(g, 44, 44);
    }
    const lineEl = dealer.querySelector('.sj-line'), srEl = dealer.querySelector('.sj-sr');
    let lineFull = '', lineShown = 0, lineT = 0, lineAt = -1e9;
    function say(text, force) {
      const now = performance.now();
      if (!force && now - lineAt < 4500) return;
      lineAt = now;
      lineFull = text;
      lineShown = 0;
      lineT = 0;
      lineEl.textContent = '';
      srEl.textContent = text;
      dealer.classList.remove('talk');
      void dealer.offsetWidth;
      dealer.classList.add('talk');
    }

    // ----- side panels -----
    const qh = sh.root.querySelectorAll('.queue-panel h3');
    if (qh[0]) qh[0].textContent = 'On deck';
    if (qh[1]) qh[1].textContent = 'Sleeve';
    const logH = sh.root.querySelector('.log-panel h3');
    if (logH) logH.textContent = 'The book';

    const countPanel = W.el('div', 'panel sj-count');
    countPanel.innerHTML = `<h3>The count</h3>
      <div class="sj-hands">No hand yet</div>
      <div class="sj-eq"><span class="sj-chips">0</span><span class="sj-x">×</span><span class="sj-mult wait"><b></b></span><span class="sj-x">=</span><span class="sj-total">0</span></div>
      <div class="sj-notes"></div>`;
    const regPanel = W.el('div', 'panel sj-regulars');
    sh.extra.append(countPanel, regPanel);
    const handsEl = countPanel.querySelector('.sj-hands'), chipsEl = countPanel.querySelector('.sj-chips');
    const multEl = countPanel.querySelector('.sj-mult'), multB = multEl.querySelector('b');
    const totalEl = countPanel.querySelector('.sj-total'), notesEl = countPanel.querySelector('.sj-notes');
    const HINT = '<p class="sj-hint">Fill a row. Fewer suits, fatter mult: Flush +8, Duo +4, Trio +2, Rainbow +1. Chips are the ranks.</p>';
    const fmtMult = (m) => String(+m.toFixed(2));

    let pile = [], queue = [], roundScore = 0, piecesLeft = 0, last = null, roundOver = false, winPending = false;
    let shown = 0, lastHoles = 0, warnedHigh = false, scoreNode = null, railNode = null;
    let tally = null;
    const CH = 460, ST = 520, LAND = 200, TO = 780, TD = 380;
    const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

    function resetCount() {
      tally = null;
      handsEl.textContent = 'No hand yet';
      chipsEl.textContent = '0';
      multEl.className = 'sj-mult wait';
      multB.textContent = '';
      totalEl.textContent = '0';
      totalEl.classList.remove('pop');
      notesEl.innerHTML = HINT;
    }
    function startTally(l, base) {
      tally = { l, base, t: 0, clacks: 0, n: Math.min(9, 3 + l.rows * 2), stamped: false, landed: false, popped: false };
      handsEl.innerHTML = l.hands.map((h) => `<span>${h}</span>`).join('<i>·</i>');
      chipsEl.textContent = '0';
      multEl.className = 'sj-mult wait';
      multB.textContent = '';
      totalEl.textContent = '';
      totalEl.classList.remove('pop');
      notesEl.innerHTML = l.notes.length ? `<div class="chips">${l.notes.map((n) => `<span class="chip accent">${W.esc(n)}</span>`).join('')}</div>` : '';
    }
    function stepTally(dt) {
      const T = tally;
      if (!T) return;
      T.t += dt;
      const k = T.t / CH;
      chipsEl.textContent = Math.round(T.l.chips * ease(k)).toLocaleString();
      while (T.clacks < T.n && T.t >= (T.clacks / T.n) * CH) { clack(T.clacks, 0, 0.06); T.clacks++; }
      if (!T.stamped && T.t >= ST) {
        T.stamped = true;
        const mt = '×' + fmtMult(T.l.mult);
        multB.textContent = mt;
        multB.style.fontSize = (mt.length <= 3 ? 18 : mt.length === 4 ? 15 : mt.length === 5 ? 13 : 11) + 'px';
        multEl.className = 'sj-mult';
        void multEl.offsetWidth;
        multEl.className = 'sj-mult stamp';
      }
      if (!T.landed && T.t >= ST + LAND) {
        T.landed = true;
        thud(0.16);
        W.tone({ f: 70, f2: 44, dur: 0.16, type: 'sine', vol: 0.09 });
        countPanel.classList.remove('thud');
        void countPanel.offsetWidth;
        countPanel.classList.add('thud');
      }
      if (T.t >= TO) {
        const e = ease((T.t - TO) / TD);
        totalEl.textContent = Math.round(T.l.total * e).toLocaleString();
        shown = T.base + T.l.total * e;
        updateScore();
      }
      if (!T.popped && T.t >= TO + TD) {
        T.popped = true;
        totalEl.classList.add('pop');
        shown = roundScore;
        updateScore();
        tally = null;
      }
    }
    function updateScore() {
      const t = target(run.round);
      if (scoreNode) scoreNode.textContent = Math.round(shown).toLocaleString();
      if (railNode) railNode.style.width = Math.min(100, (shown / t) * 100) + '%';
    }

    const st = new W.Stacker(board, {
      gravity: 800,
      next() {
        while (queue.length < 4) queue.push(drawFromDeck());
        piecesLeft--;
        const c = queue.shift();
        queue.push(drawFromDeck());
        st.lastCard = c;
        paintQueue();
        return toPiece(c);
      },
      onLock(cells, p) { st.lastType = p.type; },
      onClear(rows, rowBlocks) { scoreClear(rows, rowBlocks); },
      afterClear() { paint(); },
      beforeSpawn() {
        const cleared = st.lastClearPiece === st.pieces;
        if (!st.clearing && !cleared) run.combo = 0;
        const holes = board.holes();
        if (!cleared && holes - lastHoles >= 2) { say(pick(LINES.bad)); bass(49, 0, 0.06, 0.5); }
        lastHoles = holes;
        if (!warnedHigh && board.stackHeight() >= 15) { warnedHigh = true; say(pick(LINES.high), true); }
        paint();
        if (roundScore >= target(run.round)) {
          if (!winPending) { winPending = true; after(tally ? Math.max(700, TO + TD - tally.t + 750) : 700, winRound); }
          return false;
        }
        if (piecesLeft <= 0) { loseRun('dry'); return false; }
        return true;
      },
      onHold() { paintQueue(); },
      onTopOut() { loseRun('top'); },
    });
    sh.stackerKeys(st, {}, { downStart: () => (st.soft = true), downEnd: () => (st.soft = false) });
    sh.pad({ left: () => st.move(-1), right: () => st.move(1), down: () => st.softDrop(), rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), hold: () => st.hold() },
      [['◀', 'left', true], ['⟲', 'rotCCW'], ['⟳', 'rotCW'], ['▶', 'right', true], ['▼', 'down', true], ['⤓', 'drop'], ['Sleeve', 'hold']]);

    function drawFromDeck() {
      if (!pile.length) pile = rng.shuffle(run.deck.slice());
      return pile.pop();
    }

    function scoreClear(rows, rowBlocks) {
      const c = { chips: 0, mult: 0, rows: [], notes: [], run, lockType: st.lastType, holes: 0, height: 0 };
      run.combo++;
      st.lastClearPiece = st.pieces;
      let glass = 0, gold = 0;
      rowBlocks.forEach((blocks) => {
        let k = new Set(blocks.map((b) => b.suit)).size;
        for (const j of run.jokers) if (j.hand) k = j.hand(k);
        const hand = HANDS[k];
        const r = { hand, blocks };
        c.rows.push(r);
        c.chips += hand.chips + blocks.reduce((a, b) => a + b.rank, 0);
        c.mult += hand.mult;
        for (const b of blocks) {
          if (b.enh === 'bonus') c.chips += 25;
          if (b.enh === 'gold') gold++;
          if (b.enh === 'glass') glass++;
        }
        for (const j of run.jokers) if (j.row) j.row(c, r);
      });
      // Stack shape after the clear, for regulars that read it.
      const afterB = new W.Board(board.w, board.h);
      afterB.cells = board.cells.map((r) => r.slice());
      afterB.removeRows(rows);
      c.holes = afterB.holes();
      c.height = afterB.stackHeight();
      c.mult *= LINE_X[Math.min(4, rows.length)];
      if (rows.length > 1) c.notes.push(`${rows.length} rows ×${LINE_X[Math.min(4, rows.length)]}`);
      for (const j of run.jokers) if (j.final) j.final(c);
      let broke = false;
      if (glass) {
        c.mult *= 1.5 ** glass;
        c.notes.push(`Glass ×${(1.5 ** glass).toFixed(2)}`);
        // each glass card can break once per clear
        const ids = new Set();
        rowBlocks.flat().forEach((b) => { if (b.enh === 'glass') ids.add(b.cardId); });
        ids.forEach((id) => {
          if (rng.chance(0.25) && run.deck.length > 6) {
            run.deck = run.deck.filter((d) => d.id !== id);
            pile = pile.filter((d) => d.id !== id);
            sh.toast('A glass card broke', 'bad');
            broke = true;
          }
        });
      }
      if (gold) { run.money += gold; c.notes.push(`Gilt +$${gold}`); W.sfx('coin'); }
      const total = Math.floor(c.chips * c.mult);
      roundScore += total;
      const flushes = c.rows.filter((r) => r.hand.name === 'Flush').length;
      last = { chips: c.chips, mult: c.mult, total, rows: rows.length, hands: c.rows.map((r) => r.hand.name), notes: c.notes };
      startTally(last, roundScore - total);
      const big = rows.length >= 3 || total >= target(run.round) * 0.3 || (flushes && rows.length >= 2);
      for (const y of rows) for (let x = 0; x < board.w; x++) {
        const b = board.cells[y][x];
        if (b && Math.random() < 0.55) view.burst(x + 0.5, y + 0.5, SUITS[b.suit] ? SUITS[b.suit].edge : '#888', 1, 4);
      }
      const top = Math.min(...rows);
      if (flushes) view.float(flushes > 1 ? `${flushes} Flushes` : 'Flush', board.w / 2, top - 0.5, '#efe4c8', 16);
      view.float(`+${total.toLocaleString()}`, board.w / 2, top + 0.5, '#f2cf78', big ? 32 : 22);
      if (rows.length >= 2 || big) rainChips(rows.length >= 4 ? 46 : rows.length === 3 ? 30 : big ? 20 : 10);
      if (big) {
        view.shake(rows.length >= 4 ? 14 : 9);
        if (st.clearing) { st.clearing.t += 280; st.clearing.total += 280; }
        say(pick(flushes ? LINES.flush.concat(LINES.big) : LINES.big), true);
      } else if (broke) say(LINES.shatter, true);
      else if (flushes) say(pick(LINES.flush));
      sh.log(`<b>${total.toLocaleString()}</b> · ${last.hands.join(' + ')}${c.notes.length ? ' · ' + W.esc(c.notes.join(', ')) : ''}`);
      paint();
    }

    function paintQueue() {
      if (!run) return;
      sh.setQueue(queue.slice(0, 3).map(toPiece), { drawBlock: drawCard });
      sh.setHold(st.holdPiece, { drawBlock: drawCard });
    }

    function paint() {
      const t = target(run.round);
      const covered = roundScore >= t;
      sh.hud([
        { label: 'Table', value: run.round + 1 },
        { label: 'Bankroll', value: '$' + run.money, tone: 'accent' },
        { label: 'The take', html: `<span class="sj-score">${Math.round(shown).toLocaleString()}</span> <small>of ${t.toLocaleString()}</small><span class="sj-rail"><i></i></span>`, tone: covered ? 'good' : '', wide: true },
        { label: 'Cards to deal', value: Math.max(0, piecesLeft), tone: piecesLeft <= 6 ? 'bad' : '' },
        { label: 'Deck', value: run.deck.length + ' cards' },
      ]);
      scoreNode = sh.hudEl.querySelector('.sj-score');
      railNode = sh.hudEl.querySelector('.sj-rail i');
      updateScore();
      regPanel.innerHTML = `<h3>Regulars <span class="sj-seats">${run.jokers.length} of ${MAX_JOKERS} seats</span></h3>` + (run.jokers.length
        ? `<ul class="sj-regs">${run.jokers.map((j) => `<li title="${W.esc(plainDesc(j.desc))}"><b>${W.esc(j.name)}</b><span>${fmtDesc(j.desc)}</span></li>`).join('')}</ul>`
        : '<p class="sj-hint">Empty chairs. Hire in the back room between tables.</p>');
    }

    function startRound() {
      board.clear();
      st.reset();
      st.o.gravity = Math.max(260, 800 - run.round * 70);
      roundScore = 0;
      shown = 0;
      piecesLeft = PIECES_PER_ROUND;
      last = null;
      roundOver = false;
      winPending = false;
      warnedHigh = false;
      lastHoles = 0;
      run.combo = 0;
      pile = rng.shuffle(run.deck.slice());
      queue = [];
      while (queue.length < 4) queue.push(drawFromDeck());
      resetCount();
      st.spawn();
      paint();
      paintQueue();
      bass(55, 0.02, 0.13, 1.1);
      const tt = target(run.round).toLocaleString();
      say(run.round === 0 ? LINES.first(tt) : pick(LINES.round)(tt), true);
    }

    function winRound() {
      if (roundOver) return;
      roundOver = true;
      winPending = false;
      const interest = Math.min(5, Math.floor(run.money / 5));
      const spare = Math.floor(Math.max(0, piecesLeft) / 4);
      const earned = 4 + interest + spare;
      run.money += earned;
      W.sfx('win');
      say(pick(LINES.win), true);
      sh.log(`Table ${run.round + 1} covered · <b>+$${earned}</b>`);
      run.round++;
      paint();
      openShop(`The house pays $4. $${spare} for ${Math.max(0, piecesLeft)} cards left in the shoe. $${interest} interest.`);
    }

    function loseRun(why) {
      if (roundOver) return;
      roundOver = true;
      st.paused = true;
      paint();
      const line = pick(why === 'top' ? LINES.topout : LINES.dry);
      if (why !== 'top') W.sfx('bad');
      say(line, true);
      sh.overlay({
        title: 'The table\'s closed',
        body: `<p class="sj-quote">“${line}”</p>
          <p>${why === 'top' ? 'Stacked to the ceiling' : 'The shoe ran dry'} at table ${run.round + 1}, holding ${roundScore.toLocaleString()} of ${target(run.round).toLocaleString()}.</p>
          <p>Regulars: ${run.jokers.map((j) => W.esc(j.name)).join(', ') || 'nobody'}.</p>`,
        button: 'Another night',
      }).then(newRun);
    }

    function shopOffers() {
      const owned = new Set(run.jokers.map((j) => j.id));
      const jokers = rng.shuffle(JOKERS.filter((j) => !owned.has(j.id))).slice(0, 3);
      const cards = [0, 1, 2].map(() => {
        const enh = rng.chance(0.45) ? rng.pick(Object.keys(ENH)) : null;
        const c = card(rng.pick(W.TYPES), rng.int(4), rng.range(3, 8), enh);
        c.cost = 2 + (enh ? 2 : 0) + (c.rank >= 6 ? 1 : 0);
        return c;
      });
      return { jokers, cards };
    }

    const cardName = (c) => `<span class="sj-cn">${pipSVG(c.suit, 13)}<b>${c.rank}</b> of ${SUITS[c.suit].name}</span>`;
    const tilt = (i) => `--tilt:${[-1.6, 0.8, -0.6, 1.4][i % 4]}deg`;

    function openShop(intro) {
      let offers = shopOffers(), reroll = 1, removing = false, quote = pick(LINES.shop);
      const body = W.el('div', 'sj-shop');
      const render = () => {
        body.innerHTML = `<p class="sj-quote">“${quote}”</p>
          <p class="sj-paid">${intro}</p>
          <div class="sj-bar"><span class="sj-bank">$${run.money}</span>
          <button class="btn small" type="button" data-act="reroll"${run.money < reroll ? ' disabled' : ''}>New faces · $${reroll}</button>
          <button class="btn small" type="button" data-act="remove"${!removing && (run.money < 2 || run.deck.length <= 6) ? ' disabled' : ''}>${removing ? 'Keep them all' : 'Burn a card · $2'}</button></div>`;
        if (removing) {
          const h = W.el('h4', '', 'Which card goes in the ashtray?');
          const grid = W.el('div', 'tiles');
          run.deck.forEach((c, i) => {
            const t = W.el('button', 'tile sj-cardtile');
            t.type = 'button';
            t.style.cssText = tilt(i);
            const sw = W.el('span', 'sj-swatch');
            sw.appendChild(W.mini(toPiece(c), 14, { drawBlock: drawCard }));
            t.appendChild(sw);
            t.insertAdjacentHTML('beforeend', `<span class="t-name">${cardName(c)}</span><span class="t-desc">${c.type} piece${c.enh ? ' · ' + ENH[c.enh].name : ''}</span>`);
            t.addEventListener('click', () => {
              run.money -= 2;
              run.deck = run.deck.filter((d) => d.id !== c.id);
              removing = false;
              W.sfx('buy');
              W.noise({ dur: 0.35, vol: 0.04, filter: 'bandpass', freq: 1800, freq2: 500, q: 0.8 });
              render();
              paint();
            });
            grid.appendChild(t);
          });
          body.append(h, grid);
          return;
        }
        const h1 = W.el('h4', '', `Regulars for hire <span>${run.jokers.length} of ${MAX_JOKERS} seats taken</span>`);
        const g1 = W.el('div', 'tiles');
        offers.jokers.forEach((j, i) => {
          const su = jokerSuit(j);
          const t = W.el('button', 'tile sj-regtile', `<span class="sj-idx">J${pipSVG(su, 12)}</span><span class="t-name">${W.esc(j.name)}</span><span class="t-flav">${W.esc(j.flav)}</span><span class="t-desc">${fmtDesc(j.desc)}</span><span class="t-cost">$${j.cost}</span>`);
          t.type = 'button';
          t.style.cssText = tilt(i);
          t.disabled = run.money < j.cost || run.jokers.length >= MAX_JOKERS;
          t.addEventListener('click', () => { run.money -= j.cost; run.jokers.push(j); offers.jokers.splice(i, 1); quote = pick(LINES.hire); W.sfx('buy'); render(); paint(); });
          g1.appendChild(t);
        });
        if (!offers.jokers.length) g1.innerHTML = '<p class="sj-hint">Nobody left at the bar.</p>';
        const h2 = W.el('h4', '', 'Cards on the table <span>added to your deck</span>');
        const g2 = W.el('div', 'tiles');
        offers.cards.forEach((c, i) => {
          const t = W.el('button', 'tile sj-cardtile');
          t.type = 'button';
          t.style.cssText = tilt(i + 1);
          const sw = W.el('span', 'sj-swatch');
          sw.appendChild(W.mini(toPiece(c), 16, { drawBlock: drawCard }));
          t.appendChild(sw);
          t.insertAdjacentHTML('beforeend', `<span class="t-name">${cardName(c)}</span><span class="t-desc">${c.type} piece${c.enh ? ` · <b>${ENH[c.enh].name}.</b> ${ENH[c.enh].desc}` : ''}</span><span class="t-cost">$${c.cost}</span>`);
          t.disabled = run.money < c.cost;
          t.addEventListener('click', () => { run.money -= c.cost; run.deck.push(c); offers.cards.splice(i, 1); W.sfx('buy'); render(); paint(); });
          g2.appendChild(t);
        });
        if (!offers.cards.length) g2.innerHTML = '<p class="sj-hint">Table\'s bare.</p>';
        body.append(h1, g1, h2, g2);
        if (run.jokers.length) {
          const h3 = W.el('h4', '', 'Let one go <span>half the fee back</span>');
          const g3 = W.el('div', 'chips');
          run.jokers.forEach((j, i) => {
            const b = W.el('button', 'btn small', `${W.esc(j.name)} · +$${Math.floor(j.cost / 2)}`);
            b.type = 'button';
            b.addEventListener('click', () => { run.money += Math.floor(j.cost / 2); run.jokers.splice(i, 1); W.sfx('coin'); render(); paint(); });
            g3.appendChild(b);
          });
          body.append(h3, g3);
        }
      };
      body.addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'reroll') { run.money -= reroll; reroll++; offers = shopOffers(); W.sfx('buy'); }
        if (a.dataset.act === 'remove') removing = !removing;
        render();
        paint();
      });
      render();
      sh.modal({
        title: 'The back room',
        body,
        wide: true,
        actions: [{ label: `Back to the table · cover ${target(run.round).toLocaleString()}`, primary: true, onClick: startRound }],
      });
    }

    function newRun() {
      run = { round: 0, money: 4, deck: startDeck(rng), jokers: [], combo: 0 };
      sh.logEl.innerHTML = '';
      startRound();
    }

    sh.debug = { board, st, view, getRun: () => run, winRound };
    sh.loop((dt) => {
      st.update(dt);
      view.update(dt);
      view.draw(st);
      stepTally(dt);
      if (lineShown < lineFull.length) {
        lineT += dt;
        const n = Math.min(lineFull.length, Math.floor(lineT / 24));
        if (n !== lineShown) { lineShown = n; lineEl.textContent = lineFull.slice(0, n); }
      }
    });

    run = { round: 0, money: 4, deck: startDeck(rng), jokers: [], combo: 0 };
    resetCount();
    paint();
    view.draw(st);
    say('Sit down. Cards fall, you stack them.', true);
    sh.overlay({
      title: 'Stackjack',
      body: `<p class="sj-quote">“A full row is a hand. Hands get paid. Don't ask me how much until I've counted.”</p>
        <div class="sj-legend">${SUITS.map((S, i) => `<span>${pipSVG(i, 16)}${S.name}</span>`).join('')}</div>
        <ul><li>Every piece is a card with a suit and a rank.</li>
        <li>Fewer suits in a row pay a fatter mult: <b>Flush</b> +8, <b>Duo</b> +4, <b>Trio</b> +2, <b>Rainbow</b> +1.</li>
        <li>Chips are the ranks in the row. You're paid chips × mult. Clear rows together and the mult multiplies.</li>
        <li>Cover the house's number in ${PIECES_PER_ROUND} cards. Then the back room opens: hire regulars, buy cards, burn the dead ones.</li></ul>`,
      button: 'Deal me in',
    }).then(newRun);
  }

  function startDeck(rng) {
    const deck = [];
    const suits = rng.shuffle([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1]);
    W.TYPES.concat(W.TYPES).forEach((t, i) => deck.push(card(t, suits[i], rng.range(2, 5))));
    return deck;
  }

  W.register({
    id: 'stackjack',
    num: 1,
    title: 'Stackjack',
    mix: 'Balatro × falling blocks',
    pitch: 'After hours in the back room. Rows pay out as poker hands by suit, and the Dealer counts your chips × mult.',
    palette: SUITS.map((s) => s.edge),
    art,
    shell: { logTitle: 'The book', keysHint: '← → move · ↑ / Z rotate · ↓ soft drop · Space drop · C sleeve' },
    mount,
  });
})();

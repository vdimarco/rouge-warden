/* 03 Rule Rows: Department of Row Compliance.
 * Many blocks carry a typed slip: a noun (a piece type, or JUNK for garbage), the verb IS,
 * or a property (HEAVY, GHOST, GOLD, SLOW, FAST, BOMB, MIRROR).
 * When a locked row holds NOUN IS PROPERTY left to right on three touching blocks, that
 * rule is in effect for as long as the row exists. Clearing the row voids it.
 * So you protect good sentences and file away bad ones. Junk rows rise every few pieces.
 * Survival score run: level up every 8 lines, game over on top-out.
 * Look: ruled form paper in a manila folder, index-card blocks, typed slips, red rubber stamps.
 * Host: The Supervisor, by memo.
 */
(function () {
  const W = window.Wells;

  const NOUNS = W.TYPES.concat(['JUNK']);
  const PROPS = {
    HEAVY: { tone: 'bad', desc: 'falls instantly', junk: 'junk rises twice as often' },
    GHOST: { tone: 'good', desc: 'passes through blocks, lands at the lowest spot it fits', junk: 'junk stops rising' },
    GOLD: { tone: 'good', desc: 'its blocks score ×3', junk: 'junk blocks score ×3' },
    SLOW: { tone: 'good', desc: 'falls at half speed', junk: 'junk rises half as often' },
    FAST: { tone: 'bad', desc: 'falls twice as fast', junk: 'junk rises twice as often' },
    BOMB: { tone: 'good', desc: 'blasts a 3×3 hole where it lands', junk: null },
    MIRROR: { tone: 'bad', desc: 'left and right are swapped', junk: null },
  };
  const PROP_KEYS = Object.keys(PROPS);
  const LINES_PER_LEVEL = 8;
  const LINE_X = [0, 1, 2.5, 4, 6];

  // ---------- stationery ----------
  // Each piece type is a different index-card stock; junk is grey kraft board; GOLD is foil.
  const STOCK = { I: '#a3cdea', O: '#f2dc74', T: '#cdb3e6', S: '#a5d6a0', Z: '#f2a59a', J: '#97a8e0', L: '#f4ba7c', JUNK: '#ada594' };
  const PAPER = '#fbf8ef';
  const INK_RED = '#b3171d', INK_BLUE = '#22409e', INK_BLACK = '#1f1d1a', PENCIL = '#3f63ad', STAMP = '#c21f27';
  // slip stocks: nouns on white, IS on manila, properties on pink carbon
  const SLIP = { noun: '#ffffff', is: '#ead08f', prop: '#f8c3ce' };
  const TYPE_FONT = '"Courier Prime", "Courier New", monospace';
  const STAMP_FONT = '"Special Elite", "Courier Prime", monospace';
  const kindOf = (w) => (w === 'IS' ? 'is' : PROPS[w] ? 'prop' : 'noun');
  const inkOf = (w) => (PROPS[w] ? (PROPS[w].tone === 'good' ? INK_BLUE : INK_RED) : INK_BLACK);
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const TODAY = (() => { const d = new Date(); return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); })();

  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function rollWord(rng, type) {
    const r = rng();
    if (r < 0.34) return 'IS';
    if (r < 0.66) return rng.chance(0.45) ? type : rng.pick(NOUNS);
    return rng.pick(PROP_KEYS);
  }

  // ---------- block sprites (cached per stock / slip / size / variant) ----------
  const sprites = new Map();
  function paintCard(g, kind, s, v) {
    const col = kind === 'GOLD' ? '#d9ab3e' : STOCK[kind] || '#cccccc';
    g.fillStyle = 'rgba(70,52,20,0.22)';
    g.fillRect(2, 2, s - 2, s - 2);
    if (kind === 'GOLD') {
      const gr = g.createLinearGradient(0, 0, s, s);
      gr.addColorStop(0, '#f5dc8a'); gr.addColorStop(0.45, '#cf9b2e'); gr.addColorStop(0.6, '#f0cf6e'); gr.addColorStop(1, '#b98622');
      g.fillStyle = gr;
    } else g.fillStyle = col;
    g.fillRect(1, 1, s - 3, s - 3);
    if (kind === 'JUNK') {
      // corrugated kraft board with a crease or two
      g.fillStyle = 'rgba(60,50,35,0.10)';
      for (let x = 3; x < s - 2; x += 3) g.fillRect(x, 1, 1, s - 3);
      g.fillStyle = 'rgba(60,50,35,0.16)';
      g.fillRect(1, s - 6, s - 3, 4);
      g.strokeStyle = 'rgba(255,250,235,0.35)'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(2, 2 + v * 3); g.lineTo(s - 3, s * 0.45 + v * 2); g.stroke();
    } else if (kind === 'GOLD') {
      // notary seal in the corner
      const cx = s * 0.74, cy = s * 0.74, R = s * 0.17;
      g.fillStyle = '#9c6c14';
      g.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, rr = i % 2 ? R * 0.78 : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.strokeStyle = '#f7e2a0'; g.lineWidth = 0.8;
      g.beginPath(); g.arc(cx, cy, R * 0.5, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,250,220,0.55)';
      g.fillRect(2, 2, s - 5, 1);
    } else {
      // index card: red header rule, blue lines
      const y0 = Math.round(s * 0.24) + 0.5;
      g.strokeStyle = 'rgba(178,34,40,0.5)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(2, y0); g.lineTo(s - 3, y0); g.stroke();
      g.strokeStyle = 'rgba(35,64,150,0.2)';
      g.beginPath();
      for (const f of [0.48, 0.7]) { const y = Math.round(s * f) + 0.5; g.moveTo(2, y); g.lineTo(s - 3, y); }
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(1, 1, s - 3, 1);
    }
    g.strokeStyle = kind === 'GOLD' ? '#8a5f10' : W.shade(col, -0.38);
    g.lineWidth = 1;
    g.strokeRect(1.5, 1.5, s - 4, s - 4);
    if (v === 1 && kind !== 'GOLD') {
      // dog-eared corner
      const d = Math.max(3, Math.round(s * 0.2));
      g.fillStyle = 'rgba(70,52,20,0.25)';
      g.beginPath(); g.moveTo(s - 2 - d, 1); g.lineTo(s - 2, 1 + d); g.lineTo(s - 2, 1); g.closePath(); g.fill();
      g.fillStyle = W.shade(col, 0.45);
      g.beginPath(); g.moveTo(s - 2 - d, 1); g.lineTo(s - 2 - d, 1 + d); g.lineTo(s - 2, 1 + d); g.closePath(); g.fill();
      g.strokeStyle = W.shade(col, -0.3); g.stroke();
    }
  }
  function paintSlip(g, word, s, v) {
    const kind = kindOf(word);
    const w = s - 4, h = Math.max(7, Math.round(s * 0.5));
    g.save();
    g.translate(s / 2, s / 2 + s * 0.05);
    g.rotate([-0.035, 0.03, -0.012][v] || 0);
    g.fillStyle = 'rgba(50,38,15,0.3)';
    g.fillRect(-w / 2 + 0.8, -h / 2 + 1.2, w, h);
    g.fillStyle = SLIP[kind];
    g.fillRect(-w / 2, -h / 2, w, h);
    if (kind === 'prop') { g.fillStyle = 'rgba(190,60,90,0.12)'; g.fillRect(-w / 2, h / 2 - 2, w, 2); }
    g.strokeStyle = 'rgba(60,48,25,0.4)'; g.lineWidth = 0.75;
    g.strokeRect(-w / 2 + 0.4, -h / 2 + 0.4, w - 0.8, h - 0.8);
    const size = Math.max(6, Math.round(s * (word.length <= 2 ? 0.46 : 0.4)));
    g.font = `700 ${size}px ${TYPE_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tw = g.measureText(word).width, room = w - 3;
    if (tw > room) g.scale(room / tw, 1);
    g.fillStyle = inkOf(word);
    g.fillText(word, 0, 0.8);
    g.restore();
  }
  function sprite(kind, word, s, v) {
    const dpr = window.devicePixelRatio || 1;
    const key = kind + '|' + (word || '') + '|' + s + '|' + v + '|' + dpr;
    let c = sprites.get(key);
    if (c) return c;
    if (sprites.size > 800) sprites.clear();
    c = document.createElement('canvas');
    c.width = Math.ceil(s * dpr); c.height = Math.ceil(s * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintCard(g, kind, s, v);
    if (word) paintSlip(g, word, s, v);
    sprites.set(key, c);
    return c;
  }

  // ---------- rubber stamps ----------
  const stamps = new Map();
  function makeStamp(type, text) {
    const c = document.createElement('canvas');
    const big = type === 'big', vd = type === 'void';
    const Wc = big ? 520 : vd ? 360 : 330, Hc = big ? 210 : vd ? 150 : 88;
    c.width = Wc; c.height = Hc;
    const g = c.getContext('2d');
    g.strokeStyle = g.fillStyle = vd ? '#8f1a20' : STAMP;
    const m = 8;
    g.lineWidth = big ? 11 : 8;
    rrect(g, m, m, Wc - 2 * m, Hc - 2 * m, big ? 18 : 12); g.stroke();
    if (big || vd) { g.lineWidth = 3; rrect(g, m + 13, m + 13, Wc - 2 * m - 26, Hc - 2 * m - 26, 8); g.stroke(); }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const fit = (str, size, y, maxW) => {
      g.font = `400 ${size}px ${STAMP_FONT}`;
      const w = g.measureText(str).width;
      g.save(); g.translate(Wc / 2, y); if (w > maxW) g.scale(maxW / w, 1); g.fillText(str, 0, 0); g.restore();
    };
    if (big) { fit('IN EFFECT', 104, 86, Wc - 90); g.fillRect(52, 130, Wc - 104, 3); fit(text + '  ·  ' + TODAY, 32, 162, Wc - 100); }
    else if (vd) { fit('VOID', 100, 62, Wc - 80); fit(text, 26, 116, Wc - 90); g.fillRect(50, 114, Wc - 100, 3); }
    else fit('IN EFFECT', 58, Hc / 2 + 3, Wc - 44);
    // ink wear: pinholes, dry streaks
    const r = W.rng(hash(type + text));
    g.globalCompositeOperation = 'destination-out';
    const n = big ? 1100 : 160;
    for (let i = 0; i < n; i++) {
      g.globalAlpha = 0.25 + r() * 0.75;
      g.beginPath(); g.arc(r() * Wc, r() * Hc, 0.4 + r() * r() * 3.2, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.4;
    for (let i = 0; i < 6; i++) g.fillRect(r() * Wc, r() * Hc, 20 + r() * 90, 1 + r() * 2);
    return c;
  }
  function stampImg(type, text = '') {
    const k = type + '|' + text;
    let c = stamps.get(k);
    if (!c) { if (stamps.size > 60) stamps.clear(); c = makeStamp(type, text); stamps.set(k, c); }
    return c;
  }
  function drawStamp(ctx, img, cx, cy, w, ang, alpha) {
    const h = (w * img.height) / img.width;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'multiply';
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  const stampAngle = (k) => -0.11 + (hash(k) % 1000) / 1000 * 0.16;

  // ---------- ruled form paper for the well (cached) ----------
  function makePaper(Wd, Hd, s, rows, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(Wd * dpr); c.height = Math.ceil(Hd * dpr);
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = PAPER; g.fillRect(0, 0, Wd, Hd);
    const r = W.rng(303);
    g.strokeStyle = 'rgba(120,100,60,0.07)'; g.lineWidth = 0.6;
    g.beginPath();
    for (let i = 0; i < 900; i++) { const x = r() * Wd, y = r() * Hd, a = r() * Math.PI, l = 1 + r() * 4; g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); }
    g.stroke();
    // faint column boxes
    g.strokeStyle = 'rgba(110,100,80,0.16)'; g.setLineDash([1, 3]);
    g.beginPath();
    for (let x = 1; x < Wd / s; x++) { g.moveTo(x * s + 0.5, s); g.lineTo(x * s + 0.5, Hd); }
    g.stroke(); g.setLineDash([]);
    // ruled lines
    g.strokeStyle = 'rgba(70,120,195,0.38)'; g.lineWidth = 1;
    g.beginPath();
    for (let y = 2; y < rows; y++) { g.moveTo(0, y * s + 0.5); g.lineTo(Wd, y * s + 0.5); }
    g.stroke();
    // header rule: the top-out line
    g.strokeStyle = 'rgba(190,30,40,0.6)';
    g.beginPath(); g.moveTo(0, s + 0.5); g.lineTo(Wd, s + 0.5); g.moveTo(0, s + 3.5); g.lineTo(Wd, s + 3.5); g.stroke();
    g.fillStyle = 'rgba(160,40,45,0.42)';
    g.font = `700 ${Math.max(7, Math.round(s * 0.3))}px ${TYPE_FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('DO NOT WRITE ABOVE THIS LINE', Wd / 2, s * 0.62);
    // line numbers, right margin
    g.fillStyle = 'rgba(50,80,150,0.38)';
    g.font = `700 ${Math.max(7, Math.round(s * 0.27))}px ${TYPE_FONT}`;
    g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    for (let y = 1; y < rows; y++) g.fillText(String(rows - y), Wd - 2, y * s + s - 3);
    return c;
  }

  // ---------- The Supervisor ----------
  function drawSupervisor(cv) {
    const dpr = window.devicePixelRatio || 1, w = 58, h = 68;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ID photo, slightly crooked
    g.save();
    g.translate(w / 2, h / 2 + 2); g.rotate(-0.04);
    g.fillStyle = 'rgba(60,45,20,0.25)'; g.fillRect(-23, -27, 48, 58);
    g.fillStyle = '#eef0f2'; g.fillRect(-24, -29, 48, 58);
    g.fillStyle = '#d9dee6'; g.fillRect(-21, -26, 42, 46);
    g.strokeStyle = INK_BLUE; g.lineWidth = 1.2; g.lineCap = 'round'; g.lineJoin = 'round';
    // shoulders, collar, tie
    g.beginPath(); g.moveTo(-21, 20); g.quadraticCurveTo(-18, 4, 0, 3); g.quadraticCurveTo(18, 4, 21, 20); g.stroke();
    g.beginPath(); g.moveTo(-6, 4); g.lineTo(0, 11); g.lineTo(6, 4); g.stroke();
    g.fillStyle = INK_RED;
    g.beginPath(); g.moveTo(0, 9); g.lineTo(-2.5, 12); g.lineTo(0, 20); g.lineTo(2.5, 12); g.closePath(); g.fill();
    // head
    g.fillStyle = '#e8dccb';
    g.beginPath(); g.ellipse(0, -9, 10, 12.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // comb-over
    g.beginPath();
    for (let i = 0; i < 4; i++) { g.moveTo(-9 + i, -14 + i * 0.6); g.quadraticCurveTo(-2, -22 + i, 9, -15 + i * 0.4); }
    g.stroke();
    // half-moon glasses
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(-8.5, -8); g.lineTo(-1.5, -8); g.quadraticCurveTo(-2, -4, -5, -4); g.quadraticCurveTo(-8, -4, -8.5, -8); g.stroke();
    g.beginPath(); g.moveTo(8.5, -8); g.lineTo(1.5, -8); g.quadraticCurveTo(2, -4, 5, -4); g.quadraticCurveTo(8, -4, 8.5, -8); g.stroke();
    g.beginPath(); g.moveTo(-1.5, -8); g.lineTo(1.5, -8); g.stroke();
    // eyes over the glasses, unimpressed
    g.fillStyle = INK_BLUE;
    g.fillRect(-6, -11, 2.4, 1.2); g.fillRect(3.6, -11, 2.4, 1.2);
    g.beginPath(); g.moveTo(-7, -13.5); g.lineTo(-3, -12.8); g.moveTo(7, -13.5); g.lineTo(3, -12.8); g.stroke();
    // flat mouth
    g.beginPath(); g.moveTo(-3.5, 0); g.lineTo(3.5, -0.3); g.stroke();
    // caption strip
    g.fillStyle = INK_BLACK;
    g.font = `700 6px ${TYPE_FONT}`;
    g.textAlign = 'center';
    g.fillText('SUPERVISOR', 0, 26);
    g.restore();
    // paper clip
    g.strokeStyle = '#7b7f86'; g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(12, 14); g.lineTo(12, 2); g.quadraticCurveTo(12, -1, 15, -1); g.quadraticCurveTo(18, -1, 18, 2);
    g.lineTo(18, 16); g.quadraticCurveTo(18, 19, 15.5, 19); g.quadraticCurveTo(14.5, 19, 14.5, 16); g.lineTo(14.5, 5);
    g.stroke();
  }

  const MEMO = {
    start: ['Welcome to Row Compliance. Read the form. All of it.', 'Your desk is the well. Your job is the rows. Try to keep them in that order.'],
    good: ['Per policy, {R} is now in effect. Please file accordingly.', '{R} has been approved. Try not to get used to it.', 'Effective immediately: {R}. I have updated the binder. Again.'],
    bad: ['{R} is now in effect. I assume you meant to do that.', 'Per your own paperwork, {R}. Congratulations.', '{R} is now policy. I would file that row quickly. If I were you. Which I am not.'],
    void: ['{R} has been voided. A note has been placed in your file.', '{R} is no longer in effect. Shred any copies.', 'Rescinded: {R}. That was quick.'],
    clear: ['Row filed. Adequate.', 'One row filed. The cabinet thanks you. I do not.', 'Filed. Next.', 'Row filed. Please do not expect a memo every time.'],
    multi: ['{N} rows at once. I will mention it in your review. Briefly.', '{N} rows filed in one motion. Nobody likes a show-off.'],
    junk: ['Junk delivery. Please sign for it at the bottom.', 'More junk from Accounts. It goes at the bottom, as always.', 'Junk has arrived. Junk always arrives.'],
    bomb: ['Something exploded in Records. I assume it was authorised.', 'Facilities has been notified about the hole in your form.'],
    hold: ['Setting that aside? Of course. Someone else will deal with it.', 'The pending tray: where work goes to wait.'],
    level: ['Congratulations on Grade {N}. Your workload has been adjusted upward.', 'Grade {N}. Same desk. Faster pieces.'],
    over: ['The cabinet is full. We will be discussing this.', 'Form closed. Please collect your stapler on the way out.'],
  };

  // ---------- sound: an office ----------
  function clack(p = 1, vol = 0.055) {
    W.noise({ dur: 0.022, filter: 'bandpass', freq: 2700 * p * (0.9 + Math.random() * 0.2), q: 2.5, vol });
    W.tone({ f: 170 * p, f2: 85, dur: 0.03, type: 'square', vol: 0.01 });
  }
  function bell(at = 0, f = 2350, vol = 0.05) {
    W.tone({ f, dur: 1.0, type: 'sine', vol, at });
    W.tone({ f: f * 2.76, dur: 0.45, type: 'sine', vol: vol * 0.22, at });
    W.tone({ f: f * 0.5, dur: 0.5, type: 'sine', vol: vol * 0.25, at });
  }
  function carriageReturn() {
    for (let i = 0; i < 5; i++) W.noise({ dur: 0.016, filter: 'bandpass', freq: 1900 + i * 260, q: 3, vol: 0.035, at: i * 0.024 });
    W.noise({ dur: 0.08, filter: 'lowpass', freq: 600, vol: 0.06, at: 0.13 });
    bell(0.12);
  }
  function stampThunk() {
    W.tone({ f: 95, f2: 38, dur: 0.26, type: 'sine', vol: 0.16 });
    W.noise({ dur: 0.14, filter: 'lowpass', freq: 900, freq2: 160, vol: 0.16 });
    W.noise({ dur: 0.03, filter: 'highpass', freq: 3200, vol: 0.05 });
  }
  function stampWhoosh() { W.noise({ dur: 0.11, filter: 'bandpass', freq: 400, freq2: 1600, q: 0.8, vol: 0.025 }); }
  function voidStamp() {
    W.tone({ f: 140, f2: 70, dur: 0.12, type: 'sine', vol: 0.07 });
    W.noise({ dur: 0.07, filter: 'lowpass', freq: 1400, vol: 0.06 });
  }
  function shuffle() {
    for (let i = 0; i < 3; i++) W.noise({ dur: 0.07, filter: 'bandpass', freq: 2600 + i * 900, freq2: 4800, q: 0.7, vol: 0.035, at: i * 0.055 });
  }

  function mount(sh) {
    const rng = W.rng();
    const board = new W.Board(10, 20);
    let rules = [], score = 0, level = 1, lines = 0, piecesSinceJunk = 0, over = false, showWords = true, last = null;
    let seenRules = new Set();
    let flash = 0, hitstop = 0, holding = false, slamFrozen = false;
    const slams = [], voids = [], splats = [];

    const is = (noun, prop) => rules.some((r) => r.noun === noun && r.prop === prop);
    const props = (noun) => new Set(rules.filter((r) => r.noun === noun).map((r) => r.prop));
    const isGhost = (p) => p && is(p.type, 'GHOST');
    const ruleKey = (r) => r.noun + ' IS ' + r.prop;
    const pick = (arr) => arr[rng.int(arr.length)];

    W.voice = {
      move: () => clack(1),
      rotate: () => { if (holding) return; clack(1.3, 0.045); W.noise({ dur: 0.015, filter: 'highpass', freq: 4200, vol: 0.02, at: 0.022 }); },
      lock: () => { W.noise({ dur: 0.05, filter: 'lowpass', freq: 800, vol: 0.07 }); W.tone({ f: 140, f2: 85, dur: 0.05, type: 'triangle', vol: 0.04 }); },
      drop: () => { W.noise({ dur: 0.09, filter: 'bandpass', freq: 1800, freq2: 350, q: 1, vol: 0.06 }); W.tone({ f: 100, f2: 55, dur: 0.1, type: 'triangle', vol: 0.07 }); },
      clear: carriageReturn,
      big: () => { carriageReturn(); bell(0.32, 2790, 0.05); },
      coin: () => bell(0, 3140, 0.025),
      hit: () => { W.noise({ dur: 0.16, filter: 'lowpass', freq: 320, vol: 0.12 }); W.tone({ f: 72, f2: 48, dur: 0.14, type: 'sine', vol: 0.08 }); },
      bad: () => { W.tone({ f: 110, dur: 0.45, type: 'square', vol: 0.025 }); W.tone({ f: 117, dur: 0.45, type: 'square', vol: 0.02 }); },
      win: () => { bell(0, 2350, 0.04); bell(0.16, 2350, 0.04); },
      tick: null, buy: null,
    };

    // ---------- the well ----------
    let paper = null;
    const view = new W.BoardView(sh.canvas, board, {
      maxCell: 30,
      grid: false,
      textFont: STAMP_FONT,
      textStroke: PAPER,
      textWeight: 400,
      background(ctx, Wd, Hd, s) {
        const dpr = window.devicePixelRatio || 1, k = Wd + 'x' + Hd + 'x' + dpr;
        if (!paper || paper.k !== k) paper = { k, c: makePaper(Wd, Hd, s, board.h, dpr) };
        ctx.fillStyle = PAPER; ctx.fillRect(-24, -24, Wd + 48, Hd + 48);
        ctx.drawImage(paper.c, 0, 0, Wd, Hd);
      },
      drawBlock(ctx, b, px, py, s, x, y, o) { drawCard(ctx, b, px, py, s, o, true); },
      clearFlash(ctx, rows, k, s, Wd) {
        const p = 1 - k;
        ctx.save();
        ctx.lineCap = 'round';
        for (const y of rows) {
          ctx.fillStyle = `rgba(251,248,239,${0.2 + 0.5 * p})`;
          ctx.fillRect(0, y * s, Wd, s);
          const L = Math.min(1, p * 1.5) * (Wd - 4);
          ctx.strokeStyle = INK_RED;
          ctx.lineWidth = Math.max(2, s * 0.1);
          ctx.beginPath(); ctx.moveTo(3, y * s + s * 0.55); ctx.lineTo(3 + L, y * s + s * 0.46); ctx.stroke();
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(5, y * s + s * 0.64); ctx.lineTo(3 + L * 0.96, y * s + s * 0.58); ctx.stroke();
        }
        ctx.restore();
      },
      drawParticle(ctx, f, s) {
        // paper shreds, tumbling
        ctx.translate(f.x * s, f.y * s);
        ctx.rotate(f.life * 0.011 + f.size * 2);
        const w = f.size * 1.7, h = Math.max(1.5, f.size * 0.5);
        ctx.fillStyle = f.color;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = 'rgba(60,45,20,0.35)'; ctx.lineWidth = 0.5;
        ctx.strokeRect(-w / 2, -h / 2, w, h);
      },
      overlay(ctx, s) { drawOverlay(ctx, s); },
    });

    function drawCard(ctx, b, px, py, s, o, withWord) {
      if (o.ghost) {
        // pencilled "fill in here" box
        ctx.save();
        ctx.fillStyle = 'rgba(63,99,173,0.06)';
        ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
        ctx.strokeStyle = PENCIL; ctx.globalAlpha = 0.7; ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 2.5]);
        ctx.strokeRect(px + 2.5, py + 2.5, s - 5, s - 5);
        ctx.restore();
        return;
      }
      const kind = is(b.ptype, 'GOLD') ? 'GOLD' : b.garbage ? 'JUNK' : b.ptype;
      const ghostActive = st.active && isGhost(st.active) && st.active.blocks.includes(b);
      const img = sprite(kind, withWord ? b.word : null, s, b.v || 0);
      if (ghostActive) {
        ctx.save(); ctx.globalAlpha = 0.42; ctx.drawImage(img, px, py, s, s);
        ctx.strokeStyle = PENCIL; ctx.globalAlpha = 0.8; ctx.strokeRect(px + 1.5, py + 1.5, s - 3, s - 3);
        ctx.restore();
      } else ctx.drawImage(img, px, py, s, s);
    }
    const miniOpts = () => ({ drawBlock: (ctx, b, px, py, s) => drawCard(ctx, b, px, py, s, {}, showWords) });

    // ---------- overlay: stamps, voids, ink, the slam ----------
    const SLAM_IN = 120, SLAM_HOLD = 720, SLAM_END = 1080, SMALL_W = 2.3;
    function slamTarget(sl, s) {
      const r = rules.find((q) => ruleKey(q) === sl.key) || sl.rule;
      return { x: (r.x + 1.5) * s, y: Math.min((r.y + 0.5) * s, board.h * s - s * 0.86) };
    }
    function drawOverlay(ctx, s) {
      const Wd = board.w * s, Hd = board.h * s;
      const slamming = new Set(slams.map((q) => q.key));
      for (const r of rules) {
        const k = ruleKey(r);
        if (slamming.has(k)) continue;
        if (PROPS[r.prop].tone !== 'good') {
          // flagged for filing: red pencil dashes round the sentence
          ctx.save();
          ctx.globalCompositeOperation = 'multiply';
          ctx.strokeStyle = 'rgba(194,31,39,0.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(r.x * s + 1, r.y * s + 1, 3 * s - 2, s - 2);
          ctx.restore();
        }
        drawStamp(ctx, stampImg('small'), (r.x + 1.5) * s, Math.min((r.y + 1) * s - 1, Hd - s * 0.36), SMALL_W * s, stampAngle(k + r.x), 0.88);
      }
      for (const v of voids) {
        const a = Math.min(1, v.life / 500), p = Math.min(1, v.t / 90);
        drawStamp(ctx, stampImg('void', v.key), (v.x + 1.5) * s, (v.y + 0.5) * s, 3 * s * (1.35 - 0.3 * p), 0.12, 0.9 * a * p);
      }
      if (splats.length) {
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = STAMP;
        for (const sp of splats) {
          ctx.globalAlpha = 0.9 * Math.min(1, sp.life / 700);
          ctx.beginPath();
          ctx.moveTo(sp.x + sp.r, sp.y); ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
          for (const d of sp.d) { ctx.moveTo(sp.x + d[0] + d[2], sp.y + d[1]); ctx.arc(sp.x + d[0], sp.y + d[1], d[2], 0, Math.PI * 2); }
          ctx.fill();
        }
        ctx.restore();
      }
      if (flash > 0) { ctx.fillStyle = `rgba(255,253,245,${flash * 0.5})`; ctx.fillRect(0, 0, Wd, Hd); }
      const sl = slams[0];
      if (sl) {
        const bw = Math.min(Wd * 0.9, 290), cx0 = Wd / 2, cy0 = Hd * 0.4, a0 = -0.09;
        const img = stampImg('big', sl.key);
        if (sl.t < SLAM_IN) {
          const p = sl.t / SLAM_IN, e = p * p;
          ctx.fillStyle = `rgba(40,30,10,${0.12 * p})`;
          ctx.fillRect(0, 0, Wd, Hd);
          drawStamp(ctx, img, cx0, cy0, bw * (2.7 - 1.7 * e), a0 - 0.1 * (1 - p), 0.25 + 0.7 * e);
        } else if (sl.t < SLAM_HOLD) {
          const q = (sl.t - SLAM_IN) / 160;
          const bounce = q < 1 ? 1 + 0.04 * Math.sin(q * Math.PI) : 1;
          drawStamp(ctx, img, cx0, cy0, bw * bounce, a0, 0.95);
        } else {
          const p = Math.min(1, (sl.t - SLAM_HOLD) / (SLAM_END - SLAM_HOLD));
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          const tg = slamTarget(sl, s), sw = SMALL_W * s;
          const cx = cx0 + (tg.x - cx0) * e, cy = cy0 + (tg.y + s * 0.5 - 1 - cy0) * e;
          const ang = a0 + (stampAngle(sl.key + sl.rule.x) - a0) * e;
          const swap = Math.max(0, Math.min(1, (p - 0.72) / 0.28));
          // the big stamp shrinks onto the row, then settles as the compact one
          drawStamp(ctx, img, cx, cy, bw + (sw * 1.08 - bw) * e, ang, 0.95 * (1 - swap));
          if (swap > 0) drawStamp(ctx, stampImg('small'), cx, cy, sw, ang, 0.88 * swap);
        }
      }
    }
    function impact(sl) {
      const Wd = board.w * view.cell, Hd = board.h * view.cell;
      const cx = Wd / 2, cy = Hd * 0.4, bw = Math.min(Wd * 0.9, 290), bh = bw * 0.4;
      stampThunk();
      view.shake(11);
      hitstop = 170;
      for (let i = 0; i < 22; i++) {
        const a = rng() * Math.PI * 2;
        const ex = Math.cos(a), ey = Math.sin(a);
        const dist = 0.55 + rng() * 0.6;
        const x = cx + ex * bw * 0.5 * dist, y = cy + ey * bh * 0.6 * dist;
        const r = 0.8 + rng() * rng() * 5;
        const d = [];
        const n = rng.int(4);
        for (let j = 1; j <= n; j++) d.push([ex * (r + j * 3.2), ey * (r + j * 3.2), Math.max(0.5, r * (0.55 - j * 0.12))]);
        splats.push({ x, y, r, d, life: 1500 + rng() * 900 });
      }
      for (let i = 0; i < 3; i++) view.burst(sl.rule.x + i + 0.5, sl.rule.y + 0.5, PAPER, 4, 4);
    }

    // ---------- pieces and words ----------
    const queue = [];
    const bag = W.bag(W.TYPES, rng);
    function makePiece() {
      const type = bag();
      const p = W.piece(type);
      p.blocks = p.blocks.map(() => ({ color: STOCK[type], ptype: type, v: rng.int(3) }));
      const r = rng();
      const n = r < 0.2 ? 0 : r < 0.72 ? 1 : 2;
      const idx = rng.shuffle([0, 1, 2, 3]).slice(0, n);
      for (const i of idx) p.blocks[i].word = rollWord(rng, type);
      return p;
    }

    // ---------- ghost movement: a GHOST piece only collides with walls and floor ----------
    const realFits = W.Board.prototype.fits;
    function boundsFit(p, rot, x, y) {
      for (const c of W.pieceCells(p, rot, x, y)) if (c.x < 0 || c.x >= board.w || c.y >= board.h) return false;
      return true;
    }
    board.fits = function (p, rot = p.rot, x = p.x, y = p.y) {
      if (p === st.active && isGhost(p)) return boundsFit(p, rot, x, y);
      return realFits.call(board, p, rot, x, y);
    };
    function ghostLanding(p) {
      for (let y = board.h - 1; y >= -4; y--) if (realFits.call(board, p, p.rot, p.x, y)) return y;
      return null;
    }

    const st = new W.Stacker(board, {
      gravity: 800,
      clearDelay: 260,
      next() {
        while (queue.length < 6) queue.push(makePiece());
        const p = queue.shift();
        queue.push(makePiece());
        return p;
      },
      onSpawn(p) { applySpeed(p); paintQueue(); paint(); },
      onHold() { paintQueue(); shuffle(); say(pick(MEMO.hold), 0); },
      onLock(cells, p) {
        if (is(p.type, 'BOMB')) explode(cells);
        refreshRules();
      },
      onClear(rows, rowBlocks) { scoreClear(rows, rowBlocks); },
      afterClear() { refreshRules(); paint(); },
      beforeSpawn() {
        if (over) return false;
        piecesSinceJunk++;
        if (piecesSinceJunk >= junkEvery()) {
          piecesSinceJunk = 0;
          if (!is('JUNK', 'GHOST')) pushJunk();
          if (over) return false;
        }
        paint();
        return true;
      },
      onTopOut() { gameOver(); },
    });
    const baseLock = st.lock.bind(st);
    st.lock = () => {
      const p = st.active;
      if (p && isGhost(p)) {
        const y = ghostLanding(p);
        if (y == null) { st.topOut(); return; }
        if (y !== p.y) view.burst(p.x + p.n / 2, y + 1, PAPER, 10, 4);
        p.y = y;
      }
      baseLock();
    };
    st.ghostY = () => {
      const p = st.active;
      if (!p) return 0;
      if (isGhost(p)) { const y = ghostLanding(p); return y == null ? p.y : y; }
      return board.dropY(p);
    };
    const baseHold = st.hold.bind(st);
    st.hold = () => { holding = true; try { baseHold(); } finally { holding = false; } };

    function baseGravity() { return Math.max(110, 800 - (level - 1) * 65); }
    function applySpeed(p) {
      if (!p) return;
      let g = baseGravity();
      const pr = props(p.type);
      if (pr.has('SLOW')) g *= 2;
      if (pr.has('FAST')) g /= 2;
      if (pr.has('HEAVY')) g = 22;
      st.o.gravity = g;
    }
    function junkEvery() {
      let n = Math.max(6, 11 - Math.floor(level / 2));
      if (is('JUNK', 'SLOW')) n *= 2;
      if (is('JUNK', 'FAST') || is('JUNK', 'HEAVY')) n = Math.ceil(n / 2);
      return n;
    }

    // ---------- rules ----------
    function findRules() {
      const out = [];
      for (let y = 0; y < board.h; y++) {
        const row = board.cells[y];
        for (let x = 0; x + 2 < board.w; x++) {
          const a = row[x], b = row[x + 1], c = row[x + 2];
          if (a && b && c && NOUNS.includes(a.word) && b.word === 'IS' && PROPS[c.word]) out.push({ noun: a.word, prop: c.word, x, y });
        }
      }
      return out;
    }
    function refreshRules() {
      const prev = rules;
      const before = new Set(prev.map(ruleKey));
      rules = findRules();
      const now = new Set(rules.map(ruleKey));
      for (const r of rules) {
        const k = ruleKey(r);
        if (before.has(k)) continue;
        const good = PROPS[r.prop].tone === 'good';
        if (!slams.some((q) => q.key === k)) { slams.push({ key: k, rule: { x: r.x, y: r.y }, t: 0, hit: false }); }
        sh.log(`<b>IN EFFECT</b> ${k}`);
        say(pick(good ? MEMO.good : MEMO.bad).replace('{R}', k), 3);
        if (!seenRules.has(k)) { seenRules.add(k); score += 150 * level; view.float(`+${150 * level} merit`, r.x + 1.5, r.y - 0.3, INK_BLUE, 14); }
      }
      for (const r of prev) {
        const k = ruleKey(r);
        if (now.has(k)) continue;
        if (!voids.some((v) => v.key === k)) voids.push({ key: k, x: r.x, y: Math.min(board.h - 1, r.y), t: 0, life: 1400 });
        const i = slams.findIndex((q) => q.key === k);
        if (i > 0 || (i === 0 && slams[0].t < SLAM_IN)) slams.splice(i, 1);
        voidStamp();
        sh.log(`VOID ${k}`);
        say(pick(MEMO.void).replace('{R}', k), 3);
      }
      if (st.active) applySpeed(st.active);
      paint();
    }

    function explode(cells) {
      const cx = Math.round(cells.reduce((a, c) => a + c.x, 0) / cells.length);
      const cy = Math.round(cells.reduce((a, c) => a + c.y, 0) / cells.length);
      let n = 0;
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        const b = board.get(x, y);
        if (b) { view.burst(x + 0.5, y + 0.5, b.garbage ? STOCK.JUNK : STOCK[b.ptype] || PAPER, 8, 7); board.set(x, y, null); n++; }
      }
      view.burst(cx + 0.5, cy + 0.5, PAPER, 26, 10);
      view.shake(12);
      flash = 1;
      W.sfx('big', 0.6);
      W.noise({ dur: 0.35, filter: 'bandpass', freq: 3000, freq2: 900, q: 0.6, vol: 0.06 });
      score += n * 10 * level;
      view.float('SHREDDED', cx + 0.5, cy + 0.5, INK_RED, 20);
      say(pick(MEMO.bomb), 2);
    }

    function pushJunk() {
      const hole = rng.int(board.w);
      const row = new Array(board.w).fill(null).map((_, x) => (x === hole ? null : { color: STOCK.JUNK, garbage: true, ptype: 'JUNK', v: rng.int(3) }));
      const cells = row.map((b, x) => (b ? x : -1)).filter((x) => x >= 0);
      const k = rng() < 0.5 ? rng.range(1, 2) : 0;
      for (const x of rng.shuffle(cells).slice(0, k)) row[x].word = rollWord(rng, 'JUNK');
      if (board.addRow(row)) { gameOver(); return; }
      view.shake(5);
      W.sfx('hit', 0.7);
      for (let x = 0; x < board.w; x++) if (row[x]) view.burst(x + 0.5, board.h - 0.5, STOCK.JUNK, 2, 3);
      if (started) say(pick(MEMO.junk), 1);
      refreshRules();
    }

    function scoreClear(rows, rowBlocks) {
      let chips = 0, gold = 0;
      for (const blocks of rowBlocks) for (const b of blocks) {
        if (!b) continue;
        const g = is(b.ptype, 'GOLD');
        chips += g ? 30 : 10;
        if (g) gold++;
      }
      const mult = LINE_X[Math.min(4, rows.length)] * level;
      const killed = rules.filter((r) => rows.includes(r.y));
      const total = Math.round(chips * mult);
      score += total;
      lines += rows.length;
      last = { total, chips, mult, gold, rows: rows.length, killed: killed.map(ruleKey) };
      view.rowBurst(rows, (b) => (b ? (is(b.ptype, 'GOLD') ? '#e2b54a' : b.garbage ? STOCK.JUNK : STOCK[b.ptype]) : PAPER) || PAPER);
      view.float(`+${total}`, board.w / 2, rows[0] + 0.5, gold ? '#9c6c14' : INK_BLUE, rows.length >= 3 ? 26 : 20);
      if (rows.length >= 3) view.shake(10);
      if (gold) W.sfx('coin');
      sh.log(`Filed ${rows.length} row${rows.length > 1 ? 's' : ''}: <b>+${total}</b>${gold ? ` · ${gold} gold` : ''}`);
      if (!killed.length) say(rows.length > 1 ? pick(MEMO.multi).replace('{N}', rows.length) : pick(MEMO.clear), rows.length > 1 ? 2 : 1);
      const newLevel = 1 + Math.floor(lines / LINES_PER_LEVEL);
      if (newLevel > level) {
        level = newLevel;
        sh.toast(`Promoted to Grade ${level}`, 'good');
        W.sfx('win');
        say(pick(MEMO.level).replace('{N}', level), 2);
      }
    }

    // ---------- input ----------
    const mirrored = () => st.active && is(st.active.type, 'MIRROR');
    const actions = {
      left: () => st.move(mirrored() ? 1 : -1), right: () => st.move(mirrored() ? -1 : 1),
      toggleWords: () => { showWords = !showWords; paintQueue(); },
    };
    sh.stackerKeys(st, actions, { extra: { KeyV: 'toggleWords' }, downStart: () => (st.soft = true), downEnd: () => (st.soft = false) });
    sh.pad({ left: actions.left, right: actions.right, down: () => st.softDrop(), rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), hold: () => st.hold() });

    // ---------- desk furniture ----------
    sh.root.classList.add('rr');
    const qh = sh.root.querySelectorAll('.queue-panel h3');
    if (qh[0]) qh[0].textContent = 'In-tray';
    if (qh[1]) qh[1].textContent = 'Pending';
    const memoEl = W.el('div', 'panel rr-memo');
    memoEl.innerHTML = `<canvas class="rr-portrait" aria-hidden="true"></canvas>
      <div class="rr-memo-body"><div class="rr-memo-head"><span>Inter-office memo</span><span>From: The Supervisor</span></div>
      <p class="rr-memo-text" aria-live="polite"></p></div>`;
    sh.side.prepend(memoEl);
    drawSupervisor(memoEl.querySelector('canvas'));
    const memoText = memoEl.querySelector('.rr-memo-text');
    const memo = { text: '', shown: 0, drawn: -1, prio: 0, at: -1e9 };
    function say(text, prio = 1) {
      const now = performance.now();
      const busy = memo.shown < memo.text.length || now - memo.at < 2600;
      if (busy && prio < memo.prio) return;
      if (busy && prio === 0) return;
      memo.text = text; memo.shown = 0; memo.drawn = -1; memo.prio = prio; memo.at = now;
    }

    const rulesPanel = W.el('div', 'panel rr-rules');
    const wordsPanel = W.el('div', 'panel rr-words');
    const lastPanel = W.el('div', 'panel rr-receipt');
    sh.extra.append(rulesPanel, wordsPanel, lastPanel);
    wordsPanel.addEventListener('click', (e) => { if (e.target.closest('[data-act=words]')) { showWords = !showWords; paintQueue(); } });

    const slip = (w) => `<span class="rr-slip ${kindOf(w)}${PROPS[w] ? ' ' + PROPS[w].tone : ''}"${STOCK[w] && w !== 'JUNK' ? ` style="border-left:4px solid ${STOCK[w]}"` : ''}>${w}</span>`;
    function paintQueue() {
      const mo = miniOpts();
      sh.setQueue(queue.slice(0, 4), mo);
      sh.setHold(st.holdPiece, mo);
      const list = queue.slice(0, 4).map((p) => {
        const words = p.blocks.map((b) => b.word).filter(Boolean);
        return `<div class="rr-tray-row"><span class="rr-stock" style="background:${STOCK[p.type]}">${p.type}</span>${words.length ? words.map(slip).join('') : '<span class="rr-none">blank cards</span>'}</div>`;
      }).join('');
      wordsPanel.innerHTML = `<h3>Incoming slips</h3>
        ${showWords ? list : '<p class="rr-none">Slips face down.</p>'}
        <div><button class="btn small" type="button" data-act="words">${showWords ? 'Turn slips over' : 'Show slips'} (V)</button></div>`;
    }

    function paint() {
      const due = Math.max(0, junkEvery() - piecesSinceJunk);
      sh.hud([
        { label: 'Merit', value: score.toLocaleString(), tone: 'accent', wide: true },
        { label: 'Grade', value: level },
        { label: 'Rows filed', value: lines },
        { label: 'Junk due in', value: is('JUNK', 'GHOST') ? 'held' : due + ' pcs', tone: is('JUNK', 'GHOST') ? 'good' : (due <= 2 ? 'bad' : '') },
        { label: 'In effect', value: rules.length, tone: rules.length ? 'good' : '' },
      ]);
      const act = st.active ? st.active.type : null;
      rulesPanel.innerHTML = `<h3>Policies in effect</h3>` + (rules.length
        ? `<div class="rr-policy-list">${rules.map((r) => {
          const P = PROPS[r.prop], fx = r.noun === 'JUNK' ? P.junk : P.desc;
          return `<div class="rr-policy ${P.tone}${r.noun === act ? ' current' : ''}">
            <div class="rr-policy-words">${slip(r.noun)}${slip('IS')}${slip(r.prop)}<span class="rr-mini-stamp">${P.tone === 'good' ? 'In effect' : 'File soon'}</span></div>
            <span class="rr-policy-fx">${r.noun === 'JUNK' ? '' : r.noun + ' pieces: '}${fx || 'no effect'} · line ${board.h - r.y}${r.noun === act ? ' · <b>applies now</b>' : ''}</span></div>`;
        }).join('')}</div>`
        : `<p class="rr-none">None on file. Lock three touching slips in one row, left to right: ${slip('T')}${slip('IS')}${slip('GOLD')}. Nouns are piece letters or JUNK.</p>`)
        + `<details><summary>Policy handbook</summary><div class="rr-handbook">${PROP_KEYS.map((k) => `<span>${slip(k)} ${PROPS[k].desc}${PROPS[k].junk ? '; on JUNK: ' + PROPS[k].junk : ''}</span>`).join('')}</div></details>`;
      lastPanel.innerHTML = `<h3>Filing receipt</h3>` + (last
        ? `<div class="rr-sum"><span>${last.chips}</span> <i>×</i> <span>${last.mult}</span> <i>=</i> <b>${last.total.toLocaleString()}</b></div>
          <div class="rr-sum-key">cards × (row rate × grade)</div>
          <div class="chips">${last.gold ? `<span class="chip accent">${last.gold} gold ×3</span>` : ''}${last.killed.map((k) => `<span class="chip bad">voided ${k}</span>`).join('')}</div>`
        : '<p class="rr-none">10 per card, 30 if its noun IS GOLD. × row rate × grade. Each new policy earns 150 × grade, once.</p>');
    }

    function gameOver() {
      if (over) return;
      over = true;
      st.over = true;
      st.active = null;
      W.sfx('bad');
      view.shake(14);
      say(pick(MEMO.over), 5);
      paint();
      sh.overlay({
        title: 'Cabinet full',
        body: `<div class="rr-big-stamp">Closed</div>
          <dl class="rr-fields"><dt>Merit</dt><dd>${score.toLocaleString()}</dd><dt>Grade</dt><dd>${level}</dd><dt>Rows filed</dt><dd>${lines}</dd></dl>
          <p>Policies you wrote:</p><div class="rr-slips">${[...seenRules].map((k) => `<span class="rr-written">${k.split(' ').map(slip).join('')}</span>`).join('') || '<span class="rr-none">none. Disappointing.</span>'}</div>`,
        button: 'Request a new form',
      }).then(newRun);
    }

    let started = false;
    function newRun() {
      board.clear();
      st.reset();
      rules = []; score = 0; level = 1; lines = 0; piecesSinceJunk = 0; over = false; last = null;
      seenRules = new Set();
      slams.length = 0; voids.length = 0; splats.length = 0;
      queue.length = 0;
      sh.logEl.innerHTML = '';
      started = false;
      // two starter junk rows, so there is something to build sentences on
      for (let i = 0; i < 2; i++) pushJunk();
      started = true;
      memo.prio = 0; memo.at = -1e9; memo.shown = memo.text.length;
      say(pick(MEMO.start), 1);
      st.spawn();
      paintQueue();
      paint();
    }

    sh.loop((dt) => {
      flash = Math.max(0, flash - dt / 250);
      const sl = slams[0];
      if (sl && !slamFrozen) {
        if (sl.t === 0) stampWhoosh();
        sl.t += dt;
        if (!sl.hit && sl.t >= SLAM_IN) { sl.hit = true; impact(sl); }
        if (sl.t >= SLAM_END) slams.shift();
      }
      for (let i = voids.length - 1; i >= 0; i--) { voids[i].t += dt; voids[i].life -= dt; if (voids[i].life <= 0) voids.splice(i, 1); }
      for (let i = splats.length - 1; i >= 0; i--) { splats[i].life -= dt; if (splats[i].life <= 0) splats.splice(i, 1); }
      if (hitstop > 0) hitstop -= dt;
      else st.update(dt);
      view.update(dt);
      view.draw(st);
      if (memo.shown < memo.text.length) memo.shown = Math.min(memo.text.length, memo.shown + dt * 0.055);
      const n = Math.floor(memo.shown);
      if (n !== memo.drawn) {
        memo.drawn = n;
        memoText.textContent = memo.text.slice(0, n);
        memoText.classList.toggle('typing', n < memo.text.length);
      }
    });

    // fonts arrive after first paint on a cold load: redraw cached paper
    if (document.fonts && document.fonts.load) {
      Promise.all([document.fonts.load(`400 40px ${STAMP_FONT}`), document.fonts.load(`700 12px ${TYPE_FONT}`)])
        .then(() => { sprites.clear(); stamps.clear(); paper = null; paintQueue(); }).catch(() => {});
    }

    // debug hooks for playtesting
    sh.debug = {
      board, st,
      plant(noun, prop, x = 0, y = 17) {
        const mk = (w, t) => ({ color: STOCK[t], ptype: t, word: w, v: 0 });
        board.set(x, y, mk(noun, W.TYPES.includes(noun) ? noun : 'T'));
        board.set(x + 1, y, mk('IS', 'S'));
        board.set(x + 2, y, mk(prop, 'L'));
        refreshRules();
      },
      // pin the slam animation at t ms (screenshots); null to release
      slamAt(t) {
        const sl = slams[0];
        if (t == null) { slamFrozen = false; return; }
        if (!sl) return;
        slamFrozen = true; sl.t = t;
        if (!sl.hit && t >= SLAM_IN) { sl.hit = true; impact(sl); }
      },
      refresh: () => refreshRules(),
      state: () => ({ rules: rules.map(ruleKey), score, level, slams: slams.length }),
    };

    paint();
    paintQueue();
    view.draw(st);
    sh.overlay({
      title: 'Form RR-03',
      body: `<div class="rr-memo-lines"><span><i>To</i> New clerk</span><span><i>From</i> The Supervisor</span><span><i>Re</i> Rules, by the row</span></div>
        <p>Some blocks carry typed slips. Line them up and the rules change.</p>
        <ul><li>Lock ${slip('T')}${slip('IS')}${slip('GOLD')} left to right on three touching blocks in one row.</li>
        <li>It stays in effect until that row is filed (cleared).</li>
        <li><b class="rr-ink-blue">Blue ink</b> helps: GHOST GOLD SLOW BOMB. <b class="rr-ink-red">Red ink</b> hurts: FAST HEAVY MIRROR. File those fast.</li>
        <li>JUNK rows arrive from below. They carry slips too.</li></ul>`,
      button: 'Sign and begin',
    }).then(newRun);
  }

  // ---------- hub card art ----------
  function drawArt(ctx, w, h) {
    ctx.fillStyle = '#dfc07c';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(120,90,30,0.1)';
    for (let x = 0; x < w; x += 4) ctx.fillRect(x, 0, 1, h);
    // ruled sheet, a bit crooked
    ctx.save();
    ctx.translate(w / 2, h / 2 + 8); ctx.rotate(-0.02);
    ctx.fillStyle = 'rgba(70,50,15,0.25)'; ctx.fillRect(-127, -57, 258, 140);
    ctx.fillStyle = PAPER; ctx.fillRect(-129, -60, 258, 140);
    ctx.strokeStyle = 'rgba(70,120,195,0.33)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = -40; y < 80; y += 17) { ctx.moveTo(-129, y + 0.5); ctx.lineTo(129, y + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,30,40,0.55)';
    ctx.beginPath(); ctx.moveTo(-129, -41.5); ctx.lineTo(129, -41.5); ctx.moveTo(-129, -38.5); ctx.lineTo(129, -38.5); ctx.stroke();
    ctx.fillStyle = 'rgba(40,35,25,0.75)';
    ctx.font = `700 9px ${TYPE_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('FORM RR-03 · ROW COMPLIANCE RECORD', -120, -50);
    ctx.restore();
    const s = 27, ox = 5, base = h - 2;
    const rowA = ['JUNK', 'JUNK', 'JUNK', 'JUNK', null, 'JUNK', 'JUNK', 'JUNK', 'JUNK', 'JUNK'];
    rowA.forEach((k, i) => { if (k) ctx.drawImage(sprite(k, i === 7 ? 'IS' : null, s, i % 3), ox + i * s, base - s, s, s); });
    const rowB = [['J'], ['GOLD', 'T'], ['GOLD', 'IS'], ['L', 'GOLD'], ['L'], null, ['S'], ['S', 'FAST'], null, ['O']];
    rowB.forEach((k, i) => { if (k) ctx.drawImage(sprite(k[0], k[1] || null, s, (i + 1) % 3), ox + i * s, base - 2 * s, s, s); });
    drawStamp(ctx, stampImg('small'), ox + 2.5 * s, base - s, 2.4 * s, -0.07, 0.92);
    // the slam, just landed
    const cx = w - 72, cy = 36;
    drawStamp(ctx, stampImg('big', 'T IS GOLD'), cx, cy, 128, -0.13, 0.95);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = STAMP;
    const r = W.rng(11);
    for (let i = 0; i < 16; i++) {
      const a = r() * 6.28, d = 0.85 + r() * 0.4;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 70 * d, cy + Math.sin(a) * 30 * d, 0.6 + r() * r() * 3, 0, 6.28); ctx.fill();
    }
    ctx.restore();
  }

  W.register({
    id: 'rule-rows',
    num: 3,
    title: 'Rule Rows',
    mix: 'Row Compliance · word rules × blocks',
    pitch: 'The Department of Row Compliance. Type T IS GOLD into a row and it is policy, until that row is filed away.',
    palette: ['#c21f27', '#fbf8ef', '#f8c3ce', '#ead08f', '#22409e'],
    shell: { keysHint: '← → move · ↑ / Z rotate · ↓ soft drop · Space file it · C set aside · V turn slips over', logTitle: 'Carbon copies' },
    art(ctx, w, h) {
      const T = ctx.getTransform();
      const go = () => { ctx.setTransform(T); ctx.clearRect(0, 0, w, h); drawArt(ctx, w, h); };
      go();
      if (document.fonts && document.fonts.load) {
        Promise.all([document.fonts.load(`400 40px ${STAMP_FONT}`), document.fonts.load(`700 12px ${TYPE_FONT}`)])
          .then(() => { sprites.clear(); stamps.clear(); go(); }).catch(() => {});
      }
    },
    mount,
  });
})();

/* 04 Bunker Nine (fortress-well): tower defense on a falling-block well, on a green-phosphor radar scope.
 * A reactor sits at the bottom centre. Hostiles drop in from the top in waves, descend their
 * column, chew down through your blocks and hit the reactor when they touch it.
 * Every piece carries one TURRET block (autogun, cryo or mortar; E cycles it before it lands).
 * Locked turrets fire on their own. Pieces landing on a hostile crush it.
 * Clearing a line fires every turret in that row as a beam straight up its column,
 * wiping every hostile above. Between waves pick 1 of 3 resupply crates.
 * Art: vector CRT console. Wire-box pieces, wireframe hostiles, a radar sweep, phosphor persistence.
 */
(function () {
  const W = window.Wells;

  // ---------- palette ----------
  const PH = '#3dff7f';        // phosphor
  const PH_HI = '#c9ffd9';     // hot phosphor (beams, hostiles)
  const AMBER = '#ffb000';     // warnings
  const RED = '#ff3b30';       // reactor damage only
  const pa = (a) => `rgba(61,255,127,${a})`;

  const TURRETS = {
    gun: { name: 'Autogun', code: 'AG', range: 4, dmg: 1, rate: 0.6, desc: 'fast rounds at the nearest hostile' },
    frost: { name: 'Cryo', code: 'CR', range: 3.2, dmg: 0.3, rate: 1.0, desc: 'halves hostile speed' },
    mortar: { name: 'Mortar', code: 'MT', range: 6, dmg: 2.2, rate: 2.2, desc: 'slow lobbed shell, splash' },
  };
  const TKEYS = Object.keys(TURRETS);
  const ENEMIES = {
    grub: { hp: 3, speed: 0.55, chew: 1.4, dmg: 1, r: 0.32, call: 'CRAWLER' },
    runner: { hp: 2, speed: 1.25, chew: 1.0, dmg: 1, r: 0.26, call: 'RUNNER' },
    brute: { hp: 10, speed: 0.3, chew: 0.55, dmg: 2, r: 0.42, call: 'HEAVY' },
  };
  const CORE_X = [4, 5];
  const CORE_HP = 12;
  const UPGRADES = [
    { id: 'dmg', name: 'AP rounds', desc: 'All turrets hit 40% harder.', apply: (u) => (u.dmg *= 1.4) },
    { id: 'range', name: 'Mast extension', desc: 'All turrets reach +1 cell.', apply: (u) => (u.range += 1) },
    { id: 'rate', name: 'Autoloaders', desc: 'All turrets fire 25% faster.', apply: (u) => (u.rate *= 0.75) },
    { id: 'repair', name: 'Reactor patch', desc: 'Restore 5 reactor. Max +2.', apply: (u, g) => { g.coreMax += 2; g.coreHp = Math.min(g.coreMax, g.coreHp + 5); } },
    { id: 'laser', name: 'Wide aperture', desc: 'Volley beams 2 columns wider.', apply: (u) => (u.laser += 1) },
    { id: 'splash', name: 'HE shells', desc: 'Mortar splash +0.7 cells.', apply: (u) => (u.splash += 0.7) },
    { id: 'chill', name: 'Deep cryo', desc: 'Cryo slows to quarter speed, lasts longer.', apply: (u) => { u.slow = 0.25; u.slowT += 1.5; } },
    { id: 'armor', name: 'Plate armor', desc: 'Hostiles chew 35% slower.', apply: (u) => (u.chew *= 1.35) },
  ];
  // Faint interior stencil per piece type, so shapes read apart in monochrome.
  const MARK = { I: 'h', O: 'dot', T: 'plus', S: 'sl', Z: 'bs', J: 'jl', L: 'jr' };

  // ---------- vector drawing ----------
  // Double stroke = phosphor glow without shadowBlur.
  function glowStroke(ctx, lw, color, glow = 0.22) {
    ctx.strokeStyle = color;
    const a = ctx.globalAlpha;
    ctx.lineWidth = lw * 3.2; ctx.globalAlpha = a * glow; ctx.stroke();
    ctx.lineWidth = lw; ctx.globalAlpha = a; ctx.stroke();
  }

  function glyph(ctx, kind, cx, cy, r, a, color = PH_HI) {
    if (a == null) a = -Math.PI / 2;
    const lw = Math.max(1.2, r * 0.13);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (kind === 'gun') {
      ctx.arc(cx, cy, r * 0.36, 0, Math.PI * 2);
      ctx.moveTo(cx + Math.cos(a) * r * 0.36, cy + Math.sin(a) * r * 0.36);
      ctx.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
      // sight ticks
      for (let i = 0; i < 4; i++) {
        const k = a + Math.PI / 2 + (i * Math.PI) / 2;
        if (i === 3) continue;
        ctx.moveTo(cx + Math.cos(k) * r * 0.55, cy + Math.sin(k) * r * 0.55);
        ctx.lineTo(cx + Math.cos(k) * r * 0.75, cy + Math.sin(k) * r * 0.75);
      }
    } else if (kind === 'frost') {
      for (let i = 0; i < 3; i++) {
        const k = a + (i * Math.PI) / 3;
        ctx.moveTo(cx - Math.cos(k) * r * 0.82, cy - Math.sin(k) * r * 0.82);
        ctx.lineTo(cx + Math.cos(k) * r * 0.82, cy + Math.sin(k) * r * 0.82);
      }
      for (let i = 0; i < 6; i++) {
        const k = a + (i * Math.PI) / 3, ex = cx + Math.cos(k) * r * 0.6, ey = cy + Math.sin(k) * r * 0.6;
        ctx.moveTo(ex + Math.cos(k + 2.2) * r * 0.2, ey + Math.sin(k + 2.2) * r * 0.2);
        ctx.lineTo(ex, ey);
        ctx.lineTo(ex + Math.cos(k - 2.2) * r * 0.2, ey + Math.sin(k - 2.2) * r * 0.2);
      }
    } else {
      // mortar: dome on a base plate, stubby tube following the aim
      const by = cy + r * 0.45;
      ctx.moveTo(cx - r * 0.8, by); ctx.lineTo(cx + r * 0.8, by);
      ctx.moveTo(cx + r * 0.55, by);
      ctx.arc(cx, by, r * 0.55, 0, Math.PI, true);
      const ox = cx, oy = by - r * 0.3;
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox + Math.cos(a) * r * 0.95, oy + Math.sin(a) * r * 0.95);
      glowStroke(ctx, lw, color);
      ctx.beginPath();
      ctx.lineWidth = lw * 2.2;
      ctx.moveTo(ox + Math.cos(a) * r * 0.5, oy + Math.sin(a) * r * 0.5);
      ctx.lineTo(ox + Math.cos(a) * r * 0.95, oy + Math.sin(a) * r * 0.95);
      ctx.stroke();
      ctx.restore();
      return;
    }
    glowStroke(ctx, lw, color);
    ctx.restore();
  }

  // Wire-box sprite for one cell. mask bits: 1 up, 2 right, 4 down, 8 left (same piece);
  // 16 ur, 32 dr, 64 dl, 128 ul diagonals missing at concave corners.
  const spriteCache = new Map();
  function blockSprite(mask, type, turret, ghost, s, dpr) {
    const key = `${mask}|${type}|${turret ? 1 : 0}|${ghost ? 1 : 0}|${s}|${dpr}`;
    let cv = spriteCache.get(key);
    if (cv) return cv;
    if (spriteCache.size > 900) spriteCache.clear();
    const P = 4;
    cv = document.createElement('canvas');
    cv.width = Math.ceil((s + P * 2) * dpr); cv.height = cv.width;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, P * dpr, P * dpr);
    const e = 1.5, U = mask & 1, R = mask & 2, D = mask & 4, L = mask & 8;
    if (!ghost) {
      c.fillStyle = pa(turret ? 0.17 : 0.075);
      c.fillRect(L ? 0 : e, U ? 0 : e, s - (L ? 0 : e) - (R ? 0 : e), s - (U ? 0 : e) - (D ? 0 : e));
      // faint seam to the same-piece neighbour on the right / below
      c.strokeStyle = pa(0.13); c.lineWidth = 1; c.setLineDash([2, 3]);
      c.beginPath();
      if (R) { c.moveTo(s - 0.5, 4); c.lineTo(s - 0.5, s - 4); }
      if (D) { c.moveTo(4, s - 0.5); c.lineTo(s - 4, s - 0.5); }
      c.stroke(); c.setLineDash([]);
      // stencil mark
      if (!turret) {
        const m = MARK[type], h = s / 2, q = s * 0.16;
        c.strokeStyle = pa(0.42); c.fillStyle = pa(0.42); c.lineWidth = 1.2; c.lineCap = 'round';
        c.beginPath();
        if (m === 'h') { c.moveTo(h - q, h - 2); c.lineTo(h + q, h - 2); c.moveTo(h - q, h + 2); c.lineTo(h + q, h + 2); }
        else if (m === 'dot') { c.arc(h, h, 1.8, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(h, h, q, 0, Math.PI * 2); }
        else if (m === 'plus') { c.moveTo(h - q, h); c.lineTo(h + q, h); c.moveTo(h, h - q); c.lineTo(h, h + q); }
        else if (m === 'sl') { c.moveTo(h - q, h + q); c.lineTo(h + q, h - q); }
        else if (m === 'bs') { c.moveTo(h - q, h - q); c.lineTo(h + q, h + q); }
        else if (m === 'jl') { c.moveTo(h - q, h - q); c.lineTo(h - q, h + q); c.lineTo(h + q, h + q); }
        else if (m === 'jr') { c.moveTo(h + q, h - q); c.lineTo(h + q, h + q); c.lineTo(h - q, h + q); }
        c.stroke();
      }
    }
    // outer edges
    c.beginPath();
    const x0 = L ? 0 : e, x1 = R ? s : s - e, y0 = U ? 0 : e, y1 = D ? s : s - e;
    if (!U) { c.moveTo(x0, e); c.lineTo(x1, e); }
    if (!R) { c.moveTo(s - e, y0); c.lineTo(s - e, y1); }
    if (!D) { c.moveTo(x1, s - e); c.lineTo(x0, s - e); }
    if (!L) { c.moveTo(e, y1); c.lineTo(e, y0); }
    // concave corners
    if (mask & 16) { c.moveTo(s - e, 0); c.lineTo(s - e, e); c.lineTo(s, e); }
    if (mask & 32) { c.moveTo(s, s - e); c.lineTo(s - e, s - e); c.lineTo(s - e, s); }
    if (mask & 64) { c.moveTo(e, s); c.lineTo(e, s - e); c.lineTo(0, s - e); }
    if (mask & 128) { c.moveTo(0, e); c.lineTo(e, e); c.lineTo(e, 0); }
    c.lineCap = 'square';
    if (ghost) { c.setLineDash([3, 3]); c.strokeStyle = pa(0.5); c.lineWidth = 1.2; c.stroke(); }
    else {
      c.strokeStyle = PH; c.lineWidth = 5; c.globalAlpha = 0.16; c.stroke();
      c.lineWidth = 1.6; c.globalAlpha = 1; c.stroke();
    }
    spriteCache.set(key, cv);
    return cv;
  }
  function maskOf(same, x, y) {
    let m = 0;
    const u = same(x, y - 1), r = same(x + 1, y), d = same(x, y + 1), l = same(x - 1, y);
    if (u) m |= 1; if (r) m |= 2; if (d) m |= 4; if (l) m |= 8;
    if (u && r && !same(x + 1, y - 1)) m |= 16;
    if (d && r && !same(x + 1, y + 1)) m |= 32;
    if (d && l && !same(x - 1, y + 1)) m |= 64;
    if (u && l && !same(x - 1, y - 1)) m |= 128;
    return m;
  }
  function paintBlock(ctx, b, px, py, s, mask, ghost) {
    const dpr = window.devicePixelRatio || 1;
    const cv = blockSprite(mask, b.t || 'O', !!b.turret, ghost, s, dpr);
    ctx.drawImage(cv, px - 4, py - 4, s + 8, s + 8);
    if (b.turret && !ghost) glyph(ctx, b.turret, px + s / 2, py + s / 2, s * 0.4, b.ang);
  }
  // Mini previews (queue / hold): mask from the piece's own rot-0 cells.
  function miniDraw(p) {
    if (!p) return {};
    const set = new Set(W.shapeCells(p.type, 0).map(([x, y]) => x + ',' + y));
    const same = (x, y) => set.has(x + ',' + y);
    return { drawBlock: (ctx, b, px, py, s, x, y) => paintBlock(ctx, b, px, py, s, maskOf(same, x, y), false) };
  }

  // Hostile wireframes. Stroke only.
  function drawHostile(ctx, kind, px, py, r, t, o) {
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const col = o.hit ? '#ffffff' : PH_HI;
    ctx.beginPath();
    if (kind === 'grub') {
      // segmented crawler: hexagon shell, legs that skitter
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r * 0.8;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.moveTo(px - r * 0.6, py); ctx.lineTo(px + r * 0.6, py);
      const w = Math.sin(t * 18 + o.seed) * r * 0.18;
      for (const sx of [-1, 1]) for (let k = -1; k <= 1; k++) {
        ctx.moveTo(px + sx * r * 0.85, py + k * r * 0.35);
        ctx.lineTo(px + sx * r * 1.3, py + k * r * 0.45 + (k ? w * sx : -w));
      }
    } else if (kind === 'runner') {
      ctx.moveTo(px, py - r); ctx.lineTo(px + r * 0.8, py); ctx.lineTo(px, py + r); ctx.lineTo(px - r * 0.8, py); ctx.closePath();
      ctx.moveTo(px, py - r * 0.4); ctx.lineTo(px, py + r * 0.4);
      // speed streaks trailing above
      ctx.moveTo(px - r * 0.45, py - r * 1.2); ctx.lineTo(px - r * 0.45, py - r * 2.1);
      ctx.moveTo(px + r * 0.45, py - r * 1.2); ctx.lineTo(px + r * 0.45, py - r * 1.8);
    } else {
      // heavy: armoured octagon with cross bracing
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      const q = r * 0.5;
      ctx.moveTo(px - q, py - q); ctx.lineTo(px + q, py + q);
      ctx.moveTo(px + q, py - q); ctx.lineTo(px - q, py + q);
      ctx.rect(px - q, py - q, q * 2, q * 2);
    }
    glowStroke(ctx, kind === 'brute' ? 2 : 1.6, col, 0.3);
    // chewing mandibles, amber
    if (o.chew) {
      const j = Math.abs(Math.sin(t * 22)) * r * 0.25;
      ctx.beginPath();
      ctx.moveTo(px - r * 0.45, py + r * 0.55); ctx.lineTo(px - j * 0.5, py + r * 0.95 + j);
      ctx.moveTo(px + r * 0.45, py + r * 0.55); ctx.lineTo(px + j * 0.5, py + r * 0.95 + j);
      ctx.globalAlpha = 1;
      glowStroke(ctx, 1.6, AMBER, 0.3);
    }
    ctx.restore();
  }

  // ---------- radar backdrop (static part cached) ----------
  let radarCache = null;
  function radarStatic(Wpx, Hpx, s, dpr) {
    const key = `${Wpx}x${Hpx}x${dpr}`;
    if (radarCache && radarCache.key === key) return radarCache.cv;
    const cv = document.createElement('canvas');
    cv.width = Wpx * dpr; cv.height = Hpx * dpr;
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = c.createRadialGradient(Wpx / 2, Hpx * 0.55, 10, Wpx / 2, Hpx * 0.55, Hpx * 0.75);
    g.addColorStop(0, '#04150a'); g.addColorStop(1, '#010502');
    c.fillStyle = g; c.fillRect(0, 0, Wpx, Hpx);
    // cell corner dots
    c.fillStyle = pa(0.16);
    for (let y = 1; y < Hpx / s; y++) for (let x = 1; x < Wpx / s; x++) c.fillRect(x * s - 0.5, y * s - 0.5, 1, 1);
    const cx = Wpx / 2, cy = Hpx - s * 0.5;
    c.strokeStyle = pa(0.13); c.lineWidth = 1;
    for (let r = 3; r <= 22; r += 3) {
      c.beginPath(); c.arc(cx, cy, r * s, Math.PI, Math.PI * 2); c.stroke();
    }
    c.setLineDash([2, 5]);
    for (let a = 1; a < 12; a++) {
      const k = Math.PI + (a / 12) * Math.PI;
      c.beginPath(); c.moveTo(cx + Math.cos(k) * s * 1.4, cy + Math.sin(k) * s * 1.4); c.lineTo(cx + Math.cos(k) * Hpx * 1.2, cy + Math.sin(k) * Hpx * 1.2); c.stroke();
    }
    c.setLineDash([]);
    c.font = `400 ${Math.round(s * 0.5)}px "VT323", monospace`;
    c.fillStyle = pa(0.32); c.textAlign = 'left'; c.textBaseline = 'bottom';
    for (let r = 6; r <= 18; r += 6) c.fillText(String(r * 10).padStart(3, '0'), cx + 3, cy - r * s - 2);
    // side tick rulers
    c.fillStyle = pa(0.25);
    for (let y = 0; y < Hpx / s; y++) { c.fillRect(0, y * s, y % 5 ? 3 : 7, 1); c.fillRect(Wpx - (y % 5 ? 3 : 7), y * s, 7, 1); }
    radarCache = { key, cv };
    return cv;
  }

  function mount(sh) {
    const rng = W.rng();
    const board = new W.Board(10, 20);
    const g = { coreHp: CORE_HP, coreMax: CORE_HP };
    let up, enemies = [], shots = [], beams = [], wave = 0, toSpawn = 0, spawnT = 0, kills = 0, score = 0, lines = 0;
    let phase = 'idle', over = false, chosen = [], nextTurret = null, pidSeq = 0;
    // feel
    let hitStop = 0, flashT = 0, joltT = 0, breachT = 0, radioT = 0, lastDt = 16, clock = 0;
    let lastToast = -99, sweepRev = -1, sweepAng = 0, lastTalk = -99, spawnCount = 0, lastStatic = 0, lastGun = 0;
    const SWEEP = 3.6; // seconds per revolution

    // ---------- sound ----------
    const A = W;
    const staticBurst = (vol = 0.03, dur = 0.07, at = 0) => A.noise({ dur, vol, at, filter: 'bandpass', freq: 2200 + Math.random() * 2600, q: 0.6 });
    W.voice = {
      move: [1900, 0.012, 'square', 0.008],
      rotate: () => { A.tone({ f: 1100, dur: 0.02, type: 'square', vol: 0.012 }); A.tone({ f: 1650, dur: 0.02, type: 'square', vol: 0.01, at: 0.025 }); },
      lock: () => { A.tone({ f: 110, f2: 70, dur: 0.08, type: 'square', vol: 0.03 }); A.noise({ dur: 0.04, vol: 0.05, filter: 'lowpass', freq: 900 }); },
      drop: () => { A.noise({ dur: 0.12, vol: 0.09, filter: 'lowpass', freq: 600, freq2: 120 }); A.tone({ f: 70, f2: 40, dur: 0.14, type: 'square', vol: 0.03 }); },
      clear: () => A.tone({ f: 1760, f2: 1320, dur: 0.06, type: 'square', vol: 0.015 }),
      big: () => A.tone({ f: 1760, f2: 880, dur: 0.1, type: 'square', vol: 0.02 }),
      buy: () => { for (let i = 0; i < 6; i++) A.tone({ f: 1200 + (i % 2) * 300, dur: 0.018, type: 'square', vol: 0.014, at: i * 0.045 }); },
      bad: () => alarm(),
      win: () => { A.tone({ f: 660, dur: 0.12, type: 'square', vol: 0.025 }); A.tone({ f: 990, dur: 0.22, type: 'square', vol: 0.025, at: 0.14 }); ping(0.4); },
      tick: [2400, 0.012, 'square', 0.008],
      coin: () => { staticBurst(0.04, 0.09); A.tone({ f: 520, f2: 260, dur: 0.07, type: 'square', vol: 0.016 }); },
      hit: () => { A.noise({ dur: 0.18, vol: 0.1, filter: 'lowpass', freq: 500, freq2: 80 }); A.tone({ f: 90, f2: 45, dur: 0.18, type: 'square', vol: 0.035 }); },
    };
    function ping(at = 0) {
      A.tone({ f: 1480, f2: 1420, dur: 0.55, type: 'sine', vol: 0.03, attack: 0.002, at });
      A.tone({ f: 1480, f2: 1420, dur: 0.4, type: 'sine', vol: 0.009, attack: 0.002, at: at + 0.24 });
    }
    function alarm() {
      for (let i = 0; i < 4; i++) A.tone({ f: i % 2 ? 620 : 880, dur: 0.11, type: 'square', vol: 0.03, at: i * 0.12, attack: 0.002 });
    }
    function zap(i) {
      const at = i * 0.05;
      A.tone({ f: 2600, f2: 110, dur: 0.34, type: 'sawtooth', vol: 0.03, at });
      A.tone({ f: 1300, f2: 70, dur: 0.3, type: 'square', vol: 0.016, at, detune: 12 });
      A.noise({ dur: 0.16, vol: 0.035, at, filter: 'highpass', freq: 3000 });
    }
    function squelch() { A.noise({ dur: 0.05, vol: 0.02, filter: 'highpass', freq: 2500 }); A.tone({ f: 1800, dur: 0.03, type: 'square', vol: 0.006, at: 0.05 }); }
    function hitStatic() { if (clock - lastStatic < 0.07) return; lastStatic = clock; staticBurst(0.014, 0.035); }

    // ---------- radio ----------
    const stamp = () => {
      const t = Math.floor(clock), m = Math.floor(t / 60), s2 = t % 60;
      return `${String(m).padStart(2, '0')}:${String(s2).padStart(2, '0')}`;
    };
    function radio(msg, opt = {}) {
      if (!opt.force && clock - lastTalk < 2.4) return;
      lastTalk = clock;
      sh.log(`<span class="fw-ts">${stamp()}</span><span class="fw-msg${opt.tone ? ' ' + opt.tone : ''}">${W.esc(msg)}</span>`);
      radioT = 0.5;
      squelch();
    }
    const flank = (x) => (x <= 2 ? 'LEFT FLANK' : x >= 7 ? 'RIGHT FLANK' : 'DEAD CENTER');

    // ---------- view ----------
    let activeMap = new Map(), ghostSet = new Set(), activePid = -1;
    const keyOf = (x, y) => (y + 4) * 16 + x;
    function sameAt(pid, ghost) {
      return (x, y) => {
        if (pid == null) return false;
        if (ghost) return ghostSet.has(keyOf(x, y));
        const b = board.get(x, y);
        if (b && b.pid === pid) return true;
        return activeMap.get(keyOf(x, y)) === pid;
      };
    }
    const persist = document.createElement('canvas');
    const pctx = persist.getContext('2d');

    const view = new W.BoardView(sh.canvas, board, {
      maxCell: 30,
      grid: false,
      background: drawBackground,
      drawBlock(ctx, b, px, py, s, x, y, o) {
        if (b.core) return;
        const ghost = !!o.ghost;
        paintBlock(ctx, b, px, py, s, maskOf(sameAt(b.pid, ghost), x, y), ghost);
      },
      clearFlash(ctx, rows, k, s, Wpx) {
        ctx.save();
        for (const y of rows) {
          ctx.fillStyle = pa(0.18 + 0.5 * k);
          ctx.fillRect(0, y * s, Wpx, s);
          const sx = (1 - k) * Wpx;
          ctx.fillStyle = PH_HI; ctx.globalAlpha = 0.9;
          ctx.fillRect(sx - 2, y * s, 4, s);
          ctx.fillRect(0, y * s + s / 2 - 1, Wpx, 2);
        }
        ctx.restore();
      },
      drawParticle(ctx, f, s) {
        const x = f.x * s, y = f.y * s;
        ctx.strokeStyle = f.color; ctx.lineWidth = f.size > 5 ? 2 : 1.3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - f.vx * s * 0.025, y - f.vy * s * 0.025); ctx.stroke();
      },
      textFont: '"VT323", monospace',
      textStroke: '#010502',
      textWeight: 400,
      overlay: drawOverlay,
    });
    sh.canvas.classList.add('fw-scope');

    const stats = (k) => {
      const T = TURRETS[k];
      return { range: T.range + up.range, dmg: T.dmg * up.dmg, rate: T.rate * up.rate };
    };

    // ---------- pieces ----------
    const bag = W.bag(W.TYPES, rng);
    function makePiece() {
      const type = bag();
      const p = W.piece(type);
      const ti = rng.int(4), tk = rng.pick(TKEYS), pid = ++pidSeq;
      p.blocks = p.blocks.map((_, i) => (i === ti ? { color: PH, t: type, pid, turret: tk, cd: 0 } : { color: PH, t: type, pid }));
      return p;
    }
    const st = new W.Stacker(board, {
      gravity: 800,
      clearDelay: 300,
      next() {
        const p = nextTurret || makePiece();
        nextTurret = makePiece();
        paintQueue();
        return p;
      },
      findClears(b) { return b.fullRows().filter((y) => !b.cells[y].some((c) => c && c.fixed)); },
      onLock(cells) {
        for (const c of cells) for (const e of enemies) if (!e.dead && e.x === c.x && overlapsRow(e, c.y)) kill(e, 'crush');
        paint();
      },
      onHold() { paintQueue(); },
      onClear(rows, rowBlocks) { fireLasers(rows, rowBlocks); },
      afterClear() {
        for (const e of enemies) if (!e.dead && (board.get(e.x, Math.floor(e.y)) || board.get(e.x, Math.ceil(e.y)))) kill(e, 'crush');
        paint();
      },
      beforeSpawn() { return !over; },
      onTopOut() { gameOver('WELL OVERRUN'); },
    });
    function cycleTurret() {
      const p = st.active;
      if (!st.canAct()) return;
      const c = p.blocks.find((b) => b.turret);
      c.turret = TKEYS[(TKEYS.indexOf(c.turret) + 1) % TKEYS.length];
      A.tone({ f: 900 + TKEYS.indexOf(c.turret) * 300, dur: 0.03, type: 'square', vol: 0.014 });
      A.tone({ f: 2400, dur: 0.012, type: 'square', vol: 0.01, at: 0.035 });
      paint();
    }

    // ---------- hostiles ----------
    const overlapsRow = (e, y) => Math.floor(e.y) === y || (Math.ceil(e.y) === y && e.y % 1 > 0.05);
    const ePos = (e) => ({ x: e.x + 0.5 + (e.dir || 0) * (e.walk || 0), y: e.y + 0.5 });
    function spawnEnemy() {
      const pool = ['grub', 'grub'];
      if (wave >= 2) pool.push('runner', 'runner');
      if (wave >= 3) pool.push('brute');
      if (wave >= 5) pool.push('brute', 'runner');
      const k = rng.pick(pool), E = ENEMIES[k];
      const hp = E.hp * (1 + 0.2 * (wave - 1));
      const x = rng.int(board.w);
      enemies.push({ kind: k, x, y: -1, hp, max: hp, chew: 0, slowT: 0, walk: 0, dir: 0, mode: 'fall', bob: rng() * 6, blip: 0, tgt: null });
      spawnCount++;
      if (k === 'brute') radio(`HEAVY ON SCOPE. ${flank(x)}. OVER.`, { force: true, tone: 'warn' });
      else if (spawnCount === 1 || rng.chance(0.3)) radio(`CONTACT. ${flank(x)}. OVER.`);
    }
    function kill(e, how) {
      if (e.dead) return;
      e.dead = true;
      kills++;
      const pts = (how === 'crush' ? 25 : how === 'laser' ? 20 : 10) * wave;
      score += pts;
      const p = ePos(e);
      view.burst(p.x, p.y, PH_HI, how === 'laser' ? 6 : 12, 6);
      if (how === 'crush') {
        view.float('SPLASH', p.x, p.y, AMBER, 22); view.shake(4); W.sfx('hit');
        if (rng.chance(0.5)) radio(rng.pick(['SPLASH ONE. GOOD DROP.', 'FLATTENED. NICE WORK.', 'CRATE ON TARGET. CONFIRMED.']));
      } else if (how === 'shot') W.sfx('coin');
    }
    function damage(e, d) {
      if (e.dead) return;
      e.hp -= d;
      e.hit = 0.1;
      hitStatic();
      if (e.hp <= 0) kill(e, 'shot');
    }
    function hitCore(e) {
      const E = ENEMIES[e.kind];
      g.coreHp -= E.dmg;
      e.dead = true;
      view.burst(5, board.h - 0.5, RED, 20, 7);
      view.shake(12);
      view.float(`REACTOR -${E.dmg}`, 5, board.h - 2, RED, 24);
      breachT = 0.7;
      if (clock - lastToast > 1.2) { lastToast = clock; W.sfx('bad'); sh.toast('REACTOR HIT', 'bad'); }
      if (g.coreHp > 0) {
        if (g.coreHp <= g.coreMax * 0.34) radio(`REACTOR CRITICAL. ${g.coreHp} LEFT. ALL HANDS.`, { force: true, tone: 'red' });
        else radio(`REACTOR HIT. ${g.coreHp} LEFT. HOLD THE LINE.`, { force: true, tone: 'red' });
      }
      if (g.coreHp <= 0) gameOver('REACTOR BREACHED');
    }
    function chewAt(e, x, y, dt) {
      const b = board.get(x, y);
      if (b.core) { hitCore(e); return; }
      e.chew += dt;
      const need = ENEMIES[e.kind].chew * up.chew;
      e.tgt = { x, y, k: Math.min(1, e.chew / need) };
      if (!e.toldChew && rng.chance(0.25)) radio(`THEY'RE IN THE WALLS. COLUMN ${x + 1}.`, { tone: 'warn' });
      e.toldChew = true;
      if (e.chew >= need) {
        e.chew = 0;
        e.tgt = null;
        board.set(x, y, null);
        view.burst(x + 0.5, y + 0.5, AMBER, 8, 4);
        A.noise({ dur: 0.07, vol: 0.04, filter: 'bandpass', freq: 900, q: 2 });
      }
    }
    function updateEnemies(dt) {
      const sweepRate = (Math.PI * 2) / SWEEP;
      for (const e of enemies) {
        if (e.dead) continue;
        e.tgt = null; // crack only drawn while this hostile is actively chewing
        e.hit = Math.max(0, (e.hit || 0) - dt);
        e.slowT = Math.max(0, e.slowT - dt);
        e.blip = Math.max(0, e.blip - dt * 1.4);
        const E = ENEMIES[e.kind];
        const sp = E.speed * (e.slowT > 0 ? up.slow : 1);
        if (st.active) for (const c of W.pieceCells(st.active)) if (c.x === Math.round(ePos(e).x - 0.5) && overlapsRow(e, c.y)) { kill(e, 'crush'); break; }
        if (e.dead) continue;
        if (e.mode === 'fall') {
          const r = Math.floor(e.y);
          if (r + 1 >= board.h) { e.y = board.h - 1; e.mode = 'walk'; e.dir = e.x < CORE_X[0] ? 1 : -1; e.chew = 0; continue; }
          const below = r + 1 >= 0 ? board.get(e.x, r + 1) : null;
          const onPiece = st.active && W.pieceCells(st.active).some((c) => c.x === e.x && c.y === r + 1);
          if (onPiece) e.y = r;
          else if (!below) { e.y = Math.min(r + 1, e.y + sp * dt); e.chew = 0; }
          else { e.y = r; chewAt(e, e.x, r + 1, dt * (e.slowT > 0 ? up.slow : 1)); }
        } else {
          const nx = e.x + e.dir, b = board.get(nx, e.y);
          if (b) { e.walk = 0; chewAt(e, nx, e.y, dt * (e.slowT > 0 ? up.slow : 1)); }
          else {
            e.chew = 0;
            e.walk += sp * dt;
            if (e.walk >= 1) { e.walk = 0; e.x = nx; }
            if (board.get(e.x, e.y)) kill(e, 'crush');
          }
        }
        // radar paint: the sweep lights a hostile as it passes
        const p = ePos(e), a = Math.atan2(p.y - (board.h - 0.5), p.x - 5);
        const d = (((sweepAng - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (d < sweepRate * dt * 1.5 + 0.01) e.blip = 1;
      }
      enemies = enemies.filter((e) => !e.dead);
    }

    // ---------- turrets ----------
    function updateTurrets(dt) {
      board.each((b, x, y) => {
        if (!b.turret) return;
        b.cd = (b.cd || 0) - dt;
        if (b.cd > 0) return;
        const S = stats(b.turret), cx = x + 0.5, cy = y + 0.5;
        let best = null, bd = 1e9;
        for (const e of enemies) {
          if (e.dead || e.y < -0.5) continue;
          const p = ePos(e), d = Math.hypot(p.x - cx, p.y - cy);
          if (d <= S.range && d < bd) { bd = d; best = e; }
        }
        if (!best) return;
        const p = ePos(best);
        b.ang = Math.atan2(p.y - cy, p.x - cx);
        b.cd = S.rate;
        if (b.turret === 'mortar') {
          shots.push({ kind: 'mortar', sx: cx, sy: cy, tx: p.x, ty: p.y, t: 0, T: 0.55 + bd * 0.06, dmg: S.dmg });
          A.noise({ dur: 0.08, vol: 0.035, filter: 'lowpass', freq: 400 });
        } else {
          shots.push({ kind: b.turret, x: cx, y: cy, px: cx, py: cy, target: best, lx: p.x, ly: p.y, dmg: S.dmg, speed: b.turret === 'gun' ? 16 : 10 });
          if (b.turret === 'gun') { if (clock - lastGun > 0.06) { lastGun = clock; A.tone({ f: 1500, f2: 900, dur: 0.025, type: 'square', vol: 0.009 }); } }
          else A.tone({ f: 2600, f2: 1800, dur: 0.06, type: 'sine', vol: 0.01 });
        }
      });
    }
    function updateShots(dt) {
      for (const s of shots) {
        if (s.kind === 'mortar') {
          s.t += dt;
          if (s.t >= s.T) {
            s.done = true;
            const R = 1.1 + up.splash;
            for (const e of enemies) { const p = ePos(e); if (Math.hypot(p.x - s.tx, p.y - s.ty) <= R) damage(e, s.dmg); }
            view.burst(s.tx, s.ty, PH, 10, 6);
            beams.push({ ring: true, x: s.tx, y: s.ty, r: R, t: 0.35, T: 0.35 });
            A.noise({ dur: 0.16, vol: 0.06, filter: 'lowpass', freq: 700, freq2: 100 });
          }
          continue;
        }
        if (s.target && !s.target.dead) { const p = ePos(s.target); s.lx = p.x; s.ly = p.y; }
        s.px = s.x; s.py = s.y;
        const dx = s.lx - s.x, dy = s.ly - s.y, d = Math.hypot(dx, dy), step = s.speed * dt;
        if (d <= step + 0.15) {
          s.done = true;
          if (s.target && !s.target.dead) {
            damage(s.target, s.dmg);
            if (s.kind === 'frost') { s.target.slowT = up.slowT; view.burst(s.lx, s.ly, PH, 4, 2); }
          }
        } else { s.x += (dx / d) * step; s.y += (dy / d) * step; }
      }
      shots = shots.filter((s) => !s.done);
    }

    // Line clear: every turret in the row fires a beam up its column. The signature volley.
    function fireLasers(rows, rowBlocks) {
      let n = 0, wiped = 0;
      rows.forEach((y, i) => {
        rowBlocks[i].forEach((b, x) => {
          if (!b || !b.turret) return;
          const x0 = Math.max(0, x - up.laser), x1 = Math.min(board.w - 1, x + up.laser);
          beams.push({ x0, x1, cx: x, y, t: 0.6, T: 0.6, delay: n * 0.05 });
          if (n < 7) zap(n);
          n++;
          for (const e of enemies) if (!e.dead && e.x >= x0 && e.x <= x1 && e.y < y + 0.5) { kill(e, 'laser'); wiped++; }
          for (let yy = y; yy >= 0; yy -= 2) view.burst(x + 0.5, yy + 0.5, PH_HI, 2, 3);
        });
      });
      lines += rows.length;
      const pts = 60 * rows.length * rows.length;
      score += pts;
      view.rowBurst(rows, () => PH);
      if (n) {
        view.shake(10 + n * 3);
        flashT = 0.42;
        joltT = 0.34;
        hitStop = 0.14;
        A.tone({ f: 90, f2: 35, dur: 0.6, type: 'sine', vol: 0.12 });
        A.noise({ dur: 0.4, vol: 0.06, filter: 'lowpass', freq: 1400, freq2: 120 });
        view.float(`VOLLEY x${n}`, board.w / 2, rows[0] - 1.2, PH_HI, 34);
        if (wiped) view.float(`${wiped} DOWN`, board.w / 2, rows[0] + 0.4, AMBER, 24);
        radio(wiped ? `VOLLEY AWAY. ${n} BEAM${n > 1 ? 'S' : ''}. ${wiped} DOWN. OVER.` : `VOLLEY AWAY. ${n} BEAM${n > 1 ? 'S' : ''}. NOTHING ON SCOPE. SAVE IT.`, { force: true, tone: 'hot' });
      } else {
        view.float(`+${pts}`, board.w / 2, rows[0] + 0.5, PH, 24);
        radio('ROW CLEARED. NO GUNS ON IT. WASTED. OVER.');
      }
    }

    // ---------- drawing ----------
    function drawBackground(ctx, Wpx, Hpx, s, t) {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = '#010502'; ctx.fillRect(-20, -20, Wpx + 40, Hpx + 40);
      ctx.drawImage(radarStatic(Wpx, Hpx, s, dpr), 0, 0, Wpx, Hpx);
      // sweep, centered on the reactor
      const cx = Wpx / 2, cy = Hpx - s * 0.5, R = Math.hypot(cx, cy) + s;
      const grad = ctx.createConicGradient(sweepAng, cx, cy);
      grad.addColorStop(0, pa(0));
      grad.addColorStop(0.78, pa(0));
      grad.addColorStop(0.96, pa(0.09));
      grad.addColorStop(1, pa(0.3));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, Wpx, Hpx);
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweepAng) * R, cy + Math.sin(sweepAng) * R);
      ctx.globalAlpha = 0.85;
      glowStroke(ctx, 1.6, PH, 0.3);
      ctx.restore();
      // incoming-wave warning strip
      if (phase === 'wave' && toSpawn > 0) {
        ctx.save();
        ctx.fillStyle = AMBER; ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t / 160);
        for (let x = 0; x < Wpx; x += 12) ctx.fillRect(x, 0, 6, 3);
        ctx.restore();
      }
    }

    function drawCore(ctx, s, t) {
      const cx = 5 * s, cy = (board.h - 0.5) * s;
      const frac = Math.max(0, g.coreHp / g.coreMax);
      const col = breachT > 0 && Math.floor(breachT * 14) % 2 ? RED : frac > 0.5 ? PH : frac > 0.25 ? AMBER : RED;
      const pulse = 0.5 + 0.5 * Math.sin(t * (frac > 0.34 ? 3 : 9));
      ctx.save();
      ctx.lineCap = 'round';
      // housing brackets across both core cells
      ctx.beginPath();
      const x0 = 4 * s + 2, x1 = 6 * s - 2, y0 = (board.h - 1) * s + 2, y1 = board.h * s - 1;
      ctx.moveTo(x0, y0 + 6); ctx.lineTo(x0, y0); ctx.lineTo(x0 + 6, y0);
      ctx.moveTo(x1 - 6, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + 6);
      ctx.moveTo(x0, y1 - 4); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - 4);
      glowStroke(ctx, 1.4, col);
      const r = s * 0.44;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); glowStroke(ctx, 1.4, col);
      ctx.beginPath(); ctx.arc(cx, cy, r * (0.22 + 0.1 * pulse), 0, Math.PI * 2); glowStroke(ctx, 1.6, col, 0.4);
      // three rotating vanes
      const spin = t * (frac > 0.34 ? 1.2 : 3.5);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = spin + (i * Math.PI * 2) / 3;
        ctx.moveTo(cx + Math.cos(a - 0.45) * r * 0.48, cy + Math.sin(a - 0.45) * r * 0.48);
        ctx.arc(cx, cy, r * 0.78, a - 0.45, a + 0.45);
        ctx.lineTo(cx + Math.cos(a + 0.45) * r * 0.48, cy + Math.sin(a + 0.45) * r * 0.48);
        ctx.arc(cx, cy, r * 0.48, a + 0.45, a - 0.45, true);
      }
      glowStroke(ctx, 1.2, col);
      // outward pulse ring
      ctx.beginPath(); ctx.arc(cx, cy, r * (1 + ((t * 0.8) % 1) * 1.6), Math.PI, Math.PI * 2);
      ctx.globalAlpha = 0.35 * (1 - ((t * 0.8) % 1));
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }

    function drawDynamic(c, s, t) {
      // hostiles
      for (const e of enemies) {
        if (e.dead) continue;
        const E = ENEMIES[e.kind], p = ePos(e), bob = Math.sin(t * 6 + e.bob) * 0.04;
        const px = p.x * s, py = (p.y + bob) * s, r = E.r * s;
        drawHostile(c, e.kind, px, py, r, t, { hit: e.hit > 0, chew: !!e.tgt, seed: e.bob });
        if (e.blip > 0) {
          c.save(); c.globalAlpha = e.blip * 0.8; c.strokeStyle = PH_HI; c.lineWidth = 1;
          c.beginPath(); c.arc(px, py, r * (1.3 + (1 - e.blip) * 1.6), 0, Math.PI * 2); c.stroke(); c.restore();
        }
        if (e.slowT > 0) {
          c.save(); c.setLineDash([3, 3]); c.lineDashOffset = t * 20; c.strokeStyle = PH; c.lineWidth = 1.2;
          c.beginPath(); c.arc(px, py, r + 4, 0, Math.PI * 2); c.stroke(); c.restore();
        }
        if (e.hp < e.max) {
          const n = 5, lit = Math.ceil((Math.max(0, e.hp) / e.max) * n), w = s * 0.8 / n;
          c.save(); c.fillStyle = PH;
          for (let i = 0; i < n; i++) { c.globalAlpha = i < lit ? 0.95 : 0.18; c.fillRect(px - s * 0.4 + i * w + 1, py - r - 7, w - 2, 3); }
          c.restore();
        }
      }
      // projectiles
      for (const q of shots) {
        c.save(); c.lineCap = 'round';
        if (q.kind === 'mortar') {
          const k = q.t / q.T, x = q.sx + (q.tx - q.sx) * k, y = q.sy + (q.ty - q.sy) * k - Math.sin(k * Math.PI) * 2.2;
          c.beginPath(); c.arc(x * s, y * s, s * 0.12, 0, Math.PI * 2); glowStroke(c, 1.6, PH_HI, 0.35);
        } else if (q.kind === 'gun') {
          const dx = q.lx - q.x, dy = q.ly - q.y, d = Math.hypot(dx, dy) || 1;
          c.beginPath(); c.moveTo(q.x * s, q.y * s); c.lineTo((q.x - (dx / d) * 0.35) * s, (q.y - (dy / d) * 0.35) * s);
          glowStroke(c, 1.8, PH_HI, 0.3);
        } else {
          const r = s * 0.12, a = t * 8;
          c.beginPath();
          for (let i = 0; i < 3; i++) { const k = a + (i * Math.PI) / 3; c.moveTo(q.x * s - Math.cos(k) * r, q.y * s - Math.sin(k) * r); c.lineTo(q.x * s + Math.cos(k) * r, q.y * s + Math.sin(k) * r); }
          glowStroke(c, 1.3, PH_HI, 0.3);
        }
        c.restore();
      }
      // beams and splash rings
      for (const b of beams) {
        c.save();
        if (b.ring) {
          const k = b.t / b.T;
          c.globalAlpha = k;
          c.beginPath(); c.arc(b.x * s, b.y * s, b.r * s * (1.25 - k * 0.45), 0, Math.PI * 2); glowStroke(c, 1.6, PH, 0.3);
          c.beginPath(); c.arc(b.x * s, b.y * s, b.r * s * (0.9 - k * 0.5), 0, Math.PI * 2); c.lineWidth = 1; c.stroke();
        } else {
          const live = b.T - b.t - b.delay;
          if (live < 0) { c.restore(); continue; }
          const k = Math.max(0, b.t / (b.T - b.delay));
          const reach = Math.min(1, live / 0.06);
          const yb = (b.y + 1) * s, yt = yb - reach * yb;
          const x0 = b.x0 * s, w = (b.x1 - b.x0 + 1) * s;
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = pa(0.22 * k);
          c.fillRect(x0 + 1, yt, w - 2, yb - yt);
          // vector core lines per column
          for (let x = b.x0; x <= b.x1; x++) {
            const cx = (x + 0.5) * s, main = x === b.cx;
            c.beginPath(); c.moveTo(cx, yb); c.lineTo(cx, yt);
            c.globalAlpha = k * (main ? 1 : 0.6);
            glowStroke(c, (main ? s * 0.16 : s * 0.08) * (0.4 + 0.6 * k), PH_HI, 0.45);
          }
          // scan ticks racing up the beam
          c.globalAlpha = k;
          c.fillStyle = '#ffffff';
          const off = (live * 60 * s) % (s * 1.5);
          for (let y = yb - off; y > yt; y -= s * 1.5) c.fillRect(x0 + w * 0.2, y, w * 0.6, 1.5);
          // muzzle bloom
          c.beginPath(); c.arc((b.cx + 0.5) * s, (b.y + 0.5) * s, s * (0.5 + (1 - k) * 0.8), 0, Math.PI * 2);
          glowStroke(c, 1.5, PH_HI, 0.4);
        }
        c.restore();
      }
    }

    function drawOverlay(ctx, s) {
      const t = performance.now() / 1000;
      const dpr = window.devicePixelRatio || 1;
      const Wpx = view.W, Hpx = view.H;
      // range rings
      ctx.save();
      ctx.setLineDash([2, 6]); ctx.lineWidth = 1; ctx.strokeStyle = PH; ctx.globalAlpha = 0.11;
      ctx.beginPath();
      board.each((b, x, y) => {
        if (!b.turret) return;
        const R = stats(b.turret).range * s;
        ctx.moveTo((x + 0.5) * s + R, (y + 0.5) * s);
        ctx.arc((x + 0.5) * s, (y + 0.5) * s, R, 0, Math.PI * 2);
      });
      ctx.stroke();
      ctx.restore();
      if (st.active) {
        const gy = st.ghostY(), c = W.pieceCells(st.active, st.active.rot, st.active.x, gy).find((q) => q.block.turret);
        if (c) {
          ctx.save();
          ctx.strokeStyle = PH; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.3; ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 12;
          ctx.beginPath(); ctx.arc((c.x + 0.5) * s, (c.y + 0.5) * s, stats(c.block.turret).range * s, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = `400 ${Math.round(s * 0.55)}px "VT323", monospace`; ctx.fillStyle = PH; ctx.globalAlpha = 0.8; ctx.textAlign = 'center';
          ctx.fillText(TURRETS[c.block.turret].code, (c.x + 0.5) * s, (c.y + 0.5) * s - stats(c.block.turret).range * s - 4);
          ctx.restore();
        }
      }
      // cracks: drawn only for blocks a living hostile is chewing right now
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const e of enemies) {
        if (e.dead || !e.tgt || !board.get(e.tgt.x, e.tgt.y)) continue;
        const px = e.tgt.x * s, py = e.tgt.y * s, k = e.tgt.k, side = e.mode === 'walk';
        ctx.beginPath();
        if (!side) {
          ctx.moveTo(px + s * 0.2, py + 2); ctx.lineTo(px + s * 0.42, py + s * 0.5 * k + 2);
          ctx.lineTo(px + s * 0.55, py + s * 0.25 * k + 2); ctx.lineTo(px + s * 0.75, py + s * 0.85 * k + 2);
        } else {
          const ex = e.dir > 0 ? px + 2 : px + s - 2, dir = e.dir > 0 ? 1 : -1;
          ctx.moveTo(ex, py + s * 0.2); ctx.lineTo(ex + dir * s * 0.5 * k, py + s * 0.42);
          ctx.lineTo(ex + dir * s * 0.25 * k, py + s * 0.6); ctx.lineTo(ex + dir * s * 0.85 * k, py + s * 0.8);
        }
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 20);
        glowStroke(ctx, 1.6, AMBER, 0.35);
      }
      ctx.restore();
      drawCore(ctx, s, t);

      // phosphor persistence layer for everything that moves
      if (persist.width !== Math.round(Wpx * dpr) || persist.height !== Math.round(Hpx * dpr)) {
        persist.width = Math.round(Wpx * dpr); persist.height = Math.round(Hpx * dpr);
      }
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.globalCompositeOperation = 'destination-out';
      pctx.globalAlpha = 1;
      pctx.fillStyle = `rgba(0,0,0,${1 - Math.pow(0.74, lastDt / 16.7)})`;
      pctx.fillRect(0, 0, persist.width, persist.height);
      pctx.globalCompositeOperation = 'source-over';
      pctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawDynamic(pctx, s, t);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(persist, 0, 0, Wpx, Hpx);
      ctx.restore();

      // full-well phosphor flash
      if (flashT > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = pa(Math.min(0.55, flashT * 1.4));
        ctx.fillRect(0, 0, Wpx, Hpx);
        ctx.restore();
      }
      // reactor breach: red bloom rising from the floor
      if (breachT > 0) {
        ctx.save();
        const gr = ctx.createLinearGradient(0, Hpx, 0, Hpx - s * 6);
        gr.addColorStop(0, `rgba(255,59,48,${0.45 * breachT})`); gr.addColorStop(1, 'rgba(255,59,48,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, Hpx - s * 6, Wpx, s * 6);
        ctx.strokeStyle = RED; ctx.globalAlpha = breachT; ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, Wpx - 3, Hpx - 3);
        ctx.restore();
      }
      // CRT tear: shift a few horizontal bands of the frame
      if (joltT > 0) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const cw = sh.canvas.width, chh = sh.canvas.height;
        for (let i = 0; i < 4; i++) {
          const bh = Math.floor((8 + Math.random() * 40) * dpr), by = Math.floor(Math.random() * (chh - bh));
          const dx = Math.round((Math.random() - 0.5) * 22 * dpr * (joltT / 0.34));
          ctx.drawImage(sh.canvas, 0, by, cw, bh, dx, by, cw, bh);
        }
        ctx.restore();
      }
    }

    // ---------- waves ----------
    function startWave() {
      wave++;
      toSpawn = 4 + wave * 2;
      spawnT = 1.5;
      phase = 'wave';
      st.paused = false;
      sh.toast(`WAVE ${String(wave).padStart(2, '0')} // INBOUND`, 'warn');
      radio(`WAVE ${wave} INBOUND. ${toSpawn} HOSTILES ON SCOPE. OVER.`, { force: true });
      paint();
    }
    function endWave() {
      phase = 'break';
      st.paused = true;
      shots = [];
      W.sfx('win');
      const bonus = 100 * wave;
      score += bonus;
      radio(`WAVE ${wave} HELD. SCOPE CLEAR. RESUPPLY INBOUND. +${bonus}`, { force: true, tone: 'hot' });
      paint();
      const offers = rng.shuffle(UPGRADES.slice()).slice(0, 3);
      const body = W.el('div', 'modal-body');
      body.innerHTML = `<p class="fw-brief">WAVE ${wave} HELD. REACTOR ${g.coreHp}/${g.coreMax}. PICK ONE CRATE. OVER.</p>`;
      const tiles = W.el('div', 'tiles');
      let close = null;
      offers.forEach((u, i) => {
        const t = W.el('button', 'tile', `<span class="t-cost">CRATE ${'ABC'[i]}-${String(wave).padStart(2, '0')}</span><span class="t-name">${W.esc(u.name)}</span><span class="t-desc">${W.esc(u.desc)}</span>`);
        t.type = 'button';
        t.addEventListener('click', () => {
          u.apply(up, g);
          chosen.push(u.name);
          W.sfx('buy');
          close();
          radio(`${u.name.toUpperCase()} FITTED. STAND BY.`, { force: true });
          startWave();
        });
        tiles.appendChild(t);
      });
      body.appendChild(tiles);
      close = sh.modal({ title: 'RESUPPLY DROP', body, wide: true, actions: [] });
    }
    function updateWave(dt) {
      if (phase !== 'wave') return;
      if (toSpawn > 0) {
        spawnT -= dt;
        if (spawnT <= 0) { spawnEnemy(); toSpawn--; spawnT = Math.max(0.8, 3.2 - wave * 0.22) * (0.6 + rng() * 0.8); }
      } else if (!enemies.length) endWave();
    }

    // ---------- input ----------
    const actions = { turret: cycleTurret };
    sh.stackerKeys(st, actions, { extra: { KeyE: 'turret', KeyT: 'turret' }, downStart: () => (st.soft = true), downEnd: () => (st.soft = false) });
    sh.pad({ left: () => st.move(-1), right: () => st.move(1), down: () => st.softDrop(), rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), hold: () => st.hold(), turret: cycleTurret },
      [['◀', 'left', true], ['⟲', 'rotCCW'], ['⟳', 'rotCW'], ['▶', 'right', true], ['▼', 'down', true], ['⤓', 'drop'], ['HOLD', 'hold'], ['ORD', 'turret']]);

    // ---------- panels ----------
    const qp = sh.root.querySelector('.queue-panel');
    if (qp) { const hs = qp.querySelectorAll('h3'); if (hs[0]) hs[0].textContent = 'Next crate'; if (hs[1]) hs[1].textContent = 'Stowed'; }
    const corePanel = W.el('div', 'panel fw-core-panel');
    const turretPanel = W.el('div', 'panel fw-ord-panel');
    sh.extra.append(corePanel);
    // radio sits right under the reactor; ordnance table after it
    const logPanel = sh.side.querySelector('.log-panel');
    if (logPanel) { sh.extra.after(logPanel); logPanel.after(turretPanel); } else sh.extra.append(turretPanel);
    const SVG = {
      gun: '<circle cx="12" cy="12" r="4"/><path d="M12 8V2M5 12h3M16 12h3M12 16v3"/>',
      frost: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>',
      mortar: '<path d="M3 17h18M6.5 17a5.5 5.5 0 0 1 11 0M12 13.5V4"/>',
    };
    const svgOf = (k) => `<svg class="fw-glyph" viewBox="0 0 24 24" aria-hidden="true">${SVG[k]}</svg>`;
    function paintQueue() {
      sh.setQueue(nextTurret ? [nextTurret] : [], miniDraw(nextTurret));
      sh.setHold(st.holdPiece, miniDraw(st.holdPiece));
    }
    let lastPanel = '';
    function paint() {
      if (!up) return;
      const onScope = enemies.length + toSpawn;
      sh.hud([
        { label: 'Tally', value: String(score).padStart(6, '0'), tone: 'accent', wide: true },
        { label: 'Wave', value: String(wave).padStart(2, '0') },
        { label: 'On scope', value: String(onScope).padStart(2, '0'), tone: onScope ? 'bad' : 'good' },
        { label: 'Splashed', value: String(kills).padStart(3, '0') },
        { label: 'Rows fired', value: String(lines).padStart(3, '0') },
      ]);
      const hp = Math.max(0, g.coreHp), frac = hp / g.coreMax;
      const lvl = frac > 0.5 ? 'ok' : frac > 0.25 ? 'warn' : 'crit';
      const act = st.active && st.active.blocks.find((b) => b.turret);
      const html = `<h3>Reactor</h3>
        <div class="fw-core ${lvl}"><span class="fw-core-num">${String(hp).padStart(2, '0')}<small>/${g.coreMax}</small></span>
        <div class="fw-seg">${Array.from({ length: g.coreMax }, (_, i) => `<i class="${i < hp ? 'on' : ''}"></i>`).join('')}</div></div>
        <p class="fw-note"><b>Row clear = volley.</b> Every turret in a cleared row fires a beam straight up${up.laser ? ` (${1 + 2 * up.laser} columns wide)` : ''}, downing every hostile above it. Drop a crate on a hostile to flatten it.</p>
        ${chosen.length ? `<div class="chips">${chosen.map((c) => `<span class="chip accent">${W.esc(c)}</span>`).join('')}</div>` : ''}
        ||<h3>Ordnance · E cycles</h3>
        <div class="fw-ord"><span></span><span></span><span class="fw-h">DMG</span><span class="fw-h">RNG</span><span class="fw-h">ROF</span>
        ${TKEYS.map((k) => {
          const S = stats(k), on = act && act.turret === k;
          return `<span class="fw-ic${on ? ' on' : ''}">${svgOf(k)}</span><span class="fw-nm${on ? ' on' : ''}">${TURRETS[k].name}${on ? ' ◂' : ''}</span><span>${S.dmg.toFixed(1)}</span><span>${S.range.toFixed(1)}</span><span>${S.rate.toFixed(1)}s</span>`;
        }).join('')}</div>
        <p class="fw-note">${TKEYS.map((k) => `<b>${TURRETS[k].name}</b> ${TURRETS[k].desc}`).join(' · ')}.</p>`;
      if (html === lastPanel) return;
      lastPanel = html;
      const [a, b] = html.split('||');
      corePanel.innerHTML = a;
      turretPanel.innerHTML = b;
    }

    function gameOver(why) {
      if (over) return;
      over = true;
      phase = 'over';
      st.paused = true;
      paint();
      radio(why === 'REACTOR BREACHED' ? "WE'VE LOST THE REACTOR. BUNKER NINE, OUT." : 'WELL IS OVERRUN. FALL BACK. BUNKER NINE, OUT.', { force: true, tone: 'red' });
      sh.overlay({
        title: 'SIGNAL LOST',
        body: `<p class="fw-brief">${why} ON WAVE ${wave}.</p>
          <div class="fw-tally"><span>TALLY</span><b>${String(score).padStart(6, '0')}</b><span>SPLASHED</span><b>${kills}</b><span>ROWS FIRED</span><b>${lines}</b></div>
          <p class="fw-dim">FITTED: ${W.esc(chosen.join(', ').toUpperCase() || 'NOTHING')}</p>`,
        button: 'Reboot console',
      }).then(newRun);
    }

    const freshUp = () => ({ dmg: 1, range: 0, rate: 1, laser: 0, splash: 0, slow: 0.5, slowT: 2.5, chew: 1 });
    function newRun() {
      board.clear();
      st.reset();
      for (const x of CORE_X) board.set(x, board.h - 1, { color: PH, fixed: true, core: true });
      up = freshUp();
      g.coreHp = CORE_HP; g.coreMax = CORE_HP;
      enemies = []; shots = []; beams = []; wave = 0; kills = 0; score = 0; lines = 0; over = false; chosen = [];
      nextTurret = null; clock = 0; lastToast = -99; spawnCount = 0; lastTalk = -99;
      sh.logEl.innerHTML = '';
      view.texts = []; view.fx = []; flashT = joltT = breachT = hitStop = 0;
      pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, persist.width, persist.height);
      st.spawn();
      startWave();
    }

    let paintT = 0;
    const frame = sh.boardFrame;
    sh.loop((dt) => {
      const sec = dt / 1000;
      lastDt = dt;
      const busy = sh.busy();
      // radar sweep, with a ping each revolution
      const tt = performance.now() / 1000;
      const rev = Math.floor(tt / SWEEP);
      sweepAng = -Math.PI / 2 + ((tt / SWEEP) % 1) * Math.PI * 2;
      if (rev !== sweepRev) { if (sweepRev >= 0 && phase === 'wave' && !busy && !over) ping(); sweepRev = rev; }
      if (phase === 'wave' && !over && !busy) {
        clock += sec;
        if (hitStop > 0) hitStop -= sec;
        else {
          updateWave(sec);
          updateEnemies(sec);
          updateTurrets(sec);
          updateShots(sec);
        }
      }
      for (const b of beams) b.t -= sec;
      beams = beams.filter((b) => b.t > 0);
      flashT = Math.max(0, flashT - sec);
      joltT = Math.max(0, joltT - sec);
      breachT = Math.max(0, breachT - sec);
      radioT = Math.max(0, radioT - sec);
      frame.classList.toggle('fw-jolt', joltT > 0);
      frame.classList.toggle('fw-breach', breachT > 0);
      st.update(dt);
      // neighbour lookup for the falling piece's outline
      activeMap.clear(); ghostSet.clear();
      if (st.active) {
        const p = st.active, pid = p.blocks[0].pid, gy = st.ghostY();
        activePid = pid;
        for (const c of W.pieceCells(p)) activeMap.set(keyOf(c.x, c.y), pid);
        for (const c of W.pieceCells(p, p.rot, p.x, gy)) ghostSet.add(keyOf(c.x, c.y));
      }
      view.update(dt);
      view.draw(st);
      paintT -= dt;
      if (paintT <= 0) { paintT = 250; paint(); }
    });
    sh.own(() => { frame.classList.remove('fw-jolt', 'fw-breach'); });

    // debug hooks for headless playtests
    sh.debug = {
      volley() {
        for (const yy of [17, 18]) for (let x = 0; x < board.w; x++) board.set(x, yy, { color: PH, t: 'IOTSZJL'[x % 7], pid: 5000 + yy * 10 + (x >> 1), turret: x % 3 === 0 ? TKEYS[(x / 3 + yy) % 3] : null });
        for (let i = 0; i < 6; i++) enemies.push({ kind: ['grub', 'runner', 'brute'][i % 3], x: [1, 3, 6, 8, 0, 9][i], y: 4 + i * 1.7, hp: 5, max: 6, chew: 0, slowT: 0, walk: 0, dir: 0, mode: 'fall', bob: i, blip: 0, tgt: null });
        st.active = null;
        st.checkClears();
      },
      seed() {
        // a mid-game stack with a few hostiles chewing
        const rows = { 19: '1111..1111', 18: '1111.11.11', 17: '.111..1111', 16: '..1....11.', 15: '.........1' };
        let pid = 7000;
        for (const [y, r] of Object.entries(rows)) [...r].forEach((ch, x) => { if (ch === '1' && !board.get(x, +y)) board.set(x, +y, { color: PH, t: 'IOTSZJL'[(x + +y) % 7], pid: pid + Math.floor(x / 2) + +y * 10, turret: (x * 7 + +y) % 5 === 0 ? TKEYS[(x + +y) % 3] : null }); });
        enemies.push({ kind: 'grub', x: 2, y: 15, hp: 3, max: 3, chew: 0.6, slowT: 0, walk: 0, dir: 0, mode: 'fall', bob: 1, blip: 0, tgt: null });
        enemies.push({ kind: 'brute', x: 7, y: 6.3, hp: 7, max: 10, chew: 0, slowT: 2, walk: 0, dir: 0, mode: 'fall', bob: 2, blip: 0, tgt: null });
        enemies.push({ kind: 'runner', x: 4, y: 3.2, hp: 2, max: 2, chew: 0, slowT: 0, walk: 0, dir: 0, mode: 'fall', bob: 3, blip: 0, tgt: null });
      },
      hitCore() { hitCore({ kind: 'grub' }); },
      spawnAt(kind, x, y) { const E = ENEMIES[kind]; enemies.push({ kind, x, y, hp: E.hp * 9, max: E.hp * 9, chew: 0, slowT: 0, walk: 0, dir: 0, mode: 'fall', bob: 0, blip: 0, tgt: null }); },
      kill() { for (const e of enemies) kill(e, 'shot'); },
      clearWave() { toSpawn = 0; for (const e of enemies) kill(e, 'shot'); },
      state: () => ({ wave, phase, enemies: enemies.length, cracks: enemies.filter((e) => e.tgt).length, hp: g.coreHp }),
    };

    up = freshUp();
    for (const x of CORE_X) board.set(x, board.h - 1, { color: PH, fixed: true, core: true });
    paint();
    view.draw(st);
    sh.overlay({
      title: 'BUNKER NINE',
      body: `<p class="fw-brief">SCOPE ONE IS YOURS. THE REACTOR SITS AT THE BOTTOM OF THE WELL. KEEP IT LIT.</p>
        <ul>
        <li>Hostiles drop in from the top and chew down through your blocks toward the reactor.</li>
        <li>Every crate carries one <b>turret</b>: autogun, cryo or mortar. <b>E</b> cycles it while it falls. Turrets fire on their own.</li>
        <li>Drop a crate on a hostile to flatten it.</li>
        <li><b>Clearing a row fires a volley.</b> Every turret in that row shoots a beam straight up and downs everything above it.</li></ul>
        <p class="fw-dim">— SGT. MARROW, CH 9</p>`,
      button: 'Man the scope',
    }).then(newRun);
  }

  // ---------- hub card art ----------
  function art(ctx, w, h) {
    ctx.fillStyle = '#010502'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h + 6;
    ctx.strokeStyle = pa(0.16); ctx.lineWidth = 1;
    for (let r = 22; r < 200; r += 22) { ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI * 2); ctx.stroke(); }
    ctx.setLineDash([2, 4]);
    for (let a = 1; a < 8; a++) { const k = Math.PI + (a / 8) * Math.PI; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(k) * 220, cy + Math.sin(k) * 220); ctx.stroke(); }
    ctx.setLineDash([]);
    // sweep wedge
    const sa = -Math.PI * 0.32;
    const gr = ctx.createConicGradient(sa, cx, cy);
    gr.addColorStop(0, pa(0)); gr.addColorStop(0.86, pa(0)); gr.addColorStop(1, pa(0.32));
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sa) * 240, cy + Math.sin(sa) * 240); glowStroke(ctx, 1.4, PH, 0.3);
    // stack of wire boxes
    const s = 14, ox = cx - 5 * s, by = h - s - 2;
    const cols = [3, 4, 2, 1, 0, 0, 3, 5, 3, 2];
    const occ = new Set();
    cols.forEach((n, x) => { for (let i = 0; i < n; i++) occ.add(x + ',' + i); });
    const pidOf = (x, i) => Math.floor(x / 2) * 10 + (i >> 1);
    cols.forEach((n, x) => {
      for (let i = 0; i < n; i++) {
        if (x === 4 || x === 5) continue;
        const same = (xx, yy) => occ.has(xx + ',' + (-yy)) && pidOf(xx, -yy) === pidOf(x, i);
        const b = { t: 'IOTSZJL'[(x + i) % 7], turret: (x * 3 + i) % 4 === 0 ? TKEYS[(x + i) % 3] : null, ang: -1.2 - x * 0.08 };
        paintBlock(ctx, b, ox + x * s, by - i * s, s, maskOf(same, x, -i), false);
      }
    });
    // reactor
    ctx.beginPath(); ctx.arc(cx, by + s / 2, s * 0.55, 0, Math.PI * 2); glowStroke(ctx, 1.3, PH);
    ctx.beginPath(); ctx.arc(cx, by + s / 2, s * 0.22, 0, Math.PI * 2); glowStroke(ctx, 1.3, PH);
    // a volley beam
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const bx = ox + 7.5 * s;
    ctx.fillStyle = pa(0.18); ctx.fillRect(bx - s / 2, 0, s, by - 4 * s + s);
    ctx.beginPath(); ctx.moveTo(bx, by - 4 * s + s / 2); ctx.lineTo(bx, 0); glowStroke(ctx, 2.4, PH_HI, 0.45);
    ctx.restore();
    // hostiles
    drawHostile(ctx, 'grub', ox + 2.5 * s, 34, 6, 0, { seed: 0 });
    drawHostile(ctx, 'brute', ox + 7.5 * s, 22, 8, 0, { hit: true, seed: 0 });
    drawHostile(ctx, 'runner', ox + 9.4 * s, 50, 5, 0, { seed: 0 });
    drawHostile(ctx, 'grub', ox - 2.2 * s, 64, 5.5, 0, { seed: 1 });
    ctx.beginPath(); ctx.arc(ox + 2.5 * s, 34, 12, 0, Math.PI * 2); ctx.strokeStyle = pa(0.5); ctx.lineWidth = 1; ctx.stroke();
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  }

  W.register({
    id: 'fortress-well',
    num: 4,
    title: 'Bunker Nine',
    mix: 'Tower defense × falling blocks',
    pitch: 'Every crate carries a turret. Hostiles chew toward the reactor. Clear a row and its turrets fire as one volley.',
    palette: [PH, PH_HI, AMBER, '#1a8f45', '#0c4a22'],
    shell: { logTitle: 'Radio · SGT. Marrow · CH 9', keysHint: '← → traverse · ↑ / Z rotate · ↓ soft drop · Space drop · C stow · E ordnance' },
    art,
    mount,
  });
})();

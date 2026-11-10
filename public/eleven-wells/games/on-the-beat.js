/* 08 Niteshift (id on-the-beat): rhythm game × falling blocks, set in a neon night club.
 * A generated track plays. The active piece falls exactly one row per beat. Hard-dropping within
 * ±90ms of a beat is Perfect, ±160ms is Good: both grow the streak, and the streak is the score
 * multiplier. The streak also builds the band: hats at 2, bass at 4, lead at 8, stabs at 12 and
 * everything at 16. Crossing 4/8/12/16 "drops the beat" on the next beat (riser, flash, crowd jump,
 * new layer). Off-beat drops reset the streak and the band falls back to kick and clap. A piece left
 * to land on its own locks on the next beat and halves the streak.
 * A track lasts about 90 seconds at any tempo; its target scales with its beat count.
 * The game clock is performance.now(); audio is scheduled ahead onto that clock through the game's
 * own AudioContext, so muting only silences it and the beat keeps going.
 */
(function () {
  const W = window.Wells;

  const SONG_SEC = 90;
  const BASE_BEATS = 256; // the old 64-bar 4/4 song the targets were tuned for
  const PERFECT = 90, GOOD = 160, WIDE = 220;
  const LINE_PTS = [0, 100, 300, 500, 800];
  const MAX_STREAK = 16;
  const SEVEN = [[2, 2, 3], [3, 2, 2], [2, 3, 2]];
  const SIGS = {
    '4/4': { label: 'Four on the floor', desc: 'Four even beats a bar.', factor: 1, eighths: 8, beats: 4, groups: () => [2, 2, 2, 2] },
    '3/4': { label: 'Waltz', desc: 'Three beats a bar, heavy on one.', factor: 1.2, eighths: 6, beats: 3, groups: () => [2, 2, 2] },
    '7/8': { label: 'Cursed', desc: 'Seven eighths in lopsided groups. The long beat moves every 2 bars.', factor: 1.6, eighths: 7, beats: 3, groups: (bar) => SEVEN[Math.floor(bar / 2) % 3] },
  };
  // Track length is set in seconds, so it is about 90s at any tempo or meter. Targets scale by beats.
  function plan(bpm, sig, songIdx) {
    const S = SIGS[sig], barMs = (S.eighths * 30000) / bpm;
    const bars = Math.max(16, Math.round((SONG_SEC * 1000) / barMs / 4) * 4);
    const beats = bars * S.beats;
    return { bars, beats, sec: Math.round((bars * barMs) / 1000), target: Math.round((10000 * Math.pow(1.5, songIdx) * beats) / BASE_BEATS / 100) * 100 };
  }
  const MODS = [
    { id: 'wide', name: 'Loose Window', cost: 4, desc: 'The Good window grows from ±160ms to ±220ms.' },
    { id: 'echo', name: 'Echo', cost: 5, desc: 'Perfect drops add 2 to the streak instead of 1.' },
    { id: 'downbeat', name: 'Bar One', cost: 4, desc: 'On-beat drops on the first beat of a bar score +150 × hype.' },
    { id: 'net', name: 'Rewind', cost: 5, desc: 'One off-beat drop every 8 bars keeps your streak.' },
    { id: 'half', name: 'Half-time', cost: 3, desc: 'Pieces fall one row every 2 beats.' },
    { id: 'dancer', name: 'Footwork', cost: 3, desc: 'Moves and turns on the beat score 4× as much.' },
    { id: 'bassdrop', name: 'Bass Drop', cost: 6, desc: 'Clearing 3+ lines doubles line score for the next 8 beats.' },
  ];
  const LEVELS = [
    { at: 0, name: 'KICK', call: 'KICK ONLY' },
    { at: 2, name: 'HATS', call: 'HATS IN!' },
    { at: 4, name: 'BASS', call: 'BASS IN!' },
    { at: 8, name: 'LEAD', call: 'LEAD IN!' },
    { at: 12, name: 'STABS', call: 'STABS IN!' },
    { at: 16, name: 'FULL SEND', call: 'FULL SEND!' },
  ];
  const levelOf = (s) => { let l = 0; LEVELS.forEach((L, i) => { if (s >= L.at) l = i; }); return l; };
  const ROOTS = [36, 38, 40, 41, 43, 45];
  const PROGS = [[0, 0, 5, 7], [0, 3, 5, 3], [0, -2, -4, -5], [0, 5, 3, 7], [0, 7, 5, 0]];
  const SCALE = [0, 3, 5, 7, 10, 12];
  const CHORD = [0, 3, 7, 10, 12, 15];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const MAG = '#ff2bd6', CYAN = '#19e6ff', HOT = '#ffe94d', MISS = '#ff6a3d';
  const NEON = { I: '#19e6ff', O: '#ffe94d', T: '#ff2bd6', S: '#7dff5a', Z: '#ff4a5e', J: '#6a7cff', L: '#ff9a3d' };
  const FONT = '"Exo 2", system-ui, sans-serif';

  // ---------- neon tube blocks ----------
  // Pieces are drawn as one continuous tube outline: a cell only draws the edges that face away from
  // its own piece. mask bits = same-piece neighbours: 1 up, 2 right, 4 down, 8 left, 16 UL, 32 UR, 64 DR, 128 DL.
  const NB = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [-1, -1, 16], [1, -1, 32], [1, 1, 64], [-1, 1, 128]];
  const sprites = new Map();
  function tube(color, s, mask, kind) { // kind 0 lit tube + dark core, 1 halo, 2 ghost
    const key = color + s + '|' + mask + '|' + kind;
    let c = sprites.get(key);
    if (c) return c;
    const dpr = window.devicePixelRatio || 1;
    const pad = Math.ceil(s * 0.6) + 2, size = s + pad * 2;
    c = document.createElement('canvas');
    c.width = c.height = Math.ceil(size * dpr);
    c.pad = pad; c.size = size;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.translate(pad, pad);
    const i = Math.max(2, s * 0.16);
    const U = mask & 1, R = mask & 2, D = mask & 4, L = mask & 8, UL = mask & 16, UR = mask & 32, DR = mask & 64, DL = mask & 128;
    if (kind === 0) {
      g.fillStyle = W.shade(color, -0.84);
      const x0 = L ? 0 : i, y0 = U ? 0 : i;
      g.fillRect(x0, y0, (R ? s : s - i) - x0, (D ? s : s - i) - y0);
      if (U && L && !UL) g.clearRect(0, 0, i, i);
      if (U && R && !UR) g.clearRect(s - i, 0, i, i);
      if (D && R && !DR) g.clearRect(s - i, s - i, i, i);
      if (D && L && !DL) g.clearRect(0, s - i, i, i);
    }
    g.beginPath();
    if (!U) { g.moveTo(L ? (UL ? -i : 0) : i, i); g.lineTo(R ? (UR ? s + i : s) : s - i, i); }
    if (!D) { g.moveTo(L ? (DL ? -i : 0) : i, s - i); g.lineTo(R ? (DR ? s + i : s) : s - i, s - i); }
    if (!L) { g.moveTo(i, U ? (UL ? -i : 0) : i); g.lineTo(i, D ? (DL ? s + i : s) : s - i); }
    if (!R) { g.moveTo(s - i, U ? (UR ? -i : 0) : i); g.lineTo(s - i, D ? (DR ? s + i : s) : s - i); }
    g.lineJoin = 'round';
    if (kind === 2) {
      g.lineCap = 'round';
      g.globalAlpha = 0.55;
      g.strokeStyle = color;
      g.lineWidth = Math.max(1, s * 0.055);
      g.setLineDash([Math.max(2, s * 0.14), Math.max(2, s * 0.1)]);
      g.stroke();
    } else if (kind === 1) {
      g.lineCap = 'butt';
      g.shadowColor = color;
      g.shadowBlur = s * 0.7 * dpr;
      g.strokeStyle = color;
      g.globalAlpha = 0.5;
      g.lineWidth = s * 0.2;
      g.stroke();
    } else {
      g.lineCap = 'round';
      g.shadowColor = color;
      g.shadowBlur = s * 0.32 * dpr;
      g.strokeStyle = color;
      g.lineWidth = Math.max(2, s * 0.13);
      g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = W.shade(color, 0.72);
      g.lineWidth = Math.max(1, s * 0.045);
      g.stroke();
    }
    sprites.set(key, c);
    return c;
  }
  const blit = (ctx, spr, px, py) => ctx.drawImage(spr, px - spr.pad, py - spr.pad, spr.size, spr.size);
  const maskMemo = {};
  function shapeMasks(type, rot) {
    const key = type + rot;
    if (!maskMemo[key]) {
      const cells = W.shapeCells(type, rot), set = new Set(cells.map(([x, y]) => x + ',' + y));
      maskMemo[key] = cells.map(([x, y]) => NB.reduce((m, [dx, dy, bit]) => (set.has(x + dx + ',' + (y + dy)) ? m | bit : m), 0));
    }
    return maskMemo[key];
  }
  // Mini previews (queue/hold): x, y are shape coords at rotation 0.
  function miniBlock(ctx, b, px, py, s, x, y) {
    const cells = W.shapeCells(b.type, 0), idx = cells.findIndex((c) => c[0] === x && c[1] === y);
    blit(ctx, tube(b.color, s, shapeMasks(b.type, 0)[idx] || 0, 0), px, py);
  }
  let pidN = 0;
  function makePiece(type) {
    const p = W.piece(type), id = ++pidN;
    p.blocks = p.blocks.map(() => ({ color: NEON[type], type, pid: id }));
    return p;
  }

  // ---------- shared drawing ----------
  function floorGrid(ctx, x0, y0, w, h, ph, a, rgb = '255,43,214') {
    ctx.save();
    ctx.strokeStyle = `rgba(${rgb},${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const vx = x0 + w / 2;
    for (let k = -7; k <= 7; k++) { ctx.moveTo(vx + k * w * 0.025, y0); ctx.lineTo(vx + k * w * 0.19, y0 + h); }
    const N = 7;
    for (let k = 0; k < N; k++) { const u = (k + ph) / N, y = y0 + h * u * u; ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); }
    ctx.stroke();
    ctx.fillStyle = `rgba(${rgb},${Math.min(1, a * 2.2)})`;
    ctx.fillRect(x0, y0 - 1, w, 2);
    ctx.restore();
  }
  // A backlit clubber. lift raises them off the floor; arms: 0 none, 1 one arm, 2 both.
  function person(c, x, base, k, lift, arms, head) {
    const hr = 4.6 * k * head, top = base - 20 * k - lift;
    c.beginPath();
    c.arc(x, top - hr - 1.5 * k, hr, 0, Math.PI * 2);
    const bh = 20 * k + 16; // fixed body length: a jumping clubber rises, they don't stretch
    if (c.roundRect) c.roundRect(x - 8 * k, top, 16 * k, bh, [6 * k, 6 * k, 0, 0]);
    else c.rect(x - 8 * k, top, 16 * k, bh);
    c.fill();
    if (arms) {
      c.beginPath();
      c.moveTo(x + 5.5 * k, top + 3 * k); c.lineTo(x + 9 * k, top - 13 * k);
      if (arms > 1) { c.moveTo(x - 5.5 * k, top + 3 * k); c.lineTo(x - 9 * k, top - 13 * k); }
      c.lineWidth = 3.2 * k;
      c.lineCap = 'round';
      c.stroke();
    }
  }
  function rimPerson(c, x, base, k, lift, arms, head, rim) {
    c.globalAlpha = rim;
    c.fillStyle = c.strokeStyle = MAG; person(c, x - 1.2, base, k, lift + 0.8, arms, head);
    c.fillStyle = c.strokeStyle = CYAN; person(c, x + 1.2, base, k, lift + 0.8, arms, head);
    c.globalAlpha = 1;
    c.fillStyle = c.strokeStyle = '#030106'; person(c, x, base, k, lift, arms, head);
  }

  function mount(sh) {
    const rng = W.rng();
    const board = new W.Board(10, 20);
    const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    let run = null, song = null, playing = false, pending = null;
    let streak = 0, songScore = 0, counts = { perfect: 0, good: 0, off: 0, auto: 0 };
    let lastBeat = { t: -1e9, accent: false }, lastJudge = null, bonusBeat = null, netBar = -99, bassUntil = -1, steps = 0;
    let mixLevel = 0, mixChange = null, dropNodes = [];
    let pulse = 0, phase = 0, dropAt = -1e9, slumpUntil = 0, flickerUntil = 0, callout = null, mcAt = -1e9, lastPq = -1;
    let actx = null, musicBus = null, sfxBus = null, mixFilter = null, noiseBuf = null;

    const mult = () => 1 + 0.25 * Math.min(streak, MAX_STREAK);
    const has = (id) => run && run.mods.includes(id);
    const goodMs = () => (has('wide') ? WIDE : GOOD);
    const factor = () => (run.bpm / 100) * SIGS[run.sig].factor;
    const fmt = (n) => n.toLocaleString();
    const beatMs = () => (song ? song.eighth * 2 : 600);

    // ---------- DOM ----------
    const backdrop = W.el('canvas', 'otb-backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    sh.root.prepend(backdrop);
    const bctx = backdrop.getContext('2d');
    const mc = W.el('div', 'otb-mc', '<canvas class="otb-face" aria-hidden="true"></canvas><div class="otb-bubble"><span class="otb-name">MC Strobe</span><span class="otb-line" aria-live="polite">Doors at nine.</span></div>');
    sh.boardCol.insertBefore(mc, sh.boardFrame);
    const face = mc.querySelector('canvas'), fctx = face.getContext('2d'), mcLine = mc.querySelector('.otb-line');
    const stage = W.el('canvas', 'otb-stage');
    stage.setAttribute('aria-hidden', 'true');
    sh.boardCol.insertBefore(stage, sh.padEl);
    const sctx = stage.getContext('2d');
    const flashEl = W.el('div', 'otb-flash');
    sh.root.appendChild(flashEl);

    const cell = Math.max(14, Math.min(W.autoCell(10, 20), Math.floor((window.innerHeight - 330) / 20)));

    // ---------- board rendering ----------
    let wellBg = null;
    function drawWell(ctx, Wd, Hd) {
      if (!wellBg || wellBg.w !== Wd || wellBg.h !== Hd) {
        wellBg = document.createElement('canvas');
        wellBg.w = Wd; wellBg.h = Hd;
        wellBg.width = Wd; wellBg.height = Hd;
        const g = wellBg.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, Hd);
        gr.addColorStop(0, '#030207'); gr.addColorStop(0.55, '#07040f'); gr.addColorStop(1, '#14061c');
        g.fillStyle = gr; g.fillRect(0, 0, Wd, Hd);
      }
      ctx.drawImage(wellBg, -20, -20, Wd + 40, Hd + 40);
      floorGrid(ctx, 0, Hd * 0.62, Wd, Hd * 0.38, phase, 0.07 + 0.13 * pulse);
      if (pulse > 0.03) {
        ctx.fillStyle = lastBeat.accent ? `rgba(255,43,214,${0.09 * pulse})` : `rgba(25,230,255,${0.05 * pulse})`;
        ctx.fillRect(-20, -20, Wd + 40, Hd + 40);
      }
    }
    function boardBlock(ctx, b, px, py, s, x, y, o) {
      const p = st.active;
      let m = 0, live = false;
      if (p && p.blocks[0].pid === b.pid) { live = true; m = shapeMasks(p.type, p.rot)[p.blocks.indexOf(b)] || 0; }
      else for (let k = 0; k < 8; k++) { const n = NB[k], c = board.get(x + n[0], y + n[1]); if (c && c.pid === b.pid) m |= n[2]; }
      if (o.ghost) { blit(ctx, tube(b.color, s, m, 2), px, py); return; }
      const now = performance.now();
      let a = 1;
      if (!live && now < flickerUntil) a = ((x * 3 + y * 5 + Math.floor(now / 45)) % 3 === 0) ? 0.2 : 0.75;
      ctx.globalAlpha = a;
      blit(ctx, tube(b.color, s, m, 0), px, py);
      const ha = (live ? 0.3 : 0.06) + (0.22 + 0.06 * mixLevel) * pulse;
      if (a > 0.5 && ha > 0.04) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(1, ha);
        blit(ctx, tube(b.color, s, m, 1), px, py);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    }
    function clearFlash(ctx, rows, k, s, Wd) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const y of rows) {
        ctx.fillStyle = `rgba(255,43,214,${0.4 * k})`;
        ctx.fillRect(0, y * s, Wd, s);
        const h = s * (0.12 + 0.75 * (1 - k));
        ctx.fillStyle = `rgba(220,250,255,${0.95 * k})`;
        ctx.fillRect(0, y * s + (s - h) / 2, Wd, h);
      }
      ctx.restore();
    }
    function drawParticle(ctx, f, s) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = f.color;
      ctx.lineWidth = Math.max(1.2, f.size * 0.45);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.x * s, f.y * s);
      ctx.lineTo((f.x - f.vx * 0.035) * s, (f.y - f.vy * 0.035) * s);
      ctx.stroke();
    }
    function drawOverlay(ctx) {
      const now = performance.now();
      if (callout) {
        const age = now - callout.at;
        if (age > callout.life) callout = null;
        else {
          const k = 1 + 0.45 * Math.exp(-age / 70), a = Math.min(1, (callout.life - age) / 280);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(view.W / 2, view.H * 0.38);
          ctx.font = `400 ${callout.size}px Monoton`;
          const fit = Math.min(1, (view.W * 0.92) / ctx.measureText(callout.text).width);
          ctx.scale(k * fit, k * fit);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = callout.color;
          ctx.shadowBlur = 22;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(callout.text, 0, 0);
          ctx.restore();
        }
      }
      const dk = (now - dropAt) / 520;
      if (dk >= 0 && dk < 1) {
        ctx.fillStyle = `rgba(255,${Math.round(235 - 190 * dk)},250,${(reduce ? 0.2 : 0.75) * (1 - dk) * (1 - dk)})`;
        ctx.fillRect(-20, -20, view.W + 40, view.H + 40);
      }
    }
    const view = new W.BoardView(sh.canvas, board, {
      cell,
      gridColor: 'rgba(190,140,255,0.05)',
      background: drawWell,
      drawBlock: boardBlock,
      clearFlash,
      drawParticle,
      overlay: drawOverlay,
      textFont: FONT,
      textWeight: 'italic 800',
      textStroke: '#05030a',
    });
    const say = (text, size = 64, color = MAG, life = 900) => { callout = { text: String(text), size, color, life, at: performance.now() }; };

    // ---------- the stage: beat lane + crowd under the well ----------
    const STAGE_H = 86;
    const crowd = [];
    let crowdW = 0, stageGlow = null;
    function buildCrowd(w) {
      const r = W.rng(808);
      crowd.length = 0;
      const back = Math.round(w / 12), front = Math.round(w / 17);
      for (let i = 0; i < back; i++) crowd.push({ row: 0, x: ((i + 0.2 + r() * 0.6) * w) / back, k: 0.68 + r() * 0.18, lag: r() * 0.16, join: r(), arm: r(), head: 0.9 + r() * 0.3 });
      for (let i = 0; i < front; i++) crowd.push({ row: 1, x: ((i + 0.25 + r() * 0.5) * w) / front, k: 0.95 + r() * 0.22, lag: r() * 0.12, join: r(), arm: r(), head: 0.88 + r() * 0.3 });
      crowdW = w;
    }
    function drawStage(now) {
      const w = view.W, dpr = window.devicePixelRatio || 1, c = sctx;
      if (stage.width !== Math.round(w * dpr) || stage.height !== Math.round(STAGE_H * dpr)) {
        stage.width = Math.round(w * dpr); stage.height = Math.round(STAGE_H * dpr);
        stage.style.width = w + 'px'; stage.style.height = STAGE_H + 'px';
        stageGlow = null;
      }
      if (crowdW !== w) buildCrowd(w);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = '#040208';
      c.fillRect(0, 0, w, STAGE_H);
      if (!stageGlow) {
        stageGlow = c.createLinearGradient(0, 30, 0, STAGE_H);
        stageGlow.addColorStop(0, 'rgba(255,43,214,0)');
        stageGlow.addColorStop(1, 'rgba(255,43,214,0.85)');
      }
      // crowd, lit from the stage behind them
      c.globalAlpha = 0.18 + 0.5 * pulse * (0.4 + mixLevel * 0.12);
      c.fillStyle = stageGlow;
      c.fillRect(0, 30, w, STAGE_H - 30);
      c.globalAlpha = 1;
      const amp = [1, 2, 3.4, 5, 7, 9.5][mixLevel];
      const jt = (now - dropAt) / (beatMs() * 1.3), jump = jt >= 0 && jt < 1 ? Math.sin(Math.PI * jt) : 0;
      const slump = now < slumpUntil ? 2.5 : 0;
      for (let pass = 0; pass < 2; pass++) {
        for (const p of crowd) {
          if (p.row !== pass) continue;
          const ph = (phase - p.lag + 1) % 1;
          const active = jump > 0 || p.join < 0.3 + mixLevel * 0.14;
          let lift = active ? amp * p.k * Math.sin(Math.PI * ph) : 0.7 * Math.sin(now / 900 + p.x);
          lift += jump * (5 + 5 * p.join) * p.k - slump;
          const up = mixLevel >= 3 && p.arm < (mixLevel - 2) * 0.28;
          const arms = (jump > 0.15 && p.arm < 0.6) || up ? (p.arm < 0.3 ? 2 : 1) : 0;
          if (pass === 0) {
            c.fillStyle = c.strokeStyle = '#1d0c2c';
            person(c, p.x, STAGE_H - 9, p.k, lift * 0.8, arms, p.head);
          } else rimPerson(c, p.x, STAGE_H + 2, p.k, lift, arms, p.head, 0.45 + 0.55 * pulse);
        }
      }
      // beat lane
      const hitX = 40, ahead = 2200, pps = (w - hitX - 8) / ahead, mid = 27;
      c.fillStyle = 'rgba(4,2,8,0.72)';
      c.fillRect(0, mid - 16, w, 32);
      c.fillStyle = 'rgba(25,230,255,0.10)';
      c.fillRect(hitX - goodMs() * pps, mid - 13, goodMs() * 2 * pps, 26);
      c.fillStyle = 'rgba(25,230,255,0.22)';
      c.fillRect(hitX - PERFECT * pps, mid - 13, PERFECT * 2 * pps, 26);
      c.fillStyle = 'rgba(255,43,214,0.45)';
      c.fillRect(0, mid - 0.5, w, 1);
      if (song) {
        for (let i = Math.max(0, song.ei - 16); i < song.ev.length; i++) {
          const e = song.ev[i], dt = e.t - now;
          if (dt > ahead) break;
          if (dt < -hitX / pps) continue;
          const x = hitX + dt * pps;
          c.globalAlpha = dt < 0 ? Math.max(0, 1 + dt / 380) : Math.min(1, (ahead - dt) / 300);
          if (e.pos === 0) { c.fillStyle = 'rgba(255,43,214,0.4)'; c.fillRect(x, mid - 13, 1, 26); }
          if (e.beat) {
            const r = e.accent ? 8 : e.len === 3 ? 7 : 5.5;
            const col = e.bar === 0 ? '#8a7aa8' : e.accent ? MAG : e.len === 3 ? HOT : CYAN;
            const hotNow = Math.abs(dt) < PERFECT;
            c.globalCompositeOperation = 'lighter';
            c.fillStyle = col;
            const ga = c.globalAlpha;
            c.globalAlpha = ga * (hotNow ? 0.5 : 0.22);
            c.beginPath(); c.arc(x, mid, r * 1.9, 0, Math.PI * 2); c.fill();
            c.globalAlpha = ga;
            c.globalCompositeOperation = 'source-over';
            c.fillStyle = hotNow ? '#ffffff' : col;
            c.beginPath(); c.moveTo(x, mid - r); c.lineTo(x + r, mid); c.lineTo(x, mid + r); c.lineTo(x - r, mid); c.fill();
            c.fillStyle = '#05030a';
            const ir = r * 0.42;
            c.beginPath(); c.moveTo(x, mid - ir); c.lineTo(x + ir, mid); c.lineTo(x, mid + ir); c.lineTo(x - ir, mid); c.fill();
          } else {
            c.fillStyle = 'rgba(200,180,255,0.55)';
            c.fillRect(x - 1, mid - 3, 2, 6);
          }
        }
        c.globalAlpha = 1;
      }
      c.globalCompositeOperation = 'lighter';
      c.fillStyle = lastBeat.accent ? `rgba(255,43,214,${0.25 + 0.5 * pulse})` : `rgba(25,230,255,${0.18 + 0.4 * pulse})`;
      c.fillRect(hitX - 4 - pulse * 3, mid - 16, 8 + pulse * 6, 32);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#ffffff';
      c.fillRect(hitX - 1, mid - 15, 2, 30);
      const bars = song ? song.bars : plan(run.bpm, run.sig, run.song).bars;
      W.text(c, song ? (song.bar === 0 ? 'COUNT-IN' : `BAR ${song.bar}/${bars}`) : 'DOORS', 5, 6, { align: 'left', size: 9, color: '#b6a6d6', weight: 600, font: FONT });
      W.text(c, `×${mult().toFixed(2)}`, w - 5, 6, { align: 'right', size: 10, color: streak ? MAG : '#b6a6d6', weight: 800, font: FONT });
      if (lastJudge && now - lastJudge.at < 900) {
        c.globalAlpha = Math.min(1, (900 - (now - lastJudge.at)) / 300);
        W.text(c, lastJudge.text, w / 2, 6, { size: 10, color: lastJudge.color, weight: 800, font: FONT });
        c.globalAlpha = 1;
      }
    }

    // ---------- the club backdrop: light beams and a scrolling floor ----------
    const beamSpr = [MAG, CYAN].map((col) => {
      const cv = document.createElement('canvas');
      cv.width = 140; cv.height = 400;
      const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 400);
      gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(66, 0); g.lineTo(74, 0); g.lineTo(140, 400); g.lineTo(0, 400); g.closePath(); g.fill();
      return cv;
    });
    function drawBackdrop(now) {
      const bw = Math.ceil(window.innerWidth / 2), bh = Math.ceil(window.innerHeight / 2), c = bctx;
      if (backdrop.width !== bw || backdrop.height !== bh) { backdrop.width = bw; backdrop.height = bh; }
      c.fillStyle = '#05030a';
      c.fillRect(0, 0, bw, bh);
      const hz = bh * 0.62;
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const spr = beamSpr[i % 2], ang = reduce ? (i - 1.5) * 0.15 : Math.sin(now * 0.00032 * (1 + i * 0.27) + i * 1.9) * 0.42;
        c.save();
        c.translate(bw * (0.1 + i * 0.27), -6);
        c.rotate(ang);
        c.globalAlpha = 0.08 + 0.2 * pulse * (0.5 + mixLevel * 0.12);
        c.drawImage(spr, -bh * 0.22, 0, bh * 0.44, bh * 1.15);
        c.restore();
      }
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.fillStyle = '#07030d';
      c.fillRect(0, hz, bw, bh - hz);
      floorGrid(c, 0, hz, bw, bh - hz, phase, 0.16 + 0.26 * pulse);
      const dk = (now - dropAt) / 600;
      if (dk >= 0 && dk < 1 && !reduce) { c.fillStyle = `rgba(255,43,214,${0.45 * (1 - dk)})`; c.fillRect(0, 0, bw, bh); }
    }

    // ---------- MC Strobe ----------
    const FACE_W = 52, FACE_H = 46;
    function glow(c, col, lw, fn, dpr) {
      c.beginPath(); fn();
      c.strokeStyle = col; c.lineWidth = lw; c.shadowColor = col; c.shadowBlur = 6 * dpr;
      c.stroke(); c.shadowBlur = 0;
    }
    function drawFace(now) {
      const dpr = window.devicePixelRatio || 1, c = fctx;
      if (face.width !== FACE_W * dpr) { face.width = FACE_W * dpr; face.height = FACE_H * dpr; }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, FACE_W, FACE_H);
      const talk = now - mcAt < 340, bob = -pulse * (1.2 + mixLevel * 0.5);
      c.save();
      c.translate(0, bob);
      c.lineCap = 'round'; c.lineJoin = 'round';
      glow(c, CYAN, 1.5, () => c.arc(26, 52, 20, Math.PI * 1.17, Math.PI * 1.83), dpr);
      glow(c, CYAN, 2, () => c.ellipse(26, 21, 11, 12.5, 0, 0, Math.PI * 2), dpr);
      glow(c, MAG, 2.6, () => c.arc(26, 21, 15, Math.PI * 1.06, Math.PI * 1.94), dpr);
      c.fillStyle = MAG; c.shadowColor = MAG; c.shadowBlur = 6 * dpr;
      c.fillRect(9.5, 17, 4, 10); c.fillRect(38.5, 17, 4, 10);
      c.beginPath();
      if (c.roundRect) c.roundRect(15, 15.5, 22, 6, 3); else c.rect(15, 15.5, 22, 6);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = 'rgba(255,255,255,0.85)';
      c.fillRect(18, 17, 7, 1.2);
      if (talk) {
        const open = 1.5 + 2.6 * Math.abs(Math.sin(now / 42));
        c.fillStyle = '#ffffff'; c.shadowColor = CYAN; c.shadowBlur = 6 * dpr;
        c.beginPath(); c.ellipse(26, 28.5, 3.6, open, 0, 0, Math.PI * 2); c.fill();
        c.shadowBlur = 0;
      } else glow(c, CYAN, 1.6, () => { c.moveTo(22.5, 28.5); c.quadraticCurveTo(26, 30.5, 29.5, 28.5); }, dpr);
      glow(c, '#ffffff', 2, () => { c.moveTo(32, 33); c.lineTo(37, 41); }, dpr);
      c.fillStyle = '#ffffff';
      c.beginPath(); c.arc(31.2, 31.6, 2.6, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    const POOLS = {
      perfect: ['ON IT!', 'CLEAN!', 'LOCKED!', 'YES!', 'TIGHT!', 'NAILED!'],
      good: ['OKAY!', 'CLOSE!', 'GOT IT!', 'STAY ON!'],
      early: ['EARLY!', 'TOO SOON!', 'WAIT FOR IT!'],
      late: ['LATE!', 'DRAGGING!', 'LATE!'],
      auto: ['DROP IT!', 'HANDS!', 'WAKE UP!'],
      saved: ['REWIND!', 'SAVED!'],
    };
    const SHOUT = { 3: 'THREE DEEP!', 6: 'SIX!', 10: 'TEN DEEP!', 14: 'FOURTEEN!' };
    const poolAt = {};
    const pick = (k) => { const a = POOLS[k]; poolAt[k] = ((poolAt[k] || 0) + 1) % a.length; return a[poolAt[k]]; };
    function mcSay(text, tone = '') {
      mcLine.textContent = text;
      mcLine.className = 'otb-line ' + tone;
      void mcLine.offsetWidth;
      mcLine.classList.add('pop');
      mcAt = performance.now();
      mcVoice(tone === 'hot');
    }

    // ---------- audio ----------
    function ensureAudio() {
      try {
        if (!actx) {
          actx = new (window.AudioContext || window.webkitAudioContext)();
          const comp = actx.createDynamicsCompressor();
          comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
          comp.connect(actx.destination);
          mixFilter = actx.createBiquadFilter();
          mixFilter.type = 'lowpass'; mixFilter.frequency.value = 18000; mixFilter.Q.value = 0.8;
          mixFilter.connect(comp);
          musicBus = actx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(mixFilter);
          sfxBus = actx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(comp);
          noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (actx.state === 'suspended' && !document.hidden) actx.resume();
      } catch (e) { actx = null; }
    }
    sh.own(() => { if (actx) { try { actx.close(); } catch (e) { /* already closed */ } actx = null; } });
    const resume = () => { if (actx && actx.state === 'suspended' && !document.hidden) actx.resume(); };
    window.addEventListener('keydown', resume);
    window.addEventListener('pointerdown', resume);
    sh.own(() => { window.removeEventListener('keydown', resume); window.removeEventListener('pointerdown', resume); });
    const live = () => actx && !W.muted && !document.hidden; // the arcade's quiet.js suspends sound while hidden; schedule none

    // Maps a performance.now() time onto the audio clock.
    function audioAt(tPerf) {
      let at = null;
      if (actx.getOutputTimestamp) {
        const ts = actx.getOutputTimestamp();
        if (ts && ts.performanceTime) at = ts.contextTime + (tPerf - ts.performanceTime) / 1000;
      }
      if (at == null) at = actx.currentTime + (tPerf - performance.now()) / 1000;
      return Math.max(actx.currentTime + 0.003, at);
    }
    // Audio time of the next eighth-note on the song grid (or right now between songs).
    function nextGrid(lead = 15) {
      const now = performance.now();
      if (song && playing) for (let i = Math.max(0, song.ei - 1); i < song.ev.length; i++) if (song.ev[i].t > now + lead) return audioAt(song.ev[i].t);
      return actx.currentTime + 0.005;
    }
    function env(g, at, peak, dur, attack = 0.004) {
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    }
    function osc(at, type, f, dur, vol, out, f2, filt) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, at);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur);
      env(g, at, vol, dur);
      let n = o;
      if (filt) { const f = actx.createBiquadFilter(); f.type = filt[0]; f.frequency.value = filt[1]; f.Q.value = filt[2] || 1; o.connect(f); n = f; }
      n.connect(g).connect(out);
      o.start(at); o.stop(at + dur + 0.03);
      return o;
    }
    function hiss(at, type, freq, vol, dur, out, freq2, q = 1, attack = 0.003) {
      const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      s.buffer = noiseBuf;
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(freq, at);
      if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, at + dur);
      env(g, at, vol, dur, attack);
      s.connect(f).connect(g).connect(out);
      s.start(at, Math.random() * 0.4); s.stop(at + dur + 0.03);
      return s;
    }
    const kick = (at, acc) => osc(at, 'sine', acc ? 170 : 140, 0.28, acc ? 0.95 : 0.75, musicBus, 42);
    const clap = (at) => { hiss(at, 'bandpass', 1500, 0.22, 0.04, musicBus, 0, 1.4); hiss(at + 0.012, 'bandpass', 1300, 0.28, 0.15, musicBus, 0, 1.2); };
    const hat = (at, open, vol) => hiss(at, 'highpass', open ? 6500 : 8000, vol, open ? 0.2 : 0.04, musicBus);
    function bass(at, midi, dur) {
      const o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(mtof(midi), at);
      f.type = 'lowpass'; f.Q.value = 7;
      f.frequency.setValueAtTime(1100, at);
      f.frequency.exponentialRampToValueAtTime(150, at + dur);
      env(g, at, 0.22, dur);
      o.connect(f).connect(g).connect(musicBus);
      o.start(at); o.stop(at + dur + 0.02);
    }
    function lead(at, midi, dur, vol) {
      osc(at, 'square', mtof(midi), dur, vol, musicBus, 0, ['lowpass', 2600, 2]);
      osc(at + dur * 1.6, 'square', mtof(midi), dur, vol * 0.3, musicBus, 0, ['lowpass', 1500, 1]);
    }
    function stab(at, root) {
      for (const iv of [0, 3, 7, 10]) {
        const o = actx.createOscillator(), f = actx.createBiquadFilter(), g = actx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(mtof(root + iv), at);
        o.detune.setValueAtTime((iv % 2 ? 7 : -7), at);
        f.type = 'lowpass'; f.Q.value = 3;
        f.frequency.setValueAtTime(2600, at);
        f.frequency.exponentialRampToValueAtTime(500, at + 0.16);
        env(g, at, 0.035, 0.17);
        o.connect(f).connect(g).connect(musicBus);
        o.start(at); o.stop(at + 0.2);
      }
    }
    const crash = (at, vol = 0.12) => hiss(at, 'highpass', 4500, vol, 1.3, musicBus, 0, 0.7);
    function playEvent(e) {
      const at = audioAt(e.t);
      if (e.bar === 0) {
        if (e.beat) { hiss(at, 'bandpass', 2600, 0.3, 0.03, musicBus, 0, 4); osc(at, 'square', e.accent ? 1568 : 1175, 0.05, 0.08, musicBus); }
        return;
      }
      const L = mixChange && e.t >= mixChange.t ? mixChange.level : mixLevel;
      const chord = song.chordRoot(e.bar);
      if (e.beat) {
        kick(at, e.accent);
        if ((run.sig === '4/4' && e.gi % 2 === 1) || (run.sig !== '4/4' && e.gi > 0 && e.len === 3) || (run.sig === '3/4' && e.gi === 2)) clap(at);
        if (L >= 5 && e.accent && e.bar % 4 === 1) crash(at);
      } else if (L >= 1) hat(at, L >= 5, e.pos === e.barLen - 1 ? 0.12 : 0.075);
      if (L >= 2) { const n = song.bassNote(e); if (n != null) bass(at, n, (song.eighth / 1000) * 0.9); }
      if (L >= 3) { const i = song.lead[e.pos % 8]; if (i != null) lead(at, chord + 24 + CHORD[i] + (L >= 5 && e.bar % 2 === 0 ? 12 : 0), (song.eighth / 1000) * 0.7, 0.045); }
      if (L >= 4 && !e.beat && (e.pos % 4 === 3 || (run.sig !== '4/4' && e.pos === e.barLen - 1))) stab(at, chord + 24);
    }
    let audioWarned = false;
    const sched = setInterval(() => {
      if (!song || !playing || !actx || document.hidden) return;
      const now = performance.now();
      while (song.si < song.ev.length && song.ev[song.si].t < now + 130) {
        const e = song.ev[song.si++];
        if (e.t < now - 40 || W.muted) continue;
        try { playEvent(e); } catch (err) { if (!audioWarned) { audioWarned = true; console.warn('Niteshift audio:', err); } }
      }
    }, 25);
    sh.own(() => clearInterval(sched));

    // signature sounds
    function riserTo(a0, a1) { // build-up: noise sweep and the whole mix opening from a low-pass
      const d = Math.max(0.08, a1 - a0);
      const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
      s.buffer = noiseBuf; s.loop = true;
      f.type = 'bandpass'; f.Q.value = 2;
      f.frequency.setValueAtTime(500, a0); f.frequency.exponentialRampToValueAtTime(7000, a1);
      g.gain.setValueAtTime(0.0001, a0); g.gain.exponentialRampToValueAtTime(0.09, a1 - 0.005); g.gain.exponentialRampToValueAtTime(0.0001, a1 + 0.02);
      s.connect(f).connect(g).connect(sfxBus);
      s.start(a0); s.stop(a1 + 0.05);
      const fq = mixFilter.frequency;
      fq.cancelScheduledValues(a0);
      fq.setValueAtTime(Math.min(fq.value, 1200), a0);
      fq.exponentialRampToValueAtTime(18000, a1);
      return [s, osc(a0, 'sawtooth', 110, d, 0.03, sfxBus, 880, ['lowpass', 1800, 2])];
    }
    function dropHit(at) {
      return [
        osc(at, 'sine', 90, 0.9, 0.7, sfxBus, 32),
        hiss(at, 'highpass', 3500, 0.13, 1.4, sfxBus, 0, 0.7),
        hiss(at + 0.03, 'bandpass', 1400, 0.06, 0.9, sfxBus, 1000, 0.6, 0.08), // crowd roar
      ];
    }
    function tapeStop() {
      const at = actx.currentTime + 0.005, fq = mixFilter.frequency;
      fq.cancelScheduledValues(at);
      fq.setValueAtTime(fq.value, at);
      fq.exponentialRampToValueAtTime(320, at + 0.09);
      fq.exponentialRampToValueAtTime(18000, at + 0.8);
      osc(at, 'sawtooth', 240, 0.4, 0.06, sfxBus, 45, ['lowpass', 900, 3]);
    }
    function mcVoice(hype) {
      if (!live()) return;
      const at = nextGrid(), dur = hype ? 0.2 : 0.13;
      const o = actx.createOscillator(), g = actx.createGain(), f1 = actx.createBiquadFilter(), f2 = actx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(hype ? 250 : 190, at);
      o.frequency.exponentialRampToValueAtTime(hype ? 330 : 150, at + dur);
      f1.type = 'bandpass'; f1.Q.value = 5; f1.frequency.setValueAtTime(620, at); f1.frequency.exponentialRampToValueAtTime(900, at + dur);
      f2.type = 'bandpass'; f2.Q.value = 6; f2.frequency.setValueAtTime(1500, at);
      env(g, at, hype ? 0.11 : 0.07, dur, 0.012);
      o.connect(f1).connect(g); o.connect(f2).connect(g); g.connect(sfxBus);
      o.start(at); o.stop(at + dur + 0.03);
    }
    // Judgement chime lands on the beat itself, and climbs the scale as the streak grows.
    function confirm(kind, beat) {
      if (!live() || !song) return;
      const at = beat ? audioAt(Math.max(performance.now(), beat.t)) : actx.currentTime + 0.005;
      const m = song.root + 36 + SCALE[streak % 6] + 12 * Math.min(1, Math.floor(streak / 6));
      osc(at, 'sine', mtof(m), kind === 'perfect' ? 0.22 : 0.12, kind === 'perfect' ? 0.09 : 0.06, sfxBus);
      if (kind === 'perfect') osc(at, 'triangle', mtof(m + 7), 0.16, 0.04, sfxBus);
    }
    function flourish(n) {
      if (!live() || !song) return;
      const at = nextGrid(), root = song.chordRoot(song.bar) + 24, count = n >= 4 ? 8 : 2 + n * 2, gap = song.eighth / 2000;
      for (let i = 0; i < count; i++) osc(at + i * gap, n >= 4 ? 'square' : 'triangle', mtof(root + CHORD[i % 6] + 12 * Math.floor(i / 6)), 0.18, n >= 4 ? 0.07 : 0.06, sfxBus, 0, ['lowpass', 3200, 1]);
      if (n >= 4) crash(at, 0.08);
    }
    W.voice = {
      move: () => { if (live()) hiss(actx.currentTime + 0.002, 'highpass', 9000, 0.05, 0.018, sfxBus); },
      rotate: () => { if (live()) osc(actx.currentTime + 0.002, 'sine', mtof((song ? song.chordRoot(song.bar) : 40) + 31), 0.05, 0.035, sfxBus); },
      drop: () => { if (live()) osc(actx.currentTime + 0.002, 'square', 1500, 0.07, 0.03, sfxBus, 160, ['lowpass', 2400, 1]); },
      lock: () => { if (live()) osc(actx.currentTime + 0.002, 'sine', 110, 0.08, 0.12, sfxBus, 48); },
      clear: null,
      big: null,
      buy: () => { if (live()) { const t = actx.currentTime + 0.005; osc(t, 'square', 1046, 0.08, 0.04, sfxBus, 0, ['lowpass', 3000]); osc(t + 0.08, 'square', 1568, 0.14, 0.04, sfxBus, 0, ['lowpass', 3000]); } },
      bad: () => { if (live()) tapeStop(); },
      win: () => { if (live()) { const t = actx.currentTime + 0.01; [0, 3, 7, 10, 12, 15, 19].forEach((iv, i) => osc(t + i * 0.07, 'square', mtof(60 + iv), 0.2, 0.045, sfxBus, 0, ['lowpass', 3500])); hiss(t, 'bandpass', 1300, 0.05, 1.2, sfxBus, 900, 0.6, 0.15); } },
      tick: () => { if (live()) hiss(actx.currentTime + 0.002, 'highpass', 9000, 0.04, 0.02, sfxBus); },
      coin: null,
      hit: null,
    };

    // ---------- song ----------
    function buildSong() {
      const P = plan(run.bpm, run.sig, run.song);
      const eighth = 60000 / run.bpm / 2;
      const sig = SIGS[run.sig];
      const r = W.rng(run.seed + run.song * 7919);
      const ev = [], beats = [];
      let t = performance.now() + 700;
      const off = r.int(3) * 2;
      for (let bar = 0; bar <= P.bars; bar++) {
        const groups = sig.groups(bar + off);
        const barLen = groups.reduce((a, g) => a + g, 0);
        let pos = 0;
        groups.forEach((g, gi) => {
          for (let k = 0; k < g; k++) {
            const e = { t, bar, pos, gi, beat: k === 0, accent: k === 0 && gi === 0, len: g, barLen };
            ev.push(e);
            if (e.beat) beats.push(e);
            t += eighth;
            pos++;
          }
        });
      }
      const root = r.pick(ROOTS), prog = r.pick(PROGS);
      const pat = () => Array.from({ length: 8 }, (_, i) => (i === 0 ? 0 : i % 2 === 0 ? (r.chance(0.7) ? r.pick([0, 0, 7, 12]) : null) : r.chance(0.4) ? r.pick(SCALE) : null));
      const A = pat(), B = pat();
      const leadPat = Array.from({ length: 8 }, (_, i) => (i % 2 === 0 || r.chance(0.45) ? r.int(6) : null));
      const chordRoot = (bar) => root + prog[Math.floor(Math.max(0, bar - 1) / 2) % 4];
      return {
        ev, beats, eighth, root, end: t, si: 0, ei: 0, bi: 0, bar: 0, bars: P.bars, target: P.target, lead: leadPat, chordRoot,
        bassNote(e) {
          if (e.bar === 0) return null;
          const p = (e.bar % 4 === 0 ? B : A)[e.pos % 8];
          return p == null ? null : chordRoot(e.bar) + p;
        },
      };
    }

    function nearestBeat(now) {
      let best = null;
      for (let i = Math.max(0, song.bi - 2); i < Math.min(song.beats.length, song.bi + 2); i++) {
        const b = song.beats[i];
        if (b.bar === 0) continue;
        if (!best || Math.abs(now - b.t) < Math.abs(now - best.t)) best = b;
      }
      return best;
    }
    function nextBeatAfter(t) {
      for (let i = song.bi; i < song.beats.length; i++) if (song.beats[i].t > t && song.beats[i].bar > 0) return song.beats[i];
      return null;
    }

    function onBeat(b, now) {
      lastBeat = b;
      song.bar = b.bar;
      if (b.bar === 0) {
        const left = song.beats.filter((x) => x.bar === 0 && x.t >= b.t).length;
        say(left, 96, left === 1 ? MAG : CYAN, 520);
        if (b.accent) mcSay('HANDS UP!', 'hot');
        return;
      }
      if (b === song.beats.find((x) => x.bar === 1)) {
        say('GO', 110, MAG, 700);
        mcSay("LET'S GO!", 'hot');
        st.spawn();
        return;
      }
      if (now - b.t > 250) return; // tab was hidden: skip the backlog
      const p = st.active;
      if (!p || !st.canAct()) return;
      steps++;
      if (has('half') && steps % 2) return;
      if (board.fits(p, p.rot, p.x, p.y + 1)) p.y++;
      else { pending = { kind: 'auto', beat: b }; st.lock(); }
    }

    // ---------- the mix follows the streak ----------
    function cancelDrop() {
      dropNodes.forEach((n) => { try { n.stop(); } catch (e) { /* not started or already stopped */ } });
      dropNodes = [];
      mixChange = null;
    }
    function mixUpdate() {
      if (!song) return;
      const lv = levelOf(streak), eff = mixChange ? mixChange.level : mixLevel, now = performance.now();
      if (lv > eff) {
        const b = nextBeatAfter(now + 140);
        if (!b) { mixLevel = lv; paintMix(); return; }
        const drop = lv >= 2;
        if (mixChange) cancelDrop();
        mixChange = { t: b.t, level: lv, drop };
        if (drop && live()) { const a1 = audioAt(b.t); dropNodes = riserTo(actx.currentTime + 0.01, a1).concat(dropHit(a1)); }
      } else if (lv < eff) {
        const was = Math.max(mixLevel, eff);
        cancelDrop();
        mixLevel = lv;
        paintMix();
        slumpUntil = now + beatMs();
        if (was >= 1 && live()) tapeStop();
        if (was >= 2) sh.log(`Band out · back to <b>${LEVELS[lv].name.toLowerCase()}</b>`);
      }
    }
    function applyMix(ch, now) {
      dropNodes = [];
      mixLevel = ch.level;
      paintMix();
      const L = LEVELS[ch.level];
      if (!ch.drop) { mcSay(L.call); return; }
      dropAt = now;
      say(L.name, L.name.length > 5 ? 54 : 78, ch.level % 2 ? CYAN : MAG, 1000);
      mcSay(L.call, 'hot');
      if (!reduce) {
        view.shake(7);
        flashEl.style.display = 'block';
        flashEl.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 650, easing: 'ease-out' }).onfinish = () => { flashEl.style.display = 'none'; };
        sh.boardFrame.animate([{ transform: 'scale(1.03)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.2,1.6,.4,1)' });
      }
      for (let x = 0; x < 10; x++) view.burst(x + 0.5, 19.5, x % 2 ? CYAN : MAG, 2, 9);
      sh.log(`<b>Drop</b> · ${L.name.toLowerCase()} in at streak ${streak}`);
    }

    // ---------- stacker ----------
    const st = new W.Stacker(board, {
      gravity: 0,
      clearDelay: 200,
      next: (() => { const bag = W.bag(W.TYPES, rng); const q = []; return () => { while (q.length < 4) q.push(makePiece(bag())); const p = q.shift(); q.push(makePiece(bag())); sh.setQueue(q.slice(0, 3), { drawBlock: miniBlock }); return p; }; })(),
      onSpawn() { sh.setHold(st.holdPiece, { drawBlock: miniBlock }); },
      onHold() { sh.setHold(st.holdPiece, { drawBlock: miniBlock }); },
      onLock(cells) { judgeLock(cells); },
      onClear(rows) { scoreLines(rows); },
      beforeSpawn() { return playing; },
      onTopOut() { mcSay("FLOOR'S FULL!", 'bad'); endRun('The floor filled up'); },
    });

    function judge(now) {
      const b = nearestBeat(now);
      if (!b) return { kind: 'off', beat: null, d: 999 };
      const d = now - b.t, a = Math.abs(d);
      return { kind: a <= PERFECT ? 'perfect' : a <= goodMs() ? 'good' : 'off', beat: b, d };
    }
    const JUDGE = { perfect: ['PERFECT', CYAN], good: ['GOOD', '#c48bff'], off: ['OFF BEAT', MISS], auto: ['DROP IT', '#9b8fb8'], saved: ['REWIND', HOT] };
    function judgeLock(cells) {
      const j = pending || { kind: 'auto' };
      pending = null;
      let kind = j.kind, pts = 0;
      if (kind === 'perfect' || kind === 'good') {
        streak += kind === 'perfect' && has('echo') ? 2 : 1;
        pts = Math.round((kind === 'perfect' ? 50 : 20) * mult() * factor());
        if (has('downbeat') && j.beat && j.beat.accent) pts += Math.round(150 * mult());
        confirm(kind, j.beat);
      } else if (kind === 'off') {
        if (has('net') && song.bar - netBar >= 8) { netBar = song.bar; kind = 'saved'; }
        else { streak = 0; flickerUntil = performance.now() + 380; }
      } else streak = Math.floor(streak / 2);
      counts[kind === 'saved' ? 'off' : kind]++;
      songScore += pts;
      const [text, color] = JUDGE[kind];
      if (sh.debug && sh.debug.judgeLog.length < 50) sh.debug.judgeLog.push(kind + ' ' + Math.round(j.d || 0));
      lastJudge = { text: j.d != null && kind !== 'auto' ? `${text} ${j.d > 0 ? '+' : ''}${Math.round(j.d)}ms` : text, color, at: performance.now() };
      const cx = cells.reduce((a, c) => a + c.x, 0) / cells.length + 0.5, cy = Math.min(...cells.map((c) => c.y));
      view.float(text, cx, cy - 0.3, color, kind === 'perfect' ? 17 : 14);
      if (kind === 'perfect') cells.forEach((c) => view.burst(c.x + 0.5, c.y + 0.5, CYAN, 3, 7));
      if (kind === 'perfect' || kind === 'good') mcSay(SHOUT[streak] || (streak > 16 && streak % 4 === 0 ? `${streak} DEEP!` : pick(kind)), SHOUT[streak] ? 'hot' : '');
      else if (kind === 'off') mcSay(pick(j.d < 0 ? 'early' : 'late'), 'bad');
      else mcSay(pick(kind), kind === 'saved' ? '' : 'bad');
      mixUpdate();
      paint();
    }
    function scoreLines(rows) {
      const n = rows.length, bi = song.bi;
      const drop = bi <= bassUntil ? 2 : 1;
      const pts = Math.round(LINE_PTS[Math.min(4, n)] * factor() * mult() * drop);
      songScore += pts;
      view.rowBurst(rows, (b) => (b && b.color) || MAG);
      view.float(`+${fmt(pts)}`, 5, rows[0] + 0.5, HOT, 18 + n * 3);
      if (n >= 3 && !reduce) view.shake(6 + n * 2);
      if (n >= 2) mcSay([0, 0, 'DOUBLE!', 'TRIPLE!', 'QUAD!!'][Math.min(4, n)], 'hot');
      if (n >= 3 && has('bassdrop')) { bassUntil = bi + 8; sh.toast('Bass drop · lines ×2 for 8 beats', 'good'); }
      flourish(n);
      sh.log(`${n} line${n > 1 ? 's' : ''} · <b>+${fmt(pts)}</b> at ×${mult().toFixed(2)}${drop > 1 ? ' · bass drop ×2' : ''}`);
      paint();
    }
    function act(fn) {
      if (!fn() || !song) return;
      const now = performance.now(), b = nearestBeat(now);
      if (!b || Math.abs(now - b.t) > PERFECT || b === bonusBeat) return;
      bonusBeat = b;
      songScore += Math.round(5 * mult() * (has('dancer') ? 4 : 1));
      const p = st.active;
      if (p) view.burst(p.x + p.n / 2, p.y + 0.5, MAG, 2, 3);
    }
    function doDrop() {
      if (!st.canAct()) return;
      pending = judge(performance.now());
      st.hardDrop();
    }
    const ctl = {
      left: () => act(() => st.move(-1)), right: () => act(() => st.move(1)),
      rotCW: () => act(() => st.rotate(1)), rotCCW: () => act(() => st.rotate(-1)),
      down: () => st.softDrop(), drop: doDrop, hold: () => st.hold(),
    };
    sh.stackerKeys(st, ctl);
    sh.pad(ctl);

    // ---------- panels ----------
    const mixPanel = W.el('div', 'panel otb-mix');
    const timingPanel = W.el('div', 'panel');
    const songPanel = W.el('div', 'panel');
    sh.extra.append(mixPanel, timingPanel, songPanel);
    function paintMix() {
      mixPanel.innerHTML = `<h3>The mix <span>streak builds the band</span></h3><div class="otb-lamps">${LEVELS.map((L, i) =>
        `<span class="otb-lamp${i <= mixLevel ? ' on' : ''}${i === mixLevel + 1 ? ' next' : ''}"><b>${L.name === 'FULL SEND' ? 'FULL' : L.name}</b><small>${L.at ? L.at + '+' : 'always'}</small></span>`).join('')}</div>`;
    }
    function paint() {
      if (!run) return;
      const P = plan(run.bpm, run.sig, run.song), t = song ? song.target : P.target;
      sh.hud([
        { label: `Track ${run.song + 1} · score / target`, html: `${fmt(songScore)} <small>/ ${fmt(t)}</small>`, tone: songScore >= t ? 'good' : 'accent', wide: true },
        { label: 'Streak', value: streak, tone: streak >= 8 ? 'good' : '' },
        { label: 'Hype', value: '×' + mult().toFixed(2), tone: streak ? 'accent' : '' },
        { label: 'BPM · meter', value: `${run.bpm} · ${run.sig}` },
        { label: 'Tips', value: '$' + run.tips, tone: 'good' },
      ]);
      timingPanel.innerHTML = `<h3>The window</h3>
        <p class="otb-p">Space on the beat. <span class="otb-c">Perfect ±${PERFECT}ms</span> or <span class="otb-v">Good ±${goodMs()}ms</span> adds 1 to the streak, and each step is +×0.25 hype (up to ×${1 + 0.25 * MAX_STREAK}). Off the beat resets it. A piece that lands by itself halves it.</p>
        <div class="chips"><span class="chip good">Perfect ${counts.perfect}</span><span class="chip">Good ${counts.good}</span><span class="chip bad">Off ${counts.off}</span><span class="chip">Dozed ${counts.auto}</span></div>`;
      const sig = SIGS[run.sig];
      songPanel.innerHTML = `<h3>This track</h3>
        <p class="otb-p">${run.bpm} BPM · ${run.sig} ${sig.label.toLowerCase()} · ${P.bars} bars, about ${P.sec}s. Lines score ×${factor().toFixed(2)}. <span class="otb-m">${sig.desc}</span></p>
        <p class="otb-p otb-m">The lane: <span style="color:${MAG}">◆</span> bar one, <span style="color:${CYAN}">◆</span> beat${run.sig === '7/8' ? `, <span style="color:${HOT}">◆</span> long beat` : ''}, ▮ offbeat.</p>
        ${run.mods.length ? `<div class="chips">${run.mods.map((id) => MODS.find((m) => m.id === id)).map((m) => `<span class="chip accent" title="${W.esc(m.desc)}">${W.esc(m.name)}</span>`).join('')}</div>` : ''}`;
    }

    // ---------- run flow ----------
    function startSong() {
      board.clear();
      st.reset();
      cancelDrop();
      streak = 0; songScore = 0; steps = 0; netBar = -99; bassUntil = -1; bonusBeat = null; lastJudge = null; mixLevel = 0;
      counts = { perfect: 0, good: 0, off: 0, auto: 0 };
      ensureAudio();
      song = buildSong();
      playing = true;
      sh.setQueue([]);
      sh.setHold(null);
      sh.log(`Track ${run.song + 1} · ${run.bpm} BPM ${run.sig} · ${song.bars} bars · target ${fmt(song.target)}`);
      paintMix();
      paint();
    }
    function endSong() {
      playing = false;
      st.paused = true;
      cancelDrop();
      const t = song.target;
      if (songScore < t) { mcSay('LIGHTS UP.', 'bad'); endRun(`The track ended at ${fmt(songScore)} of ${fmt(t)}`); return; }
      const tips = 4 + Math.floor(counts.perfect / 6) + Math.min(5, Math.floor((songScore - t) / (t / 5)));
      run.tips += tips;
      run.total += songScore;
      W.sfx('win');
      mcSay('ENCORE!', 'hot');
      say('ENCORE', 60, CYAN, 1400);
      sh.log(`Track ${run.song + 1} cleared · <b>+$${tips}</b> tips`);
      run.song++;
      paint();
      openShop(`Track cleared at ${fmt(songScore)}. The floor tipped you $${tips} (${counts.perfect} perfects).`);
    }
    function endRun(why) {
      if (!run || run.over) return;
      run.over = true;
      playing = false;
      st.paused = true;
      cancelDrop();
      mixLevel = 0;
      paintMix();
      paint();
      sh.overlay({
        title: 'Lights up',
        body: `<p>${W.esc(why)} on track ${run.song + 1}.</p><p>Night total <b>${fmt(run.total + songScore)}</b>. Perfect drops this track: ${counts.perfect}.</p><p class="otb-m">MC Strobe: “Same time tomorrow.”</p>`,
        button: 'Next night',
      }).then(newRun);
    }
    function openShop(intro) {
      let bpm = run.bpm, sig = run.sig;
      const offers = rng.shuffle(MODS.filter((m) => !run.mods.includes(m.id))).slice(0, 3);
      const tempos = [...new Set([run.bpm - 12, run.bpm, run.bpm + 12, run.bpm + 24].map((b) => Math.max(80, Math.min(180, b))))];
      const body = W.el('div', 'modal-body');
      const render = () => {
        const P = plan(bpm, sig, run.song);
        body.innerHTML = `<p class="otb-m">${intro}</p><div class="chips"><span class="chip good">Tips $${run.tips}</span><span class="chip accent">Next target ${fmt(P.target)}</span><span class="chip">${P.bars} bars · ~${P.sec}s</span></div>`;
        const h1 = W.el('h4', '', 'Tempo');
        const g1 = W.el('div', 'tiles');
        tempos.forEach((b) => {
          const t = W.el('button', 'tile' + (b === bpm ? ' on' : ''), `<span class="t-name">${b} BPM</span><span class="t-desc">${b > run.bpm ? 'Faster' : b < run.bpm ? 'Slower' : 'Same groove'}</span><span class="t-cost">Lines ×${(b / 100).toFixed(2)}</span>`);
          t.type = 'button';
          t.addEventListener('click', () => { bpm = b; W.sfx('tick'); render(); });
          g1.appendChild(t);
        });
        const h2 = W.el('h4', '', 'Meter');
        const g2 = W.el('div', 'tiles');
        Object.keys(SIGS).forEach((k) => {
          const s = SIGS[k];
          const t = W.el('button', 'tile' + (k === sig ? ' on' : ''), `<span class="t-name">${k} · ${s.label}</span><span class="t-desc">${s.desc}</span><span class="t-cost">Lines ×${s.factor}</span>`);
          t.type = 'button';
          t.addEventListener('click', () => { sig = k; W.sfx('tick'); render(); });
          g2.appendChild(t);
        });
        const h3 = W.el('h4', '', 'Tricks');
        const g3 = W.el('div', 'tiles');
        offers.forEach((m, i) => {
          const t = W.el('button', 'tile', `<span class="t-name">${W.esc(m.name)}</span><span class="t-desc">${W.esc(m.desc)}</span><span class="t-cost">$${m.cost}</span>`);
          t.type = 'button';
          t.disabled = run.tips < m.cost;
          t.addEventListener('click', () => { run.tips -= m.cost; run.mods.push(m.id); offers.splice(i, 1); W.sfx('buy'); mcSay('NICE PICK!'); render(); paint(); });
          g3.appendChild(t);
        });
        if (!offers.length) g3.appendChild(W.el('p', 'otb-m', 'Booth sold out.'));
        body.append(h1, g1, h2, g2, h3, g3);
      };
      render();
      sh.modal({
        title: 'The booth',
        body,
        wide: true,
        actions: [{ label: `Drop track ${run.song + 1}`, primary: true, onClick: () => { run.bpm = bpm; run.sig = sig; startSong(); } }],
      });
    }
    function newRun() {
      run = { song: 0, bpm: 100, sig: '4/4', tips: 0, mods: [], total: 0, seed: (Math.random() * 1e9) | 0, over: false };
      sh.logEl.innerHTML = '';
      startSong();
    }

    sh.debug = {
      board, st, view, getSong: () => song, getRun: () => run, getAudio: () => actx,
      addScore: (n) => { songScore += n; paint(); },
      endSong: () => { if (song) song.end = performance.now(); },
      setStreak: (n) => { streak = n; mixUpdate(); paint(); },
      level: () => mixLevel,
      judgeLog: [],
      mc: mcSay,
    };
    sh.loop((dt, now) => {
      if (song && playing) {
        let n = 0;
        while (song.bi < song.beats.length && song.beats[song.bi].t <= now) { const b = song.beats[song.bi++]; if (n++ < 4) onBeat(b, now); }
        while (song.ei < song.ev.length && song.ev[song.ei].t <= now) song.ei++;
        if (mixChange && now >= mixChange.t) { const ch = mixChange; mixChange = null; applyMix(ch, now); }
        const nb = song.beats[song.bi], span = nb && lastBeat.t > 0 ? nb.t - lastBeat.t : beatMs();
        phase = lastBeat.t > 0 ? Math.max(0, Math.min(0.999, (now - lastBeat.t) / span)) : (now / 600) % 1;
        pulse = Math.exp(-(now - lastBeat.t) / 170) * (lastBeat.accent ? 1 : 0.8);
        if (now >= song.end) endSong();
      } else {
        phase = (now / 1400) % 1;
        pulse = 0.12 + 0.1 * Math.sin(now / 700);
      }
      const pq = Math.round(pulse * 20) / 20;
      if (pq !== lastPq) { sh.root.style.setProperty('--p', pq); lastPq = pq; }
      st.update(dt);
      view.update(dt);
      view.draw(st);
      drawStage(now);
      drawFace(now);
      drawBackdrop(now);
    });

    run = { song: 0, bpm: 100, sig: '4/4', tips: 0, mods: [], total: 0, seed: 1, over: false };
    mc.style.width = view.W + 14 + 'px';
    paintMix();
    paint();
    view.draw(st);
    drawStage(performance.now());
    sh.overlay({
      title: 'Niteshift',
      body: `<p class="otb-quote">“Doors are open. The beat drops your piece, one row a beat.” <span>MC Strobe</span></p>
        <ul><li><b>Space on the beat</b> to land it. On-beat drops grow your streak, and the streak is your hype multiplier.</li>
        <li>The streak builds the band: hats at 2, bass 4, lead 8, stabs 12, full send 16.</li>
        <li>Drop as a light crosses the white line under the well. Miss and the band walks off; a piece that lands alone halves the streak.</li>
        <li>Tracks run about 90 seconds. Beat the target to reach the booth.</li></ul>`,
      button: 'Open the doors',
    }).then(newRun);
  }

  // ---------- hub card art ----------
  function art(ctx, w, h) {
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    [[40, 0.35, MAG], [110, -0.2, CYAN], [180, 0.25, MAG], [250, -0.35, CYAN]].forEach(([x, a, col]) => {
      ctx.save();
      ctx.translate(x, -4);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, 0, 90);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(2, 0); ctx.lineTo(26, 90); ctx.lineTo(-26, 90); ctx.fill();
      ctx.restore();
    });
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#08030f';
    ctx.fillRect(0, 66, w, h - 66);
    floorGrid(ctx, 0, 66, w, h - 66, 0.4, 0.5);
    const s = 12, ox = Math.round(w / 2 - 4 * s), oy = h - 42 - 4 * s;
    const cells = [
      ['I', 1, 0, 3], ['I', 1, 1, 3], ['I', 1, 2, 3], ['I', 1, 3, 3],
      ['O', 2, 4, 2], ['O', 2, 5, 2], ['O', 2, 4, 3], ['O', 2, 5, 3],
      ['L', 3, 7, 1], ['L', 3, 7, 2], ['L', 3, 7, 3], ['L', 3, 6, 3],
      ['S', 4, 2, 1], ['S', 4, 3, 1], ['S', 4, 1, 2], ['S', 4, 2, 2],
      ['T', 5, 4, 1], ['T', 5, 5, 1], ['T', 5, 6, 1], ['T', 5, 5, 0],
      ['J', 6, 0, 1], ['J', 6, 0, 2], ['J', 6, 1, 1], ['J', 6, 0, 0],
      ['Z', 7, 2, -2], ['Z', 7, 3, -2], ['Z', 7, 3, -1], ['Z', 7, 4, -1],
    ];
    const at = new Map(cells.map(([t, id, x, y]) => [x + ',' + y, id]));
    for (const [t, id, x, y] of cells) {
      const m = NB.reduce((acc, [dx, dy, bit]) => (at.get(x + dx + ',' + (y + dy)) === id ? acc | bit : acc), 0);
      blit(ctx, tube(NEON[t], s, m, 0), ox + x * s, oy + y * s);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      blit(ctx, tube(NEON[t], s, m, 1), ox + x * s, oy + y * s);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    const g = ctx.createLinearGradient(0, h - 40, 0, h);
    g.addColorStop(0, 'rgba(255,43,214,0)'); g.addColorStop(1, 'rgba(255,43,214,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, h - 40, w, 40);
    const r = W.rng(42);
    for (let i = 0; i < 17; i++) {
      const x = (i + 0.2 + r() * 0.6) * (w / 17), k = 0.85 + r() * 0.3;
      rimPerson(ctx, x, h + 4, k, r() * 6, r() < 0.35 ? 2 : r() < 0.5 ? 1 : 0, 0.9 + r() * 0.3, 0.9);
    }
  }

  W.register({
    id: 'on-the-beat',
    num: 8,
    title: 'Niteshift',
    mix: 'Rhythm club × falling blocks',
    pitch: 'The beat drops your piece one row at a time. Land it on the beat and the band piles in: hats, bass, lead, full send.',
    palette: [MAG, CYAN, HOT, '#7dff5a', '#6a7cff'],
    shell: { keysHint: '← → move · ↑ / Z turn · ↓ step · Space drop on the beat · C hold', logTitle: 'Floor log' },
    art,
    mount,
  });
})();

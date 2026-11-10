/* 11 Turnwell — "TURN". Op-art meets Bauhaus: black, white, one signal red.
 * The well is 12×12. Every 12 pieces the whole well turns 90°. Each old row becomes a column and
 * gravity packs it into a pillar, so a row's block count becomes a pillar's height. Pillars that
 * reach the red mark (10 tall: a row missing two blocks or fewer) break and score double.
 * So the turn pays out the rows you nearly finished. Towers at the edge pay nothing.
 * Hold R (or press See the turn) to preview. Hit each round's mark or the run ends.
 * From round 7 the well turns every 6 pieces and alternates direction.
 */
(function () {
  const W = window.Wells;

  const N = 12;
  const ROUND_PIECES = 12;
  const BOSS_FROM = 6; // round index where the fast phase starts (round 7)
  const MARK = 10; // pillar height that breaks
  const SPIN_MS = 940, WIND_MS = 170, SLAM_MS = 690;
  const FALL_STEP_MS = 46;
  const BREAK_HOLD_MS = 460, BREAK_END_MS = 900;
  const TARGETS = [200, 350, 500, 700, 850, 1000];
  const target = (r) => (r < TARGETS.length ? TARGETS[r] : 1000 + (r - TARGETS.length + 1) * 200);
  const LINE_PTS = [0, 100, 250, 450, 700];
  const linePts = (n) => (n <= 4 ? LINE_PTS[n] : 700 + (n - 4) * 300);
  const turnPts = (n) => linePts(n) * 2;
  const PERFECT = 1000;

  const INK = '#111111', PAPER = '#f4f3ef', WHITE = '#ffffff', RED = '#da1e14';
  // fill: k black, w white with heavy stroke, r red. inlay: circle, dot, tri, sq.
  const KIND = { I: ['k', 'circle'], O: ['r', ''], T: ['w', 'dot'], S: ['k', 'tri'], Z: ['w', 'tri'], J: ['k', 'sq'], L: ['w', 'sq'] };
  const fillOf = (b) => { const k = (KIND[b && b.kind] || KIND.I)[0]; return k === 'k' ? INK : k === 'r' ? RED : WHITE; };
  const shardOf = (b) => { const f = fillOf(b); return f === WHITE ? INK : f; };
  const fmt = (n) => n.toLocaleString('en-US');

  // Rotate an n×n cell grid. dir 1 = clockwise, -1 = counter-clockwise.
  function rotateCells(cells, dir) {
    const n = cells.length, out = [];
    for (let y = 0; y < n; y++) {
      const row = [];
      for (let x = 0; x < n; x++) row.push(dir > 0 ? cells[n - 1 - x][y] : cells[x][n - 1 - y]);
      out.push(row);
    }
    return out;
  }
  function stepFall(b) {
    let moved = false;
    for (let x = 0; x < b.w; x++) for (let y = b.h - 2; y >= 0; y--) {
      if (b.cells[y][x] && !b.cells[y + 1][x]) { b.cells[y + 1][x] = b.cells[y][x]; b.cells[y][x] = null; moved = true; }
    }
    return moved;
  }
  const colCount = (b, x) => { let n = 0; for (let y = 0; y < b.h; y++) if (b.cells[y][x]) n++; return n; };
  const pillarCols = (b) => { const out = []; for (let x = 0; x < b.w; x++) if (colCount(b, x) >= MARK) out.push(x); return out; };
  const rowCount = (b, y) => b.cells[y].reduce((n, c) => n + (c ? 1 : 0), 0);

  const easeOut = (k) => 1 - (1 - k) * (1 - k);
  const easeIn3 = (k) => k * k * k;
  // Logical turn angle 0..90 over the spin: wind back, slam in, rebound.
  function spinAngle(t) {
    if (t < WIND_MS) return -6 * easeOut(t / WIND_MS);
    if (t < SLAM_MS) return -6 + 96 * easeIn3((t - WIND_MS) / (SLAM_MS - WIND_MS));
    const u = Math.min(1, (t - SLAM_MS) / (SPIN_MS - SLAM_MS));
    return 90 - 3.2 * Math.sin(u * Math.PI * 1.6) * (1 - u) * (1 - u);
  }

  // ---------- tiles ----------
  function drawTile(ctx, b, px, py, s, x, y, o = {}) {
    const k = KIND[b.kind] || KIND.I;
    const g = Math.max(1, Math.round(s * 0.05));
    const X = px + g, Y = py + g, S = s - 2 * g;
    ctx.save();
    if (o.ghost) {
      const lw = Math.max(1.5, s * 0.07);
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw;
      ctx.setLineDash([Math.max(2, s * 0.14), Math.max(2, s * 0.1)]);
      ctx.strokeRect(X + lw / 2 + 1, Y + lw / 2 + 1, S - lw - 2, S - lw - 2);
      ctx.restore();
      return;
    }
    if (o.alpha != null) ctx.globalAlpha = o.alpha;
    const fill = k[0] === 'k' ? INK : k[0] === 'r' ? RED : WHITE;
    ctx.fillStyle = fill;
    ctx.fillRect(X, Y, S, S);
    if (k[0] === 'w') {
      const lw = Math.max(2, Math.round(s * 0.1));
      ctx.lineWidth = lw;
      ctx.strokeStyle = INK;
      ctx.strokeRect(X + lw / 2, Y + lw / 2, S - lw, S - lw);
    }
    const inl = k[0] === 'k' ? WHITE : INK, cx = X + S / 2, cy = Y + S / 2;
    switch (k[1]) {
      case 'circle':
        ctx.strokeStyle = WHITE; ctx.lineWidth = Math.max(1.5, S * 0.11);
        ctx.beginPath(); ctx.arc(cx, cy, S * 0.25, 0, Math.PI * 2); ctx.stroke();
        break;
      case 'dot':
        ctx.fillStyle = RED;
        ctx.beginPath(); ctx.arc(cx, cy, S * 0.2, 0, Math.PI * 2); ctx.fill();
        break;
      case 'tri':
        ctx.fillStyle = inl;
        ctx.beginPath(); ctx.moveTo(X + S * 0.25, Y + S * 0.25); ctx.lineTo(X + S * 0.75, Y + S * 0.75); ctx.lineTo(X + S * 0.25, Y + S * 0.75); ctx.closePath(); ctx.fill();
        break;
      case 'sq':
        ctx.fillStyle = inl;
        ctx.fillRect(cx - S * 0.16, cy - S * 0.16, S * 0.32, S * 0.32);
        break;
    }
    if (b.mark) { ctx.strokeStyle = RED; ctx.lineWidth = Math.max(2, s * 0.12); ctx.strokeRect(X + 1, Y + 1, S - 2, S - 2); }
    ctx.restore();
  }
  const makePiece = (t) => W.piece(t, [0, 1, 2, 3].map(() => ({ kind: t, color: INK })));

  // Concentric rings in one stroke.
  function rings(ctx, cx, cy, sp, R, lw, col) {
    ctx.beginPath();
    for (let r = sp; r < R; r += sp) { ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, Math.PI * 2); }
    ctx.lineWidth = lw;
    ctx.strokeStyle = col;
    ctx.stroke();
  }

  // ---------- sound ----------
  function voice() {
    W.voice = {
      move: () => W.noise({ filter: 'bandpass', freq: 4300, q: 4, dur: 0.012, vol: 0.06 }),
      rotate: () => { W.noise({ filter: 'bandpass', freq: 2500, q: 6, dur: 0.02, vol: 0.07 }); W.tone({ f: 1500, dur: 0.012, type: 'square', vol: 0.006 }); },
      lock: () => { W.tone({ f: 200, f2: 120, dur: 0.06, type: 'triangle', vol: 0.06 }); W.noise({ filter: 'lowpass', freq: 900, dur: 0.03, vol: 0.05 }); },
      drop: () => { W.tone({ f: 130, f2: 55, dur: 0.11, type: 'sine', vol: 0.1 }); W.noise({ filter: 'lowpass', freq: 520, dur: 0.06, vol: 0.08 }); },
      clear: () => {
        W.noise({ filter: 'bandpass', freq: 3200, q: 8, dur: 0.02, vol: 0.08 });
        W.noise({ filter: 'bandpass', freq: 2300, q: 8, dur: 0.02, vol: 0.08, at: 0.06 });
        W.tone({ f: 880, dur: 0.22, type: 'sine', vol: 0.035, at: 0.06 });
      },
      big: () => { W.tone({ f: 660, dur: 0.4, type: 'sine', vol: 0.04 }); W.tone({ f: 990, dur: 0.5, type: 'sine', vol: 0.03, at: 0.08 }); },
      bad: () => { W.tone({ f: 82, f2: 38, dur: 1.1, type: 'sawtooth', vol: 0.05 }); W.noise({ filter: 'lowpass', freq: 300, dur: 0.6, vol: 0.08 }); },
      win: () => bell(523, 0.05),
      tick: () => clock(true),
      buy: null, coin: null, hit: null,
    };
  }
  function clock(hi) {
    W.noise({ filter: 'bandpass', freq: hi ? 3600 : 2700, q: 12, dur: 0.028, vol: 0.12 });
    W.tone({ f: hi ? 2100 : 1600, dur: 0.018, type: 'sine', vol: 0.025 });
  }
  function bell(f, v) {
    [[1, v, 1.4], [2.76, v * 0.4, 0.9], [5.4, v * 0.2, 0.5]].forEach(([m, vol, d]) => W.tone({ f: f * m, dur: d, type: 'sine', vol, attack: 0.005 }));
  }
  function gong() {
    const base = 73.4; // D2
    [[1, 0.1, 3.0], [2.0, 0.04, 2.2], [2.76, 0.035, 1.7], [5.4, 0.016, 1.1], [8.93, 0.008, 0.7]].forEach(([m, vol, d]) =>
      W.tone({ f: base * m, f2: base * m * 0.985, dur: d, type: 'sine', vol, attack: 0.01 }));
    W.tone({ f: 36.7, dur: 1.8, type: 'triangle', vol: 0.07, attack: 0.45 });
    W.noise({ filter: 'lowpass', freq: 380, dur: 0.35, vol: 0.05 });
  }
  function thud() {
    W.tone({ f: 72, f2: 30, dur: 0.38, type: 'sine', vol: 0.22 });
    W.noise({ filter: 'lowpass', freq: 260, freq2: 70, dur: 0.32, vol: 0.25, q: 0.8 });
  }
  const fallClick = (i) => W.noise({ filter: 'bandpass', freq: 1500 + i * 70, q: 9, dur: 0.012, vol: 0.05 });
  function charge() { W.tone({ f: 220, f2: 880, dur: BREAK_HOLD_MS / 1000, type: 'sawtooth', vol: 0.02 }); }
  function crack(n) {
    W.noise({ filter: 'highpass', freq: 1400, dur: 0.22, vol: 0.12 });
    W.noise({ filter: 'lowpass', freq: 700, freq2: 110, dur: 0.55, vol: 0.14 });
    for (let i = 0; i < Math.min(n, 6); i++) W.noise({ filter: 'bandpass', freq: 2800 - i * 300, q: 6, dur: 0.02, vol: 0.07, at: 0.05 + i * 0.045 });
    bell(587, 0.04);
  }

  // ---------- mount ----------
  function mount(sh) {
    voice();
    const rng = W.rng();
    const board = new W.Board(N, N);
    const bag = W.bag(W.TYPES, rng);
    let queue = [];
    let run = null, turn = null, previewHeld = false, previewToggle = false, runOver = false;
    let pred = null, predDirty = true;
    let heat = 0, theta = 0, flash = 0, tickT = 0, tickHi = false, pulse = 0, spinOff = 0;

    const view = new W.BoardView(sh.canvas, board, {
      maxCell: 34, grid: false, background: drawBg, drawBlock: drawTile, overlay: drawOverlay,
      clearFlash, drawParticle, textFont: '"Syne", sans-serif', textWeight: 800, textStroke: PAPER,
    });
    const mini = { drawBlock: drawTile };

    const st = new W.Stacker(board, {
      gravity: 750,
      lockDelay: 450,
      next() {
        while (queue.length < 4) queue.push(makePiece(bag()));
        const p = queue.shift();
        queue.push(makePiece(bag()));
        paintQueue();
        return p;
      },
      onSpawn() { predDirty = true; },
      onLock() { run.piecesSinceTurn++; run.piecesInRound++; predDirty = true; paintStrip(); },
      onClear(rows) { scoreClear(rows); },
      afterClear() { predDirty = true; paint(); },
      beforeSpawn() {
        if (turn) {
          if (turn.phase !== 'clear') return false;
          if (!finishTurn()) return false;
        } else if (run.piecesSinceTurn >= turnEvery()) {
          startTurn();
          return false;
        }
        paint();
        return !runOver;
      },
      onHold() { paintQueue(); predDirty = true; },
      onTopOut() { loseRun('Full.'); },
    });
    sh.stackerKeys(st, {}, { downStart: () => (st.soft = true), downEnd: () => (st.soft = false) });
    const togglePreview = () => { previewToggle = !previewToggle; paintSide(); };
    sh.pad({ left: () => st.move(-1), right: () => st.move(1), down: () => st.softDrop(), rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), hold: () => st.hold(), preview: togglePreview },
      [['◀', 'left', true], ['⟲', 'rotCCW'], ['⟳', 'rotCW'], ['▶', 'right', true], ['▼', 'down', true], ['⤓', 'drop'], ['Hold', 'hold'], ['See', 'preview']]);

    const kd = (e) => { if (e.code === 'KeyR' && !sh.busy()) { e.preventDefault(); if (!previewHeld) { previewHeld = true; paintSide(); } } };
    const ku = (e) => { if (e.code === 'KeyR') { previewHeld = false; paintSide(); } };
    const blur = () => { previewHeld = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    sh.own(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); });

    // ---------- page backdrop: two ring fields that drift into moiré ----------
    const backdrop = W.el('div', 'tw-backdrop', '<i class="tw-ring a"></i><i class="tw-ring b"></i>');
    sh.root.prepend(backdrop);
    const ringB = backdrop.querySelector('.b'), ringA = backdrop.querySelector('.a');
    let lastBackSp = -1;

    // ---------- countdown strip above the well ----------
    const ARROW = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 6 A14 14 0 1 1 6 20" fill="none" stroke="currentColor" stroke-width="6"/><path d="M20 0 L30 7 L20 14 Z" fill="currentColor"/></svg>';
    const strip = W.el('div', 'tw-strip', `<span class="tw-n" data-r="n">12</span><span class="tw-seg" data-r="seg"></span><span class="tw-arrow" data-r="arrow">${ARROW}</span>`);
    sh.boardCol.prepend(strip);
    const sr = (k) => strip.querySelector(`[data-r="${k}"]`);
    sr('seg').innerHTML = Array.from({ length: 12 }, () => '<i></i>').join('');
    const segs = [...sr('seg').children];

    // ---------- side panels ----------
    const seePanel = W.el('div', 'panel tw-see');
    const rulePanel = W.el('div', 'panel tw-rule');
    sh.extra.append(seePanel, rulePanel);
    seePanel.innerHTML = `<h3>If it turned now</h3>
      <div class="tw-see-row"><canvas data-r="mini"></canvas><div class="tw-see-txt"><b data-r="predn">0</b><span data-r="predtext">nothing</span></div></div>
      <button class="btn small" type="button" data-r="prev">Hold R · see</button>`;
    const tp = (k) => seePanel.querySelector(`[data-r="${k}"]`);
    tp('prev').addEventListener('click', togglePreview);
    const miniCv = tp('mini');
    const MS = 9, dpr = window.devicePixelRatio || 1;
    miniCv.width = N * MS * dpr; miniCv.height = N * MS * dpr;
    miniCv.style.width = N * MS + 'px'; miniCv.style.height = N * MS + 'px';
    const miniCtx = miniCv.getContext('2d');
    miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isBoss = () => run.round >= BOSS_FROM;
    const turnEvery = () => (isBoss() ? 6 : 12);
    const piecesLeft = () => Math.max(0, turnEvery() - run.piecesSinceTurn);
    const previewing = () => (previewHeld || previewToggle) && !turn;

    function paintQueue() {
      sh.setQueue(queue.slice(0, 3), mini);
      sh.setHold(st.holdPiece, mini);
    }

    function paintStrip() {
      if (!run) return;
      const left = piecesLeft(), every = turnEvery();
      const hot = !turn && left <= 3;
      strip.classList.toggle('hot', hot);
      strip.classList.toggle('turning', !!turn);
      strip.classList.toggle('ccw', (turn ? turn.dir : run.nextDir) < 0);
      sr('n').textContent = turn ? 'Turning.' : hot ? `${left}.` : String(left);
      segs.forEach((s, i) => { s.hidden = i >= every; s.className = turn || i < run.piecesSinceTurn ? 'on' : ''; });
    }

    function paintSide() {
      if (!run) return;
      const on = previewHeld || previewToggle;
      tp('prev').classList.toggle('primary', on);
      tp('prev').textContent = on ? 'Seeing' : 'Hold R · see';
    }

    function paint() {
      if (!run) return;
      const t = target(run.round);
      const made = run.roundScore >= t;
      const left = Math.max(0, ROUND_PIECES - run.piecesInRound);
      sh.hud([
        { label: 'Round', html: `${run.round + 1}${isBoss() ? '<small class="tw-fast">fast</small>' : ''}` },
        { label: 'Left', value: left, tone: left <= 3 && !made ? 'bad' : '' },
        { label: 'Score / mark', html: `${fmt(run.roundScore)}<small> / ${fmt(t)}</small>${made ? '<small class="tw-made">made</small>' : ''}`, wide: true },
        { label: 'Total', value: fmt(run.total) },
        { label: 'Rows', value: st.lines },
      ]);
      rulePanel.innerHTML = `<h3>Rule</h3>
        <div class="tw-meter"><i style="width:${Math.min(100, (run.roundScore / t) * 100)}%"></i></div>
        <p><b>${MARK}+</b> blocks in a row → a pillar on the turn. Pillars break. <b>×2.</b></p>
        ${run.last ? `<div class="chips">${run.last.map((n) => `<span class="chip ${n.tone || ''}">${W.esc(n.text)}</span>`).join('')}</div>` : ''}`;
      paintStrip();
      paintSide();
    }

    // ---------- prediction ----------
    function predict() {
      const b = new W.Board(N, N);
      b.cells = board.cells.map((r) => r.slice());
      const p = st.active;
      if (p) {
        const gy = board.dropY(p);
        for (const c of W.pieceCells(p, p.rot, p.x, gy)) if (c.y >= 0) b.cells[c.y][c.x] = Object.assign({}, c.block, { mark: true });
      }
      const pre = b.fullRows();
      if (pre.length) b.removeRows(pre);
      b.cells = rotateCells(b.cells, run.nextDir);
      b.collapse();
      return { b, cols: pillarCols(b) };
    }

    function drawMini() {
      const ctx = miniCtx, s = MS;
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, N * s, N * s);
      if (!pred) return;
      const cols = new Set(pred.cols);
      pred.b.each((b, x, y) => {
        const f = fillOf(b);
        ctx.fillStyle = cols.has(x) ? RED : f === WHITE ? '#bdbcb6' : f === RED ? RED : INK;
        ctx.fillRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1);
      });
      ctx.fillStyle = RED;
      ctx.fillRect(0, (N - MARK) * s - 1, N * s, 2);
    }

    // ---------- drawing ----------
    function drawBg(ctx, Wd, Hd, s) {
      const inv = flash > 0;
      ctx.fillStyle = inv ? INK : PAPER;
      ctx.fillRect(-20, -20, Wd + 40, Hd + 40);
      const sp = s * (0.52 - 0.3 * heat);
      const R = Math.hypot(Wd, Hd) / 2 + sp * 8;
      const cx = Wd / 2, cy = Hd / 2;
      const a = 0.08 + 0.1 * heat;
      const lw = sp * 0.36;
      rings(ctx, cx, cy, sp, R, lw, inv ? `rgba(244,243,239,${a * 2})` : `rgba(17,17,17,${a})`);
      const d = sp * (1.1 + 2.8 * heat), th = theta + spinOff;
      const hot = (run && !turn && piecesLeft() <= 3) || !!turn;
      rings(ctx, cx + Math.cos(th) * d, cy + Math.sin(th) * d, sp, R + d, lw, hot ? `rgba(218,30,20,${0.12 + 0.12 * heat})` : `rgba(17,17,17,${a})`);
      // Big countdown numeral behind the stack.
      if (run && !turn && !runOver) {
        const left = piecesLeft();
        if (left <= 3 && left >= 1) {
          ctx.save();
          ctx.globalAlpha = 0.2 + 0.25 * pulse;
          ctx.font = `800 ${Math.round(s * 8.4)}px "Syne", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = RED;
          ctx.fillText(`${left}.`, cx + s * 0.3, cy + s * 0.4);
          ctx.restore();
        }
      }
    }

    function clearFlash(ctx, rows, k, s, Wd) {
      const w = s * 0.5, off = ((1 - k) * s * 3) % (w * 2);
      for (const y of rows) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, y * s, Wd, s);
        ctx.fillStyle = turn ? RED : INK;
        for (let x = -w * 2 + off; x < Wd; x += w * 2) ctx.fillRect(x, y * s, w * (0.15 + 0.85 * k), s);
      }
    }

    function drawParticle(ctx, f, s) {
      const z = f.size * 1.3;
      ctx.translate(f.x * s, f.y * s);
      ctx.rotate(f.life * 0.008 + f.size);
      ctx.fillStyle = f.color;
      if (f.size > 5) { ctx.beginPath(); ctx.moveTo(0, -z * 0.6); ctx.lineTo(z * 0.55, z * 0.4); ctx.lineTo(-z * 0.55, z * 0.4); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(-z / 2, -z / 2, z, z);
    }

    function label(ctx, str, x, y, size, color, align = 'center') {
      W.text(ctx, str, x, y, { size, color, align, font: '"Syne", sans-serif', weight: 800, stroke: PAPER, strokeWidth: Math.max(3, size * 0.22) });
    }

    function drawOverlay(ctx, s) {
      if (!run) return;
      const Wd = N * s, markY = (N - MARK) * s;
      if (previewing() && pred) {
        ctx.save();
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, Wd, Wd);
        const cols = new Set(pred.cols);
        pred.b.each((b, x, y) => drawTile(ctx, b, x * s, y * s, s, x, y, { alpha: cols.has(x) ? 1 : 0.4 }));
        ctx.strokeStyle = RED;
        ctx.lineWidth = 3;
        for (const x of cols) { const h = colCount(pred.b, x); ctx.strokeRect(x * s + 1.5, (N - h) * s + 1.5, s - 3, h * s - 3); }
        ctx.fillStyle = RED;
        ctx.fillRect(0, markY - 1.5, Wd, 3);
        label(ctx, 'If it turned.', Wd / 2, s * 0.62, Math.round(s * 0.62), INK);
        const n = pred.cols.length;
        label(ctx, n ? `${n} pillar${n > 1 ? 's' : ''}. +${fmt(turnPts(n))}` : 'Nothing.', Wd / 2, s * 1.42, Math.round(s * 0.5), n ? RED : INK);
        ctx.restore();
        return;
      }
      if (turn) {
        if (turn.phase === 'spin') return;
        // The mark: pillars that reach it break.
        ctx.fillStyle = RED;
        ctx.fillRect(0, markY - 1.5, Wd, 3);
        label(ctx, 'mark', Wd - 4, markY - s * 0.32, Math.round(s * 0.34), RED, 'right');
        if (turn.phase === 'break' && !turn.broke) {
          const on = Math.floor(turn.t / 70) % 2 === 0;
          for (const x of turn.cols) {
            const h = colCount(board, x);
            ctx.fillStyle = on ? RED : INK;
            ctx.fillRect(x * s, (N - h) * s, s, h * s);
            ctx.fillStyle = on ? INK : RED;
            for (let y = N - h; y < N; y++) ctx.fillRect(x * s, y * s + s * 0.42, s, s * 0.16);
          }
        }
        return;
      }
      // Rows at the mark get a red notch on the wall that becomes the floor.
      const left = piecesLeft();
      const floorX = run.nextDir > 0 ? Wd : 0, sg = run.nextDir > 0 ? -1 : 1;
      const nw = Math.max(4, s * 0.2);
      for (let y = 0; y < N; y++) {
        const n = rowCount(board, y);
        if (n >= MARK) { ctx.fillStyle = RED; ctx.fillRect(sg > 0 ? floorX : floorX - nw, y * s + 1, nw, s - 2); }
        else if (n === MARK - 1) { ctx.fillStyle = INK; ctx.fillRect(sg > 0 ? floorX : floorX - nw * 0.5, y * s + s * 0.3, nw * 0.5, s * 0.4); }
      }
      if (left <= 3) {
        ctx.fillStyle = `rgba(218,30,20,${0.35 + 0.5 * pulse})`;
        ctx.fillRect(sg > 0 ? 0 : Wd - 3, 0, 3, Wd);
      }
    }

    // ---------- scoring ----------
    function wellEmptyAfter(rows, cols) {
      for (let y = 0; y < N; y++) {
        if (rows && rows.includes(y)) continue;
        for (let x = 0; x < N; x++) if (board.cells[y][x] && !(cols && cols.includes(x))) return false;
      }
      return true;
    }

    function bank(pts, notes) {
      run.roundScore += pts;
      run.total += pts;
      run.last = notes.concat([{ text: `= ${fmt(pts)}`, tone: 'accent' }]);
      sh.log(`<b>+${fmt(pts)}</b> ${notes.map((x) => W.esc(x.text)).join(' · ')}`);
      paint();
    }

    function scoreClear(rows) {
      const n = rows.length;
      const notes = [{ text: `${n} row${n > 1 ? 's' : ''}` }];
      let pts = linePts(n);
      if (turn) { pts *= 2; notes.push({ text: '×2', tone: 'accent' }); }
      if (wellEmptyAfter(rows, null)) { pts += PERFECT; notes.push({ text: `Empty +${PERFECT}`, tone: 'accent' }); }
      view.rowBurst(rows, shardOf);
      view.float(`+${fmt(pts)}`, N / 2, rows[0] + 0.5, turn ? RED : INK, turn ? 30 : 22);
      if (n >= 3 || turn) view.shake(turn ? 12 : 7);
      bank(pts, notes);
    }

    // ---------- the turn ----------
    function startTurn() {
      const dir = run.nextDir;
      board.cells = rotateCells(board.cells, dir);
      turn = { phase: 'spin', t: 0, dir, cols: [], falls: 0, thud: false, broke: false, off0: spinOff };
      st.soft = false;
      previewToggle = false;
      gong();
      sh.boardFrame.classList.add('tw-spinning');
      sh.boardFrame.style.transform = `rotate(${-dir * 90}deg)`;
      paintStrip();
      paintSide();
    }

    function updateTurn(dt) {
      turn.t += dt;
      if (turn.phase === 'spin') {
        const t = Math.min(turn.t, SPIN_MS);
        const a = spinAngle(t);
        const k = Math.max(0, Math.min(1, (t - WIND_MS) / (SLAM_MS - WIND_MS)));
        const sc = 1 - 0.2 * Math.sin(Math.PI * k);
        sh.boardFrame.style.transform = `rotate(${turn.dir * (a - 90)}deg) scale(${sc.toFixed(4)})`;
        spinOff = turn.off0 + turn.dir * (a / 90) * Math.PI;
        if (!turn.thud && turn.t >= SLAM_MS) {
          turn.thud = true;
          thud();
          view.shake(18);
          flash = 90;
        }
        if (turn.t >= SPIN_MS) {
          sh.boardFrame.style.transform = '';
          sh.boardFrame.classList.remove('tw-spinning');
          turn.phase = 'fall';
          turn.t = 0;
        }
      } else if (turn.phase === 'fall') {
        while (turn && turn.phase === 'fall' && turn.t >= FALL_STEP_MS) {
          turn.t -= FALL_STEP_MS;
          if (stepFall(board)) fallClick(turn.falls++);
          else settle();
        }
      } else if (turn.phase === 'break') {
        if (!turn.broke && turn.t >= BREAK_HOLD_MS) breakPillars();
        if (turn.t >= BREAK_END_MS) { turn.phase = 'clear'; st.checkClears(); }
      }
    }

    function settle() {
      if (turn.falls) { W.sfx('drop'); view.shake(Math.min(10, 3 + turn.falls / 3)); }
      predDirty = true;
      const cols = pillarCols(board);
      if (!cols.length) {
        sh.log('Turned. Nothing.');
        turn.phase = 'clear';
        st.checkClears();
        return;
      }
      turn.cols = cols;
      turn.phase = 'break';
      turn.t = 0;
      charge();
    }

    function breakPillars() {
      turn.broke = true;
      const cols = turn.cols, n = cols.length;
      let pts = turnPts(n);
      const notes = [{ text: `${n} pillar${n > 1 ? 's' : ''}` }, { text: '×2', tone: 'accent' }];
      if (wellEmptyAfter(null, cols)) { pts += PERFECT; notes.push({ text: `Empty +${PERFECT}`, tone: 'accent' }); }
      for (const x of cols) for (let y = 0; y < N; y++) {
        const b = board.cells[y][x];
        if (!b) continue;
        view.burst(x + 0.5, y + 0.5, y % 2 ? RED : shardOf(b), 3, 11);
        board.cells[y][x] = null;
      }
      st.lines += n;
      run.pillars += n;
      crack(n);
      view.shake(20);
      flash = 60;
      view.float(`+${fmt(pts)}`, N / 2, N - MARK - 0.6, RED, 44);
      view.float(`${n} pillar${n > 1 ? 's' : ''}.`, N / 2, N - MARK + 0.6, INK, 22);
      bank(pts, notes);
    }

    // Returns false when spawning should not continue.
    function finishTurn() {
      const t = turn;
      turn = null;
      run.piecesSinceTurn = 0;
      run.turns++;
      if (isBoss()) run.nextDir = -t.dir;
      predDirty = true;
      if (run.piecesInRound >= ROUND_PIECES) return endRound();
      paint();
      return true;
    }

    function endRound() {
      const t = target(run.round);
      if (run.roundScore < t) { loseRun(`Missed the mark. ${fmt(run.roundScore)} of ${fmt(t)}.`); return false; }
      W.sfx('win');
      sh.log(`Round ${run.round + 1}. <b>${fmt(run.roundScore)}</b>.`);
      run.round++;
      run.roundScore = 0;
      run.piecesInRound = 0;
      run.last = null;
      st.o.gravity = Math.max(160, 750 - run.round * 75);
      if (run.round === BOSS_FROM) {
        run.nextDir = -1;
        sh.toast('Faster. Both ways.', 'bad');
      } else sh.toast(`Round ${run.round + 1}. Mark ${fmt(target(run.round))}.`);
      paint();
      return true;
    }

    function loseRun(why) {
      if (runOver) return;
      runOver = true;
      st.paused = true;
      paint();
      sh.overlay({
        title: 'Still.',
        body: `<p class="tw-lead">${fmt(run.total)}</p>
          <p>Round ${run.round + 1}. ${run.turns} turn${run.turns === 1 ? '' : 's'}. ${run.pillars} pillar${run.pillars === 1 ? '' : 's'}.</p>
          <p class="tw-small">${W.esc(why)}</p>`,
        button: 'Again.',
      }).then(newRun);
    }

    function freshRun() {
      return { round: 0, roundScore: 0, total: 0, piecesSinceTurn: 0, piecesInRound: 0, nextDir: 1, turns: 0, pillars: 0, last: null };
    }

    function newRun() {
      board.clear();
      st.reset();
      st.o.gravity = 750;
      sh.boardFrame.style.transform = '';
      sh.boardFrame.classList.remove('tw-spinning');
      turn = null;
      runOver = false;
      previewToggle = false;
      queue = [];
      run = freshRun();
      sh.logEl.innerHTML = '';
      paint();
      st.spawn();
    }

    let miniT = 0;
    sh.debug = { board, st, view, getRun: () => run, getTurn: () => turn, pillarCols, rotateCells, startTurn: () => { run.piecesSinceTurn = 99; } };
    sh.loop((dt) => {
      if (turn && !st.clearing) updateTurn(dt);
      st.update(dt);
      view.update(dt);
      if (run) {
        const goal = turn ? 1 : run.piecesSinceTurn / turnEvery();
        heat += (goal - heat) * Math.min(1, dt / (turn ? 200 : 450));
        if (!turn && heat > goal + 0.3) heat = goal; // snap back after a turn
        theta += dt * (0.00012 + 0.0011 * heat * heat);
        flash = Math.max(0, flash - dt);
        pulse = Math.max(0, pulse - dt / 260);
        // The clock: ticks speed up over the last three pieces.
        const left = piecesLeft();
        if (!turn && !runOver && !sh.busy() && st.active && left <= 3) {
          tickT -= dt;
          if (tickT <= 0) { tickT = [0, 240, 400, 600][left]; tickHi = !tickHi; clock(tickHi); pulse = 1; }
        } else tickT = 0;
        // Page rings: spacing follows heat, the second field orbits.
        const bsp = Math.round(24 - 12 * heat);
        if (bsp !== lastBackSp) {
          lastBackSp = bsp;
          backdrop.style.setProperty('--tw-sp', bsp + 'px');
          backdrop.classList.toggle('hot', !!turn || piecesLeft() <= 3);
        }
        const d = 10 + 50 * heat, th = theta * 0.8 + spinOff;
        ringB.style.transform = `translate(${(Math.cos(th) * d).toFixed(1)}px, ${(Math.sin(th) * d).toFixed(1)}px)`;
        ringA.style.transform = `translate(${(-Math.cos(th * 0.5) * d * 0.25).toFixed(1)}px, 0)`;
      }
      miniT -= dt;
      if (run && (predDirty || miniT <= 0) && !turn) {
        pred = predict();
        predDirty = false;
        miniT = 150;
        drawMini();
        const n = pred.cols.length;
        tp('predn').textContent = n;
        tp('predn').classList.toggle('on', n > 0);
        tp('predtext').textContent = n ? `pillar${n > 1 ? 's' : ''}. +${fmt(turnPts(n))}` : 'nothing';
      }
      view.draw(st);
    });

    run = freshRun();
    paint();
    view.draw(st);
    sh.overlay({
      title: 'Turn.',
      body: `<p class="tw-lead">12 pieces. Then it turns.</p>
        <p>Rows become pillars. A row with <b>${MARK}+</b> blocks stands to the red mark and breaks. <b>×2.</b></p>
        <p class="tw-small">Hold R (or See) to preview the turn. Reach each round's mark. Round ${BOSS_FROM + 1}: every 6, both ways.</p>`,
      button: 'Begin.',
    }).then(newRun);
  }

  // ---------- hub card ----------
  function art(ctx, w, h) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    rings(ctx, 196, 58, 6, 260, 2.2, 'rgba(17,17,17,0.5)');
    rings(ctx, 210, 66, 6, 260, 2.2, 'rgba(218,30,20,0.55)');
    // a tilted well, mid-turn
    const s = 9, cx = 96, cy = 64;
    ctx.translate(cx, cy);
    ctx.rotate(-0.42);
    ctx.fillStyle = INK;
    ctx.fillRect(-40, -40, 80, 80);
    ctx.fillStyle = PAPER;
    ctx.fillRect(-36, -36, 72, 72);
    const rows = ['        ', '        ', '      O ', '    TTTO', 'IIIIJ TO', 'SSZZJJJL', 'LSSZZLLL', 'TTTJJ LL'];
    rows.forEach((r, y) => [...r].forEach((c, x) => {
      if (c !== ' ') drawTile(ctx, { kind: c }, -36 + x * s, -36 + y * s, s);
    }));
    ctx.restore();
    // the turn arrow
    const R = 56, a0 = -Math.PI * 0.95, a1 = -Math.PI * 0.32;
    ctx.strokeStyle = RED;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(cx, cy, R, a0, a1);
    ctx.stroke();
    const ax = cx + Math.cos(a1) * R, ay = cy + Math.sin(a1) * R;
    const tx = -Math.sin(a1), ty = Math.cos(a1); // tangent (clockwise)
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.moveTo(ax + tx * 14, ay + ty * 14);
    ctx.lineTo(ax - ty * 10, ay + tx * 10);
    ctx.lineTo(ax + ty * 10, ay - tx * 10);
    ctx.closePath(); ctx.fill();
    ctx.font = '800 54px "Syne", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 6;
    ctx.strokeStyle = PAPER;
    ctx.strokeText('3.', w - 14, h - 14);
    ctx.fillStyle = INK;
    ctx.fillText('3.', w - 14, h - 14);
  }

  W.register({
    id: 'turnwell',
    num: 11,
    title: 'Turnwell',
    mix: 'Rotating gravity × falling blocks',
    pitch: 'Twelve pieces, then the well turns. Rows one or two short stand up as pillars and break.',
    palette: [INK, WHITE, RED],
    shell: { keysHint: '← → move · ↑ Z rotate · ↓ soft · Space drop · C hold · hold R: see the turn', logTitle: 'Record' },
    art,
    mount,
  });
})();

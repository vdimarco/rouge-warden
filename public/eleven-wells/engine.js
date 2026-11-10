/* Eleven Wells shared engine.
 * Board, pieces, stacker controller, canvas renderer, input, sound and the UI shell
 * every prototype mounts into. Exposed as window.Wells. Games register with Wells.register().
 */
(function () {
  'use strict';
  const K = (window.Wells = {});

  // ---------- random ----------
  // Seeded RNG (mulberry32). r() -> [0,1); r.int(n); r.pick(arr); r.shuffle(arr); r.chance(p)
  K.rng = function (seed) {
    let s = seed == null ? (Math.random() * 2 ** 32) >>> 0 : seed >>> 0;
    const r = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.int = (n) => Math.floor(r() * n);
    r.range = (a, b) => a + Math.floor(r() * (b - a + 1));
    r.pick = (a) => a[Math.floor(r() * a.length)];
    r.chance = (p) => r() < p;
    r.shuffle = (a) => {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return r;
  };
  K.random = K.rng();

  // ---------- pieces ----------
  // Shapes live in an n×n box, y grows downward. Rotation keeps mino order,
  // so per-block data (suits, words, seeds...) follows its mino as the piece turns.
  K.COLORS = {
    I: '#4fd6ff', O: '#ffd84f', T: '#b77bff', S: '#6ee07a', Z: '#ff6273',
    J: '#5b7bff', L: '#ff9a4a', M: '#e6e4f5', D: '#9ad0c2', G: '#4a4f78',
  };
  const SHAPES = {
    I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
    T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
    M: { n: 1, cells: [[0, 0]] },
    D: { n: 2, cells: [[0, 0], [1, 0]] },
  };
  K.SHAPES = SHAPES;
  K.TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const rotMemo = {};
  K.defineShape = (name, n, cells, color) => {
    SHAPES[name] = { n, cells };
    if (color) K.COLORS[name] = color;
    delete rotMemo[name];
  };
  K.shapeCells = (type, rot) => {
    if (!rotMemo[type]) {
      const s = SHAPES[type];
      const rots = [s.cells.map((c) => c.slice())];
      for (let i = 1; i < 4; i++) rots.push(rots[i - 1].map(([x, y]) => [s.n - 1 - y, x]));
      rotMemo[type] = rots;
    }
    return rotMemo[type][((rot % 4) + 4) % 4];
  };
  // A piece: { type, rot, x, y, n, blocks[] }. blocks[i] is any object with at least {color}.
  K.piece = (type, blocks) => {
    const s = SHAPES[type];
    const color = K.COLORS[type] || '#cccccc';
    return { type, rot: 0, x: 0, y: 0, n: s.n, blocks: blocks || s.cells.map(() => ({ color })) };
  };
  K.pieceCells = (p, rot = p.rot, x = p.x, y = p.y) =>
    K.shapeCells(p.type, rot).map(([cx, cy], i) => ({ x: x + cx, y: y + cy, block: p.blocks[i] }));

  // Classic 7-bag over any list of types.
  K.bag = (types = K.TYPES, rng = K.random) => {
    let pool = [];
    return () => {
      if (!pool.length) pool = rng.shuffle(types.slice());
      return pool.pop();
    };
  };

  // ---------- board ----------
  class Board {
    constructor(w = 10, h = 20) {
      this.w = w;
      this.h = h;
      this.cells = [];
      for (let y = 0; y < h; y++) this.cells.push(new Array(w).fill(null));
    }
    inBounds(x, y) { return x >= 0 && x < this.w && y >= 0 && y < this.h; }
    get(x, y) { return this.inBounds(x, y) ? this.cells[y][x] : null; }
    set(x, y, b) { if (this.inBounds(x, y)) this.cells[y][x] = b; }
    fits(p, rot = p.rot, x = p.x, y = p.y) {
      for (const c of K.pieceCells(p, rot, x, y)) {
        if (c.x < 0 || c.x >= this.w || c.y >= this.h) return false;
        if (c.y >= 0 && this.cells[c.y][c.x]) return false;
      }
      return true;
    }
    // Writes shallow copies of the piece's blocks. Returns [{x,y,block}] (block = the placed copy).
    place(p) {
      const out = [];
      for (const c of K.pieceCells(p)) {
        const b = Object.assign({}, c.block);
        if (c.y >= 0) this.cells[c.y][c.x] = b;
        out.push({ x: c.x, y: c.y, block: b });
      }
      return out;
    }
    dropY(p) {
      let y = p.y;
      while (this.fits(p, p.rot, p.x, y + 1)) y++;
      return y;
    }
    rowFull(y) { return this.cells[y].every(Boolean); }
    rowEmpty(y) { return this.cells[y].every((c) => !c); }
    fullRows() {
      const r = [];
      for (let y = 0; y < this.h; y++) if (this.rowFull(y)) r.push(y);
      return r;
    }
    removeRows(rows) {
      const drop = new Set(rows);
      const kept = this.cells.filter((_, y) => !drop.has(y));
      while (kept.length < this.h) kept.unshift(new Array(this.w).fill(null));
      this.cells = kept;
    }
    // Push a row in from the bottom. Returns true if something was pushed off the top.
    addRow(row) {
      const top = this.cells.shift();
      this.cells.push(row);
      return top.some(Boolean);
    }
    garbageRow(holeX, block = { color: K.COLORS.G, garbage: true }) {
      const row = new Array(this.w).fill(null).map((_, x) => (x === holeX ? null : Object.assign({}, block)));
      return this.addRow(row);
    }
    // Naive gravity: every block falls straight down its column. Returns true if anything moved.
    collapse() {
      let moved = false;
      for (let x = 0; x < this.w; x++) {
        let write = this.h - 1;
        for (let y = this.h - 1; y >= 0; y--) {
          const b = this.cells[y][x];
          if (!b) continue;
          if (b.fixed) { write = y - 1; continue; }
          if (y !== write) { this.cells[write][x] = b; this.cells[y][x] = null; moved = true; }
          write--;
        }
      }
      return moved;
    }
    each(fn) {
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.cells[y][x]) fn(this.cells[y][x], x, y);
    }
    count(fn = () => true) {
      let n = 0;
      this.each((b, x, y) => { if (fn(b, x, y)) n++; });
      return n;
    }
    stackHeight() {
      for (let y = 0; y < this.h; y++) if (!this.rowEmpty(y)) return this.h - y;
      return 0;
    }
    holes() {
      let n = 0;
      for (let x = 0; x < this.w; x++) {
        let roof = false;
        for (let y = 0; y < this.h; y++) {
          if (this.cells[y][x]) roof = true;
          else if (roof) n++;
        }
      }
      return n;
    }
    clear() { this.cells.forEach((r) => r.fill(null)); }
  }
  K.Board = Board;

  // ---------- stacker: the falling-piece controller ----------
  // Options:
  //   next()            -> piece for the next spawn (required)
  //   gravity           ms per row; 0 = no gravity (turn-based: piece waits, locks only on hard drop)
  //   lockDelay         ms grounded before lock
  //   clearDelay        ms rows flash before removal
  //   hold              allow hold
  //   onSpawn(p)
  //   onLock(cells, p)  after place, before clears. cells = [{x,y,block}]
  //   findClears(board) -> row indices to clear (default: full rows)
  //   onClear(rows, rowBlocks) score here. Return false to keep rows (you handle the board yourself).
  //   afterClear(rows)  after rows were removed
  //   beforeSpawn()     return false to stop spawning (round over, shop...). Call stacker.spawn() later.
  //   onTopOut()
  const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];
  class Stacker {
    constructor(board, o) {
      this.board = board;
      this.o = Object.assign({ gravity: 800, lockDelay: 500, softRate: 35, clearDelay: 220, hold: true }, o);
      this.active = null;
      this.holdPiece = null;
      this.holdUsed = false;
      this.fallT = 0;
      this.lockT = 0;
      this.lockResets = 0;
      this.clearing = null;
      this.over = false;
      this.paused = false;
      this.soft = false;
      this.lines = 0;
      this.pieces = 0;
    }
    // Back to a fresh state (does not touch the board). Call spawn() to begin.
    reset() {
      this.active = null;
      this.holdPiece = null;
      this.holdUsed = false;
      this.clearing = null;
      this.over = false;
      this.paused = false;
      this.soft = false;
      this.lines = 0;
      this.pieces = 0;
    }
    spawn(p) {
      p = p || this.o.next();
      if (!p) { this.active = null; return false; }
      p.rot = 0;
      const cells = K.shapeCells(p.type, 0);
      const minY = Math.min(...cells.map((c) => c[1]));
      p.x = Math.floor((this.board.w - p.n) / 2);
      p.y = -minY;
      this.active = p;
      this.fallT = 0;
      this.lockT = 0;
      this.lockResets = 0;
      if (!this.board.fits(p)) {
        p.y -= 1;
        if (!this.board.fits(p)) { this.topOut(); return false; }
      }
      this.o.onSpawn && this.o.onSpawn(p);
      return true;
    }
    topOut() {
      if (this.over) return;
      this.over = true;
      this.active = null;
      K.sfx('bad');
      this.o.onTopOut && this.o.onTopOut();
    }
    canAct() { return !!this.active && !this.clearing && !this.over && !this.paused; }
    grounded() { const p = this.active; return p && !this.board.fits(p, p.rot, p.x, p.y + 1); }
    nudgeLock() { if (this.grounded() && this.lockResets < 15) { this.lockT = 0; this.lockResets++; } }
    move(dx) {
      if (!this.canAct()) return false;
      const p = this.active;
      if (!this.board.fits(p, p.rot, p.x + dx, p.y)) return false;
      p.x += dx;
      this.nudgeLock();
      K.sfx('move');
      return true;
    }
    rotate(dir = 1) {
      if (!this.canAct()) return false;
      const p = this.active;
      const r = p.rot + dir;
      for (const [kx, ky] of KICKS) {
        if (this.board.fits(p, r, p.x + kx, p.y + ky)) {
          p.rot = ((r % 4) + 4) % 4;
          p.x += kx;
          p.y += ky;
          this.nudgeLock();
          K.sfx('rotate');
          return true;
        }
      }
      return false;
    }
    softDrop() {
      if (!this.canAct()) return false;
      const p = this.active;
      if (this.board.fits(p, p.rot, p.x, p.y + 1)) { p.y++; this.fallT = 0; return true; }
      return false;
    }
    hardDrop() {
      if (!this.canAct()) return;
      const p = this.active;
      this.lastDrop = this.board.dropY(p) - p.y;
      p.y += this.lastDrop;
      K.sfx('drop');
      this.lock();
    }
    hold() {
      if (!this.canAct() || !this.o.hold || this.holdUsed) return;
      const cur = this.active;
      cur.rot = 0;
      const h = this.holdPiece;
      this.holdPiece = cur;
      this.spawn(h || undefined);
      this.holdUsed = true;
      K.sfx('rotate');
      this.o.onHold && this.o.onHold(this.holdPiece);
    }
    ghostY() { return this.active ? this.board.dropY(this.active) : 0; }
    update(dt) {
      if (this.over || this.paused) return;
      if (this.clearing) {
        this.clearing.t -= dt;
        if (this.clearing.t <= 0) this.finishClear();
        return;
      }
      const p = this.active;
      if (!p || this.o.gravity <= 0) return;
      if (!this.grounded()) {
        this.fallT += dt;
        const g = this.soft ? Math.min(this.o.gravity, this.o.softRate) : this.o.gravity;
        while (this.fallT >= g) {
          this.fallT -= g;
          if (this.board.fits(p, p.rot, p.x, p.y + 1)) p.y++;
          else break;
        }
        this.lockT = 0;
      } else {
        this.lockT += dt;
        if (this.lockT >= this.o.lockDelay) this.lock();
      }
    }
    lock() {
      const p = this.active;
      if (!p) return;
      const cells = this.board.place(p);
      this.active = null;
      this.pieces++;
      this.holdUsed = false;
      K.sfx('lock');
      this.o.onLock && this.o.onLock(cells, p);
      if (this.over) return;
      if (cells.some((c) => c.y < 0)) { this.topOut(); return; }
      this.checkClears();
    }
    // Call after you change the board yourself to run the clear pass again.
    checkClears() {
      const rows = this.o.findClears ? this.o.findClears(this.board) : this.board.fullRows();
      if (rows && rows.length) {
        const blocks = rows.map((y) => this.board.cells[y].slice());
        this.clearing = { rows, blocks, t: this.o.clearDelay, total: this.o.clearDelay, remove: true };
        const ret = this.o.onClear && this.o.onClear(rows, blocks);
        this.clearing.remove = ret !== false;
        K.sfx(rows.length >= 4 ? 'big' : 'clear');
        if (this.o.clearDelay <= 0) this.finishClear();
      } else this.afterLock();
    }
    finishClear() {
      const c = this.clearing;
      this.clearing = null;
      if (c.remove) this.board.removeRows(c.rows);
      this.lines += c.rows.length;
      this.o.afterClear && this.o.afterClear(c.rows);
      this.afterLock();
    }
    afterLock() {
      if (this.over) return;
      if (this.o.beforeSpawn && this.o.beforeSpawn() === false) return;
      this.spawn();
    }
  }
  K.Stacker = Stacker;

  // ---------- rendering ----------
  K.shade = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return '#' + ((1 << 24) | (f(r) << 16) | (f(g) << 8) | f(b)).toString(16).slice(1);
  };
  K.drawBlock = (ctx, px, py, s, color, o = {}) => {
    ctx.save();
    if (o.ghost) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 3, py + 3, s - 6, s - 6);
      ctx.restore();
      return;
    }
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    const e = Math.max(2, Math.round(s * 0.14));
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, s - 2, s - 2);
    ctx.fillStyle = K.shade(color, 0.35);
    ctx.fillRect(px + 1, py + 1, s - 2, e);
    ctx.fillRect(px + 1, py + 1, e, s - 2);
    ctx.fillStyle = K.shade(color, -0.35);
    ctx.fillRect(px + 1, py + s - 1 - e, s - 2, e);
    ctx.fillRect(px + s - 1 - e, py + 1, e, s - 2);
    ctx.restore();
  };
  K.text = (ctx, str, x, y, o = {}) => {
    ctx.save();
    ctx.font = `${o.weight || 700} ${o.size || 12}px ${o.font || '"Chakra Petch", system-ui, sans-serif'}`;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.stroke) { ctx.lineWidth = o.strokeWidth || 3; ctx.strokeStyle = o.stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(str, x, y);
    ctx.restore();
  };
  // Cell size that fits a board on this screen.
  K.autoCell = (w, h, maxCell = 30) => {
    const byH = Math.floor((window.innerHeight - (window.innerWidth < 760 ? 260 : 170)) / h);
    const byW = Math.floor((Math.min(window.innerWidth, 1100) - (window.innerWidth < 760 ? 40 : 380)) / w);
    return Math.max(14, Math.min(maxCell, byH, byW));
  };

  // BoardView options:
  //   cell, ghost (bool), grid (bool), background, blockColor(block)->color,
  //   decorate(ctx, block, px, py, s, x, y)  draw extra detail on top of a block
  //   drawBlock(ctx, block, px, py, s, x, y, o) fully replace block drawing
  //   underlay(ctx, s) / overlay(ctx, s)     draw under / over the cells (in board px space)
  //   background: colour string, or fn(ctx, W, H, s, t) to paint the whole well yourself
  //   clearFlash(ctx, rows, k, s, W)         replace the white flash on clearing rows (k runs 0..1)
  //   drawParticle(ctx, f, s)                replace square particles (f: {x, y, color, size, life, max} in cells)
  //   textFont, textStroke, textWeight       style for float() text
  class BoardView {
    constructor(canvas, board, o = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.board = board;
      this.o = Object.assign({ ghost: true, grid: true, background: '#121530', gridColor: 'rgba(160,170,255,0.06)', blockColor: (b) => b.color }, o);
      this.cell = this.o.cell || K.autoCell(board.w, board.h, this.o.maxCell);
      this.fx = [];
      this.texts = [];
      this.shakeT = 0;
      this.fit();
    }
    fit() {
      const s = this.cell, dpr = window.devicePixelRatio || 1;
      const W = this.board.w * s, H = this.board.h * s;
      if (this.W !== W || this.H !== H || this.dpr !== dpr) {
        this.W = W; this.H = H; this.dpr = dpr;
        this.canvas.width = W * dpr;
        this.canvas.height = H * dpr;
        this.canvas.style.width = W + 'px';
      }
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    drawCell(b, x, y, o) {
      const s = this.cell, px = x * s, py = y * s, ctx = this.ctx;
      if (this.o.drawBlock) this.o.drawBlock(ctx, b, px, py, s, x, y, o || {});
      else K.drawBlock(ctx, px, py, s, this.o.blockColor(b), o);
      if (this.o.decorate && !(o && o.ghost)) this.o.decorate(ctx, b, px, py, s, x, y);
    }
    draw(st) {
      this.fit();
      const ctx = this.ctx, s = this.cell, b = this.board;
      ctx.save();
      if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * this.shakeT * 0.6, (Math.random() - 0.5) * this.shakeT * 0.6);
      if (typeof this.o.background === 'function') this.o.background(ctx, this.W, this.H, s, performance.now());
      else { ctx.fillStyle = this.o.background; ctx.fillRect(-20, -20, this.W + 40, this.H + 40); }
      if (this.o.grid) {
        ctx.strokeStyle = this.o.gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 1; x < b.w; x++) { ctx.moveTo(x * s + 0.5, 0); ctx.lineTo(x * s + 0.5, this.H); }
        for (let y = 1; y < b.h; y++) { ctx.moveTo(0, y * s + 0.5); ctx.lineTo(this.W, y * s + 0.5); }
        ctx.stroke();
      }
      this.o.underlay && this.o.underlay(ctx, s);
      for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) { const c = b.cells[y][x]; if (c) this.drawCell(c, x, y); }
      if (st && st.clearing) {
        const k = st.clearing.t / st.clearing.total;
        if (this.o.clearFlash) this.o.clearFlash(ctx, st.clearing.rows, k, s, this.W);
        else {
          ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.6 * Math.abs(Math.sin(k * Math.PI * 2))})`;
          for (const y of st.clearing.rows) ctx.fillRect(0, y * s, this.W, s);
        }
      }
      if (st && st.active) {
        const p = st.active;
        if (this.o.ghost) {
          const gy = st.ghostY();
          if (gy !== p.y) for (const c of K.pieceCells(p, p.rot, p.x, gy)) if (c.y >= 0) this.drawCell(c.block, c.x, c.y, { ghost: true });
        }
        for (const c of K.pieceCells(p)) if (c.y >= 0) this.drawCell(c.block, c.x, c.y);
      }
      this.o.overlay && this.o.overlay(ctx, s);
      for (const f of this.fx) {
        ctx.globalAlpha = Math.max(0, f.life / f.max);
        if (this.o.drawParticle) { ctx.save(); this.o.drawParticle(ctx, f, s); ctx.restore(); continue; }
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x * s - f.size / 2, f.y * s - f.size / 2, f.size, f.size);
      }
      ctx.globalAlpha = 1;
      for (const t of this.texts) {
        ctx.globalAlpha = Math.min(1, t.life / 300);
        K.text(ctx, t.text, t.x * s, t.y * s, { size: t.size, color: t.color, stroke: this.o.textStroke || '#0b0d1c', strokeWidth: 4, font: this.o.textFont || '"Bungee", "Chakra Petch", sans-serif', weight: this.o.textWeight || 400 });
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    update(dt) {
      for (const f of this.fx) { f.x += f.vx * dt / 1000; f.y += f.vy * dt / 1000; f.vy += 18 * dt / 1000; f.life -= dt; }
      this.fx = this.fx.filter((f) => f.life > 0);
      for (const t of this.texts) { t.y -= 1.4 * dt / 1000; t.life -= dt; }
      this.texts = this.texts.filter((t) => t.life > 0);
      this.shakeT = Math.max(0, this.shakeT - dt / 30);
    }
    // x, y in cell units (use x+0.5 for a cell center)
    burst(x, y, color = '#ffffff', n = 10, speed = 6) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random());
        this.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 500 + Math.random() * 400, max: 900, color, size: 3 + Math.random() * 4 });
      }
    }
    rowBurst(rows, colorOf) {
      for (const y of rows) for (let x = 0; x < this.board.w; x++) {
        const b = this.board.cells[y][x];
        this.burst(x + 0.5, y + 0.5, colorOf ? colorOf(b) : (b && b.color) || '#fff', 3);
      }
    }
    float(text, x, y, color = '#ffffff', size = 18) { this.texts.push({ text: String(text), x, y, color, size, life: 1100 }); }
    shake(amount = 10) { this.shakeT = Math.max(this.shakeT, amount); }
    // Board cell under a pointer event, accounting for CSS scaling.
    cellAt(e) {
      const r = this.canvas.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * this.board.w);
      const y = Math.floor(((e.clientY - r.top) / r.height) * this.board.h);
      return { x, y };
    }
  }
  K.BoardView = BoardView;

  // Small canvas showing one piece (rotation 0). Uses the same block drawing as a view.
  K.mini = (p, cell = 16, o = {}) => {
    const cv = document.createElement('canvas');
    if (!p) { cv.width = cell * 4; cv.height = cell * 2; cv.className = 'mini empty'; return cv; }
    const cells = K.shapeCells(p.type, 0);
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const w = Math.max(...xs) - minX + 1, h = Math.max(...ys) - minY + 1;
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * cell * dpr;
    cv.height = h * cell * dpr;
    cv.style.width = w * cell + 'px';
    cv.style.height = h * cell + 'px';
    cv.className = 'mini';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cells.forEach(([x, y], i) => {
      const b = p.blocks[i], px = (x - minX) * cell, py = (y - minY) * cell;
      if (o.drawBlock) o.drawBlock(ctx, b, px, py, cell, x, y, {});
      else K.drawBlock(ctx, px, py, cell, (o.blockColor || ((b) => b.color))(b));
      if (o.decorate) o.decorate(ctx, b, px, py, cell, x, y);
    });
    return cv;
  };

  // ---------- loop ----------
  K.loop = (fn) => {
    let last = performance.now(), id = 0, live = true;
    const tick = (t) => {
      if (!live) return;
      const dt = Math.min(50, t - last);
      last = t;
      fn(dt, t);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => { live = false; cancelAnimationFrame(id); };
  };

  // ---------- input ----------
  // map: { left, right, down, rotCW, rotCCW, drop, hold, pause, ...custom } -> functions.
  // o.extra: extra code->action bindings, e.g. { Digit1: 'pick1' }.
  // o.downStart / o.downEnd: called on soft-drop press/release (for gravity soft drop).
  // o.enabled(): return false to ignore keys (e.g. while a modal is open).
  K.keys = (map, o = {}) => {
    const binds = Object.assign({
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down',
      ArrowUp: 'rotCW', KeyX: 'rotCW', KeyW: 'rotCW', KeyZ: 'rotCCW', KeyQ: 'rotCCW', Space: 'drop',
      KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold', KeyP: 'pause',
    }, o.extra || {});
    const repeat = new Set(o.repeat || ['left', 'right', 'down']);
    const timers = {};
    const stop = (a) => { if (timers[a]) { clearTimeout(timers[a].t); clearInterval(timers[a].i); delete timers[a]; } };
    const kd = (e) => {
      const a = binds[e.code];
      if (!a || !map[a]) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (o.enabled && !o.enabled()) return;
      e.preventDefault();
      if (e.repeat) return;
      map[a]();
      if (a === 'down' && o.downStart) o.downStart();
      if (repeat.has(a)) {
        stop(a);
        timers[a] = { t: setTimeout(() => { timers[a].i = setInterval(() => map[a](), a === 'down' ? 35 : 45); }, 150) };
      }
    };
    const ku = (e) => {
      const a = binds[e.code];
      if (!a) return;
      stop(a);
      if (a === 'down' && o.downEnd) o.downEnd();
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const blur = () => Object.keys(timers).forEach(stop);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      Object.keys(timers).forEach(stop);
    };
  };
  // Standard keyboard wiring for a Stacker.
  K.stackerKeys = (st, extra = {}, o = {}) =>
    K.keys(Object.assign({
      left: () => st.move(-1), right: () => st.move(1), down: () => st.softDrop(),
      rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), hold: () => st.hold(),
    }, extra), o);

  // On-screen buttons (shown on touch screens via CSS). buttons: [[label, action, repeat?], ...]
  K.pad = (container, map, buttons) => {
    buttons = buttons || [['◀', 'left', true], ['⟲', 'rotCCW'], ['⟳', 'rotCW'], ['▶', 'right', true], ['▼', 'down', true], ['⤓', 'drop'], ['Hold', 'hold']];
    container.innerHTML = '';
    const cleanups = [];
    for (const [label, action, rep] of buttons) {
      if (!map[action]) continue;
      const b = document.createElement('button');
      b.className = 'pad-btn';
      b.type = 'button';
      b.textContent = label;
      b.setAttribute('aria-label', action);
      let t, i;
      const end = () => { clearTimeout(t); clearInterval(i); };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        map[action]();
        if (rep) t = setTimeout(() => { i = setInterval(map[action], 50); }, 170);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, end));
      cleanups.push(end);
      container.appendChild(b);
    }
    return () => cleanups.forEach((f) => f());
  };

  // ---------- sound ----------
  let actx = null;
  K.muted = false;
  try { K.muted = localStorage.getItem('wells-muted') === '1'; } catch (e) { /* storage blocked */ }
  const TONES = {
    move: [260, 0.025, 'square', 0.015], rotate: [380, 0.035, 'square', 0.02], lock: [120, 0.07, 'triangle', 0.1],
    drop: [95, 0.09, 'triangle', 0.13], clear: [523, 0.16, 'sine', 0.1, 784], big: [392, 0.38, 'sawtooth', 0.07, 1046],
    buy: [660, 0.12, 'sine', 0.09, 990], bad: [160, 0.32, 'sawtooth', 0.08, 70], win: [523, 0.5, 'triangle', 0.11, 1318],
    tick: [900, 0.02, 'square', 0.02], coin: [988, 0.09, 'square', 0.04, 1318], hit: [200, 0.12, 'square', 0.07, 90],
  };
  // Shared AudioContext, or null when muted, hidden (so a suspended context stays suspended) or unavailable. Games that synthesize their own sounds start here.
  K.audio = () => {
    if (K.muted || document.hidden) return null;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  };
  // One enveloped oscillator. o: { f, f2, dur, type, vol, at (seconds from now), out (node), attack }
  K.tone = (o) => {
    const ctx = K.audio();
    if (!ctx) return;
    const now = ctx.currentTime + (o.at || 0), dur = o.dur || 0.1, vol = o.vol == null ? 0.08 : o.vol;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, now);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, now + dur);
    if (o.detune) osc.detune.setValueAtTime(o.detune, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g).connect(o.out || ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  };
  // Filtered noise burst. o: { dur, vol, at, filter: 'lowpass'|'highpass'|'bandpass', freq, freq2, q, out }
  let noiseBuf = null;
  K.noise = (o = {}) => {
    const ctx = K.audio();
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const now = ctx.currentTime + (o.at || 0), dur = o.dur || 0.08, vol = o.vol == null ? 0.08 : o.vol;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, now);
    if (o.freq2) f.frequency.exponentialRampToValueAtTime(o.freq2, now + dur);
    f.Q.value = o.q == null ? 1 : o.q;
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f).connect(g).connect(o.out || ctx.destination);
    src.start(now, Math.random() * 0.5);
    src.stop(now + dur + 0.03);
  };
  // Per-game re-voicing of the standard cues (move, rotate, lock, drop, clear, big, buy, bad, win, tick, coin, hit).
  // K.voice[name] = [f, dur, type, vol, f2] | fn(pitch) | null (silence). The shell clears it on destroy.
  K.voice = {};
  K.sfx = (name, pitch = 1) => {
    if (K.muted) return;
    const t = name in K.voice ? K.voice[name] : TONES[name];
    if (!t) return;
    if (typeof t === 'function') { try { t(pitch); } catch (e) { /* audio unavailable */ } return; }
    const [f, dur, type, vol, f2] = t;
    K.tone({ f: f * pitch, f2: f2 && f2 * pitch, dur, type, vol });
  };

  // ---------- UI shell ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  K.esc = esc;
  K.el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  // Builds the standard game layout inside root and owns cleanup.
  //   sh.canvas, sh.boardCol, sh.side, sh.hudEl, sh.queueEl, sh.holdEl, sh.extra, sh.logEl, sh.padEl
  //   sh.hud([{label, value, tone?}])  tone: 'good' | 'bad' | 'accent'
  //   sh.setQueue(pieces, miniOpts) / sh.setHold(piece, miniOpts)
  //   sh.log(html)   sh.toast(text, tone)
  //   sh.overlay({title, body, button}) -> Promise   covers the board column
  //   sh.modal({title, body, actions:[{label, primary, disabled, onClick}]}) -> close()   onClick returning false keeps it open
  //   sh.busy()      true while an overlay or modal is up (use for keys enabled())
  //   sh.loop(fn)    sh.keys(...)  sh.stackerKeys(...)  sh.pad(map, buttons)  sh.own(cleanupFn)
  K.shell = (root, o = {}) => {
    root.innerHTML = '';
    const el = K.el('div', 'game');
    el.innerHTML = `
      <div class="game-body">
        <div class="board-col">
          <div class="board-frame"><canvas class="board"></canvas><div class="board-overlay" hidden></div></div>
          <div class="pad"></div>
        </div>
        <aside class="side">
          <div class="hud"></div>
          <div class="panel queue-panel"${o.queue === false ? ' hidden' : ''}>
            <div class="queue-cols">
              <div><h3>Next</h3><div class="queue"></div></div>
              <div class="hold-col"${o.hold === false ? ' hidden' : ''}><h3>Hold</h3><div class="hold"></div></div>
            </div>
          </div>
          <div class="extra"></div>
          <div class="panel log-panel"><h3>${esc(o.logTitle || 'Log')}</h3><ol class="log"></ol></div>
          <p class="keys-hint">${o.keysHint || '← → move · ↑ / Z rotate · ↓ soft drop · Space hard drop · C hold'}</p>
        </aside>
      </div>
      <div class="modal-layer" hidden></div>
      <div class="toast-layer"></div>`;
    root.appendChild(el);
    const $ = (s) => el.querySelector(s);
    const cleanups = [];
    let busyCount = 0;
    const sh = {
      root: el,
      canvas: $('canvas.board'),
      boardCol: $('.board-col'),
      boardFrame: $('.board-frame'),
      side: $('.side'),
      hudEl: $('.hud'),
      queueEl: $('.queue'),
      holdEl: $('.hold'),
      extra: $('.extra'),
      logEl: $('.log'),
      padEl: $('.pad'),
      own(fn) { cleanups.push(fn); return fn; },
      loop(fn) { return sh.own(K.loop(fn)); },
      keys(map, ko = {}) { return sh.own(K.keys(map, Object.assign({ enabled: () => !sh.busy() }, ko))); },
      stackerKeys(st, extra, ko = {}) { return sh.own(K.stackerKeys(st, extra, Object.assign({ enabled: () => !sh.busy() }, ko))); },
      pad(map, buttons) { return sh.own(K.pad(sh.padEl, map, buttons)); },
      busy() { return busyCount > 0; },
      hud(items) {
        sh.hudEl.innerHTML = items.map((it) =>
          `<div class="stat${it.tone ? ' ' + it.tone : ''}${it.wide ? ' wide' : ''}"><span class="stat-label">${esc(it.label)}</span><span class="stat-value">${it.html != null ? it.html : esc(it.value)}</span></div>`).join('');
      },
      setQueue(pieces, mo) {
        sh.queueEl.innerHTML = '';
        pieces.forEach((p) => sh.queueEl.appendChild(K.mini(p, 15, mo)));
      },
      setHold(p, mo) {
        sh.holdEl.innerHTML = '';
        sh.holdEl.appendChild(K.mini(p, 15, mo));
      },
      log(html) {
        const li = K.el('li', '', html);
        sh.logEl.prepend(li);
        while (sh.logEl.children.length > 7) sh.logEl.lastChild.remove();
      },
      toast(text, tone) {
        const t = K.el('div', 'toast' + (tone ? ' ' + tone : ''), esc(text));
        $('.toast-layer').appendChild(t);
        setTimeout(() => t.remove(), 1800);
      },
      overlay({ title, body = '', button = 'Start', secondary }) {
        const ov = $('.board-overlay');
        busyCount++;
        return new Promise((resolve) => {
          ov.innerHTML = `<div class="ov-card"><h3>${esc(title)}</h3><div class="ov-body">${body}</div><div class="ov-actions"><button class="btn primary" type="button" data-v="1">${esc(button)}</button>${secondary ? `<button class="btn" type="button" data-v="2">${esc(secondary)}</button>` : ''}</div></div>`;
          ov.hidden = false;
          const done = (v) => {
            ov.hidden = true;
            ov.innerHTML = '';
            busyCount--;
            window.removeEventListener('keydown', onKey, true);
            resolve(v);
          };
          ov.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(+b.dataset.v)));
          const onKey = (e) => { if (e.code === 'Enter') { e.preventDefault(); done(1); } };
          window.addEventListener('keydown', onKey, true);
          setTimeout(() => { const b = ov.querySelector('button'); b && b.focus({ preventScroll: true }); }, 30);
        });
      },
      modal({ title, body, actions = [{ label: 'Close', primary: true }], wide }) {
        const layer = $('.modal-layer');
        busyCount++;
        layer.innerHTML = '';
        const card = K.el('div', 'modal' + (wide ? ' wide' : ''));
        card.setAttribute('role', 'dialog');
        card.innerHTML = `<h3>${esc(title)}</h3>`;
        const bodyEl = K.el('div', 'modal-body');
        if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
        card.appendChild(bodyEl);
        const acts = K.el('div', 'modal-actions');
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          busyCount--;
          // An action may have opened another modal already; only clear the layer if it still shows this one.
          if (card.parentNode !== layer) return;
          layer.hidden = true;
          layer.innerHTML = '';
        };
        for (const a of actions) {
          const b = K.el('button', 'btn' + (a.primary ? ' primary' : ''), esc(a.label));
          b.type = 'button';
          if (a.disabled) b.disabled = true;
          b.addEventListener('click', () => { const r = a.onClick && a.onClick(); if (r !== false) close(); });
          acts.appendChild(b);
        }
        card.appendChild(acts);
        layer.appendChild(card);
        layer.hidden = false;
        return close;
      },
      destroy() { cleanups.splice(0).forEach((f) => { try { f(); } catch (e) { console.error(e); } }); K.voice = {}; root.innerHTML = ''; },
    };
    return sh;
  };

  // ---------- registry ----------
  // game: { id, num, title, mix, pitch, palette:[colors], art?(ctx, w, h) for the hub card, shell?, mount(sh, K) }
  K.games = [];
  K.register = (g) => { K.games.push(g); K.games.sort((a, b) => a.num - b.num); };
})();

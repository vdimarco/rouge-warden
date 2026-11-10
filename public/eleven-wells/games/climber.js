/* 09 Pip vs. the Big Mitt: a platformer inside a falling-block well, done as a Saturday-morning cartoon.
 * Pip is a small round sprout at the bottom of the well. The Big Mitt, a giant white glove that lives
 * in the strip of sky above the well, carries each brick over, holds it, and lets go. Sometimes it builds
 * Pip stairs, sometimes it fumbles, sometimes it aims. When it aims it winds up over the target column
 * (wiggle, ratchet, red stripes), it misses by a column or two now and then, and it needs a breather
 * after every throw. Locked bricks are platforms. Full rows still clear, so the floor can vanish.
 * Getting bonked, squished or bricked in costs a heart. Stand above the flag line to clear the episode.
 * Co-op: a second player takes the Mitt (J/L move, I turn, K let go) and tries to build a staircase.
 */
(function () {
  const W = window.Wells;

  const BW = 10, BH = 20;
  const PW = 0.62, PH = 0.84, EPS = 0.001;
  const GRAV = 46, JUMP_V = 14.8, RUN = 6.2, ACC = 70, AIR_ACC = 40, FRICTION = 55, MAX_FALL = 20;
  const COYOTE = 0.1, BUFFER = 0.13;
  const MAX_HEARTS = 3;
  const HEAD = 3.2; // rows of sky above the well where the Mitt lives
  const GLOVE = 1.22; // the Mitt is bigger than a cell-sized hand

  // ---------- palette ----------
  const INK = '#15121f';
  const PAL = { I: '#ff4b4b', O: '#ffd23f', T: '#9b5cff', S: '#35c95a', Z: '#ff8a1f', J: '#2f6bff', L: '#14c4b4' };
  const PIP = '#ff5fa2', PIP_SH = '#e63d86', SHOE = '#2f6bff', LEAF = '#35c95a';
  const SKY_TOP = '#45b4ff', SKY_BOT = '#c6edff', CLOUD_EDGE = '#2a8fd8';
  const CONF = ['#ff4b4b', '#ffd23f', '#2f6bff', '#35c95a', '#9b5cff', '#ff8a1f', '#ffffff'];
  const DISPLAY = '"Luckiest Guy", "Baloo 2", sans-serif';

  const MOODS = {
    aim: { label: 'Winding up at Pip', color: '#d91f36' },
    stairs: { label: 'Feeling generous', color: '#138a3e' },
    drop: { label: 'Butterfingers', color: '#b85a00' },
    coop: { label: 'Player 2 has the Mitt', color: '#2f6bff' },
  };
  const TAUNTS = {
    aim: ['Squish time!', 'Hold still...', 'Heads up, Pip!', 'Bombs away!', 'Gotcha now!', 'This one\'s yours!'],
    stairs: ['Here. A step.', 'Up you go!', 'Hmph. Fine.', 'Free brick!'],
    drop: ['Whoops!', 'La la la~', 'Wherever!', 'Eeny, meeny...'],
    hit: ['BONK! Ha!', 'Gotcha!', 'Bullseye!', 'Ding ding!'],
    miss: ['Rats!', 'Hold STILL!', 'Lucky!', 'Grr!'],
    win: ['Aw, nuts!', 'Next time...'],
  };

  const flagRows = (lvl) => Math.min(16, 7 + 2 * lvl);
  const KEYS = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], jump: ['ArrowUp', 'KeyW', 'Space'],
  };
  const P2 = { KeyJ: 'p2left', KeyL: 'p2right', KeyI: 'p2rot', KeyK: 'p2drop' };
  const ALL = new Set([...KEYS.left, ...KEYS.right, ...KEYS.jump]);

  const dprNow = () => window.devicePixelRatio || 1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ---------- art: bricks ----------
  function paintBrick(g, x, y, s, color) {
    const lw = Math.max(1.6, s * 0.085), i = lw / 2 + Math.max(0.5, s * 0.025), r = s * 0.2;
    const bx = x + i, by = y + i, bs = s - 2 * i;
    rr(g, bx, by, bs, bs, r);
    g.fillStyle = color;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = W.shade(color, -0.2);
    g.fillRect(bx, by + bs * 0.68, bs, bs);
    if (s >= 18) {
      // mortar seams so a cell reads as a brick, not a tile
      g.strokeStyle = W.shade(color, -0.3);
      g.lineWidth = Math.max(1, s * 0.05);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(bx + bs * 0.1, by + bs * 0.5); g.lineTo(bx + bs * 0.9, by + bs * 0.5);
      g.moveTo(bx + bs * 0.64, by + bs * 0.5); g.lineTo(bx + bs * 0.64, by + bs * 0.3);
      g.moveTo(bx + bs * 0.32, by + bs * 0.5); g.lineTo(bx + bs * 0.32, by + bs * 0.86);
      g.stroke();
    }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    rr(g, bx + bs * 0.13, by + bs * 0.12, bs * 0.3, bs * 0.12, bs * 0.06);
    g.fill();
    g.beginPath(); g.arc(bx + bs * 0.55, by + bs * 0.18, bs * 0.06, 0, 7); g.fill();
    rr(g, bx, by, bs, bs, r);
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.stroke();
  }
  const brickCache = new Map();
  function brickSprite(color, s) {
    const d = dprNow(), key = color + '|' + s + '|' + d;
    let c = brickCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = Math.ceil(s * d);
      const g = c.getContext('2d');
      g.scale(d, d);
      paintBrick(g, 0, 0, s, color);
      brickCache.set(key, c);
    }
    return c;
  }
  function drawBlock(ctx, b, px, py, s, x, y, o) {
    const color = (b && b.color) || '#cccccc';
    if (o && o.ghost) {
      ctx.save();
      const i = s * 0.12;
      rr(ctx, px + i, py + i, s - 2 * i, s - 2 * i, s * 0.18);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([s * 0.16, s * 0.12]);
      ctx.lineWidth = Math.max(1.5, s * 0.07);
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.drawImage(brickSprite(color, s), px, py, s, s);
  }

  // ---------- art: clouds and sky ----------
  const PUFFS = [[0.2, 0.32, 0.14], [0.4, 0.2, 0.19], [0.62, 0.24, 0.17], [0.81, 0.33, 0.12], [0.5, 0.34, 0.14], [0.3, 0.37, 0.1], [0.71, 0.37, 0.1]];
  function paintCloud(g, x, y, w, edge, lwK = 0.035) {
    const lw = Math.max(1.5, w * lwK);
    const shapes = (grow, dy, rs) => {
      g.beginPath();
      for (const [cx, cy, r] of PUFFS) { g.moveTo(x + cx * w + r * w * rs + grow, y + cy * w + dy); g.arc(x + cx * w, y + cy * w + dy, r * w * rs + grow, 0, Math.PI * 2); }
      g.fill();
      rr(g, x + 0.14 * w - grow, y + 0.3 * w + dy - grow, 0.74 * w + 2 * grow, 0.17 * w + 2 * grow, 0.08 * w + grow);
      g.fill();
    };
    g.fillStyle = edge; shapes(lw, 0, 1);
    g.fillStyle = '#d6efff'; shapes(0, 0, 1);
    g.fillStyle = '#ffffff'; shapes(0, -0.035 * w, 0.9);
  }
  const cloudCache = new Map();
  function cloudSprite(w) {
    const d = dprNow(), key = w + '|' + d;
    let c = cloudCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.ceil(w * 1.1 * d); c.height = Math.ceil(w * 0.6 * d);
      const g = c.getContext('2d');
      g.scale(d, d);
      paintCloud(g, w * 0.05, w * 0.06, w, CLOUD_EDGE);
      cloudCache.set(key, c);
    }
    return c;
  }
  let skyCache = null;
  function skySprite(Wp, Hp) {
    const d = dprNow(), key = Wp + 'x' + Hp + '@' + d;
    if (skyCache && skyCache.key === key) return skyCache.c;
    const c = document.createElement('canvas');
    c.width = Math.ceil(Wp * d); c.height = Math.ceil(Hp * d);
    const g = c.getContext('2d');
    g.scale(d, d);
    const gr = g.createLinearGradient(0, 0, 0, Hp);
    gr.addColorStop(0, SKY_TOP); gr.addColorStop(1, SKY_BOT);
    g.fillStyle = gr;
    g.fillRect(0, 0, Wp, Hp);
    // far-off flat clouds, no black ink: the black outlines belong to things you can touch
    g.globalAlpha = 0.55;
    paintCloud(g, Wp * -0.1, Hp * 0.5, Wp * 0.55, '#9fd8f8', 0.02);
    paintCloud(g, Wp * 0.55, Hp * 0.74, Wp * 0.5, '#9fd8f8', 0.02);
    paintCloud(g, Wp * 0.3, Hp * 0.28, Wp * 0.4, '#9fd8f8', 0.02);
    g.globalAlpha = 1;
    skyCache = { key, c };
    return c;
  }

  // ---------- art: Pip ----------
  // x, footY: the point between Pip's shoes. u: one cell in px. o: { face, sx, sy, expr, run, grounded, sway, look }
  function drawPip(g, x, footY, u, o) {
    const lw = Math.max(1.5, u * 0.075);
    const face = o.face || 1;
    g.save();
    g.translate(x, footY);
    g.scale(o.sx || 1, o.sy || 1);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = INK;
    g.lineWidth = lw;
    // shoes
    const sw = o.grounded ? Math.sin((o.run || 0) * 3) * u * 0.09 : 0;
    for (const [fx, d] of [[-0.16, 1], [0.16, -1]]) {
      const lift = o.grounded ? Math.max(0, sw * d) * 0.6 : u * 0.05;
      g.beginPath();
      g.ellipse(fx * u + sw * d + face * u * 0.04, -u * 0.075 - lift, u * 0.13, u * 0.075, 0, 0, 7);
      g.fillStyle = SHOE;
      g.fill();
      g.stroke();
    }
    // body
    const cy = -u * 0.47, rx = u * 0.37, ry = u * 0.37;
    g.beginPath();
    g.ellipse(0, cy, rx, ry, 0, 0, 7);
    g.fillStyle = PIP;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = PIP_SH;
    g.beginPath();
    g.ellipse(-face * u * 0.06, cy + u * 0.26, rx * 1.2, ry * 0.5, 0, 0, 7);
    g.fill();
    g.restore();
    g.beginPath();
    g.ellipse(0, cy, rx, ry, 0, 0, 7);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath(); g.ellipse(-face * u * 0.18, cy - u * 0.2, u * 0.08, u * 0.045, face * -0.6, 0, 7); g.fill();
    // sprout
    const top = cy - ry, sway = o.sway || 0;
    const tx = sway * u * 0.14 + u * 0.02, ty = top - u * 0.18;
    g.beginPath();
    g.moveTo(0, top + u * 0.02);
    g.quadraticCurveTo(sway * u * 0.08, top - u * 0.1, tx, ty);
    g.stroke();
    g.save();
    g.translate(tx, ty);
    g.rotate(-0.45 + sway * 0.5);
    g.beginPath();
    g.ellipse(u * 0.1, 0, u * 0.11, u * 0.055, 0, 0, 7);
    g.fillStyle = LEAF;
    g.fill();
    g.lineWidth = lw * 0.8;
    g.stroke();
    g.restore();
    // face
    const expr = o.expr || 'idle';
    const fx = face * u * 0.07, ey = cy - u * 0.07, my = cy + u * 0.15;
    const look = o.look || { x: face, y: 0 };
    g.lineWidth = lw;
    for (const side of [-1, 1]) {
      const ex = fx + side * u * 0.13;
      if (expr === 'happy') {
        g.beginPath(); g.arc(ex, ey + u * 0.03, u * 0.075, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      } else if (expr === 'dizzy') {
        const k = u * 0.06;
        g.beginPath(); g.moveTo(ex - k, ey - k); g.lineTo(ex + k, ey + k); g.moveTo(ex + k, ey - k); g.lineTo(ex - k, ey + k); g.stroke();
      } else if (o.blink) {
        g.beginPath(); g.moveTo(ex - u * 0.08, ey); g.lineTo(ex + u * 0.08, ey); g.stroke();
      } else {
        const big = expr === 'scared';
        g.beginPath();
        g.ellipse(ex, ey, u * (big ? 0.125 : 0.105), u * (big ? 0.17 : 0.145), 0, 0, 7);
        g.fillStyle = '#fff';
        g.fill();
        g.lineWidth = lw * 0.85;
        g.stroke();
        g.lineWidth = lw;
        g.fillStyle = INK;
        const pr = u * (big ? 0.042 : 0.062);
        g.beginPath(); g.arc(ex + look.x * u * 0.035, ey + look.y * u * 0.06, pr, 0, 7); g.fill();
        if (!big) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + look.x * u * 0.035 + pr * 0.35, ey + look.y * u * 0.06 - pr * 0.4, pr * 0.32, 0, 7); g.fill(); }
      }
    }
    // cheeks
    g.fillStyle = 'rgba(255,215,232,0.9)';
    for (const side of [-1, 1]) { g.beginPath(); g.ellipse(fx + side * u * 0.22, ey + u * 0.12, u * 0.05, u * 0.03, 0, 0, 7); g.fill(); }
    // mouth
    g.strokeStyle = INK;
    const mx = fx;
    if (expr === 'happy') {
      g.beginPath(); g.moveTo(mx - u * 0.1, my - u * 0.02); g.quadraticCurveTo(mx, my + u * 0.16, mx + u * 0.1, my - u * 0.02); g.closePath();
      g.fillStyle = '#8a1238'; g.fill(); g.stroke();
    } else if (expr === 'scared') {
      g.beginPath(); g.ellipse(mx, my + u * 0.03, u * 0.05, u * 0.07, 0, 0, 7); g.fillStyle = '#8a1238'; g.fill(); g.stroke();
      // sweat drop
      const sx = -face * u * 0.36, sy = cy - u * 0.16;
      g.beginPath(); g.moveTo(sx, sy - u * 0.1); g.quadraticCurveTo(sx + u * 0.07, sy + u * 0.02, sx, sy + u * 0.05); g.quadraticCurveTo(sx - u * 0.07, sy + u * 0.02, sx, sy - u * 0.1);
      g.fillStyle = '#9fe3ff'; g.fill(); g.lineWidth = lw * 0.7; g.stroke();
    } else if (expr === 'dizzy') {
      g.beginPath(); g.moveTo(mx - u * 0.09, my); g.quadraticCurveTo(mx - u * 0.045, my - u * 0.05, mx, my); g.quadraticCurveTo(mx + u * 0.045, my + u * 0.05, mx + u * 0.09, my); g.stroke();
    } else if (expr === 'jump' || expr === 'fall') {
      g.beginPath(); g.ellipse(mx, my, u * 0.04, u * (expr === 'fall' ? 0.06 : 0.04), 0, 0, 7); g.fillStyle = '#8a1238'; g.fill(); g.stroke();
    } else {
      g.beginPath(); g.arc(mx, my - u * 0.04, u * 0.08, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
    }
    g.restore();
  }

  // ---------- art: the Big Mitt ----------
  // cx: glove centre. tipY: where the fingertips end. o: { open 0..1, mood, look {x,y}, p2 }
  function drawGlove(g, cx, tipY, u, o) {
    const lw = Math.max(2, u * 0.09);
    const open = o.open || 0;
    g.save();
    g.translate(cx, tipY);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.lineWidth = lw;
    g.strokeStyle = INK;
    const SH = '#dfe7f5';
    // a fat sausage finger hanging from (x0, y0), rotated by ang
    const finger = (x0, y0, w, len, ang, crease) => {
      g.save();
      g.translate(x0, y0);
      g.rotate(ang);
      rr(g, -w / 2, 0, w, len, w / 2);
      g.fillStyle = '#fff';
      g.fill();
      g.save(); g.clip(); g.fillStyle = SH; g.fillRect(w * 0.18, 0, w, len); g.restore();
      rr(g, -w / 2, 0, w, len, w / 2);
      g.stroke();
      if (crease) { g.beginPath(); g.moveTo(-w * 0.22, len - w * 0.62); g.quadraticCurveTo(0, len - w * 0.48, w * 0.22, len - w * 0.62); g.lineWidth = lw * 0.65; g.stroke(); }
      g.restore();
    };
    // cuff: a flared, rolled cuff with a stripe
    const cuff = () => {
      g.beginPath();
      g.moveTo(-0.78 * u, -2.0 * u);
      g.lineTo(-0.98 * u, -2.72 * u);
      g.quadraticCurveTo(0, -2.92 * u, 0.98 * u, -2.72 * u);
      g.lineTo(0.78 * u, -2.0 * u);
      g.closePath();
    };
    cuff(); g.fillStyle = '#fff'; g.fill();
    g.save(); cuff(); g.clip();
    g.fillStyle = o.p2 ? '#2f6bff' : '#ff4b4b';
    g.fillRect(-1.2 * u, -2.5 * u, 2.4 * u, 0.24 * u);
    g.fillStyle = SH;
    g.fillRect(0.52 * u, -3 * u, 0.6 * u, 1.2 * u);
    g.restore();
    cuff(); g.stroke();
    // fingers (outer first so the middle two sit on top), then the thumb, then the back of the hand
    const fx = [-0.63, -0.21, 0.21, 0.63];
    for (const i of [0, 3, 1, 2]) {
      const outer = i === 0 || i === 3;
      const len = (outer ? 0.78 : 0.9) * u + open * 0.16 * u;
      finger(fx[i] * u, -0.98 * u, 0.5 * u, len, -open * fx[i] * 0.75, open < 0.5);
    }
    finger(-0.86 * u, -1.5 * u, 0.48 * u, 0.78 * u, 0.55 + open * 0.55, false);
    rr(g, -0.95 * u, -2.12 * u, 1.9 * u, 1.36 * u, 0.55 * u);
    g.fillStyle = '#fff';
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = SH;
    g.beginPath(); g.ellipse(0.98 * u, -1.35 * u, 0.36 * u, 0.9 * u, 0, 0, 7); g.fill();
    g.restore();
    rr(g, -0.95 * u, -2.12 * u, 1.9 * u, 1.36 * u, 0.55 * u);
    g.stroke();
    // eyes on the back of the hand
    const mood = o.mood || 'meh', look = o.look || { x: 0, y: 1 };
    const ey = -1.55 * u;
    for (const side of [-1, 1]) {
      const ex = side * 0.3 * u;
      if (mood === 'glee') {
        g.beginPath(); g.arc(ex, ey + 0.08 * u, 0.13 * u, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
        continue;
      }
      g.beginPath(); g.ellipse(ex, ey, 0.16 * u, 0.21 * u, 0, 0, 7); g.fillStyle = '#fff'; g.fill(); g.stroke();
      g.fillStyle = INK;
      g.beginPath(); g.arc(ex + look.x * 0.06 * u, ey + look.y * 0.08 * u, 0.075 * u, 0, 7); g.fill();
      if (mood === 'meh') {
        g.save(); g.beginPath(); g.ellipse(ex, ey, 0.16 * u, 0.21 * u, 0, 0, 7); g.clip();
        g.fillStyle = SH; g.fillRect(ex - 0.3 * u, ey - 0.3 * u, 0.6 * u, 0.3 * u); g.restore();
        g.beginPath(); g.moveTo(ex - 0.16 * u, ey); g.lineTo(ex + 0.16 * u, ey); g.stroke();
      }
      g.beginPath();
      if (mood === 'mean') { g.moveTo(ex + side * 0.22 * u, ey - 0.34 * u); g.lineTo(ex - side * 0.12 * u, ey - 0.18 * u); }
      else if (mood === 'grump') { g.moveTo(ex + side * 0.2 * u, ey - 0.2 * u); g.lineTo(ex - side * 0.12 * u, ey - 0.32 * u); }
      else if (mood === 'goofy') { g.arc(ex, ey - 0.2 * u, 0.13 * u, Math.PI * 1.15, Math.PI * 1.85); }
      else { g.moveTo(ex - 0.14 * u, ey - 0.31 * u); g.lineTo(ex + 0.14 * u, ey - 0.31 * u); }
      g.lineWidth = lw * 1.15;
      g.stroke();
      g.lineWidth = lw;
    }
    g.restore();
  }

  function drawBubble(g, text, cx, cy, u, tailX, tailY, maxW, pop = 1) {
    g.save();
    g.font = `400 ${Math.round(u * 0.56)}px ${DISPLAY}`;
    const tw = g.measureText(text).width;
    const pw = tw + u * 0.62, ph = u * 0.92, lw = Math.max(2, u * 0.09);
    const bx = clamp(cx - pw / 2, 3, maxW - pw - 3), by = cy - ph / 2;
    g.translate(tailX, tailY);
    g.scale(pop, pop);
    g.translate(-tailX, -tailY);
    g.lineJoin = 'round';
    g.lineWidth = lw;
    g.strokeStyle = INK;
    g.fillStyle = '#fff';
    const baseX = clamp(tailX < bx + pw / 2 ? bx + u * 0.5 : bx + pw - u * 0.5, bx + u * 0.4, bx + pw - u * 0.4);
    const tail = () => { g.beginPath(); g.moveTo(baseX - u * 0.16, by + ph * 0.6); g.lineTo(tailX, tailY); g.lineTo(baseX + u * 0.16, by + ph * 0.6); g.closePath(); };
    tail(); g.fill(); g.stroke();
    rr(g, bx, by, pw, ph, ph / 2); g.fill(); g.stroke();
    tail(); g.fill();
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, bx + pw / 2, by + ph / 2 + u * 0.04);
    g.restore();
  }

  function star(g, x, y, r, rot = 0) {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = rot + (i * Math.PI) / 5 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r;
      if (i) g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); else g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    g.closePath();
  }

  // ---------- sound ----------
  function wobble(f1, f2, dur, vol, type = 'sine', vib = 0, vibF = 6, at = 0) {
    const ctx = W.audio();
    if (!ctx) return;
    const now = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, now);
    o.frequency.exponentialRampToValueAtTime(f2, now + dur);
    let l = null;
    if (vib) {
      l = ctx.createOscillator();
      const lg = ctx.createGain();
      l.frequency.value = vibF;
      lg.gain.setValueAtTime(vib, now);
      lg.gain.exponentialRampToValueAtTime(Math.max(0.5, vib * 0.1), now + dur);
      l.connect(lg).connect(o.frequency);
      l.start(now);
      l.stop(now + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.012);
    g.gain.setValueAtTime(vol, now + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(ctx.destination);
    o.start(now);
    o.stop(now + dur + 0.05);
  }
  const SND = {
    boing() { wobble(150, 560, 0.26, 0.07, 'sine', 70, 24); },
    slideDown(long = 1) { wobble(1500, 360, 0.5 * long, 0.045, 'sine', 18, 7); },
    slideUp() { wobble(420, 1500, 0.3, 0.04, 'sine', 14, 7); },
    bonk() {
      W.tone({ f: 430, f2: 150, dur: 0.14, type: 'triangle', vol: 0.13 });
      W.tone({ f: 980, f2: 320, dur: 0.06, type: 'square', vol: 0.025 });
      W.noise({ dur: 0.05, vol: 0.09, filter: 'bandpass', freq: 1700, q: 3 });
      for (let i = 0; i < 3; i++) W.tone({ f: 1800 + i * 240, dur: 0.07, type: 'sine', vol: 0.025, at: 0.12 + i * 0.07 });
    },
    pop(v = 1, vol = 0.07) {
      W.tone({ f: 760 * v, f2: 190 * v, dur: 0.07, type: 'sine', vol });
      W.noise({ dur: 0.025, vol: vol * 0.6, filter: 'highpass', freq: 2600 });
    },
    thunk() {
      W.tone({ f: 170, f2: 70, dur: 0.1, type: 'triangle', vol: 0.12 });
      W.noise({ dur: 0.05, vol: 0.06, filter: 'lowpass', freq: 900 });
      SND.pop(0.75, 0.04);
    },
    whoosh() {
      W.noise({ dur: 0.5, vol: 0.13, filter: 'bandpass', freq: 260, freq2: 3400, q: 1.6 });
      W.noise({ dur: 0.4, at: 0.16, vol: 0.07, filter: 'bandpass', freq: 3000, freq2: 420, q: 1.2 });
      wobble(900, 220, 0.4, 0.025, 'sine', 0, 6, 0.05);
    },
    ratchet(k) {
      W.tone({ f: 420 + 820 * k, dur: 0.03, type: 'square', vol: 0.022 });
      W.noise({ dur: 0.018, vol: 0.035, filter: 'highpass', freq: 3200 });
    },
    fwoop() { wobble(260, 900, 0.12, 0.045, 'sine'); W.noise({ dur: 0.12, vol: 0.04, filter: 'bandpass', freq: 600, freq2: 2400, q: 2 }); },
    gibber(n = 4) {
      for (let i = 0; i < n; i++) {
        const f = 240 + Math.random() * 260;
        W.tone({ f, f2: f * (0.8 + Math.random() * 0.5), dur: 0.055, type: 'square', vol: 0.018, at: i * 0.075 });
      }
    },
    tada() { [523, 659, 784, 1046].forEach((f, i) => W.tone({ f, dur: i === 3 ? 0.5 : 0.16, type: 'triangle', vol: 0.08, at: i * 0.09 })); },
    chime() { [784, 988, 1318].forEach((f, i) => W.tone({ f, dur: 0.18, type: 'sine', vol: 0.06, at: i * 0.06 })); },
    wahwah() {
      [392, 370, 349].forEach((f, i) => W.tone({ f, f2: f * 0.97, dur: 0.3, type: 'sawtooth', vol: 0.035, at: i * 0.32 }));
      wobble(330, 300, 0.8, 0.04, 'sawtooth', 9, 7, 0.96);
    },
  };

  function mount(sh) {
    const rng = W.rng();
    const board = new W.Board(BW, BH);
    const view = new W.BoardView(sh.canvas, board, {
      cell: W.autoCell(BW, BH + HEAD),
      grid: false,
      background: drawSky,
      drawBlock,
      underlay: drawUnder,
      overlay: drawOver,
      clearFlash,
      drawParticle,
      textFont: DISPLAY,
      textStroke: INK,
      textWeight: 400,
    });
    const bag = W.bag(W.TYPES, rng);
    let queue = [];
    let lvl = 1, hearts = MAX_HEARTS, coop = false, runOver = false, levelDone = false, topT = 0;
    let best = 0, score = 0, levelTime = 0, nextMile = 3;
    let pl = null;
    const held = new Set();
    const touch = { left: false, right: false, jump: false };
    // phase: carry (moving into place) -> windup (aimed throws only) or hold -> fall (let go)
    const ai = { mode: 'drop', phase: 'carry', rot: 0, x: 0, t: 0, phaseT: 0, err: 0, cool: 0, coolMax: 1, aligned: 0, ticks: 0, wasUnder: false, whooshed: false, hit: false };
    const mitt = { x: BW / 2, lift: -0.8, open: 1, mood: 'meh', moodT: 0, bubble: null, cloudX: 0 };
    const comics = [];
    let slowT = 0, freezeT = 0, zoom = 1, frame = 0, clock = 0;
    let pieceSet = new Set();
    let dead = false;
    sh.own(() => { dead = true; });

    W.voice = {
      move: () => W.tone({ f: 620, f2: 520, dur: 0.03, type: 'triangle', vol: 0.04 }),
      rotate: () => wobble(900, 1350, 0.06, 0.03, 'sine'),
      lock: () => SND.thunk(),
      drop: () => SND.fwoop(),
      clear: () => { SND.slideUp(); SND.pop(1.3, 0.06); },
      big: () => SND.tada(),
      bad: () => SND.wahwah(),
      win: () => SND.tada(),
      hit: () => SND.bonk(),
      tick: () => SND.ratchet(0.5),
      coin: () => SND.chime(),
      buy: () => SND.chime(),
    };

    // ---------- the Mitt's sky (a second canvas above the well) ----------
    const mcv = W.el('canvas', 'mitt-sky');
    mcv.setAttribute('aria-hidden', 'true');
    sh.boardFrame.insertBefore(mcv, sh.boardFrame.querySelector('.board-overlay'));
    const mctx = mcv.getContext('2d');
    const msize = { cw: 0, head: 0, h: 0, u: 0, d: 0 };
    sh.root.querySelector('.queue-panel h3').textContent = 'Coming down';

    const st = new W.Stacker(board, {
      gravity: 400,
      lockDelay: 260,
      softRate: 80,
      clearDelay: 300,
      hold: false,
      next() {
        while (queue.length < 4) queue.push(newPiece());
        const p = queue.shift();
        queue.push(newPiece());
        sh.setQueue(queue.slice(0, 3), { drawBlock });
        return p;
      },
      onSpawn() {
        st.soft = false;
        ai.phase = coop ? 'hold' : 'carry';
        ai.phaseT = 0;
        ai.wasUnder = false;
        ai.whooshed = false;
        ai.hit = false;
        if (!coop) pickMode();
        paint();
      },
      onLock() { checkTrapped(); },
      onClear(rows) {
        score += 100 * rows.length;
        for (const y of rows) for (let x = 0; x < BW; x += 2) puff(x + 0.5 + Math.random(), y + 0.5, 1, 0.5);
        for (const y of rows) for (let i = 0; i < 4; i++) sparkle(Math.random() * BW, y + 0.5);
        comic(rows.length > 1 ? `KA-POW x${rows.length}` : 'KA-POW!', BW / 2, rows[0] + 0.5, '#ffd23f', '#ff4b4b', 1.0);
        view.shake(8);
        sh.log(`<b>KA-POW!</b> ${rows.length > 1 ? `${rows.length} rows popped` : 'A row popped'}. The floor drops.`);
      },
      afterClear(rows) {
        const feet = pl.y + PH;
        const below = rows.filter((r) => r >= feet - 0.1).length;
        if (below) { pl.y += below; }
        checkTrapped();
        paint();
      },
      beforeSpawn() { return !runOver && !levelDone; },
      onTopOut() { topT = 600; },
    });

    function newPiece() {
      const type = bag();
      return W.piece(type, W.SHAPES[type].cells.map(() => ({ color: PAL[type] })));
    }

    // ---------- input ----------
    const isJump = (c) => KEYS.jump.includes(c);
    const kd = (e) => {
      if (sh.busy()) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (ALL.has(e.code)) {
        e.preventDefault();
        if (isJump(e.code) && !e.repeat) pl.buffer = BUFFER;
        held.add(e.code);
      } else if (coop && P2[e.code]) {
        e.preventDefault();
        p2(P2[e.code], e.repeat);
      } else if (e.code === 'KeyO') { e.preventDefault(); if (!e.repeat) toggleCoop(); }
    };
    const ku = (e) => {
      held.delete(e.code);
      if (isJump(e.code) && !jumpHeld() && pl.vy < 0) pl.vy *= 0.45;
    };
    const blur = () => { held.clear(); touch.left = touch.right = touch.jump = false; };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    sh.own(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); });
    const has = (list) => list.some((c) => held.has(c));
    const jumpHeld = () => has(KEYS.jump) || touch.jump;

    function p2(a, repeat) {
      if (!st.active || ai.phase === 'fall') return;
      if (a === 'p2left') st.move(-1);
      else if (a === 'p2right') st.move(1);
      else if (a === 'p2rot' && !repeat) st.rotate(1);
      else if (a === 'p2drop' && !repeat) release();
    }

    function buildPad() {
      const map = {
        left() {}, right() {}, jump() { pl.buffer = BUFFER; },
        p2left: () => p2('p2left'), p2rot: () => p2('p2rot'), p2right: () => p2('p2right'), p2drop: () => p2('p2drop'),
      };
      const buttons = [['◀', 'left'], ['▶', 'right'], ['Jump', 'jump']];
      if (coop) buttons.push(['Mitt ◀', 'p2left', true], ['Turn', 'p2rot'], ['Mitt ▶', 'p2right', true], ['Let go', 'p2drop']);
      sh.pad(map, buttons);
      for (const k of ['left', 'right', 'jump']) {
        const b = sh.padEl.querySelector(`[aria-label="${k}"]`);
        if (!b) continue;
        b.addEventListener('pointerdown', () => { touch[k] = true; });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => {
          touch[k] = false;
          if (k === 'jump' && pl.vy < 0) pl.vy *= 0.45;
        }));
      }
      const first = sh.padEl.querySelector('[aria-label="p2left"]');
      if (first) {
        const br = W.el('div');
        br.style.flexBasis = '100%';
        br.style.height = '0';
        sh.padEl.insertBefore(br, first);
      }
    }

    // ---------- world ----------
    const solid = (cx, cy) => {
      if (cx < 0 || cx >= BW || cy >= BH) return true;
      if (cy < 0) return false;
      return !!board.cells[cy][cx] || pieceSet.has(cy * BW + cx);
    };
    const solidBoard = (cx, cy) => cx < 0 || cx >= BW || cy >= BH || (cy >= 0 && !!board.cells[cy][cx]);
    function collides(x, y, fn = solid) {
      const x0 = Math.floor(x), x1 = Math.floor(x + PW - EPS), y0 = Math.floor(y), y1 = Math.floor(y + PH - EPS);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (fn(cx, cy)) return true;
      return false;
    }
    const colTop = (x) => { for (let y = 0; y < BH; y++) if (board.cells[y][x]) return y; return BH; };
    const flagY = () => BH - flagRows(lvl);
    const feetRows = () => BH - (pl.y + PH);

    function newPlayer(x, y) {
      return { x, y, vx: 0, vy: 0, face: 1, grounded: false, coyote: 0, buffer: 0, invuln: 0, runT: 0, squash: 0, blink: 0, happy: 0, hurtT: 0, peakY: y, whistled: false, danger: false, sway: 0 };
    }

    function updatePlayer(dt) {
      pieceSet = new Set();
      if (st.active && pl.invuln <= 0) for (const c of W.pieceCells(st.active)) if (c.y >= 0) pieceSet.add(c.y * BW + c.x);
      const dir = (has(KEYS.right) || touch.right ? 1 : 0) - (has(KEYS.left) || touch.left ? 1 : 0);
      if (dir) {
        pl.vx += dir * (pl.grounded ? ACC : AIR_ACC) * dt;
        pl.vx = Math.max(-RUN, Math.min(RUN, pl.vx));
        pl.face = dir;
      } else {
        const f = (pl.grounded ? FRICTION : 14) * dt;
        pl.vx = Math.abs(pl.vx) <= f ? 0 : pl.vx - Math.sign(pl.vx) * f;
      }
      pl.vy = Math.min(MAX_FALL, pl.vy + GRAV * dt);
      pl.coyote = pl.grounded ? COYOTE : pl.coyote - dt;
      pl.buffer -= dt;
      if (pl.buffer > 0 && pl.coyote > 0) {
        pl.vy = -JUMP_V;
        pl.buffer = 0;
        pl.coyote = 0;
        pl.grounded = false;
        pl.squash = -0.7;
        SND.boing();
      }
      // horizontal
      let nx = pl.x + pl.vx * dt;
      if (collides(nx, pl.y)) {
        // step up small ledges when the feet are just under the top of a block
        const feet = pl.y + PH, r = Math.floor(feet);
        if (feet - r < 0.32 && !collides(nx, r - PH - EPS)) { pl.y = r - PH - EPS; }
        else {
          if (pl.vx > 0) nx = Math.floor(nx + PW) - PW - EPS;
          else if (pl.vx < 0) nx = Math.floor(nx) + 1 + EPS;
          if (collides(nx, pl.y)) nx = pl.x;
          pl.vx = 0;
        }
      }
      pl.x = nx;
      // vertical
      let ny = pl.y + pl.vy * dt;
      const was = pl.grounded, fall = pl.vy;
      pl.grounded = false;
      if (collides(pl.x, ny)) {
        if (pl.vy > 0) {
          ny = Math.floor(ny + PH) - PH - EPS;
          pl.grounded = true;
          if (!was && fall > 6) {
            pl.squash = Math.min(1, fall / 16);
            SND.pop(fall > 12 ? 0.8 : 1.1, fall > 12 ? 0.08 : 0.045);
            if (fall > 11) { puff(pl.x + PW * 0.1, ny + PH, -1); puff(pl.x + PW * 0.9, ny + PH, 1); }
          }
        } else ny = Math.floor(ny) + 1 + EPS;
        if (collides(pl.x, ny)) ny = pl.y;
        pl.vy = 0;
      }
      pl.y = ny;
      // slide whistle on a long fall
      if (pl.grounded) { pl.peakY = pl.y; pl.whistled = false; }
      else {
        pl.peakY = Math.min(pl.peakY, pl.y);
        if (!pl.whistled && pl.vy > 8 && pl.y - pl.peakY > 2.4) { pl.whistled = true; SND.slideDown(0.9); }
      }
      pl.squash += (0 - pl.squash) * Math.min(1, dt * 10);
      pl.sway += (clamp(-pl.vx / RUN, -1, 1) - pl.sway) * Math.min(1, dt * 8);
      if (pl.grounded && Math.abs(pl.vx) > 0.5) pl.runT += dt * Math.abs(pl.vx) * 2.2;
      pl.invuln = Math.max(0, pl.invuln - dt);
      pl.hurtT = Math.max(0, pl.hurtT - dt);
      pl.happy = Math.max(0, pl.happy - dt);
      pl.blink -= dt;
      if (pl.blink < -3 - Math.random() * 2) pl.blink = 0.12;
      if (pl.y > BH + 2) respawn('Fell out of the well');
      // falling brick hits
      if (st.active && pl.invuln <= 0) {
        const cells = W.pieceCells(st.active).filter((c) => c.y >= 0);
        const hit = cells.some((c) => c.x < pl.x + PW - 0.06 && c.x + 1 > pl.x + 0.06 && c.y < pl.y + PH - 0.06 && c.y + 1 > pl.y + 0.06);
        if (hit) {
          const cx = cells.reduce((a, c) => a + c.x + 0.5, 0) / cells.length;
          ai.hit = true;
          hurt('Bonked by a brick', true);
          const side = pl.x + PW / 2 < cx ? -1 : 1;
          pl.vx = side * 9;
          pl.vy = 5;
        }
      }
      // goal
      if (pl.grounded && pl.y + PH <= flagY() + 0.05) winLevel();
      if (pl.grounded) {
        const h = Math.floor(feetRows() + 0.05);
        if (h > best) { best = h; pl.happy = 0.9; }
        if (h >= nextMile && h < flagRows(lvl)) milestone(nextMile);
      }
    }

    // Is the current brick hanging over Pip with a clear path down to him?
    function overPip() {
      const p = st.active;
      if (!p) return false;
      const gy = st.ghostY();
      const x0 = Math.floor(pl.x), x1 = Math.floor(pl.x + PW - EPS);
      return W.pieceCells(p).some((c) => c.x >= x0 && c.x <= x1 && c.y < pl.y) && W.pieceCells(p, p.rot, p.x, gy).some((c) => c.x >= x0 && c.x <= x1 && c.y + 1 > pl.y);
    }

    // Near miss: a brick Pip was standing under goes past him within a hair.
    function checkNearMiss() {
      const p = st.active;
      if (!p) return;
      if (ai.phase === 'carry') return;
      if (!ai.wasUnder && overPip()) ai.wasUnder = true;
      if (ai.phase !== 'fall' || !ai.wasUnder || ai.whooshed || ai.hit || pl.invuln > 0) return;
      const x0 = pl.x, x1 = pl.x + PW, y0 = pl.y, y1 = pl.y + PH;
      const near = W.pieceCells(p).some((c) => c.y + 1 > y0 + 0.15 && c.y < y1 && ((c.x >= x1 - 0.06 && c.x - x1 < 1.5) || (c.x + 1 <= x0 + 0.06 && x0 - (c.x + 1) < 1.5)));
      if (near) whoosh();
    }

    function whoosh() {
      ai.whooshed = true;
      slowT = 520;
      score += 50;
      pl.happy = 1.3;
      SND.whoosh();
      comic('WHOOSH!', pl.x + PW / 2, pl.y - 1.5, '#ffffff', '#2f6bff', 1.5);
      view.float('+50', pl.x + PW / 2, pl.y - 0.2, '#ffd23f', 18);
      sh.log('<b>WHOOSH!</b> Pip dodged it by a hair. +50');
      if (ai.mode === 'aim' && !coop) { say(pick(TAUNTS.miss)); setMood('grump', 1.4); }
    }

    function milestone(h) {
      nextMile = h + 3;
      score += 25 * h;
      pl.happy = 1.4;
      confetti(pl.x + PW / 2, pl.y, 28, 0.9);
      comic(`${h} UP!`, pl.x + PW / 2, pl.y - 1.4, '#ffd23f', '#9b5cff', 1.1);
      SND.chime();
      sh.log(`Pip climbed <b>${h} rows</b>. +${25 * h}`);
    }

    function hurt(why, fromBrick) {
      if (runOver || levelDone) return;
      hearts--;
      pl.invuln = 1.7;
      pl.hurtT = 1.2;
      freezeT = 110;
      view.shake(14);
      for (let i = 0; i < 6; i++) sparkle(pl.x + PW / 2, pl.y + 0.2, 7);
      comic('BONK!', pl.x + PW / 2, pl.y - 1.2, '#ffd23f', '#ff4b4b', 1.25);
      W.sfx('hit');
      sh.log(`<b>BONK!</b> ${why}. -1 heart`);
      if (!coop) {
        ai.cool = Math.max(ai.cool, 2.5);
        if (fromBrick) { say(pick(TAUNTS.hit)); setMood('glee', 1.6); }
      }
      paint();
      if (hearts <= 0) loseRun(why);
    }

    function respawn(why) {
      // Already hurt and blinking: just pop Pip out, no second heart.
      if (pl.invuln > 0) sh.log(`${why}. Pip pops back up.`);
      else hurt(why);
      if (runOver) return;
      let col = Math.max(0, Math.min(BW - 1, Math.floor(pl.x + PW / 2)));
      const order = [...Array(BW).keys()].sort((a, b) => Math.abs(a - col) - Math.abs(b - col));
      col = order.find((x) => colTop(x) >= 2) ?? col;
      pl.x = col + (1 - PW) / 2;
      pl.y = colTop(col) - PH - EPS;
      pl.vx = 0;
      pl.vy = 0;
      pl.invuln = 2;
      pl.squash = -0.5;
      puff(pl.x + PW / 2, pl.y + PH * 0.6, 0, 1.2);
      puff(pl.x, pl.y + PH, -1);
      puff(pl.x + PW, pl.y + PH, 1);
      SND.pop(1.4, 0.07);
    }

    // Called after the board changes under the player.
    function checkTrapped() {
      if (runOver || levelDone || !pl) return;
      if (collides(pl.x, pl.y, solidBoard)) {
        const tries = [];
        for (let dy = 0; dy <= 2.2; dy += 0.25) for (const dx of [0, -0.5, 0.5, -1, 1]) tries.push([dx, -dy]);
        tries.push([-0.5, 0.5], [0.5, 0.5], [0, 0.5]);
        const ok = tries.find(([dx, dy]) => !collides(pl.x + dx, pl.y + dy, solidBoard));
        if (ok) { pl.x += ok[0]; pl.y += ok[1]; pl.vy = Math.min(pl.vy, 0); pl.squash = -0.5; view.float('Squeeze!', pl.x + PW / 2, pl.y - 0.3, '#ffd23f', 15); SND.pop(1.6, 0.05); return; }
        respawn('Squished flat');
        return;
      }
      if (sealed()) respawn('Bricked in');
    }

    // Flood fill through empty cells: can the player's cell reach open sky?
    function sealed() {
      const sx = Math.floor(pl.x + PW / 2), sy = Math.floor(pl.y + PH / 2);
      if (sy < 0) return false;
      const tops = [...Array(BW).keys()].map(colTop);
      const seen = new Set([sy * BW + sx]);
      const stack = [[sx, sy]];
      while (stack.length) {
        const [x, y] = stack.pop();
        if (y < tops[x]) return false;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || nx >= BW || ny < 0 || ny >= BH || board.cells[ny][nx]) continue;
          const k = ny * BW + nx;
          if (!seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
        }
      }
      return true;
    }

    // ---------- the Big Mitt (dropper AI) ----------
    const windMs = () => Math.max(520, 980 - 60 * (lvl - 1));
    const coolFor = () => Math.max(3.5, 7.5 - 0.5 * (lvl - 1));
    const stepMs = () => Math.max(55, 120 - 9 * (lvl - 1));
    function heights(b) { return [...Array(BW).keys()].map((x) => { for (let y = 0; y < BH; y++) if (b[y][x]) return BH - y; return 0; }); }
    function pickMode() {
      const canAim = ai.cool <= 0;
      const aimP = canAim ? Math.min(0.55, 0.3 + 0.05 * lvl) : 0;
      const stairP = Math.max(0.3, 0.55 - 0.04 * lvl);
      const r = rng();
      if (canAim) ai.mode = r < aimP ? 'aim' : r < aimP + stairP ? 'stairs' : 'drop';
      else ai.mode = r < stairP / (stairP + Math.max(0.15, 1 - aimP - stairP)) ? 'stairs' : 'drop';
      ai.t = -220;
      ai.aligned = 0;
      ai.ticks = 0;
      ai.err = 0;
      ai.spare = rng() < 0.85;
      if (ai.mode === 'aim') {
        // aim error: the Mitt is good, not perfect
        const e = rng(), exact = Math.min(0.55, 0.36 + 0.04 * lvl);
        const mag = e < exact ? 0 : e < exact + (1 - exact) * 0.65 ? 1 : 2;
        ai.err = mag * (rng() < 0.5 ? -1 : 1);
        setMood('mean', 99);
      } else setMood(ai.mode === 'stairs' ? 'meh' : 'goofy', 99);
      plan();
    }
    function plan() {
      const p = st.active;
      if (!p) return;
      const pc = pl.x + PW / 2, pcol = Math.floor(pc), ps = Math.round(feetRows());
      const px0 = Math.floor(pl.x) - 0, px1 = Math.floor(pl.x + PW - EPS);
      const headRow = Math.floor(pl.y + PH - EPS);
      const hs = heights(board.cells);
      const side = pcol < BW / 2 ? 1 : -1;
      let bestP = null;
      for (let rot = 0; rot < 4; rot++) for (let x = -2; x < BW; x++) {
        if (!board.fits(p, rot, x, p.y)) continue;
        let y = p.y;
        while (board.fits(p, rot, x, y + 1)) y++;
        const cells = W.pieceCells(p, rot, x, y);
        const cx = cells.reduce((a, c) => a + c.x + 0.5, 0) / cells.length;
        let s;
        if (ai.mode === 'aim') {
          s = -Math.abs(cx - (pc + ai.err)) * 2 + rng() * 0.3;
        } else if (ai.mode === 'stairs') {
          const nb = board.cells.map((r) => r.slice());
          for (const c of cells) if (c.y >= 0) nb[c.y][c.x] = true;
          const nh = heights(nb);
          const cols = [...new Set(cells.map((c) => c.x))];
          let holes = 0;
          for (const c of cells) if (c.y + 1 < BH && !nb[c.y + 1][c.x]) holes++;
          const stepFit = Math.min(...cols.map((c) => Math.abs(nh[c] - (ps + 1.6))));
          const dist = Math.min(Math.abs(cx - (pc + 2 * side)), Math.abs(cx - (pc - 2 * side)) + 1);
          const onHead = cells.some((c) => c.x >= px0 && c.x <= px1 && c.y <= headRow) ? 12 : 0;
          s = -stepFit * 2 - dist * 0.8 - holes * 1.2 - onHead + rng() * 0.4;
        } else {
          // butterfingers: random, but it mostly misses Pip on purpose (no wind-up, so no hit either)
          const onHead = cells.some((c) => c.x >= px0 && c.x <= px1 && c.y <= headRow);
          s = rng() - (onHead && ai.spare ? 2 : 0);
        }
        if (!bestP || s > bestP.s) bestP = { rot, x, s };
      }
      if (bestP) { ai.rot = bestP.rot; ai.x = bestP.x; }
    }
    // One step of carrying the brick into place.
    function aiStep() {
      const p = st.active;
      if (!p) return;
      // While carrying an aimed brick, the Mitt follows Pip (with its fixed aim error). It commits at wind-up.
      if (ai.mode === 'aim' && ++ai.ticks % 3 === 0) plan();
      const m = W.muted;
      W.muted = true;
      let acted = false;
      const dr = ((ai.rot - p.rot) % 4 + 4) % 4;
      if (dr) acted = st.rotate(dr === 3 ? -1 : 1);
      if (!acted && p.x !== ai.x) acted = st.move(p.x < ai.x ? 1 : -1);
      W.muted = m;
      if (acted) ai.aligned = 0;
      else if ((ai.aligned += 1) >= 2) settle();
    }
    function settle() {
      ai.phase = ai.mode === 'aim' ? 'windup' : 'hold';
      ai.phaseT = 0;
      if (ai.mode === 'aim') { say(pick(TAUNTS.aim)); }
      else if (rng() < 0.3) say(pick(TAUNTS[ai.mode]));
    }
    function release() {
      if (!st.active || ai.phase === 'fall') return;
      ai.phase = 'fall';
      ai.phaseT = 0;
      st.fallT = 0;
      st.soft = true;
      mitt.lift = 0.35; // the throw: snap down, then float back up
      W.sfx('drop');
      if (ai.mode === 'aim' && !coop) {
        ai.coolMax = coolFor();
        ai.cool = ai.coolMax;
        SND.slideDown(0.8);
      }
    }
    function setMood(m, secs) { mitt.mood = m; mitt.moodT = secs; }
    function say(text) {
      mitt.bubble = { text, t0: clock, life: 1500 };
      SND.gibber(2 + Math.min(4, Math.floor(text.length / 4)));
    }

    // ---------- effects ----------
    function puff(x, y, dir = 0, big = 1) {
      for (let i = 0; i < 3; i++) view.fx.push({ kind: 'puff', x: x + (Math.random() - 0.5) * 0.3, y: y - Math.random() * 0.2, vx: dir * (1.5 + Math.random() * 2) + (Math.random() - 0.5) * 1.5, vy: -1 - Math.random() * 2, life: 380 + Math.random() * 200, max: 600, size: (0.12 + Math.random() * 0.1) * big, color: '#fff' });
    }
    function sparkle(x, y, sp = 5) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.5 + Math.random());
      view.fx.push({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3, life: 500 + Math.random() * 300, max: 800, size: 0.16 + Math.random() * 0.1, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, color: '#ffd23f' });
    }
    function confetti(x, y, n, spread = 1) {
      for (let i = 0; i < n; i++) {
        view.fx.push({ kind: 'conf', x: x + (Math.random() - 0.5) * 0.6, y, vx: (Math.random() - 0.5) * 12 * spread, vy: -7 - Math.random() * 9 * spread, life: 1200 + Math.random() * 900, max: 2100, color: CONF[i % CONF.length], size: 0.3 + Math.random() * 0.18, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 16, round: Math.random() < 0.25 });
      }
    }
    function comic(text, x, y, color, burst, size = 1) {
      comics.push({ text, x, y, color, burst, size, t0: clock, life: 950, rot: (Math.random() - 0.5) * 0.3 });
      if (comics.length > 4) comics.shift();
    }

    // ---------- drawing: the well ----------
    function drawSky(ctx, Wp, Hp, s, t) {
      if (zoom > 1.001 && pl) {
        const zx = (pl.x + PW / 2) * s, zy = (pl.y + PH / 2) * s;
        ctx.translate(zx, zy); ctx.scale(zoom, zoom); ctx.translate(-zx, -zy);
      }
      ctx.fillStyle = SKY_TOP;
      ctx.fillRect(-30, -30, Wp + 60, 40);
      ctx.fillStyle = SKY_BOT;
      ctx.fillRect(-30, Hp - 10, Wp + 60, 40);
      ctx.drawImage(skySprite(Wp, Hp), 0, 0, Wp, Hp);
      // two drifting clouds
      for (const [w, y, v, o] of [[3.4, 3.2, 0.012, 0], [2.4, 9.5, -0.008, 0.55]]) {
        const cw = w * s, span = Wp + cw * 1.2;
        const x = ((((o * span + t * v) % span) + span) % span) - cw * 1.1;
        ctx.drawImage(cloudSprite(Math.round(cw)), x, y * s);
      }
    }

    let stripe = null;
    function stripePattern(ctx, s) {
      if (stripe && stripe.s === s) return stripe.p;
      const c = document.createElement('canvas'), n = Math.max(8, Math.round(s * 0.5));
      c.width = c.height = n;
      const g = c.getContext('2d');
      g.fillStyle = '#ff4b4b'; g.fillRect(0, 0, n, n);
      g.strokeStyle = '#ffffff'; g.lineWidth = n * 0.3;
      g.beginPath();
      for (let k = -1; k <= 1; k++) { g.moveTo(k * n, n); g.lineTo(k * n + n, 0); }
      g.stroke();
      stripe = { s, p: ctx.createPattern(c, 'repeat') };
      return stripe.p;
    }

    function drawUnder(ctx, s) {
      const p = st.active;
      if (!p || !pl) return;
      const gy = st.ghostY();
      const cells = W.pieceCells(p);
      const cols = {};
      for (const c of cells) cols[c.x] = Math.max(cols[c.x] ?? -99, c.y);
      const ghost = W.pieceCells(p, p.rot, p.x, gy);
      const plx0 = Math.floor(pl.x), plx1 = Math.floor(pl.x + PW - EPS);
      const aimed = ai.mode === 'aim' && !coop && (ai.phase === 'windup' || ai.phase === 'fall');
      const t = clock;
      const k = ai.phase === 'windup' ? clamp(ai.phaseT / windMs(), 0, 1) : 1;
      for (const key of Object.keys(cols)) {
        const x = +key, top = Math.max(0, cols[x] + 1);
        const bot = Math.max(...ghost.filter((c) => c.x === x).map((c) => c.y));
        if (bot < top) continue;
        const danger = x >= plx0 && x <= plx1 && pl.y + PH > top && pl.y < bot + 1;
        ctx.save();
        if (aimed) {
          ctx.globalAlpha = 0.22 + 0.3 * k * (0.5 + 0.5 * Math.sin(t / (110 - 60 * k)));
          ctx.fillStyle = stripePattern(ctx, s);
        } else {
          ctx.globalAlpha = danger ? 0.32 + 0.15 * Math.sin(t / 120) : 0.22;
          ctx.fillStyle = danger ? '#ffd23f' : '#ffffff';
        }
        ctx.fillRect(x * s + s * 0.08, top * s, s * 0.84, (bot - top + 1) * s);
        ctx.restore();
      }
      if (aimed) {
        // bullseye where the brick will land
        const gx = ghost.reduce((a, c) => a + c.x + 0.5, 0) / ghost.length * s;
        const gyy = Math.max(...ghost.map((c) => c.y + 1)) * s - s * 0.1;
        const r = s * (0.42 + 0.08 * Math.sin(t / 90));
        ctx.save();
        ctx.lineWidth = Math.max(1.5, s * 0.07);
        ctx.strokeStyle = INK;
        for (const [rad, col] of [[1, '#ff4b4b'], [0.66, '#ffffff'], [0.33, '#ff4b4b']]) {
          ctx.beginPath(); ctx.ellipse(gx, gyy, r * rad * 1.5, r * rad * 0.55, 0, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
    }

    function clearFlash(ctx, rows, k, s, Wp) {
      for (const y of rows) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, y * s, Wp, s);
        const h = s * 0.7 * k;
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(0, y * s + (s - h) / 2, Wp, h);
        ctx.strokeStyle = INK;
        ctx.lineWidth = Math.max(2, s * 0.08);
        ctx.strokeRect(1, y * s + 1, Wp - 2, s - 2);
      }
    }

    function drawParticle(ctx, f, s) {
      const x = f.x * s, y = f.y * s;
      ctx.strokeStyle = INK;
      if (f.kind === 'conf') {
        ctx.translate(x, y);
        ctx.rotate(f.rot);
        ctx.scale(Math.cos(f.rot * 1.7), 1);
        const w = f.size * s;
        ctx.fillStyle = f.color;
        ctx.lineWidth = Math.max(1.2, s * 0.05);
        if (f.round) { ctx.beginPath(); ctx.arc(0, 0, w * 0.4, 0, 7); ctx.fill(); ctx.stroke(); }
        else { ctx.fillRect(-w / 2, -w * 0.3, w, w * 0.6); ctx.strokeRect(-w / 2, -w * 0.3, w, w * 0.6); }
      } else if (f.kind === 'puff') {
        const r = f.size * s * (1.6 - f.life / f.max * 0.6);
        ctx.fillStyle = '#ffffff';
        ctx.lineWidth = Math.max(1.2, s * 0.05);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
      } else if (f.kind === 'star') {
        star(ctx, x, y, f.size * s, f.rot);
        ctx.fillStyle = f.color;
        ctx.lineWidth = Math.max(1.2, s * 0.05);
        ctx.fill(); ctx.stroke();
      } else {
        ctx.fillStyle = f.color;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, f.size / 2 + 1, 0, 7); ctx.fill(); ctx.stroke();
      }
    }

    function drawComic(ctx, c, s, now) {
      const age = now - c.t0, k = age / c.life;
      if (k >= 1) return false;
      const pop = age < 140 ? 0.4 + 0.75 * Math.sin((age / 140) * Math.PI * 0.62) / Math.sin(Math.PI * 0.62) : 1;
      const alpha = k > 0.72 ? (1 - k) / 0.28 : 1;
      const fs = Math.round(s * 0.8 * c.size);
      ctx.save();
      ctx.font = `400 ${fs}px ${DISPLAY}`;
      const tw = ctx.measureText(c.text).width;
      const rx = tw * 0.62 + s * 0.3, ry = fs * 0.95;
      const cx = clamp(c.x * s, rx + 4, BW * s - rx - 4), cy = Math.max(ry + 4, c.y * s - (1 - k) * 0 - k * s * 0.6);
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(c.rot);
      ctx.scale(pop, pop);
      ctx.beginPath();
      const n = 14;
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2, rad = i % 2 ? 0.78 : 1;
        const px = Math.cos(a) * rx * rad, py = Math.sin(a) * ry * rad;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = c.burst;
      ctx.fill();
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, s * 0.1);
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, s * 0.16);
      ctx.strokeText(c.text, 0, fs * 0.06);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, fs * 0.06);
      ctx.restore();
      return true;
    }

    function drawOver(ctx, s) {
      const t = clock;
      // finish line: a checkered strip and a waving pennant
      const fy = flagY() * s, cs = Math.max(4, s * 0.2);
      for (let i = 0; i * cs < BW * s; i++) {
        ctx.fillStyle = i % 2 ? INK : '#ffffff';
        ctx.fillRect(i * cs, fy - cs, cs, cs);
        ctx.fillStyle = i % 2 ? '#ffffff' : INK;
        ctx.fillRect(i * cs, fy, cs, cs * 0.5);
      }
      const fx = BW * s - s * 0.4, lw = Math.max(2, s * 0.08);
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw * 2.2;
      ctx.beginPath(); ctx.moveTo(fx, fy - cs); ctx.lineTo(fx, fy - s * 1.6); ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = lw * 0.9;
      ctx.beginPath(); ctx.moveTo(fx, fy - cs - lw); ctx.lineTo(fx, fy - s * 1.6 + lw); ctx.stroke();
      const wv = Math.sin(t / 180) * s * 0.1;
      ctx.beginPath();
      ctx.moveTo(fx, fy - s * 1.6);
      ctx.quadraticCurveTo(fx - s * 0.45, fy - s * 1.55 + wv, fx - s * 0.95, fy - s * 1.38 + wv);
      ctx.quadraticCurveTo(fx - s * 0.5, fy - s * 1.22 - wv, fx, fy - s * 1.08);
      ctx.closePath();
      ctx.fillStyle = '#ff4b4b';
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.arc(fx, fy - s * 1.62, lw * 1.4, 0, 7); ctx.fill();
      ctx.restore();
      if (pl) drawPlayer(ctx, s, t);
      for (let i = comics.length - 1; i >= 0; i--) if (!drawComic(ctx, comics[i], s, t)) comics.splice(i, 1);
    }

    function pipExpr() {
      if (pl.hurtT > 0) return 'dizzy';
      if (pl.danger) return 'scared';
      if (pl.happy > 0 || levelDone) return 'happy';
      if (!pl.grounded) return pl.vy < -2 ? 'jump' : pl.vy > 6 ? 'fall' : 'idle';
      return 'idle';
    }

    function drawPlayer(ctx, s, t) {
      const expr = pipExpr();
      ctx.save();
      if (pl.invuln > 0 && pl.hurtT <= 0 && Math.floor(pl.invuln * 14) % 2) ctx.globalAlpha = 0.45;
      let k = pl.squash;
      if (!pl.grounded) k += clamp(-Math.abs(pl.vy) / 45, -0.3, 0);
      const sx = 1 + k * 0.3, sy = 1 - k * 0.34;
      const cx = (pl.x + PW / 2) * s, fy = (pl.y + PH) * s;
      // speed lines while dodging
      if (slowT > 0) {
        ctx.save();
        ctx.strokeStyle = INK;
        ctx.lineCap = 'round';
        const dir = Math.sign(pl.vx) || pl.face;
        for (let i = 0; i < 4; i++) {
          const yy = fy - s * (0.15 + i * 0.2), len = s * (0.7 + (i % 2) * 0.4);
          const x0 = cx - dir * s * 0.45;
          ctx.lineWidth = Math.max(3, s * 0.14);
          ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - dir * len, yy); ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1.5, s * 0.07);
          ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - dir * len, yy); ctx.stroke();
          ctx.strokeStyle = INK;
        }
        ctx.restore();
      }
      const look = pl.danger ? { x: 0, y: -1 } : { x: pl.face, y: pl.vy > 6 ? 0.7 : 0 };
      drawPip(ctx, cx, fy, s * 1.12, { face: pl.face, sx, sy, expr, run: pl.runT, grounded: pl.grounded, sway: pl.sway, blink: pl.blink > 0, look });
      ctx.restore();
      // dizzy stars
      if (pl.hurtT > 0) {
        for (let i = 0; i < 3; i++) {
          const a = t / 160 + (i * Math.PI * 2) / 3;
          star(ctx, cx + Math.cos(a) * s * 0.42, fy - s * 1.05 + Math.sin(a) * s * 0.12, s * 0.13, a);
          ctx.fillStyle = '#ffd23f'; ctx.fill();
          ctx.lineWidth = Math.max(1.2, s * 0.05); ctx.strokeStyle = INK; ctx.stroke();
        }
      } else if (pl.danger && pl.invuln <= 0) {
        // "!" over Pip's head
        const bx = cx, by = fy - s * 1.35 - Math.abs(Math.sin(t / 90)) * s * 0.08, r = s * 0.24;
        ctx.save();
        ctx.beginPath(); ctx.arc(bx, by, r, 0, 7);
        ctx.fillStyle = '#ffd23f'; ctx.fill();
        ctx.lineWidth = Math.max(1.5, s * 0.07); ctx.strokeStyle = INK; ctx.stroke();
        W.text(ctx, '!', bx, by + s * 0.03, { size: Math.round(s * 0.42), color: INK, font: DISPLAY, weight: 400 });
        ctx.restore();
      }
    }

    // ---------- drawing: the Mitt's sky ----------
    function sizeMitt() {
      const cw = sh.canvas.clientWidth;
      if (!cw) return false;
      const u = view.cell * (cw / view.W), head = Math.round(HEAD * u), d = dprNow();
      if (cw !== msize.cw || head !== msize.head || d !== msize.d) {
        msize.cw = cw; msize.head = head; msize.u = u; msize.d = d;
        msize.h = head + Math.ceil(1.7 * u);
        mcv.style.width = cw + 'px';
        mcv.style.height = msize.h + 'px';
        mcv.width = Math.ceil(cw * d);
        mcv.height = Math.ceil(msize.h * d);
        sh.boardFrame.style.paddingTop = (head + 6) + 'px';
      }
      return true;
    }

    function updateMitt(rdt) {
      const p = st.active;
      let tx = mitt.x, lift = -0.85, open = 1, top = 0;
      if (p && ai.phase !== 'fall') {
        const cells = W.pieceCells(p);
        const xs = cells.map((c) => c.x);
        tx = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
        top = Math.max(0, Math.min(...cells.map((c) => c.y)));
        lift = top;
        open = 0;
        if (ai.phase === 'windup' && !coop) lift = top - 0.5 * Math.pow(clamp(ai.phaseT / windMs(), 0, 1), 1.6);
      }
      mitt.x += (tx - mitt.x) * Math.min(1, rdt / 55);
      mitt.lift += (lift - mitt.lift) * Math.min(1, rdt / (open ? 160 : 70));
      mitt.open += (open - mitt.open) * Math.min(1, rdt / 60);
      if (mitt.moodT < 50) { mitt.moodT -= rdt / 1000; if (mitt.moodT <= 0) { mitt.mood = coop ? 'meh' : ai.mode === 'aim' ? 'mean' : ai.mode === 'stairs' ? 'meh' : 'goofy'; mitt.moodT = 99; } }
    }

    function drawMitt(now) {
      if (!sizeMitt()) return;
      const { cw, head, u, d, h } = msize;
      const g = mctx;
      g.setTransform(d, 0, 0, d, 0, 0);
      g.clearRect(0, 0, cw, h);
      g.fillStyle = SKY_TOP;
      g.fillRect(0, 0, cw, head + 1);
      // one small cloud drifting through the Mitt's sky
      const cwid = Math.round(2.2 * u), span = cw + cwid * 1.3;
      const cx0 = ((now * 0.01) % span) - cwid * 1.15;
      g.globalAlpha = 0.9;
      g.drawImage(cloudSprite(cwid), cx0, head * 0.12);
      g.globalAlpha = 1;
      // the Mitt
      const sx = view.shakeT > 0 ? (Math.random() - 0.5) * view.shakeT * 0.4 : 0;
      let wig = 0;
      if (ai.phase === 'windup' && !coop && st.active) {
        const k = clamp(ai.phaseT / windMs(), 0, 1);
        wig = Math.sin(now / (38 - 18 * k)) * u * (0.05 + 0.1 * k);
      } else wig = Math.sin(now / 420) * u * 0.03;
      const gx = mitt.x * u + sx + wig;
      const tipY = head + (mitt.lift + 0.38) * u;
      const ey = tipY - 1.55 * GLOVE * u;
      const lx = (pl.x + PW / 2) * u - gx, ly = (head + (pl.y + 0.3) * u) - ey;
      const ln = Math.hypot(lx, ly) || 1;
      drawGlove(g, gx, tipY, u * GLOVE, { open: mitt.open, mood: mitt.mood, look: { x: lx / ln, y: ly / ln }, p2: coop });
      // speech bubble
      const b = mitt.bubble;
      if (b) {
        const age = now - b.t0;
        if (age > b.life) mitt.bubble = null;
        else {
          g.font = `400 ${Math.round(u * 0.56)}px ${DISPLAY}`;
          const pw = g.measureText(b.text).width + u * 0.62;
          const left = gx > cw / 2;
          const half = 1.15 * GLOVE * u;
          const bxC = left ? gx - half - pw / 2 : gx + half + pw / 2;
          const pop = age < 120 ? 0.6 + 0.4 * (age / 120) : 1;
          drawBubble(g, b.text, bxC, u * 0.75, u, gx + (left ? -1 : 1) * 0.95 * GLOVE * u, Math.max(u * 1.3, tipY - 1.6 * GLOVE * u), cw, pop);
        }
      }
    }

    // ---------- side panel ----------
    const mittPanel = W.el('div', 'panel mitt-panel');
    mittPanel.innerHTML = `<h3>The Big Mitt</h3>
      <div class="mitt-mood"><span class="mood-dot"></span><span class="mood-label"></span></div>
      <div class="mitt-arm"><div class="arm-row"><span>Throwing arm</span><b class="arm-state"></b></div><div class="meter"><i></i></div></div>
      <p class="mitt-note">When the Mitt wiggles over a column and it flashes <span class="hot">red</span>, it's aiming at Pip. It misses sometimes, and after every throw it needs a breather.</p>
      <button class="btn small" type="button" data-act="coop"></button>
      <p class="mitt-note small"></p>`;
    sh.extra.append(mittPanel);
    const $m = (q) => mittPanel.querySelector(q);
    const moodDot = $m('.mood-dot'), moodLabel = $m('.mood-label'), armState = $m('.arm-state'), armBar = $m('.meter i'), coopBtn = $m('[data-act="coop"]'), coopNote = $m('.mitt-note.small');
    coopBtn.addEventListener('click', () => toggleCoop());

    function toggleCoop() {
      coop = !coop;
      if (st.active && ai.phase !== 'fall') { ai.phase = coop ? 'hold' : 'carry'; ai.phaseT = 0; }
      if (!coop && st.active && ai.phase !== 'fall') pickMode();
      if (coop) { setMood('meh', 99); say('Player 2!'); }
      buildPad();
      sh.toast(coop ? 'Player 2 has the Mitt: J L move, I turn, K let go' : 'The Mitt is back on autopilot', 'good');
      paint();
    }

    const heartSvg = (on) => `<svg class="heart" viewBox="0 0 26 24" width="26" height="24" aria-hidden="true"><path d="M13 21.5C6 16 2 12 2 7.6A5.3 5.3 0 0 1 13 5.2a5.3 5.3 0 0 1 11 2.4C24 12 20 16 13 21.5Z" fill="${on ? '#ff3b5c' : '#ffffff'}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>${on ? '<ellipse cx="8" cy="8.2" rx="2.2" ry="1.4" fill="#fff" opacity=".85"/>' : ''}</svg>`;

    function paint() {
      if (!pl) return;
      const mood = MOODS[coop ? 'coop' : ai.mode];
      const fr = flagRows(lvl);
      sh.hud([
        { label: 'Episode', value: lvl },
        { label: 'Hearts', html: `<span class="hearts" role="img" aria-label="${hearts} of ${MAX_HEARTS} hearts">${[0, 1, 2].map((i) => heartSvg(i < hearts)).join('')}</span>` },
        { label: 'Climb', html: `${Math.max(0, Math.floor(feetRows() + 0.05))} <small>of ${fr} rows to the flag</small>`, tone: 'accent', wide: true },
        { label: 'Points', value: score },
        { label: 'Best climb', value: best },
      ]);
      moodDot.style.background = mood.color;
      moodLabel.textContent = mood.label;
      moodLabel.style.color = mood.color;
      const ready = ai.cool <= 0;
      armState.textContent = coop ? 'Player 2' : ready ? 'Ready' : 'Resting';
      armState.className = 'arm-state' + (ready && !coop ? ' hot' : '');
      armBar.style.width = (coop ? 100 : ready ? 100 : Math.round(100 * (1 - ai.cool / ai.coolMax))) + '%';
      armBar.classList.toggle('ready', ready && !coop);
      coopBtn.textContent = `Player 2 takes the Mitt: ${coop ? 'on' : 'off'} (O)`;
      coopBtn.classList.toggle('primary', coop);
      coopNote.textContent = coop ? 'Player 2: J / L move the Mitt, I turns the brick, K lets go. Build Pip some stairs.' : 'A friend can drive the Mitt with J L I K.';
    }

    // ---------- flow ----------
    function startLevel() {
      board.clear();
      st.reset();
      st.o.softRate = Math.max(42, 88 - 7 * lvl);
      levelDone = false;
      levelTime = 0;
      nextMile = 3;
      queue = [];
      ai.cool = 4;
      ai.coolMax = 4;
      pl = newPlayer(BW / 2 - PW / 2, BH - PH - EPS);
      pl.invuln = 1;
      paint();
      st.spawn();
    }

    function winLevel() {
      if (levelDone || runOver) return;
      levelDone = true;
      st.paused = true;
      const bonus = 500 * lvl + Math.max(0, 300 - Math.floor(levelTime));
      score += bonus;
      W.sfx('win');
      pl.happy = 3;
      confetti(pl.x + PW / 2, pl.y, 70, 1.4);
      confetti(1, flagY(), 25, 0.8);
      confetti(BW - 1, flagY(), 25, 0.8);
      comic('TA-DA!', pl.x + PW / 2, pl.y - 1.3, '#ffd23f', '#35c95a', 1.25);
      view.shake(8);
      if (!coop) { say(pick(TAUNTS.win)); setMood('grump', 99); }
      sh.log(`Episode ${lvl} cleared in ${Math.floor(levelTime)}s. <b>+${bonus}</b>`);
      const regain = hearts < MAX_HEARTS;
      if (regain) hearts++;
      paint();
      setTimeout(() => {
        if (runOver || dead) return;
        sh.overlay({
          title: 'Pip made it!',
          body: `<p>Episode ${lvl} cleared in ${Math.floor(levelTime)} seconds. +${bonus} points${regain ? ' and a heart back' : ''}.</p><p>Next week: the flag is ${flagRows(lvl + 1)} rows up, and the Mitt is grumpier and quicker.</p>`,
          button: 'Next episode',
        }).then(() => { lvl++; startLevel(); });
      }, 1100);
    }

    function loseRun(why) {
      if (runOver) return;
      runOver = true;
      st.paused = true;
      paint();
      if (!coop) { say('Night night, Pip!'); setMood('glee', 99); }
      setTimeout(() => SND.wahwah(), 250);
      setTimeout(() => {
        if (dead) return;
        sh.overlay({
          title: 'Pip is seeing stars',
          body: `<p>${W.esc(why)} in episode ${lvl}, and that was the last heart.</p><p>${score} points. Best climb: ${best} rows.</p>`,
          button: 'Tune in again',
        }).then(newRun);
      }, 700);
    }

    function newRun() {
      lvl = 1;
      hearts = MAX_HEARTS;
      score = 0;
      best = 0;
      runOver = false;
      sh.logEl.innerHTML = '';
      startLevel();
    }

    sh.debug = { board, st, view, getPlayer: () => pl, ai, mitt, whoosh: () => whoosh(), milestone: (h) => milestone(h), hearts: () => hearts, setLvl: (l) => { lvl = l; }, win: () => winLevel(), hurt: (w) => hurt(w) };
    sh.loop((rdt) => {
      clock += rdt;
      const now = clock;
      frame++;
      // time: hit-stop on a bonk, slow-mo on a near miss
      let ts = 1;
      if (freezeT > 0) { freezeT -= rdt; ts = 0; }
      else if (slowT > 0) {
        slowT -= rdt;
        ts = slowT > 160 ? 0.2 : 0.2 + 0.8 * (1 - Math.max(0, slowT) / 160);
      }
      const zt = slowT > 0 ? Math.min(1, (520 - slowT) / 70) * Math.min(1, slowT / 180) : 0;
      zoom = 1 + 0.08 * zt;
      const dt = rdt * ts;
      const live = pl && !runOver && !levelDone && !sh.busy();
      if (live) {
        levelTime += dt / 1000;
        if (ai.cool > 0) ai.cool -= dt / 1000;
        if (topT > 0) {
          topT -= dt;
          if (topT <= 0) {
            hurt('The well overflowed');
            if (!runOver) {
              board.clear();
              st.over = false;
              pl.y = BH - PH - EPS;
              pl.vy = 0;
              sh.toast('The well overflowed and emptied out!', 'bad');
              st.spawn();
            }
          }
        }
        if (st.active && !st.clearing) {
          ai.phaseT += dt;
          if (coop) {
            if (ai.phase !== 'fall' && ai.phaseT > 5000) release();
          } else if (ai.phase === 'carry') {
            ai.t += dt;
            const every = stepMs();
            while (ai.t >= every && ai.phase === 'carry') { ai.t -= every; aiStep(); }
            if (ai.phase === 'carry' && ai.phaseT > 1500) settle();
          } else if (ai.phase === 'windup') {
            const w = windMs(), k = ai.phaseT / w;
            const tickEvery = 150 - 100 * clamp(k, 0, 1);
            if (ai.phaseT - (ai.lastTick || 0) >= tickEvery) { ai.lastTick = ai.phaseT; SND.ratchet(clamp(k, 0, 1)); }
            if (ai.phaseT >= w) { ai.lastTick = 0; release(); }
          } else if (ai.phase === 'hold') {
            if (ai.phaseT >= 240) release();
          }
          // the Mitt holds the brick until it lets go
          if (ai.phase !== 'fall') st.fallT = -1e9;
        }
        st.update(dt);
        let left = Math.min(dt, 50) / 1000;
        while (left > 0 && !runOver && !levelDone) { const step = Math.min(left, 1 / 120); updatePlayer(step); left -= step; }
        if (pl && !runOver && !levelDone) {
          pl.danger = pl.invuln <= 0 && st.active && ai.phase !== 'carry' && overPip();
          checkNearMiss();
        }
        if (frame % 6 === 0) paint();
      }
      // confetti flutters down slowly
      const fdt = dt / 1000;
      for (const f of view.fx) {
        if (f.kind === 'conf') { f.vx *= Math.pow(0.12, fdt); if (f.vy > 2.6) f.vy = 2.6; f.rot += f.vr * fdt; }
        else if (f.kind === 'star') f.rot += f.vr * fdt;
        else if (f.kind === 'puff') { f.vy -= 14 * fdt; f.vx *= Math.pow(0.05, fdt); }
      }
      if (pl) updateMitt(rdt);
      view.update(dt);
      view.draw(st);
      if (pl) drawMitt(now);
    });

    buildPad();
    pl = newPlayer(BW / 2 - PW / 2, BH - PH - EPS);
    paint();
    view.draw(st);
    sh.overlay({
      title: 'Pip vs. the Big Mitt',
      body: `<p class="ov-lede">Pip is stuck at the bottom of the well. Up top, the Big Mitt keeps dropping bricks. Climb its bricks to the flag!</p>
        <ul><li><b>← →</b> or <b>A D</b> run. <b>↑ / W / Space</b> jump, and hold it to jump higher.</li>
        <li>Bricks are platforms. Stand above the checkered line to win the episode.</li>
        <li>When the Mitt wiggles and a column flashes <span class="hot">red</span>, it's aiming at you. Scram!</li>
        <li>Bonked, squished or bricked in: you lose a heart. You have ${MAX_HEARTS}.</li>
        <li>Press <b>O</b> and a friend drives the Mitt with J L I K.</li></ul>`,
      button: 'Go, Pip, go!',
    }).then(newRun);
  }

  // ---------- hub card ----------
  function art(ctx, w, h) {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, SKY_TOP); gr.addColorStop(1, SKY_BOT);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    paintCloud(ctx, -14, 8, 84, CLOUD_EDGE, 0.035);
    paintCloud(ctx, 120, 62, 70, CLOUD_EDGE, 0.035);
    // a staircase of bricks
    const u = 20;
    const cols = [[3, 'J'], [3, 'J'], [2, 'S'], [2, 'O'], [1, 'L'], [1, 'Z']];
    cols.forEach(([n, t], x) => { for (let y = 0; y < n; y++) paintBrick(ctx, 4 + x * u, h - (y + 1) * u, u, PAL[t]); });
    // Pip on top, looking up in alarm
    drawPip(ctx, 4 + 1 * u, h - 3 * u, u * 1.35, { face: 1, sx: 1, sy: 1, expr: 'scared', grounded: true, sway: 0.3, look: { x: 0.7, y: -1 } });
    // the Big Mitt, holding a T over him
    const gu = 24, gx = 228, tip = 66;
    for (const [px, py] of [[-1, 0], [0, 0], [1, 0], [0, 1]]) paintBrick(ctx, gx - u / 2 + px * u, tip - 8 + py * u, u, PAL.T);
    drawGlove(ctx, gx, tip, gu, { open: 0, mood: 'mean', look: { x: -0.9, y: 0.5 } });
    drawBubble(ctx, 'Squish time!', 140, 22, 24, gx - 26, 28, w);
  }

  W.register({
    id: 'climber',
    num: 9,
    title: 'Pip vs. the Big Mitt',
    mix: 'Platformer × falling blocks',
    pitch: 'You are Pip, stuck in the well. A giant cartoon glove drops bricks on you. Dodge them, then climb them to the flag.',
    palette: ['#ff5fa2', '#ffd23f', '#2f6bff', '#ff4b4b', '#35c95a'],
    shell: { hold: false, logTitle: 'Play-by-play', keysHint: '← → / A D run · ↑ / W / Space jump · O co-op · Player 2: J L move the Mitt, I turn, K let go' },
    art(ctx, w, h) {
      art(ctx, w, h);
      // fonts may still be loading when the hub first draws; repaint once they land
      if (document.fonts && !ctx.__pipFonts) {
        ctx.__pipFonts = true;
        document.fonts.load(`20px ${DISPLAY}`).then(() => { ctx.save(); ctx.clearRect(0, 0, w, h); art(ctx, w, h); ctx.restore(); }).catch(() => {});
      }
    },
    mount,
  });
})();

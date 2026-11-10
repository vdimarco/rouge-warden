/* 10 Lucky Pier (slot-well): a seaside boardwalk slot machine on a falling-block well.
 * Every block is a chrome reel window that spins when its piece drops in and stops on a
 * symbol from your strip. A cleared row pays out, and symbols interact with their left and
 * right neighbours (cats drink milk, bombs blow things up, bees boost flowers...).
 * Every 15 pieces the Pier Boss wants his cut, and it keeps rising. After paying, add one of
 * three symbols to your strip and optionally chuck one. Host: Big Rosie, carnival barker.
 * AUTO ("Robo-Rosie") scores every placement by the cash and symbol combos it would set up.
 */
(function () {
  const W = window.Wells;
  const INK = '#2a1230', CREAM = '#fff3dc', RED = '#d6283a', GOLD = '#ffcf3a';
  const TAU = Math.PI * 2;

  // rar: 0 never offered, 1 common, 2 uncommon, 3 rare
  const SYM = {
    blank: { name: 'Dud', color: '#cdbfa8', v: 0, rar: 0, desc: 'Pays nothing. A bomb can blow it off your strip.' },
    coin: { name: 'Coin', color: GOLD, v: 1, rar: 1, desc: 'Pays 1.' },
    cherry: { name: 'Cherry', color: '#e8253a', v: 1, rar: 1, desc: 'Pays 1, doubled next to another cherry.' },
    bell: { name: 'Bell', color: '#ffb627', v: 2, rar: 1, desc: 'Pays 2, +1 for each other bell in the row.' },
    milk: { name: 'Milk', color: '#f4f1ea', v: 1, rar: 1, desc: 'Pays 1. A cat beside it drinks it.' },
    flower: { name: 'Flower', color: '#ff7aa8', v: 1, rar: 1, desc: 'Pays 1, ×3 for each bee beside it.' },
    clover: { name: 'Clover', color: '#3cba5a', v: 1, rar: 1, desc: 'Pays 1. Its neighbours pay +1.' },
    cat: { name: 'Cat', color: '#ff9a3c', v: 1, rar: 2, desc: 'Drinks milk beside it: +9 per milk (the milk pays 0).' },
    bee: { name: 'Bee', color: GOLD, v: 1, rar: 2, desc: 'Pays 1. Flowers beside it pay ×3.' },
    bomb: { name: 'Bomb', color: '#4a4c66', v: 0, rar: 2, desc: 'Blows up both neighbours: they pay ×2, then leave your strip for good.' },
    thief: { name: 'Pickpocket', color: '#7b3fd1', v: 0, rar: 2, desc: 'Lifts coins beside it: +4 per coin (the coin pays 0).' },
    gem: { name: 'Gem', color: '#3fd0f0', v: 3, rar: 2, desc: 'Pays 3, ×2 if the row has no duds.' },
    magnet: { name: 'Magnet', color: '#e8253a', v: 0, rar: 2, desc: 'Copies the payout of its best neighbour.' },
    hourglass: { name: 'Hourglass', color: '#d9a35a', v: 1, rar: 2, desc: 'Pays 1 and holds the Pier Boss off 1 piece.' },
    seven: { name: 'Lucky 7', color: '#e8253a', v: 7, rar: 3, desc: 'Pays 7. Three 7s in one row: +77 jackpot.' },
  };
  const IDS = Object.keys(SYM);
  const RENT_EVERY = 15;
  const RENTS = [25, 45, 70, 100, 140, 190, 250, 320, 400, 500];
  const rentAt = (n) => (n < RENTS.length ? RENTS[n] : Math.round(RENTS[RENTS.length - 1] * Math.pow(1.25, n - RENTS.length + 1)));
  const MIN_POOL = 6;
  const BIG = 30;
  // Robo-Rosie's weights: stack shape (survival) against cash now and combos being built.
  const AIW = { holes: 0.6, cash: 0.12, combo: 0.25 };

  // ---------- enamel-pin symbol art (drawn in a -50..50 box) ----------
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function starPath(c, x, y, ro, ri, n) {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? ri : ro;
      c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  function paintSym(c, id) {
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const ol = (w = 6) => { c.lineWidth = w; c.strokeStyle = INK; c.stroke(); };
    const fill = (col) => { c.fillStyle = col; c.fill(); };
    const circ = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); };
    const ell = (x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };
    const shine = (x, y, rx, ry, rot = -0.6) => { ell(x, y, rx, ry, rot); fill('rgba(255,255,255,0.85)'); };
    const line = (pts, w, col) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineWidth = w; c.strokeStyle = col; c.stroke(); };
    switch (id) {
      case 'blank':
        rr(c, -24, -6, 48, 12, 6); fill('#d9ccb6');
        break;
      case 'coin':
        circ(0, 0, 40); fill(GOLD); ol();
        circ(0, 0, 29); c.lineWidth = 4; c.strokeStyle = '#c98612'; c.stroke();
        starPath(c, 0, 1, 17, 7.5, 5); fill('#fff1a8'); c.lineWidth = 3.5; c.strokeStyle = '#c98612'; c.stroke();
        shine(-19, -20, 9, 5);
        break;
      case 'cherry':
        c.beginPath(); c.moveTo(-16, 6); c.quadraticCurveTo(-12, -22, 8, -36); c.moveTo(19, 2); c.quadraticCurveTo(15, -18, 8, -36);
        c.lineWidth = 11; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#3c9a3e'; c.stroke();
        ell(24, -34, 15, 8, -0.4); fill('#5cc94e'); ol(5);
        circ(-17, 20, 18); fill('#e8253a'); ol();
        circ(19, 16, 18); fill('#e8253a'); ol();
        shine(-24, 13, 5.5, 3.5); shine(12, 9, 5.5, 3.5);
        break;
      case 'bell':
        circ(0, 35, 8); fill('#c97a12'); ol(5);
        circ(0, -36, 7); fill('#ffb627'); ol(5);
        c.beginPath(); c.moveTo(-32, 22); c.bezierCurveTo(-30, -6, -30, -32, 0, -32); c.bezierCurveTo(30, -32, 30, -6, 32, 22);
        c.lineTo(39, 29); c.lineTo(-39, 29); c.closePath(); fill('#ffb627'); ol();
        line([[-31, 13], [31, 13]], 4, '#c97a12');
        shine(-14, -14, 5, 11, 0.35);
        break;
      case 'milk':
        c.beginPath(); c.moveTo(-11, -30); c.lineTo(-11, -22); c.quadraticCurveTo(-27, -12, -27, 4); c.lineTo(-27, 36);
        c.quadraticCurveTo(-27, 42, -21, 42); c.lineTo(21, 42); c.quadraticCurveTo(27, 42, 27, 36); c.lineTo(27, 4);
        c.quadraticCurveTo(27, -12, 11, -22); c.lineTo(11, -30); c.closePath(); fill('#fdfcf7'); ol();
        c.save(); c.clip(); c.fillStyle = '#e8253a'; c.fillRect(-30, 8, 60, 18); c.restore();
        line([[-27, 8], [27, 8]], 3.5, INK); line([[-27, 26], [27, 26]], 3.5, INK);
        starPath(c, 0, 17, 6.5, 3, 5); fill(CREAM);
        rr(c, -14, -44, 28, 14, 4); fill('#1fa8b3'); ol(5);
        shine(-18, -2, 3.5, 9, 0);
        break;
      case 'flower':
        for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; ell(Math.cos(a) * 23, Math.sin(a) * 23, 16, 11, a); fill('#ff7aa8'); ol(5); }
        circ(0, 0, 14); fill('#ffd23f'); ol(5);
        shine(-4, -5, 4.5, 3);
        break;
      case 'clover':
        c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(6, 28, 20, 42);
        c.lineWidth = 11; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#2f8f46'; c.stroke();
        for (const [x, y] of [[-16, -16], [16, -16], [16, 14], [-16, 14]]) { circ(x, y - 2, 17); fill('#3cba5a'); ol(5); }
        circ(0, -2, 6); fill('#2f8f46');
        shine(-21, -23, 5, 3);
        break;
      case 'cat':
        for (const m of [-1, 1]) {
          c.beginPath(); c.moveTo(m * -33, -6); c.lineTo(m * -28, -43); c.lineTo(m * -5, -25); c.closePath(); fill('#ff9a3c'); ol(5);
          c.beginPath(); c.moveTo(m * -27, -14); c.lineTo(m * -25, -33); c.lineTo(m * -14, -24); c.closePath(); fill('#ff8fa8');
        }
        ell(0, 6, 37, 31); fill('#ff9a3c'); ol();
        line([[0, -24], [0, -14]], 4, '#c9621c'); line([[-10, -22], [-8, -13]], 4, '#c9621c'); line([[10, -22], [8, -13]], 4, '#c9621c');
        ell(-13, 2, 4.5, 7); fill(INK); ell(13, 2, 4.5, 7); fill(INK);
        circ(-11.5, -0.5, 1.6); fill('#fff'); circ(14.5, -0.5, 1.6); fill('#fff');
        c.beginPath(); c.moveTo(-5, 12); c.lineTo(5, 12); c.lineTo(0, 17); c.closePath(); fill('#ff6f91');
        c.beginPath(); c.moveTo(0, 17); c.quadraticCurveTo(-5, 25, -11, 21); c.moveTo(0, 17); c.quadraticCurveTo(5, 25, 11, 21);
        c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
        for (const m of [-1, 1]) { line([[m * 20, 15], [m * 44, 10]], 2.5, INK); line([[m * 20, 20], [m * 42, 24]], 2.5, INK); }
        break;
      case 'bee':
        ell(-6, -24, 12, 17, -0.4); fill('#d8f3ff'); ol(4);
        ell(14, -25, 12, 17, 0.4); fill('#d8f3ff'); ol(4);
        c.beginPath(); c.moveTo(28, -2); c.lineTo(44, 6); c.lineTo(28, 14); c.closePath(); fill(INK);
        ell(2, 6, 31, 23);
        c.save(); c.clip(); fill(GOLD); c.fillStyle = INK; c.fillRect(-4, -30, 10, 70); c.fillRect(15, -30, 9, 70); c.restore();
        ell(2, 6, 31, 23); ol();
        circ(-30, 3, 13); fill(INK);
        circ(-34, 0, 3.5); fill('#fff');
        line([[-34, -8], [-42, -24]], 3, INK); line([[-27, -9], [-28, -26]], 3, INK);
        shine(6, -5, 6, 3, 0);
        break;
      case 'bomb':
        circ(-4, 9, 31); fill('#3a3c55'); ol();
        c.save(); c.translate(15, -18); c.rotate(0.65); rr(c, -9, -7, 18, 13, 3); fill('#6b6e85'); ol(5); c.restore();
        c.beginPath(); c.moveTo(19, -24); c.quadraticCurveTo(26, -40, 35, -35);
        c.lineWidth = 10; c.strokeStyle = INK; c.stroke(); c.lineWidth = 5; c.strokeStyle = '#b08a5a'; c.stroke();
        starPath(c, 37, -37, 13, 5.5, 8); fill(GOLD); ol(3.5);
        circ(37, -37, 4); fill('#fff6b0');
        shine(-17, -5, 8, 5);
        break;
      case 'thief':
        c.beginPath(); c.moveTo(-32, -16); c.quadraticCurveTo(-29, -46, 0, -46); c.quadraticCurveTo(29, -46, 32, -16); c.closePath(); fill('#4a4c66'); ol();
        ell(5, -16, 41, 7.5); fill('#34364c'); ol(5);
        c.beginPath(); c.moveTo(-41, 6); c.bezierCurveTo(-39, -7, -14, -5, 0, 1); c.bezierCurveTo(14, -5, 39, -7, 41, 6);
        c.bezierCurveTo(41, 24, 16, 27, 0, 18); c.bezierCurveTo(-16, 27, -41, 24, -41, 6); c.closePath(); fill('#7b3fd1'); ol();
        ell(-17, 9, 9.5, 6.5, 0.15); fill(CREAM); ol(4);
        ell(17, 9, 9.5, 6.5, -0.15); fill(CREAM); ol(4);
        circ(-12, 10, 3.2); fill(INK); circ(22, 10, 3.2); fill(INK);
        c.beginPath(); c.moveTo(-9, 36); c.quadraticCurveTo(2, 42, 12, 33); c.lineWidth = 4.5; c.strokeStyle = INK; c.stroke();
        shine(-26, 2, 4, 2.5, -0.3);
        break;
      case 'gem':
        c.beginPath(); c.moveTo(-37, -12); c.lineTo(-21, -33); c.lineTo(21, -33); c.lineTo(37, -12); c.lineTo(0, 39); c.closePath(); fill('#3fd0f0');
        c.beginPath(); c.moveTo(-21, -33); c.lineTo(21, -33); c.lineTo(11, -12); c.lineTo(-11, -12); c.closePath(); fill('#b4f3ff');
        c.beginPath(); c.moveTo(-37, -12); c.lineTo(37, -12); c.moveTo(-21, -33); c.lineTo(-11, -12); c.lineTo(0, 39); c.moveTo(21, -33); c.lineTo(11, -12); c.lineTo(0, 39);
        c.lineWidth = 3.5; c.strokeStyle = '#178aa8'; c.stroke();
        c.beginPath(); c.moveTo(-37, -12); c.lineTo(-21, -33); c.lineTo(21, -33); c.lineTo(37, -12); c.lineTo(0, 39); c.closePath(); ol();
        shine(-22, -18, 4, 7, 0.5);
        break;
      case 'magnet':
        c.lineCap = 'butt';
        c.beginPath(); c.moveTo(-24, -40); c.lineTo(-24, 4); c.arc(0, 4, 24, Math.PI, 0, true); c.lineTo(24, -40);
        c.lineWidth = 31; c.strokeStyle = INK; c.stroke();
        c.beginPath(); c.moveTo(-24, -36); c.lineTo(-24, 4); c.arc(0, 4, 24, Math.PI, 0, true); c.lineTo(24, -36);
        c.lineWidth = 20; c.strokeStyle = '#e8253a'; c.stroke();
        c.beginPath(); c.moveTo(-24, -36); c.lineTo(-24, -20); c.moveTo(24, -36); c.lineTo(24, -20);
        c.strokeStyle = '#e4e8ee'; c.stroke();
        line([[-35, -19.5], [-13, -19.5]], 3, INK); line([[13, -19.5], [35, -19.5]], 3, INK);
        c.lineCap = 'round';
        c.beginPath(); c.arc(0, 4, 24, Math.PI * 0.62, Math.PI * 0.85); c.lineWidth = 5; c.strokeStyle = 'rgba(255,255,255,0.8)'; c.stroke();
        break;
      case 'hourglass':
        rr(c, -29, -32, 7, 64, 3); fill('#8a5428'); ol(3.5);
        rr(c, 22, -32, 7, 64, 3); fill('#8a5428'); ol(3.5);
        c.beginPath(); c.moveTo(-19, -31); c.lineTo(19, -31); c.lineTo(4, 0); c.lineTo(19, 31); c.lineTo(-19, 31); c.lineTo(-4, 0); c.closePath(); fill('#e8f8fb');
        c.beginPath(); c.moveTo(-12, -17); c.lineTo(12, -17); c.lineTo(2, -3); c.lineTo(-2, -3); c.closePath(); fill('#f0b84a');
        c.beginPath(); c.moveTo(-16, 31); c.quadraticCurveTo(0, 8, 16, 31); c.closePath(); fill('#f0b84a');
        line([[0, -3], [0, 20]], 2.5, '#f0b84a');
        c.beginPath(); c.moveTo(-19, -31); c.lineTo(19, -31); c.lineTo(4, 0); c.lineTo(19, 31); c.lineTo(-19, 31); c.lineTo(-4, 0); c.closePath(); ol(5);
        rr(c, -33, -43, 66, 12, 5); fill('#c47e3e'); ol(5);
        rr(c, -33, 31, 66, 12, 5); fill('#c47e3e'); ol(5);
        shine(-11, -24, 2.5, 5, 0.5);
        break;
      case 'seven':
        c.font = '400 96px "Shrikhand", cursive';
        c.textAlign = 'center';
        c.textBaseline = 'alphabetic';
        c.lineWidth = 12; c.strokeStyle = INK; c.strokeText('7', 3, 36);
        c.fillStyle = '#e8253a'; c.fillText('7', 3, 36);
        c.lineWidth = 2.5; c.strokeStyle = 'rgba(255,236,190,0.9)'; c.strokeText('7', 3, 36);
        shine(-14, -26, 7, 3.5, 0);
        break;
    }
  }

  // ---------- sprite cache: reel windows, icons, bulbs ----------
  const cache = new Map();
  const dprNow = () => window.devicePixelRatio || 1;
  function sprite(key, w, h, paint) {
    const d = dprNow(), k = `${key}|${w}|${h}|${d}`;
    let cv = cache.get(k);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.ceil(w * d));
      cv.height = Math.max(1, Math.ceil(h * d));
      const c = cv.getContext('2d');
      c.scale(d, d);
      paint(c, w, h);
      cache.set(k, cv);
    }
    return cv;
  }
  const iconSprite = (id, sz) => sprite('i:' + id, sz, sz, (c) => { c.translate(sz / 2, sz / 2); c.scale(sz / 100, sz / 100); paintSym(c, id); });
  const winInset = (s) => Math.max(3, Math.round(s * 0.11));
  function bezel(gold, s) {
    return sprite('z' + (gold ? 'g' : 'c'), s, s, (c) => {
      const r = Math.max(3, s * 0.2);
      rr(c, 0.5, 0.5, s - 1, s - 1, r);
      const g = c.createLinearGradient(0, 0, 0, s);
      if (gold) { g.addColorStop(0, '#fff6c8'); g.addColorStop(0.42, '#f2c14e'); g.addColorStop(0.56, '#a8741c'); g.addColorStop(1, '#ffe08a'); }
      else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.42, '#c6ccd5'); g.addColorStop(0.56, '#7a8291'); g.addColorStop(1, '#e6eaf0'); }
      c.fillStyle = g; c.fill();
      c.lineWidth = 1; c.strokeStyle = INK; c.stroke();
      const m = winInset(s);
      rr(c, m, m, s - 2 * m, s - 2 * m, r * 0.45);
      c.fillStyle = '#fff7e8'; c.fill();
      c.lineWidth = 1; c.strokeStyle = 'rgba(42,18,48,0.75)'; c.stroke();
    });
  }
  function glass(s) {
    return sprite('glass', s, s, (c) => {
      const m = winInset(s), w = s - 2 * m;
      rr(c, m, m, w, w, Math.max(3, s * 0.2) * 0.45);
      c.clip();
      const g = c.createLinearGradient(0, m, 0, m + w);
      g.addColorStop(0, 'rgba(80,30,60,0.42)'); g.addColorStop(0.26, 'rgba(80,30,60,0)');
      g.addColorStop(0.72, 'rgba(80,30,60,0)'); g.addColorStop(1, 'rgba(80,30,60,0.45)');
      c.fillStyle = g; c.fillRect(m, m, w, w);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(m, m + w * 0.06, w, Math.max(1, w * 0.07));
    });
  }
  const iconSize = (s) => Math.round(s * 0.74);
  function blockSprite(sym, gold, s) {
    return sprite('b:' + sym + (gold ? 'g' : ''), s, s, (c) => {
      c.drawImage(bezel(gold, s), 0, 0, s, s);
      const sz = iconSize(s);
      c.drawImage(iconSprite(sym, sz), (s - sz) / 2, (s - sz) / 2 + s * 0.02, sz, sz);
      c.drawImage(glass(s), 0, 0, s, s);
    });
  }
  const ghostSprite = (s) => sprite('ghost', s, s, (c) => {
    rr(c, 2, 2, s - 4, s - 4, Math.max(3, s * 0.2));
    c.setLineDash([3, 3]);
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,243,220,0.7)'; c.stroke();
    c.fillStyle = 'rgba(255,243,220,0.08)'; c.fill();
  });
  const targetSprite = (s) => sprite('target', s, s, (c) => {
    rr(c, 1.5, 1.5, s - 3, s - 3, Math.max(3, s * 0.2));
    c.lineWidth = 3; c.strokeStyle = GOLD; c.stroke();
  });
  const bulbSprite = (state) => sprite('bulb' + state, 18, 18, (c) => {
    // state: 0 off, 1 warm, 2 red, 3 white
    c.beginPath(); c.arc(9, 9, 6.5, 0, TAU); c.fillStyle = '#b9bec8'; c.fill(); c.lineWidth = 1; c.strokeStyle = INK; c.stroke();
    if (state) {
      const col = state === 2 ? '#ff4a4a' : state === 3 ? '#ffffff' : '#ffd86a';
      const halo = c.createRadialGradient(9, 9, 2, 9, 9, 9);
      halo.addColorStop(0, col); halo.addColorStop(1, 'rgba(255,220,120,0)');
      c.fillStyle = halo; c.beginPath(); c.arc(9, 9, 9, 0, TAU); c.fill();
      const g = c.createRadialGradient(8, 7.5, 0.5, 9, 9, 5);
      g.addColorStop(0, '#fffef0'); g.addColorStop(0.5, col); g.addColorStop(1, state === 2 ? '#b0141e' : '#e8962a');
      c.fillStyle = g;
    } else {
      const g = c.createRadialGradient(8, 7.5, 0.5, 9, 9, 5);
      g.addColorStop(0, '#f3e2c0'); g.addColorStop(1, '#b98d55');
      c.fillStyle = g;
    }
    c.beginPath(); c.arc(9, 9, 4.6, 0, TAU); c.fill();
  });

  // Data-URL icons for the HTML side panels and dialogs.
  const urls = {};
  function iconURL(id) {
    if (!urls[id]) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const c = cv.getContext('2d');
      c.translate(48, 48); c.scale(0.9, 0.9);
      paintSym(c, id);
      urls[id] = cv.toDataURL();
    }
    return urls[id];
  }
  const symImg = (id, cls = '') => `<img class="pier-sym${cls ? ' ' + cls : ''}" src="${iconURL(id)}" alt="${W.esc(SYM[id].name)}" title="${W.esc(SYM[id].name)}">`;

  function fontsReady(fn) {
    if (!document.fonts) return;
    Promise.all([document.fonts.load('400 40px "Shrikhand"'), document.fonts.ready]).then(() => {
      cache.clear();
      for (const k of Object.keys(urls)) delete urls[k];
      fn && fn();
    }).catch(() => {});
  }

  // ---------- Big Rosie, the barker (drawn portrait, two mouth frames) ----------
  function paintRosie(c, open) {
    const S = 160;
    c.clearRect(0, 0, S, S);
    // sunburst medallion
    c.save();
    c.beginPath(); c.arc(80, 80, 78, 0, TAU); c.clip();
    for (let i = 0; i < 16; i++) {
      c.beginPath(); c.moveTo(80, 80); c.arc(80, 80, 80, (i * TAU) / 16, ((i + 1) * TAU) / 16); c.closePath();
      c.fillStyle = i % 2 ? CREAM : RED; c.fill();
    }
    c.restore();
    c.beginPath(); c.arc(80, 80, 78, 0, TAU); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    const sky = c.createLinearGradient(0, 14, 0, 146);
    sky.addColorStop(0, '#7a2b6e'); sky.addColorStop(0.55, '#f0704a'); sky.addColorStop(1, '#ffc46a');
    c.beginPath(); c.arc(80, 80, 64, 0, TAU); c.fillStyle = sky; c.fill(); c.lineWidth = 4; c.stroke();
    c.save();
    c.beginPath(); c.arc(80, 80, 62, 0, TAU); c.clip();
    // shoulders: candy-stripe vest
    c.beginPath(); c.ellipse(80, 168, 62, 46, 0, 0, TAU);
    c.save(); c.clip();
    for (let x = 10; x < 160; x += 16) { c.fillStyle = (x / 16) % 2 < 1 ? RED : CREAM; c.fillRect(x, 110, 16, 70); }
    c.restore();
    c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.moveTo(66, 124); c.lineTo(80, 142); c.lineTo(94, 124); c.closePath(); c.fillStyle = '#f6b88e'; c.fill(); c.stroke();
    // bouffant hair
    const curls = [[50, 74, 28], [110, 74, 28], [80, 52, 34], [44, 102, 22], [116, 102, 22], [62, 46, 22], [98, 46, 22]];
    for (const [x, y, r] of curls) { c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.fillStyle = INK; c.fill(); }
    for (const [x, y, r] of curls) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = '#e2452c'; c.fill(); }
    c.beginPath(); c.arc(54, 62, 8, 3.6, 5.2); c.lineWidth = 3; c.strokeStyle = '#ff8a5a'; c.stroke();
    // face
    c.beginPath(); c.ellipse(80, 88, 29, 33, 0, 0, TAU); c.fillStyle = '#f6b88e'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    c.fillStyle = 'rgba(240,80,110,0.5)';
    c.beginPath(); c.arc(62, 99, 7, 0, TAU); c.fill(); c.beginPath(); c.arc(98, 99, 7, 0, TAU); c.fill();
    // happy closed eyes + lashes
    c.lineCap = 'round'; c.lineWidth = 4; c.strokeStyle = INK;
    for (const ex of [67, 93]) {
      c.beginPath(); c.arc(ex, 86, 7, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.beginPath(); c.moveTo(ex + (ex < 80 ? -7 : 7), 83); c.lineTo(ex + (ex < 80 ? -11 : 11), 80); c.lineWidth = 3; c.stroke(); c.lineWidth = 4;
    }
    c.beginPath(); c.arc(67, 76, 8, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
    c.beginPath(); c.arc(93, 76, 8, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
    c.beginPath(); c.arc(101, 93, 2.2, 0, TAU); c.fillStyle = INK; c.fill();
    // mouth
    if (open) {
      c.beginPath(); c.ellipse(80, 106, 12, 10, 0, 0, TAU); c.fillStyle = '#5a0f22'; c.fill();
      c.lineWidth = 4.5; c.strokeStyle = RED; c.stroke(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
      c.fillStyle = '#fff'; c.fillRect(72, 97.5, 16, 4);
    } else {
      c.beginPath(); c.moveTo(68, 103); c.quadraticCurveTo(80, 116, 92, 103); c.quadraticCurveTo(80, 108, 68, 103); c.closePath();
      c.fillStyle = RED; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    }
    // gold hoops
    c.lineWidth = 3.5; c.strokeStyle = GOLD;
    c.beginPath(); c.arc(50, 104, 6, 0, TAU); c.stroke(); c.beginPath(); c.arc(110, 104, 6, 0, TAU); c.stroke();
    // straw boater
    c.save(); c.translate(86, 40); c.rotate(-0.16);
    c.beginPath(); c.ellipse(0, 10, 46, 9, 0, 0, TAU); c.fillStyle = '#f3d27a'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.rect(-25, -16, 50, 26); c.fillStyle = '#f3d27a'; c.fill(); c.stroke();
    c.beginPath(); c.rect(-25, -1, 50, 9); c.fillStyle = RED; c.fill(); c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(-22, -10); c.lineTo(22, -10); c.lineWidth = 2; c.strokeStyle = '#c49a3a'; c.stroke();
    c.restore();
    c.restore();
  }

  // ---------- scoring ----------
  // Score one cleared row. syms = array of symbol ids, left to right.
  function evalRow(syms) {
    const n = syms.length;
    const val = syms.map((s) => SYM[s].v);
    const mult = new Array(n).fill(1);
    const why = syms.map(() => []);
    const bonus = [];
    const destroyed = [];
    const nb = (i) => [i - 1, i + 1].filter((j) => j >= 0 && j < n);
    const count = (id) => syms.filter((s) => s === id).length;
    syms.forEach((s, i) => {
      if (s !== 'thief') return;
      for (const j of nb(i)) if (syms[j] === 'coin' && val[j] > 0) { val[j] = 0; val[i] += 4; why[i].push('lifted a coin'); why[j].push('lifted'); }
    });
    syms.forEach((s, i) => {
      if (s !== 'cat') return;
      for (const j of nb(i)) if (syms[j] === 'milk' && val[j] > 0) { val[j] = 0; val[i] += 9; why[i].push('drank the milk'); why[j].push('drunk'); }
    });
    syms.forEach((s, i) => {
      if (s === 'cherry' && nb(i).some((j) => syms[j] === 'cherry')) { mult[i] *= 2; why[i].push('pair ×2'); }
      if (s === 'bell') { const k = count('bell') - 1; if (k) { val[i] += k; why[i].push(`+${k} bell${k > 1 ? 's' : ''}`); } }
      if (s === 'gem' && !syms.includes('blank')) { mult[i] *= 2; why[i].push('no duds ×2'); }
      if (s === 'flower') for (const j of nb(i)) if (syms[j] === 'bee') { mult[i] *= 3; why[i].push('bee ×3'); }
      if (s === 'clover') for (const j of nb(i)) if (val[j] > 0) { val[j] += 1; why[j].push('clover +1'); }
    });
    const pay = val.map((v, i) => v * mult[i]);
    syms.forEach((s, i) => {
      if (s !== 'magnet') return;
      const best = Math.max(0, ...nb(i).filter((j) => syms[j] !== 'magnet').map((j) => pay[j]));
      if (best) { pay[i] = best; why[i].push(`copied ${best}`); }
    });
    const gone = new Array(n).fill(false);
    syms.forEach((s, i) => {
      if (s !== 'bomb') return;
      for (const j of nb(i)) if (syms[j] !== 'bomb' && !gone[j]) { gone[j] = true; pay[j] *= 2; why[j].push('bombed ×2'); destroyed.push(syms[j]); }
    });
    for (let i = 0; i < n;) {
      let j = i;
      while (j + 1 < n && syms[j + 1] === syms[i]) j++;
      const k = j - i + 1;
      if (k >= 3 && syms[i] !== 'blank') bonus.push({ text: `${k}× ${SYM[syms[i]].name} run`, amount: k * k, x: (i + j + 1) / 2 });
      i = j + 1;
    }
    if (count('seven') >= 3) bonus.push({ text: 'Jackpot 777', amount: 77, x: n / 2, jackpot: true });
    const total = pay.reduce((a, b) => a + b, 0) + bonus.reduce((a, b) => a + b.amount, 0);
    return { syms, pay, why, bonus, total, destroyed, hourglass: count('hourglass') };
  }
  const LINE_MULT = [1, 1, 1.25, 1.5, 2];

  // Interaction value already sitting in a partly built row: each run of touching blocks is
  // scored like a cleared row, minus what its symbols would pay on their own.
  function rowCombos(row, mine) {
    let gain = 0, seg = [];
    const notes = [];
    const flush = () => {
      if (seg.length >= 2) {
        const syms = seg.map((b) => b.sym);
        const r = evalRow(syms);
        gain += r.total - syms.reduce((a, s) => a + SYM[s].v, 0);
        if (mine) r.why.forEach((w, i) => {
          const touches = mine.has(seg[i]) || (seg[i - 1] && mine.has(seg[i - 1])) || (seg[i + 1] && mine.has(seg[i + 1]));
          if (w.length && touches && !/^(drunk|lifted|clover)/.test(w[0])) notes.push({ id: syms[i], w: w[0], v: r.pay[i] });
        });
        r.bonus.forEach((b) => notes.push({ id: null, w: b.text, v: b.amount }));
      }
      seg = [];
    };
    for (const b of row) { if (b) seg.push(b); else flush(); }
    flush();
    return { gain, notes };
  }

  // ---------- sound: bells, coin blips, calliope, siren, foghorn ----------
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function bell(f = 1318, vol = 0.045, at = 0) {
    [[1, 1, 0.9], [2.01, 0.45, 0.55], [2.76, 0.3, 0.4], [5.4, 0.12, 0.18]].forEach(([m, v, d]) =>
      W.tone({ f: f * m, dur: d, type: 'sine', vol: vol * v, at, attack: 0.002 }));
  }
  function coinBlips(n = 4, at = 0, pitch = 1) {
    for (let i = 0; i < n; i++) {
      const t = at + i * 0.055, p = pitch * (1 + (i % 4) * 0.06);
      W.tone({ f: 988 * p, dur: 0.035, type: 'square', vol: 0.018, at: t });
      W.tone({ f: 1319 * p, dur: 0.06, type: 'square', vol: 0.016, at: t + 0.03 });
    }
  }
  function calliope(notes, step = 0.1, vol = 0.03) {
    const ac = W.audio();
    if (!ac) return;
    const t0 = ac.currentTime + 0.02;
    const out = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2800;
    out.connect(lp).connect(ac.destination);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 6.5;
    let t = t0;
    for (const nt of notes) {
      const [n, len] = Array.isArray(nt) ? nt : [nt, 1];
      const d = step * len;
      if (n != null) {
        const f = midi(n);
        for (const [type, mul, v] of [['square', 1, vol], ['triangle', 2, vol * 0.5]]) {
          const o = ac.createOscillator(), g = ac.createGain(), dep = ac.createGain();
          o.type = type; o.frequency.value = f * mul;
          dep.gain.value = f * mul * 0.012;
          lfo.connect(dep).connect(o.frequency);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(v, t + 0.015);
          g.gain.setValueAtTime(v, t + d * 0.72);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.97);
          o.connect(g).connect(out);
          o.start(t); o.stop(t + d + 0.05);
        }
      }
      t += d;
    }
    lfo.start(t0); lfo.stop(t + 0.1);
  }
  function siren(dur = 1.5, vol = 0.028) {
    const ac = W.audio();
    if (!ac) return;
    const t0 = ac.currentTime + 0.01;
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.05);
    g.gain.setValueAtTime(vol, t0 + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lp.connect(g).connect(ac.destination);
    for (const [type, det] of [['sawtooth', 0], ['square', 7]]) {
      const o = ac.createOscillator();
      o.type = type; o.detune.value = det;
      o.frequency.setValueAtTime(640, t0);
      for (let t = 0, up = true; t < dur; t += 0.3, up = !up) o.frequency.linearRampToValueAtTime(up ? 1050 : 640, t0 + t + 0.3);
      o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    }
  }
  function foghorn() {
    const ac = W.audio();
    if (!ac) return;
    const t0 = ac.currentTime + 0.01, dur = 1.5;
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(260, t0); lp.frequency.linearRampToValueAtTime(420, t0 + 0.4); lp.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.22);
    g.gain.setValueAtTime(0.11, t0 + dur - 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    lp.connect(g).connect(ac.destination);
    for (const f of [65.4, 98, 131]) {
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.03, t0);
      o.frequency.linearRampToValueAtTime(f, t0 + 0.25);
      o.frequency.setValueAtTime(f, t0 + dur - 0.4);
      o.frequency.linearRampToValueAtTime(f * 0.94, t0 + dur);
      o.connect(lp); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    W.noise({ dur: 0.5, vol: 0.03, filter: 'bandpass', freq: 220, q: 2 });
  }
  function sadHorn() {
    [[311, 294, 0], [294, 277, 0.26], [277, 262, 0.52], [262, 220, 0.78]].forEach(([f, f2, at], i) =>
      W.tone({ f, f2, dur: i === 3 ? 0.7 : 0.24, type: 'sawtooth', vol: 0.03, at, attack: 0.03 }));
  }

  // ---------- the game ----------
  function mount(sh) {
    const rng = W.rng();
    const board = new W.Board(10, 20);
    const now = () => performance.now();
    let run = null, queue = [], last = null, runOver = false, jamT = 0;
    let auto = false, fast = false, aiPlan = null, aiT = 0, naiveAI = false;
    let hitStop = 0, hotT = 0, jackT = 0, bossT = 0, bossCut = 0, dispCoins = 0, purseEl = null;
    const timers = [];
    const later = (fn, ms) => { const id = setTimeout(fn, ms); timers.push(id); return id; };
    sh.own(() => timers.forEach(clearTimeout));

    W.voice = {
      move: () => W.noise({ dur: 0.018, vol: 0.025, filter: 'highpass', freq: 3800 }),
      rotate: [740, 0.04, 'square', 0.016, 990],
      lock: () => { W.tone({ f: 190, f2: 95, dur: 0.08, type: 'triangle', vol: 0.07 }); W.noise({ dur: 0.05, vol: 0.04, filter: 'lowpass', freq: 500 }); },
      drop: () => { W.tone({ f: 150, f2: 60, dur: 0.12, type: 'triangle', vol: 0.09 }); W.noise({ dur: 0.08, vol: 0.06, filter: 'lowpass', freq: 700 }); },
      clear: () => bell(1318, 0.045),
      big: () => { bell(1318, 0.045); bell(1760, 0.04, 0.09); },
      buy: () => { bell(1568, 0.04); coinBlips(3, 0.08); },
      bad: () => sadHorn(),
      win: () => calliope([72, 76, 79, [84, 3]], 0.1),
      tick: () => { W.noise({ dur: 0.016, vol: 0.028, filter: 'bandpass', freq: 2600, q: 3 }); W.tone({ f: 1250, dur: 0.02, type: 'square', vol: 0.007 }); },
      coin: (p) => coinBlips(1, 0, p),
      hit: null,
    };

    // --- reels on the board ---
    const reelSym = (seed) => {
      const list = run ? poolList() : ['coin'];
      return list[Math.abs(seed) % list.length];
    };
    const rolling = (b) => b.spin || (b.rollUntil && b.rollUntil > now());
    function drawSpin(ctx, b, px, py, s, x, y, gold) {
      ctx.drawImage(bezel(gold, s), px, py, s, s);
      const m = winInset(s), sz = iconSize(s), t = now();
      ctx.save();
      ctx.beginPath(); ctx.rect(px + m, py + m, s - 2 * m, s - 2 * m); ctx.clip();
      const speed = b.spin ? 0.006 : 0.02;
      const f = t * speed + x * 0.37 + y * 0.71;
      const k = Math.floor(f), ph = f - k;
      for (let i = 0; i < 2; i++) {
        const img = iconSprite(reelSym((k + i) * 7 + x * 13 + y * 5), sz);
        const oy = py + (s - sz) / 2 + (ph - i) * s;
        ctx.globalAlpha = 0.5; ctx.drawImage(img, px + (s - sz) / 2, oy - s * 0.12, sz, sz);
        ctx.globalAlpha = 1; ctx.drawImage(img, px + (s - sz) / 2, oy, sz, sz);
      }
      ctx.fillStyle = 'rgba(255,247,232,0.3)';
      ctx.fillRect(px + m, py + m, s - 2 * m, s - 2 * m);
      ctx.restore();
      ctx.drawImage(glass(s), px, py, s, s);
    }
    function drawBlock(ctx, b, px, py, s, x, y, o) {
      if (o && o.ghost) { ctx.drawImage(ghostSprite(s), px, py, s, s); return; }
      const gold = !!(st.active && st.active.blocks.indexOf(b) >= 0);
      if (rolling(b)) drawSpin(ctx, b, px, py, s, x, y, gold);
      else ctx.drawImage(blockSprite(b.sym, gold, s), px, py, s, s);
    }

    // --- the well: reel-strip columns in deep night-sea teal ---
    function wellSprite(Wd, Hd, s) {
      return sprite('well', Wd, Hd, (c) => {
        for (let x = 0; x < board.w; x++) { c.fillStyle = x % 2 ? '#0c3b45' : '#0e4550'; c.fillRect(x * s, 0, s, Hd); }
        c.fillStyle = 'rgba(4,22,28,0.7)';
        for (let x = 1; x < board.w; x++) c.fillRect(x * s - 1, 0, 2, Hd);
        const g = c.createLinearGradient(0, 0, 0, Hd);
        g.addColorStop(0, 'rgba(5,16,30,0.55)'); g.addColorStop(0.18, 'rgba(5,16,30,0)');
        g.addColorStop(0.82, 'rgba(5,16,30,0)'); g.addColorStop(1, 'rgba(5,16,30,0.55)');
        c.fillStyle = g; c.fillRect(0, 0, Wd, Hd);
        const v = c.createLinearGradient(0, 0, Wd, 0);
        v.addColorStop(0, 'rgba(255,255,255,0)'); v.addColorStop(0.18, 'rgba(255,255,255,0.05)'); v.addColorStop(0.3, 'rgba(255,255,255,0)');
        c.fillStyle = v; c.fillRect(0, 0, Wd, Hd);
        c.fillStyle = 'rgba(255,210,140,0.05)';
        for (let y = 0; y < board.h; y++) c.fillRect(0, y * s + s - 1, Wd, 1);
      });
    }
    function background(ctx, Wd, Hd, s) {
      ctx.fillStyle = '#082a33';
      ctx.fillRect(-20, -20, Wd + 40, Hd + 40);
      ctx.drawImage(wellSprite(Wd, Hd, s), 0, 0, Wd, Hd);
    }
    function clearFlash(ctx, rows, k, s, Wd) {
      const sh2 = (1 - k) * s * 2;
      for (const y of rows) {
        ctx.save();
        ctx.beginPath(); ctx.rect(0, y * s, Wd, s); ctx.clip();
        ctx.fillStyle = `rgba(255,214,90,${0.35 + 0.4 * Math.abs(Math.sin(k * Math.PI * 3))})`;
        ctx.fillRect(0, y * s, Wd, s);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        for (let x = -s * 2; x < Wd + s; x += s * 0.9) {
          ctx.beginPath(); ctx.moveTo(x + sh2, y * s); ctx.lineTo(x + sh2 + s * 0.45, y * s); ctx.lineTo(x + sh2 - s * 0.05, y * s + s); ctx.lineTo(x + sh2 - s * 0.5, y * s + s); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }
    }
    function drawParticle(ctx, f, s) {
      const x = f.x * s, y = f.y * s;
      if (f.color === GOLD) {
        const spin = Math.abs(Math.cos(f.life * 0.014 + f.size));
        const r = f.size * 0.95 + 1;
        ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.8, r * spin), r, 0, 0, TAU);
        ctx.fillStyle = spin > 0.5 ? GOLD : '#d99a1e'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = '#7a4a0a'; ctx.stroke();
        return;
      }
      ctx.translate(x, y); ctx.rotate(f.life * 0.012 + f.size);
      ctx.fillStyle = f.color;
      ctx.fillRect(-f.size * 0.6, -f.size * 0.3, f.size * 1.2, f.size * 0.6);
    }
    function overlay(ctx, s) {
      const Wd = board.w * s, Hd = board.h * s, t = now();
      // AUTO's chosen landing spot and what it expects to earn there
      if (auto && aiPlan && aiPlan.cells && st.active) {
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(t * 0.012);
        for (const c of aiPlan.cells) if (c.y >= 0) ctx.drawImage(targetSprite(s), c.x * s, c.y * s, s, s);
        ctx.globalAlpha = 1;
        if (aiPlan.cash > 0) {
          const top = Math.min(...aiPlan.cells.map((c) => c.y)), cx = aiPlan.cells.reduce((a, c) => a + c.x, 0) / aiPlan.cells.length;
          W.text(ctx, `+$${aiPlan.cash}`, (cx + 0.5) * s, Math.max(0.5, top - 0.45) * s, { size: Math.round(s * 0.55), color: GOLD, stroke: INK, strokeWidth: 4, font: '"Shrikhand", cursive', weight: 400 });
        }
      }
      // the Pier Boss strolls up: lights dim, the cut is named
      if (bossT > 0) {
        const k = Math.min(1, (1300 - bossT) / 250, bossT / 200);
        ctx.fillStyle = `rgba(20,6,30,${0.55 * k})`;
        ctx.fillRect(0, 0, Wd, Hd);
        ctx.globalAlpha = k;
        const mid = Hd * 0.42;
        W.text(ctx, 'THE PIER BOSS', Wd / 2, mid, { size: Math.round(s * 1.05), color: CREAM, stroke: INK, strokeWidth: 6, font: '"Shrikhand", cursive', weight: 400 });
        W.text(ctx, `wants his cut: $${bossCut}`, Wd / 2, mid + s * 1.3, { size: Math.round(s * 0.75), color: GOLD, stroke: INK, strokeWidth: 5, font: '"Shrikhand", cursive', weight: 400 });
        ctx.globalAlpha = 1;
      }
      // jackpot: siren beams sweep the well
      if (jackT > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const a = t * 0.007, fade = Math.min(1, jackT / 400);
        for (const [off, col] of [[0, `rgba(255,50,60,${0.26 * fade})`], [Math.PI, `rgba(255,200,80,${0.2 * fade})`]]) {
          ctx.beginPath(); ctx.moveTo(Wd / 2, -s); ctx.arc(Wd / 2, -s, Hd * 1.5, a + off - 0.22, a + off + 0.22); ctx.closePath();
          ctx.fillStyle = col; ctx.fill();
        }
        ctx.restore();
      }
    }
    const view = new W.BoardView(sh.canvas, board, {
      drawBlock, background, grid: false, clearFlash, drawParticle, overlay,
      textFont: '"Shrikhand", cursive', textStroke: INK, textWeight: 400,
    });

    // --- marquee bulbs chasing round the candy-stripe frame ---
    const bulbCv = W.el('canvas', 'pier-bulbs');
    sh.boardFrame.prepend(bulbCv);
    const bctx = bulbCv.getContext('2d');
    let bulbs = [], fw = 0, fh = 0, bulbKey = '';
    function layoutBulbs() {
      const w = sh.boardFrame.clientWidth, h = sh.boardFrame.clientHeight, d = dprNow();
      if (w === fw && h === fh) return;
      fw = w; fh = h;
      bulbCv.width = Math.round(w * d); bulbCv.height = Math.round(h * d);
      bulbCv.style.width = w + 'px'; bulbCv.style.height = h + 'px';
      bctx.setTransform(d, 0, 0, d, 0, 0);
      const ins = (parseFloat(getComputedStyle(sh.boardFrame).paddingLeft) || 18) / 2, pw = w - ins * 2, ph = h - ins * 2;
      const nx = Math.max(2, Math.round(pw / 21)), ny = Math.max(2, Math.round(ph / 21));
      bulbs = [];
      for (let i = 0; i < nx; i++) bulbs.push([ins + (pw * i) / nx, ins]);
      for (let i = 0; i < ny; i++) bulbs.push([ins + pw, ins + (ph * i) / ny]);
      for (let i = 0; i < nx; i++) bulbs.push([ins + pw - (pw * i) / nx, ins + ph]);
      for (let i = 0; i < ny; i++) bulbs.push([ins, ins + ph - (ph * i) / ny]);
      bulbKey = '';
    }
    function drawBulbs(t) {
      layoutBulbs();
      const warn = run && run.untilRent <= 3 && !runOver;
      let mode, step;
      if (jackT > 0) { mode = 'j'; step = Math.floor(t / 85); }
      else if (hotT > 0) { mode = 'h'; step = Math.floor(t / 32); }
      else { mode = warn ? 'w' : 'i'; step = Math.floor(t / (warn ? 90 : 150)); }
      const key = mode + step;
      if (key === bulbKey) return;
      bulbKey = key;
      bctx.clearRect(0, 0, fw, fh);
      bulbs.forEach(([x, y], i) => {
        let st8;
        if (mode === 'j') st8 = (i + step) % 2 ? (i % 4 < 2 ? 2 : 3) : 0;
        else if (mode === 'h') st8 = (((i - step) % 4) + 4) % 4 < 2 ? 1 : 0;
        else if (mode === 'w') st8 = (((i + step) % 3) + 3) % 3 === 0 ? 2 : 0;
        else st8 = (((i - step) % 3) + 3) % 3 === 0 ? 0 : 1;
        bctx.drawImage(bulbSprite(st8), x - 9, y - 9, 18, 18);
      });
    }

    // --- Big Rosie at the mic ---
    const narrow = window.matchMedia('(max-width: 760px)').matches;
    const rosie = W.el('div', 'rosie', `<canvas class="rosie-face" width="160" height="160" aria-hidden="true"></canvas><div class="rosie-talk"><span class="rosie-name">Big Rosie</span><p class="rosie-line" aria-live="polite"></p></div>`);
    if (narrow) sh.boardCol.prepend(rosie); else sh.side.prepend(rosie);
    const faceCv = rosie.querySelector('canvas'), faceCtx = faceCv.getContext('2d');
    const lineEl = rosie.querySelector('.rosie-line');
    const faces = [0, 1].map((o) => { const c = document.createElement('canvas'); c.width = c.height = 160; paintRosie(c.getContext('2d'), !!o); return c; });
    let talkUntil = 0, faceShown = -1, sayAt = 0;
    function say(text, force) {
      const t = now();
      if (!force && t - sayAt < 2200) return;
      sayAt = t;
      lineEl.textContent = text;
      rosie.classList.remove('pop'); void rosie.offsetWidth; rosie.classList.add('pop');
      talkUntil = t + Math.min(1800, 300 + text.length * 32);
    }
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const LINES = {
      small: ['A little jingle!', 'Coins in the tin, sugar!', 'Keep ’em rollin’, keep ’em strollin’!', 'Ding ding, that’s the thing!', 'Every row’s a payday!'],
      mid: ['Now THAT’S a pull!', 'Hear that bell? Business is swell!', 'The boardwalk loves a winner!', 'Hot reels, hot meals!'],
      big: ['Ring the bell and ring it well!', 'Stop the pier, we got a WINNER!', 'Somebody fetch a bucket for the coins!', 'Lights up, cash up!'],
      jackpot: ['Triple sevens! Sound the siren!', 'JACKPOT on the boardwalk!'],
      cat: 'Kitty found the cream!', bomb: 'Kaboom on the boardwalk!', bee: 'Buzz buzz, big bucks!', thief: 'Watch your pockets, folks!', magnet: 'That magnet’s got sticky fingers!',
      warn: ['Psst. The Pier Boss is strollin’ this way…', 'Three more pieces, then he wants his cut.', 'I smell cigar smoke. Boss is coming.'],
      paid: ['The Boss got his cut. Now pick your luck!', 'Paid in full! Let’s spend the change on luck.'],
      jam: 'Stuck reels? Nothing a good kick can’t fix!',
      autoOn: 'Robo-Rosie’s on the lever! Watch her read the reels.', autoOff: 'Your hands, your luck, sugar.',
      idle: ['Step up, stack up, cash up!', 'Cats love milk and bees love flowers. Seat ’em side by side!', 'Three in a row pays a run bonus!', 'Seven, seven, seven is boardwalk heaven!'],
    };

    // --- gold coins tumbling down the side column ---
    const spillCv = W.el('canvas', 'pier-spill');
    sh.side.appendChild(spillCv);
    const spx = spillCv.getContext('2d');
    let coins = [], sw = 0, shh = 0, spillLive = false;
    function spill(n) {
      const w = sh.side.clientWidth, h = sh.side.clientHeight, d = dprNow();
      if (w !== sw || h !== shh) {
        sw = w; shh = h;
        spillCv.width = Math.round(w * d); spillCv.height = Math.round(h * d);
        spillCv.style.width = w + 'px'; spillCv.style.height = h + 'px';
        spx.setTransform(d, 0, 0, d, 0, 0);
      }
      for (let i = 0; i < n; i++) coins.push({ x: Math.random() * w, y: -12 - Math.random() * 30, vx: (Math.random() - 0.5) * 70, vy: Math.random() * 60, r: 6 + Math.random() * 5, ph: Math.random() * 6, delay: Math.random() * 900, bounced: false, floor: h * (0.3 + Math.random() * 0.45) });
      spillLive = true;
    }
    function updateSpill(dt) {
      if (!spillLive) return;
      spx.clearRect(0, 0, sw, shh);
      const k = dt / 1000;
      for (const c of coins) {
        if (c.delay > 0) { c.delay -= dt; continue; }
        c.vy += 1100 * k; c.x += c.vx * k; c.y += c.vy * k; c.ph += 11 * k;
        if (!c.bounced && c.y > c.floor) { c.bounced = true; c.vy *= -0.35; c.vx *= 1.6; }
        const sp = Math.abs(Math.cos(c.ph));
        spx.beginPath(); spx.ellipse(c.x, c.y, Math.max(1, c.r * sp), c.r, 0, 0, TAU);
        spx.fillStyle = sp > 0.45 ? GOLD : '#d99a1e'; spx.fill();
        spx.lineWidth = 1.5; spx.strokeStyle = '#6a3c08'; spx.stroke();
        if (sp > 0.6) { spx.beginPath(); spx.ellipse(c.x - c.r * 0.3 * sp, c.y - c.r * 0.35, c.r * 0.25 * sp, c.r * 0.18, 0, 0, TAU); spx.fillStyle = '#fff6c0'; spx.fill(); }
      }
      coins = coins.filter((c) => c.y < shh + 20);
      if (!coins.length) { spillLive = false; spx.clearRect(0, 0, sw, shh); }
    }

    // --- pool ---
    function poolList() {
      const out = [];
      for (const id of IDS) for (let i = 0; i < (run.pool[id] || 0); i++) out.push(id);
      return out;
    }
    const poolSize = () => IDS.reduce((a, id) => a + (run.pool[id] || 0), 0);
    const rollSym = () => rng.pick(poolList());
    const spinPiece = (type) => W.piece(type, W.SHAPES[type].cells.map(() => ({ color: '#999', spin: true })));
    const bag = W.bag(W.TYPES, rng);

    const st = new W.Stacker(board, {
      gravity: 700,
      hold: false,
      next() {
        while (queue.length < 4) queue.push(bag());
        const type = queue.shift();
        queue.push(bag());
        const t = now(), base = fast && auto ? 200 : 380, gap = fast && auto ? 50 : 110;
        return W.piece(type, W.SHAPES[type].cells.map((_, i) => {
          const sym = rollSym();
          return { color: SYM[sym].color, sym, rollUntil: t + base + i * gap, stopped: false };
        }));
      },
      onSpawn() { aiPlan = null; aiT = 0; },
      onLock() {
        run.untilRent--;
        if (run.untilRent === 3) { say(pick(LINES.warn), true); bell(660, 0.03); bell(660, 0.03, 0.35); }
      },
      onClear(rows, rowBlocks) { payRows(rows, rowBlocks); },
      afterClear() { paint(); },
      beforeSpawn() {
        paint();
        if (run.untilRent <= 0) { dueRent(); return false; }
        return !runOver;
      },
      onTopOut() { jamT = 700; },
    });
    sh.stackerKeys(st, {}, { downStart: () => (st.soft = true), downEnd: () => (st.soft = false) });
    sh.keys({ auto: () => toggleAuto() }, { extra: { KeyT: 'auto' } });
    sh.pad({ left: () => st.move(-1), right: () => st.move(1), down: () => st.softDrop(), rotCW: () => st.rotate(1), rotCCW: () => st.rotate(-1), drop: () => st.hardDrop(), auto: () => toggleAuto() },
      [['◀', 'left', true], ['⟲', 'rotCCW'], ['⟳', 'rotCW'], ['▶', 'right', true], ['▼', 'down', true], ['⤓', 'drop'], ['Auto', 'auto']]);

    const autoPanel = W.el('div', 'panel pier-lever');
    const lastPanel = W.el('div', 'panel pier-last');
    const poolPanel = W.el('div', 'panel pier-pool');
    sh.extra.append(autoPanel, lastPanel, poolPanel);
    autoPanel.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'auto') toggleAuto();
      if (a.dataset.act === 'fast') { fast = !fast; paint(); }
    });

    function toggleAuto() {
      auto = !auto;
      aiPlan = null;
      sh.toast(auto ? 'AUTO-PULL on: Robo-Rosie works the lever' : 'AUTO-PULL off: the lever is yours', auto ? 'good' : '');
      say(auto ? LINES.autoOn : LINES.autoOff, true);
      paint();
    }

    // ---------- Robo-Rosie: placement AI that reads the symbols ----------
    function shape(b) {
      let agg = 0, holes = 0, bump = 0, prev = -1, maxH = 0;
      for (let x = 0; x < b.w; x++) {
        let h = 0, roof = false;
        for (let y = 0; y < b.h; y++) {
          if (b.cells[y][x]) { if (!roof) { h = b.h - y; roof = true; } } else if (roof) holes++;
        }
        agg += h; maxH = Math.max(maxH, h);
        if (prev >= 0) bump += Math.abs(h - prev);
        prev = h;
      }
      return { agg, holes, bump, maxH };
    }
    function plan(p) {
      const mine = new Set(p.blocks);
      const stackH = shape(board).maxH;
      // the taller the stack, the less she gambles on combos
      const greed = naiveAI ? 0 : Math.max(0.15, Math.min(1, (15 - stackH) / 8));
      let best = null;
      for (let rot = 0; rot < 4; rot++) for (let x = -3; x < board.w + 1; x++) {
        if (!board.fits(p, rot, x, p.y)) continue;
        let y = p.y;
        while (board.fits(p, rot, x, y + 1)) y++;
        const cells = W.pieceCells(p, rot, x, y);
        if (cells.some((c) => c.y < 0)) continue;
        const sim = new W.Board(board.w, board.h);
        sim.cells = board.cells.map((r) => r.slice());
        for (const c of cells) sim.cells[c.y][c.x] = c.block;
        const full = sim.fullRows();
        let cash = 0, combo = 0;
        const notes = [];
        for (const ry of full) {
          const r = evalRow(sim.cells[ry].map((b) => b.sym));
          cash += r.total;
          r.why.forEach((w, i) => { if (w.length && !/^(drunk|lifted|clover)/.test(w[0])) notes.push({ id: r.syms[i], w: w[0], v: r.pay[i] }); });
          r.bonus.forEach((b) => notes.push({ id: null, w: b.text, v: b.amount }));
        }
        cash = Math.round(cash * LINE_MULT[Math.min(4, full.length)]);
        for (const ry of new Set(cells.map((c) => c.y))) {
          if (full.includes(ry)) continue;
          const after = rowCombos(sim.cells[ry], mine);
          combo += after.gain - rowCombos(board.cells[ry]).gain;
          notes.push(...after.notes);
        }
        if (full.length) sim.removeRows(full);
        const e = shape(sim);
        const score = 0.76 * full.length - 0.51 * e.agg - AIW.holes * e.holes - 0.18 * e.bump + greed * (AIW.cash * cash + AIW.combo * combo);
        if (!best || score > best.score) best = { rot, x, score, cash, combo, notes, cells: cells.map((c) => ({ x: c.x, y: c.y })) };
      }
      return best;
    }
    function roboThought(pl) {
      if (!pl) return 'Watching the reels…';
      const top = pl.notes.slice().sort((a, b) => b.v - a.v)[0];
      const what = top ? `${top.id ? symImg(top.id, 'sm') + ' ' + W.esc(SYM[top.id].name) + ' ' : ''}${W.esc(top.w)}` : '';
      if (pl.cash > 0) return `Cashing a row for <b>$${pl.cash}</b>${what ? ' · ' + what : ''}`;
      if (pl.combo > 0 && what) return `Lining up ${what} <b>(+${pl.combo})</b>`;
      return 'Keeping the stack tidy';
    }
    let thoughtEl = null;
    function aiStep() {
      const p = st.active;
      if (!p || !aiPlan) return;
      const m = W.muted;
      W.muted = true;
      let acted = true;
      const dr = ((aiPlan.rot - p.rot) % 4 + 4) % 4;
      if (dr) acted = st.rotate(dr === 3 ? -1 : 1);
      else if (p.x < aiPlan.x) acted = st.move(1);
      else if (p.x > aiPlan.x) acted = st.move(-1);
      else acted = false;
      W.muted = m;
      if (!acted) st.hardDrop();
      else if (!fast) W.sfx('move');
    }

    // ---------- payouts ----------
    function payRows(rows, rowBlocks) {
      const lineMult = LINE_MULT[Math.min(4, rows.length)];
      let sum = 0, jackpot = false;
      const results = [];
      const hits = new Set();
      rows.forEach((y, k) => {
        const r = evalRow(rowBlocks[k].map((b) => b.sym));
        results.push(r);
        r.pay.forEach((v, x) => { if (v) view.float('+' + v, x + 0.5, y + 0.5, v >= 5 ? '#7ff0d0' : GOLD, v >= 5 ? 19 : 14); });
        r.bonus.forEach((b, i) => { view.float(`${b.text} +${b.amount}`, Math.min(6.5, Math.max(3.5, b.x)), y - 0.7 - i * 0.9, '#ffe08a', 16); if (b.jackpot) jackpot = true; });
        r.why.forEach((w, i) => { if (w.length) hits.add(r.syms[i]); });
        sum += r.total;
        for (const id of r.destroyed) {
          if ((run.pool[id] || 0) > 0 && poolSize() > MIN_POOL) { run.pool[id]--; run.destroyed[id] = (run.destroyed[id] || 0) + 1; }
        }
        if (r.hourglass) { run.untilRent += r.hourglass; view.float(`Boss delayed +${r.hourglass}`, 5, y + 1.6, '#7ff0d0', 14); }
        if (r.destroyed.length) { view.shake(8); W.noise({ dur: 0.35, vol: 0.08, filter: 'lowpass', freq: 900, freq2: 120 }); }
      });
      const total = Math.round(sum * lineMult);
      run.coins += total;
      run.earned += total;
      last = { results, lineMult, total };
      view.rowBurst(rows, (b) => (b ? SYM[b.sym].color : '#fff'));
      const cy = rows[0] - 1.4;
      // tiers: ding, sting, or the full jackpot show
      if (jackpot || total >= BIG) {
        hitStop = 420; jackT = 1900; hotT = 3200;
        view.shake(14);
        const top = Math.max(3, Math.min(8, cy - 5));
        view.float(jackpot ? 'JACKPOT!' : 'BIG WIN!', 5, top, '#ffe08a', 40);
        view.float(`$${total}`, 5, top + 1.7, GOLD, 34);
        for (let i = 0; i < 3; i++) view.burst(2 + i * 3, rows[0] + 0.5, GOLD, 14, 9);
        siren(1.6);
        calliope([67, 72, 76, 79, 76, 79, [84, 4]], 0.09, 0.028);
        coinBlips(Math.min(18, 6 + Math.floor(total / 6)), 0.25);
        spill(Math.min(90, 30 + total));
        say(pick(jackpot ? LINES.jackpot : LINES.big), true);
      } else if (total >= 10) {
        hotT = 1500;
        view.float(`$${total}`, 5, cy, GOLD, 28);
        view.burst(5, rows[0] + 0.5, GOLD, 12, 7);
        calliope([72, 76, 79, [84, 2]], 0.08, 0.024);
        coinBlips(Math.min(8, Math.ceil(total / 4)), 0.1);
        spill(Math.min(28, total));
        const special = ['cat', 'bomb', 'bee', 'thief'].find((id) => hits.has(id));
        say(special ? LINES[special] : pick(LINES.mid), true);
      } else {
        hotT = Math.max(hotT, 600);
        view.float(`$${total}`, 5, cy, GOLD, 22);
        if (total > 0) { view.burst(5, rows[0] + 0.5, GOLD, 5, 5); coinBlips(Math.min(4, Math.max(1, Math.ceil(total / 3))), 0.06); }
        const special = ['cat', 'bomb', 'bee', 'thief', 'magnet'].find((id) => hits.has(id));
        say(special ? LINES[special] : pick(LINES.small));
      }
      const best = results.flatMap((r) => r.why.map((w, i) => (w.length && !/^(drunk|lifted)/.test(w[0]) ? `${symImg(r.syms[i], 'sm')} ${W.esc(w.join(', '))}` : null))).filter(Boolean).slice(0, 3);
      sh.log(`<b>+$${total}</b>${rows.length > 1 ? ` · ${rows.length} rows ×${lineMult}` : ''}${best.length ? ' · ' + best.join(' · ') : ''}`);
      paint();
    }

    // ---------- the Pier Boss wants his cut ----------
    function dueRent() {
      const rent = rentAt(run.rentsPaid);
      st.paused = true;
      foghorn();
      bossT = 1300; bossCut = rent;
      say('Hear that horn? The Pier Boss wants his cut!', true);
      sh.root.classList.add('boss-here');
      later(() => {
        sh.root.classList.remove('boss-here');
        if (run.coins < rent) { loseRun(rent); return; }
        run.coins -= rent;
        run.rentsPaid++;
        run.untilRent = RENT_EVERY;
        st.o.gravity = Math.max(250, 700 - run.rentsPaid * 45);
        W.sfx('buy');
        sh.log(`The Pier Boss took <b>$${rent}</b>`);
        say(pick(LINES.paid), true);
        paint();
        openPick(rent);
      }, 1100);
    }

    function offers() {
      const w = (d) => (d.rar === 1 ? 6 : d.rar === 2 ? 3 + run.rentsPaid * 0.4 : d.rar === 3 ? 0.5 + run.rentsPaid * 0.3 : 0);
      const pool = IDS.filter((id) => SYM[id].rar > 0);
      const out = [];
      while (out.length < 3) {
        const tot = pool.reduce((a, id) => a + (out.includes(id) ? 0 : w(SYM[id])), 0);
        let r = rng() * tot;
        for (const id of pool) {
          if (out.includes(id)) continue;
          r -= w(SYM[id]);
          if (r <= 0) { out.push(id); break; }
        }
      }
      return out;
    }
    // Robo-Rosie's shopping: favour symbols with partners already on the strip.
    const PARTNER = { cat: 'milk', milk: 'cat', bee: 'flower', flower: 'bee', thief: 'coin', cherry: 'cherry', bell: 'bell' };
    function roboPick(offer) {
      const val = (id) => SYM[id].v + SYM[id].rar * 1.5 + (PARTNER[id] && run.pool[PARTNER[id]] ? 4 : 0) + (id === 'bomb' && run.pool.blank ? 3 : 0);
      return offer.slice().sort((a, b) => val(b) - val(a))[0];
    }

    function openPick(rent) {
      const offer = offers();
      let add = null, remove = null, countdown = auto ? 4 : 0, closeModal = null, tick = null;
      st.paused = true;
      const body = W.el('div', 'modal-body pier-pick');
      const render = () => {
        body.innerHTML = `<p class="pick-ticket">The Boss pocketed <b>$${rent}</b>. Next visit he wants <b>$${rentAt(run.rentsPaid)}</b> in ${RENT_EVERY} pieces. Your purse: <b>$${run.coins}</b>.</p>`;
        const h1 = W.el('h4', '', 'Add one to your reel strip');
        const g1 = W.el('div', 'tiles');
        offer.forEach((id) => {
          const d = SYM[id];
          const t = W.el('button', 'tile' + (add === id ? ' on' : ''), `${symImg(id, 'big')}<span class="t-name">${W.esc(d.name)}${d.rar === 3 ? ' <span class="chip accent">rare!</span>' : ''}</span><span class="t-desc">${W.esc(d.desc)}</span><span class="t-cost">on your strip: ${run.pool[id] || 0}</span>`);
          t.type = 'button';
          t.addEventListener('click', () => { countdown = 0; add = add === id ? null : id; render(); });
          g1.appendChild(t);
        });
        const h2 = W.el('h4', '', 'Chuck one off the strip (optional)');
        const g2 = W.el('div', 'chips');
        for (const id of IDS) {
          if (!run.pool[id]) continue;
          const b = W.el('button', 'chip' + (remove === id ? ' bad' : ''), `${symImg(id, 'sm')} ${W.esc(SYM[id].name)} ×${run.pool[id]}`);
          b.type = 'button';
          b.disabled = poolSize() <= MIN_POOL;
          b.addEventListener('click', () => { countdown = 0; remove = remove === id ? null : id; render(); });
          g2.appendChild(b);
        }
        body.append(h1, g1, h2, g2);
        if (countdown > 0) body.append(W.el('p', 'robo-note', `Robo-Rosie picks in ${countdown}… (tap anything to pick yourself)`));
      };
      const finish = () => {
        if (tick) { clearInterval(tick); tick = null; }
        if (add) { run.pool[add] = (run.pool[add] || 0) + 1; sh.log(`${symImg(add, 'sm')} ${W.esc(SYM[add].name)} joins the strip`); }
        if (remove && run.pool[remove] > 0 && poolSize() > MIN_POOL) { run.pool[remove]--; sh.log(`Chucked a ${W.esc(SYM[remove].name)}`); }
        st.paused = false;
        paint();
        st.spawn();
      };
      render();
      closeModal = sh.modal({
        title: 'The Pier Boss took his cut',
        body,
        wide: true,
        actions: [{ label: 'Back to the reels!', primary: true, onClick: finish }],
      });
      if (countdown > 0) {
        tick = setInterval(() => {
          if (!countdown) { clearInterval(tick); tick = null; return; }
          countdown--;
          if (countdown === 2) { add = roboPick(offer); if (run.pool.blank && poolSize() > MIN_POOL) remove = 'blank'; }
          render();
          if (countdown === 0) { closeModal(); finish(); }
        }, 800);
        sh.own(() => tick && clearInterval(tick));
      }
    }

    function loseRun(rent) {
      if (runOver) return;
      runOver = true;
      st.paused = true;
      sadHorn();
      say('Off the pier you go, sugar. Come back when the tide turns!', true);
      paint();
      sh.overlay({
        title: 'Run off the pier!',
        body: `<p>The Pier Boss wanted <b>$${rent}</b>. Your purse held <b>$${run.coins}</b>.</p><p>You paid his cut ${run.rentsPaid} time${run.rentsPaid === 1 ? '' : 's'} and took $${run.earned} all told.</p>`,
        button: 'Another go!',
      }).then(newRun);
    }

    // ---------- side panels ----------
    function paint() {
      if (!run) return;
      const rent = rentAt(run.rentsPaid);
      const left = Math.max(0, run.untilRent);
      const dots = Array.from({ length: RENT_EVERY }, (_, i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('');
      sh.hud([
        { label: 'Purse', html: `<span class="purse">$${Math.round(dispCoins)}</span>`, tone: run.coins >= rent ? 'good' : 'accent' },
        { label: 'Boss’s cut', value: '$' + rent, tone: 'accent' },
        { label: 'Pieces till the Pier Boss', html: `<span class="rent-bulbs">${dots}</span><span class="rent-n">${left}</span>`, tone: left <= 3 ? 'bad' : '', wide: true },
        { label: 'Cuts paid', value: run.rentsPaid },
        { label: 'Lifetime take', value: '$' + run.earned },
      ]);
      purseEl = sh.hudEl.querySelector('.purse');
      const pct = Math.min(100, (run.coins / rent) * 100);
      autoPanel.innerHTML = `<h3>The Lever</h3>
        <div class="meter${pct >= 100 ? ' full' : ''}" title="Purse against the Boss's cut"><div style="width:${pct}%"></div><span>${pct >= 100 ? 'Cut covered!' : `$${Math.max(0, rent - run.coins)} short of the cut`}</span></div>
        <div class="lever-btns">
          <button class="btn small${auto ? ' primary' : ''}" type="button" data-act="auto">Auto-pull: ${auto ? 'ON' : 'off'} (T)</button>
          <button class="btn small" type="button" data-act="fast"${auto ? '' : ' disabled'}>${fast ? 'Full tilt' : 'Easy does it'}</button>
        </div>
        <p class="robo"${auto ? '' : ' hidden'}><span class="robo-tag">Robo-Rosie</span> <span class="robo-thought">${roboThought(aiPlan)}</span></p>`;
      thoughtEl = autoPanel.querySelector('.robo-thought');
      poolPanel.innerHTML = `<h3>Your reel strip · ${poolSize()}</h3>
        <div class="chips">${IDS.filter((id) => run.pool[id]).map((id) => `<span class="chip" title="${W.esc(SYM[id].name + ': ' + SYM[id].desc)}">${symImg(id, 'sm')} ×${run.pool[id]}</span>`).join('')}</div>
        <p class="fine">Each reel lands on one symbol from this strip. Hover a chip to see what it does.${Object.keys(run.destroyed).length ? ' Blown off the pier: ' + Object.entries(run.destroyed).map(([id, n]) => `${W.esc(SYM[id].name)} ×${n}`).join(', ') + '.' : ''}</p>`;
      if (!last) {
        lastPanel.innerHTML = `<h3>Last pull</h3><p class="fine">Fill a row to cash it. Each symbol pays and plays off the ones beside it. Three or more alike side by side pays a run bonus.</p>`;
        return;
      }
      const strips = last.results.map((r) => `<div class="strip" style="grid-template-columns:repeat(${r.syms.length},minmax(0,1fr))">
          ${r.syms.map((s, i) => `<div class="cell${r.why[i].length ? ' hit' : ''}" title="${W.esc(r.why[i].join(', '))}">${symImg(s, 'sm')}<span class="${r.pay[i] ? (r.pay[i] >= 5 ? 'hi' : '') : 'zero'}">${r.pay[i]}</span></div>`).join('')}
        </div>${r.bonus.length ? `<div class="chips">${r.bonus.map((b) => `<span class="chip accent">${W.esc(b.text)} +${b.amount}</span>`).join('')}</div>` : ''}`).join('');
      const notes = last.results.flatMap((r) => r.why.map((w, i) => (w.length ? `<span class="chip">${symImg(r.syms[i], 'sm')} ${W.esc(w.join(', '))}</span>` : ''))).filter(Boolean).slice(0, 8);
      lastPanel.innerHTML = `<h3>Last pull · <span class="won">$${last.total}</span>${last.lineMult > 1 ? ` <span class="mult">rows ×${last.lineMult}</span>` : ''}</h3>${strips}${notes.length ? `<div class="chips">${notes.join('')}</div>` : ''}`;
    }

    function paintQueue() { sh.setQueue(queue.slice(0, 3).map(spinPiece), { drawBlock: (ctx, b, px, py, s, x, y) => drawSpin(ctx, b, px, py, s, x, y, false) }); }

    const freshRun = () => ({ coins: 0, earned: 0, rentsPaid: 0, untilRent: RENT_EVERY, pool: { coin: 3, cherry: 3, bell: 2, blank: 4 }, destroyed: {} });
    function newRun() {
      board.clear();
      st.reset();
      st.o.gravity = 700;
      run = freshRun();
      dispCoins = 0;
      queue = [];
      last = null;
      runOver = false;
      jackT = hotT = hitStop = 0;
      sh.logEl.innerHTML = '';
      paint();
      say('Step up, stack up, cash up!', true);
      st.spawn();
    }

    let queueT = 0, idleT = 9000;
    sh.debug = {
      board, st, view, getRun: () => run, evalRow, plan: () => aiPlan,
      // Fill the bottom row with these symbols and cash it (for testing payouts).
      testRow(syms) {
        const y = board.h - 1;
        syms.forEach((s, x) => board.set(x, y, { sym: s, color: SYM[s].color }));
        st.active = null;
        st.checkClears();
      },
      naive(v) { naiveAI = !!v; },
      planFor: (p) => plan(p),
      aiw: AIW,
      fx: { spill: (n) => spill(n), jack: (ms) => { jackT = ms; }, hot: (ms) => { hotT = ms; }, siren, calliope },
      setAuto(on, f) { if (on !== auto) toggleAuto(); fast = !!f; paint(); },
    };
    sh.loop((dt) => {
      const t = now();
      if (jamT > 0) {
        jamT -= dt;
        if (jamT <= 0 && !runOver) {
          const lost = Math.floor(run.coins / 4);
          run.coins -= lost;
          board.clear();
          st.over = false;
          sh.toast(`Reels jammed! Rosie kicked the cabinet: board wiped, $${lost} spilled`, 'bad');
          say(LINES.jam, true);
          view.shake(14);
          W.noise({ dur: 0.25, vol: 0.09, filter: 'lowpass', freq: 400 });
          paint();
          st.spawn();
        }
      }
      if (hitStop > 0) hitStop -= dt; else st.update(dt);
      view.update(hitStop > 0 ? dt * 0.3 : dt);
      jackT = Math.max(0, jackT - dt);
      hotT = Math.max(0, hotT - dt);
      bossT = Math.max(0, bossT - dt);
      const p = st.active;
      if (p) {
        for (const b of p.blocks) if (!b.stopped && b.rollUntil <= t) { b.stopped = true; W.sfx('tick', 1.2); }
        if (auto && !st.paused && !sh.busy() && hitStop <= 0) {
          const settled = p.blocks.every((b) => b.stopped);
          // Robo-Rosie reads the stopped reels, then decides
          if (settled && !aiPlan) {
            aiPlan = plan(p);
            if (thoughtEl) thoughtEl.innerHTML = roboThought(aiPlan);
            aiT = fast ? 0 : -140;
          }
          if (aiPlan) {
            aiT += dt;
            const every = fast ? 22 : 75;
            while (aiT >= every && st.active === p) { aiT -= every; aiStep(); }
          }
        }
      }
      // purse counts up like a tally
      if (run && dispCoins !== run.coins) {
        const diff = run.coins - dispCoins;
        dispCoins = Math.abs(diff) < 1 ? run.coins : dispCoins + Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt / 160));
        if (purseEl) purseEl.textContent = '$' + Math.round(dispCoins);
      }
      if (!sh.busy() && !runOver && run) {
        idleT -= dt;
        if (idleT <= 0) { idleT = 14000 + Math.random() * 8000; say(pick(LINES.idle)); }
      }
      const open = t < talkUntil && Math.floor(t / 110) % 2 === 0 ? 1 : 0;
      if (open !== faceShown) { faceShown = open; faceCtx.clearRect(0, 0, 160, 160); faceCtx.drawImage(faces[open], 0, 0); }
      queueT -= dt;
      if (queueT <= 0 && run) { queueT = 110; paintQueue(); }
      drawBulbs(t);
      updateSpill(dt);
      view.draw(st);
    });

    run = freshRun();
    paint();
    view.draw(st);
    lineEl.textContent = 'Step right up! Every block’s a reel, every row’s a payday!';
    fontsReady(() => { paint(); bulbKey = ''; });
    sh.overlay({
      title: 'Lucky Pier',
      body: `<p class="barker">“Step up, stack up, cash up!”</p>
        <p>Every block is a reel. It spins as the piece drops in and lands on a symbol from your strip.</p>
        <ul><li>Fill a row to cash it. Symbols play off their neighbours: ${symImg('cat', 'sm')} beside ${symImg('milk', 'sm')} pays +9, ${symImg('bee', 'sm')} triples ${symImg('flower', 'sm')}, ${symImg('bomb', 'sm')} blows its neighbours off your strip.</li>
        <li>Every ${RENT_EVERY} pieces the Pier Boss wants his cut, and it goes up each visit.</li>
        <li>After paying, add a symbol to your strip and maybe chuck one.</li>
        <li><b>T</b> or Auto-pull hands the lever to Robo-Rosie.</li></ul>`,
      button: 'Pull the lever!',
    }).then(newRun);
  }

  // ---------- hub card art: the pier sign at sunset ----------
  function art(ctx, w, h) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2a1446'); sky.addColorStop(0.5, '#a8355f'); sky.addColorStop(0.78, '#f0704a'); sky.addColorStop(1, '#ffb257');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    // striped retro sun on the horizon
    ctx.save();
    ctx.beginPath(); ctx.arc(236, 94, 32, Math.PI, 0); ctx.closePath(); ctx.clip();
    const sun = ctx.createLinearGradient(0, 62, 0, 94); sun.addColorStop(0, '#ffe38a'); sun.addColorStop(1, '#ff9a4a');
    ctx.fillStyle = sun; ctx.fillRect(200, 60, 72, 36);
    ctx.fillStyle = '#f0704a';
    for (let i = 0; i < 4; i++) ctx.fillRect(200, 78 + i * 4.5, 72, 1 + i * 0.6);
    ctx.restore();
    ctx.fillStyle = '#0e6e76'; ctx.fillRect(0, 94, w, h - 94);
    ctx.fillStyle = '#1fa8b3';
    for (let i = 0; i < 9; i++) ctx.fillRect(((i * 47) % w) + (i % 2) * 12, 100 + (i % 3) * 6, 18, 2);
    ctx.fillStyle = 'rgba(255,227,138,0.6)'; ctx.fillRect(214, 98, 44, 2); ctx.fillRect(222, 104, 28, 2);
    // pier legs
    ctx.fillStyle = INK;
    for (const x of [40, 80, 136, 176]) ctx.fillRect(x, 92, 5, 28);
    ctx.fillRect(14, 92, 190, 6);
    // candy-stripe sign
    ctx.save();
    rr(ctx, 18, 10, 180, 80, 12); ctx.clip();
    for (let i = -10; i < 30; i++) {
      ctx.beginPath(); ctx.moveTo(18 + i * 12, 10); ctx.lineTo(30 + i * 12, 10); ctx.lineTo(30 + i * 12 - 80, 90); ctx.lineTo(18 + i * 12 - 80, 90); ctx.closePath();
      ctx.fillStyle = i % 2 ? CREAM : RED; ctx.fill();
    }
    ctx.restore();
    rr(ctx, 18, 10, 180, 80, 12); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    rr(ctx, 32, 24, 152, 52, 6); ctx.fillStyle = '#0c3b45'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#e6eaf0'; ctx.stroke();
    ['cherry', 'seven', 'bell'].forEach((id, i) => ctx.drawImage(blockSprite(id, i === 1, 44), 40 + i * 47, 28, 44, 44));
    // bulbs
    const pts = [];
    for (let i = 0; i < 12; i++) { pts.push([26 + i * 14.5, 17]); pts.push([26 + i * 14.5, 83]); }
    for (let i = 1; i < 4; i++) { pts.push([25, 17 + i * 16.5]); pts.push([191, 17 + i * 16.5]); }
    pts.forEach(([x, y], i) => ctx.drawImage(bulbSprite(i % 3 ? 1 : 0), x - 7, y - 7, 14, 14));
  }

  W.register({
    id: 'slot-well',
    num: 10,
    title: 'Lucky Pier',
    mix: 'Boardwalk slot reels × falling blocks',
    pitch: 'Every block is a spinning reel. Clear rows to cash out, seat cats by milk and bees by flowers, and make the Pier Boss’s cut.',
    palette: [RED, CREAM, GOLD, '#1fa8b3', '#ff7aa8'],
    shell: { hold: false, logTitle: 'Barker’s chalkboard', keysHint: '← → move · ↑ / Z rotate · ↓ soft drop · Space slam it down · T auto-pull' },
    art,
    mount,
  });
})();

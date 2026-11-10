/* 07 Stack & Strike: deckbuilder combat × falling blocks, dressed as "The Undercroft".
 * Turn-based: there is no gravity and every stone you set is one turn. Your pieces are cards drawn
 * from a satchel; some carry effects (extra damage, ward, picks, heals). A completed row tears loose
 * as a stone slab and flies into the foe. The foe telegraphs intents with countdowns: stones it will
 * hurl into your pit (held over the pit's lip, with their landing marked in red), rubble rows it will
 * push up, guards, blows and frost. Rubble that tops you out, or losing all blood, ends the run.
 * A six-chamber parchment route leads to the Hollow King.
 */
(function () {
  const W = window.Wells;

  const BW = 8, BH = 18;
  const LINE_DMG = [0, 6, 14, 24, 36];
  const MAX_BLOCK = 40;
  const GARB = '#3b322c';
  // Card stones: saturated, with a glowing carved rune. Plain stones: muted neutrals.
  const TONE = { atk: '#8a2520', def: '#3c5878', util: '#9c6d1c', heal: '#486f2c' };
  const GLOW = { atk: '#ff7a3a', def: '#c4e2ff', util: '#ffd66a', heal: '#c2f282' };
  const PLAIN = { I: '#8f877a', O: '#9a8a6e', T: '#83798a', S: '#7d806c', Z: '#8d7468', J: '#737d8a', L: '#968067', M: '#8a8174', D: '#8a8174' };
  const C = { blood: '#d8443a', gold: '#e3a33c', ember: '#ff8a2a', bone: '#eadfca', iron: '#9fbdd4', moss: '#9ccb62', rime: '#c4ecff', ochre: '#cf9455', ink: '#120a08', mortar: '#140d0a', parch: '#e8d9b5' };
  const FD = '"Pirata One", Georgia, serif', FB = '"Alegreya", Georgia, serif';

  const CARDS = {
    plain: { name: 'Stone', desc: 'Plain stone. No effect.' },
    strike: { name: 'Strike', type: 'T', tone: 'atk', glyph: 'sword', desc: '+6 damage if it completes a row.' },
    heavy: { name: 'Heavy Strike', type: 'I', tone: 'atk', glyph: 'swords', desc: '+12 damage if it completes a row.' },
    cleave: { name: 'Cleave', type: 'L', tone: 'atk', glyph: 'axe', desc: 'Rows it completes deal double damage.' },
    bash: { name: 'Shield Bash', type: 'T', tone: 'atk', glyph: 'boss', desc: 'If it completes a row, your ward is added as damage.' },
    venom: { name: 'Venom', type: 'S', tone: 'atk', glyph: 'drop', desc: 'The foe takes 3 damage at the end of each of the next 4 turns.' },
    guard: { name: 'Guard', type: 'O', tone: 'def', glyph: 'shield', desc: '+5 ward.' },
    bulwark: { name: 'Bulwark', type: 'Z', tone: 'def', glyph: 'shield', desc: '+9 ward.' },
    drill: { name: 'Pick', type: 'I', tone: 'util', glyph: 'down', desc: 'Smashes any rubble row it lands in.' },
    bomb: { name: 'Black Powder', type: 'O', tone: 'util', glyph: 'burst', desc: 'Blasts away every rubble stone touching it.' },
    scout: { name: 'Lantern', type: 'J', tone: 'util', glyph: 'eye', desc: 'See 2 more stones ahead for 3 turns.' },
    stall: { name: 'Stall', type: 'Z', tone: 'util', glyph: 'hourglass', desc: 'Every foe intent waits 1 more turn.' },
    patch: { name: 'Pebble', type: 'M', tone: 'util', glyph: 'chev', free: true, desc: 'One stone. Free: the foe does not act.' },
    step: { name: 'Quick Step', type: 'D', tone: 'util', glyph: 'chev', free: true, desc: 'Two stones. Free: the foe does not act.' },
    mend: { name: 'Mend', type: 'S', tone: 'heal', glyph: 'cross', desc: 'Heal 4 blood.' },
    siphon: { name: 'Siphon', type: 'J', tone: 'heal', glyph: 'cross', desc: 'Heal 3 blood for each row it completes.' },
  };
  const REWARD_POOL = Object.keys(CARDS).filter((k) => k !== 'plain');

  const RELICS = [
    { id: 'whetstone', icon: 'sword', name: 'Whetstone', desc: 'Strike and Heavy Strike bonuses are doubled.' },
    { id: 'spikes', icon: 'burst', name: 'Spikes', desc: 'Each rubble stone you clear deals 2 damage to the foe.' },
    { id: 'ironskin', icon: 'shield', name: 'Iron Skin', desc: 'Start every fight with 8 ward.' },
    { id: 'lens', icon: 'eye', name: 'Lens', desc: 'See 2 more stones ahead.' },
    { id: 'anchor', icon: 'anchor', name: 'Anchor', desc: 'Foe blows deal 3 less damage.' },
    { id: 'gauntlet', icon: 'fist', name: 'Gauntlet', desc: '+3 damage for each turn in a row you have cleared a row.' },
    { id: 'bloodstone', icon: 'gem', name: 'Bloodstone', desc: 'Heal 3 blood whenever you clear 2 or more rows at once.' },
    { id: 'hourglass', icon: 'hourglass', name: 'Hourglass', desc: 'Hurled stones and rubble take 1 extra turn to arrive.' },
    { id: 'thorns', icon: 'burst', name: 'Thorn Mail', desc: 'Damage your ward absorbs is dealt back to the attacker.' },
  ];

  const ENEMIES = {
    gloop: { name: 'Cellar Slime', hp: 26, slots: 2, desc: 'Spits small lumps and nibbles.', enter: 'oozes up out of the drain', pattern: [
      { kind: 'drop', shapes: ['O', 'D'], wait: 3 }, { kind: 'attack', dmg: 5, wait: 3 }, { kind: 'rise', rows: 1, wait: 4 }],
      barks: { start: ['Blorp.', 'Hnngh... warm meat.'], attack: ['GLRK!', 'Nom.'], hurt: ['Splrt!', 'Bleh!'], death: ['...blp.'] } },
    golem: { name: 'Mortar Golem', hp: 36, slots: 2, desc: 'Heaves up rubble and hides behind stone.', enter: 'pulls itself out of the wall', pattern: [
      { kind: 'rise', rows: 1, wait: 3 }, { kind: 'shield', amount: 8, wait: 3 }, { kind: 'attack', dmg: 7, wait: 3 }, { kind: 'rise', rows: 2, wait: 5 }],
      barks: { start: ['STONE REMEMBERS.'], attack: ['CRUSH.'], hurt: ['...CRACKS.'], shield: ['WALL.'], death: ['...dust.'] } },
    wisp: { name: 'Rime Wisp', hp: 30, slots: 2, desc: 'Freezes your stones and hurls long ones.', enter: 'drifts in on a cold draught', pattern: [
      { kind: 'freeze', wait: 2 }, { kind: 'drop', shapes: ['I'], wait: 3 }, { kind: 'attack', dmg: 6, wait: 3 }, { kind: 'drop', shapes: ['T', 'L'], wait: 3 }],
      barks: { start: ['So cold down here...'], attack: ['Shiver.'], freeze: ['Be still.'], hurt: ['Hsssss!'], death: ['...gone.'] } },
    imp: { name: 'Bone Knight', hp: 30, slots: 2, desc: 'Quick little throws and jabs. Never rests.', enter: 'rises from its bier', pattern: [
      { kind: 'drop', shapes: ['S', 'Z'], wait: 3 }, { kind: 'attack', dmg: 4, wait: 2 }, { kind: 'drop', shapes: ['M', 'D'], wait: 2 }, { kind: 'rise', rows: 1, wait: 5 }],
      barks: { start: ['Kneel.', 'None pass.'], attack: ['Have at thee!'], hurt: ['A scratch.'], death: ['My oath... ends.'] } },
    gargoyle: { name: 'Gilded Mimic', hp: 48, slots: 3, elite: true, desc: 'Elite. Three schemes at once: stones, frost and hard bites.', enter: 'was never a chest', pattern: [
      { kind: 'drop', shapes: ['S', 'Z'], wait: 3 }, { kind: 'attack', dmg: 8, wait: 3 }, { kind: 'freeze', wait: 2 }, { kind: 'rise', rows: 1, wait: 4 }, { kind: 'shield', amount: 8, wait: 3 }],
      barks: { start: ['Open me~'], attack: ['CHOMP!'], hurt: ['Rude!'], shield: ['Lid shut.'], freeze: ['Stay a while~'], death: ['...just a box.'] } },
    king: { name: 'The Hollow King', hp: 70, slots: 2, boss: true, desc: 'Boss. Every trick, heavier.', enter: 'turns his empty crown toward you', pattern: [
      { kind: 'drop', shapes: ['L', 'J'], wait: 3 }, { kind: 'shield', amount: 10, wait: 3 }, { kind: 'attack', dmg: 10, wait: 4 }, { kind: 'rise', rows: 2, wait: 5 },
      { kind: 'freeze', wait: 2 }, { kind: 'drop', shapes: ['I', 'T'], wait: 3 }, { kind: 'attack', dmg: 12, wait: 4 }, { kind: 'drop', shapes: ['O', 'S'], wait: 2 }],
      barks: { start: ['Bow to the hollow crown.'], attack: ['Kneel, and break.'], hurt: ['Insolence!'], shield: ['My vault holds.'], freeze: ['Be still, worm.'], death: ['The crown... was empty...'] } },
  };
  const NORMALS = ['gloop', 'golem', 'wisp', 'imp'];
  const NODE = {
    fight: { name: 'Skirmish', icon: 'swords', desc: 'Win, then take 1 of 3 new stones.' },
    elite: { name: 'Elite', icon: 'skull', desc: 'A harder fight. Win a stone and a relic.' },
    rest: { name: 'Campfire', icon: 'fire', desc: 'Heal 30% of your blood, or break a stone.' },
    relic: { name: 'Shrine', icon: 'gem', desc: 'Claim 1 of 3 relics.' },
    boss: { name: 'Throne', icon: 'crown', desc: 'The Hollow King. Kill him to end the run.' },
  };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const DEPTHS = ['The stair ends in black water.', 'Something scrapes behind the walls.', 'Old bones line the passage.', 'Candle stubs. Someone came this way once.', 'The air turns hot and tastes of iron.', 'A throne room. The crown is waiting.'];

  // Later steps make normal foes tougher; the boss is tuned for the last step as is.
  const scaleFor = (id, step) => (ENEMIES[id].boss ? 1 : 1 + (ENEMIES[id].elite ? 0.05 : 0.08) * step);

  let uid = 0;
  const card = (id, type) => ({ uid: ++uid, id, type: type || CARDS[id].type });
  const colorOf = (c) => (CARDS[c.id].tone ? TONE[CARDS[c.id].tone] : PLAIN[c.type] || '#8a8174');
  const toPiece = (c) => W.piece(c.type, W.SHAPES[c.type].cells.map((_, i) => ({ color: colorOf(c), glyph: CARDS[c.id].glyph, tone: CARDS[c.id].tone, card: c.id, v: (c.uid + i) % 3 })));
  const cardName = (c) => (c.id === 'plain' ? `${c.type} stone` : `${CARDS[c.id].name} ${c.type}`);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  // ======================================================================
  // Drawing kit: carved stone, rubble, runes, pixel monsters, parchment route
  // ======================================================================
  const DPR = () => window.devicePixelRatio || 1;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const hashStr = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

  // Runes and icons in a unit box. o: { color, width (px), hole }
  function glyph(ctx, name, x, y, size, o = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    ctx.lineWidth = (o.width || size * 0.12) / size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = o.color || C.bone;
    const L = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); };
    const P = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); };
    const dot = (cx, cy, r, col) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); if (col) ctx.fillStyle = col; ctx.fill(); };
    const sword = (m) => { const X = (v) => (m ? 1 - v : v); L([X(0.22), 0.78, X(0.82), 0.18]); L([X(0.24), 0.56, X(0.44), 0.76]); L([X(0.22), 0.78, X(0.12), 0.88]); };
    switch (name) {
      case 'sword': sword(false); break;
      case 'swords': sword(false); sword(true); break;
      case 'axe': L([0.24, 0.86, 0.66, 0.2]); P([0.5, 0.16, 0.86, 0.22, 0.84, 0.52, 0.66, 0.4]); break;
      case 'shield': case 'boss': {
        ctx.beginPath(); ctx.moveTo(0.2, 0.18); ctx.lineTo(0.8, 0.18); ctx.lineTo(0.8, 0.48);
        ctx.quadraticCurveTo(0.8, 0.78, 0.5, 0.92); ctx.quadraticCurveTo(0.2, 0.78, 0.2, 0.48); ctx.closePath(); ctx.stroke();
        if (name === 'boss') dot(0.5, 0.48, 0.12); else L([0.5, 0.26, 0.5, 0.8]);
        break;
      }
      case 'drop':
        ctx.beginPath(); ctx.moveTo(0.5, 0.08); ctx.bezierCurveTo(0.66, 0.34, 0.8, 0.5, 0.8, 0.64); ctx.bezierCurveTo(0.8, 0.82, 0.66, 0.92, 0.5, 0.92);
        ctx.bezierCurveTo(0.34, 0.92, 0.2, 0.82, 0.2, 0.64); ctx.bezierCurveTo(0.2, 0.5, 0.34, 0.34, 0.5, 0.08); ctx.closePath(); ctx.fill(); break;
      case 'down': L([0.5, 0.12, 0.5, 0.84]); L([0.26, 0.6, 0.5, 0.86, 0.74, 0.6]); break;
      case 'burst': {
        ctx.beginPath();
        for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.2 : 0.46; ctx.lineTo(0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r); }
        ctx.closePath(); ctx.fill(); break;
      }
      case 'eye':
        ctx.beginPath(); ctx.moveTo(0.08, 0.5); ctx.quadraticCurveTo(0.5, 0.1, 0.92, 0.5); ctx.quadraticCurveTo(0.5, 0.9, 0.08, 0.5); ctx.closePath(); ctx.stroke();
        dot(0.5, 0.5, 0.13); break;
      case 'hourglass': L([0.26, 0.14, 0.74, 0.14, 0.28, 0.86, 0.72, 0.86, 0.26, 0.14]); break;
      case 'chev': L([0.2, 0.24, 0.44, 0.5, 0.2, 0.76]); L([0.52, 0.24, 0.76, 0.5, 0.52, 0.76]); break;
      case 'cross': L([0.5, 0.16, 0.5, 0.84]); L([0.16, 0.5, 0.84, 0.5]); break;
      case 'gem': L([0.3, 0.2, 0.7, 0.2, 0.88, 0.42, 0.5, 0.88, 0.12, 0.42, 0.3, 0.2]); L([0.12, 0.42, 0.88, 0.42]); L([0.4, 0.42, 0.5, 0.86, 0.6, 0.42]); break;
      case 'anchor':
        L([0.5, 0.24, 0.5, 0.86]); L([0.32, 0.36, 0.68, 0.36]);
        ctx.beginPath(); ctx.arc(0.5, 0.15, 0.08, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0.16, 0.58); ctx.quadraticCurveTo(0.22, 0.86, 0.5, 0.86); ctx.quadraticCurveTo(0.78, 0.86, 0.84, 0.58); ctx.stroke(); break;
      case 'fist':
        ctx.beginPath(); ctx.moveTo(0.24, 0.34); ctx.lineTo(0.76, 0.34); ctx.lineTo(0.76, 0.7); ctx.quadraticCurveTo(0.76, 0.86, 0.6, 0.86); ctx.lineTo(0.38, 0.86); ctx.quadraticCurveTo(0.24, 0.86, 0.24, 0.7); ctx.closePath(); ctx.stroke();
        L([0.37, 0.34, 0.37, 0.52]); L([0.5, 0.34, 0.5, 0.52]); L([0.63, 0.34, 0.63, 0.52]); L([0.24, 0.6, 0.12, 0.48]); break;
      case 'up': L([0.2, 0.52, 0.5, 0.22, 0.8, 0.52]); L([0.2, 0.82, 0.5, 0.52, 0.8, 0.82]); break;
      case 'snow':
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI, dx = Math.cos(a) * 0.4, dy = Math.sin(a) * 0.4;
          L([0.5 - dx, 0.5 - dy, 0.5 + dx, 0.5 + dy]);
        }
        dot(0.5, 0.5, 0.08); break;
      case 'stone': P([0.26, 0.1, 0.74, 0.1, 0.74, 0.46, 0.26, 0.46]); L([0.5, 0.56, 0.5, 0.9]); L([0.34, 0.76, 0.5, 0.92, 0.66, 0.76]); break;
      case 'skull':
        dot(0.5, 0.42, 0.32); P([0.32, 0.56, 0.68, 0.56, 0.66, 0.84, 0.34, 0.84]);
        dot(0.37, 0.44, 0.09, o.hole || C.ink); dot(0.63, 0.44, 0.09, o.hole || C.ink);
        ctx.fillStyle = o.hole || C.ink; P([0.5, 0.56, 0.45, 0.66, 0.55, 0.66]);
        ctx.strokeStyle = o.hole || C.ink; ctx.lineWidth = 0.04; L([0.43, 0.74, 0.43, 0.84]); L([0.57, 0.74, 0.57, 0.84]); break;
      case 'fire':
        ctx.beginPath(); ctx.moveTo(0.5, 0.06); ctx.bezierCurveTo(0.62, 0.3, 0.8, 0.42, 0.74, 0.62); ctx.bezierCurveTo(0.7, 0.76, 0.3, 0.76, 0.26, 0.62);
        ctx.bezierCurveTo(0.22, 0.48, 0.34, 0.4, 0.4, 0.26); ctx.bezierCurveTo(0.44, 0.38, 0.5, 0.4, 0.5, 0.06); ctx.closePath(); ctx.fill();
        L([0.18, 0.9, 0.82, 0.76]); L([0.18, 0.76, 0.82, 0.9]); break;
      case 'crown': P([0.12, 0.78, 0.12, 0.3, 0.32, 0.52, 0.5, 0.2, 0.68, 0.52, 0.88, 0.3, 0.88, 0.78]); L([0.12, 0.88, 0.88, 0.88]); break;
      case 'q': L([0.36, 0.34, 0.5, 0.2, 0.66, 0.32, 0.5, 0.5, 0.5, 0.62]); dot(0.5, 0.82, 0.06); break;
    }
    ctx.restore();
  }

  // Carved ashlar (or rubble) block into a cell of size s.
  function paintStone(x, s, color, v, rubble) {
    const r = W.rng(hashStr(color) + v * 7919 + Math.round(s) * 31 + (rubble ? 5 : 0));
    x.fillStyle = C.mortar;
    x.fillRect(0, 0, s, s);
    const m = Math.max(1, s * 0.05);
    const ch = () => (rubble ? 0.06 + r() * 0.16 : 0.02 + r() * 0.08) * s;
    const a = ch(), b = ch(), c = ch(), d = ch();
    x.beginPath();
    x.moveTo(m + a, m); x.lineTo(s - m - b, m); x.lineTo(s - m, m + b);
    x.lineTo(s - m, s - m - c); x.lineTo(s - m - c, s - m); x.lineTo(m + d, s - m);
    x.lineTo(m, s - m - d); x.lineTo(m, m + a); x.closePath();
    x.fillStyle = color;
    x.fill();
    x.save();
    x.clip();
    const g = x.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, 'rgba(255,236,200,0.24)');
    g.addColorStop(0.45, 'rgba(255,236,200,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.4)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    const n = Math.round(s * s * 0.06);
    for (let i = 0; i < n; i++) {
      x.fillStyle = r() < 0.45 ? 'rgba(255,240,220,0.10)' : 'rgba(0,0,0,0.17)';
      const z = r() < 0.8 ? 1 : 2;
      x.fillRect(Math.floor(r() * s), Math.floor(r() * s), z, z);
    }
    const lw = Math.max(1, s * 0.045);
    if (!rubble) {
      // one course seam with a head joint: the cell reads as two courses of brick in running bond
      const sy = Math.round(s * (0.5 + (r() - 0.5) * 0.06)) + 0.5;
      const vx = Math.round(s * (v === 1 ? 0.34 : v === 2 ? 0.66 : 0.5)) + 0.5;
      x.strokeStyle = 'rgba(12,7,5,0.6)';
      x.lineWidth = lw;
      x.beginPath(); x.moveTo(0, sy); x.lineTo(s, sy); x.moveTo(vx, 0); x.lineTo(vx, sy); x.stroke();
      x.strokeStyle = 'rgba(255,236,200,0.12)';
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, sy + lw); x.lineTo(s, sy + lw); x.moveTo(vx + lw, 0); x.lineTo(vx + lw, sy); x.stroke();
    } else {
      x.lineWidth = Math.max(1, s * 0.05);
      for (let k = 0; k < 2 + (v % 2); k++) {
        let px = r() * s, py = r() < 0.5 ? 0 : s * r();
        x.strokeStyle = 'rgba(0,0,0,0.6)';
        x.beginPath(); x.moveTo(px, py);
        for (let j = 0; j < 3; j++) { px += (r() - 0.5) * s * 0.5; py += s * (0.15 + r() * 0.25); x.lineTo(px, py); }
        x.stroke();
      }
      for (let k = 0; k < 3; k++) { x.fillStyle = 'rgba(255,230,200,0.13)'; x.fillRect(r() * s, r() * s, Math.max(1, s * 0.12), Math.max(1, s * 0.08)); }
    }
    x.restore();
    const e = Math.max(1, s * 0.06);
    x.lineWidth = e;
    x.strokeStyle = rubble ? 'rgba(255,238,210,0.12)' : 'rgba(255,238,210,0.3)';
    x.beginPath(); x.moveTo(m + a, m + e / 2); x.lineTo(s - m - b, m + e / 2); x.moveTo(m + e / 2, m + a); x.lineTo(m + e / 2, s - m - d); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.5)';
    x.beginPath(); x.moveTo(m + d, s - m - e / 2); x.lineTo(s - m - c, s - m - e / 2); x.moveTo(s - m - e / 2, m + b); x.lineTo(s - m - e / 2, s - m - c); x.stroke();
  }

  const texCache = new Map();
  function blockTex(b, s, v) {
    const d = DPR(), rub = !!b.garbage;
    const key = `${rub ? 'G' : b.color}|${b.glyph || ''}|${b.tone || ''}|${s}|${v}|${d}`;
    let t = texCache.get(key);
    if (t) return t;
    t = mk(s * d, s * d);
    const x = t.getContext('2d');
    x.scale(d, d);
    paintStone(x, s, rub ? GARB : b.color, v, rub);
    if (b.glyph && b.tone) {
      const gs = s * 0.62, o = (s - gs) / 2, lw = Math.max(1.3, s * 0.08);
      glyph(x, b.glyph, o + 0.9, o + 0.9, gs, { color: 'rgba(0,0,0,0.65)', width: lw + 1.4, hole: 'rgba(0,0,0,0)' });
      x.save();
      x.shadowColor = GLOW[b.tone];
      x.shadowBlur = s * 0.28;
      glyph(x, b.glyph, o, o, gs, { color: GLOW[b.tone], width: lw });
      x.restore();
    }
    texCache.set(key, t);
    return t;
  }
  function frostTex(s) {
    const d = DPR(), key = `frost|${s}|${d}`;
    let t = texCache.get(key);
    if (t) return t;
    t = mk(s * d, s * d);
    const x = t.getContext('2d');
    x.scale(d, d);
    x.fillStyle = 'rgba(190,232,255,0.42)';
    x.fillRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88);
    x.strokeStyle = 'rgba(240,252,255,0.9)';
    x.lineWidth = 1;
    x.strokeRect(s * 0.08 + 0.5, s * 0.08 + 0.5, s * 0.84 - 1, s * 0.84 - 1);
    glyph(x, 'snow', s * 0.18, s * 0.18, s * 0.64, { color: 'rgba(240,252,255,0.85)', width: Math.max(1, s * 0.05) });
    texCache.set(key, t);
    return t;
  }

  function drawBlock(ctx, b, px, py, s, x, y, o) {
    if (o && o.ghost) {
      ctx.save();
      ctx.strokeStyle = 'rgba(236,214,170,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(px + 3.5, py + 3.5, s - 7, s - 7);
      ctx.restore();
      return;
    }
    const v = b.v != null ? b.v : (((x * 5 + y * 3) % 3) + 3) % 3;
    ctx.drawImage(blockTex(b, s, v), px, py, s, s);
    if (b.frozen) ctx.drawImage(frostTex(s), px, py, s, s);
  }

  // ---------- pixel monsters (original). Left halves are mirrored unless mirror:false. ----------
  const SPR = {
    gloop: { mirror: true, pal: { k: '#160d0b', g: '#6f8f34', G: '#a6c24e', d: '#465c20', w: '#efe6c6', m: '#3b1410', h: '#dcefae' }, rows: [
      '............', '........kkkk', '......kkgGGG', '.....kgGhhGg', '....kgGhGggg', '...kgggggggg', '...kggwwwggg', '..kggwwkkwgg',
      '..kggwwkkwgg', '..kgggwwwggg', '.kgggggggggg', '.kgggggggggk', '.kggggggggkm', 'kdggggggggkm', 'kddggggggggk', 'kdddgggggggg',
      '.kddddddgggg', '..kkdddddddd', '....kkkkkkkk'] },
    golem: { mirror: true, pal: { k: '#140c0a', s: '#857767', S: '#ad9e8a', t: '#5a4e44', m: '#2e241e', e: '#ffb347', E: '#ff6a2a' }, rows: [
      '......kkkkkk', '.....kSSSSSS', '.....kSssmss', '.....ksEesms', '.....ksssssm', '.....kttmttt', '.kkkkkkkkkkk', 'kSSSkSSSmSSS',
      'ksssksssmsss', 'ktttkmmmmmmm', 'kSSSkSSmSSEe', 'ksssksssmeEE', 'ktttkmmmmmmm', 'kSSSkSSSmSSS', 'ksssksssmsss', 'kkkkkmmmmmmm',
      'kSSSk.kSSSk.', 'ksssk.ksssk.', 'kkkkk.ksssk.', '......kttk..', '......kkkk..'] },
    wisp: { mirror: true, pal: { F: '#eefcff', f: '#a8e2ff', b: '#5aa6dc', d: '#2c6aa8', k: '#0c1830' }, rows: [
      '...........f', '..........ff', '.........fFf', '....b...bfFF', '....bb.bbfFF', '...bbbbbfFFF', '...dbbbffFFF', '..dbbbfffFFF',
      '..dbbffkkFFF', '..dbbffkkFFF', '..dbbbfffFFF', '..dbbbbffffk', '...dbbbbffff', '...ddbbbbfff', '....ddbbbbff', '.....ddbbbbf',
      '......ddbbbb', '........dddb', '..........dd'] },
    imp: { mirror: true, pal: { k: '#120c0b', i: '#59606c', I: '#8b94a1', b: '#e6dcc2', B: '#a99a7e', r: '#ff3b2f', c: '#6e1c1c', C: '#9a2a24', g: '#c9a040' }, rows: [
      '...........C', '.........kkC', '........kIII', '.......kIiii', '......kIiiii', '......kiiiii', '......kkkkkk', '......kiikrk',
      '......kiiiii', '.......kbBbB', '........kkkk', '....kkkkkbbb', '...kIiikkbkb', '...kiiikbbbb', '...kkkkkkbkb', '....kbk.kbbb',
      '....kbk.kkbk', '....kbk.kccc', '....kkk.kcCc', '.......kcCcc', '.......kbk..', '.......kbk..', '......kkkk..'],
      patch: (() => { const p = [[21, 1, 'k']]; for (let y = 2; y <= 14; y++) p.push([20, y, 'k'], [21, y, 'I'], [22, y, 'k']); for (let x = 19; x <= 23; x++) p.push([x, 15, 'g']); p.push([21, 16, 'c'], [21, 17, 'c'], [21, 18, 'g']); return p; })() },
    gargoyle: { mirror: true, pal: { k: '#120a08', w: '#6e4222', W: '#93602f', g: '#e0b040', G: '#9a6f1f', t: '#efe6cc', r: '#a52a36', d: '#2a0a0e', y: '#ffd84a' }, rows: [
      '...kkkkkkkkk', '..kgWWWWWgWW', '..kgwwwwwgww', '..kgwwwwwgww', '..kggggggggg', '..kdtdtdtdtd', '..kddddddddd', '..kddyyddddd',
      '..kddddddrrr', '..kdddrrrrrr', '..ktdtdtdtdt', '..kggggggggg', '..kgWWWWkggg', '..kgwwwwkgkg', '..kgwwwwkggg', '..kgwwwwwkkk',
      '..kGGGGGGGGG', '...kkkkkkkkk', '...kk....kk.'] },
    king: { mirror: true, pal: { k: '#0e0809', g: '#e3b341', G: '#9a6c1a', r: '#c21f2a', a: '#2e2838', A: '#4c4460', v: '#070405', e: '#ff8a2a', E: '#ffd27a', c: '#6e0f1c', C: '#9a1a28' }, rows: [
      '....k...k..k', '....kg.kgk.g', '....kgkggkgg', '....kggrgggg', '....kGGGGGGG', '....kAAAAAAA', '...kAavvvvvv', '...kavvvvvvv',
      '...kavvevvvv', '...kavvEvvvv', '...kavvvvvvv', '..kcAavvvvvv', '.kcCkAAvvvvv', '.kcCkaAAAvvv', 'kcCckAgAAAAA', 'kcCckaagaaaa',
      'kcCckaaagaaa', 'kccCkaaaaaga', 'kccCkAAAAAAA', 'kcccCkaaaaaa', 'kcccCkaaaaaa', 'kkcccCkaaaaa', '..kkkkkkkkkk'] },
  };
  const sprCache = {};
  function sprite(id) {
    if (sprCache[id]) return sprCache[id];
    const d = SPR[id];
    let rows = d.rows.map((r) => (d.mirror ? r + [...r].reverse().join('') : r));
    let w = Math.max(...rows.map((r) => r.length));
    if (d.patch) w = Math.max(w, ...d.patch.map((p) => p[0] + 1));
    rows = rows.map((r) => r.padEnd(w, '.'));
    if (d.patch) for (const [x, y, ch] of d.patch) rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1);
    const h = rows.length, img = mk(w, h), white = mk(w, h), px = [];
    const a = img.getContext('2d'), b = white.getContext('2d');
    b.fillStyle = '#fff6e8';
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const col = d.pal[ch];
      if (!col) return;
      a.fillStyle = col;
      a.fillRect(x, y, 1, 1);
      b.fillRect(x, y, 1, 1);
      px.push({ x, y, c: col, th: Math.random() * 0.55 + (1 - y / h) * 0.3, vx: (Math.random() - 0.5) * 2 });
    }));
    return (sprCache[id] = { img, white, w, h, px });
  }

  // Route map: six chambers, their choices, and the path taken.
  function drawRoute(ctx, w, h, map, step, picks, th) {
    const pad = Math.max(18, w * 0.06), n = map.length, dx = (w - pad * 2) / (n - 1);
    const top = th.labels ? h - 18 : h, r = Math.min(top * 0.2, dx * 0.32);
    const pos = (i, j) => ({ x: pad + i * dx, y: map[i].length === 1 ? top / 2 : top / 2 + (j - 0.5) * (top - r * 2 - 6) });
    ctx.lineCap = 'round';
    for (let i = 0; i < n - 1; i++) {
      map[i].forEach((_, a) => map[i + 1].forEach((__, b) => {
        const p = pos(i, a), q = pos(i + 1, b), taken = picks[i] === a && picks[i + 1] === b;
        ctx.strokeStyle = taken ? th.mark : th.faint;
        ctx.lineWidth = taken ? 2.5 : 1.5;
        ctx.setLineDash(taken ? [] : [4, 4]);
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }));
    }
    ctx.setLineDash([]);
    map.forEach((opts, i) => {
      opts.forEach((o, j) => {
        const p = pos(i, j), past = i < step, now = i === step, chosen = picks[i] === j;
        ctx.globalAlpha = past && !chosen ? 0.35 : 1;
        ctx.fillStyle = th.node;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = now ? 2.5 : 1.5;
        ctx.strokeStyle = now ? th.now : chosen ? th.mark : th.ink;
        ctx.stroke();
        if (now) { ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke(); }
        glyph(ctx, NODE[o.kind].icon, p.x - r * 0.68, p.y - r * 0.68, r * 1.36, { color: o.kind === 'boss' || o.kind === 'elite' ? th.mark : th.ink, width: Math.max(1.2, r * 0.16), hole: th.node });
        if (past && chosen) {
          ctx.strokeStyle = th.mark;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p.x - r * 0.9, p.y - r * 0.9); ctx.lineTo(p.x + r * 0.9, p.y + r * 0.9); ctx.moveTo(p.x + r * 0.9, p.y - r * 0.9); ctx.lineTo(p.x - r * 0.9, p.y + r * 0.9); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
      if (th.labels) W.text(ctx, ROMAN[i], pad + i * dx, h - 8, { size: 14, color: i === step ? th.now : th.ink, font: FD, weight: 400 });
    });
  }
  const PARCH = { ink: '#3a2414', faint: 'rgba(58,36,20,0.4)', mark: '#9a1d14', now: '#9a1d14', node: '#efe3c4', labels: true };
  const DARKROUTE = { ink: '#b8a283', faint: 'rgba(184,162,131,0.35)', mark: '#d8443a', now: '#e3a33c', node: '#1a120e', labels: false };

  const iconCache = new Map();
  function icon(name, color, size = 18) {
    const key = `${name}|${color}|${size}`;
    let url = iconCache.get(key);
    if (!url) {
      const d = 2, c = mk(size * d, size * d), x = c.getContext('2d');
      x.scale(d, d);
      glyph(x, name, size * 0.08, size * 0.08, size * 0.84, { color, width: Math.max(1.4, size * 0.11), hole: 'rgba(0,0,0,0)' });
      url = c.toDataURL();
      iconCache.set(key, url);
    }
    return `<img class="ss-ico" alt="" src="${url}" width="${size}" height="${size}">`;
  }

  // Shared backdrop: dark coursed stone wall.
  function paintWall(x, w, h, bw, bh, seed, base, lite) {
    const r = W.rng(seed);
    x.fillStyle = '#080504';
    x.fillRect(0, 0, w, h);
    for (let row = 0, y = 0; y < h; row++, y += bh) {
      const off = row % 2 ? bw / 2 : 0;
      for (let xx = -off; xx < w; xx += bw) {
        const k = r();
        x.fillStyle = k < 0.33 ? base : k < 0.66 ? lite : W.shade(base, -0.12);
        x.fillRect(xx + 1, y + 1, bw - 2, bh - 2);
        x.fillStyle = 'rgba(255,230,190,0.03)';
        x.fillRect(xx + 1, y + 1, bw - 2, 1);
      }
    }
  }

  // ======================================================================
  function mount(sh) {
    const rng = W.rng();
    const board = new W.Board(BW, BH);
    let run = null, fight = null;
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    sh.own(() => timers.forEach(clearTimeout));
    const has = (id) => run && run.relics.some((r) => r.id === id);

    // ---------- sound: stone, steel and spoils ----------
    const A = {
      clang(p = 1) {
        W.noise({ filter: 'bandpass', freq: 3200 * p, q: 9, dur: 0.24, vol: 0.08 });
        W.tone({ f: 1760 * p, f2: 1640 * p, dur: 0.22, type: 'square', vol: 0.022 });
        W.tone({ f: 2637 * p, dur: 0.16, type: 'square', vol: 0.011, at: 0.004 });
        W.noise({ filter: 'lowpass', freq: 380, dur: 0.14, vol: 0.1 });
      },
      thud() { W.noise({ filter: 'lowpass', freq: 420, freq2: 90, dur: 0.13, vol: 0.13 }); W.tone({ f: 96, f2: 48, dur: 0.13, type: 'sine', vol: 0.1 }); },
      roar() { W.noise({ filter: 'lowpass', freq: 160, freq2: 900, q: 5, dur: 0.55, vol: 0.1 }); W.tone({ f: 74, f2: 46, dur: 0.55, type: 'sawtooth', vol: 0.022 }); },
      jingle() { [2093, 2637, 3136, 2794, 3520].forEach((f, i) => W.tone({ f, dur: 0.08, type: 'square', vol: 0.014, at: i * 0.05 + Math.random() * 0.01 })); W.noise({ filter: 'highpass', freq: 6000, dur: 0.2, vol: 0.02 }); },
      scrape() { W.noise({ filter: 'bandpass', freq: 1500, q: 2, dur: 0.035, vol: 0.025 }); },
      grind() { W.noise({ filter: 'bandpass', freq: 650, q: 3, dur: 0.07, vol: 0.045 }); },
      whoosh() { W.noise({ filter: 'highpass', freq: 700, freq2: 2600, dur: 0.09, vol: 0.025 }); },
      heave() { W.noise({ filter: 'lowpass', freq: 180, freq2: 1300, q: 2, dur: 0.24, vol: 0.07 }); },
      rumble() { W.noise({ filter: 'lowpass', freq: 140, freq2: 60, dur: 0.5, vol: 0.14 }); },
      clank() { W.noise({ filter: 'bandpass', freq: 1700, q: 6, dur: 0.1, vol: 0.05 }); W.tone({ f: 440, f2: 415, dur: 0.14, type: 'triangle', vol: 0.03 }); },
      frost() { [2400, 3200, 2800].forEach((f, i) => W.tone({ f, f2: f * 1.25, dur: 0.18, type: 'sine', vol: 0.014, at: i * 0.04 })); },
      bad() { W.tone({ f: 110, f2: 52, dur: 0.42, type: 'sawtooth', vol: 0.035 }); W.noise({ filter: 'lowpass', freq: 300, dur: 0.3, vol: 0.08 }); },
      bell() { W.tone({ f: 196, dur: 1.2, type: 'sine', vol: 0.06 }); W.tone({ f: 294, dur: 0.9, type: 'sine', vol: 0.03, at: 0.01 }); W.tone({ f: 523, dur: 0.5, type: 'triangle', vol: 0.012 }); },
    };
    W.voice = {
      move: A.scrape, rotate: A.grind, lock: A.thud, drop: A.whoosh,
      clear: A.heave, big: () => { A.heave(); A.rumble(); },
      buy: A.jingle, coin: A.jingle, bad: A.bad, hit: () => A.clang(0.9),
      win: () => { A.bell(); A.jingle(); }, tick: null,
    };

    // ---------- geometry ----------
    const s = W.autoCell(BW, BH + 5, 30);
    const EH = Math.round(s * 5);
    const view = new W.BoardView(sh.canvas, board, {
      cell: s, grid: false, ghost: true, background: wellBg, drawBlock, underlay: drawLandings, overlay: drawRise,
      clearFlash, drawParticle, textFont: FD, textStroke: '#120a08', textWeight: 400,
    });
    const EW = view.W;
    const encC = W.el('canvas', 'ss-enc');
    sh.boardFrame.insertBefore(encC, sh.canvas);
    const fxC = W.el('canvas', 'ss-fx');
    sh.boardFrame.insertBefore(fxC, sh.boardFrame.querySelector('.board-overlay'));
    const dpr = DPR();
    encC.width = EW * dpr; encC.height = EH * dpr; encC.style.width = EW + 'px';
    fxC.width = EW * dpr; fxC.height = (EH + view.H) * dpr;
    const ex = encC.getContext('2d'), fx = fxC.getContext('2d');

    // Cached backdrops
    const wellBgC = mk(view.W * dpr, view.H * dpr);
    (() => {
      const x = wellBgC.getContext('2d');
      x.scale(dpr, dpr);
      paintWall(x, view.W, view.H, s * 2, s, 991, '#1a120e', '#1e1511');
      const g = x.createLinearGradient(0, 0, 0, view.H);
      g.addColorStop(0, 'rgba(60,30,12,0.15)'); g.addColorStop(0.5, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.7)');
      x.fillStyle = g; x.fillRect(0, 0, view.W, view.H);
      const sg = x.createLinearGradient(0, 0, view.W, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(0.12, 'rgba(0,0,0,0)'); sg.addColorStop(0.88, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.55)');
      x.fillStyle = sg; x.fillRect(0, 0, view.W, view.H);
    })();
    const glowC = mk(256, 256);
    (() => {
      const x = glowC.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,150,60,0.32)'); g.addColorStop(0.5, 'rgba(255,110,40,0.1)'); g.addColorStop(1, 'rgba(255,90,30,0)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    })();
    const encBgC = mk(EW * dpr, EH * dpr);
    (() => {
      const x = encBgC.getContext('2d');
      x.scale(dpr, dpr);
      paintWall(x, EW, EH, s * 1.2, s * 0.55, 313, '#1d1410', '#22180f');
      const rg = x.createRadialGradient(EW / 2, EH * 0.62, 4, EW / 2, EH * 0.62, EW * 0.48);
      rg.addColorStop(0, 'rgba(0,0,0,0.7)'); rg.addColorStop(0.7, 'rgba(0,0,0,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(0, 0, EW, EH);
      const tg = x.createLinearGradient(0, 0, 0, EH);
      tg.addColorStop(0, 'rgba(0,0,0,0.55)'); tg.addColorStop(0.3, 'rgba(0,0,0,0)');
      x.fillStyle = tg; x.fillRect(0, 0, EW, EH);
      // the lip of the pit: one dressed stone per column, then the drop into the dark
      const ly = s * 4.72, lh = EH - ly;
      for (let c = 0; c < BW; c++) {
        x.fillStyle = C.mortar; x.fillRect(c * s, ly, s, lh);
        x.fillStyle = c % 2 ? '#3a2e25' : '#41342a'; x.fillRect(c * s + 1, ly + 1, s - 2, lh - 2);
        x.fillStyle = 'rgba(255,225,180,0.16)'; x.fillRect(c * s + 1, ly + 1, s - 2, 1);
      }
      x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, EH - 2, EW, 2);
    })();

    function wellBg(ctx, w, h) {
      ctx.drawImage(wellBgC, 0, 0, w, h);
      const k = 0.75 + 0.12 * Math.sin(en.t * 0.013) + 0.08 * Math.sin(en.t * 0.041);
      ctx.globalAlpha = k;
      ctx.drawImage(glowC, -w * 0.4, -w * 0.9, w * 1.8, w * 1.6);
      ctx.globalAlpha = 1;
    }
    function clearFlash(ctx, rows, k) {
      // the row has already torn loose: leave a dark scar with ember edges
      for (const y of rows) {
        ctx.fillStyle = '#0a0605';
        ctx.fillRect(0, y * s, view.W, s);
        ctx.fillStyle = rgba(C.ember, 0.55 * k);
        ctx.fillRect(0, y * s, view.W, 2);
        ctx.fillRect(0, y * s + s - 2, view.W, 2);
      }
    }
    function drawParticle(ctx, f) {
      if (f.color === C.ember) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = C.ember;
        ctx.beginPath(); ctx.arc(f.x * s, f.y * s, f.size * 0.4, 0, Math.PI * 2); ctx.fill();
        return;
      }
      ctx.fillStyle = f.color;
      ctx.fillRect(f.x * s - f.size / 2, f.y * s - f.size / 3, f.size, f.size * 0.66);
    }
    const chips = (rows, color) => { for (const y of rows) for (let x = 0; x < BW; x++) view.burst(x + 0.5, y + 0.5, color || '#6b5a4a', 2, 5); };

    const st = new TurnStacker(board, {
      gravity: 0,
      hold: false,
      clearDelay: 320,
      next() {
        const f = fight;
        f.cur = drawCard();
        const p = toPiece(f.cur);
        if (f.freezeNext) { p.frozen = true; p.blocks.forEach((b) => (b.frozen = true)); f.freezeNext = false; }
        return p;
      },
      onSpawn() { paint(); },
      onLock(cells) { onPlace(cells); },
      onClear(rows, rowBlocks) { strike(rows, rowBlocks); },
      beforeSpawn() { return endTurn(); },
      onTopOut() { defeat('The pit filled to the brim with stone'); },
    });
    let frostToastAt = -1e9;
    st.onFrozen = () => { A.frost(); const now = performance.now(); if (now - frostToastAt > 2500) { frostToastAt = now; sh.toast('Frost holds this stone. It will not turn.', 'bad'); } };
    sh.stackerKeys(st, { hold: () => {} });
    sh.pad({ left: () => st.move(-1), right: () => st.move(1), rotCCW: () => st.rotate(-1), rotCW: () => st.rotate(1), down: () => st.softDrop(), drop: () => st.hardDrop() },
      [['◀', 'left', true], ['⟲', 'rotCCW'], ['⟳', 'rotCW'], ['▶', 'right', true], ['▼', 'down', true], ['Set', 'drop']]);

    const enemyPanel = W.el('div', 'panel ss-foe');
    const cardPanel = W.el('div', 'panel ss-hand');
    const runPanel = W.el('div', 'panel ss-run');
    sh.extra.append(enemyPanel, cardPanel, runPanel);

    // ---------- encounter + fx state ----------
    const en = { t: 0, id: null, flash: 0, recoil: 0, lunge: 0, enter: 1, dying: -1, hpShown: 0, hpHold: 0, bark: null };
    const fxs = { slabs: [], parts: [], nums: [], red: 0 };
    let hitStop = 0, frameShake = 0;
    const monPx = Math.max(2, Math.round(s / 8));
    const monBase = s * 3.95;
    const monCenter = () => { const sp = en.id ? sprite(en.id) : { h: 22 }; return { x: EW / 2, y: monBase - (sp.h * monPx) / 2 }; };
    function bark(kind) {
      const e = ENEMIES[en.id];
      const lines = e && e.barks && e.barks[kind];
      if (lines) en.bark = { text: pick(lines), life: 1900 };
    }

    // ---------- deck ----------
    function drawCard() {
      const f = fight;
      fill();
      const c = f.upcoming.shift();
      f.discard.push(c);
      fill();
      return c;
    }
    function fill() {
      const f = fight;
      while (f.upcoming.length < 6) {
        if (!f.pile.length) {
          if (!f.discard.length) break;
          f.pile = rng.shuffle(f.discard.splice(0));
        }
        f.upcoming.push(f.pile.pop());
      }
    }
    const visible = () => 3 + (has('lens') ? 2 : 0) + (fight && fight.scoutTurns > 0 ? 2 : 0);

    // ---------- foe intents ----------
    function makeIntent() {
      const e = fight.enemy, tpl = e.pattern[e.pi++ % e.pattern.length];
      const it = { kind: tpl.kind, turns: tpl.wait };
      if (tpl.kind === 'drop') {
        it.shape = rng.pick(tpl.shapes);
        it.rot = rng.int(4);
        const xs = W.shapeCells(it.shape, it.rot).map((c) => c[0]);
        it.x = rng.range(-Math.min(...xs), BW - 1 - Math.max(...xs));
        if (has('hourglass')) it.turns++;
      }
      if (tpl.kind === 'rise') { it.rows = tpl.rows; it.hole = rng.int(BW); if (has('hourglass')) it.turns++; }
      if (tpl.kind === 'attack') it.dmg = Math.round(tpl.dmg * e.scale);
      if (tpl.kind === 'shield') it.amount = Math.round(tpl.amount * e.scale);
      return it;
    }
    function refill() { while (fight.intents.length < fight.enemy.slots) fight.intents.push(makeIntent()); }
    function dropPiece(it) {
      const p = W.piece(it.shape, W.SHAPES[it.shape].cells.map(() => ({ color: GARB, garbage: true })));
      p.rot = it.rot;
      p.x = it.x;
      p.y = -Math.min(...W.shapeCells(it.shape, it.rot).map((c) => c[1]));
      return p;
    }
    const attackDmg = (it) => Math.max(0, it.dmg - (has('anchor') ? 3 : 0));
    const INTENT = {
      drop: { icon: 'stone', color: C.bone },
      rise: { icon: 'up', color: C.ochre },
      shield: { icon: 'shield', color: C.iron },
      attack: { icon: 'sword', color: C.blood },
      freeze: { icon: 'snow', color: C.rime },
    };
    function intentText(it) {
      const cols = W.shapeCells(it.shape || 'M', it.rot || 0).map((c) => c[0] + (it.x || 0));
      switch (it.kind) {
        case 'drop': return `Hurls a ${it.shape} stone into column ${Math.min(...cols) + 1}`;
        case 'rise': return `Heaves up ${it.rows} row${it.rows > 1 ? 's' : ''} of rubble`;
        case 'shield': return `Guards for ${it.amount}`;
        case 'attack': return `Strikes for ${attackDmg(it)}${fight.block ? ` <span class="ss-ward">(ward takes ${Math.min(fight.block, attackDmg(it))})</span>` : ''}`;
        case 'freeze': return 'Freezes your next stone';
      }
      return '';
    }
    const intentValue = (it) => (it.kind === 'attack' ? attackDmg(it) : it.kind === 'shield' ? it.amount : it.kind === 'rise' ? '+' + it.rows : '');

    // In the well: only where hurled stones will land (under your piece), never over the spawn.
    function drawLandings(ctx) {
      if (!fight) return;
      for (const it of fight.intents) {
        if (it.kind !== 'drop') continue;
        const p = dropPiece(it);
        if (!board.fits(p)) continue;
        const gy = board.dropY(p), hot = it.turns <= 1;
        const cells = W.pieceCells(p, p.rot, p.x, gy).filter((c) => c.y >= 0);
        const pulse = hot ? 0.6 + 0.4 * Math.sin(en.t * 0.012) : 0.75;
        ctx.save();
        ctx.fillStyle = rgba(C.blood, hot ? 0.2 : 0.1);
        ctx.strokeStyle = rgba(C.blood, pulse);
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        for (const c of cells) {
          ctx.fillRect(c.x * s + 2, c.y * s + 2, s - 4, s - 4);
          ctx.strokeRect(c.x * s + 3, c.y * s + 3, s - 6, s - 6);
          ctx.beginPath();
          ctx.moveTo(c.x * s + 6, c.y * s + s - 6); ctx.lineTo(c.x * s + s - 6, c.y * s + 6);
          ctx.stroke();
        }
        ctx.restore();
        const cx = cells.reduce((a, c) => a + c.x, 0) / cells.length, cy = cells.reduce((a, c) => a + c.y, 0) / cells.length;
        W.text(ctx, it.turns, (cx + 0.5) * s, (cy + 0.5) * s, { size: Math.round(s * 0.7), color: hot ? '#ff8a7a' : C.bone, stroke: C.ink, strokeWidth: 4, font: FD, weight: 400 });
      }
    }
    function drawRise(ctx) {
      if (!fight) return;
      let stack = 0;
      for (const it of fight.intents) {
        if (it.kind !== 'rise') continue;
        const h = it.rows * s, top = BH * s - h, hot = it.turns <= 1;
        ctx.fillStyle = rgba(C.blood, hot ? 0.16 : 0.07);
        ctx.fillRect(0, top, view.W, h);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(it.hole * s, top, s, h);
        ctx.fillStyle = rgba(C.blood, hot ? 0.6 + 0.4 * Math.sin(en.t * 0.012) : 0.7);
        ctx.fillRect(0, top - 2, view.W, 2);
        const bx = view.W - s * 1.25, by = top - s * 0.62 - stack * s * 0.6;
        ctx.fillStyle = 'rgba(18,10,8,0.85)';
        ctx.fillRect(bx, by, s * 1.15, s * 0.52);
        glyph(ctx, 'up', bx + 2, by + s * 0.04, s * 0.44, { color: C.ochre, width: 2 });
        W.text(ctx, `${it.rows}·${it.turns}`, bx + s * 0.8, by + s * 0.27, { size: Math.round(s * 0.42), color: hot ? '#ff8a7a' : C.ochre, font: FD, weight: 400 });
        stack++;
      }
    }

    // ---------- your turn ----------
    function onPlace(cells) {
      const f = fight, c = f.cur, def = CARDS[c.id];
      f.cleared = 0;
      for (const x of cells) { delete x.block.glyph; delete x.block.frozen; }
      if (c.id === 'guard' || c.id === 'bulwark') gainBlock(c.id === 'guard' ? 5 : 9, cells);
      if (c.id === 'mend') heal(4, cells);
      if (c.id === 'scout') { f.scoutTurns = 3; sh.toast('The lantern shows 2 more stones'); }
      if (c.id === 'stall') { f.intents.forEach((it) => it.turns++); sh.toast('The foe hesitates. Every intent waits a turn.', 'good'); }
      if (c.id === 'venom') { f.enemy.poison += 4; sh.log(`Venom seeps in. <b>${f.enemy.poison}</b> turns of it now.`); }
      if (c.id === 'bomb') {
        let n = 0;
        for (const x of cells) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const b = board.get(x.x + dx, x.y + dy);
          if (b && b.garbage) { board.set(x.x + dx, x.y + dy, null); view.burst(x.x + dx + 0.5, x.y + dy + 0.5, C.ember, 5); view.burst(x.x + dx + 0.5, x.y + dy + 0.5, '#5a4a3e', 4); n++; }
        }
        if (n) { view.float(`Blast ${n}`, cells[0].x + 0.5, cells[0].y, C.gold); view.shake(8); A.rumble(); A.clang(0.6); }
      }
      if (c.id === 'drill') {
        const rows = [...new Set(cells.map((x) => x.y))].filter((y) => y >= 0 && board.cells[y].some((b) => b && b.garbage));
        if (rows.length) {
          chips(rows);
          view.shake(9);
          board.removeRows(rows);
          view.float(`Smashed ${rows.length}`, BW / 2, rows[0], C.gold);
          A.rumble(); A.clang(0.7);
        }
      }
      if (def.free) sh.log(`${def.name}. Quick enough that the foe does not stir.`);
    }
    function gainBlock(n, cells) {
      fight.block = Math.min(MAX_BLOCK, fight.block + n);
      if (cells) view.float(`+${n} ward`, cells[0].x + 0.5, cells[0].y, C.iron);
      A.clank();
    }
    function heal(n, cells) {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + n);
      if (run.hp > before) view.float(`+${run.hp - before} blood`, cells ? cells[0].x + 0.5 : BW / 2, cells ? cells[0].y : BH / 2, C.moss);
    }

    const STRIKE_LINE = ['A row tears loose and flies.', 'Two rows rip free.', 'Three rows crash home.', 'The whole wall takes flight.'];
    function strike(rows, rowBlocks) {
      const f = fight, c = f.cur, n = rows.length;
      const notes = [];
      let dmg = LINE_DMG[Math.min(4, n)] + Math.max(0, n - 4) * 10;
      f.cleared = n;
      const sharp = has('whetstone') ? 2 : 1;
      if (c.id === 'strike') { dmg += 6 * sharp; notes.push(`Strike +${6 * sharp}`); }
      if (c.id === 'heavy') { dmg += 12 * sharp; notes.push(`Heavy +${12 * sharp}`); }
      if (c.id === 'bash' && f.block) { dmg += f.block; notes.push(`Bash +${f.block}`); }
      if (c.id === 'cleave') { dmg *= 2; notes.push('Cleave ×2'); }
      if (has('spikes')) {
        const g = rowBlocks.flat().filter((b) => b && b.garbage).length;
        if (g) { dmg += 2 * g; notes.push(`Spikes +${2 * g}`); }
      }
      if (has('gauntlet') && f.streak > 0) { dmg += 3 * f.streak; notes.push(`Gauntlet +${3 * f.streak}`); }
      if (c.id === 'siphon') heal(3 * n);
      if (has('bloodstone') && n >= 2) heal(3);
      const dealt = hitEnemy(dmg, false, true);
      launchSlab(rows, rowBlocks, dmg, dealt);
      view.shake(3 + n * 2);
      sh.log(`${STRIKE_LINE[Math.min(3, n - 1)]} <b>${dmg}</b>${dealt < dmg ? `, its guard eats ${dmg - dealt}` : ''}.${notes.length ? ` <span class="ss-note">${notes.join(' · ')}</span>` : ''}`);
    }
    function hitEnemy(dmg, pierce, delayed) {
      const e = fight.enemy;
      let rest = dmg;
      if (!pierce && e.shield) { const a = Math.min(e.shield, rest); e.shield -= a; rest -= a; }
      e.hp = Math.max(0, e.hp - rest);
      if (delayed) en.hpHold = 1e9;
      else { en.flash = Math.max(en.flash, 0.7); if (e.hp <= 0) killFoe(); }
      paint();
      return rest;
    }
    function killFoe() {
      if (en.dying >= 0) return;
      en.dying = 0;
      bark('death');
      A.roar();
    }

    // ---------- the signature: the row flies up as a slab ----------
    function launchSlab(rows, rowBlocks, dmg, dealt) {
      const n = rows.length, d = DPR();
      const img = mk(BW * s * d, n * s * d), x = img.getContext('2d');
      x.scale(d, d);
      const colors = [];
      rowBlocks.forEach((row, i) => row.forEach((b, cx) => {
        if (!b) return;
        drawBlock(x, b, cx * s, i * s, s, cx, rows[i], {});
        colors.push(b.garbage ? '#5a4a3e' : b.color);
      }));
      x.strokeStyle = 'rgba(255,170,90,0.6)';
      x.lineWidth = 2;
      x.strokeRect(1, 1, BW * s - 2, n * s - 2);
      const top = Math.min(...rows);
      fxs.slabs.push({ img, w: BW * s, h: n * s, x0: EW / 2, y0: EH + top * s + (n * s) / 2, t: 0, dur: 210 + n * 18, n, dmg, dealt, colors, rot: (Math.random() < 0.5 ? -1 : 1) * (0.1 + 0.05 * n) });
      A.heave();
    }
    function impact(sl) {
      const m = monCenter(), n = sl.n;
      hitStop = 80;
      frameShake = Math.max(frameShake, 7 + n * 3);
      view.shake(5 + n * 2);
      en.flash = 1;
      en.recoil = 1;
      en.hpHold = 0;
      A.clang(1.05 - n * 0.06);
      A.thud();
      if (n >= 3) A.rumble();
      for (let i = 0; i < 16 + n * 8; i++) {
        const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
        fxs.parts.push({ x: m.x + (Math.random() - 0.5) * 30, y: m.y + (Math.random() - 0.5) * 20, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: 500 + Math.random() * 500, max: 1000, size: 2 + Math.random() * 4, color: pick(sl.colors.length ? sl.colors : ['#6b5a4a']) });
      }
      for (let i = 0; i < 8 + n * 3; i++) fxs.parts.push({ x: m.x, y: m.y, vx: (Math.random() - 0.5) * 260, vy: -60 - Math.random() * 200, life: 600 + Math.random() * 400, max: 1000, size: 2 + Math.random() * 2, color: C.ember, glow: true });
      const blocked = sl.dmg - sl.dealt;
      fxs.nums.push({ text: sl.dealt > 0 ? String(sl.dealt) : 'Clang', sub: blocked > 0 ? `guard −${blocked}` : '', x: Math.min(EW - s * 1.3, m.x + s * 1.1), y: m.y - s * 0.35, t: 0, life: 1250, size: Math.round(s * (1.3 + n * 0.22)), color: sl.dealt > 0 ? C.gold : C.iron });
      if (fight && fight.enemy.hp <= 0) killFoe();
      else if (n >= 2 || Math.random() < 0.4) bark('hurt');
    }

    // ---------- foe turn ----------
    function endTurn() {
      const f = fight;
      if (!f || f.over) return false;
      if (f.enemy.hp <= 0) { winFight(); return false; }
      f.streak = f.cleared ? f.streak + 1 : 0;
      if (CARDS[f.cur.id].free) { paint(); return true; }
      f.turn++;
      paint();
      later(() => {
        if (f !== fight || f.over) return;
        enemyTurn();
        if (f.over) return;
        if (f.enemy.hp <= 0) { winFight(); return; }
        st.spawn();
        paint();
      }, 260);
      return false;
    }
    function enemyTurn() {
      const f = fight, e = f.enemy;
      if (e.poison > 0) {
        e.poison--;
        hitEnemy(3, true);
        const m = monCenter();
        fxs.nums.push({ text: '3', sub: 'venom', x: m.x + s * 0.8, y: m.y, t: 0, life: 900, size: Math.round(s * 0.8), color: C.moss });
        sh.log('Venom gnaws at it. <b>3</b>.');
        if (e.hp <= 0) return;
      }
      if (f.scoutTurns > 0) f.scoutTurns--;
      f.intents.forEach((it) => it.turns--);
      const firing = f.intents.filter((it) => it.turns <= 0);
      f.intents = f.intents.filter((it) => it.turns > 0);
      for (const it of firing) {
        fire(it);
        if (f.over) return;
      }
      // rubble can complete a row on its own; it crumbles quietly
      const full = board.fullRows();
      if (full.length) { chips(full); board.removeRows(full); }
      refill();
    }
    function fire(it) {
      const f = fight, name = f.enemy.name;
      if (it.kind === 'drop') {
        const p = dropPiece(it);
        if (!board.fits(p)) { defeat(`Buried under a hurled ${it.shape} stone`); return; }
        p.y = board.dropY(p);
        const cells = board.place(p);
        for (const c of cells) { view.burst(c.x + 0.5, c.y + 0.5, '#5a4a3e', 4); }
        view.shake(9);
        frameShake = Math.max(frameShake, 4);
        A.thud(); A.rumble();
        en.lunge = Math.max(en.lunge, 0.5);
        sh.log(`${name} hurls a stone into your pit.`);
      } else if (it.kind === 'rise') {
        for (let i = 0; i < it.rows; i++) {
          if (board.garbageRow(it.hole, { color: GARB, garbage: true })) { defeat('The rubble rose over your head'); return; }
        }
        view.shake(11);
        frameShake = Math.max(frameShake, 6);
        A.rumble(); A.grind();
        sh.log(`The floor heaves. ${it.rows === 1 ? 'A row' : it.rows + ' rows'} of rubble rise.`);
      } else if (it.kind === 'shield') {
        f.enemy.shield += it.amount;
        A.clank();
        bark('shield');
        sh.log(`${name} hides behind <b>${it.amount}</b> guard.`);
      } else if (it.kind === 'attack') {
        const dmg = attackDmg(it);
        const a = Math.min(f.block, dmg);
        f.block -= a;
        run.hp = Math.max(0, run.hp - (dmg - a));
        if (a && has('thorns')) { hitEnemy(a); sh.log(`Thorn Mail bites back for <b>${a}</b>.`); }
        en.lunge = 1;
        A.roar();
        bark('attack');
        if (dmg - a) { fxs.red = 1; frameShake = Math.max(frameShake, 10); A.bad(); } else A.clank();
        view.float(dmg - a ? `−${dmg - a}` : 'Warded', BW / 2, BH / 2, dmg - a ? C.blood : C.iron, Math.round(s * 1.1));
        view.shake(dmg - a ? 12 : 4);
        sh.log(`${name} strikes for <b>${dmg}</b>.${a ? ` Your ward takes ${a}.` : ''}`);
        if (run.hp <= 0) { defeat(`Slain by ${name}`); return; }
      } else if (it.kind === 'freeze') {
        f.freezeNext = true;
        A.frost();
        bark('freeze');
        sh.toast('Frost seals your next stone', 'bad');
        sh.log('Frost creeps over your next stone. It will not turn.');
      }
    }

    // ---------- side panels ----------
    const toneClass = (c) => (CARDS[c.id].tone ? `ss-t-${CARDS[c.id].tone}` : 'ss-t-plain');
    function cardRow(c, big) {
      const d = CARDS[c.id];
      return `<div class="ss-card${big ? ' big' : ''}" data-card="${c.uid}"><span data-mini></span><span class="ss-card-txt"><b class="${toneClass(c)}">${W.esc(cardName(c))}</b>${big || c.id !== 'plain' ? `<br><span class="ss-desc">${W.esc(d.desc)}</span>` : ''}</span></div>`;
    }
    function paint() {
      if (!run) return;
      const f = fight;
      sh.hud([
        { label: 'Blood', html: `${run.hp}<small> / ${run.maxHp}</small>`, tone: run.hp <= run.maxHp * 0.3 ? 'bad' : 'good' },
        { label: 'Ward', value: f ? f.block : 0, tone: f && f.block ? 'accent' : '' },
        { label: 'Turn', value: f ? f.turn : '–' },
        { label: 'Satchel', value: run.deck.length + ' stones' },
      ]);
      if (f) {
        const e = f.enemy;
        enemyPanel.innerHTML = `<h3>${e.boss ? 'The throne' : e.elite ? 'Elite foe' : 'The foe'}</h3>
          <div class="ss-foe-name"><b>${W.esc(e.name)}</b>${e.shield ? `<span class="chip ss-chip-iron">${icon('shield', C.iron, 14)} guard ${e.shield}</span>` : ''}${e.poison ? `<span class="chip ss-chip-moss">${icon('drop', C.moss, 14)} venom ${e.poison}</span>` : ''}</div>
          <p class="ss-desc">${W.esc(e.desc)}</p>
          <div class="ss-intents">${f.intents.slice().sort((a, b) => a.turns - b.turns).map((it) => `<div class="ss-intent${it.turns <= 1 ? ' hot' : ''}">
            <span class="ss-count">${it.turns}</span>${icon(INTENT[it.kind].icon, INTENT[it.kind].color, 20)}
            <span>${intentText(it)} <span class="ss-when">${it.turns <= 1 ? 'next turn' : `in ${it.turns} turns`}</span></span></div>`).join('')}</div>`;
        const n = visible();
        cardPanel.innerHTML = `<h3>In hand${st.active && st.active.frozen ? ' · <span class="ss-frozen">frozen</span>' : ''}</h3>${f.cur ? cardRow(f.cur, true) : ''}<h3>Next ${n} from the satchel</h3><div class="ss-next">${f.upcoming.slice(0, n).map((c) => cardRow(c)).join('')}</div>`;
        const slots = cardPanel.querySelectorAll('[data-mini]');
        const cs = [f.cur].concat(f.upcoming.slice(0, n)).filter(Boolean);
        slots.forEach((el, i) => el.appendChild(W.mini(toPiece(cs[i]), i === 0 ? 15 : 12, { drawBlock })));
      }
      runPanel.innerHTML = `<h3>The descent</h3><canvas class="ss-route"></canvas><h3>Relics</h3>${run.relics.length ? `<div class="chips">${run.relics.map((r) => `<span class="chip ss-relic" title="${W.esc(r.desc)}">${icon(r.icon, C.gold, 14)} ${W.esc(r.name)}</span>`).join('')}</div>` : '<p class="ss-desc">None yet. Elites and shrines hold relics.</p>'}`;
      const rc = runPanel.querySelector('.ss-route'), rw = 300, rh = 64, d = DPR();
      rc.width = rw * d; rc.height = rh * d;
      const rx = rc.getContext('2d');
      rx.scale(d, d);
      drawRoute(rx, rw, rh, run.map, run.step, run.picks, DARKROUTE);
    }

    // ---------- encounter canvas ----------
    function drawMonster(x, id, cx, by, alpha) {
      const sp = sprite(id), w = sp.w * monPx, h = sp.h * monPx;
      x.save();
      x.imageSmoothingEnabled = false;
      x.fillStyle = 'rgba(0,0,0,0.5)';
      x.beginPath(); x.ellipse(EW / 2, monBase + 1, w * 0.36, monPx * 2, 0, 0, Math.PI * 2); x.fill();
      if (en.dying >= 0) {
        const p = en.dying, ox = cx - w / 2, oy = by - h;
        for (const q of sp.px) {
          const k = Math.max(0, p - q.th) * 2.4;
          if (k >= 1) continue;
          x.globalAlpha = 1 - k;
          x.fillStyle = k > 0 ? (k < 0.3 ? C.ember : q.c) : q.c;
          x.fillRect(ox + q.x * monPx + q.vx * k * 14, oy + q.y * monPx + k * k * 70, monPx, monPx);
        }
        x.restore();
        return;
      }
      let sx = 1, sy = 1;
      if (id === 'gloop') { const q = Math.sin(en.t * 0.005); sx = 1 + q * 0.05; sy = 1 - q * 0.05; }
      const bob = id === 'gloop' ? 0 : Math.sin(en.t * (id === 'wisp' ? 0.004 : 0.003)) * monPx * (id === 'wisp' ? 1.6 : 0.8);
      const L = en.lunge, R = en.recoil;
      sx *= 1 + L * 0.16; sy *= 1 + L * 0.16;
      const rx = R > 0 ? Math.sin(R * 30) * R * monPx * 2.5 : 0;
      x.translate(cx + rx, by + bob + L * s * 0.3 - R * monPx * 3 + (1 - en.enter) * s * 1.4);
      x.scale(sx, sy);
      x.globalAlpha = alpha * en.enter;
      x.drawImage(sp.img, -w / 2, -h, w, h);
      if (en.flash > 0) { x.globalAlpha = Math.min(1, en.flash * 1.4); x.drawImage(sp.white, -w / 2, -h, w, h); }
      x.restore();
    }
    function coin(x, cx, cy, r, n, hot) {
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fillStyle = hot ? '#7a1a14' : '#2a201a'; x.fill();
      x.lineWidth = 1.5; x.strokeStyle = hot ? rgba('#ff6a50', 0.65 + 0.35 * Math.sin(en.t * 0.012)) : '#6a5640'; x.stroke();
      W.text(x, n, cx, cy + 1, { size: Math.round(r * 1.45), color: hot ? '#ffe2d0' : C.bone, font: FD, weight: 400 });
    }
    function drawEncounter() {
      const x = ex;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.drawImage(encBgC, 0, 0, EW, EH);
      x.globalAlpha = 0.7 + 0.15 * Math.sin(en.t * 0.011) + 0.08 * Math.sin(en.t * 0.037);
      x.drawImage(glowC, EW / 2 - EW * 0.7, -EH * 0.4, EW * 1.4, EH * 1.4);
      x.globalAlpha = 1;
      const f = fight;
      if (en.id) drawMonster(x, en.id, EW / 2, monBase, 1);
      if (f) {
        const e = f.enemy;
        // name plate + blood bar
        x.fillStyle = 'rgba(10,6,5,0.72)';
        x.fillRect(0, 0, EW, s * 0.95);
        W.text(x, e.name, 6, s * 0.38, { size: Math.round(s * 0.58), color: e.boss || e.elite ? C.gold : C.bone, font: FD, weight: 400, align: 'left' });
        const shownMain = en.hpHold > 0 ? en.hpShown : e.hp;
        W.text(x, `${Math.ceil(shownMain)}/${e.maxHp}`, EW - 6, s * 0.38, { size: Math.round(s * 0.5), color: '#ff8a7a', font: FD, weight: 400, align: 'right' });
        const bx = 6, by = s * 0.7, bw = EW - 12, bh = Math.max(4, Math.round(s * 0.16));
        x.fillStyle = '#2a0d0b'; x.fillRect(bx, by, bw, bh);
        x.fillStyle = C.ember; x.fillRect(bx, by, bw * Math.max(0, en.hpShown / e.maxHp), bh);
        x.fillStyle = C.blood; x.fillRect(bx, by, bw * Math.max(0, shownMain / e.maxHp), bh);
        x.fillStyle = 'rgba(255,220,200,0.25)'; x.fillRect(bx, by, bw * Math.max(0, shownMain / e.maxHp), 1);
        if (e.shield) { x.strokeStyle = C.iron; x.lineWidth = 2; x.strokeRect(bx - 1, by - 1, bw + 2, bh + 2); }
        // intents column
        f.intents.slice().sort((a, b) => a.turns - b.turns).forEach((it, i) => {
          const y = s * 1.12 + i * s * 0.9, hot = it.turns <= 1, def = INTENT[it.kind];
          x.fillStyle = hot ? 'rgba(60,10,8,0.7)' : 'rgba(10,6,5,0.6)';
          x.fillRect(2, y - 2, s * 1.95, s * 0.8);
          coin(x, s * 0.36, y + s * 0.36, s * 0.27, it.turns, hot);
          glyph(x, def.icon, s * 0.7, y + s * 0.06, s * 0.6, { color: def.color, width: Math.max(1.5, s * 0.07) });
          const v = intentValue(it);
          if (v !== '') W.text(x, v, s * 1.36, y + s * 0.38, { size: Math.round(s * 0.52), color: def.color, font: FD, weight: 400, align: 'left' });
        });
        // status column: guard, venom
        let sy = s * 1.12;
        const stat = (name, col, val) => {
          x.fillStyle = 'rgba(10,6,5,0.6)';
          x.fillRect(EW - s * 0.98, sy - 2, s * 0.96, s * 0.8);
          glyph(x, name, EW - s * 0.94, sy + s * 0.08, s * 0.52, { color: col, width: Math.max(1.5, s * 0.07) });
          W.text(x, val, EW - s * 0.2, sy + s * 0.38, { size: Math.round(s * 0.46), color: col, font: FD, weight: 400 });
          sy += s * 0.9;
        };
        if (e.shield) stat('shield', C.iron, e.shield);
        if (e.poison) stat('drop', C.moss, e.poison);
        // hurled stones, held over the lip above their columns
        let k = 0;
        for (const it of f.intents) {
          if (it.kind !== 'drop') continue;
          const cells = W.shapeCells(it.shape, it.rot).map(([a, b]) => [a + it.x, b]);
          const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
          const minC = Math.min(...xs), maxC = Math.max(...xs), minR = Math.min(...ys), maxR = Math.max(...ys);
          const m = Math.max(5, Math.round(s * 0.34)), cols = maxC - minC + 1, rows = maxR - minR + 1;
          const cx = ((minC + maxC + 1) / 2) * s, bottom = s * 4.66 - k * s * 0.42;
          const hot = it.turns <= 1, blocked = !board.fits(dropPiece(it));
          const sway = Math.sin(en.t * 0.004 + k) * 1.2;
          for (const [a, b] of cells) {
            const px = cx - (cols * m) / 2 + (a - minC) * m + sway, py = bottom - (rows - (b - minR)) * m;
            x.drawImage(blockTex({ garbage: true }, m, (a + b) % 3), px, py, m, m);
            if (hot || blocked) { x.strokeStyle = rgba(C.blood, 0.6 + 0.4 * Math.sin(en.t * 0.012)); x.lineWidth = 1.5; x.strokeRect(px + 0.5, py + 0.5, m - 1, m - 1); }
          }
          x.strokeStyle = 'rgba(120,100,80,0.5)'; x.lineWidth = 1;
          x.beginPath(); x.moveTo(cx + sway, bottom - rows * m); x.lineTo(cx, bottom - rows * m - s * 0.35); x.stroke();
          coin(x, cx + (cols * m) / 2 + s * 0.24 + sway, bottom - (rows * m) / 2, s * 0.2, blocked ? '!' : it.turns, hot || blocked);
          // chevrons on the lip mark the exact columns
          x.fillStyle = hot || blocked ? C.blood : C.ochre;
          for (const c of new Set(xs)) {
            const mx = (c + 0.5) * s, my = s * 4.78;
            x.beginPath(); x.moveTo(mx - s * 0.18, my); x.lineTo(mx + s * 0.18, my); x.lineTo(mx, my + s * 0.16); x.closePath(); x.fill();
          }
          k++;
        }
      } else if (!en.id) {
        W.text(x, run ? 'The way splits in the dark.' : 'Below the chapel, something waits.', EW / 2, EH * 0.45, { size: Math.round(s * 0.46), color: '#a8957c', font: FB, weight: 400 });
      }
      // bark bubble: beside the face, wrapped, so it never hides the monster's head
      if (en.bark) {
        const b = en.bark, fs = Math.round(s * 0.38), lh = fs + 2;
        x.font = `italic 700 ${fs}px ${FB}`;
        const sp = en.id ? sprite(en.id) : { w: 20, h: 20 };
        const mw = sp.w * monPx, mtop = monBase - sp.h * monPx;
        const left = Math.min(EW / 2 + mw * 0.3, EW - s * 2.6), maxW = EW - 4 - left - 10;
        const lines = [];
        for (const word of b.text.split(' ')) {
          const tryL = lines.length ? lines[lines.length - 1] + ' ' + word : word;
          if (lines.length && x.measureText(tryL).width <= maxW) lines[lines.length - 1] = tryL; else lines.push(word);
        }
        const bw = Math.min(EW - 8, Math.max(...lines.map((l) => x.measureText(l).width)) + 10), bh = lines.length * lh + 6;
        const bx = Math.max(4, Math.min(EW - 4 - bw, left + 6)), top = Math.max(s * 0.98, mtop - 2);
        x.globalAlpha = Math.min(1, b.life / 300);
        x.fillStyle = C.parch; x.strokeStyle = '#5a3d22'; x.lineWidth = 1.5;
        x.beginPath(); x.rect(bx, top, bw, bh); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(bx + 1, top + bh * 0.45); x.lineTo(bx - 7, top + bh * 0.75); x.lineTo(bx + 1, top + bh * 0.8); x.closePath(); x.fill();
        x.fillStyle = '#2a1a10';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        lines.forEach((l, i) => x.fillText(l, bx + bw / 2, top + 3 + lh * (i + 0.5) + 1));
        x.globalAlpha = 1;
      }
    }

    // ---------- fx canvas (spans encounter + well) ----------
    let fxLayout = '';
    function layoutFx() {
      const key = `${encC.offsetLeft},${encC.offsetTop},${encC.offsetWidth},${encC.offsetHeight},${sh.canvas.offsetHeight}`;
      if (key === fxLayout) return;
      fxLayout = key;
      fxC.style.left = encC.offsetLeft + 'px';
      fxC.style.top = encC.offsetTop + 'px';
      fxC.style.width = encC.offsetWidth + 'px';
      fxC.style.height = (encC.offsetHeight + sh.canvas.offsetHeight) + 'px';
    }
    let fxDirty = true;
    function updateFx(dt) {
      for (const sl of fxs.slabs) {
        sl.t += dt;
        const k = Math.min(1, sl.t / sl.dur), m = monCenter();
        const ex2 = sl.x0 + (m.x - sl.x0) * k * k, ey2 = sl.y0 + (m.y - sl.y0) * k * k;
        if (Math.random() < 0.8) fxs.parts.push({ x: ex2 + (Math.random() - 0.5) * sl.w * 0.8, y: ey2 + sl.h * 0.4, vx: (Math.random() - 0.5) * 40, vy: 30 + Math.random() * 40, life: 400, max: 400, size: 2 + Math.random() * 3, color: 'rgba(150,130,110,0.6)' });
        if (k >= 1 && !sl.hit) { sl.hit = true; impact(sl); }
      }
      fxs.slabs = fxs.slabs.filter((sl) => !sl.hit);
      for (const p of fxs.parts) { p.x += p.vx * dt / 1000; p.y += p.vy * dt / 1000; p.vy += (p.glow ? 200 : 700) * dt / 1000; p.life -= dt; }
      if (fxs.parts.length > 260) fxs.parts.splice(0, fxs.parts.length - 260);
      fxs.parts = fxs.parts.filter((p) => p.life > 0);
      for (const nm of fxs.nums) nm.t += dt;
      fxs.nums = fxs.nums.filter((nm) => nm.t < nm.life);
      fxs.red = Math.max(0, fxs.red - dt / 450);
    }
    function drawFx() {
      const busy = fxs.slabs.length || fxs.parts.length || fxs.nums.length || fxs.red > 0;
      if (!busy && !fxDirty) return;
      fxDirty = !!busy;
      const x = fx;
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.clearRect(0, 0, EW, EH + view.H);
      if (fxs.red > 0) {
        const g = x.createRadialGradient(EW / 2, EH + view.H / 2, view.H * 0.2, EW / 2, EH + view.H / 2, view.H * 0.7);
        g.addColorStop(0, 'rgba(160,10,10,0)'); g.addColorStop(1, `rgba(160,10,10,${0.55 * fxs.red})`);
        x.fillStyle = g; x.fillRect(0, EH, EW, view.H);
      }
      for (const sl of fxs.slabs) {
        const k = Math.min(1, sl.t / sl.dur), m = monCenter();
        const cx = sl.x0 + (m.x - sl.x0) * k * k, cy = sl.y0 + (m.y - sl.y0) * k * k - Math.sin(k * Math.PI) * s * 0.6;
        const sc = 1 - 0.5 * k;
        x.save();
        x.translate(cx, cy);
        x.rotate(sl.rot * k);
        x.scale(sc, sc);
        x.shadowColor = 'rgba(255,120,40,0.7)';
        x.shadowBlur = 16;
        x.drawImage(sl.img, -sl.w / 2, -sl.h / 2, sl.w, sl.h);
        x.restore();
      }
      for (const p of fxs.parts) {
        x.globalAlpha = Math.max(0, p.life / p.max);
        if (p.glow) { x.globalCompositeOperation = 'lighter'; x.fillStyle = C.ember; x.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); x.globalCompositeOperation = 'source-over'; }
        else { x.fillStyle = p.color; x.fillRect(p.x - p.size / 2, p.y - p.size / 3, p.size, p.size * 0.7); }
      }
      x.globalAlpha = 1;
      for (const nm of fxs.nums) {
        const k = nm.t / nm.life;
        const pop = nm.t < 140 ? 1.5 - (nm.t / 140) * 0.5 : 1;
        x.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
        const y = nm.y - k * s * 0.9;
        x.save();
        x.translate(nm.x, y);
        x.scale(pop, pop);
        W.text(x, nm.text, 0, 0, { size: nm.size, color: nm.color, stroke: C.ink, strokeWidth: Math.max(4, nm.size * 0.16), font: FD, weight: 400 });
        if (nm.sub) W.text(x, nm.sub, 0, nm.size * 0.62, { size: Math.round(s * 0.4), color: nm.color === C.moss ? C.moss : C.iron, stroke: C.ink, strokeWidth: 3, font: FB, weight: 700 });
        x.restore();
      }
      x.globalAlpha = 1;
    }

    // ---------- fights ----------
    function startFight(id) {
      const def = ENEMIES[id];
      const scale = scaleFor(id, run.step);
      const hp = Math.round(def.hp * scale);
      fight = {
        enemy: Object.assign({}, def, { id, hp, maxHp: hp, shield: 0, poison: 0, pi: 0, scale }),
        intents: [], turn: 1, block: has('ironskin') ? 8 : 0, over: false, cur: null, cleared: 0, streak: 0,
        upcoming: [], pile: rng.shuffle(run.deck.slice()), discard: [], scoutTurns: 0, freezeNext: false,
      };
      Object.assign(en, { id, flash: 0, recoil: 0, lunge: 0, enter: 0, dying: -1, hpShown: hp, hpHold: 0, bark: null });
      board.clear();
      st.reset();
      view.fx = [];
      view.texts = [];
      fill();
      refill();
      sh.log(`<b>${W.esc(def.name)}</b> ${def.enter}. ${hp} blood in it.`);
      later(() => { A.roar(); bark('start'); }, 250);
      st.spawn();
      paint();
    }
    function winFight() {
      const f = fight;
      if (f.over) return;
      f.over = true;
      st.paused = true;
      killFoe();
      view.float('Slain', BW / 2, BH / 2, C.gold, Math.round(s * 1.3));
      sh.log(`${f.enemy.name} is dead. It took ${f.turn} turn${f.turn > 1 ? 's' : ''}.`);
      run.path[run.step] = { kind: f.enemy.boss ? 'boss' : f.enemy.elite ? 'elite' : 'fight' };
      paint();
      later(() => W.sfx('win'), 350);
      later(() => {
        if (f.enemy.boss) { victory(); return; }
        cardReward(() => (f.enemy.elite ? relicReward(nextStep, "The elite's hoard: claim a relic") : nextStep()));
      }, 1100);
    }
    function defeat(why) {
      const f = fight;
      if (!f || f.over) return;
      f.over = true;
      st.paused = true;
      st.over = true;
      view.shake(16);
      frameShake = 14;
      fxs.red = 1;
      A.bad(); A.rumble();
      bark('attack');
      paint();
      sh.overlay({
        title: 'You join the dead',
        body: `<p>${W.esc(why)}, in chamber ${ROMAN[run.step]} of ${ROMAN[run.map.length - 1]}. ${W.esc(f.enemy.name)} still had ${f.enemy.hp} blood in it.</p><p class="ss-desc">Your satchel held ${run.deck.length} stones. Relics: ${run.relics.map((r) => r.name).join(', ') || 'none'}.</p>`,
        button: 'Descend again',
      }).then(newRun);
    }
    function victory() {
      sh.overlay({
        title: 'The crown is empty',
        body: `<p>The Hollow King comes apart like old masonry. You climb out with ${run.hp} of ${run.maxHp} blood and ${run.deck.length} stones in your satchel.</p><p class="ss-desc">Relics: ${run.relics.map((r) => r.name).join(', ') || 'none'}.</p>`,
        button: 'Descend again',
      }).then(newRun);
    }

    // ---------- map and rewards ----------
    // Six chambers. Chambers 1 and 3 are always fights, so a run cannot dodge combat entirely.
    function makeMap() {
      const n = rng.shuffle(NORMALS.slice());
      const calm = () => ({ kind: rng.pick(['rest', 'relic']) });
      return [
        [{ kind: 'fight', enemy: n[0] }, { kind: 'fight', enemy: n[1] }],
        [{ kind: 'fight', enemy: n[2] }, rng.chance(0.5) ? { kind: 'relic' } : { kind: 'rest' }],
        [{ kind: 'fight', enemy: n[3] }, { kind: 'elite', enemy: 'gargoyle' }],
        [{ kind: 'relic' }, { kind: 'rest' }],
        [rng.chance(0.5) ? { kind: 'elite', enemy: 'gargoyle' } : { kind: 'fight', enemy: n[0] }, calm()],
        [{ kind: 'boss', enemy: 'king' }],
      ];
    }
    function tileFor(o) {
      const e = o.enemy && ENEMIES[o.enemy];
      const t = W.el('button', 'tile ss-node', `<span class="ss-node-head">${icon(NODE[o.kind].icon, o.kind === 'boss' || o.kind === 'elite' ? '#9a1d14' : '#3a2414', 26)}<span><span class="t-cost">${NODE[o.kind].name}</span><span class="t-name">${e ? `${W.esc(e.name)} · ${Math.round(e.hp * scaleFor(o.enemy, run.step))} blood` : NODE[o.kind].name}</span></span></span><span class="t-desc">${e ? W.esc(e.desc) + ' ' : ''}${NODE[o.kind].desc}</span>`);
      t.type = 'button';
      return t;
    }
    function routeCanvas() {
      const cw = Math.max(280, Math.min(740, window.innerWidth - 72)), ch = cw < 480 ? 104 : 128, d = DPR();
      const c = W.el('canvas', 'ss-map');
      c.width = cw * d; c.height = ch * d;
      const x = c.getContext('2d');
      x.scale(d, d);
      drawRoute(x, cw, ch, run.map, run.step, run.picks, PARCH);
      return c;
    }
    function openMap() {
      paint();
      const body = W.el('div', 'modal-body');
      body.innerHTML = `<p class="ss-flav">Chamber ${ROMAN[run.step]} of ${ROMAN[run.map.length - 1]}. ${DEPTHS[run.step] || ''} You carry ${run.hp} of ${run.maxHp} blood.</p>`;
      body.appendChild(routeCanvas());
      const g = W.el('div', 'tiles');
      let close;
      run.map[run.step].forEach((o, i) => {
        const t = tileFor(o);
        t.addEventListener('click', () => { close(); enter(o, i); });
        g.appendChild(t);
      });
      body.appendChild(g);
      close = sh.modal({ title: 'The descent', body, wide: true, actions: [] });
    }
    function enter(o, i) {
      run.picks[run.step] = i;
      if (o.kind === 'rest') { run.path[run.step] = o; openRest(); }
      else if (o.kind === 'relic') { run.path[run.step] = o; A.bell(); relicReward(nextStep, 'Shrine: claim a relic'); }
      else startFight(o.enemy);
    }
    function nextStep() {
      fight = null;
      en.id = null;
      board.clear();
      run.step++;
      if (run.step >= run.map.length) victory(); else openMap();
    }
    function cardTile(c) {
      const t = W.el('button', 'tile ss-cardtile');
      t.type = 'button';
      t.appendChild(W.mini(toPiece(c), 15, { drawBlock }));
      t.insertAdjacentHTML('beforeend', `<span class="t-name ${toneClass(c)}">${W.esc(cardName(c))}</span><span class="t-desc">${W.esc(CARDS[c.id].desc)}</span>`);
      return t;
    }
    function cardReward(done) {
      const ids = rng.shuffle(REWARD_POOL.slice()).slice(0, 3);
      const body = W.el('div', 'modal-body');
      body.innerHTML = `<p class="ss-flav">Among the remains, three carved stones. Take one for your satchel (${run.deck.length} stones now).</p>`;
      const g = W.el('div', 'tiles');
      let close;
      ids.forEach((id) => {
        const c = card(id);
        const t = cardTile(c);
        t.addEventListener('click', () => { run.deck.push(c); W.sfx('buy'); sh.log(`Into the satchel: <b>${W.esc(cardName(c))}</b>.`); close(); done(); });
        g.appendChild(t);
      });
      body.appendChild(g);
      close = sh.modal({ title: 'Spoils', body, wide: true, actions: [{ label: 'Leave them', onClick: () => { close(); done(); return false; } }] });
    }
    function relicReward(done, title) {
      const owned = new Set(run.relics.map((r) => r.id));
      const offers = rng.shuffle(RELICS.filter((r) => !owned.has(r.id))).slice(0, 3);
      if (!offers.length) { done(); return; }
      const body = W.el('div', 'modal-body');
      body.innerHTML = '<p class="ss-flav">Three things glint in the dust. You can carry one.</p>';
      const g = W.el('div', 'tiles');
      let close;
      offers.forEach((r) => {
        const t = W.el('button', 'tile', `<span class="ss-node-head">${icon(r.icon, '#7a4e10', 26)}<span class="t-name">${W.esc(r.name)}</span></span><span class="t-desc">${W.esc(r.desc)}</span>`);
        t.type = 'button';
        t.addEventListener('click', () => { run.relics.push(r); W.sfx('buy'); sh.log(`You take the <b>${W.esc(r.name)}</b>.`); close(); paint(); done(); });
        g.appendChild(t);
      });
      body.appendChild(g);
      close = sh.modal({ title, body, wide: true, actions: [{ label: 'Leave them', onClick: () => { close(); done(); return false; } }] });
    }
    function openRest() {
      const body = W.el('div', 'modal-body');
      let close;
      const healAmt = Math.ceil(run.maxHp * 0.3);
      const render = (removing) => {
        body.innerHTML = '';
        if (!removing) {
          body.innerHTML = `<p class="ss-flav">A guttering fire in a side vault. You have ${run.hp} of ${run.maxHp} blood and ${run.deck.length} stones.</p>`;
          const g = W.el('div', 'tiles');
          const a = W.el('button', 'tile', `<span class="ss-node-head">${icon('fire', '#9a1d14', 26)}<span class="t-name">Rest: +${healAmt} blood</span></span><span class="t-desc">Bind your wounds. Restores 30% of your blood.</span>`);
          a.type = 'button';
          a.disabled = run.hp >= run.maxHp;
          a.addEventListener('click', () => { run.hp = Math.min(run.maxHp, run.hp + healAmt); A.bell(); sh.log(`You rest by the fire. <b>+${healAmt}</b> blood.`); close(); nextStep(); });
          const b = W.el('button', 'tile', `<span class="ss-node-head">${icon('burst', '#3a2414', 26)}<span class="t-name">Break a stone</span></span><span class="t-desc">Remove a card so better stones come up more often.</span>`);
          b.type = 'button';
          b.disabled = run.deck.length <= 7;
          b.addEventListener('click', () => render(true));
          g.append(a, b);
          body.appendChild(g);
          return;
        }
        body.appendChild(W.el('p', 'ss-flav', 'Which stone do you leave behind?'));
        const g = W.el('div', 'tiles');
        run.deck.forEach((c) => {
          const t = cardTile(c);
          t.addEventListener('click', () => { run.deck = run.deck.filter((d) => d.uid !== c.uid); A.clank(); sh.log(`You leave the <b>${W.esc(cardName(c))}</b> behind.`); close(); nextStep(); });
          g.appendChild(t);
        });
        body.appendChild(g);
      };
      render(false);
      close = sh.modal({ title: 'Campfire', body, wide: true, actions: [{ label: 'Press on', onClick: () => { close(); nextStep(); return false; } }] });
    }

    function newRun() {
      timers.forEach(clearTimeout);
      timers.clear();
      run = { hp: 50, maxHp: 50, deck: startDeck(), relics: [], step: 0, map: makeMap(), path: [], picks: [] };
      fight = null;
      en.id = null;
      en.bark = null;
      board.clear();
      st.reset();
      view.fx = [];
      view.texts = [];
      fxs.slabs = []; fxs.parts = []; fxs.nums = []; fxs.red = 0;
      sh.logEl.innerHTML = '';
      sh.log('You go down the chapel stair with a satchel of carved stones.');
      enemyPanel.innerHTML = '<h3>The foe</h3><p class="ss-desc">Nothing yet. Choose a path.</p>';
      cardPanel.innerHTML = '';
      openMap();
    }

    sh.debug = {
      board, st, view, en, fxs, getRun: () => run, getFight: () => fight,
      winFight: () => { fight.enemy.hp = 0; winFight(); },
      fight: (id) => startFight(id), rest: () => openRest(), defeat: (w) => defeat(w),
      // Fill the bottom n rows except column 0 and hand the player a vertical Heavy Strike I over it.
      prep(n = 3) {
        for (let y = BH - n; y < BH; y++) for (let x = 1; x < BW; x++) board.set(x, y, { color: PLAIN[W.TYPES[(x + y) % 7]], v: (x + y) % 3 });
        const c = card('heavy');
        fight.cur = c;
        const p = toPiece(c);
        st.spawn(p);
        st.rotate(1);
        while (st.move(-1));
        paint();
      },
    };
    sh.loop((dt) => {
      if (hitStop > 0) hitStop -= dt;
      else {
        st.update(dt);
        view.update(dt);
        en.t += dt;
        en.flash = Math.max(0, en.flash - dt / 160);
        en.recoil = Math.max(0, en.recoil - dt / 320);
        en.lunge = Math.max(0, en.lunge - dt / 380);
        en.enter = Math.min(1, en.enter + dt / 450);
        if (en.dying >= 0) { en.dying += dt / 1100; if (en.dying > 1.3) { en.dying = 1.3; } }
        if (en.hpHold > 0 && en.hpHold < 1e8) en.hpHold -= dt;
        if (fight && en.hpHold <= 0) en.hpShown += (fight.enemy.hp - en.hpShown) * Math.min(1, dt / 220);
        if (en.bark) { en.bark.life -= dt; if (en.bark.life <= 0) en.bark = null; }
        updateFx(dt);
        frameShake = Math.max(0, frameShake - dt / 28);
      }
      view.draw(st);
      drawEncounter();
      layoutFx();
      drawFx();
      const sf = sh.boardFrame.style;
      if (frameShake > 0.3) sf.transform = `translate(${((Math.random() - 0.5) * frameShake).toFixed(1)}px,${((Math.random() - 0.5) * frameShake).toFixed(1)}px)`;
      else if (sf.transform) sf.transform = '';
    });

    view.draw(st);
    sh.overlay({
      title: 'Into the Undercroft',
      body: `<p>Below the chapel, things wait in the dark. You carry a satchel of carved stones.</p>
        <ul><li>Nothing falls on its own. Every stone you set is one turn.</li>
        <li>Complete a row and it tears loose and flies at the foe: 1 row ${LINE_DMG[1]}, 2 rows ${LINE_DMG[2]}, 3 rows ${LINE_DMG[3]}, 4 rows ${LINE_DMG[4]}.</li>
        <li>Rune stones are cards. <span class="ss-t-atk">Red</span> strikes, <span class="ss-t-def">iron</span> wards, <span class="ss-t-util">gold</span> tricks, <span class="ss-t-heal">green</span> mends.</li>
        <li>The foe shows its next moves. Stones it will hurl hang over the pit's lip, and red outlines mark where they will land. Ward soaks up its blows.</li>
        <li>Fill the pit or bleed out and you join the dead. Six chambers. The Hollow King waits in the last.</li></ul>`,
      button: 'Descend',
    }).then(newRun);
  }

  class TurnStacker extends W.Stacker {
    rotate(dir) {
      if (this.active && this.active.frozen) {
        if (this.canAct() && this.onFrozen) this.onFrozen();
        return false;
      }
      return super.rotate(dir);
    }
  }
  function startDeck() {
    return ['I', 'O', 'S', 'Z', 'J', 'L', 'T'].map((t) => card('plain', t)).concat([card('strike'), card('guard'), card('drill')]);
  }

  // ---------- hub card key art ----------
  function art(ctx, w, h) {
    const draw = () => {
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      paintWall(ctx, w, h, 22, 11, 77, '#1d1410', '#22180f');
      const vg = ctx.createRadialGradient(w * 0.62, h * 0.4, 10, w * 0.62, h * 0.4, w * 0.6);
      vg.addColorStop(0, 'rgba(255,120,40,0.22)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
      // torches
      for (const tx of [14, w - 14]) {
        const g = ctx.createRadialGradient(tx, 26, 0, tx, 26, 34);
        g.addColorStop(0, 'rgba(255,170,70,0.55)'); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g; ctx.fillRect(tx - 34, 0, 68, 64);
        ctx.fillStyle = '#3a2a1e'; ctx.fillRect(tx - 2, 30, 4, 14);
        ctx.fillStyle = C.ember; ctx.beginPath(); ctx.moveTo(tx, 14); ctx.quadraticCurveTo(tx + 6, 24, tx, 31); ctx.quadraticCurveTo(tx - 6, 24, tx, 14); ctx.fill();
        ctx.fillStyle = '#ffe2a0'; ctx.beginPath(); ctx.moveTo(tx, 21); ctx.quadraticCurveTo(tx + 3, 26, tx, 30); ctx.quadraticCurveTo(tx - 3, 26, tx, 21); ctx.fill();
      }
      // the pit: a stack of carved stones with a torn-out row
      const cs = 12, px = 30, py = h - 8 * cs + 4;
      ctx.fillStyle = '#0a0605'; ctx.fillRect(px - 3, py - 3, 8 * cs + 6, 8 * cs + 3);
      const r = W.rng(5);
      const pal = [PLAIN.I, PLAIN.O, PLAIN.T, PLAIN.S, PLAIN.Z, PLAIN.J, PLAIN.L, TONE.atk, TONE.def, TONE.util];
      for (let y = 3; y < 8; y++) for (let x = 0; x < 8; x++) {
        if (y === 5) continue;
        if (y === 3 && (x < 2 || x > 5)) continue;
        if (y === 4 && x === 7) continue;
        ctx.drawImage(blockTex({ color: pal[r.int(pal.length)], garbage: y === 7 && x % 3 === 0 }, cs, (x + y) % 3), px + x * cs, py + y * cs, cs, cs);
      }
      ctx.fillStyle = 'rgba(255,138,42,0.6)'; ctx.fillRect(px, py + 5 * cs, 8 * cs, 1.5); ctx.fillRect(px, py + 6 * cs - 1.5, 8 * cs, 1.5);
      // the slab in flight
      ctx.save();
      ctx.translate(166, 64);
      ctx.rotate(-0.42);
      ctx.shadowColor = 'rgba(255,120,40,0.8)'; ctx.shadowBlur = 12;
      for (let x = 0; x < 8; x++) ctx.drawImage(blockTex({ color: x === 3 ? TONE.atk : pal[(x * 3) % 7], glyph: x === 3 ? 'sword' : null, tone: x === 3 ? 'atk' : null }, 10, x % 3), -40 + x * 10, -5, 10, 10);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,170,90,0.35)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(108 + i * 6, 98 - i * 4); ctx.lineTo(138 + i * 6, 82 - i * 4); ctx.stroke(); }
      // the foe, mid hit-flash
      const sp = sprite('king'), m = 3;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(232, 108, 30, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(sp.img, 232 - (sp.w * m) / 2, 108 - sp.h * m, sp.w * m, sp.h * m);
      ctx.globalAlpha = 0.18;
      ctx.drawImage(sp.white, 232 - (sp.w * m) / 2, 108 - sp.h * m, sp.w * m, sp.h * m);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 14 + r() * 26; ctx.fillStyle = i % 3 ? '#7a6a58' : C.ember; ctx.fillRect(214 + Math.cos(a) * d, 60 + Math.sin(a) * d, 3, 2); }
      W.text(ctx, '24', 206, 40, { size: 40, color: C.gold, stroke: C.ink, strokeWidth: 6, font: FD, weight: 400 });
      ctx.restore();
    };
    draw();
    if (document.fonts && document.fonts.load) document.fonts.load('40px "Pirata One"').then(draw, () => {});
  }

  W.register({
    id: 'stack-strike',
    num: 7,
    title: 'Stack & Strike',
    mix: 'Dungeon deckbuilder × falling stone',
    pitch: 'Turn-based fights in the Undercroft. Complete a row and it tears loose and flies at the monster. Read its intents, play rune stones, take relics, kill the Hollow King.',
    palette: [TONE.atk, TONE.def, TONE.util, TONE.heal, GARB],
    shell: { queue: false, hold: false, logTitle: 'Chronicle', keysHint: '← → shift · ↑ / Z turn · ↓ lower · Space sets the stone (ends your turn)' },
    art,
    mount,
  });
})();

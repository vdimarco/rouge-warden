const W = 420, H = 680;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;

export default function createGame(api) {
  const phase = api.rng() * Math.PI * 2;
  const objects = [
    { id: 'tree', name: 'Amber tree', x: 112, y: 324, age: 0, labels: ['Sapling', 'Canopy', 'Fallen'], color: '#ffce81' },
    { id: 'vine', name: 'Moon vine', x: 285, y: 267, age: 0, labels: ['Seed', 'Climber', 'Bridge'], color: '#aee8ba' },
    { id: 'spring', name: 'Glass spring', x: 108, y: 435, age: 0, labels: ['Ice', 'Flow', 'Dry'], color: '#8bdcfa' },
    { id: 'lily', name: 'River lily', x: 300, y: 412, age: 0, labels: ['Bud', 'Leaf', 'Bloom'], color: '#ffbbdc' },
  ];
  const garden = Math.floor(api.rng() * 4);
  const initialAges = [[0, 0, 0, 0], [1, 0, 0, 0], [0, 0, 2, 1], [0, 1, 0, 0]][garden];
  objects.forEach((o, i) => o.age = initialAges[i]);
  const checkpoints = [{ x: 54, y: 400 }, { x: 180, y: 374 }, { x: 273, y: 326 }, { x: 354, y: 211 }];
  const clues = [
    'Cross the water: use a fallen tree, or a lily leaf with flowing water.',
    'Reach the ledge: grow the vine, or a lily bloom with flowing water.',
    'Wake the haven: flowing water + tree canopy, or vine bridge + lily bloom.',
  ];
  let selected = 0, time = 0, budget = 8, spent = 0, checkpoint = 0, moving = false, travel = 0, done = false;
  let dragging = false, previewAge = null, flash = 0, message = clues[0], transition = null;
  const history = [];
  const particles = Array.from({ length: 24 }, () => ({ x: api.rng() * W, y: 100 + api.rng() * 400, p: api.rng() * Math.PI * 2 }));

  const current = () => objects[selected];
  const ready = () => {
    const [tree, vine, spring, lily] = objects.map(o => o.age);
    return [tree === 2 || (lily === 1 && spring === 1), vine >= 1 || (lily === 2 && spring === 1), (tree === 1 && spring === 1) || (vine === 2 && lily === 2)][checkpoint] || false;
  };
  function report() {
    api.metric(`${checkpoint}/3 crossings · ${budget} time left`);
    api.status(message);
  }
  function setAge(age) {
    if (done || moving || age === current().age) return;
    const cost = Math.abs(age - current().age);
    if (cost > budget) { message = 'Time is low. Tap UNDO to recover your last change.'; flash = 1; report(); return; }
    history.push({ ages: objects.map(o => o.age), budget, spent, checkpoint });
    const o = current();
    transition = { id: o.id, from: o.age, to: age, t: 0 };
    o.age = age; budget -= cost; spent += cost;
    api.tone(260 + age * 110 + selected * 31, 0.18, 'sine', 0.08);
    api.burst(o.x, o.y - 25, o.color, 16);
    message = ready() ? 'The route is ready. Tap WALK to move your traveller.' : clues[checkpoint];
    report();
  }
  function walk() {
    if (done || moving) return;
    if (!ready()) { message = clues[checkpoint]; flash = 1; api.tone(140, 0.12, 'triangle', 0.07); report(); return; }
    moving = true; travel = 0; message = 'Your changes made a path.';
    api.tone(520, 0.13, 'sine', 0.07); report();
  }
  function undo() {
    if (moving || done || !history.length) return;
    const old = history.pop();
    objects.forEach((o, i) => o.age = old.ages[i]);
    budget = old.budget; spent = old.spent; checkpoint = old.checkpoint;
    message = clues[checkpoint]; transition = null;
    api.tone(220, 0.14, 'sine', 0.08); report();
  }
  report();
  function round(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function txt(ctx, str, x, y, size = 12, color = '#fff4dc', align = 'center', weight = 500) {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.fillText(str, x, y);
  }
  function line(ctx, points, color, width) {
    ctx.beginPath(); ctx.moveTo(...points[0]); points.slice(1).forEach(p => ctx.lineTo(...p));
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function leaf(ctx, x, y, r, color, rotation = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }
  function drawTree(ctx, o) {
    const sway = Math.sin(time * 1.3 + phase) * 2;
    if (o.age === 2) {
      line(ctx, [[55, 381], [163, 372], [194, 378]], '#775039', 13);
      line(ctx, [[70, 377], [166, 369]], '#dfbd7b', 3);
      [80, 115, 148].forEach((x, i) => line(ctx, [[x, 378], [x + 6, 362 - i * 2]], '#8f6643', 4));
      leaf(ctx, 139, 361, 13, '#dda75c', 0.4);
      return;
    }
    const height = o.age === 1 ? 94 : 42;
    line(ctx, [[o.x, 366], [o.x - 2, 366 - height * 0.6], [o.x + sway, 366 - height]], '#765d49', o.age === 1 ? 12 : 6);
    line(ctx, [[o.x, 335], [o.x - 25, 316]], '#8e7955', 5);
    const spread = o.age === 1 ? 34 : 14;
    for (let i = 0; i < (o.age === 1 ? 11 : 4); i++) {
      const a = i * 2.399, r = Math.sqrt(i + 1) * spread * 0.37;
      leaf(ctx, o.x + Math.cos(a) * r + sway, 366 - height + Math.sin(a) * r * 0.65, o.age === 1 ? 22 : 12, ['#dfb95e', '#e8cc82', '#a9be72'][i % 3], a);
    }
  }
  function drawVine(ctx, o) {
    const age = o.age;
    if (!age) { leaf(ctx, 283, 335, 9, '#bbc48a', -0.5); leaf(ctx, 292, 333, 8, '#cceba7', 0.8); return; }
    ctx.beginPath(); ctx.moveTo(278, 344); ctx.bezierCurveTo(248, 305, 312, 275, 283, 237);
    if (age === 2) ctx.bezierCurveTo(289, 198, 330, 191, 360, 222);
    ctx.strokeStyle = '#659879'; ctx.lineWidth = 11; ctx.stroke(); ctx.strokeStyle = '#c8edbd'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 7; i++) leaf(ctx, 282 + Math.sin(i * 1.8) * 10, 330 - i * 14, 12, i % 2 ? '#8bc19b' : '#bad3a2', (i % 2 ? 1 : -1) * 0.6);
    if (age === 2) [300, 320, 340].forEach(x => { leaf(ctx, x, 207 - Math.sin(x) * 3, 10, '#daeed0', 0.3); });
  }
  function drawSpring(ctx, o) {
    const col = ['#b1e4ef', '#75d5e9', '#917d68'][o.age];
    leaf(ctx, 108, 438, 40, '#203d4a'); leaf(ctx, 108, 434, 34, col);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(108, 433, 14 + i * 7 + (o.age === 1 ? Math.sin(time * 2 + i) * 3 : 0), 3 + i * 3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = o.age === 2 ? '#b6a181' : '#e9fbf5'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (o.age === 0) line(ctx, [[88, 429], [103, 441], [122, 426]], '#f1fcff', 2);
  }
  function drawLily(ctx, o) {
    const [x, y] = [o.x, o.y];
    if (o.age >= 1) { leaf(ctx, x, y + 7, 36, '#527d70'); leaf(ctx, x, y + 4, 32, '#9ebf8d'); line(ctx, [[x - 25, y + 4], [x + 22, y + 4]], '#c5d9a9', 1); }
    line(ctx, [[x, y + 7], [x, y - (o.age === 2 ? 48 : 12)]], '#94b598', 4);
    if (o.age === 2) {
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; leaf(ctx, x + Math.cos(a) * 13, y - 48 + Math.sin(a) * 10, 16, i % 2 ? '#f8d6da' : '#e9a9cb', a); }
      leaf(ctx, x, y - 48, 9, '#fff0ba');
    } else leaf(ctx, x, y - 14, 9, '#dcb0c9', -1.2);
  }
  function draw(ctx) {
    ctx.save();
    const wash = ctx.createLinearGradient(0, 70, 0, 535); wash.addColorStop(0, 'rgba(16,26,39,.22)'); wash.addColorStop(1, 'rgba(16,30,36,.84)'); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);
    txt(ctx, 'A LITTLE TIME CAN OPEN A WORLD', 210, 91, 10, '#e3d9b5', 'center', 650);
    for (const p of particles) { ctx.globalAlpha = 0.24 + Math.sin(time + p.p) * 0.18; ctx.fillStyle = '#fff3a9'; ctx.beginPath(); ctx.arc(p.x + Math.sin(time * 0.2 + p.p) * 8, p.y, 1.5, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
    // Sloping islands establish three readable crossings.
    ctx.beginPath(); ctx.moveTo(-10, 376); ctx.quadraticCurveTo(52, 347, 94, 375); ctx.lineTo(95, 465); ctx.lineTo(-10, 491); ctx.fillStyle = '#3c5a50'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(151, 359); ctx.quadraticCurveTo(184, 345, 223, 360); ctx.lineTo(247, 474); ctx.lineTo(154, 490); ctx.fillStyle = '#4a6356'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(240, 313); ctx.quadraticCurveTo(280, 302, 321, 321); ctx.lineTo(337, 447); ctx.lineTo(253, 457); ctx.fillStyle = '#547061'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(323, 202); ctx.quadraticCurveTo(363, 182, 430, 204); ctx.lineTo(430, 447); ctx.lineTo(348, 429); ctx.fillStyle = '#3a5955'; ctx.fill();
    line(ctx, [[0, 378], [45, 368], [87, 379]], '#9cb28a', 5); line(ctx, [[155, 360], [187, 354], [219, 362]], '#bac19a', 5); line(ctx, [[243, 315], [280, 309], [317, 322]], '#a7c9a2', 5); line(ctx, [[329, 205], [365, 198], [420, 205]], '#c4d5ac', 5);
    if (objects[2].age === 1) {
      ctx.beginPath(); ctx.moveTo(115, 437); ctx.bezierCurveTo(199, 451, 236, 417, 333, 428); ctx.strokeStyle = 'rgba(139,229,247,.6)'; ctx.lineWidth = 10; ctx.stroke();
      for (let i = 0; i < 8; i++) { const x = 125 + ((time * 24 + i * 27) % 204); line(ctx, [[x, 434], [x + 7, 434]], '#d6ffff', 1); }
    }
    // The haven glows more brightly as its conditions become possible.
    const glow = ctx.createRadialGradient(359, 165, 0, 359, 165, 63); glow.addColorStop(0, 'rgba(255,228,148,.34)'); glow.addColorStop(1, 'rgba(255,228,148,0)'); ctx.fillStyle = glow; ctx.fillRect(297, 103, 124, 124);
    ctx.strokeStyle = '#dfcc9c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(343, 199); ctx.lineTo(343, 158); ctx.quadraticCurveTo(359, 127, 375, 158); ctx.lineTo(375, 199); ctx.stroke();
    txt(ctx, 'HAVEN', 359, 121, 9, '#f8e5b6', 'center', 700);
    drawTree(ctx, objects[0]); drawVine(ctx, objects[1]); drawSpring(ctx, objects[2]); drawLily(ctx, objects[3]);
    for (let i = 0; i < objects.length; i++) {
      const o = objects[i], chosen = i === selected;
      const bx = o.x - 44, by = o.y + (o.id === 'tree' ? 49 : o.id === 'vine' ? 81 : 38);
      round(ctx, bx, by, 88, 25, 12, chosen ? '#e9dbb9' : 'rgba(16,31,38,.86)', chosen ? '#fff0c5' : '#678279');
      txt(ctx, `${o.id.toUpperCase()} · ${o.age}`, o.x, by + 17, 10, chosen ? '#243b36' : '#e4e8d9', 'center', 700);
      if (chosen) { ctx.beginPath(); ctx.arc(o.x, o.y, 48 + Math.sin(time * 3) * 2, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,228,162,.42)'; ctx.lineWidth = 1; ctx.setLineDash([2, 7]); ctx.stroke(); ctx.setLineDash([]); }
    }
    const a = checkpoints[checkpoint], b = checkpoints[Math.min(3, checkpoint + 1)];
    const ease = travel * travel * (3 - 2 * travel);
    const px = moving ? mix(a.x, b.x, ease) : a.x;
    const py = (moving ? mix(a.y, b.y, ease) - Math.sin(travel * Math.PI) * 25 : a.y) - 17;
    ctx.shadowColor = '#fcecc2'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffebbd'; ctx.beginPath(); ctx.arc(px, py - 12, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(px, py - 8); ctx.lineTo(px - 8, py + 9); ctx.quadraticCurveTo(px, py + 13, px + 8, py + 9); ctx.closePath(); ctx.fillStyle = '#edc18a'; ctx.fill();
    line(ctx, [[px - 3, py + 9], [px - 4, py + 17]], '#fbe7c1', 2); line(ctx, [[px + 3, py + 9], [px + 4, py + 17]], '#fbe7c1', 2);
    // A single control panel fits comfortably above the phone safe area.
    round(ctx, 16, 515, 388, 150, 23, 'rgba(10,25,34,.94)', flash > 0 ? '#edc18a' : '#596d66');
    const o = current();
    txt(ctx, o.name, 34, 544, 17, o.color, 'left', 650);
    txt(ctx, `${budget} TIME`, 385, 543, 12, '#f6e6bb', 'right', 700);
    txt(ctx, 'Tap an object. Drag its age.', 34, 565, 11, '#b6c7bd', 'left');
    line(ctx, [[64, 596], [355, 596]], '#506862', 4);
    for (let i = 0; i < 3; i++) {
      const x = 64 + i * 145.5, active = i === (previewAge ?? o.age);
      ctx.beginPath(); ctx.arc(x, 596, active ? 12 : 7, 0, Math.PI * 2); ctx.fillStyle = active ? o.color : '#638078'; ctx.fill();
      if (active) { ctx.beginPath(); ctx.arc(x, 596, 17, 0, Math.PI * 2); ctx.strokeStyle = '#d6e2cb'; ctx.lineWidth = 1; ctx.stroke(); }
      txt(ctx, o.labels[i], x, 623, 11, active ? '#fff4d6' : '#b0c4ba', 'center', active ? 700 : 400);
    }
    round(ctx, 31, 635, 98, 23, 10, history.length ? '#293f45' : '#1b2d36'); txt(ctx, 'UNDO', 80, 651, 10, '#ccdbcf', 'center', 650);
    round(ctx, 239, 635, 148, 23, 10, ready() ? '#e8cd98' : '#304746'); txt(ctx, moving ? 'WALKING…' : ready() ? 'WALK →' : 'TRY ROUTE →', 313, 651, 10, ready() ? '#263d34' : '#d4e2d2', 'center', 750);
    if (transition && transition.t < 0.6) { const ob = objects.find(q => q.id === transition.id); ctx.globalAlpha = (1 - transition.t / 0.6) * 0.6; ctx.beginPath(); ctx.arc(ob.x, ob.y - 20, 12 + transition.t * 80, 0, Math.PI * 2); ctx.strokeStyle = ob.color; ctx.lineWidth = 2; ctx.stroke(); }
    ctx.restore();
  }
  return {
    update(dt) {
      if (done) return; time += dt; flash = Math.max(0, flash - dt); if (transition) transition.t += dt;
      if (moving) {
        travel = Math.min(1, travel + dt * 0.7);
        if (travel >= 1) {
          checkpoint++; moving = false; travel = 0;
          api.burst(checkpoints[checkpoint].x, checkpoints[checkpoint].y - 25, '#ffe7b3', 18);
          if (checkpoint === 3) { done = true; api.finish({ title: 'You brought the world to life', detail: `Three crossings opened using ${spent} time. Try a different route through the lily.`, score: 900 + budget * 100 }); }
          else { message = clues[checkpoint]; report(); }
        }
      }
    },
    draw,
    pointer(type, p) {
      if (done || moving) return;
      if (type === 'down') {
        if (p.y >= 633 && p.y <= 668) { if (p.x < 153) undo(); else if (p.x > 224) walk(); return; }
        if (p.y >= 575 && p.y <= 631) { dragging = true; previewAge = clamp(Math.round((p.x - 64) / 145.5), 0, 2); return; }
        let best = -1, distance = 82;
        objects.forEach((o, i) => { const d = Math.min(Math.hypot(p.x - o.x, p.y - o.y), Math.hypot(p.x - o.x, p.y - (o.y + (o.id === 'tree' ? 60 : o.id === 'vine' ? 92 : 50)))); if (d < distance) { best = i; distance = d; } });
        if (best >= 0) { selected = best; api.tone(310 + best * 50, 0.06, 'sine', 0.04); }
      } else if (type === 'move' && dragging) previewAge = clamp(Math.round((p.x - 64) / 145.5), 0, 2);
      else if (type === 'up' && dragging) { const age = clamp(Math.round((p.x - 64) / 145.5), 0, 2); dragging = false; previewAge = null; setAge(age); }
      else if (type === 'cancel') { dragging = false; previewAge = null; }
    },
    key(type, key) { if (type !== 'down') return; if ('1234'.includes(key)) selected = +key - 1; else if (key === 'ArrowLeft') setAge(Math.max(0, current().age - 1)); else if (key === 'ArrowRight') setAge(Math.min(2, current().age + 1)); else if (key === ' ' || key === 'Enter') walk(); else if (key.toLowerCase() === 'z') undo(); },
    getState: () => ({ game: 'season', garden, checkpoint, budget, spent, selected: current().id, moving, done, ready: ready(), objects: objects.map(o => ({ ...o })), controls: { ages: [{ x: 64, y: 596 }, { x: 209.5, y: 596 }, { x: 355, y: 596 }], walk: { x: 313, y: 646 }, undo: { x: 80, y: 646 } }, traveller: checkpoints[checkpoint], history: history.length }),
  };
}

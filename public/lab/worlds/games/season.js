const W = 420, H = 680;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

// Ages are listed as [tree, vine, spring, lily], and each object has three ages.
export const BUDGET = 8;
export const GOALS = ['Cross the stream.', 'Climb the ledge.', 'Reach the haven.'];
// Moving an age forward costs 1 time a stage. Moving it back costs 2 time a stage.
export const costOf = (from, to) => to > from ? to - from : 2 * (from - to);
// Each crossing opens in one of two ways, and each way needs two objects. Each seed picks two openers for each crossing.
export const OPENERS = [
  [
    { id: 'log', test: a => a[0] === 2 && a[2] !== 1, hint: 'a fallen tree over still water' },
    { id: 'pads', test: a => a[3] >= 1 && a[2] === 1, hint: 'lily leaves on flowing water' },
    { id: 'ice', test: a => a[2] === 0 && a[0] === 1, hint: 'ice in the shade of a canopy' },
    { id: 'stones', test: a => a[2] === 2 && a[3] === 0, hint: 'a dry stream and a lily bud' },
  ],
  [
    { id: 'ladder', test: a => a[1] === 1 && a[2] !== 0, hint: 'a climbing vine and no ice' },
    { id: 'bloom', test: a => a[3] === 2 && a[2] === 1, hint: 'a bloom on flowing water' },
    { id: 'branch', test: a => a[0] === 1 && a[1] === 0, hint: 'a canopy branch and a vine seed' },
  ],
  [
    { id: 'bridge', test: a => a[1] === 2 && a[0] !== 2, hint: 'a vine bridge and a standing tree' },
    { id: 'rainbow', test: a => a[2] === 1 && a[0] === 1, hint: 'a canopy over flowing water' },
    { id: 'lift', test: a => a[3] === 2 && a[1] >= 1, hint: 'a bloom on a climbing vine' },
  ],
];
// Knock-on rules. When you set object on[0] to age on[1], the rule also changes another object, at no cost.
export const EFFECTS = [
  { id: 'grow', on: [2, 1], text: 'Flowing water grows the lily a stage.', apply: a => { a[3] = Math.min(2, a[3] + 1); } },
  { id: 'shade', on: [0, 1], text: 'A canopy shades the spring to ice.', apply: a => { a[2] = 0; } },
  { id: 'dam', on: [0, 2], text: 'A falling tree dams the spring dry.', apply: a => { a[2] = 2; } },
  { id: 'feed', on: [3, 2], text: 'A bloom feeds the vine a stage.', apply: a => { a[1] = Math.min(2, a[1] + 1); } },
  { id: 'wilt', on: [2, 2], text: 'A dry spring wilts the lily to a bud.', apply: a => { a[3] = 0; } },
  { id: 'frost', on: [2, 0], text: 'Ice sends the vine back to a seed.', apply: a => { a[1] = 0; } },
];
// Two rules never share a garden when one could set off the other.
const CLASH = ['grow:feed', 'shade:frost', 'dam:wilt'];

// Set object i to age v, then apply the knock-on rules for that change.
export function change(ages, i, v, effects) {
  const a = [...ages]; a[i] = v;
  for (const e of effects) if (e.on[0] === i && e.on[1] === v) e.apply(a);
  return a;
}
// The least time that opens the crossings from `from` to the haven. A cheapest-first search over the 81 age states
// and the places the traveller can stand. `only` allows one opener for each crossing.
export function cheapest(ages, gates, effects, from = 0, only = null) {
  const key = (a, c) => ((a[0] * 3 + a[1]) * 3 + a[2]) * 3 + a[3] + c * 81;
  const best = new Map([[key(ages, from), 0]]), buckets = [[{ a: ages, c: from }]];
  for (let d = 0; d < buckets.length; d++) {
    for (const s of buckets[d] || []) {
      if (best.get(key(s.a, s.c)) < d) continue;
      if (s.c === 3) return d;
      const push = (a, c, cost) => { const k = key(a, c); if (!(best.get(k) <= cost)) { best.set(k, cost); (buckets[cost] ||= []).push({ a, c }); } };
      if (only ? only[s.c].test(s.a) : gates[s.c].some(g => g.test(s.a))) push(s.a, s.c + 1, d);
      for (let i = 0; i < 4; i++) for (let v = 0; v < 3; v++) if (v !== s.a[i]) push(change(s.a, i, v, effects), s.c, d + costOf(s.a[i], v));
    }
  }
  return Infinity;
}
// How many choices of one opener for each crossing finish within the budget.
export function ways(ages, gates, effects) {
  let n = 0;
  for (const a of gates[0]) for (const b of gates[1]) for (const c of gates[2]) if (cheapest(ages, gates, effects, 0, [a, b, c]) <= BUDGET) n++;
  return n;
}
// A garden from the seed: two openers for each crossing, one or two rules, and start ages. Keep it only if
// the stream starts closed, par is 4 to 6, a rule makes par cheaper, and at least two ways finish within the budget.
export function makeGarden(rng) {
  const pick = (list, n) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); };
  let garden = null;
  for (let tries = 1; tries <= 2000; tries++) {
    const gates = OPENERS.map(pool => pick(pool, 2)), effects = pick(EFFECTS, rng() < 0.5 ? 1 : 2), ages = [0, 1, 2, 3].map(() => Math.floor(rng() * 3));
    if (effects.length === 2 && CLASH.some(c => c === `${effects[0].id}:${effects[1].id}` || c === `${effects[1].id}:${effects[0].id}`)) continue;
    if (gates[0].some(g => g.test(ages))) continue;
    const par = cheapest(ages, gates, effects);
    if (par < 4 || par > 6 || cheapest(ages, gates, []) <= par) continue;
    garden = { ages, gates, effects, par, ways: ways(ages, gates, effects), tries };
    if (garden.ways >= 2) return garden;
  }
  return garden;
}
export const starsFor = (used, par) => used <= par ? 3 : used <= par + 2 ? 2 : 1;

export default function createGame(api) {
  const garden = makeGarden(api.rng), { gates, effects, par } = garden;
  const phase = api.rng() * Math.PI * 2;
  const objects = [
    { id: 'tree', name: 'Amber tree', x: 112, y: 324, age: 0, labels: ['Sapling', 'Canopy', 'Fallen'], color: '#ffce81' },
    { id: 'vine', name: 'Moon vine', x: 285, y: 267, age: 0, labels: ['Seed', 'Climber', 'Bridge'], color: '#aee8ba' },
    { id: 'spring', name: 'Glass spring', x: 108, y: 435, age: 0, labels: ['Ice', 'Flow', 'Dry'], color: '#8bdcfa' },
    { id: 'lily', name: 'River lily', x: 300, y: 412, age: 0, labels: ['Bud', 'Leaf', 'Bloom'], color: '#ffbbdc' },
  ];
  objects.forEach((o, i) => o.age = garden.ages[i]);
  const checkpoints = [{ x: 54, y: 400 }, { x: 180, y: 374 }, { x: 273, y: 326 }, { x: 354, y: 211 }];
  // A row of chips above the panel shows each object's age, left to right as in the scene. A tap on a chip selects it.
  const chips = [0, 2, 1, 3].map((i, k) => ({ i, x: 17 + k * 98.5, y: 470, w: 92, h: 26 }));
  let selected = 0, time = 0, budget = BUDGET, checkpoint = 0, moving = false, travel = 0, done = false, won = false, wake = 0;
  let dragging = false, previewAge = null, flash = 0, shake = 0, message = GOALS[0], transition = null, lastTick = null, said = false;
  const history = [], hints = [0, 0, 0], rings = [], popups = [], timers = [];
  // Notes that play a little later, on the game clock.
  const later = (t, fn) => timers.push({ t, fn });
  const particles = Array.from({ length: 24 }, () => ({ x: api.rng() * W, y: 100 + api.rng() * 400, p: api.rng() * Math.PI * 2 }));

  const current = () => objects[selected];
  const ages = () => objects.map(o => o.age);
  const scrubbing = () => dragging && previewAge !== null && previewAge !== current().age;
  // The ages the scene shows: during a drag, the selected object at the preview age, with its rules applied.
  const shown = () => scrubbing() ? change(ages(), selected, previewAge, effects) : ages();
  const open = (a, c = checkpoint) => c < 3 && gates[c].some(g => g.test(a));
  const ready = () => open(ages());
  const used = () => BUDGET - budget;
  const hintList = c => gates[c].slice(0, hints[c]).map(g => g.hint);
  const goal = () => {
    if (done) return won ? 'The haven is awake.' : 'The seasons ran out.';
    const h = hintList(checkpoint);
    return `${GOALS[checkpoint]}${h.length ? ` Hint: ${h.join(', or ')}.` : ''}`;
  };
  function report() {
    api.metric(`${checkpoint}/3 crossings · ${budget} time · par ${par}`);
    api.status(message);
  }
  const popup = (x, y, text, color) => popups.push({ x, y, text, color, t: 0 });
  const refuse = text => { message = text; flash = 1; api.tone(140, 0.12, 'triangle', 0.07); report(); };
  // The run ends early when no plan fits in the time left, from here or after any number of UNDOs.
  // An UNDO gives back the time of the change it undoes, less 1. HINT and UNDO costs stay paid after later UNDOs.
  function stuck() {
    if (done || cheapest(ages(), gates, effects, checkpoint) <= budget) return;
    for (let j = history.length - 1; j >= 0; j--) {
      const left = history[j].budget - (history.length - j);
      if (left < 0) break;
      if (cheapest(history[j].ages, gates, effects, checkpoint) <= left) { message = `${message} No plan fits the time left from here. Tap UNDO to go back.`; report(); return; }
    }
    done = true; message = 'The seasons ran out.';
    api.tone(196, 0.4, 'triangle', 0.07);
    api.finish({ score: 0, unit: 'stars', win: false, title: 'The seasons ran out', detail: `You opened ${checkpoint} of 3 crossings with ${BUDGET} time. Par was ${par}.` });
    report();
  }
  function setAge(age) {
    if (done || moving || age === current().age) return;
    const cost = costOf(current().age, age);
    if (cost > budget) { shake = 1; refuse(`That change costs ${cost} time, and you have ${budget}.`); return; }
    history.push({ ages: ages(), budget });
    const before = ages(), after = change(before, selected, age, effects), o = current();
    transition = { id: o.id, t: 0 };
    objects.forEach((x, i) => x.age = after[i]);
    budget -= cost;
    api.tone(260 + age * 110 + selected * 31, 0.18, 'sine', 0.08);
    api.burst(o.x, o.y - 25, o.color, 16);
    popup(292, 530, `−${cost}`, '#ffd29c');
    // A rule that fires rings its object, so the player sees the knock-on.
    objects.forEach((x, i) => { if (i !== selected && before[i] !== after[i]) { rings.push({ i, t: 0 }); later(0.12, () => api.tone(520 + i * 60, 0.22, 'triangle', 0.06)); api.burst(x.x, x.y - 20, x.color, 10); } });
    message = ready() ? 'The way is open. Tap WALK to cross.' : goal();
    report(); stuck();
  }
  function walk() {
    if (done || moving) return;
    if (!ready()) { shake = 1; refuse(`The way is still closed. ${goal()}`); return; }
    // WALK commits every change so far. UNDO cannot go back past it.
    history.length = 0; moving = true; travel = 0; message = 'Your changes made a path.';
    api.tone(520, 0.13, 'sine', 0.07); report();
    if (checkpoint === 2) api.tone(784, 0.5, 'sine', 0.04);
  }
  function undo() {
    if (moving || done) return;
    if (!history.length) { refuse('There is nothing to undo since your last walk.'); return; }
    if (history[history.length - 1].budget < 1) { refuse('UNDO costs 1 time, and you have none left.'); return; }
    const old = history.pop();
    objects.forEach((o, i) => o.age = old.ages[i]);
    budget = old.budget - 1; transition = null;
    history.forEach(h => h.budget -= 1);
    popup(292, 530, '−1', '#ffd29c');
    message = `Undone for 1 time. ${goal()}`;
    api.tone(220, 0.14, 'sine', 0.08); report(); stuck();
  }
  function hint() {
    if (moving || done) return;
    if (hints[checkpoint] >= gates[checkpoint].length) { refuse(`${goal()} There are no more hints here.`); return; }
    if (budget < 1) { refuse('A hint costs 1 time, and you have none left.'); return; }
    hints[checkpoint]++; budget -= 1;
    history.forEach(h => h.budget -= 1);
    popup(292, 530, '−1', '#ffd29c');
    message = goal();
    api.tone(660, 0.12, 'sine', 0.06); later(0.09, () => api.tone(880, 0.16, 'sine', 0.05));
    report(); stuck();
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
  // The tree. A fallen tree spans the stream only when the log is a way across. Otherwise it lies on the bank.
  function drawTree(ctx, o, age, spans) {
    const sway = Math.sin(time * 1.3 + phase) * 2;
    if (age === 2) {
      if (!spans) { line(ctx, [[8, 374], [70, 368], [90, 372]], '#775039', 12); line(ctx, [[16, 371], [72, 366]], '#dfbd7b', 3); leaf(ctx, 74, 360, 11, '#dda75c', 0.4); return; }
      line(ctx, [[55, 381], [163, 372], [194, 378]], '#775039', 13);
      line(ctx, [[70, 377], [166, 369]], '#dfbd7b', 3);
      [80, 115, 148].forEach((x, i) => line(ctx, [[x, 378], [x + 6, 362 - i * 2]], '#8f6643', 4));
      leaf(ctx, 139, 361, 13, '#dda75c', 0.4);
      return;
    }
    const height = age === 1 ? 94 : 42;
    line(ctx, [[o.x, 366], [o.x - 2, 366 - height * 0.6], [o.x + sway, 366 - height]], '#765d49', age === 1 ? 12 : 6);
    line(ctx, [[o.x, 335], [o.x - 25, 316]], '#8e7955', 5);
    const spread = age === 1 ? 34 : 14;
    for (let i = 0; i < (age === 1 ? 11 : 4); i++) {
      const a = i * 2.399, r = Math.sqrt(i + 1) * spread * 0.37;
      leaf(ctx, o.x + Math.cos(a) * r + sway, 366 - height + Math.sin(a) * r * 0.65, age === 1 ? 22 : 12, ['#dfb95e', '#e8cc82', '#a9be72'][i % 3], a);
    }
  }
  // The vine. A bridge vine reaches the haven only when the bridge is a way across. Otherwise it hangs short.
  function drawVine(ctx, o, age, reaches) {
    if (!age) { leaf(ctx, 283, 335, 9, '#bbc48a', -0.5); leaf(ctx, 292, 333, 8, '#cceba7', 0.8); return; }
    ctx.beginPath(); ctx.moveTo(278, 344); ctx.bezierCurveTo(248, 305, 312, 275, 283, 237);
    if (age === 2) { if (reaches) ctx.bezierCurveTo(289, 198, 330, 191, 360, 222); else ctx.bezierCurveTo(286, 214, 300, 206, 312, 214); }
    ctx.strokeStyle = '#659879'; ctx.lineWidth = 11; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#c8edbd'; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 7; i++) leaf(ctx, 282 + Math.sin(i * 1.8) * 10, 330 - i * 14, 12, i % 2 ? '#8bc19b' : '#bad3a2', (i % 2 ? 1 : -1) * 0.6);
    if (age === 2 && reaches) [300, 320, 340].forEach(x => { leaf(ctx, x, 207 - Math.sin(x) * 3, 10, '#daeed0', 0.3); });
  }
  function drawSpring(ctx, o, age) {
    const col = ['#b1e4ef', '#75d5e9', '#917d68'][age];
    leaf(ctx, 108, 438, 40, '#203d4a'); leaf(ctx, 108, 434, 34, col);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.ellipse(108, 433, 14 + i * 7 + (age === 1 ? Math.sin(time * 2 + i) * 3 : 0), 3 + i * 3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = age === 2 ? '#b6a181' : '#e9fbf5'; ctx.lineWidth = 1; ctx.stroke();
    }
    if (age === 0) line(ctx, [[88, 429], [103, 441], [122, 426]], '#f1fcff', 2);
  }
  function drawLily(ctx, o, age) {
    const [x, y] = [o.x, o.y];
    if (age >= 1) { leaf(ctx, x, y + 7, 36, '#527d70'); leaf(ctx, x, y + 4, 32, '#9ebf8d'); line(ctx, [[x - 25, y + 4], [x + 22, y + 4]], '#c5d9a9', 1); }
    line(ctx, [[x, y + 7], [x, y - (age === 2 ? 48 : 12)]], '#94b598', 4);
    if (age === 2) {
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; leaf(ctx, x + Math.cos(a) * 13, y - 48 + Math.sin(a) * 10, 16, i % 2 ? '#f8d6da' : '#e9a9cb', a); }
      leaf(ctx, x, y - 48, 9, '#fff0ba');
    } else leaf(ctx, x, y - 14, 9, '#dcb0c9', -1.2);
  }
  // The stream in the first gap shows the spring's age: running water, thin ice, or a dry bed.
  function drawStream(ctx, a) {
    ctx.beginPath(); ctx.moveTo(84, 388); ctx.lineTo(164, 380); ctx.lineTo(164, 476); ctx.lineTo(84, 476); ctx.closePath();
    ctx.fillStyle = ['#a9d9e6', '#3f8fae', '#6f5f4c'][a[2]]; ctx.fill();
    if (a[2] === 1) for (let i = 0; i < 6; i++) { const x = 88 + ((time * 26 + i * 15) % 72); line(ctx, [[x, 396 + (i % 3) * 9], [x + 8, 396 + (i % 3) * 9]], '#d6ffff', 1.5); }
    else if (a[2] === 0) { line(ctx, [[92, 396], [110, 404], [126, 398]], '#f4fdff', 1.5); line(ctx, [[130, 410], [146, 402], [158, 409]], '#f4fdff', 1.5); }
    else for (let i = 0; i < 5; i++) leaf(ctx, 94 + i * 15, 420 + (i % 2) * 8, 4, '#56493b');
  }
  // What opens each crossing, drawn in the gap the traveller crosses.
  const STRUCTURES = {
    log: ctx => { line(ctx, [[55, 381], [163, 372], [194, 378]], '#775039', 13); line(ctx, [[70, 377], [166, 369]], '#dfbd7b', 3); },
    pads: ctx => [[104, 396], [123, 390], [142, 395]].forEach(([x, y], i) => { const b = Math.sin(time * 2 + i) * 1.5; leaf(ctx, x, y + b, 12, '#557d69', 0.2 * i); leaf(ctx, x, y + b - 1, 10, '#a7d4a5', 0.2 * i); }),
    ice: ctx => { ctx.beginPath(); ctx.moveTo(84, 380); ctx.lineTo(162, 366); ctx.lineTo(164, 380); ctx.lineTo(86, 394); ctx.closePath(); ctx.fillStyle = '#e7f8ff'; ctx.fill(); line(ctx, [[96, 386], [112, 382], [120, 386]], '#a8d8ea', 1.5); line(ctx, [[130, 378], [146, 376]], '#a8d8ea', 1.5); },
    stones: ctx => [[102, 398], [122, 391], [143, 397]].forEach(([x, y]) => { leaf(ctx, x, y + 2, 11, '#4b4438'); leaf(ctx, x, y, 10, '#a49f8c'); leaf(ctx, x - 3, y - 2, 4, '#c9c4b0'); }),
    ladder: ctx => { ctx.beginPath(); ctx.moveTo(246, 316); ctx.bezierCurveTo(236, 330, 240, 348, 228, 364); ctx.strokeStyle = '#5f9375'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(); for (let i = 0; i < 4; i++) leaf(ctx, 238 + (i % 2 ? 7 : -6), 322 + i * 11, 7, i % 2 ? '#9fcf9f' : '#c3e4b2', (i % 2 ? 1 : -1) * 0.7); },
    bloom: ctx => { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; leaf(ctx, 234 + Math.cos(a) * 14, 352 + Math.sin(a) * 6, 13, i % 2 ? '#f8d6da' : '#e9a9cb', a); } leaf(ctx, 234, 350, 7, '#fff0ba'); },
    branch: ctx => { ctx.beginPath(); ctx.moveTo(146, 292); ctx.quadraticCurveTo(200, 286, 248, 318); ctx.strokeStyle = '#7a5f45'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke(); [176, 204, 228].forEach((x, i) => leaf(ctx, x, 284 + i * 7, 9, ['#dfb95e', '#a9be72', '#e8cc82'][i], 0.4)); },
    bridge: ctx => { ctx.beginPath(); ctx.moveTo(283, 237); ctx.bezierCurveTo(289, 198, 330, 191, 360, 222); ctx.strokeStyle = '#659879'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke(); },
    rainbow: ctx => ['#f7a3a3', '#f7d48a', '#a9e3a0', '#94d0f4', '#c6abf2'].forEach((c, i) => { ctx.beginPath(); ctx.moveTo(296 - i * 3, 322); ctx.quadraticCurveTo(300 - i * 3, 214 - i * 3, 352, 206 - i * 3); ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(); }),
    lift: ctx => { line(ctx, [[318, 322], [314, 286], [320, 252]], '#659879', 5); for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; leaf(ctx, 320 + Math.cos(a) * 12, 246 + Math.sin(a) * 5, 12, i % 2 ? '#f8d6da' : '#e9a9cb', a); } leaf(ctx, 320, 245, 6, '#fff0ba'); },
  };
  // Open ways are drawn in full. The ways that could open the current crossing show as faint ghosts.
  function drawGates(ctx, a, scrub) {
    for (let c = 0; c < 3; c++) for (const g of gates[c]) {
      const on = g.test(a);
      if (!on && (c !== checkpoint || done)) continue;
      ctx.save(); ctx.globalAlpha = !on ? 0.16 : scrub && !g.test(ages()) ? 0.62 : 1; STRUCTURES[g.id](ctx); ctx.restore();
    }
  }
  function drawHaven(ctx) {
    const k = won ? smooth(wake / 0.7) : 0, base = 0.2 + checkpoint * 0.1 + (moving && checkpoint === 2 ? travel * 0.25 : 0);
    if (k > 0) { ctx.fillStyle = `rgba(255,222,160,${0.16 * k})`; ctx.fillRect(0, 0, W, H); }
    const r = 63 + 110 * k, glow = ctx.createRadialGradient(359, 165, 0, 359, 165, r);
    glow.addColorStop(0, `rgba(255,228,148,${Math.min(0.9, base + 0.55 * k)})`); glow.addColorStop(1, 'rgba(255,228,148,0)');
    ctx.fillStyle = glow; ctx.fillRect(359 - r, 165 - r, r * 2, r * 2);
    if (k > 0) {
      ctx.save(); ctx.translate(359, 165); ctx.rotate(time * 0.4);
      for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = `rgba(255,240,190,${0.22 * k})`; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(150 * k, -3); ctx.lineTo(150 * k, 3); ctx.lineTo(0, 8); ctx.fill(); }
      ctx.restore();
      for (let i = 0; i < 18; i++) { const f = (wake * 0.6 + i / 18) % 1, x = 359 + Math.sin(i * 2.3 + wake) * 70 * f, y = 190 - f * 150; ctx.globalAlpha = (1 - f) * k; leaf(ctx, x, y, 3.5, i % 2 ? '#fff3a9' : '#ffd1e6', i); }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = k > 0 ? '#fff1c4' : '#dfcc9c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(343, 199); ctx.lineTo(343, 158); ctx.quadraticCurveTo(359, 127, 375, 158); ctx.lineTo(375, 199); ctx.stroke();
    if (k > 0) { ctx.fillStyle = `rgba(255,248,214,${0.85 * k})`; ctx.beginPath(); ctx.moveTo(346, 199); ctx.lineTo(346, 160); ctx.quadraticCurveTo(359, 134, 372, 160); ctx.lineTo(372, 199); ctx.fill(); }
    txt(ctx, 'HAVEN', 372, 248, 12, '#f8e5b6', 'center', 700);
  }
  function drawTraveller(ctx, a) {
    const from = checkpoints[checkpoint], to = checkpoints[Math.min(3, checkpoint + 1)];
    // A soft glow marks the way when the current crossing is open.
    if (!done && !moving && open(a)) { ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(time * 4) * 0.2; ctx.setLineDash([2, 8]); line(ctx, [[from.x, from.y - 6], [mix(from.x, to.x, 0.5), Math.min(from.y, to.y) - 34], [to.x, to.y - 6]], '#ffe9b0', 3); ctx.setLineDash([]); ctx.restore(); }
    const ease = travel * travel * (3 - 2 * travel);
    const px = moving ? mix(from.x, to.x, ease) : from.x;
    const py = (moving ? mix(from.y, to.y, ease) - Math.sin(travel * Math.PI) * 25 : from.y) - 17;
    ctx.shadowColor = '#fcecc2'; ctx.shadowBlur = 16; ctx.fillStyle = '#ffebbd'; ctx.beginPath(); ctx.arc(px, py - 12, 6, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(px, py - 8); ctx.lineTo(px - 8, py + 9); ctx.quadraticCurveTo(px, py + 13, px + 8, py + 9); ctx.closePath(); ctx.fillStyle = '#edc18a'; ctx.fill();
    line(ctx, [[px - 3, py + 9], [px - 4, py + 17]], '#fbe7c1', 2); line(ctx, [[px + 3, py + 9], [px + 4, py + 17]], '#fbe7c1', 2);
  }
  function drawPanel(ctx, a, scrub) {
    round(ctx, 16, 500, 388, 168, 23, 'rgba(10,25,34,.94)', flash > 0 ? '#edc18a' : '#596d66');
    const o = current();
    txt(ctx, o.name, 34, 528, 17, o.color, 'left', 650);
    txt(ctx, `${budget} TIME`, 386, 527, 15, budget <= 2 && !done ? '#ffb39c' : '#f6e6bb', 'right', 800);
    txt(ctx, `PAR ${par}`, 386, 545, 12, '#b6c7bd', 'right', 700);
    // Two lines of text: the goal and the hints, or during a drag, what the change costs and whether it opens the way.
    const cost = scrub ? costOf(o.age, previewAge) : 0, opens = scrub && open(a), h = done ? [] : hintList(checkpoint);
    let first = done ? goal() : GOALS[checkpoint], second = h[0] ? `Hint: ${h[0]}.` : '';
    if (h.length > 1) { first = `Hint: ${h[0]}.`; second = `Or: ${h[1]}.`; }
    if (scrub) first = cost > budget ? `Costs ${cost} time. You have ${budget}.` : `Costs ${cost} time. ${opens ? 'The way opens.' : 'The way stays closed.'}`;
    txt(ctx, first, 34, 551, 14, scrub ? (opens ? '#bff5c8' : cost > budget ? '#ffb39c' : '#f0d8b0') : h.length > 1 ? '#f0cc83' : '#e4ead9', 'left', 600);
    if (second) txt(ctx, second, 34, 571, 14, '#f0cc83', 'left', 600);
    line(ctx, [[64, 596], [355, 596]], '#506862', 4);
    for (let i = 0; i < 3; i++) {
      const x = 64 + i * 145.5, active = i === (previewAge ?? o.age), now = i === o.age;
      ctx.beginPath(); ctx.arc(x, 596, active ? 12 : 7, 0, Math.PI * 2); ctx.fillStyle = active ? o.color : '#638078'; ctx.fill();
      if (active) { ctx.beginPath(); ctx.arc(x, 596, 17, 0, Math.PI * 2); ctx.strokeStyle = '#d6e2cb'; ctx.lineWidth = 1; ctx.stroke(); }
      if (now && !active) { ctx.beginPath(); ctx.arc(x, 596, 12, 0, Math.PI * 2); ctx.strokeStyle = o.color; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]); }
      txt(ctx, o.labels[i], x, 621, 12, active ? '#fff4d6' : '#b0c4ba', 'center', active ? 700 : 500);
    }
    const canUndo = history.length && history[history.length - 1].budget >= 1 && !moving && !done, canHint = hints[checkpoint] < 2 && budget >= 1 && !moving && !done, lit = !done && (scrub ? opens : ready());
    round(ctx, 30, 632, 100, 26, 10, canUndo ? '#293f45' : '#1b2d36'); txt(ctx, 'UNDO −1', 80, 650, 12, canUndo ? '#ccdbcf' : '#71847c', 'center', 700);
    round(ctx, 160, 632, 100, 26, 10, canHint ? '#293f45' : '#1b2d36'); txt(ctx, 'HINT −1', 210, 650, 12, canHint ? '#ccdbcf' : '#71847c', 'center', 700);
    round(ctx, 290, 632, 100, 26, 10, lit ? '#e8cd98' : '#304746'); txt(ctx, done ? (won ? 'HOME' : 'DONE') : moving ? 'WALKING' : 'WALK →', 340, 650, 12, lit ? '#263d34' : '#d4e2d2', 'center', 800);
  }
  function draw(ctx) {
    ctx.save();
    if (shake > 0) ctx.translate(Math.sin(time * 70) * 3 * shake, 0);
    const a = shown(), scrub = scrubbing();
    const wash = ctx.createLinearGradient(0, 70, 0, 535); wash.addColorStop(0, 'rgba(16,26,39,.22)'); wash.addColorStop(1, 'rgba(16,30,36,.84)'); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);
    for (const p of particles) { ctx.globalAlpha = 0.24 + Math.sin(time + p.p) * 0.18; ctx.fillStyle = '#fff3a9'; ctx.beginPath(); ctx.arc(p.x + Math.sin(time * 0.2 + p.p) * 8, p.y, 1.5, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1;
    // The rules of this garden, at the top. They fade while the haven wakes.
    ctx.globalAlpha = won ? 1 - smooth(wake / 0.5) : 1;
    round(ctx, 14, 64, 392, 13 + effects.length * 21, 12, 'rgba(10,25,34,.76)');
    effects.forEach((e, i) => { txt(ctx, 'RULE', 26, 85 + i * 21, 12, '#f0cc83', 'left', 800); txt(ctx, e.text, 68, 85 + i * 21, 14, '#f6ecd2', 'left', 600); });
    ctx.globalAlpha = 1;
    drawStream(ctx, a);
    // Sloping islands with three gaps between them.
    ctx.beginPath(); ctx.moveTo(-10, 376); ctx.quadraticCurveTo(52, 347, 94, 375); ctx.lineTo(95, 465); ctx.lineTo(-10, 491); ctx.fillStyle = '#3c5a50'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(151, 359); ctx.quadraticCurveTo(184, 345, 223, 360); ctx.lineTo(247, 474); ctx.lineTo(154, 490); ctx.fillStyle = '#4a6356'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(240, 313); ctx.quadraticCurveTo(280, 302, 321, 321); ctx.lineTo(337, 447); ctx.lineTo(253, 457); ctx.fillStyle = '#547061'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(323, 202); ctx.quadraticCurveTo(363, 182, 430, 204); ctx.lineTo(430, 447); ctx.lineTo(348, 429); ctx.fillStyle = '#3a5955'; ctx.fill();
    line(ctx, [[0, 378], [45, 368], [87, 379]], '#9cb28a', 5); line(ctx, [[155, 360], [187, 354], [219, 362]], '#bac19a', 5); line(ctx, [[243, 315], [280, 309], [317, 322]], '#a7c9a2', 5); line(ctx, [[329, 205], [365, 198], [420, 205]], '#c4d5ac', 5);
    if (a[2] === 1) {
      ctx.beginPath(); ctx.moveTo(115, 437); ctx.bezierCurveTo(199, 451, 236, 417, 333, 428); ctx.strokeStyle = 'rgba(139,229,247,.6)'; ctx.lineWidth = 10; ctx.stroke();
      for (let i = 0; i < 8; i++) { const x = 125 + ((time * 24 + i * 27) % 204); line(ctx, [[x, 434], [x + 7, 434]], '#d6ffff', 1); }
    }
    drawHaven(ctx);
    drawGates(ctx, a, scrub);
    const log = gates[0].some(g => g.id === 'log' && g.test(a)), bridge = gates[2].some(g => g.id === 'bridge' && g.test(a));
    drawTree(ctx, objects[0], a[0], log); drawVine(ctx, objects[1], a[1], bridge); drawSpring(ctx, objects[2], a[2]); drawLily(ctx, objects[3], a[3]);
    { const o = current(); ctx.beginPath(); ctx.arc(o.x, o.y, 48 + Math.sin(time * 3) * 2, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,228,162,.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 7]); ctx.stroke(); ctx.setLineDash([]); }
    // A chip changed by a drag or by a rule has a gold edge.
    for (const c of chips) {
      const o = objects[c.i], chosen = c.i === selected, moved = a[c.i] !== o.age;
      round(ctx, c.x, c.y, c.w, c.h, 12, chosen ? '#e9dbb9' : moved ? 'rgba(60,52,30,.94)' : 'rgba(16,31,38,.9)', chosen ? '#fff0c5' : moved ? '#f0cc83' : '#678279');
      ctx.beginPath(); ctx.arc(c.x + 14, c.y + 13, 5, 0, Math.PI * 2); ctx.fillStyle = o.color; ctx.fill();
      txt(ctx, o.labels[a[c.i]].toUpperCase(), c.x + c.w / 2 + 7, c.y + 18, 12, chosen ? '#243b36' : '#e4e8d9', 'center', 700);
    }
    for (const r of rings) { const o = objects[r.i], k = r.t / 0.9; ctx.globalAlpha = (1 - k) * 0.9; ctx.beginPath(); ctx.arc(o.x, o.y - 20, 14 + k * 60, 0, Math.PI * 2); ctx.strokeStyle = '#f0cc83'; ctx.lineWidth = 3; ctx.stroke(); ctx.globalAlpha = 1; }
    if (transition && transition.t < 0.6) { const ob = objects.find(q => q.id === transition.id); ctx.globalAlpha = (1 - transition.t / 0.6) * 0.6; ctx.beginPath(); ctx.arc(ob.x, ob.y - 20, 12 + transition.t * 80, 0, Math.PI * 2); ctx.strokeStyle = ob.color; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1; }
    drawTraveller(ctx, a);
    drawPanel(ctx, a, scrub);
    for (const p of popups) { const k = p.t; ctx.globalAlpha = 1 - k * k; txt(ctx, p.text, p.x, p.y - k * 12, 16, p.color, 'center', 800); } ctx.globalAlpha = 1;
    ctx.restore();
  }
  const ageAt = x => clamp(Math.round((x - 64) / 145.5), 0, 2);
  function preview(age) {
    if (age === previewAge) return;
    previewAge = age;
    // A soft tick at each stage. A brighter tick when this stage opens the way.
    if (lastTick !== age) { lastTick = age; const opensNow = age !== current().age && open(change(ages(), selected, age, effects)); api.tone(opensNow ? 880 : 420 + age * 90, 0.05, 'sine', 0.045); }
  }
  return {
    update(dt) {
      if (!said) { said = true; api.status(message); }
      time += dt; flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt * 3); if (transition) transition.t += dt;
      for (let i = timers.length - 1; i >= 0; i--) if ((timers[i].t -= dt) <= 0) timers.splice(i, 1)[0].fn();
      for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].t += dt) > 0.9) rings.splice(i, 1);
      for (let i = popups.length - 1; i >= 0; i--) if ((popups[i].t += dt) > 1) popups.splice(i, 1);
      if (won) wake += dt;
      if (done || !moving) return;
      travel = Math.min(1, travel + dt * 0.7);
      if (travel < 1) return;
      checkpoint++; moving = false; travel = 0;
      api.burst(checkpoints[checkpoint].x, checkpoints[checkpoint].y - 25, '#ffe7b3', 18);
      if (checkpoint === 3) {
        // The haven wakes. The outro after the finish shows it.
        done = true; won = true; wake = 0;
        const stars = starsFor(used(), par), mark = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        message = 'The haven wakes.';
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => later(i * 0.08, () => api.tone(f, 0.6, 'sine', 0.07)));
        later(0.4, () => api.tone(1567.98, 0.7, 'sine', 0.04));
        api.burst(359, 170, '#fff1c4', 28);
        report();
        api.finish({ score: stars, unit: 'stars', win: true, title: 'The haven wakes', detail: `Used ${used()} time · par ${par} · ${mark}. ${used() > par ? `Use ${used() - par} less time to make par.` : 'You made par.'}` });
      } else { message = goal(); api.tone(620 + checkpoint * 80, 0.16, 'sine', 0.06); report(); stuck(); }
    },
    draw,
    pointer(type, p) {
      if (done || moving) { if (type === 'cancel' || type === 'up') { dragging = false; previewAge = null; lastTick = null; } return; }
      if (type === 'down') {
        if (p.y >= 628 && p.y <= 668) { if (p.x < 145) undo(); else if (p.x < 275) hint(); else walk(); return; }
        if (p.y >= 576 && p.y < 628) { dragging = true; lastTick = current().age; preview(ageAt(p.x)); return; }
        const chip = chips.find(c => p.x >= c.x - 3 && p.x <= c.x + c.w + 3 && p.y >= c.y - 4 && p.y <= c.y + c.h + 3);
        let best = chip ? chip.i : -1, distance = 82;
        if (!chip && p.y < 466) objects.forEach((o, i) => { const d = Math.hypot(p.x - o.x, p.y - o.y); if (d < distance) { best = i; distance = d; } });
        if (best >= 0) { selected = best; api.tone(310 + best * 50, 0.06, 'sine', 0.04); }
      } else if (type === 'move' && dragging) preview(ageAt(p.x));
      else if (type === 'up' && dragging) { const age = ageAt(p.x); dragging = false; previewAge = null; lastTick = null; setAge(age); }
      else if (type === 'cancel') { dragging = false; previewAge = null; lastTick = null; }
    },
    key(type, key) { if (type !== 'down') return; if ('1234'.includes(key)) selected = +key - 1; else if (key === 'ArrowLeft') setAge(Math.max(0, current().age - 1)); else if (key === 'ArrowRight') setAge(Math.min(2, current().age + 1)); else if (key === ' ' || key === 'Enter') walk(); else if (key.toLowerCase() === 'z') undo(); else if (key.toLowerCase() === 'h') hint(); },
    getState: () => ({
      game: 'season', checkpoint, budget, used: used(), par, ways: garden.ways, rules: effects.map(e => e.id), selected: current().id, moving, done, won, wake, ready: ready(),
      preview: scrubbing() ? { age: previewAge, ages: shown(), opens: open(shown()) } : null, hints: [...hints],
      objects: objects.map(o => ({ id: o.id, x: o.x, y: o.y, age: o.age, label: o.labels[o.age] })),
      controls: { ages: [{ x: 64, y: 596 }, { x: 209.5, y: 596 }, { x: 355, y: 596 }], undo: { x: 80, y: 645 }, hint: { x: 210, y: 645 }, walk: { x: 340, y: 645 }, chips: chips.map(c => ({ id: objects[c.i].id, x: c.x + c.w / 2, y: c.y + c.h / 2 })) },
      traveller: checkpoints[checkpoint], history: history.length,
    }),
    destroy() { timers.length = 0; },
  };
}

// The crossing simulation is independent of rendering so collisions and endings can be tested.
export const LENGTH = 72;
export const MAX_CHICKS = 8;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const chapter = t => t < 23 ? 'The quiet reeds' : t < 48 ? 'The boat channel' : 'The way home';

export function createRun() {
  return { elapsed: 0, x: .5, target: .5, history: [{t: 0, x: .5}], chicks: 0,
    rescued: 0, lost: 0, hearts: 3, call: 0, cooldown: 0, compact: 0,
    invincible: 0, objects: [], next: 0, events: [], ended: false, won: false };
}
// A repeatable route lets another attempt reward learning the bends.
const route = [
  [0, 'chick', .5], [4, 'rocks', .68], [6, 'chick', .28],
  [10, 'gate', .32], [12, 'chick', .72], [15, 'boat', .3],
  [20, 'gate', .7], [23, 'chick', .68], [26, 'boat', .72],
  [30, 'rocks', .28], [33, 'chick', .25], [36, 'boat', .28],
  [40, 'gate', .36], [43, 'chick', .72], [46, 'boat', .7],
  [50, 'gate', .68], [53, 'chick', .3], [56, 'rocks', .7],
  [59, 'chick', .65], [62, 'gate', .48]
];
export function birdPosition(r, i) {
  const at = r.elapsed - i * (.34 - r.compact * .23);
  let x = r.x;
  if (i) {
    x = r.history[0]?.x ?? .5;
    for (let j = r.history.length - 1; j >= 0; j--) {
      if (r.history[j].t <= at) { x = r.history[j].x; break; }
    }
  }
  return { x, y: .52 + (i ? (.075 - r.compact * .035) + (i - 1) * (.035 - r.compact * .017) : 0) };
}
export function callFlock(r) {
  if (r.ended || r.cooldown > 0) return false;
  r.call = 2.6; r.cooldown = 8;
  r.events.push({kind: 'call', text: 'Together! Hold tight through the wake.'});
  return true;
}
function spawn(r, type, x) {
  if (type === 'chick') r.objects.push({type, x, y: -.08});
  if (type === 'rocks') {
    r.objects.push({type: 'rock', x, y: -.1});
    r.objects.push({type: 'rock', x: clamp(x + .12, .12, .88), y: -.26});
  }
  if (type === 'gate') {
    for (const rx of [.14, .32, .5, .68, .86]) {
      if (Math.abs(rx - x) > .145) r.objects.push({type: 'rock', x: rx, y: -.12});
    }
  }
  if (type === 'boat') {
    r.objects.push({type, x: x < .5 ? -.2 : 1.2, direction: x < .5 ? 1 : -1,
      y: .2, age: 0, gap: x, launched: false});
    r.events.push({kind: 'warning', text: 'Boat coming! Find the calm gap or CALL.'});
  }
}
function hit(r, i, cause) {
  if (r.invincible > 0) return;
  if (r.chicks && i > 0) {
    r.chicks--; r.lost++;
    r.events.push({kind: 'hit', text: 'A chick swam ashore. Bring the others home!'});
  } else {
    r.hearts--;
    r.events.push({kind: 'hit', text: r.hearts ? (cause === 'wake' ? 'That wake stings! Find the gap or CALL.' : 'Ouch! Give the rocks more room.') : 'Time to rest on shore.'});
  }
  r.invincible = 1.8;
}
export function step(r, dt) {
  if (r.ended) return;
  dt = clamp(dt, 0, .05);
  r.elapsed = Math.min(LENGTH, r.elapsed + dt);
  r.call = Math.max(0, r.call - dt);
  r.cooldown = Math.max(0, r.cooldown - dt);
  r.invincible = Math.max(0, r.invincible - dt);
  r.compact += ((r.call > 0 ? 1 : 0) - r.compact) * Math.min(1, dt * 5);
  r.target = clamp(r.target, .1, .9);
  r.x += (r.target - r.x) * Math.min(1, dt * 7);
  r.history.push({t: r.elapsed, x: r.x});
  while (r.history.length > 1 && r.history[1].t < r.elapsed - 4) r.history.shift();
  while (r.next < route.length && route[r.next][0] <= r.elapsed) {
    const [, type, x] = route[r.next++]; spawn(r, type, x);
  }
  for (const o of r.objects) {
    if (o.type === 'boat') {
      o.age += dt;
      if (o.age > 1.8) o.x += o.direction * dt * .52;
      if (o.age > 2.6 && !o.launched) {
        o.launched = true;
        r.objects.push({type: 'wake', y: .23, gap: o.gap});
        r.objects.push({type: 'wake', y: .12, gap: o.gap});
      }
      continue;
    }
    o.y += dt * .16;
    if (o.type === 'chick') {
      if (!o.done && Math.abs(o.y - .52) < .045 && Math.abs(o.x - r.x) < .095) {
        o.done = true; r.chicks = Math.min(MAX_CHICKS, r.chicks + 1); r.rescued++;
        r.events.push({kind: 'rescue', text: r.chicks === 1 ? 'Your first little echo. Keep them close!' : `${r.chicks} chicks following. Leave room for the tail!`});
      }
    } else {
      for (let i = 0; i <= r.chicks; i++) {
        const b = birdPosition(r, i);
        const touching = Math.abs(o.y - b.y) < (o.type === 'wake' ? .019 : .035);
        const danger = o.type === 'wake' ? Math.abs(b.x - o.gap) > .16 && r.call <= 0 : Math.abs(b.x - o.x) < .067;
        if (touching && danger) { hit(r, i, o.type); break; }
      }
    }
  }
  r.objects = r.objects.filter(o => !o.done && (o.type === 'boat' ? o.age < 5.5 : o.y < 1.1));
  if (r.hearts <= 0 || r.elapsed >= LENGTH) {
    r.ended = true; r.won = r.hearts > 0;
    r.events.push({kind: 'end'});
  }
}

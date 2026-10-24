export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const wrap = n => ((n % 360) + 360) % 360;
export const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;
export const radians = n => n * Math.PI / 180;
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const bearing = (a, b) => wrap(Math.atan2(b.x - a.x, b.z - a.z) * 180 / Math.PI);
const knots = 0.514444;
const velocity = (heading, speed) => ({x: Math.sin(radians(heading)) * speed, z: Math.cos(radians(heading)) * speed});

export function intercept(origin, target, speed = 23) {
  const v = velocity(target.heading, target.speed * knots);
  const x = target.x - origin.x, z = target.z - origin.z;
  const a = v.x * v.x + v.z * v.z - speed * speed;
  const b = 2 * (x * v.x + z * v.z), c = x * x + z * z;
  let t;
  if (Math.abs(a) < 0.000001) t = b < 0 ? -c / b : -1;
  else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    t = Math.min(...[(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)].filter(n => n > 0));
  }
  if (!Number.isFinite(t) || t <= 0) return null;
  const aim = {x: target.x + v.x * t, z: target.z + v.z * t};
  return {heading: bearing(origin, aim), time: t, ...aim};
}

export function createGame(seed = 0) {
  const offset = ((seed % 5) - 2) * 70;
  const ships = [
    {id: 1, name: 'Merchant freighter', type: 'merchant', x: 750, z: 1200 + offset, heading: 270, speed: 6, tonnage: 4800, length: 130, hp: 1},
    {id: 2, name: 'Coastal freighter', type: 'merchant', x: 1360, z: 1620 + offset, heading: 270, speed: 6, tonnage: 6200, length: 150, hp: 1},
    {id: 3, name: 'Fleet tanker', type: 'tanker', x: 1950, z: 2050 + offset, heading: 270, speed: 6, tonnage: 8900, length: 180, hp: 2},
    {id: 4, name: 'Convoy destroyer', type: 'escort', x: -260, z: 1440 + offset, heading: 235, speed: 9, tonnage: 1800, length: 110, hp: 2}
  ].map(s => ({...s, sunk: false, sinking: 0, cooldown: 12}));
  return {
    phase: 'briefing', paused: false, time: 0, seed, rate: 4, station: 'command', periscopeRaised: false, armedTube: null,
    sub: {x: 0, z: 0, heading: 0, orderedHeading: 0, speed: 3, orderedSpeed: 3, depth: 12, orderedDepth: 12, hull: 100, battery: 100, air: 100},
    ships, selected: 1, viewBearing: bearing({x: 0, z: 0}, ships[0]), zoom: 1,
    solution: 0, tubes: [0, 0, 0, 0], ammo: 8, torpedoes: [], charges: [], effects: [],
    alert: 0, lastKnown: null, sunk: 0, tonnage: 0, escape: 0,
    log: [{time: 0, text: 'Convoy sighted. Identify a merchant and plan your attack.', kind: 'info'}],
    events: [], result: '', nextId: 1
  };
}

export const selectedShip = g => g.ships.find(s => s.id === g.selected);
export const isVisible = (g, s) => !s.sunk && g.periscopeRaised && g.sub.depth <= 16 && distance(g.sub, s) < 6500;
export function log(g, text, kind = 'info') {
  g.log.unshift({time: g.time, text, kind});
  g.log.length = Math.min(g.log.length, 30);
  g.events.push(kind);
}
export function selectContact(g, id) {
  const ship = g.ships.find(s => s.id === id && !s.sunk);
  if (!ship || (g.sub.depth > 16 && distance(g.sub, ship) > 5000)) return false;
  if (g.selected !== id) g.solution = 0;
  g.selected = id;
  g.viewBearing = bearing(g.sub, ship);
  return true;
}
export function fireStatus(g) {
  if (g.phase !== 'playing') return 'Patrol is not underway';
  if (g.paused) return 'Resume the patrol';
  if (g.sub.depth > 16) return 'Return to periscope depth';
  const ship = selectedShip(g);
  if (!ship || ship.sunk) return 'Select a contact';
  if (distance(g.sub, ship) > 5000) return 'Close to within 5,000 m';
  if (g.solution < 75) return 'Tracking contact…';
  if (g.ammo <= 0) return 'No torpedoes remaining';
  if (g.armedTube !== null && g.tubes[g.armedTube] > 0) return `Tube ${g.armedTube + 1} is reloading`;
  if (g.tubes.every(t => t > 0)) return 'Tubes reloading…';
  return '';
}
export function fire(g) {
  const reason = fireStatus(g);
  if (reason) return false;
  const target = selectedShip(g), aim = intercept(g.sub, target);
  if (!aim) return false;
  const tube = g.armedTube ?? g.tubes.findIndex(t => t <= 0);
  // shortcut: assisted fire control leads a constant-course target; manual plotting belongs in a longer simulation.
  g.torpedoes.push({id: g.nextId++, x: g.sub.x, z: g.sub.z, heading: aim.heading, speed: 23, life: 0, trail: []});
  g.tubes[tube] = 38;
  g.armedTube = null;
  g.ammo--;
  g.alert = clamp(g.alert + 14, 0, 100);
  log(g, `Tube ${tube + 1} away. Running ${Math.round(aim.time)} seconds to intercept.`, 'launch');
  return true;
}

export function command(g, action, value) {
  if (action === 'start') { if (g.phase === 'briefing') g.phase = 'playing'; return; }
  if (action === 'pause') { if (g.phase === 'playing') g.paused = !g.paused; return; }
  if (action === 'station' && ['command', 'scope', 'chart', 'torpedo', 'sonar'].includes(value)) {
    g.station = value;
    if (value === 'scope' && g.sub.depth <= 16) g.periscopeRaised = true;
    return;
  }
  if (g.phase !== 'playing' || g.paused) return;
  if (action === 'heading' && Number.isFinite(value)) g.sub.orderedHeading = wrap(g.sub.orderedHeading + value);
  if (action === 'course' && Number.isFinite(value)) g.sub.orderedHeading = wrap(value);
  if (action === 'speed' && [3, 7, 14].includes(value)) g.sub.orderedSpeed = value;
  if (action === 'depth' && [0, 12, 80].includes(value)) {
    g.sub.orderedDepth = value;
    if (value === 80) g.periscopeRaised = false;
    log(g, value === 80 ? 'Dive to 80 m. Keep speed low to break contact.' : value === 0 ? 'Blow ballast. Surface to replenish battery and air.' : 'Make periscope depth.');
  }
  if (action === 'periscope' && typeof value === 'boolean') g.periscopeRaised = value;
  if (action === 'tube' && Number.isInteger(value) && value >= 0 && value < 4) g.armedTube = value;
  if (action === 'rate' && [1, 4, 12].includes(value)) g.rate = value;
  if (action === 'fire') fire(g);
  if (action === 'next') {
    const contacts = g.ships.filter(s => !s.sunk);
    const index = contacts.findIndex(s => s.id === g.selected);
    if (contacts.length) selectContact(g, contacts[(index + 1) % contacts.length].id);
  }
}

function end(g, phase, result) {
  g.phase = phase;
  g.result = result;
  log(g, result, phase === 'won' ? 'success' : 'danger');
}

function tick(g, dt) {
  const sub = g.sub;
  g.time += dt;
  sub.heading = wrap(sub.heading + clamp(angleDiff(sub.orderedHeading, sub.heading), -3.5 * dt, 3.5 * dt));
  sub.speed += clamp(sub.orderedSpeed - sub.speed, -0.7 * dt, 0.5 * dt);
  sub.depth += clamp(sub.orderedDepth - sub.depth, -0.9 * dt, 1.6 * dt);
  const v = velocity(sub.heading, sub.speed * knots);
  sub.x += v.x * dt; sub.z += v.z * dt;
  sub.air = clamp(sub.air + (sub.depth < 2 ? 0.8 : -0.022) * dt, 0, 100);
  sub.battery = clamp(sub.battery + (sub.depth < 2 ? 0.6 : -(0.008 + sub.speed * sub.speed * 0.0006)) * dt, 0, 100);
  if (sub.battery <= 0) sub.orderedSpeed = 3;
  if (sub.air <= 0 || sub.battery <= 0) sub.hull = Math.max(0, sub.hull - 0.16 * dt);
  g.tubes = g.tubes.map(t => Math.max(0, t - dt));
  const target = selectedShip(g);
  if (target && isVisible(g, target) && Math.abs(angleDiff(bearing(sub, target), g.viewBearing)) < 40 / g.zoom) {
    g.solution = clamp(g.solution + dt * (sub.speed > 9 ? 2 : 6), 0, 100);
  } else g.solution = clamp(g.solution - dt * 2, 0, 100);

  const escorts = g.ships.filter(s => s.type === 'escort' && !s.sunk);
  let detected = false;
  for (const escort of escorts) {
    const d = distance(sub, escort);
    const detectionRange = sub.depth < 3 ? 2300 : sub.depth < 20 && g.periscopeRaised ? 1100 + sub.speed * 32 : 180 + sub.speed * 34;
    if (d < detectionRange) {
      detected = true;
      g.lastKnown = {x: sub.x, z: sub.z};
    }
    if (g.alert > 28 && g.lastKnown) {
      escort.heading = wrap(escort.heading + clamp(angleDiff(bearing(escort, g.lastKnown), escort.heading), -6 * dt, 6 * dt));
      escort.speed = 19;
    } else {escort.speed = 9;}
    escort.cooldown -= dt;
    if (g.lastKnown && g.alert > 35 && distance(escort, g.lastKnown) < 360 && escort.cooldown <= 0) {
      g.charges.push({id: g.nextId++, x: g.lastKnown.x, z: g.lastKnown.z, depth: 0, targetDepth: clamp(sub.depth, 18, 95), life: 0});
      escort.cooldown = 18;
      log(g, 'Depth charges in the water. Change course and go deep!', 'danger');
    }
  }
  const previousAlert = g.alert;
  g.alert = clamp(g.alert + (detected ? (sub.depth < 3 ? 7 : 4) : sub.depth >= 40 && sub.speed <= 5 ? -2.8 : -0.5) * dt, 0, 100);
  if (previousAlert < 35 && g.alert >= 35) log(g, 'Escort is investigating. Dive and run silent.', 'danger');
  for (const s of g.ships) {
    if (s.sunk) {s.sinking += dt; continue;}
    const movement = velocity(s.heading, s.speed * knots);
    s.x += movement.x * dt; s.z += movement.z * dt;
  }
  for (const torpedo of g.torpedoes) {
    const movement = velocity(torpedo.heading, torpedo.speed);
    torpedo.x += movement.x * dt; torpedo.z += movement.z * dt; torpedo.life += dt;
    if (!torpedo.trail.length || distance(torpedo, torpedo.trail[torpedo.trail.length - 1]) > 30) {
      torpedo.trail.push({x: torpedo.x, z: torpedo.z});
      if (torpedo.trail.length > 18) torpedo.trail.shift();
    }
    for (const ship of g.ships) {
      if (ship.sunk || torpedo.life > 240) continue;
      if (distance(torpedo, ship) < ship.length * 0.28 + 8) {
        torpedo.life = 999;
        ship.hp--;
        g.effects.push({x: ship.x, z: ship.z, life: 0, type: 'hit'});
        if (escorts.length) {g.alert = clamp(g.alert + 32, 0, 100); g.lastKnown = {x: sub.x, z: sub.z};}
        if (ship.hp <= 0) {
          ship.sunk = true;
          g.tonnage += ship.tonnage;
          if (ship.type !== 'escort') g.sunk++;
          log(g, `${ship.name} sunk. ${ship.tonnage.toLocaleString('en-US')} tons confirmed.`, 'hit');
          if (g.sunk === 2) log(g, 'Objective met. Dive to 80 m, run silent and break contact.', 'success');
        } else log(g, `${ship.name} hit. One more torpedo should finish it.`, 'hit');
        break;
      }
    }
  }
  g.torpedoes = g.torpedoes.filter(t => t.life <= 240);
  for (const charge of g.charges) {
    charge.life += dt;
    charge.depth += 5 * dt;
    if (charge.depth >= charge.targetDepth && !charge.exploded) {
      charge.exploded = true;
      const d = Math.hypot(distance(charge, sub), (charge.targetDepth - sub.depth) * 3);
      const damage = Math.round(Math.max(0, 38 * (1 - d / 160)));
      sub.hull = Math.max(0, sub.hull - damage);
      g.effects.push({x: charge.x, z: charge.z, life: 0, type: 'charge'});
      log(g, damage ? `Depth charge blast. Hull integrity ${Math.ceil(sub.hull)}%.` : 'Depth charge detonated clear. Keep moving.', 'blast');
    }
  }
  g.charges = g.charges.filter(c => !c.exploded);
  for (const effect of g.effects) effect.life += dt;
  g.effects = g.effects.filter(e => e.life < 10);
  if (g.sunk >= 2 && g.alert < 25 && sub.depth >= 40 && sub.speed <= 5 && escorts.every(s => distance(sub, s) > 500)) g.escape += dt;
  else g.escape = Math.max(0, g.escape - dt);
  if (sub.hull <= 0) end(g, 'lost', 'Your submarine was lost. The sea keeps its secrets.');
  else if (g.escape >= 40) end(g, 'won', 'Contact broken. Your crew is heading home.');
  else if (g.time >= 1080) end(g, 'lost', 'Dawn patrol has arrived. Your attack window is closed.');
  else if (g.ammo === 0 && !g.torpedoes.length && g.sunk < 2) end(g, 'lost', 'Torpedoes expended. The convoy escaped.');
}

export function step(g, seconds) {
  if (g.phase !== 'playing' || g.paused || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 10);
  while (remaining > 0 && g.phase === 'playing') {
    const dt = Math.min(remaining, 0.1);
    tick(g, dt);
    remaining -= dt;
  }
}

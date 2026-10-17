// Ahead of the Light: survival (final.md 7, 8, 9): the light's gap and time to catch, push-backs and the leg's cap,
// the light's states (far, pressed, warned, the glare) and the catch, hull and shield, fuel and pickups, the red zone,
// the gates' pay, the dock strip, the landing at Earth and the years. Every ship, rivals included, runs the same rules
// on its own gap: the light targets nobody. Handling (handle.js) moves the ship and emits what happened; this module
// reads those events once a step (race.js part 7) and settles the meters, then emits its own (18.5's survival group).
// Pure: no clocks, no Math.random. Per-ship and per-race bookkeeping lives in WeakMaps, so 18.2's shapes stay as they
// are and a step allocates nothing but its events.
import { TUNE } from './tune.js';
import { emit, E, runHooks } from './events.js';
import { CAPS, tunable, tuneUp, tuneDown } from './cards.js';
import { beatsPerS } from './ringmath.js';
import { skimOf } from './handle.js';

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const isOut = (s) => s.caught || s.wrecked;
const ENCKE_X = 1.6;                         // Saturn's ENCKE GAP: 0.8 s for a pair's 0.5 (11.5)
// An item's tag by id (items are in id order; else searched).
function tagOf(race, id) {
  const items = race.leg && race.leg.items;
  if (!items || !finite(id)) return null;
  const it = items[id] && items[id].id === id ? items[id] : items.find((x) => x.id === id);
  return it ? it.tag ?? null : null;
}
const PRESS_HYST = 0.5;          // s: 'pressed' ends only this far above TTC_LABEL, so the label does not flap

// The light's states (7.5), from far to close.
export const LIGHT_STATES = Object.freeze(['far', 'pressed', 'warned', 'glare']);

// Time to catch: gap ÷ (1 − β), with β = tanh η. 0 once the gap is gone.
export const ttcOf = (gap, eta) => (gap > 0 ? gap / Math.max(1e-12, 1 - Math.tanh(eta)) : 0);
// The gap that gives a time to catch at a speed (the inverse).
export const gapFor = (ttc, eta) => ttc * (1 - Math.tanh(eta));

// The leg's mass factor M (7.3), which scales every push-back.
export const massOf = (race, tune = TUNE) => {
  const k = tune.MASS_K;
  return k && finite(k[race.legNo]) ? k[race.legNo] : 1;
};

// The leg's cap on your gap: GAP_CAP[leg] plus STILL LIGHT's hold (at most +2 s, a new ship each leg clears it).
export function capOf(race, ship, tune = TUNE) {
  const caps = tune.GAP_CAP;
  const base = caps && finite(caps[race.legNo]) ? caps[race.legNo] : caps ? caps[caps.length - 1] : 8;
  return base + clamp(ship.lightHold || 0, 0, CAPS.STILL_LIGHT);
}

// ---------------------------------------------------------------- bookkeeping

const SHIPS = new WeakMap();
function scratch(ship) {
  let s = SHIPS.get(ship);
  if (!s) {
    s = { armed: true, glareAt: -1, peaked: false, lastHull: false, by: null, byT: -1e9, dust: -1 };
    SHIPS.set(ship, s);
  }
  return s;
}
const RACES = new WeakMap();
function raceScratch(race) {
  let r = RACES.get(race);
  if (!r) {
    r = { caption: false, glared: {}, patch: {} };
    RACES.set(race, r);
  }
  return r;
}

// What survival remembers about a ship this leg, for the renderer and the tests: { armed (the warn), glareAt (sim s
// it entered the glare, or −1), lastHull, fedBy (who last took it down or weaved it off), fedT }.
export function survivalOf(ship) {
  const s = scratch(ship);
  return { armed: s.armed, glareAt: s.glareAt, lastHull: s.lastHull, fedBy: s.by, fedT: s.byT };
}

// ---------------------------------------------------------------- push-backs (7.3)

// Push the light back: amount seconds (already × M), capped by the leg's cap. A red-zone release ('red') may lift the
// gap OVERCAP past the cap; that extra fades at OVERCAP_DECAY. Push-back the cap throws away speeds the shield's
// recharge (CAP_OVERFLOW_SHIELD a second lost, critic lead item 7). Emits `push { amount, from, lost }` for a gain
// you can see (not the skim's or a drafter's steady trickle). → the seconds actually gained.
export function pushBack(race, ship, kind, amount, tune = race.tune || TUNE) {
  const T = tune;
  if (!(amount > 0) || !ship || isOut(ship)) return 0;
  const cap = capOf(race, ship, T);
  const top = kind === 'red' ? cap + T.OVERCAP : cap;
  const before = ship.gap;
  const after = Math.max(before, Math.min(before + amount, top));
  ship.gap = after;
  const gained = after - before, lost = amount - gained;
  if (kind === 'red' && after > cap) ship.overCap = Math.max(ship.overCap || 0, after - cap);
  if (lost > 1e-12 && ship.shield < ship.shieldMax) ship.shieldT += lost * T.CAP_OVERFLOW_SHIELD;
  if (kind !== 'skim' && kind !== 'pack' && (gained > 0 || lost > 0)) {
    emit(race, E.push, ship, { amount: gained, from: kind, lost });
  }
  return gained;
}

// Is the ship inside a dust fog now? (DUST: grazes there push × leg.rules.dustPush.)
function inDust(race, ship) {
  const items = race.leg.items, d = ship.dist;
  for (let k = race.win.lo; k < race.win.hi; k++) {
    const it = items[k];
    if (it.kind !== 'fog' || d < it.beat || d >= it.end) continue;
    for (const [from, to] of it.arcs) {
      if (to - from >= 360) return true;
      const x = (((ship.bearing - from) % 360) + 360) % 360;
      if (x > 0 && x < to - from) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- damage (5.6, 8.1)

// The shield takes a hit if it is up, else 1 hull. For your ship the build's `damage` hooks run first (ABLATIVE TANKS,
// TIDAL FRAME, LIFEBOAT may cancel it or spend fuel instead). → 'shield' | 'hull' | 'none'.
function takeDamage(race, ship, e, T, S) {
  let use = ship.shield >= 1 ? 'shield' : 'hull', amount = 1;
  if (ship.kind === 'you' && race.hooks && race.hooks.damage) {
    const c = { race, ship, event: e, tune: T, use, amount, cancel: false };
    runHooks(race, 'damage', c);
    if (c.cancel) return 'none';
    use = c.use === 'shield' && ship.shield >= 1 ? 'shield' : 'hull';
    amount = finite(c.amount) && c.amount > 0 ? c.amount : 1;
  }
  ship.shieldT = 0;
  const why = e.type === 'redIn' ? 'red' : e.cause || e.type;
  if (use === 'shield') {
    ship.shield = Math.max(0, ship.shield - amount);
    const pop = emit(race, E.shieldPop, ship, { why, item: e.item ?? null });
    if (ship.kind === 'you' && race.hooks && race.hooks.shieldPop) {
      runHooks(race, 'shieldPop', { race, ship, event: pop, tune: T });
    }
    return 'shield';
  }
  ship.hull = Math.max(0, ship.hull - amount);
  emit(race, E.hullLost, ship, { hull: ship.hull, why });
  return 'hull';
}

// LAST HULL (1 hull, shield down) once each time the ship comes into it; a wreck at 0 hull with no shield.
function hullCheck(race, ship, S, T) {
  const last = ship.hull === 1 && ship.shield < 1;
  if (last && !S.lastHull) emit(race, E.lastHull, ship, {});
  S.lastHull = last;
  if (ship.hull <= 0 && ship.shield < 1 && !isOut(ship)) {
    ship.wrecked = true;
    emit(race, E.wreck, ship, {});
    catchShip(race, ship, S, T, 'wreck');
  }
}

// The light takes a ship: `caught { fedBy }` for you, `eaten { id, fedBy, caption, line, ahead, psi }` for a rival.
// The leg's one caption goes to the first named ship the light takes (or, in leg 1, a drifter); later losses only
// fade their labels (7.7). A rival you took down, trapped or weaved off in the last FED_WINDOW s was fed to it.
function catchShip(race, ship, S, T, why) {
  ship.caught = true;
  ship.ttc = 0;
  const fedBy = S.by && race.t - S.byT <= T.FED_WINDOW ? S.by : null;
  ship.fedBy = fedBy;
  if (ship.kind === 'you') {
    emit(race, E.caught, ship, { fedBy, why });
    return;
  }
  const R = raceScratch(race);
  const named = ship.kind === 'regular' || ship.kind === 'boss';
  const caption = !R.caption && (named || (race.legNo === 0 && ship.kind === 'drifter'));
  if (caption) R.caption = true;
  const you = race.ships[0];
  const fed = fedBy === (you && you.id);
  const line = caption ? (fed ? 'FED TO THE LIGHT' : `THE LIGHT TOOK ${named ? ship.name : 'A DRIFTER'}`) : null;
  emit(race, E.eaten, ship, { id: ship.id, fedBy, caption, line, why, wrecked: ship.wrecked,
    ahead: Boolean(you && ship.dist > you.dist), psi: ship.bearing });
}

// ---------------------------------------------------------------- one step (18.3 part 7)

// Gap, TTC, push-backs from this step's events, damage, pickups, states and the catch for one ship. events: the
// whole step's buffer (race.events); only this ship's are read (and takedowns it made, which pay it). dt: sim s.
export function stepLight(race, ship, events, dt, tune = race.tune || TUNE) {
  const T = tune;
  if (!ship || isOut(ship)) return;
  const S = scratch(ship);
  const M = massOf(race, T);
  const id = ship.id;
  const rules = (race.leg && race.leg.rules) || {};
  const step = dt > 0 ? dt : 0;
  const wasGlare = ship.light === 'glare';

  // the clocks: the light gains at BLEED × (1 − β), the shield ages, the over-cap allowance fades
  if (step > 0) {
    ship.gap -= T.BLEED * (1 - Math.tanh(ship.eta)) * step;
    ship.shieldT += step;
    if (ship.overCap > 0) ship.overCap = Math.max(0, ship.overCap - T.OVERCAP_DECAY * step);
  }

  // this step's events, in order
  S.dust = -1;
  const n = events.length;
  for (let i = 0; i < n && !isOut(ship); i++) {
    const e = events[i];
    if (e.ship !== id) {
      if (e.by === id && e.type === E.takedown) pushBack(race, ship, 'takedown', T.PB_TAKEDOWN * M, T);
      continue;
    }
    switch (e.type) {
      case E.graze: case E.hair: {
        if (S.dust < 0) S.dust = rules.dustPush > 1 && inDust(race, ship) ? 1 : 0;
        const x = S.dust ? rules.dustPush : 1;
        pushBack(race, ship, e.type, (e.type === E.hair ? T.PB_HAIR : T.PB_GRAZE) * M * x, T);
        break;
      }
      case E.rivalGraze: pushBack(race, ship, 'rival', T.PB_RIVAL * M, T); break;
      case E.release: {
        if (e.scorched) break;
        const wide = e.grade === 'WIDE' && !rules.wideFree ? 0.5 : 1;
        const d = finite(e.d) ? e.d : 0, mass = finite(e.mass) ? e.mass : 1;
        pushBack(race, ship, e.red ? 'red' : 'whip', T.PB_WHIP * mass * (0.5 + d) * wide * M, T);
        break;
      }
      case E.thread:
        // Saturn's ENCKE GAP (a pair tagged 'encke') pays 0.8 s, not the pair's 0.5 (11.5)
        if (e.pair) pushBack(race, ship, 'pair', T.PB_PAIR * M * (tagOf(race, e.gate) === 'encke' ? ENCKE_X : 1), T);
        else if (e.miss) pushBack(race, ship, 'past', T.PB_PAST * M, T);
        else pushBack(race, ship, 'thread', T.PB_THREAD * M, T);
        break;
      case E.dock: pushBack(race, ship, 'dock', T.PB_DOCK * M, T); break;
      case E.past: pushBack(race, ship, 'past', T.PB_PAST * M, T); break;
      case E.takedown:
        if (e.by) { S.by = e.by; S.byT = race.t; }      // the victim: fed to the light if it is caught soon
        break;
      case E.shaken:
        if (e.by) {                                      // the lead shook off a drafter: the drafter remembers who
          const dr = race.ships.find((s) => s.id === e.by);
          if (dr) { const D = scratch(dr); D.by = id; D.byT = race.t; }
        }
        break;
      case E.hit: hitStep(race, ship, e, T, S, wasGlare); break;
      case E.redIn: {
        if (takeDamage(race, ship, e, T, S) !== 'none') hullCheck(race, ship, S, T);
        break;
      }
      case E.pickFuel: {
        const room = ship.fuelCap - ship.fuel;
        if (room > 1e-9) ship.fuel += Math.min(1, room);
        else if (ship.shield < ship.shieldMax) ship.shieldT += T.FULL_TANK_SHIELD;   // critic lead item 3
        break;
      }
      case E.pickPatch: ship.hull = Math.min(ship.hullMax, ship.hull + 1); hullCheck(race, ship, S, T); break;
      case E.shieldPop: hullCheck(race, ship, S, T); break;          // a card popped it (SCRAPE)
      default:
    }
  }
  if (isOut(ship)) return;

  // a rail skim pushes the light back steadily (HEADWIND × 1.5)
  if (step > 0) {
    const x = skimOf(ship);
    if (x > 0) pushBack(race, ship, 'skim', T.PB_SKIM * x * (rules.skimX || 1) * M * step, T);
  }

  // the red release's extra over the cap fades; once the gap is back under the cap the allowance ends
  if (ship.overCap > 0) {
    const cap = capOf(race, ship, T);
    if (ship.gap <= cap) ship.overCap = 0;
    else if (ship.gap > cap + ship.overCap) ship.gap = cap + ship.overCap;
  }

  // the shield comes back SHIELD_T after the last damage
  if (ship.shield < ship.shieldMax && ship.shieldT >= T.SHIELD_T - 1e-9) {
    ship.shield = ship.shieldMax;
    emit(race, E.shieldBack, ship, {});
    S.lastHull = false;
  }

  if (ship.kind === 'you') patchStep(race, ship, T);
  lightState(race, ship, S, T, step);
}

// A hit (handle.js already took the speed and set the course stumble): the damage, then the catch in the glare, the
// wreck, or the gap's stumble, which outside the glare stops at the glare's edge (TTC STUMBLE_FLOOR_TTC at the new
// speed, 7.3): a hit there puts you IN THE GLARE, never past it.
function hitStep(race, ship, e, T, S, wasGlare) {
  if (e.by && (e.cause === 'takedown' || e.cause === 'trapped')) { S.by = e.by; S.byT = race.t; }
  if (takeDamage(race, ship, e, T, S) !== 'none') hullCheck(race, ship, S, T);
  if (isOut(ship)) return;
  if (wasGlare) { catchShip(race, ship, S, T, 'glare'); return; }
  const floor = gapFor(T.STUMBLE_FLOOR_TTC, ship.eta);
  const named = ship.kind === 'regular' || ship.kind === 'boss';        // a named rival's own ship (playtest P0-3)
  const drop = named ? (T.RIVAL_STUMBLE ?? T.STUMBLE) : T.STUMBLE;
  ship.gap = Math.max(ship.gap - drop, floor);
}

// A patch slot spawns only if your hull is below full PATCH_LOOK s before it comes into view, or always when the leg
// says so (SHIP family, RICH). One that does not spawn is dropped (the director's list, which the renderer skips) and
// claimed by nobody, so no ship can take it.
function patchStep(race, you, T) {
  const P = race.leg.pickups;
  if (!P || !P.length) return;
  const R = raceScratch(race);
  const view = T.SPAWN_BEATS + T.PATCH_LOOK * beatsPerS(you.eta, T, you.lightspeed);
  const always = Boolean(race.leg.rules && race.leg.rules.patchAlways);
  for (let i = 0; i < P.length; i++) {
    const it = P[i];
    if (it.type !== 'patch' || R.patch[it.id] !== undefined || it.beat - you.dist > view) continue;
    const keep = always || you.hull < you.hullMax;
    R.patch[it.id] = keep;
    if (keep) continue;
    const D = race.director || (race.director = { breatherUntil: 0 });
    (D.dropped || (D.dropped = {}))[it.id] = true;
    race.wells[it.id] = { holder: 'none' };
  }
}

// Did this leg's patch spawn? → true, false, or undefined while it is still undecided.
export const patchShown = (race, item) => raceScratch(race).patch[typeof item === 'object' ? item.id : item];

// TTC, the states and their events, and the catch when the gap runs out (always through the glare).
function lightState(race, ship, S, T, dt) {
  const ttc = ttcOf(ship.gap, ship.eta);
  ship.ttc = ttc;
  const you = ship.kind === 'you';
  const was = ship.light;
  let glare = was === 'glare' ? ttc <= T.GLARE_OUT : ttc < T.GLARE_IN;
  if (ship.gap <= 0) glare = true;
  if (glare && was !== 'glare') {
    const R = raceScratch(race);
    const first = !R.glared[ship.id];
    R.glared[ship.id] = true;
    S.glareAt = race.t;
    S.peaked = false;
    emit(race, E.glareIn, ship, { ttc, first });
  } else if (!glare && was === 'glare') {
    emit(race, E.glareOut, ship, { ttc });
    if (you && !S.peaked) emit(race, E.breather, ship, { why: 'out' });
    S.glareAt = -1;
  }
  if (glare) {
    ship.stats.glareS += dt;
    if (you && !S.peaked && S.glareAt >= 0 && race.t - S.glareAt >= T.GLARE_PEAK_S) {
      S.peaked = true;
      emit(race, E.breather, ship, { why: 'peak' });
    }
  }
  if (ship.gap <= 0) {
    ship.light = 'glare';
    catchShip(race, ship, S, T, 'light');
    return;
  }
  // the warning fires on time to catch, once, and re-arms only above TTC_REARM
  if (S.armed && ttc < T.TTC_WARN) { S.armed = false; emit(race, E.warn, ship, { ttc }); }
  else if (!S.armed && ttc > T.TTC_REARM) S.armed = true;
  let state;
  if (glare) state = 'glare';
  else if (ttc < T.TTC_WARN) state = 'warned';
  else if (ttc < T.TTC_LABEL || (was !== 'far' && ttc < T.TTC_LABEL + PRESS_HYST)) state = 'pressed';
  else state = 'far';
  if (was === 'far' && state !== 'far') emit(race, E.pressed, ship, { ttc });
  ship.light = state;
}

// ---------------------------------------------------------------- gates, launches and docks (9)

// η and meters for the next leg from the gate choice ('thread' | 'dock' | 'past'). REDSHIFT 3 (LATE LAUNCH): a thread
// launches at 1.0 and a dock at 0.6. The dock's free repair, the clean-leg bonus and a beaten boss's refill are run.js's.
export function launchState(run, gateChoice, tune = TUNE) {
  const T = tune;
  const late = Boolean(run && run.redshift >= 3);
  const eta = gateChoice === 'thread' ? (late ? 1.0 : T.LAUNCH_THREAD)
    : gateChoice === 'dock' ? (late ? 0.6 : T.LAUNCH_DOCK) : T.LAUNCH_PAST;
  return { eta, meters: { ...(run && run.you) } };
}

const fmtS = (s) => {
  const r = Math.round(s * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

const CHIP_IDS = Object.freeze(['repair', 'refuel', 'tune']);
const chipId = (chip) => (typeof chip === 'string' ? chip : chip && chip.id);
const boughtOf = (run, id) => (run.dock && run.dock.bought ? run.dock.bought.find((b) => b.id === id) : null);

function priceOf(id, T) {
  return id === 'repair' ? T.REPAIR_S : id === 'refuel' ? T.REFUEL_S : id === 'tune' ? T.TUNE_S : null;
}

// The dock strip (9.2): [{ id, label, price, ttcDrop, text ("−4.5 S"), ok, why, bought, auto, cards }]. Prices are
// gap seconds; the chip shows the drop in launch TTC (at η 0.8, 1 s of gap is 3 s of TTC). No purchase may leave
// launch TTC under TTC_FLOOR (TOO CLOSE). A bought chip refunds on a second tap. TUNE (one card up a rarity) shows only
// while a card can go up, once a dock. FREE REPAIR is a grey line: run.js has already applied it.
export function dockPrices(run, tune = TUNE) {
  const T = tune;
  if (!run || !run.dock) return [];
  const Y = run.you;
  const eta = finite(Y.launchEta) ? Y.launchEta : T.LAUNCH_DOCK;
  const k = 1 / Math.max(1e-12, 1 - Math.tanh(eta));
  const ttc = Y.gap * k;
  const out = [];
  if (run.dock.free > 0) {
    out.push({ id: 'free', label: `FREE REPAIR +${run.dock.free} HULL`, price: 0, ttcDrop: 0, text: '', ok: false,
      why: 'auto', bought: true, auto: true, cards: null });
  }
  const can = tunable(run.build);
  for (const id of CHIP_IDS) {
    const price = priceOf(id, T);
    const got = boughtOf(run, id);
    if (id === 'tune' && !got && !can.length) continue;
    const label = id === 'repair' ? 'REPAIR +1 HULL' : id === 'refuel' ? `REFUEL +${T.REFUEL_N} FUEL`
      : 'TUNE ONE CARD UP';
    let ok = true, why = null;
    if (got) why = 'bought';
    else if (id === 'repair' && Y.hull >= Y.hullMax) { ok = false; why = 'full'; }
    else if (id === 'refuel' && Y.fuel >= Y.fuelCap - 1e-9) { ok = false; why = 'full'; }
    else if (ttc - price * k < T.TTC_FLOOR - 1e-9) { ok = false; why = 'TOO CLOSE'; }
    out.push({ id, label, price, ttcDrop: price * k, text: `−${fmtS(price * k)} S`, ok, why, bought: Boolean(got),
      auto: false, cards: id === 'tune' ? (got ? [got.card] : can) : null });
  }
  return out;
}

// Buy a chip ({ id, card } or its id): its price comes off your gap, and you age price × YEARS_PER_S (docked seconds
// are literal). REPAIR +1 hull, REFUEL +REFUEL_N fuel, TUNE one card (chip.card, or the first that can) up a rarity.
// Each chip once a dock; tap it again to refund. → true if bought.
export function buy(run, chip, tune = TUNE) {
  const T = tune;
  const id = chipId(chip);
  if (!run || !run.dock || !CHIP_IDS.includes(id)) return false;
  const c = dockPrices(run, T).find((x) => x.id === id);
  if (!c || !c.ok || c.bought) return false;
  const Y = run.you, price = c.price;
  const rec = { id, price, add: 0, card: null, from: null };
  if (id === 'repair') { rec.add = Math.min(1, Y.hullMax - Y.hull); Y.hull += rec.add; }
  else if (id === 'refuel') { rec.add = Math.min(T.REFUEL_N, Y.fuelCap - Y.fuel); Y.fuel += rec.add; }
  else {
    const card = chip && typeof chip === 'object' && chip.card ? chip.card : c.cards[0];
    const b = run.build.find((x) => x.id === card);
    if (!b || !c.cards.includes(card)) return false;
    rec.card = card;
    rec.from = b.r;
    if (tuneUp(run.build, card) === null) return false;
  }
  Y.gap -= price;
  Y.years += price * T.YEARS_PER_S;
  run.dock.bought.push(rec);
  return true;
}

// Refund a bought chip before launch: everything back exactly. → true if refunded.
export function refund(run, chip, tune = TUNE) {
  const T = tune;
  const id = chipId(chip);
  if (!run || !run.dock) return false;
  const k = run.dock.bought.findIndex((b) => b.id === id);
  if (k < 0) return false;
  const rec = run.dock.bought[k], Y = run.you;
  if (id === 'repair') Y.hull -= rec.add;
  else if (id === 'refuel') Y.fuel -= rec.add;
  else if (id === 'tune' && rec.card) tuneDown(run.build, rec.card, rec.from);
  Y.gap += rec.price;
  Y.years -= rec.price * T.YEARS_PER_S;
  run.dock.bought.splice(k, 1);
  return true;
}

// ---------------------------------------------------------------- the landing (8.2) and the years (13)

// What the landing needs at your speed now: LAND_S plus LAND_PER_NINE for each nine held (4 s at 0.9c, 5 at
// HEADLIGHT, 6 at 0.999c, 7 at LIGHT SPEED). → { need, nines, text } for the leg-8 line.
export function landNeed(ship, tune = TUNE) {
  const nines = clamp(ship.gear | 0, 0, 4);
  const need = tune.LAND_S + tune.LAND_PER_NINE * nines;
  const at = ['', ' AT 0.9C', ' AT 0.99C', ' AT 0.999C', ' AT LIGHT SPEED'][nines];
  return { need, nines, text: `TO LAND: ${need} S${at} · FUEL AND HULL COUNT 1 EACH` };
}

// Land at Earth: your gap covers the margin in full, then each whole fuel cell 1 s (retro-burns, up to
// LAND_FUEL_MAX), then each hull pip 1 s (aerobraking). Cells first, then hull; what it spends comes off the ship.
// extra: seconds more the landing needs (DOOR_MISS_S when you miss the DOOR and loop round, 8.2).
// → { ok, cellsSpent, hullSpent, margin (seconds ahead of the light after landing; under 0 if short), need }.
export function land(ship, tune = TUNE, extra = 0) {
  const T = tune;
  const need = landNeed(ship, T).need + (extra > 0 ? extra : 0);
  const gap = Math.max(0, ship.gap);
  let short = need - gap, cells = 0, hull = 0;
  if (short > 1e-9) {
    cells = Math.min(T.LAND_FUEL_MAX, Math.floor(ship.fuel + 1e-9), Math.ceil(short - 1e-9));
    short -= cells;
  }
  if (short > 1e-9) {
    hull = Math.min(Math.max(0, ship.hull), Math.ceil(short - 1e-9));
    short -= hull;
  }
  ship.fuel -= cells;
  ship.hull -= hull;
  return { ok: short <= 1e-9, cellsSpent: cells, hullSpent: hull, margin: gap + cells + hull - need, need };
}

// Years you age this step: YEARS_PER_S × dt ÷ cosh η (true time dilation, the 0.25 is the game's scale). race.js adds
// it to ship.years (and YEARS_PER_S × dt to ship.earth).
export function yearsStep(ship, dt, tune = TUNE) {
  if (!(dt > 0) || !ship) return 0;
  return tune.YEARS_PER_S * dt / Math.cosh(ship.eta);
}

// Ahead of the Light: the cards as data (final.md 12): 22 starters, 6 fusions, 4 legendaries and 4 trophies, their
// faces (12.7), and applyBuild, which patches a copy of the tuning table within 12.6's caps and collects the build's
// hooks (12.9). A card changes a rule in one of four ways: a patch to a tuning key; a hook on one of your events (race.js
// part 6 runs hooks for any event type that is yours); a hook point another module calls (pass and rivalPass from
// handle.js, damage and shieldPop from survival.js); or a course mod (SLINGSHOT HOME's gateWell). No card touches the
// renderer: each card's tell is a render rule keyed by its id. Pure.
import { TUNE } from './tune.js';
import { emit, E, runHooks } from './events.js';
import * as H from './handle.js';
import * as SV from './survival.js';

// ---------------------------------------------------------------- families (12.1)

export const FAMILIES = Object.freeze({
  SKIM: Object.freeze({ id: 'SKIM', colour: '#9db8ff', glyph: 'dot-chevron', band: 'solid',
    touches: 'Hazards you pass: grazes, hairlines, chains, the light' }),
  WELL: Object.freeze({ id: 'WELL', colour: '#ffd27a', glyph: 'ring-dot', band: 'dashed',
    touches: 'Masses you swing round: grab, sweep, release, red zone' }),
  SHIP: Object.freeze({ id: 'SHIP', colour: '#f08a2c', glyph: 'chevron-flame', band: 'double',
    touches: 'Yourself: hull, shield, fuel, burns' }),
  RIVAL: Object.freeze({ id: 'RIVAL', colour: '#ff6b5c', glyph: 'two-chevrons', band: 'dotted',
    touches: 'Other ships: drafts, slams, takedowns' }),
});
export const FAMS = Object.freeze(['SKIM', 'WELL', 'SHIP', 'RIVAL']);
export const RARITY = Object.freeze(['COMMON', 'RARE', 'EPIC']);

// Card-only tuning keys a patch may add (not in TUNE). handle.js reads PHASE_HULL (see contract.md, Requests).
export const CARD_KEYS = Object.freeze(['PHASE_HULL']);

// The caps of 12.6.
export const CAPS = Object.freeze({ GRAZE: 12, HAIR: 5, SHIELD_MAX: 3, WHIP_X: 2.5, STILL_LIGHT: 2, SCOOP_BOTH: 3 });

// ---------------------------------------------------------------- small helpers (allocation-light; hooks run in the step)

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const wrap = (a) => { let x = (a + 180) % 360; if (x < 0) x += 360; return x - 180; };
const isOut = (s) => !s || s.caught || s.wrecked;
const massK = (race, T) => (T.MASS_K && finite(T.MASS_K[race.legNo]) ? T.MASS_K[race.legNo] : 1);
const etaMax = (T) => T.ETA_MAX ?? TUNE.ETA_MAX;
const burnCap = (race, T) => (race.leg && race.leg.burnCap === null ? Infinity
  : race.leg && finite(race.leg.burnCap) ? race.leg.burnCap : T.BURN_CAP);
const shipById = (race, id) => { for (const s of race.ships) if (s.id === id) return s; return null; };

function addEta(ship, x, T) { ship.eta = Math.min(etaMax(T), ship.eta + x); }
function addFuel(ship, x) {
  const room = Math.max(0, ship.fuelCap - ship.fuel), add = Math.max(0, Math.min(x, room));
  ship.fuel += add;
  return add;
}
function push(race, ship, kind, amount, T) {
  if (typeof SV.pushBack === 'function' && amount > 0) SV.pushBack(race, ship, kind, amount, T);
}
// The shield back to full now (ship.shieldT: seconds since the shield last took damage; at SHIELD_T it is back).
function shieldFull(race, ship, T, why) {
  const was = ship.shield;
  ship.shield = ship.shieldMax;
  ship.shieldT = Math.max(ship.shieldT || 0, T.SHIELD_T);
  if (ship.shield > was) emit(race, E.shieldBack, ship, { why });
}
// A hazard pass the hook turns into a hairline: no hit, one gap of 0 on the side the ship passed.
function toHair(ctx) {
  const r = ctx.res, it = ctx.item;
  const psi = it && finite(it.psi) ? it.psi : ctx.bearing;
  r.hit = false;
  r.overlap = 0;
  r.gaps = [{ g: 0, side: wrap(ctx.bearing - psi) >= 0 ? -1 : 1 }];
}
// A hairline that no hazard made (PHASE HULL, CLOSE QUARTERS): handle's graze rules, then the `hair` event, which
// survival pays for (PB_HAIR) and later hooks read.
function rivalHair(race, ship, other, gap, T) {
  addEta(ship, T.KICK_HAIR, T);
  ship.chain++;
  ship.chainT = Math.min(ship.chainT, 0);
  ship.stats.hairs++;
  emit(race, E.hair, ship, { gap: Math.max(0, gap), side: 0, item: null, kind: 'rival', other: other.id,
    chain: ship.chain, piece: null, psi: other.bearing });
}
// Set a shove through handle's own record (so a card's SLAM counts for takedowns): deg degrees over s seconds.
function shoveShip(race, ship, dir, deg, by, T, slam, s = T.SHOVE_S) {
  H.shoveShip(race, ship, dir, deg, by, T, slam, s);
}
// A PERFECT release now (KICK OUT): handle's release, so its red zone, gate and wake rules are a lift's.
function forceRelease(race, ship, T) {
  return H.forceRelease(race, ship, 'PERFECT', T);
}
// Undo a burn that a card turned into something else: stop its ramp and take back what the ramp added this step.
function cancelBurn(ship, left0) {
  const B = ship.burn;
  const added = Math.max(0, left0 - B.left);
  ship.eta = Math.max(0, ship.eta - added);
  B.left = 0;
  B.t = 0;
  B.queued = false;
}

// ---------------------------------------------------------------- per-race card state

// What the build's hooks remember during one leg: a WeakMap keyed by the race, so the race's shape stays 18.2's.
// fires: [{ t, id }] each time a card took effect (the renderer names a card at the ship the first 2 times a run).
const STATE = new WeakMap();
export function cardState(race) {
  let s = STATE.get(race);
  if (!s) {
    s = { hold: 0, steady: 0, chainGrazes: 0, scoopB: 0, scoopL: 0, spark: -1, lens: 0, leech: 0, dirty: {},
      bounty: null, bountyPaid: false, lifeboat: false, fires: [] };
    STATE.set(race, s);
  }
  return s;
}
function fired(ctx, s, id) {
  s.fires.push({ t: ctx.race.t, id });
  if (s.fires.length > 32) s.fires.shift();
}
export const cardFires = (race) => cardState(race).fires;

// ---------------------------------------------------------------- the cards

// A card: { id, name, fam, fams, kind ('form' | 'trait' | 'fusion' | 'legend' | 'trophy'), values (as the face shows
// them, by rarity C / R / E), amounts (the numbers the rule uses, when they differ), minR (a Rare-only card shows as
// Rare), tag (the family its fusion half points to), pack, face ({v} is the value), rule (the log's longer line),
// tell (the render rule), halves (fusions), from (trophies), patch(v, T) → { KEY: value }, hooks: { [point]: fn },
// mods (the course). A hook is fn(ctx, v, state, owned): ctx as the hook point gives it (12.9), v the amount at the
// card's rarity, state cardState(race), owned the build's ids.
const card = (o) => o;

const STEADY_TURN = 90;            // °/s: turning slower than this holds your line (STEADY HAND)
const SIDESTEP_TURN = 300;         // °/s: a burn while turning faster than this is a hop (SIDESTEP)
const SIDESTEP_S = 0.1;            // s: the hop's time
const SIDESTEP_FLICKER = 0.2;      // s untouchable
const LENS_X = 0.05;               // LENSED LANE: +5 % to the fling per knot
const CHERENKOV_CHAIN = 15, CHERENKOV_COST = 10;
const QUARTERS_DEG = 2.5;          // CLOSE QUARTERS
const PACK_ETA = 0.08, PACK_GAP = 0.1;   // PACK LEADER, per drafter a second

const LIST = [
  // ---------------- SKIM
  card({ id: 'steady-hand', name: 'STEADY HAND', fam: 'SKIM', kind: 'form', values: [3, 4, 5], tag: 'WELL',
    pack: 'starter', face: 'Hold your line: the graze band grows 1° each 0.5 s, up to +{v}°.',
    rule: 'Turn slower than 90° a second and your graze band widens 1° every half second. A fast turn or a hit '
      + 'resets it. Never past 12°.',
    tell: 'blue-halo-widens',
    hooks: {
      step: (c, v, s) => {
        const T = c.tune, ship = c.ship;
        if (Math.abs(ship.turnRate) <= STEADY_TURN && !ship.whip) s.hold += c.dt || 0;
        else s.hold = 0;
        s.steady = Math.max(0, Math.min(v, Math.floor(s.hold / 0.5), CAPS.GRAZE - T.GRAZE));
      },
      hit: (c, v, s) => { s.hold = 0; s.steady = 0; },
      pass: (c, v, s) => {
        if (!(s.steady > 0) || c.res.hit || !c.res.gaps) return;
        const T = c.tune;
        for (const g of c.res.gaps) if (g.g >= T.HAIR) g.g = Math.max(T.HAIR, g.g - s.steady);
      },
    } }),
  card({ id: 'scrape', name: 'SCRAPE', fam: 'SKIM', kind: 'form', values: [1.5, 2, 2.5], tag: 'SHIP',
    pack: 'starter', face: 'Shield up: a hazard\'s outer {v}° is a hairline that pops the shield.',
    rule: 'With the shield up, clipping a hazard by its outer edge is a hairline instead of a hit: the shield pops, '
      + 'and you lose no speed and no ground.',
    tell: 'orange-hazard-rims',
    hooks: {
      pass: (c, v, s) => {
        const ship = c.ship, r = c.res;
        if (!r.hit || ship.whip || !(ship.shield >= 1) || !(-r.overlap <= v)) return;
        toHair(c);
        ship.shield -= 1;
        ship.shieldT = 0;
        emit(c.race, E.shieldPop, ship, { why: 'scrape', item: c.item.id });
        fired(c, s, 'scrape');
      },
    } }),
  card({ id: 'hair-trigger', name: 'HAIR TRIGGER', fam: 'SKIM', kind: 'trait', values: [3.5, 4, 4.5], tag: 'SHIP',
    pack: 'starter', face: 'Hairlines are {v}° wide, not 2.5°, and add 2 to your chain.',
    rule: 'The hairline band is wider, and every hairline adds one more to your chain.',
    tell: 'thick-hair-ticks', patch: (v) => ({ HAIR: v }),
    hooks: { hair: (c) => { c.ship.chain += 1; } } }),
  card({ id: 'still-light', name: 'STILL LIGHT', fam: 'SKIM', kind: 'trait', values: [0.1, 0.15, 0.2], tag: 'RIVAL',
    pack: 'starter', face: 'Each hairline lets you hold the light {v} s further back this leg.',
    rule: 'Each hairline raises this leg\'s cap on your lead by a little, up to 2 s. It resets at each launch.',
    tell: 'second-burst-ring',
    hooks: {
      hair: (c, v, s) => {
        const ship = c.ship;
        ship.lightHold = Math.min(CAPS.STILL_LIGHT, (ship.lightHold || 0) + v);
        fired(c, s, 'still-light');
      },
    } }),
  card({ id: 'far-sight', name: 'FAR SIGHT', fam: 'SKIM', kind: 'trait', values: [2, 2.5, 3], tag: 'WELL',
    pack: 'starter', face: 'See hazards {v} s ahead, not 1.3, and every well\'s exits at once.',
    rule: 'Ticks and outlines light earlier, and a well shows its exits before you grab it. The course is still '
      + 'built for 1.3 s.',
    tell: 'early-ticks', patch: (v) => ({ TICK_LEAD: v, OUTLINE_LEAD: Math.max(0.1, v - 0.1) }) }),
  card({ id: 'long-chain', name: 'LONG CHAIN', fam: 'SKIM', kind: 'trait', values: [4, 5, 6], tag: 'RIVAL',
    pack: 'starter', face: 'Chains last {v} s, not 3. Every 10th graze recharges your shield.',
    rule: 'Your chain waits longer for the next graze, and every tenth graze or hairline brings the shield back.',
    tell: 'chain-glow-10', patch: (v) => ({ CHAIN_TIMEOUT: v }),
    hooks: {
      graze: (c, v, s) => longChain(c, s),
      hair: (c, v, s) => longChain(c, s),
    } }),

  // ---------------- WELL
  card({ id: 'slow-orbit', name: 'SLOW ORBIT', fam: 'WELL', kind: 'form', values: [0.85, 0.9, 1.0], tag: 'SKIM',
    pack: 'starter', face: 'Whips sweep 30 % slower: wider windows, gains × {v}.',
    rule: 'The sweep runs at 70 % speed, so every exit band lasts longer. The fling pays a little less.',
    tell: 'hum-drops-a-fifth',
    patch: (v, T) => ({ SWEEP0: T.SWEEP0 * 0.7, SWEEP1: T.SWEEP1 * 0.7, WHIP_GAIN_X: T.WHIP_GAIN_X * v }) }),
  card({ id: 'kick-out', name: 'KICK OUT', fam: 'WELL', kind: 'trait', values: [90, 60, 30], tag: 'SHIP',
    pack: 'starter', face: 'Burn mid-whip past {v}° to fling out at once, graded PERFECT.',
    rule: 'A burn during a whip, once you are far enough round, lets go at once with a PERFECT grade. The cell pays '
      + 'for the fling instead of a speed burn.',
    tell: 'diamonds-glint-gold',
    hooks: {
      burn: (c, v, s) => kickOut(c, v, s, c.tune.BURN_ETA),
      oberth: (c, v, s) => kickOut(c, v, s, c.tune.OBERTH_ETA),
    } }),
  card({ id: 'tidal-frame', name: 'TIDAL FRAME', fam: 'WELL', kind: 'trait', values: [1.5, 1.7, 2.0], tag: 'SHIP',
    pack: 'starter', face: 'The red zone costs your shield, never hull. Its releases pay × {v}.',
    rule: 'Entering a red zone takes the shield if it is up and nothing if it is down. Red releases pay more.',
    tell: 'dashed-red-zone', patch: (v) => ({ RED_X: v }),
    hooks: {
      damage: (c, v, s) => {
        if (c.cancel || c.use !== 'hull' || !c.event || c.event.type !== 'redIn') return;
        c.cancel = true;
        fired(c, s, 'tidal-frame');
      },
    } }),
  card({ id: 'mass-shadow', name: 'MASS SHADOW', fam: 'WELL', kind: 'trait', values: [15, 25, 35], tag: 'RIVAL',
    pack: 'starter', face: 'Let go with a rival in reach: it is pulled {v}° toward the core.',
    rule: 'When you release, every rival inside the well\'s reach is dragged toward its core. If that drags it into '
      + 'something, the takedown is yours.',
    tell: 'gold-leader-to-rival',
    hooks: {
      release: (c, v, s) => {
        const race = c.race, T = c.tune, e = c.event;
        if (!e || e.scorched) return;
        const it = race.leg.items.find((x) => x.id === e.well);
        if (!it) return;
        const size = (T.WELLS && T.WELLS[it.size]) || T.WELLS.medium;
        let n = 0;
        for (const o of race.ships) {
          if (o === c.ship || isOut(o) || o.whip) continue;
          if (Math.abs(o.dist - it.beat) > 1.5) continue;
          const off = wrap(o.bearing - it.psi);
          if (Math.abs(off) > size.reach) continue;
          shoveShip(race, o, off >= 0 ? -1 : 1, v, c.ship.id, T, true);
          n++;
        }
        if (n) fired(c, s, 'mass-shadow');
      },
    } }),

  // ---------------- SHIP
  card({ id: 'afterburner', name: 'AFTERBURNER', fam: 'SHIP', kind: 'form', values: [1.0, 1.5, 2.0], tag: 'SKIM',
    pack: 'starter', face: 'Burns last {v} s: grazes count double and hits don\'t slow you.',
    rule: 'A burn is a long flare. While it lasts, each graze or hairline pays twice (speed, chain and the light), '
      + 'and a hit costs no speed.',
    tell: 'long-orange-flare', patch: (v) => ({ BURN_S: v }),
    hooks: {
      graze: (c, v, s) => afterGraze(c, s, false),
      hair: (c, v, s) => afterGraze(c, s, true),
      hit: (c, v, s) => {
        const ship = c.ship, T = c.tune, e = c.event;
        if (!(ship.burn.t > 0)) return;
        const loss = e && finite(e.loss) ? e.loss : (ship.eta > T.ETA_MIN + 1e-9 ? T.HIT_ETA : 0);
        addEta(ship, loss, T);
        fired(c, s, 'afterburner');
      },
    } }),
  card({ id: 'sidestep', name: 'SIDESTEP', fam: 'SHIP', kind: 'form', values: [25, 30, 35], tag: 'RIVAL',
    pack: 'starter', face: 'Burn mid-turn to hop {v}° aside, untouchable. Costs half a cell.',
    rule: 'A burn while you turn hard is a hop the way you are turning, with a flicker of safety, and no speed. It '
      + 'gives half the cell back.',
    tell: 'orange-afterimage',
    hooks: {
      burn: (c, v, s) => {
        const ship = c.ship, T = c.tune;
        if (ship.whip || !(Math.abs(ship.turnRate) > SIDESTEP_TURN)) return;
        cancelBurn(ship, T.BURN_ETA);
        ship.fuel = Math.min(ship.fuelCap, ship.fuel + 0.5);
        shoveShip(c.race, ship, ship.turnRate > 0 ? 1 : -1, v, null, T, false, SIDESTEP_S);
        ship.flicker = Math.max(ship.flicker, SIDESTEP_FLICKER);
        fired(c, s, 'sidestep');
      },
    } }),
  card({ id: 'ablative-tanks', name: 'ABLATIVE TANKS', fam: 'SHIP', kind: 'trait', values: [3, 2, 1], tag: 'WELL',
    pack: 'starter', face: 'With {v} or more fuel cells, a hit burns a cell instead of hull.',
    rule: 'When a hit would cost hull and you carry enough fuel, one cell burns off instead.',
    tell: 'diamonds-flash',
    hooks: {
      damage: (c, v, s) => {
        const ship = c.ship;
        if (c.cancel || c.use !== 'hull' || !c.event || c.event.type !== 'hit') return;
        if (!(ship.fuel >= v - 1e-9) || !(ship.fuel >= 1 - 1e-9)) return;
        ship.fuel -= 1;
        c.cancel = true;
        fired(c, s, 'ablative-tanks');
      },
    } }),
  card({ id: 'twin-deflector', name: 'TWIN DEFLECTOR', fam: 'SHIP', kind: 'trait', values: [2, 2, 3], minR: 1,
    tag: 'RIVAL', pack: 'starter', face: 'Your shield holds {v} charges, but takes 50 % longer to recharge.',
    rule: 'More shield charges, a slower recharge. Rare or better only.',
    tell: 'two-bubbles',
    patch: (v, T) => ({ SHIELD_MAX: Math.max(T.SHIELD_MAX, v), SHIELD_T: T.SHIELD_T * 1.5 }) }),
  card({ id: 'bussard-scoop', name: 'BUSSARD SCOOP', fam: 'SHIP', kind: 'trait', values: ['⅛', '⅙', '¼'],
    amounts: [1 / 8, 1 / 6, 1 / 4], tag: 'SKIM', pack: 'starter',
    face: 'Hairlines fill fuel: {v} of a cell each, up to 2 cells a leg.',
    rule: 'Every hairline scoops a little fuel, up to 2 cells a leg (3 with STAR LIFTER, the two together).',
    tell: 'diamond-segments',
    hooks: {
      hair: (c, v, s, owned) => {
        const T = c.tune;
        const both = owned.has('star-lifter');
        let left = T.SCOOP_LEG_MAX - s.scoopB;
        if (both) left = Math.min(left, T.SCOOP_LIFTER_MAX - s.scoopB - s.scoopL);
        const add = addFuel(c.ship, Math.min(v, left));
        if (add > 0) { s.scoopB += add; fired(c, s, 'bussard-scoop'); }
      },
    } }),
  card({ id: 'reactive-hull', name: 'REACTIVE HULL', fam: 'SHIP', kind: 'trait', values: [1, 1.25, 1.5],
    tag: 'WELL', pack: 'starter', face: 'When your shield pops, the blast gives you speed: a burn × {v}.',
    rule: 'Each shield pop throws you forward by a burn\'s worth of speed or more, after the hit\'s loss. It stops '
      + 'at the burn cap.',
    tell: 'orange-shock-ring',
    hooks: {
      shieldPop: (c, v, s) => {
        const ship = c.ship, T = c.tune;
        const cap = Math.min(etaMax(T), burnCap(c.race, T));
        ship.eta = Math.min(Math.max(ship.eta, cap), ship.eta + T.BURN_ETA * v);
        fired(c, s, 'reactive-hull');
      },
    } }),

  // ---------------- RIVAL
  card({ id: 'battering-prow', name: 'BATTERING PROW', fam: 'RIVAL', kind: 'form', values: [1.5, 1.75, 2],
    tag: 'SHIP', pack: 'starter', face: 'Your side rams always SLAM, and shove {v} × as far.',
    rule: 'Any side contact you make is a SLAM, whatever your turn speed, and your shoves go further.',
    tell: 'hard-prow', patch: (v, T) => ({ SLAM_V: 0, SHOVE_X: (T.SHOVE_X || 1) * v }) }),
  card({ id: 'phase-hull', name: 'PHASE HULL', fam: 'RIVAL', kind: 'form', values: ['½', '¾', '1'],
    amounts: [0.5, 0.75, 1], tag: 'SKIM', pack: 'starter',
    face: `Fly through a rival: a hairline that steals {v} cell. Solid for ${TUNE.PHASE_COOLDOWN} s.`,
    rule: 'Touch a rival and you fly through it: a hairline, and you take some of its fuel. Then your hull is solid '
      + `for ${TUNE.PHASE_COOLDOWN} s and contact works as normal. While you can pass, you look see-through near `
      + 'rivals and none of them rams you.',
    tell: 'see-through-near-rivals', patch: () => ({ PHASE_HULL: 1 }),
    hooks: {
      rivalPass: (c, v, s) => {
        const o = c.other, ship = c.ship;
        if (!c.phase || !o || isOut(o)) return;              // handle.js's phase pass, not an ordinary one
        rivalHair(c.race, ship, o, 0, c.tune);
        const take = Math.min(v, o.fuel, Math.max(0, ship.fuelCap - ship.fuel));
        if (take > 0) {
          o.fuel -= take;
          ship.fuel += take;
          emit(c.race, E.spill, o, { amount: take, to: ship.id, taken: take, by: 'phase-hull' });
        }
        fired(c, s, 'phase-hull');
      },
    } }),
  card({ id: 'slipstream', name: 'SLIPSTREAM', fam: 'RIVAL', kind: 'trait', values: [2, 3, 4], tag: 'WELL',
    pack: 'starter', face: 'Wakes are twice as wide, and a full draft keeps {v} s after you leave.',
    rule: 'Wakes are easier to sit in, and a full charge waits after you pull out, so the slingshot can come later.',
    tell: 'orange-wake-lines', patch: (v, T) => ({ WAKE_HALF: T.WAKE_HALF * 2, DRAFT_KEEP: v }) }),
  card({ id: 'leech-line', name: 'LEECH LINE', fam: 'RIVAL', kind: 'trait', values: [2, 1.5, 1], tag: 'SHIP',
    pack: 'starter', face: 'In a full wake, take a fuel cell from the ship ahead every {v} s.',
    rule: 'While your draft is full, a line runs from the ship ahead to your tanks and pulls a cell across.',
    tell: 'orange-line-to-diamonds',
    hooks: {
      step: (c, v, s) => {
        const ship = c.ship, D = ship.draft;
        if (!D.lead || !(D.charge >= 1)) { s.leech = 0; return; }
        s.leech += c.dt || 0;
        if (s.leech < v) return;
        s.leech -= v;
        const lead = shipById(c.race, D.lead);
        if (!lead || isOut(lead)) return;
        const take = Math.min(1, lead.fuel, Math.max(0, ship.fuelCap - ship.fuel));
        if (!(take > 0)) return;
        lead.fuel -= take;
        ship.fuel += take;
        emit(c.race, E.spill, lead, { amount: take, to: ship.id, taken: take, by: 'leech-line' });
        fired(c, s, 'leech-line');
      },
    } }),
  card({ id: 'bounty', name: 'BOUNTY', fam: 'RIVAL', kind: 'trait', values: ['ANY', 'RARE', 'EPIC'],
    amounts: [0, 1, 2], tag: 'SKIM', pack: 'starter',
    face: 'One rival a leg wears a bounty. Take it down for one more pick.',
    rule: 'The named rival nearest you at the launch wears a star. Take it down and the next offer gives one more '
      + 'pick, of this rarity or better.',
    tell: 'orange-star-label',
    hooks: {
      step: (c, v, s) => {
        if (s.bounty) return;
        let best = null, bd = Infinity;
        for (const o of c.race.ships) {
          if (o === c.ship || o.kind !== 'regular' || isOut(o)) continue;
          const d = Math.abs(o.dist - c.ship.dist);
          if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && String(o.id) < String(best.id))) { bd = d; best = o; }
        }
        if (best) s.bounty = best.id;
      },
      takedown: (c, v, s) => {
        const e = c.event;
        if (!e || e.by !== c.ship.id || !s.bounty || e.victim !== s.bounty || s.bountyPaid) return;
        s.bountyPaid = true;
        fired(c, s, 'bounty');
      },
    } }),
  card({ id: 'dirty-air', name: 'DIRTY AIR', fam: 'RIVAL', kind: 'trait', values: [1.0, 0.8, 0.6], tag: 'WELL',
    pack: 'starter', face: 'A rival that sits in your wake for {v} s loses a burn of speed.',
    rule: 'Your wake is rough. A ship that drafts you too long loses a burn\'s worth of speed, then its timer resets.',
    tell: 'wake-shimmer',
    hooks: {
      step: (c, v, s) => {
        const race = c.race, ship = c.ship, T = c.tune, dt = c.dt || 0;
        for (const o of race.ships) {
          if (o === ship) continue;
          if (isOut(o) || o.draft.lead !== ship.id) { if (s.dirty[o.id]) s.dirty[o.id] = 0; continue; }
          s.dirty[o.id] = (s.dirty[o.id] || 0) + dt;
          if (s.dirty[o.id] < v) continue;
          s.dirty[o.id] = 0;
          const was = o.eta;
          o.eta = Math.max(T.ETA_MIN, o.eta - T.BURN_ETA);
          emit(race, E.dirtyAir, o, { by: ship.id, victim: o.id, loss: was - o.eta });
          fired(c, s, 'dirty-air');
        }
      },
    } }),

  // ---------------- fusions (12.4): a card of X tagged → Y and a card of Y tagged → X
  card({ id: 'lensed-lane', name: 'LENSED LANE', fam: 'SKIM', fams: ['SKIM', 'WELL'], kind: 'fusion', values: [5],
    pack: 'fusion', halves: [['steady-hand', 'far-sight'], ['slow-orbit']],
    face: 'Knots you cross mid-whip count as hairlines, each +5 % to the fling.',
    rule: 'While you whip, a knot you touch or graze is a hairline, and each one adds 5 % to that whip\'s fling.',
    tell: 'lensed-knots',
    hooks: {
      grab: (c, v, s) => { s.lens = 0; },
      pass: (c, v, s) => {
        const ship = c.ship, it = c.item, r = c.res, T = c.tune;
        if (!ship.whip || (it.kind !== 'knot' && it.kind !== 'pulse')) return;
        const near = r.hit || (r.gaps && r.gaps.some((g) => g.g < T.GRAZE));
        if (!near) return;
        toHair(c);
        s.lens++;
      },
      release: (c, v, s) => {
        const e = c.event, ship = c.ship, T = c.tune;
        const n = s.lens;
        s.lens = 0;
        if (!e || e.scorched || !(n > 0) || !(e.gain > 0)) return;
        const base = T.WHIP_GAIN_X * (e.red ? T.RED_X : 1);
        const lens = Math.min(1 + LENS_X * n, CAPS.WHIP_X / Math.max(1e-6, base));
        if (lens > 1) addEta(ship, e.gain * (lens - 1), T);
        fired(c, s, 'lensed-lane');
      },
    } }),
  card({ id: 'spark-gap', name: 'SPARK GAP', fam: 'SKIM', fams: ['SKIM', 'SHIP'], kind: 'fusion', values: [0.5],
    pack: 'fusion', halves: [['scrape', 'hair-trigger'], ['afterburner', 'bussard-scoop']],
    face: 'A hairline during a burn gives half the cell back, once a burn.',
    rule: 'The first hairline in each burn refunds half a fuel cell.',
    tell: 'spark-on-flare',
    hooks: {
      hair: (c, v, s) => {
        const ship = c.ship;
        if (!(ship.burn.t > 0) || s.spark === ship.stats.burns) return;
        s.spark = ship.stats.burns;
        if (addFuel(ship, v) > 0) fired(c, s, 'spark-gap');
      },
    } }),
  card({ id: 'close-quarters', name: 'CLOSE QUARTERS', fam: 'SKIM', fams: ['SKIM', 'RIVAL'], kind: 'fusion',
    values: [2.5], pack: 'fusion', halves: [['still-light', 'long-chain'], ['phase-hull', 'bounty']],
    face: 'Rivals passed within 2.5° are hairlines that hold the light × 2.',
    rule: 'Pass a ship close enough and it counts as a hairline, and it holds the light back twice as much.',
    tell: 'rival-hairline',
    hooks: {
      rivalPass: (c, v, s) => {
        const o = c.other, ship = c.ship, T = c.tune;
        if (!o || isOut(o) || !(c.gap >= 0 && c.gap < QUARTERS_DEG)) return;
        rivalHair(c.race, ship, o, c.gap, T);
        push(c.race, ship, 'hair', T.PB_HAIR * massK(c.race, T), T);
        fired(c, s, 'close-quarters');
      },
    } }),
  card({ id: 'star-lifter', name: 'STAR LIFTER', fam: 'WELL', fams: ['WELL', 'SHIP'], kind: 'fusion', values: [180],
    pack: 'fusion', halves: [['kick-out', 'tidal-frame'], ['ablative-tanks', 'reactive-hull']],
    face: 'Whip past 180° and you scoop a fuel cell from the star.',
    rule: 'A release past halfway round fills a fuel cell. With BUSSARD SCOOP the two fill 3 cells a leg at most.',
    tell: 'star-scoop',
    hooks: {
      release: (c, v, s, owned) => {
        const e = c.event, T = c.tune;
        if (!e || e.scorched || !(e.angle >= v)) return;
        let left = 1;
        if (owned.has('bussard-scoop')) left = Math.min(1, T.SCOOP_LIFTER_MAX - s.scoopB - s.scoopL);
        const add = addFuel(c.ship, left);
        if (add > 0) { s.scoopL += add; fired(c, s, 'star-lifter'); }
      },
    } }),
  card({ id: 'hook', name: 'HOOK', fam: 'WELL', fams: ['WELL', 'RIVAL'], kind: 'fusion', values: [1], pack: 'fusion',
    halves: [['mass-shadow'], ['slipstream', 'dirty-air']],
    face: 'Let go into a rival\'s wake and your draft starts full.',
    rule: 'A wake you enter just after a release starts at full charge, ready to slingshot.',
    tell: 'hooked-wake', patch: () => ({ WAKE_START: 1 }) }),
  card({ id: 'wrecker', name: 'WRECKER', fam: 'SHIP', fams: ['SHIP', 'RIVAL'], kind: 'fusion', values: [1],
    pack: 'fusion', halves: [['twin-deflector', 'sidestep'], ['battering-prow', 'leech-line']],
    face: 'A takedown repairs 1 hull and recharges your shield.',
    rule: 'Each ship you take down patches a hull pip and brings the shield back at once.',
    tell: 'wrecker-spark',
    hooks: {
      takedown: (c, v, s) => {
        const e = c.event, ship = c.ship;
        if (!e || e.by !== ship.id) return;
        ship.hull = Math.min(ship.hullMax, ship.hull + v);
        shieldFull(c.race, ship, c.tune, 'wrecker');
        fired(c, s, 'wrecker');
      },
    } }),

  // ---------------- legendaries (12.5): 3 of the family including a form, from break 4, one a run
  card({ id: 'cherenkov', name: 'CHERENKOV', fam: 'SKIM', kind: 'legend', values: [CHERENKOV_CHAIN], pack: 'legend',
    face: 'Chain 15+: glow blue; a knot you touch is a hairline for 10 chain.',
    rule: 'With a long chain you can plough through a knot: it counts as a hairline and costs 10 of the chain. '
      + 'Walls, rails and giants still hit. (Vacuum makes no Cherenkov light: the glow is the game\'s.)',
    tell: 'blue-glow-chain-15',
    hooks: {
      pass: (c, v, s) => {
        const ship = c.ship, it = c.item;
        if (!c.res.hit || ship.chain < v || (it.kind !== 'knot' && it.kind !== 'pulse')) return;
        toHair(c);
        ship.chain = Math.max(0, ship.chain - CHERENKOV_COST);
        fired(c, s, 'cherenkov');
      },
    } }),
  card({ id: 'slingshot-home', name: 'SLINGSHOT HOME', fam: 'WELL', kind: 'legend', values: [1], pack: 'legend',
    face: 'Gate giants become great wells: whip one and fling through the gap.',
    rule: 'The larger giant at each gate is a landmark well. A release through the THREAD gap is a thread plus the '
      + 'whip\'s gain.',
    tell: 'gate-well', mods: { gateWell: true } }),
  card({ id: 'lifeboat', name: 'LIFEBOAT', fam: 'SHIP', kind: 'legend', values: [1], pack: 'legend',
    face: 'When your last hull breaks, fly on in a tiny, faster lifeboat.',
    rule: 'A second life: half as wide, a burn faster, no shield, and the next hit wrecks you. A dock rebuilds the '
      + 'ship at 1 hull.',
    tell: 'lifeboat',
    hooks: {
      damage: (c, v, s) => {
        const ship = c.ship, T = c.tune;
        if (c.cancel || c.use !== 'hull' || s.lifeboat || ship.hull - (c.amount || 1) > 0) return;
        c.cancel = true;
        s.lifeboat = true;
        ship.hull = 1;
        ship.shield = 0;
        ship.shieldMax = 0;
        ship.half = ship.half / 2;
        addEta(ship, T.BURN_ETA, T);
        fired(c, s, 'lifeboat');
      },
    } }),
  card({ id: 'pack-leader', name: 'PACK LEADER', fam: 'RIVAL', kind: 'legend', values: [PACK_ETA], pack: 'legend',
    face: 'Drafters push you on, and ships that rear-end you take the hit.',
    rule: 'Each ship in your wake adds speed and lead every second, and a ship that runs into your tail is the one '
      + 'that is hit.',
    tell: 'pack-arrows',
    hooks: {
      step: (c, v, s) => {
        const race = c.race, ship = c.ship, T = c.tune, dt = c.dt || 0;
        let n = 0;
        for (const o of race.ships) if (o !== ship && !isOut(o) && o.draft.lead === ship.id) n++;
        if (!n || !(dt > 0)) return;
        addEta(ship, v * n * dt, T);
        push(race, ship, 'pack', PACK_GAP * n * dt * massK(race, T), T);
      },
      contact: (c, v, s) => {
        const e = c.event, ship = c.ship;
        if (!e || e.kind !== 'rear' || e.victim !== ship.id) return;
        const o = shipById(c.race, e.by);
        if (!o || isOut(o)) return;
        if (ship.shove) ship.shove.left = 0;
        if (typeof H.hit === 'function') H.hit(c.race, o, 'rear', c.tune, null);
        fired(c, s, 'pack-leader');
      },
    } }),

  // ---------------- trophies (12.8): always Rare, no fusion tag; they count toward legendaries
  card({ id: 'hounds-bite', name: 'HOUND\'S BITE', fam: 'RIVAL', kind: 'trophy', from: 'hound', values: [2],
    pack: 'trophy', minR: 1, face: 'Takedowns pay 2 fuel, and a ram at 120°/s is a SLAM.',
    rule: 'HOUND\'s trophy. Your takedowns pay a second cell, and a slower ram still slams.',
    tell: 'hound-teeth', patch: (v, T) => ({ SLAM_V: Math.min(T.SLAM_V, 120) }),
    hooks: {
      takedown: (c, v, s) => {
        const e = c.event;
        if (!e || e.by !== c.ship.id) return;
        if (addFuel(c.ship, v - c.tune.TAKEDOWN_FUEL) > 0) fired(c, s, 'hounds-bite');
      },
    } }),
  card({ id: 'pikes-door', name: 'PIKE\'S DOOR', fam: 'RIVAL', kind: 'trophy', from: 'pike', values: [1],
    pack: 'trophy', minR: 1, face: 'A ship that rear-ends you loses a burn of speed. You lose nothing.',
    rule: 'PIKE\'s trophy. Your tail is a door: a ship that runs into it loses a burn\'s worth of speed, and you are '
      + 'not pushed.',
    tell: 'pike-door',
    hooks: {
      contact: (c, v, s) => {
        const e = c.event, ship = c.ship, T = c.tune;
        if (!e || e.kind !== 'rear' || e.victim !== ship.id) return;
        const o = shipById(c.race, e.by);
        if (!o || isOut(o)) return;
        o.eta = Math.max(T.ETA_MIN, o.eta - Math.max(0, T.BURN_ETA - T.REAR_ETA));
        if (ship.shove) ship.shove.left = 0;
        fired(c, s, 'pikes-door');
      },
    } }),
  card({ id: 'remoras-grip', name: 'REMORA\'S GRIP', fam: 'RIVAL', kind: 'trophy', from: 'remora', values: [1.2],
    pack: 'trophy', minR: 1, face: 'Your draft reaches 1.2 s back and fills in 0.6 s.',
    rule: 'REMORA\'s trophy. You can tuck in further back, and the draft charges in half the time.',
    tell: 'remora-ring', patch: () => ({ WAKE_FAR: 1.2, DRAFT_FILL: 0.6 }) }),
  card({ id: 'moths-dance', name: 'MOTH\'S DANCE', fam: 'SKIM', kind: 'trophy', from: 'moth', values: [2],
    pack: 'trophy', minR: 1, face: 'In the glare, grazes hold the light × 2 and a hairline gives a cell.',
    rule: 'MOTH\'s trophy. In the glare every graze pushes the light back twice as far, and each hairline fills a '
      + 'whole fuel cell.',
    tell: 'moth-wings',
    hooks: {
      graze: (c, v, s) => {
        const ship = c.ship, T = c.tune;
        if (ship.light !== 'glare') return;
        push(c.race, ship, 'graze', T.PB_GRAZE * (v - 1) * massK(c.race, T), T);
        fired(c, s, 'moths-dance');
      },
      hair: (c, v, s) => {
        const ship = c.ship, T = c.tune;
        if (ship.light !== 'glare') return;
        push(c.race, ship, 'hair', T.PB_HAIR * (v - 1) * massK(c.race, T), T);
        addFuel(ship, 1);
        fired(c, s, 'moths-dance');
      },
    } }),
];

function longChain(c, s) {
  s.chainGrazes++;
  if (s.chainGrazes % 10 !== 0) return;
  const ship = c.ship;
  if (ship.shield < ship.shieldMax) { shieldFull(c.race, ship, c.tune, 'long-chain'); fired(c, s, 'long-chain'); }
}

function kickOut(c, v, s, left0) {
  const ship = c.ship, W = ship.whip;
  if (!W || W.latched || !(W.angle >= v)) return;
  cancelBurn(ship, left0);
  const rel = forceRelease(c.race, ship, c.tune);
  if (!rel) return;
  fired(c, s, 'kick-out');
  // the release comes from inside a hook, past what cardHooks walks this step, so its own hooks run here (STAR
  // LIFTER, MASS SHADOW, LENSED LANE, the run log); the one exception to "events a hook emits run no hooks"
  runHooks(c.race, E.release, { race: c.race, ship, event: rel, tune: c.tune });
}

function afterGraze(c, s, hair) {
  const ship = c.ship, T = c.tune;
  if (!(ship.burn.t > 0)) return;
  addEta(ship, hair ? T.KICK_HAIR : T.KICK, T);
  ship.chain++;
  push(c.race, ship, hair ? 'hair' : 'graze', (hair ? T.PB_HAIR : T.PB_GRAZE) * massK(c.race, T), T);
  fired(c, s, 'afterburner');
}

export const CARDS = Object.freeze(LIST.map((c) => Object.freeze({
  fams: c.fams || [c.fam], minR: 0, tag: null, amounts: null, halves: null, from: null, patch: null, hooks: null,
  mods: null, ...c,
})));
export const CARD = Object.freeze(Object.fromEntries(CARDS.map((c) => [c.id, c])));
export const STARTERS = Object.freeze(CARDS.filter((c) => c.pack === 'starter').map((c) => c.id));
export const FUSIONS = Object.freeze(CARDS.filter((c) => c.kind === 'fusion').map((c) => c.id));
export const LEGENDS = Object.freeze(CARDS.filter((c) => c.kind === 'legend').map((c) => c.id));
export const TROPHIES = Object.freeze(CARDS.filter((c) => c.kind === 'trophy').map((c) => c.id));
export const TROPHY_OF = Object.freeze(Object.fromEntries(CARDS.filter((c) => c.from).map((c) => [c.from, c.id])));

// The hook points a card may use: 12.9's, plus any event type (race.js runs hooks for every event that is yours).
export const HOOK_POINTS = Object.freeze(['pass', 'graze', 'hair', 'burn', 'oberth', 'release', 'redIn', 'grab', 'hit',
  'damage', 'shieldPop', 'rivalPass', 'takedown', 'contact', 'step']);

// ---------------------------------------------------------------- values and faces

// The rarity a card shows at: a Rare-only card that rolls Common shows as Rare. Fusions and legendaries have one form.
export function rarityOf(id, r = 0) {
  const c = CARD[id];
  if (!c) return 0;
  if (c.kind === 'fusion' || c.kind === 'legend') return 0;
  return Math.max(c.minR || 0, Math.min(2, r | 0));
}
const pickR = (arr, r) => arr[Math.min(arr.length - 1, Math.max(0, r))];
// The number the rule uses at a rarity.
export function amountOf(id, r = 0) {
  const c = CARD[id];
  if (!c) return 0;
  const k = rarityOf(id, r);
  return pickR(c.amounts || c.values, k);
}
// The value the face shows at a rarity, as text. In a row with a fraction a whole number keeps one decimal, as 12.3
// writes them ("× 0.85 / × 0.9 / × 1.0", "1.0 / 1.5 / 2.0 s").
export function valueOf(id, r = 0) {
  const c = CARD[id];
  if (!c) return '';
  const x = pickR(c.values, rarityOf(id, r));
  if (typeof x !== 'number') return String(x);
  const frac = c.values.some((v) => typeof v === 'number' && !Number.isInteger(v));
  return frac && Number.isInteger(x) ? x.toFixed(1) : String(x);
}

// The card face (12.7): { id, title, text, num, before, after, tag, kind, fam, fams, colour, band, glyph, frame, r,
// rarity }. text is the effect line with its number in place; before / num / after split it so the number can be
// orange. tag: 'FORM', 'REPLACES X', '→ SHIP: SPARK GAP', 'COMPLETES SPARK GAP', 'FUSION', 'LEGENDARY', 'TROPHY'.
// build: the owned cards ([{ id, r }]) for the REPLACES and COMPLETES lines.
export function faceOf(id, r = 0, build = []) {
  const c = CARD[id];
  if (!c) return null;
  const k = rarityOf(id, r);
  const v = String(valueOf(id, k));
  const at = c.face.indexOf('{v}');
  const before = at < 0 ? c.face : c.face.slice(0, at);
  const after = at < 0 ? '' : c.face.slice(at + 3);
  const owned = new Set((build || []).map((b) => b.id));
  let tag = c.kind === 'form' ? 'FORM' : c.kind === 'fusion' ? 'FUSION' : c.kind === 'legend' ? 'LEGENDARY'
    : c.kind === 'trophy' ? 'TROPHY' : '';
  const repl = replacesOf(id, build);
  if (repl) tag = `REPLACES ${CARD[repl].name}`;
  else if (c.tag) {
    const f = fusionFor(id);
    const done = f && completes(id, build);
    tag = done ? `COMPLETES ${CARD[f].name}` : f ? `→ ${c.tag}: ${CARD[f].name}` : tag;
  }
  const F = FAMILIES[c.fam];
  return {
    id, title: c.name, text: before + (at < 0 ? '' : v) + after, num: at < 0 ? null : v, before, after, tag,
    kind: c.kind, fam: c.fam, fams: c.fams, colour: F.colour, band: F.band, glyph: F.glyph, r: k,
    rarity: c.kind === 'fusion' ? 'FUSION' : c.kind === 'legend' ? 'LEGENDARY' : RARITY[k],
    frame: c.kind === 'fusion' ? 'fusion' : c.kind === 'legend' ? 'legend' : RARITY[k].toLowerCase(),
    owned: owned.has(id), orange: Boolean(tag && tag.startsWith('COMPLETES')),
  };
}

// The form a form card would replace in this build, or null.
export function replacesOf(id, build = []) {
  const c = CARD[id];
  if (!c || c.kind !== 'form') return null;
  for (const b of build || []) {
    const o = CARD[b.id];
    if (o && o.id !== id && o.kind === 'form' && o.fam === c.fam) return o.id;
  }
  return null;
}
// The fusion a starter is a half of.
export function fusionFor(id) {
  for (const f of FUSIONS) if (CARD[f].halves.some((h) => h.includes(id))) return f;
  return null;
}
// Would taking this card complete its fusion (the other half is owned)?
export function completes(id, build = []) {
  const f = fusionFor(id);
  if (!f) return false;
  const owned = new Set((build || []).map((b) => b.id));
  if (owned.has(f)) return false;
  const [a, b] = CARD[f].halves;
  const side = a.includes(id) ? b : a;
  return side.some((x) => owned.has(x));
}
// The fusions a build has both halves of.
export function fusionsReady(build = []) {
  const owned = new Set((build || []).map((b) => b.id));
  return FUSIONS.filter((f) => CARD[f].halves.every((h) => h.some((x) => owned.has(x))));
}
// The legendaries a build qualifies for: LEGEND_N cards of the family (traits and trophies count, fusions do not),
// one of them a form.
export function legendsReady(build = [], tune = TUNE) {
  const out = [];
  for (const l of LEGENDS) {
    const fam = CARD[l].fam;
    let n = 0, form = false;
    for (const b of build || []) {
      const c = CARD[b.id];
      if (!c || c.fam !== fam || c.kind === 'fusion' || c.kind === 'legend') continue;
      n++;
      if (c.kind === 'form') form = true;
    }
    if (n >= tune.LEGEND_N && form) out.push(l);
  }
  return out;
}

// TUNE at a dock (9.2): one card up a rarity, C → R → E. Fusions and legendaries have one rarity and trophies are
// always Rare, so only starters below Epic can be tuned. → the ids in the build that can go up.
export function tunable(build = []) {
  return (build || []).filter((b) => b && CARD[b.id] && CARD[b.id].pack === 'starter' && rarityOf(b.id, b.r) < 2)
    .map((b) => b.id);
}
// Raise card id one rarity in the build (in place). → the new rarity, or null if it cannot go up.
export function tuneUp(build, id) {
  const b = (build || []).find((x) => x && x.id === id);
  if (!b || !tunable(build).includes(id)) return null;
  b.r = rarityOf(id, rarityOf(id, b.r) + 1);
  return b.r;
}
// Undo a tune (a refund before launch): back to `to` if given, else one rarity down. → the rarity after, or null.
export function tuneDown(build, id, to = null) {
  const b = (build || []).find((x) => x && x.id === id);
  if (!b || !CARD[id] || CARD[id].pack !== 'starter') return null;
  b.r = rarityOf(id, to === null ? rarityOf(id, b.r) - 1 : to);
  return b.r;
}

// ---------------------------------------------------------------- applyBuild

const cloneTune = (T) => {
  const out = {};
  for (const k of Object.keys(T)) {
    const v = T[k];
    out[k] = Array.isArray(v) ? v.slice() : v && typeof v === 'object' ? { ...v } : v;
  }
  return out;
};
function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const k of Object.keys(o)) freeze(o[k]);
  }
  return o;
}

// 12.6's caps on a patched tuning table (in place).
export function capTune(T) {
  if (T.GRAZE > CAPS.GRAZE) T.GRAZE = CAPS.GRAZE;
  if (T.HAIR > CAPS.HAIR) T.HAIR = CAPS.HAIR;
  if (T.SHIELD_MAX > CAPS.SHIELD_MAX) T.SHIELD_MAX = CAPS.SHIELD_MAX;
  if (T.FUEL_CAP > T.FUEL_CAP_MAX) T.FUEL_CAP = T.FUEL_CAP_MAX;
  if (T.FUEL0 > T.FUEL_CAP) T.FUEL0 = T.FUEL_CAP;
  if (T.HULL_MAX > T.HULL_CAP) T.HULL_MAX = T.HULL_CAP;
  if (T.HULL0 > T.HULL_MAX) T.HULL0 = T.HULL_MAX;
  if (T.WHIP_GAIN_X > CAPS.WHIP_X) T.WHIP_GAIN_X = CAPS.WHIP_X;
  if (T.WHIP_GAIN_X * Math.max(1, T.RED_X) > CAPS.WHIP_X) T.RED_X = CAPS.WHIP_X / T.WHIP_GAIN_X;
  return T;
}

// The build ([{ id, r }]) as a patched copy of the tuning table (within 12.6's caps), the hooks by hook point in build
// order, and the course mods. An empty build returns the same tune object. Unknown ids are skipped.
// → { tune, hooks: { [point]: [fn(ctx)] }, mods: { gateWell? }, cards: [id] }
export function applyBuild(build, tune = TUNE) {
  const list = (build || []).filter((b) => b && CARD[b.id]);
  if (!list.length) return { tune, hooks: {}, mods: {}, cards: [] };
  const T = cloneTune(tune);
  const hooks = {}, mods = {};
  const owned = new Set(list.map((b) => b.id));
  for (const b of list) {
    const c = CARD[b.id], v = amountOf(c.id, b.r);
    if (c.patch) Object.assign(T, c.patch(v, T));
    if (c.mods) Object.assign(mods, c.mods);
    if (c.hooks) {
      for (const [name, fn] of Object.entries(c.hooks)) {
        (hooks[name] || (hooks[name] = [])).push((ctx) => fn(ctx, v, cardState(ctx.race), owned));
      }
    }
  }
  return { tune: freeze(capTune(T)), hooks, mods, cards: list.map((b) => b.id) };
}

// ---------------------------------------------------------------- ship quirks (14.3) that act through hooks

// TUG: rams on you shove half as far and spill nothing. (Its SLAM_V 140 and the other ships' numbers are patches in
// meta.js's SHIPS.) → { [point]: [fn(ctx)] }
export function shipHooks(type) {
  if (type !== 'tug') return {};
  return {
    contact: [(ctx) => {
      const e = ctx.event, ship = ctx.ship;
      if (!e || e.victim !== ship.id || e.kind !== 'slam' || !ship.shove) return;
      ship.shove.left /= 2;
      ship.shove.v /= 2;
    }],
    spill: [(ctx) => {
      const e = ctx.event, ship = ctx.ship;
      if (!e || e.ship !== ship.id || !e.to || e.by) return;
      const o = shipById(ctx.race, e.to);
      ship.fuel += e.amount;
      if (o) o.fuel = Math.max(0, o.fuel - (e.taken || 0));
    }],
  };
}

// Join hook tables (build order, then the extra ones).
export function mergeHooks(...tables) {
  const out = {};
  for (const t of tables) {
    if (!t) continue;
    for (const [k, list] of Object.entries(t)) (out[k] || (out[k] = [])).push(...list);
  }
  return out;
}

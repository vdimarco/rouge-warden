// Ahead of the Light: the offer (final.md 12.2): rarity rows, pity, the slots, fusions and legendaries due, trophies,
// the 4th card, the RISK picks, the first offer ever, rerolls and banishes. makeOffer reads the run and draws only from
// the rng it is given (run.js passes the break's own stream), so the same seed and choices give the same offers.
// Pure.
import { TUNE } from './tune.js';
import { CARD, CARDS, STARTERS, FAMS, rarityOf, replacesOf, completes } from './cards.js';

// The RISK lane's reward (11.3; critic lead item 2, first option, as the offer sim confirmed risk 7: pick 2 of 3 gave
// a RISK-every-leg player 13 picks, a legendary in 88 to 95 % of planned runs and one starter in 58 % of builds):
// pick 1 of 4, every card Rare or better. A URL RISK_PICKS of 2 or more that differs from the table's brings back
// "pick n of 3, one Rare or better" for comparison. → { four, picks }
export function riskRule(tune = TUNE) {
  const n = Math.round(tune.RISK_PICKS);
  if (n >= 2 && n !== TUNE.RISK_PICKS) return { four: false, picks: n };
  return { four: true, picks: 1 };
}

// The first offer ever (12.2, critic C5): one card for each verb leg 1 taught, all Common.
export const FIRST_OFFER = Object.freeze(['hair-trigger', 'slow-orbit', 'afterburner']);
export const FIRST_CAPTION = 'PICK ONE · IT CHANGES HOW YOU FLY';

// Place sets the offer's rarity row (critic lead item 5, first option): rows moved by your place among you and the
// named ships through the gate line. 1st one row up; 2nd and 3rd as the leg says; 4th or lower one row down.
export const PLACE_SHIFT = Object.freeze([0, 1, 0, 0, -1]);
export const placeShift = (place) => (place > 0 ? PLACE_SHIFT[Math.min(place, PLACE_SHIFT.length - 1)] : 0);

// The rarity row after break b (the leg just finished is b): legs 1, 2, 3, 4 to 5, 6 to 7.
export function baseRow(b) {
  if (b <= 1) return 0;
  if (b === 2) return 1;
  if (b === 3) return 2;
  if (b <= 5) return 3;
  return 4;
}

// The chances [Common, Rare, Epic] in whole percents for a row and a pity count (points moved from Common to Rare).
export function rarityChances(row, pity = 0, tune = TUNE) {
  const R = tune.RARITY[Math.max(0, Math.min(tune.RARITY.length - 1, row))];
  const move = Math.max(0, Math.min(R[0], pity));
  return [R[0] - move, R[1] + move, R[2]];
}

// Roll one card's rarity: → { r, pity } (the pity after this card, from what it shows).
export function rollRarity(row, pity, rng, tune = TUNE, minR = 0) {
  const [c, r] = rarityChances(row, pity, tune);
  const x = rng() * 100;
  let k = x < c ? 0 : x < c + r ? 1 : 2;
  if (k < minR) k = minR;
  return { r: k, pity: k === 0 ? pity + tune.PITY_STEP : 0 };
}

// Families taught so far (12.2 teaching): on a player's first TEACH_RUNS runs SKIM, SHIP and WELL join after leg 1 and
// RIVAL from break 2; after that every family from break 1.
export function taughtFams(run, b, tune = TUNE) {
  const runs = (run.seen && run.seen.runs) || 0;
  if (runs >= tune.TEACH_RUNS || b >= 2) return FAMS;
  return ['SKIM', 'WELL', 'SHIP'];
}

const ownedIds = (run) => new Set((run.build || []).map((b) => b.id));
const hasLegend = (run) => (run.build || []).some((b) => CARD[b.id] && CARD[b.id].kind === 'legend');

// Specials (fusions, legendaries, trophies) the run has met: shown in an earlier offer, so in the pool at normal odds.
export function announced(run) {
  const out = new Set();
  for (const l of run.legs || []) for (const id of l.offered || []) if (CARD[id] && CARD[id].pack !== 'starter') out.add(id);
  return out;
}

// The cards an offer may draw for this run: the starters, every trophy earned (this run or before: they join the
// pool for good), and the fusions and legendaries already announced; minus owned, banished and untaught families, and
// minus every legendary once one is owned.
export function poolOf(run, b = run.leg + 1, tune = TUNE) {
  const owned = ownedIds(run), banned = new Set(run.banned || []);
  const fams = new Set(taughtFams(run, b, tune));
  const legendDone = hasLegend(run);
  const ids = new Set(STARTERS);
  for (const t of (run.seen && run.seen.trophies) || []) if (CARD[t]) ids.add(t);
  for (const id of announced(run)) ids.add(id);
  const out = [];
  for (const id of ids) {
    const c = CARD[id];
    if (!c || owned.has(id) || banned.has(id)) continue;
    if (legendDone && c.kind === 'legend') continue;
    if (!c.fams.some((f) => fams.has(f))) continue;
    out.push(id);
  }
  // CARDS order, so a pool never depends on Set insertion
  const order = new Map(CARDS.map((c, i) => [c.id, i]));
  return out.sort((a, z) => order.get(a) - order.get(z));
}

// The leg record the offer answers to (the last one).
const lastLeg = (run) => (run.legs && run.legs.length ? run.legs[run.legs.length - 1] : {});

// The rarity row for this break: the leg's row, one up on RISK, place (lead item 5), one up for the GHOST ship.
export function rowFor(run, b = run.leg + 1) {
  const L = lastLeg(run);
  let row = baseRow(b);
  if (L.kind === 'risk') row += 1;
  row += placeShift(L.place);
  if (run.ship === 'ghost') row += 1;
  return Math.max(0, Math.min(4, row));
}

// One card from a list of ids, uniform, never one already shown.
function draw(ids, shown, rng) {
  const c = ids.filter((id) => !shown.has(id));
  if (!c.length) return null;
  return c[Math.min(c.length - 1, Math.floor(rng() * c.length))];
}

// The next offer: { break, cards: [{ id, r, slot, why, replaces, completes }], picks, taken: [], skip, row, risk,
// family, bonus, first, caption, special, pity }. slot: 1 to 4. why: 'first' | 'family' | 'owned' | 'new' | 'pool' |
// 'special' | 'trophy' | 'bonus'. skip: 'fuel', or 'reroll' when your tanks are full. pity: the pity after this
// offer's rolls (run.js stores it in run.pity).
export function makeOffer(run, rng, tune = TUNE) {
  const T = tune, b = run.leg + 1, L = lastLeg(run);
  const full = run.you && run.you.fuel >= run.you.fuelCap - 1e-9;
  const base = { break: b, cards: [], picks: 1, taken: [], skip: full ? 'reroll' : 'fuel', row: 0, risk: false,
    family: null, bonus: null, first: false, caption: null, special: null, pity: run.pity || 0 };

  // the first offer ever: fixed, all Common
  if (b === 1 && !(run.seen && run.seen.offered)) {
    const owned = ownedIds(run);
    const ids = FIRST_OFFER.filter((id) => !owned.has(id));
    base.first = true;
    base.caption = FIRST_CAPTION;
    base.cards = ids.map((id, i) => ({ id, r: 0, slot: i + 1, why: 'first' }));
    if (base.cards.length < T.OFFER_N) {
      const pool = poolOf(run, b, T), shown = new Set(ids);
      while (base.cards.length < T.OFFER_N) {
        const id = draw(pool, shown, rng);
        if (!id) break;
        shown.add(id);
        base.cards.push({ id, r: 0, slot: base.cards.length + 1, why: 'pool' });
      }
    }
    return finish(run, base);
  }

  const pool = poolOf(run, b, T);
  const shown = new Set();
  const owned = ownedIds(run);
  const ownFams = new Set();
  for (const id of owned) if (CARD[id]) for (const f of CARD[id].fams) ownFams.add(f);
  const inFam = (fam) => pool.filter((id) => CARD[id].fams.includes(fam));
  const cards = [];
  const put = (id, slot, why) => { if (id) { shown.add(id); cards.push({ id, r: 0, slot, why }); } };

  // slot 3's special: the first fusion, legendary or trophy due (one an offer; the next waits)
  const due = (run.pending || []).find((p) => CARD[p.id] && !owned.has(p.id)
    && !(CARD[p.id].kind === 'legend' && hasLegend(run)));
  if (due) shown.add(due.id);
  // at most one legendary in an offer, so no pick can take two
  let legend = Boolean(due && CARD[due.id].kind === 'legend');
  const pull = (ids) => {
    const id = draw(legend ? ids.filter((x) => CARD[x].kind !== 'legend') : ids, shown, rng);
    if (id && CARD[id].kind === 'legend') legend = true;
    return id;
  };

  // slots 1 and 2: a FAMILY lane's family; else one family you own and one you do not
  if (L.kind === 'family' && L.fam) {
    base.family = L.fam;
    put(pull(inFam(L.fam)) || pull(pool), 1, 'family');
    put(pull(inFam(L.fam)) || pull(pool), 2, 'family');
  } else {
    const mine = pool.filter((id) => CARD[id].fams.some((f) => ownFams.has(f)));
    const theirs = pool.filter((id) => !CARD[id].fams.some((f) => ownFams.has(f)));
    put(pull(mine) || pull(pool), 1, 'owned');
    put(pull(theirs) || pull(pool), 2, 'new');
  }
  // slot 3: the special or trophy, else the whole pool
  if (due) {
    cards.push({ id: due.id, r: 0, slot: 3, why: CARD[due.id].kind === 'trophy' ? 'trophy' : 'special' });
    base.special = due.id;
  } else put(pull(pool), 3, 'pool');
  // slot 4: first of the named ships through the gate, a boss beaten, or LUCKY STAR (1 offer in 5)
  const lucky = Boolean(run.seen && run.seen.lucky) && rng() < 0.2;
  const bonus = L.place === 1 ? 'first' : L.bossBeaten ? 'boss' : lucky ? 'lucky' : null;
  if (bonus) { base.bonus = bonus; put(pull(pool), 4, 'bonus'); }
  // RISK (riskRule): pick 1 of 4, Rare or better: a 4th card when no bonus gave one
  const rule = riskRule(T);
  const riskFour = L.kind === 'risk' && rule.four;
  if (riskFour && cards.length < T.BONUS_N) put(pull(pool), 4, 'risk');

  // rarities: the row, pity, Rare-only cards; trophies always Rare; fusions and legendaries have one form
  const row = rowFor(run, b);
  let pity = run.pity || 0;
  for (const c of cards) {
    const card = CARD[c.id];
    if (card.kind === 'trophy') { c.r = 1; continue; }
    if (card.kind === 'fusion' || card.kind === 'legend') { c.r = 0; continue; }
    const out = rollRarity(row, pity, rng, T, card.minR || 0);
    c.r = out.r;
    pity = out.pity;
  }
  base.row = row;
  base.pity = pity;

  // RISK: more picks, one row up (in rowFor), at least one Rare or better
  if (riskFour) {
    base.risk = true;
    base.picks = 1;
    for (const c of cards) if (CARD[c.id].pack === 'starter' && c.r < 1) c.r = 1;
    base.pity = 0;
  } else if (L.kind === 'risk') {
    base.risk = true;
    base.picks = rule.picks;
    if (!cards.some((c) => c.r >= 1)) {
      const up = [...cards].reverse().find((c) => CARD[c.id].kind !== 'fusion' && CARD[c.id].kind !== 'legend');
      if (up) { up.r = 1; base.pity = 0; }
    }
  }
  // BOUNTY paid: one more pick, and the weakest card rises to the bounty's rarity
  if (L.bounty !== undefined && L.bounty !== null && L.bounty !== false) {
    base.picks += 1;
    const min = Math.max(0, Math.min(2, Number(L.bounty) || 0));
    const low = cards.filter((c) => CARD[c.id].pack === 'starter').sort((a, z) => a.r - z.r)[0];
    if (low && low.r < min) low.r = min;
  }
  base.cards = cards;
  return finish(run, base);
}

// The faces' build-dependent lines: REPLACES and COMPLETES.
function finish(run, offer) {
  for (const c of offer.cards) {
    c.r = rarityOf(c.id, c.r);
    c.replaces = replacesOf(c.id, run.build);
    c.completes = completes(c.id, run.build);
  }
  offer.picks = Math.min(offer.picks, offer.cards.length || 1);
  return offer;
}

// A fresh card for slot i of an open offer (after a banish): the slot's own rule, a new rarity roll. → the card or null.
export function refill(run, offer, i, rng, tune = TUNE) {
  const old = offer.cards[i];
  if (!old) return null;
  const pool = poolOf(run, offer.break, tune);
  const shown = new Set(offer.cards.map((c) => c.id));
  let id = null;
  if (old.why === 'family' && offer.family) id = draw(pool.filter((x) => CARD[x].fams.includes(offer.family)), shown, rng);
  if (!id) id = draw(pool, shown, rng);
  if (!id) return null;
  const card = CARD[id];
  const out = card.kind === 'trophy' ? { r: 1, pity: run.pity || 0 } : rollRarity(offer.row, run.pity || 0, rng, tune,
    card.minR || 0);
  const c = { id, r: rarityOf(id, out.r), slot: old.slot, why: old.why, replaces: replacesOf(id, run.build),
    completes: completes(id, run.build) };
  return { card: c, pity: out.pity };
}

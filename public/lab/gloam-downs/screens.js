// Gloam Downs: what the run's screens show. The HUD's health line, the wick buttons, the Lamp-room's rows and buttons, the run
// summary, the pause panel's places and the card that a load of the page opens, all from the run's save (run-save.js) and its rules
// (run.js). No DOM, so the Node test reads the same texts and choices that the page shows; main.js builds the cards from them.
import { ORDER } from './save.js';
import { WICKS, UPGRADES, UNLOCKS, EMBER, BASE, maxOf, flasksOf } from './run.js';
import { relicOf, kindled, KINDLE } from './relics.js';

export const NUMERAL = ['I', 'II', 'III', 'IV', 'V'];
export const NAMES = { gaol: 'The Sunken Gaol', ramparts: 'The Crow Wall', fen: 'Lantern Fen', bells: 'The Bell Knoll', barrows: 'Barrow Crown' };
export const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export const placeLine = id => `${NUMERAL[ORDER.indexOf(id)]} · ${NAMES[id]}`;

/* ---------------- game time ----------------
   In a run the toasts, the arrival card, the fade to ink and the waits before the beacon card and the summary count steps of the game
   clock, so __gloam.tick moves them, and they wait while a card or the pause panel shows */
export const stepsOf = ms => Math.round((ms * 60) / 1000);
export const INK = 72; // the fade to ink at death, 1.2 s, and then the run summary
export const inkAt = since => (since < 0 ? 0 : Math.min(1, since / INK));
// the modes in which the game clock runs: play, the fade after a death, the waits after a lit beacon and after the win, and the boss
// intro's stop
export const TIMED = ['play', 'dying', 'lit', 'won', 'intro'];

/* ---------------- the HUD ----------------
   The health line: the number, a bar filled by the share of the maximum, and a pip for each flask, full or spent. Below 30% the bar
   shows its fire edge (fight.js adds the beat). The count line: wisps of this place and the glim carried */
export const LOW = 0.3;
export function hudOf(rs, wisps = 0) {
  const run = rs.run;
  if (!run) return null;
  const max = maxOf(rs), fl = flasksOf(rs), share = Math.max(0, Math.min(1, run.hp / max));
  return {
    text: `${run.hp}/${max}`, share, low: run.hp > 0 && share < LOW, pips: Array.from({ length: fl }, (_, i) => i < run.flasks),
    wisps, glim: run.carried, count: `◆ ${wisps}/5 wisps · ● ${run.carried} glim`
  };
}

/* ---------------- the beacon card ---------------- */
export const wickLine = id => { const w = WICKS.find(x => x.id === id); return w ? `${w.name} · ${w.text}` : ''; };
export const wickName = id => WICKS.find(x => x.id === id)?.name || '';

/* ---------------- the Lamp-room ----------------
   Each row shows what the next level gives and its cost, as "Mantle 1 · +15 health · 40 glim". An upgrade of one level has no
   number. At its top level the row reads "Mantle 3 · all bought", and it has no Buy button. A Buy button with too little glim is
   off and says how much more is needed; it stays in the focus order (aria-disabled), so the focus stays on it after a buy */
const GIVES = {
  mantle: () => '+15 health',
  flask: () => '+1 flask',
  edge: () => '+12% blade damage',
  draught: next => `heal ${Math.round((BASE.heal + 0.1 * next) * 100)}%`,
  ash: () => 'keep 55% of glim'
};
export function upgradeRow(rs, id) {
  const u = UPGRADES.find(x => x.id === id), lvl = rs.up[id] || 0, max = u.costs.length, top = lvl >= max;
  const name = max > 1 ? `${u.name} ${top ? lvl : lvl + 1}` : u.name;
  const cost = top ? 0 : u.costs[lvl], need = top ? 0 : Math.max(0, cost - rs.bank);
  return {
    id, lvl, max, top, cost, need,
    label: top ? `${name} · all bought` : `${name} · ${GIVES[id](lvl + 1)} · ${cost} glim`,
    buy: top ? null : need ? `${need} more glim` : 'Buy'
  };
}
export const upgradeRows = rs => UPGRADES.map(u => upgradeRow(rs, u.id));
/* The Lamp-room's own buttons, in their order, and the main one (it takes the focus) and the back one (B and Escape):
   - from a beacon card: Back to the beacon alone, as main and back;
   - else Begin the run, or Go on with the run while a run is in progress;
   - from Wander's Map, Back to Wander beside it, as the back action; elsewhere Wander once it is open (stage 3 opens it), and before
     that Explore, so a player who has seen the run's first card can still reach the explorer, with no foes */
export function lampButtons(rs, from = null, wanderOpen = false) {
  if (from === 'beacon') return { list: ['back'], main: 'back', back: 'back' };
  const go = rs.run ? 'goon' : 'begin';
  if (from === 'wander') return { list: [go, 'toWander'], main: go, back: 'toWander' };
  return { list: [go, wanderOpen ? 'wander' : 'explore'], main: go, back: null };
}
export const LAMP_LABELS = { back: 'Back to the beacon', begin: 'Begin the run', goon: 'Go on with the run', toWander: 'Back to Wander', wander: 'Wander', explore: 'Explore' };

/* ---------------- the page's two modes ----------------
   The page opens the combat run by default, because a player expects a click to attack. ?explore opens the explorer, with no foes;
   ?wander (Wander, still to be built) opens it too. ?run and #run always mean the run, so old links keep working */
const EXPLORE = ['explore', 'wander'];
export function isRun(search = '', hash = '') {
  const q = new URLSearchParams(search);
  if (q.has('run') || /^#run\b/.test(hash)) return true;
  return !EXPLORE.some(k => q.has(k));
}
/* the address of the other mode: the mode words come out of the query and the rest stays (a share key such as _vercel_share, ?test).
   'run' needs no word, since the run is the default; 'explore' and 'wander' put their own word first. The hash is dropped, so a #run
   does not keep a player in the run */
export function modeHref(path, search, mode) {
  const q = new URLSearchParams(search);
  for (const k of ['run', ...EXPLORE]) q.delete(k);
  const rest = q.toString().replace(/=(?=&|$)/g, '');
  const parts = [mode === 'run' ? '' : mode, rest].filter(Boolean);
  return path + (parts.length ? `?${parts.join('&')}` : '');
}

/* ---------------- the run summary ---------------- */
export function summaryOf(e, route = ORDER) {
  const at = route.indexOf(e.place);
  return {
    title: e.won ? 'The downs are lit' : 'The lamp goes out',
    rows: [['Reached', at >= 0 ? `${NUMERAL[at]} · ${NAMES[e.place]}` : placeLine(e.place)], ['Time', fmt(e.time)], ['Foes put out', String(e.foes)], ['Glim lost', `${e.lost} glim`], ['Glim banked', `${e.banked} glim`]]
  };
}

/* the win card: the time, the best winning time, the glim banked in this run, the runs and the deaths. Above Ember 0 it shows the level
   first, and the best time is that level's; a win that opened a level says so (opened) */
export function winOf(rs) {
  const e = rs.ended || {}, em = e.ember | 0, best = em ? rs.bestByEmber?.[em] : rs.bestWin;
  const rows = [['Time', fmt(e.time || 0)], [em ? `Best at Ember ${em}` : 'Best winning time', best ? fmt(best) : '–'], ['Glim banked', `${e.banked || 0} glim`], ['Runs', String(rs.runs)], ['Deaths', String(rs.deaths)]];
  if (em) rows.unshift(['Ember', `Ember ${em}`]);
  return { title: 'The downs are lit', rows, opened: e.opened ? `Ember ${e.opened} opens in the Lamp-room: ${EMBER[e.opened]}.` : '' };
}

/* ---------------- the builds ----------------
   The Lamp-room's Unlocks list: "<name> · <what it gives> · <cost> glim", and "<name> · bought" once bought. Its Buy is as an
   upgrade's: off with too little glim, and saying how much more is needed */
export function unlockRow(rs, id) {
  const u = UNLOCKS.find(x => x.id === id), got = (rs.unlocks || []).includes(id), need = got ? 0 : Math.max(0, u.cost - rs.bank);
  return { id, cost: u.cost, got, need, label: got ? `${u.name} · bought` : `${u.name} · ${u.text} · ${u.cost} glim`, buy: got ? null : need ? `${need} more glim` : 'Buy' };
}
export const unlockRows = rs => UNLOCKS.map(u => unlockRow(rs, u.id));
// the Ember row: a button for each open level, the chosen one on; none before the first win
export const emberRow = rs => ((rs.emberTop | 0) < 1 ? [] : Array.from({ length: (rs.emberTop | 0) + 1 }, (_, i) => ({ n: i, label: `Ember ${i}`, on: (rs.ember | 0) === i, text: EMBER[i] })));
// the relics on the HUD: a short mark for each, and whether it kindles with a wick of the run
export const relicMarks = run => (run?.relics || []).map(id => ({ id, mark: relicOf(id)?.mark || '?', name: relicOf(id)?.name || id, kindled: kindled(run, id) }));
// the beacon card's line for a wick that kindles a relic the run holds
export const kindleLine = (run, wick) => { const k = KINDLE.find(x => x.wick === wick && (run?.relics || []).includes(x.relic)); return k ? `Kindled with ${relicOf(k.relic).name}: ${k.text}` : ''; };
// the help lines for the moves that unlocks add, on every device's Attack
export function moveLines(rs) {
  const u = rs.unlocks || [], out = [];
  if (u.includes('rising')) out.push('Rising cut: attack as a roll ends.');
  if (u.includes('parry')) out.push('Ember parry: start a first cut just as a blow comes, facing it.');
  return out;
}

/* ---------------- the pause panel ----------------
   The five places of the run, each passed, here or ahead, and the two questions it asks again before it acts */
// in the run's own route (from Ember 1 the seed orders places II to IV)
export const routeOf = (place, route = ORDER) => {
  const at = route.indexOf(place);
  return route.map((id, i) => ({ id, n: NUMERAL[i], name: NAMES[id], state: i < at ? 'passed' : i === at ? 'here' : 'ahead' }));
};
export const ASKS = {
  end: { line: () => 'End the run? The glim you carry is lost.', yes: 'Yes, end it' },
  restart: { line: place => `Back to the start of ${NAMES[place]}? The glim you found here is lost.`, yes: 'Yes, go back' }
};

/* ---------------- a load of the page ----------------
   The card that shows over the place when the page loads: the summary of an ended run (also after a reload in the fade), the beacon
   card while its two wicks wait (the same two, from the save), the help card on a first visit, the Lamp-room on a later visit with no
   run, or none while a run goes on. A won run shows the win card again until it closes. Wander's stage adds rs.wander */
export function cardOnLoad(rs) {
  if (rs.ended) return rs.ended.won ? 'win' : 'summary';
  if (!rs.run) return rs.seen ? 'lamp' : 'help';
  if (rs.run.offer) return 'beacon';
  return null;
}

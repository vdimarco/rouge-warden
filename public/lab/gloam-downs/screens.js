// Gloam Downs: what the run's screens show. The HUD's health line, the wick buttons, the Lamp-room's rows and buttons, the run
// summary, the pause panel's places and the card that a load of the page opens, all from the run's save (run-save.js) and its rules
// (run.js). No DOM, so the Node test reads the same texts and choices that the page shows; main.js builds the cards from them.
import { ORDER } from './save.js';
import { WICKS, UPGRADES, UNLOCKS, EMBER, BASE, maxOf, flasksOf, keepShare, purse, sparksOf, paneSlots, kindledOf, patternOf, startPicks } from './run.js';
import { relicOf, kindled, KINDLE } from './relics.js';
import { COLOURS, PATTERNS, PANES, ABILITIES } from './growth.js';
import { ELITE_LIST, ELITES } from './elites.js';
import { BLADES, OFFHANDS } from './gear.js';
import { LAMP_KEYS } from './growth.js';
// the gear builder's gearMark (hud-gear.js) and the start picks: hub.js keeps their stand-ins until it lands
import { gearMark, startBlade, startOffhand, kindledBlades, kindledOffhands } from './hub.js';

export const NUMERAL = ['I', 'II', 'III', 'IV', 'V'];
export const NAMES = { gaol: 'The Sunken Gaol', ramparts: 'The Crow Wall', fen: 'Lantern Fen', bells: 'The Bell Knoll', barrows: 'Barrow Crown' };
export const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export const placeLine = id => `${NUMERAL[ORDER.indexOf(id)]} · ${NAMES[id]}`;
// each place's subtitle, as baked in worlds/<id>.json (the screens test checks they match)
export const SUBS = {
  gaol: 'Cells cut into the moor, and the keep on the hill', ramparts: 'A broken wall rides the downs as the storm light dies',
  fen: 'Stilt huts over black water, and the mill on the hill', bells: 'A bronze bell on a hill of sunk cogs, at a blood-red dusk',
  barrows: 'Mounds of the old dead, and the keep on the crowned hill'
};

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
  ash: next => `keep ${Math.round(keepShare({ ash: next }) * 100)}% of glim at a death`,
  belt: next => ['a choice of two start abilities', 'slot 2 starts filled', 'the start abilities are bright'][next - 1],
  keen: () => 'better drops',
  panes: next => `${next + 1} pane slots`,
  first: next => `${next} spark ${next === 1 ? 'pick' : 'picks'} at the start`,
  whet: next => `${4 * next}% of blade hits are sure cuts`,
  horn: next => `shells ${20 * next}% bigger`
};
// the glim a Lamp-room spends: in a run the glim carried first, then the bank
const purseOf = rs => purse(rs);
export function upgradeRow(rs, id) {
  const u = UPGRADES.find(x => x.id === id), lvl = rs.up[id] || 0, max = u.costs.length, top = lvl >= max;
  const name = max > 1 ? `${u.name} ${top ? lvl : lvl + 1}` : u.name;
  const cost = top ? 0 : u.costs[lvl], need = top ? 0 : Math.max(0, cost - purseOf(rs));
  return {
    id, lvl, max, top, cost, need, mark: gearMark({ kind: 'ware', colour: u.colour || null }),
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
// the glim and pattern rows read as one line each: "Glim kept 12 · lost 113", "Patterns kept 0 · lost 1"
export function summaryOf(e, route = ORDER) {
  const at = route.indexOf(e.place);
  const rows = [['Reached', at >= 0 ? `${NUMERAL[at]} · ${NAMES[e.place]}` : placeLine(e.place)], ['Time', fmt(e.time)], ['Foes put out', String(e.foes)],
    // the glim kept and lost; the glim banked only when it says more (a win, or an old run whose beacons banked); a run from an old save
    // with no kept count shows only what it banked
    ...(e.kept === null || e.kept === undefined ? [] : [['Glim', `kept ${e.kept | 0} · lost ${e.lost | 0}`]]),
    ...((e.banked | 0) !== (e.kept ?? -1) ? [['Glim banked', `${e.banked} glim`]] : []), ['Patterns', `kept ${e.patternsKept | 0} · lost ${e.patternsLost | 0}`]];
  return { title: e.won ? 'The downs are lit' : 'The lamp goes out', rows, lines: rows.slice(3).filter(r => r[0] !== 'Glim banked').map(([k, v]) => `${k} ${v}`) };
}

/* ---------------- growth on the screens (gloam-downs-growth) ----------------
   The colours: "Flame 2 Ward 1 Gloam 3" on the HUD in their hues, and "Flame 2 · Ward 1 · Gloam 0" on the Lamp-room's top line */
// the colours' marks are their names, so they never share a shape with the wisps' ◆ and the glim's ● on the count line below
export const COLOUR_MARK = { flame: 'Flame', ward: 'Ward', gloam: 'Gloam' };
export function colourRow(run) {
  const s = sparksOf(run);
  return COLOURS.map(c => ({ id: c.id, name: c.name, hue: c.hue, n: s[c.id], mark: COLOUR_MARK[c.id], text: `${COLOUR_MARK[c.id]} ${s[c.id]}` }));
}
export const colourLine = run => colourRow(run).map(c => `${c.name} ${c.n}`).join(' · ');
// the HUD's pattern count, "◇ 1", while a pattern is carried
export const patternsMark = run => ((run?.carriedPatterns || []).length ? `◇ ${run.carriedPatterns.length}` : '');
// what a pattern, an ability or a pane does, and its name
// a pattern's item: an ability or a pane (run.js patternOf), or a blade or an off-hand (gear.js)
const itemOfPattern = id => patternOf(id) || BLADES.find(x => x.id === id) || OFFHANDS.find(x => x.id === id) || null;
export const growthName = id => itemOfPattern(id)?.name || id;
// a number and its unit ("1 s", "4 m") stay on one line (merge pass: a pane's "by 1 s" broke before its "s" at 320 px)
export const growthText = id => (itemOfPattern(id)?.text || '').replace(/(\d) (s|m)\b/g, '$1\u00a0$2');
// the Lamp-room's patterns: "<name> · <what it does> · <cost> glim" with Kindle, under the same rules as a Buy
export function patternRows(rs) {
  return (rs.patterns || []).filter(id => PATTERNS.some(p => p.id === id)).map(id => {
    const p = PATTERNS.find(x => x.id === id), need = Math.max(0, p.cost - purseOf(rs));
    return { id, kind: p.kind, cost: p.cost, need, mark: gearMark({ kind: p.kind, id }), label: `${growthName(id)} · ${growthText(id)} · ${p.cost} glim`, buy: need ? `${need} more glim` : 'Kindle' };
  });
}
/* the pane rows: one for each open slot, with every kindled pane but those set in another slot. The one set in the row is on; pressing
   it again takes it out */
export function paneRows(rs) {
  const n = paneSlots(rs), set = rs.panes || [], kindledPanes = kindledOf(rs, 'pane');
  return Array.from({ length: n }, (_, slot) => ({
    slot, set: set[slot] || null,
    panes: kindledPanes.filter(id => !set.some((p, i) => p === id && i !== slot)).map(id => ({ id, name: growthName(id), text: growthText(id), on: set[slot] === id, mark: gearMark({ kind: 'pane', id }) }))
  }));
}
// the beacon card's spark buttons, and its kept line
export const SPARK_PICKS = COLOURS.map(c => ({ id: c.id, label: `${c.name} +1`, text: c.text, hue: c.hue }));
export const keptLine = ids => (ids?.length ? `Kept: ${ids.map(growthName).join(', ')}` : '');
// the glim on the beacon card and the Lamp-room's top line
export function glimLine(rs, at = 'lamp') {
  const run = rs.run, share = Math.round(keepShare(rs.up) * 100);
  if (!run) return `Banked: ${rs.bank} glim. What you buy here lasts for every run.`;
  // the beacon says what a death would cost in numbers, not only as a share (the merge pass found one line easy to miss)
  if (at === 'beacon') {
    const kept = Math.floor(run.carried * keepShare(rs.up) + 1e-9);
    return run.carried > 0
      ? `You carry ${run.carried} glim, and ${rs.bank} is banked. Spend it in the Lamp-room, or carry it on: a death would keep only ${kept} of it (${share}%) and lose ${run.carried - kept}.`
      : `You carry 0 glim, and ${rs.bank} is banked.`;
  }
  return `Carried: ${run.carried} glim · Banked: ${rs.bank} glim. The glim carried is spent first. What you buy here lasts for every run.`;
}
// the start card's ability buttons (Belt): "<name> · <what it does>"
export const abilityLine = id => `${growthName(id)} · ${growthText(id)}`;
export const ABILITY_NAMES = Object.fromEntries(ABILITIES.map(a => [a.id, a.name]));
export const PANE_NAMES = Object.fromEntries(PANES.map(p => [p.id, p.name]));

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
  const u = UNLOCKS.find(x => x.id === id), got = (rs.unlocks || []).includes(id), need = got ? 0 : Math.max(0, u.cost - purseOf(rs));
  return { id, cost: u.cost, got, need, mark: gearMark({ kind: 'unlock' }), label: got ? `${u.name} · bought` : `${u.name} · ${u.text} · ${u.cost} glim`, buy: got ? null : need ? `${need} more glim` : 'Buy' };
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
  end: { line: () => 'End the run? Most of the glim you carry is lost, and the patterns you carry too.', yes: 'Yes, end it' },
  restart: { line: place => `Back to the start of ${NAMES[place]}? The glim you found here is lost.`, yes: 'Yes, go back' }
};

/* ---------------- a load of the page ----------------
   The card that shows over the place when the page loads: the summary of an ended run (also after a reload in the fade), the beacon
   card while its two wicks wait (the same two, from the save), the help card on a first visit, the Lamp-room on a later visit with no
   run, or none while a run goes on. A won run shows the win card again until it closes. Wander's stage adds rs.wander */
export function cardOnLoad(rs, o = {}) {
  if (rs.ended) return rs.ended.won ? 'win' : 'summary';
  // the title screen (gloam-downs-screens-life) opens where the help card or the Lamp-room did; o.title false keeps the old cards
  if (!rs.run) return o.title === false ? (rs.seen ? 'lamp' : 'help') : 'title';
  // the picks still waiting: a wick, a spark (a beacon's, First spark's or a cache's) or Belt's ability
  if (startPicks(rs.run)) return 'beacon';
  return null;
}

/* ---------------- the selection screens (gloam-downs-screens-life) ----------------
   The title screen: the five places of the run as lamps on a path, lit for each place reached in any run (rs.furthest, once a run has
   been played), and the line that a lamp under the pointer or the focus shows; the seed and Ember line */
export const titleLine = id => (SUBS[id] ? `${placeLine(id)}. ${SUBS[id]}` : placeLine(id));
export function titleLamps(rs) {
  const played = (rs.runs | 0) > 0 || !!rs.run;
  const reached = new Set(Array.isArray(rs.reached) ? rs.reached : ORDER.slice(0, (rs.furthest | 0) + 1));
  return ORDER.map((id, i) => ({ id, n: NUMERAL[i], name: NAMES[id], sub: SUBS[id], line: titleLine(id), lit: played && reached.has(id) }));
}
export const seedLine = (code, ember = 0) => `Seed ${code} · Ember ${ember | 0}`;
// the Ember level one step down or up from the title's ◀ and ▶, within the open levels, or null at an end
export function emberStep(rs, d) {
  const n = (rs.ember | 0) + d;
  return n < 0 || n > (rs.emberTop | 0) ? null : n;
}

/* the Lamp-room's ware tile: a glass whose light fills by level / levels, the name and "Mantle 2 of 8", the next gift, its cost and
   Buy (as upgradeRow's). At the top level the gift reads "all bought" and there is no Buy */
export function wareTile(rs, id) {
  const r = upgradeRow(rs, id), u = UPGRADES.find(x => x.id === id);
  return {
    ...r, name: u.name, fill: r.max ? r.lvl / r.max : 0,
    level: r.max > 1 ? `${u.name} ${r.lvl} of ${r.max}` : `${u.name}${r.lvl ? ' · bought' : ''}`,
    gift: r.top ? 'all bought' : GIVES[id](r.lvl + 1), costText: r.top ? '' : `${r.cost} glim`
  };
}
export const wareTiles = rs => UPGRADES.map(u => wareTile(rs, u.id));
// the colour of an ability or a pane (growth.js), and the hue of its tile
export const colourOf = id => [...ABILITIES, ...PANES].find(x => x.id === id)?.colour || 'gloam';
export const patternHue = id => (COLOURS.find(c => c.id === colourOf(id)) || COLOURS[2]).hue;
// the colour words a pick sends on the bus (screen-pick, screen-hover): a wick's, or a spark's or an ability's colour
export const pickColour = (kind, id) => (kind === 'wick' ? 'wick' : kind === 'spark' ? id : colourOf(id));

/* the recap of an ended run (the summary and the win card): the run's path as lamps, each place passed lit with its time and foes, the
   end place snuffed on a death or bright on a win, then the rows. A save from before the recap (no path) gives the old summary's rows */
export const BY = { S: 'a Snuffer', P: 'a Pitchrook', M: 'a Mirelight', I: 'an Ironback', B: 'the Barrow Reeve', fall: 'a fall' };
export const byLine = by => (!by ? '' : BY[by] ? `Put out by ${BY[by]}` : ELITE_LIST.some(x => x.id === by) ? `Put out by ${ELITE_LIST.find(x => x.id === by).name}` : '');
export function recapOf(e, route = ORDER) {
  if (!e || !Array.isArray(e.path) || !e.path.length) return { old: true, path: [], ...summaryOf(e, route) };
  const ids = [...e.path.map(p => p.id), ...route.filter(id => !e.path.some(p => p.id === id))];
  const path = ids.map(id => {
    const p = e.path.find(x => x.id === id), end = id === e.place, i = ORDER.indexOf(id);
    return {
      id, n: NUMERAL[i], name: NAMES[id], state: end ? (e.won ? 'bright' : 'snuffed') : p ? 'lit' : 'dark',
      time: p ? fmt(p.time) : '', foes: p ? String(p.foes) : ''
    };
  });
  const sparks = COLOURS.map(c => ({ id: c.id, name: c.name, hue: c.hue, n: e.colours?.[c.id] | 0 }));
  const names = (e.patternNames || []).map(growthName);
  const rows = [
    ['Time', fmt(e.time)], ['Foes put out', String(e.foes)],
    ...(e.kept === null || e.kept === undefined ? [] : [['Glim', `kept ${e.kept | 0} · lost ${e.lost | 0}`]]),
    ['Patterns kept', names.length ? names.join(', ') : 'none'],
    ['Sparks', sparks.map(c => `${c.name} ${c.n}`).join(' · ')],
    ['Best combo', (e.combo | 0) >= 2 ? `×${e.combo | 0}` : '–']
  ];
  return { title: e.won ? 'The downs are lit' : 'The lamp goes out', won: !!e.won, path, rows, sparks, by: e.won ? '' : byLine(e.by) };
}

/* ---------------- the hall's own rows (gloam-downs-hub) ----------------
   The blade rack and the off-hand stand: each kindled item with its string or rule, the start one marked, and Pick. The trophy wall:
   each key, held or where it comes from. The well: the bank and the last run. Every row carries its category mark (gearMark) */
// a number and its unit stay on one line
const unit = t => String(t || '').replace(/(\d) (s|m)\b/g, '$1\u00a0$2');
export function bladeRows(rs) {
  const on = startBlade(rs);
  return kindledBlades(rs).map(id => BLADES.find(b => b.id === id)).map(b => ({
    id: b.id, name: b.name, text: unit(b.text), start: b.id === on, mark: gearMark({ kind: 'blade', id: b.id }),
    label: `${b.name} · ${b.text}`, pick: b.id === on ? 'Start blade' : 'Pick'
  }));
}
export function offhandRows(rs) {
  const on = startOffhand(rs);
  const rows = kindledOffhands(rs).map(id => OFFHANDS.find(o => o.id === id)).map(o => ({
    id: o.id, name: o.name, text: `${unit(o.text)}; cools in ${o.cool}\u00a0s`, start: o.id === on, mark: gearMark({ kind: 'offhand', id: o.id }),
    label: `${o.name} · ${o.text}`, pick: o.id === on ? 'Start off-hand' : 'Pick'
  }));
  rows.push({ id: null, name: 'None', text: 'start with the off-hand slot empty', start: on === null, mark: gearMark({ kind: 'offhand' }), label: 'None · start with the off-hand slot empty', pick: on === null ? 'Start off-hand' : 'Pick' });
  return rows;
}
// the elite whose first fall gives a key: the one of the key's place
const eliteFrom = place => ELITES[place] || null;
export function keyRows(rs) {
  return LAMP_KEYS.map(k => {
    const got = (rs.keys || []).includes(k.id), e = eliteFrom(k.from);
    return { id: k.id, name: k.name, got, mark: gearMark({ kind: 'key', colour: k.colour || null }), label: got ? `${k.name} · ${k.text}` : `${k.name} · not yet: the first fall of ${e ? e.name : `the elite of ${NAMES[k.from] || k.from}`}` };
  });
}
// the well: the bank, and the last run in a line
export function wellLines(rs) {
  const lines = [`Banked: ${rs.bank | 0} glim. Runs ${rs.runs | 0} · wins ${rs.wins | 0} · deaths ${rs.deaths | 0}.`];
  const e = rs.ended;
  if (e) { const r = recapOf(e); lines.push(`${r.title}. ${r.rows.slice(0, 3).map(([k, v]) => `${k} ${v}`).join(' · ')}`); }
  else lines.push((rs.runs | 0) === 0 ? 'No run yet. The run door is at the back of the hall.' : `Furthest place: ${NAMES[ORDER[Math.min(4, rs.furthest | 0)]]}.`);
  return lines;
}

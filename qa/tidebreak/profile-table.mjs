// Prints the difficulty table for notes/bots.md from PROFILES, so the notes cannot drift from the code.
// node qa/tidebreak/profile-table.mjs
import { PROFILES } from '../../public/tidebreak/bot-difficulty.js';

const COLUMNS = [['apprentice', 'Apprentice'], ['veteran', 'Veteran (default)'], ['mythic', 'Mythic'], ['ally', 'Ally']];
const yes = v => v ? 'yes' : 'no', pct = v => `${Math.round(v * 100)}%`, sec = v => `${v} s`;
const ROWS = [
  ['Reaction to a new warning (+ while attacking)', P => `${P.reaction[0]}–${P.reaction[1]} s (+${P.busy})`],
  ['Dodge clears the shape', P => pct(P.dodge)],
  ['Aim lead / spread (units)', P => `${P.aimLead} / ±${P.aimError}`],
  ['Cast lock after a cast / a failed cast', P => `${sec(P.castLock)} / ${sec(P.failLock)}`],
  ['Spells on the wave', P => P.saveSpells ? 'only at full mana' : 'any time'],
  ['Always go home below', P => `${pct(P.retreatAt)} health`],
  ['Dash in on a weak target', P => yes(P.engage)],
  ['Trade-aware retreat and tower exit', P => P.tradeRetreat ? `yes, margin ${P.tradeRetreat}` : 'no'],
  ['Move guard at untanked wards', P => yes(P.guard)],
  ['Marks a pushed lane (frees ganks)', P => yes(P.waveGate)],
  ['Tower-dive guard', P => yes(P.diveGuard)],
  ['Focus / lowest / punish bonus', P => `${P.focus} / ${P.lowest} / ${P.punish}`],
  ['Open ward target bonus', P => `${P.wardBonus}`],
  ['Ganks', P => P.gankEvery ? `every ${P.gankEvery} s` : 'never'],
  ['Spirit camps', P => yes(P.camps)],
  ['Defend calls', P => yes(P.defend)],
  ['Gather before the boss', P => P.objectiveLead ? `${P.objectiveLead} s early` : 'no'],
  ['Push without a wave after a won fight', P => P.push ? `${P.push} enemies down` : 'no'],
  ['Draft weight of kit strength', P => P.draft ? `${P.draft}` : 'no'],
];

export function profileTable() {
  const head = `| Knob | ${COLUMNS.map(c => c[1]).join(' | ')} |\n|---|${COLUMNS.map(() => '---|').join('')}`;
  return [head, ...ROWS.map(([name, cell]) => `| ${name} | ${COLUMNS.map(([id]) => cell(PROFILES[id])).join(' | ')} |`)].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(profileTable());

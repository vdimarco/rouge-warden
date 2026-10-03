// Balance simulator. Plays many seeds with no charms and no redraws. For each hand it finds the best
// legal chain by depth-first search and plays it. It reports how many seeds clear each table in the
// first stops, and prints the report as Markdown.
//
//   npm run simulate
//   npm run simulate -- --seeds 1000 --stops 3
//   npm run simulate -- --targets 150,400,1000 --hosts purist=1,zebra=0.8
//   npm run simulate -- --calibrate
//   npm run simulate -- --buy-charms --stops 8
//
// --buy-charms changes the player: after each clear it buys every charm it can afford, in offer order.
// It still uses no redraws and no stamps. This shows how far charms carry a run past the first stops.
//
// --calibrate deals one table of each kind for every seed, plays all 3 chains with no target and reports
// percentiles of the 3-chain totals. A table clears when its target is at most that total, so the
// percentiles show which target each clear rate needs.
//
// --targets and --hosts try other values without editing src/config.ts. Without them the simulator
// uses the values in src/config.ts.

import { CONFIG } from '../src/config';
import {
  availableCards,
  beginTable,
  bestChain,
  buyCharm,
  charmBuyStatus,
  HOST_IDS,
  HOSTS,
  isHostTable,
  leaveShop,
  needsNamedSuit,
  newRun,
  openShop,
  runAddCard,
  runPlay,
  runRules,
  stopHost,
  type HostId,
  type RunState,
} from '../src/engine';

interface Options {
  seeds: number;
  stops: number;
  prefix: string;
  calibrate: boolean;
  buyCharms: boolean;
  targets: number[];
  hostScale: Record<HostId, number>;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    seeds: 1_000,
    stops: 3,
    prefix: 'SIM',
    calibrate: false,
    buyCharms: false,
    targets: [...CONFIG.run.baseTargets],
    hostScale: { ...CONFIG.run.hostScale },
  };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1] ?? '';
    switch (argv[i]) {
      case '--seeds':
        options.seeds = Number(value);
        i += 1;
        break;
      case '--stops':
        options.stops = Number(value);
        i += 1;
        break;
      case '--calibrate':
        options.calibrate = true;
        break;
      case '--buy-charms':
        options.buyCharms = true;
        break;
      case '--prefix':
        options.prefix = value;
        i += 1;
        break;
      case '--targets':
        value.split(',').forEach((target, stop) => {
          options.targets[stop] = Number(target);
        });
        i += 1;
        break;
      case '--hosts':
        for (const pair of value.split(',')) {
          const [host, scale] = pair.split('=');
          if (!HOST_IDS.includes(host as HostId)) throw new Error(`Unknown host: ${host}`);
          options.hostScale[host as HostId] = Number(scale);
        }
        i += 1;
        break;
      default:
        throw new Error(`Unknown option: ${argv[i]}`);
    }
  }
  return options;
}

interface TableRecord {
  readonly stop: number;
  readonly tableIndex: number;
  readonly host: HostId | null;
  readonly target: number;
  readonly cleared: boolean;
  /** Power-of-ten dollars paid for the clear. */
  readonly bonus: number;
  readonly chainScores: readonly number[];
}

function targetFor(options: Options, stop: number, tableIndex: number, host: HostId | null): number {
  const scale = CONFIG.run.tableScale[tableIndex] * (host === null ? 1 : options.hostScale[host]);
  return Math.round(options.targets[stop - 1] * scale);
}

/** Sets the simulator's own target on a newly dealt table. */
function withTarget(run: RunState, options: Options): RunState {
  const table = run.table!;
  return { ...run, table: { ...table, target: targetFor(options, run.stop, run.tableIndex, table.host) } };
}

/** Plays one seed until it loses or finishes the last stop that the report covers. */
export function playSeed(seed: string, options: Options): TableRecord[] {
  const records: TableRecord[] = [];
  let run = withTarget(beginTable(newRun(seed)), options);
  let scores: number[] = [];

  for (;;) {
    const table = run.table!;
    const rules = runRules(run);
    const best = bestChain(availableCards(table), rules, { charms: run.charms, handSize: table.hand.length })!;
    for (const link of best.links) {
      run = runAddCard(run, link.card.id, needsNamedSuit(link.card, rules) ? link.suit : undefined);
    }
    run = runPlay(run);
    scores.push(run.table!.lastPlay!.result.score);
    if (run.phase === 'table') continue;

    const host = isHostTable(run.tableIndex) ? stopHost(run) : null;
    const cleared = run.phase === 'cleared' || run.phase === 'won';
    const bonus = cleared ? run.lastPayout!.powerOfTen : 0;
    records.push({ stop: run.stop, tableIndex: run.tableIndex, host, target: run.table!.target, cleared, bonus, chainScores: scores });
    scores = [];
    if (!cleared || run.phase === 'won') return records;
    if (isHostTable(run.tableIndex) && run.stop >= options.stops) return records;

    run = openShop(run);
    if (options.buyCharms) {
      for (let i = 0; i < run.shop!.offers.length; i += 1) {
        if (charmBuyStatus(run, i) === 'ok') run = buyCharm(run, i);
      }
    }
    run = leaveShop(run);
    if (run.phase === 'intro') run = beginTable(run);
    run = withTarget(run, options);
  }
}

const pct = (part: number, whole: number) => (whole === 0 ? '-' : `${((100 * part) / whole).toFixed(1)}%`);

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function report(options: Options, runs: TableRecord[][], seconds: number): string {
  const lines: string[] = [];
  const n = runs.length;
  const player = options.buyCharms ? 'Buys every charm it can afford, no redraws, no stamps' : 'No charms, no redraws';
  lines.push(`Seeds: ${n} (${options.prefix}0001 to ${options.prefix}${String(n).padStart(4, '0')}). ${player}, the best chain for each hand. ${seconds.toFixed(1)} s.`);
  lines.push('');
  lines.push(`Base targets for stops 1 to ${options.stops}: ${options.targets.slice(0, options.stops).join(', ')}.`);
  lines.push(`Host scales: ${HOST_IDS.map((h) => `${HOSTS[h].name} ${options.hostScale[h]}`).join(', ')}.`);
  lines.push('');
  lines.push('| Table | Target | Reached | Cleared, share of all seeds | Cleared, share of seeds that reached it | Median best chain |');
  lines.push('| --- | --- | --- | --- | --- | --- |');

  for (let stop = 1; stop <= options.stops; stop += 1) {
    for (let tableIndex = 0; tableIndex < CONFIG.run.tablesPerStop; tableIndex += 1) {
      const rows = runs.flatMap((records) => records.filter((r) => r.stop === stop && r.tableIndex === tableIndex));
      const cleared = rows.filter((r) => r.cleared).length;
      const name = isHostTable(tableIndex) ? 'host table' : `table ${tableIndex + 1}`;
      const targets = [...new Set(rows.map((r) => r.target))].sort((a, b) => a - b);
      const target = targets.length <= 1 ? String(targets[0] ?? '-') : `${targets[0]} to ${targets[targets.length - 1]}`;
      const best = rows.map((r) => Math.max(...r.chainScores));
      lines.push(
        `| Stop ${stop}, ${name} | ${target} | ${pct(rows.length, n)} | ${pct(cleared, n)} | ${pct(cleared, rows.length)} | ${percentile(best, 50)} |`,
      );
    }
  }

  lines.push('');
  lines.push('| Stop | Seeds that clear the whole stop |');
  lines.push('| --- | --- |');
  for (let stop = 1; stop <= options.stops; stop += 1) {
    const cleared = runs.filter((records) => records.some((r) => r.stop === stop && isHostTable(r.tableIndex) && r.cleared)).length;
    lines.push(`| Stop ${stop} | ${pct(cleared, n)} |`);
  }

  const clears = runs.flat().filter((r) => r.cleared);
  lines.push('');
  const bonuses = clears.filter((r) => r.bonus > 0);
  const atHosts = bonuses.filter((r) => r.host !== null).length;
  lines.push(`Clears with a power-of-ten bonus: ${bonuses.length} of ${clears.length}, ${atHosts} of them at host tables.`);

  lines.push('');
  const stops = Array.from({ length: options.stops }, (_, i) => i + 1);
  lines.push(`| Host | ${stops.map((stop) => `Stop ${stop} host tables cleared`).join(' | ')} | All host tables cleared |`);
  lines.push(`| --- | ${stops.map(() => '---').join(' | ')} | --- |`);
  for (const host of HOST_IDS) {
    const rows = runs.flatMap((records) => records.filter((r) => r.host === host));
    const cell = (list: TableRecord[]) => `${pct(list.filter((r) => r.cleared).length, list.length)} of ${list.length}`;
    const perStop = stops.map((stop) => cell(rows.filter((r) => r.stop === stop)));
    lines.push(`| ${HOSTS[host].name} | ${perStop.join(' | ')} | ${cell(rows)} |`);
  }
  return lines.join('\n');
}

/** The total of 3 best chains at a table with no target, so every chain gets played. */
function threeChainTotal(run: RunState): number {
  let state: RunState = { ...run, table: { ...run.table!, target: Number.MAX_SAFE_INTEGER } };
  while (state.phase === 'table') {
    const table = state.table!;
    const rules = runRules(state);
    const best = bestChain(availableCards(table), rules, { handSize: table.hand.length })!;
    for (const link of best.links) {
      state = runAddCard(state, link.card.id, needsNamedSuit(link.card, rules) ? link.suit : undefined);
    }
    state = runPlay(state);
  }
  return state.table!.total;
}

function calibration(options: Options): string {
  const kinds: (HostId | null)[] = [null, ...HOST_IDS];
  const lines = [
    `Seeds: ${options.seeds}. Each row deals one table per seed and plays 3 best chains with no target.`,
    '',
    '| Table | 5th | 10th | 25th | 50th | 75th | 90th percentile |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const host of kinds) {
    const totals: number[] = [];
    for (let i = 1; i <= options.seeds; i += 1) {
      const seed = `${options.prefix}${String(i).padStart(4, '0')}`;
      const run = newRun(seed);
      const setup: RunState = host === null ? run : { ...run, tableIndex: 2, hosts: run.hosts.map(() => host) };
      totals.push(threeChainTotal(beginTable(setup)));
    }
    const cells = [5, 10, 25, 50, 75, 90].map((p) => percentile(totals, p));
    lines.push(`| ${host === null ? 'No host' : HOSTS[host].name} | ${cells.join(' | ')} |`);
  }
  return lines.join('\n');
}

const options = parseOptions(process.argv.slice(2));
if (options.calibrate) {
  console.log(calibration(options));
} else {
  const started = performance.now();
  const runs: TableRecord[][] = [];
  for (let i = 1; i <= options.seeds; i += 1) runs.push(playSeed(`${options.prefix}${String(i).padStart(4, '0')}`, options));
  console.log(report(options, runs, (performance.now() - started) / 1000));
}

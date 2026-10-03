import { CONFIG } from '../config';
import { isHostTable, type RunState } from '../engine';
import { formatNumber } from './text';

/** Win or loss, the stop reached, the best chain, the seed and New run. */
export function RunEnd({ run, onNewRun }: { run: RunState; onNewRun: () => void }) {
  const won = run.phase === 'won';
  const table = run.table;
  const where = table === null ? '' : isHostTable(table.tableIndex) ? 'The host table' : `Table ${table.tableIndex + 1}`;
  const reason = table !== null && table.chainsLeft > 0 ? 'ran out of cards' : 'ran out of chains';
  return (
    <div className="screen end-screen" data-testid="run-end" data-result={run.phase}>
      <div className="end-body">
        <h1 className={`end-title ${won ? 'won' : 'lost'}`}>{won ? 'You won the run' : 'The run ends'}</h1>
        <p className="end-line">
          {won
            ? `You cleared all ${CONFIG.run.stops} stops.`
            : table !== null
              ? `${where} ${reason} at ${formatNumber(table.total)} of ${formatNumber(table.target)}.`
              : ''}
        </p>
        <dl className="end-stats">
          <div>
            <dt>Stop reached</dt>
            <dd data-testid="stop-reached">
              {run.stop} of {CONFIG.run.stops}
            </dd>
          </div>
          <div>
            <dt>Best chain</dt>
            <dd data-testid="best-chain">{formatNumber(run.bestChain)}</dd>
          </div>
          <div>
            <dt>Seed</dt>
            <dd data-testid="end-seed">{run.seed}</dd>
          </div>
        </dl>
      </div>
      <div className="actions single">
        <button type="button" className="btn primary wide" onClick={onNewRun}>
          New run
        </button>
      </div>
    </div>
  );
}

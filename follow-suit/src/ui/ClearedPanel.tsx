import type { RunState } from '../engine';
import { Sheet } from './Sheet';
import { formatNumber } from './text';

/** Shows what the cleared table pays, then opens the shop. */
export function ClearedPanel({ run, onOpenShop }: { run: RunState; onOpenShop: () => void }) {
  const payout = run.lastPayout!;
  const table = run.table!;
  return (
    <Sheet title="Table cleared" className="end-sheet won" testId="cleared-panel">
      <p className="end-line">
        Total {formatNumber(table.total)} against a target of {formatNumber(table.target)}.
      </p>
      <dl className="payout">
        <div>
          <dt>Table</dt>
          <dd>${payout.table}</dd>
        </div>
        <div>
          <dt>Unused chains</dt>
          <dd>${payout.unusedChains}</dd>
        </div>
        <div>
          <dt>Power-of-ten bonus</dt>
          <dd>${payout.powerOfTen}</dd>
        </div>
        <div className="sum">
          <dt>You earn</dt>
          <dd data-testid="payout-total">${payout.total}</dd>
        </div>
      </dl>
      <button type="button" className="btn primary wide" onClick={onOpenShop}>
        Open the shop
      </button>
    </Sheet>
  );
}

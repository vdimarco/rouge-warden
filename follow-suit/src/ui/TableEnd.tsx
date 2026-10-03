import { useEffect, useRef } from 'react';
import type { TableState } from '../engine';
import { formatNumber } from './text';

interface TableEndProps {
  table: TableState;
  seed: string;
  onNewTable: () => void;
}

/** The clear or lose panel at the end of a table. */
export function TableEnd({ table, seed, onNewTable }: TableEndProps) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);

  const cleared = table.status === 'cleared';
  const reason = table.chainsLeft === 0 ? 'No chains are left.' : 'No cards are left to play.';
  return (
    <div className="sheet-backdrop end-backdrop">
      <div
        className={`sheet end-sheet ${cleared ? 'won' : 'lost'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-end-title"
        data-testid="table-end"
        data-status={table.status}
      >
        <h2 id="table-end-title" className="end-title">
          {cleared ? 'Table cleared' : 'The run ends'}
        </h2>
        <p className="end-line">
          {cleared ? 'The total reached the target.' : reason}
        </p>
        <dl className="end-stats">
          <div>
            <dt>Total</dt>
            <dd>{formatNumber(table.total)}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{formatNumber(table.target)}</dd>
          </div>
          <div>
            <dt>Best chain</dt>
            <dd>{formatNumber(table.bestChain)}</dd>
          </div>
        </dl>
        <p className="end-seed">Seed {seed}</p>
        <button ref={button} type="button" className="btn primary wide" onClick={onNewTable}>
          New table
        </button>
      </div>
    </div>
  );
}

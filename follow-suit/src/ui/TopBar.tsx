import type { ReactNode } from 'react';
import { isHostTable } from '../engine';
import { formatNumber } from './text';

interface TopBarProps {
  stop: number;
  tableIndex: number;
  target: number;
  total: number;
  money: number;
  chainsLeft: number;
  redrawsLeft: number;
  seed: string;
  deckSize: number;
  onDeck: () => void;
  /** Extra buttons before the deck button. */
  children?: ReactNode;
}

export function TopBar(props: TopBarProps) {
  const { stop, tableIndex, target, total, money, chainsLeft, redrawsLeft, seed, deckSize, onDeck, children } = props;
  const progress = Math.min(1, target > 0 ? total / target : 0);
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="where-block">
          <span className="where">
            Stop {stop} <span className="dot">·</span> {isHostTable(tableIndex) ? 'Host table' : `Table ${tableIndex + 1}`}
          </span>
          <span className="seed" data-testid="seed">
            Seed {seed}
          </span>
        </div>
        <span className="money" data-testid="money" aria-label={`${money} dollars`}>
          ${money}
        </span>
        {children}
        <button type="button" className="icon-btn deck-btn" onClick={onDeck} aria-label={`Deck, ${deckSize} cards`}>
          Deck <b>{deckSize}</b>
        </button>
      </div>
      <div className="stats">
        <Stat label="Target" value={formatNumber(target)} testId="target" />
        <Stat label="Total" value={formatNumber(total)} testId="total" />
        <Stat label="Chains" value={String(chainsLeft)} testId="chains" />
        <Stat label="Redraws" value={String(redrawsLeft)} testId="redraws" />
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Total toward the target"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(total, target)}
      >
        <span style={{ width: `${progress * 100}%` }} />
      </div>
    </header>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

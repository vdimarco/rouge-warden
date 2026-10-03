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
}

export function TopBar({ stop, tableIndex, target, total, money, chainsLeft, redrawsLeft, seed }: TopBarProps) {
  const progress = Math.min(1, target > 0 ? total / target : 0);
  return (
    <header className="topbar">
      <div className="topbar-row">
        <span className="where">
          Stop {stop} <span className="dot">·</span> Table {tableIndex + 1}
        </span>
        <span className="seed" data-testid="seed">
          Seed {seed}
        </span>
        <span className="money" data-testid="money" aria-label={`${money} dollars`}>
          ${money}
        </span>
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

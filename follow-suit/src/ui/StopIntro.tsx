import { CONFIG } from '../config';
import { HOSTS, stopHost, stopTargets, type RunState } from '../engine';
import { formatNumber } from './text';

/** The start of a stop: its targets and the host of its third table. */
export function StopIntro({ run, onBegin, onHowToPlay }: { run: RunState; onBegin: () => void; onHowToPlay: () => void }) {
  const host = HOSTS[stopHost(run)];
  const targets = stopTargets(run.stop, host.id);
  return (
    <div className="screen intro-screen" data-testid="stop-intro">
      <header className="intro-head">
        <span className="seed">Seed {run.seed}</span>
        <span className="money" aria-label={`${run.money} dollars`}>
          ${run.money}
        </span>
      </header>
      <div className="intro-body">
        <p className="intro-kicker">
          Stop {run.stop} of {CONFIG.run.stops}
        </p>
        <h1 className="intro-title">{host.name} waits at the third table.</h1>
        <p className="host-card" data-testid="intro-host" data-host={host.id}>
          {host.rule}
        </p>
        <ol className="targets">
          <li>
            <span>Table 1</span>
            <b>{formatNumber(targets[0])}</b>
          </li>
          <li>
            <span>Table 2</span>
            <b>{formatNumber(targets[1])}</b>
          </li>
          <li className="host-target">
            <span>Host table</span>
            <b>{formatNumber(targets[2])}</b>
          </li>
        </ol>
        <button type="button" className="btn how-btn" onClick={onHowToPlay}>
          How to play
        </button>
      </div>
      <div className="actions single">
        <button type="button" className="btn primary wide" onClick={onBegin}>
          Start table 1
        </button>
      </div>
    </div>
  );
}

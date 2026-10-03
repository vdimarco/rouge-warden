import {
  currentSuit,
  needsNamedSuit,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  suitColor,
  type ChainLink,
  type ChainPreview,
  type PlayedChain,
} from '../engine';
import { MiniCard } from './CardFace';
import { formatNumber } from './text';

interface ChainAreaProps {
  chain: readonly ChainLink[];
  preview: ChainPreview;
  ringMult: number;
  lastPlay: PlayedChain | null;
  /** Shown in place of the empty-chain message, for example in redraw mode. */
  hint?: string;
}

export function ChainArea({ chain, preview, ringMult, lastPlay, hint }: ChainAreaProps) {
  const suit = currentSuit(chain);
  return (
    <section className="chain-area" aria-label="Chain">
      <div className="chain-row" data-testid="chain" data-length={chain.length}>
        {chain.length === 0 ? (
          <p className={`chain-empty${hint ? ' hint' : ''}`} role={hint ? 'status' : undefined}>
            {hint ?? 'Tap any card to start a chain.'}
          </p>
        ) : (
          chain.map((link) => <MiniCard key={link.card.id} link={link} named={needsNamedSuit(link.card)} />)
        )}
      </div>

      <div className="live">
        <div className="num value">
          <span className="num-label">Value</span>
          <span className="num-figure" data-testid="value">
            {formatNumber(preview.value)}
          </span>
        </div>
        <span className="times" aria-hidden="true">
          ×
        </span>
        <div className="num mult">
          <span className="num-label">Mult</span>
          <span className="num-figure" data-testid="mult">
            {formatNumber(preview.mult)}
          </span>
        </div>
        <div
          className={`ring-marker${preview.ring ? ' on' : ''}`}
          data-testid="ring"
          data-on={preview.ring}
          title={`A ring multiplies Mult by ${ringMult}`}
        >
          <span className="ring-icon" aria-hidden="true" />
          <span className="ring-text">{preview.ring ? `Ring ×${ringMult}` : 'Ring'}</span>
        </div>
      </div>

      <div className="chain-foot">
        {suit !== null ? (
          <span className="suit-now">
            Current suit{' '}
            <b className={suitColor(suit)} aria-label={SUIT_NAMES[suit]}>
              {SUIT_SYMBOLS[suit]}
            </b>
          </span>
        ) : lastPlay !== null ? (
          <span className="last-play" data-testid="last-play">
            Last chain {formatNumber(lastPlay.result.score)}: {formatNumber(lastPlay.result.value)} ×{' '}
            {formatNumber(lastPlay.result.mult)}
            {lastPlay.result.ring ? ' with a ring' : ''}
          </span>
        ) : (
          <span className="rule-hint">Follow by suit or by rank. 8s are wild.</span>
        )}
      </div>
    </section>
  );
}

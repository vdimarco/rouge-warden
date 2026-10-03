import type { CSSProperties } from 'react';
import { CONFIG } from '../config';
import {
  CHARMS,
  currentSuit,
  eightsAreWild,
  HOSTS,
  needsNamedSuit,
  SUIT_NAMES,
  SUIT_SYMBOLS,
  suitColor,
  type ChainLink,
  type ChainPreview,
  type CharmId,
  type HostId,
  type PlayedChain,
  type Rules,
  type ScoreStep,
} from '../engine';
import { MiniCard } from './CardFace';
import { ringOffsets } from './reveal';
import { formatNumber } from './text';
import type { RevealView } from './useReveal';

interface ChainAreaProps {
  chain: readonly ChainLink[];
  preview: ChainPreview;
  ringMult: number;
  lastPlay: PlayedChain | null;
  rules: Rules;
  /** Shown in place of the empty-chain message, for example in redraw mode. */
  hint?: string;
  /** The score reveal, while it runs. */
  reveal?: RevealView | null;
  reducedMotion?: boolean;
}

type Tone = 'value' | 'mult' | 'money' | 'ring' | 'zero';

interface Pop {
  text: string;
  tone: Tone;
  /** A chain position for a pop above a card, or null for a pop above the counters. */
  index: number | null;
}

function sourceName(source: ScoreStep['source']): string {
  if (source === null) return '';
  return source in CHARMS ? CHARMS[source as CharmId].name : HOSTS[source as HostId].name;
}

/** The label that rises during a reveal beat. */
function popFor(step: ScoreStep): Pop {
  const amount = (s: ScoreStep): { text: string; tone: Tone } => {
    if (s.money > 0) return { text: `+$${s.money}`, tone: 'money' };
    if (s.timesMult !== 1) return { text: `×${s.timesMult}`, tone: s.timesMult === 0 ? 'zero' : 'mult' };
    if (s.addMult > 0) return { text: `+${s.addMult} Mult`, tone: 'mult' };
    return { text: `+${formatNumber(s.addValue)}`, tone: 'value' };
  };
  switch (step.kind) {
    case 'card':
      return { text: `+${step.addValue}`, tone: 'value', index: step.index };
    case 'ring':
      return {
        text: `${step.source ? `${sourceName(step.source)} ring` : 'Ring'} ×${step.timesMult}`,
        tone: 'ring',
        index: null,
      };
    case 'host':
      return { text: `${sourceName(step.source)}: no ring, ×0`, tone: 'zero', index: null };
    case 'switch':
    case 'charm': {
      const { text, tone } = amount(step);
      if (step.index !== null) return { text, tone, index: step.index };
      return { text: `${sourceName(step.source)} ${text}`, tone, index: null };
    }
  }
}

function multEffect(step: ScoreStep | null): 'bump' | 'flash' | null {
  if (step === null) return null;
  if (step.timesMult !== 1) return 'flash';
  return step.addMult > 0 ? 'bump' : null;
}

export function ChainArea(props: ChainAreaProps) {
  const { chain, preview, ringMult, lastPlay, rules, hint, reveal = null, reducedMotion = false } = props;
  const links = reveal?.links ?? chain;
  const suit = currentSuit(chain);
  const step = reveal?.beat?.step ?? null;
  const pop = step === null ? null : popFor(step);
  const offsets = reveal?.ringed && !reducedMotion ? ringOffsets(links.length) : null;
  const shortScreen = typeof window !== 'undefined' && window.innerHeight <= 760;
  const value = reveal ? reveal.value : preview.value;
  const mult = reveal ? reveal.mult : preview.mult;
  const ringOn = reveal ? reveal.result.ring : preview.ring;
  const effect = multEffect(step);
  const beatKey = reveal?.beatIndex ?? 'idle';

  const rowClasses = ['chain-row'];
  if (reveal) rowClasses.push('revealing');
  if (offsets) rowClasses.push('ringed');
  if (reveal?.ringed && reducedMotion) rowClasses.push('ring-fade');
  const rowStyle = {
    '--ring-ry': `${shortScreen ? CONFIG.feel.ringRadiusYShort : CONFIG.feel.ringRadiusY}px`,
  } as CSSProperties;

  return (
    <section className="chain-area" aria-label="Chain">
      <div
        className={rowClasses.join(' ')}
        style={rowStyle}
        data-testid="chain"
        data-length={links.length}
        data-ringed={reveal?.ringed ?? false}
      >
        {links.length === 0 ? (
          <p className={`chain-empty${hint ? ' hint' : ''}`} role={hint ? 'status' : undefined}>
            {hint ?? 'Tap any card to start a chain.'}
          </p>
        ) : (
          links.map((link, i) => {
            const classes = ['chain-slot'];
            if (reveal && i > reveal.scoredUpTo) classes.push('pending');
            if (step?.kind === 'card' && step.index === i) classes.push('active');
            const offset = offsets?.[i];
            const style = offset
              ? ({
                  '--tx': offset.x,
                  '--ty': offset.y,
                  '--s': offset.scale,
                  '--z': offset.z,
                  '--i': i,
                  '--n': links.length,
                } as CSSProperties)
              : undefined;
            return (
              <span key={link.card.id} className={classes.join(' ')} style={style} data-index={i}>
                <MiniCard card={link.card} named={needsNamedSuit(link.card, rules) ? link.suit : null} />
                {pop && pop.index === i && (
                  <span key={beatKey} className={`pop ${pop.tone}`} data-testid="card-pop" data-beat={beatKey}>
                    {pop.text}
                  </span>
                )}
              </span>
            );
          })
        )}
      </div>

      <div className="live">
        {pop && pop.index === null && (
          <span key={beatKey} className={`pop counter-pop ${pop.tone}`} data-testid="counter-pop" data-beat={beatKey}>
            {pop.text}
          </span>
        )}
        <div className="num value">
          <span className="num-label">Value</span>
          <span
            key={step?.addValue ? `value-${beatKey}` : 'value'}
            className={`num-figure${step?.addValue ? ' bump' : ''}`}
            data-testid="value"
          >
            {formatNumber(value)}
          </span>
        </div>
        <span className="times" aria-hidden="true">
          ×
        </span>
        <div
          key={effect === 'flash' ? `mult-${beatKey}` : 'mult'}
          className={`num mult${effect === 'flash' ? ' flash' : ''}${step?.timesMult === 0 ? ' zero' : ''}`}
          data-testid="mult-box"
        >
          <span className="num-label">Mult</span>
          <span
            key={effect === 'bump' ? `bump-${beatKey}` : 'figure'}
            className={`num-figure${effect === 'bump' ? ' bump' : ''}`}
            data-testid="mult"
          >
            {formatNumber(mult)}
          </span>
        </div>
        <div
          className={`ring-marker${ringOn ? ' on' : ''}`}
          data-testid="ring"
          data-on={ringOn}
          title={`A ring multiplies Mult by ${ringMult}`}
        >
          <span className="ring-icon" aria-hidden="true" />
          <span className="ring-text">{ringOn ? `Ring ×${ringMult}` : 'Ring'}</span>
        </div>
      </div>

      <div className="chain-foot">
        {reveal ? (
          reveal.score !== null ? (
            <span className="chain-score" data-testid="chain-score">
              Chain score {formatNumber(reveal.score)}
            </span>
          ) : (
            <span className="rule-hint">Scoring</span>
          )
        ) : suit !== null ? (
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
          <span className="rule-hint">
            Follow by suit or by rank. {eightsAreWild(rules) ? '8s are wild.' : '8s are not wild here.'}
          </span>
        )}
      </div>
    </section>
  );
}

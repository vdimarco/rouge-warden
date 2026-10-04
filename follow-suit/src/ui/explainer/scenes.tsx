// The 7 scenes of the explainer. Each one draws its frame at time t from the story, with the game's card faces.
// Places are on a grid 100 wide and 90 high. The stage keeps that shape on every screen.

import type { ReactNode } from 'react';
import { CONFIG } from '../../config';
import { isWild, SUIT_SYMBOLS, SUITS, suitColor, type Card, type ChainLink, type Suit } from '../../engine';
import { CardFace } from '../CardFace';
import { cardCode, formatNumber } from '../text';
import { easeOut, linear, pose, progress, type Key, type Pose } from './motion';
import {
  BUILD,
  FOLLOW,
  RING,
  RING_CHAIN,
  RING_REASON,
  RUN,
  SCORE_BEATS,
  SCORE_BEFORE_RING,
  TARGET,
  viaLabel,
  WILD,
} from './story';

const HEIGHT = 90;
const top = (y: number) => `${(y / HEIGHT) * 100}%`;
const place = (x: number, y: number) => ({ left: `${x}%`, top: top(y) });

/** 0 before start, 1 between, 0 after end, with a short fade at each edge. */
function shown(t: number, start: number, end = Number.POSITIVE_INFINITY, fade = 200): number {
  return Math.min(progress(t, start, start + fade, linear), 1 - progress(t, end - fade, end, linear));
}

type Glow = 'ok' | 'no' | 'gold' | null;

interface StageCardProps {
  card: Card;
  p: Pose;
  glow?: Glow;
  named?: Suit | null;
  wild?: boolean;
}

function StageCard({ card, p, glow = null, named = null, wild = false }: StageCardProps) {
  return (
    <span
      className={`ex-card${glow === null ? '' : ` ${glow}`}`}
      data-testid="ex-card"
      data-card={cardCode(card)}
      style={{
        ...place(p.x, p.y),
        opacity: p.opacity,
        transform: `translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.scale})`,
      }}
    >
      <CardFace card={card} wild={wild} />
      {named !== null && <span className={`ex-badge ${suitColor(named)}`}>{SUIT_SYMBOLS[named]}</span>}
    </span>
  );
}

/** The frame and the named-suit badge of a card in a chain. An 8 is wild even when it follows by suit or rank. */
const wildProps = (link: ChainLink) => (isWild(link.card) ? { wild: true, named: link.suit } : {});

function Chip({ x, y, text, kind, opacity }: { x: number; y: number; text: string; kind: 'ok' | 'no' | 'gold'; opacity: number }) {
  if (opacity <= 0.01) return null;
  return (
    <span className={`ex-chip ${kind}`} data-testid="ex-chip" style={{ ...place(x, y), opacity }}>
      {text}
    </span>
  );
}

/** A tap mark: a ring that grows and fades where a finger taps. */
function Tap({ x, y, at, t, reduced }: { x: number; y: number; at: number; t: number; reduced: boolean }) {
  const p = (t - at) / 600;
  if (p < 0 || p > 1) return null;
  const scale = reduced ? 1 : 0.6 + 0.8 * p;
  return <span className="ex-tap" style={{ ...place(x, y), opacity: 1 - p, transform: `translate(-50%, -50%) scale(${scale})` }} />;
}

/** Points that rise over a card and fade, as in the game's reveal. */
function Pop({ x, y, text, kind, at, t, reduced }: { x: number; y: number; text: string; kind: 'value' | 'mult' | 'ring'; at: number; t: number; reduced: boolean }) {
  const p = (t - at) / 900;
  if (p < 0 || p > 1) return null;
  const rise = reduced ? 0 : 5 * easeOut(Math.min(1, p * 1.6));
  const opacity = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
  return (
    <span className={`ex-pop ${kind}`} data-testid="ex-pop" style={{ ...place(x, y - rise), opacity }}>
      {text}
    </span>
  );
}

/** Empty places in the chain row. */
function Slots({ count, x, y }: { count: number; x: (i: number) => number; y: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="ex-slot" style={place(x(i), y)} />
      ))}
    </>
  );
}

/** A pop that rises from the top of a counter box, as the game's Mult pops do. */
function CounterPop({ text, at, t, reduced }: { text: string; at: number; t: number; reduced: boolean }) {
  const p = (t - at) / 900;
  if (p < 0 || p > 1) return null;
  const rise = reduced ? 0 : 14 * easeOut(Math.min(1, p * 1.6));
  const opacity = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
  return (
    <span className="ex-pop mult counter" data-testid="ex-pop" style={{ bottom: `calc(100% + ${4 + rise}px)`, opacity }}>
      {text}
    </span>
  );
}

interface CountersProps {
  value: number;
  mult: number;
  multBump: boolean;
  y: number;
  multPop?: { text: string; at: number; t: number; reduced: boolean } | null;
}

function Counters({ value, mult, multBump, y, multPop = null }: CountersProps) {
  return (
    <div className="ex-live" style={{ top: top(y) }}>
      <span className="num value" data-testid="ex-value">
        <span className="num-label">Value</span>
        <span className="num-figure">{formatNumber(value)}</span>
      </span>
      <span className="times">×</span>
      <span className={`num mult${multBump ? ' bump' : ''}`} data-testid="ex-mult">
        <span className="num-label">Mult</span>
        <span className="num-figure">{formatNumber(mult)}</span>
        {multPop !== null && <CounterPop {...multPop} />}
      </span>
    </div>
  );
}

// Places on the grid.
const CHAIN_Y = 24;
const HAND_Y = 70;
const LIFT_Y = 64;
const chainX = (i: number) => 14 + i * 16.5;
const handX = (i: number, n: number) => 50 + (i - (n - 1) / 2) * 17;
const ROW_Y = 26;
const ROW_SCALE = 0.87;
const rowX = (i: number) => 13 + i * 14.8;
const COUNTERS_Y = 61;

/** Where card i of n sits on a ring around (cx, cy), from the left, over the top and back along the bottom. */
function ringPlace(i: number, n: number, cx: number, cy: number, rx: number, ry: number) {
  const angle = Math.PI + (2 * Math.PI * i) / n;
  return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
}

/** A card that deals into the hand, waits, rises when it is chosen, and moves to its place in the chain. */
function handKeys(x: number, deal: number, rise: number | null, move: number | null, to: { x: number; y: number }): Key[] {
  const keys: Key[] = [
    { at: 0, x, y: HAND_Y + 12, opacity: 0 },
    { at: deal, x, y: HAND_Y + 12, opacity: 0 },
    { at: deal + 420, x, y: HAND_Y, opacity: 1, ease: easeOut },
  ];
  if (rise !== null) keys.push({ at: rise, y: HAND_Y }, { at: rise + 260, y: LIFT_Y, ease: easeOut });
  if (move !== null) keys.push({ at: move }, { at: move + 550, x: to.x, y: to.y });
  return keys;
}

function sceneBuild(t: number, reduced: boolean): ReactNode {
  const moves = [900, 2_000, 3_100];
  const n = BUILD.hand.length;
  return (
    <>
      <Slots count={5} x={chainX} y={CHAIN_Y} />
      {BUILD.hand.map((card, i) => {
        const x = handX(i, n);
        const move = moves[i] ?? null;
        const keys = handKeys(x, i * 90, null, move, { x: chainX(i), y: CHAIN_Y });
        // The cards left in the hand close up after the last move.
        const left = i - moves.length;
        if (move === null) keys.push({ at: 3_800 }, { at: 4_300, x: handX(left, n - moves.length) });
        return <StageCard key={card.id} card={card} p={pose(keys, t, reduced)} />;
      })}
      {moves.map((at, i) => (
        <Tap key={at} x={handX(i, n)} y={HAND_Y} at={at - 260} t={t} reduced={reduced} />
      ))}
    </>
  );
}

function sceneFollow(t: number, reduced: boolean): ReactNode {
  const [suitTry, missTry, rankTry] = FOLLOW.tries;
  const n = FOLLOW.hand.length;
  const start = FOLLOW.start[0].card;
  // K♠ rises at 600 and joins at 1300. Q♦ rises at 2300, shakes and drops back at 3300. K♥ rises at 4000 and joins at 4700.
  const miss = pose(
    [
      ...handKeys(handX(1, n), 90, 2_300, null, { x: 0, y: 0 }),
      { at: 3_300, y: LIFT_Y, opacity: 1 },
      { at: 3_600, y: HAND_Y, opacity: 0.45 },
    ],
    t,
    reduced,
  );
  const shake = reduced ? 0 : Math.sin(((t - 2_600) / 500) * 6 * Math.PI) * 2 * (1 - progress(t, 2_600, 3_100, linear));
  const shaking = t >= 2_600 && t <= 3_100;
  return (
    <>
      <Slots count={5} x={chainX} y={CHAIN_Y} />
      <StageCard card={start} p={pose([{ at: 0, x: chainX(0), y: CHAIN_Y }], t, reduced)} />
      <StageCard
        card={suitTry.card}
        p={pose(handKeys(handX(0, n), 0, 600, 1_300, { x: chainX(1), y: CHAIN_Y }), t, reduced)}
        glow={t >= 600 && t < 1_850 ? 'ok' : null}
      />
      <StageCard card={missTry.card} p={{ ...miss, x: miss.x + (shaking ? shake : 0) }} glow={t >= 2_300 && t < 3_400 ? 'no' : null} />
      <StageCard
        card={rankTry.card}
        p={pose(handKeys(handX(2, n), 180, 4_000, 4_700, { x: chainX(2), y: CHAIN_Y }), t, reduced)}
        glow={t >= 4_000 && t < 5_250 ? 'ok' : null}
      />
      <Chip x={handX(0, n)} y={50} text={viaLabel(suitTry)} kind="ok" opacity={shown(t, 600, 1_500)} />
      <Chip x={handX(1, n)} y={50} text={viaLabel(missTry)} kind="no" opacity={shown(t, 2_300, 3_700)} />
      <Chip x={handX(2, n)} y={50} text={viaLabel(rankTry)} kind="ok" opacity={shown(t, 4_000, 5_100)} />
    </>
  );
}

const PICKER_Y = 50;
const pickerX = (i: number) => 32 + i * 12;

function sceneWild(t: number, reduced: boolean): ReactNode {
  const n = WILD.hand.length;
  const named = WILD.named;
  const namedIndex = SUITS.indexOf(named);
  const pickerOpacity = shown(t, 1_900, 3_600, 300);
  return (
    <>
      <Slots count={5} x={chainX} y={CHAIN_Y} />
      {WILD.start.map((link, i) => (
        <StageCard key={link.card.id} card={link.card} p={pose([{ at: 0, x: chainX(i), y: CHAIN_Y }], t, reduced)} />
      ))}
      <StageCard
        card={WILD.eight.card}
        p={pose(handKeys(handX(0, n), 0, 600, 1_200, { x: chainX(3), y: CHAIN_Y }), t, reduced)}
        glow={t >= 600 && t < 1_750 ? 'gold' : null}
        wild
        named={t >= 3_300 ? named : null}
      />
      <StageCard
        card={WILD.next.card}
        p={pose(handKeys(handX(1, n), 90, 4_100, 4_700, { x: chainX(4), y: CHAIN_Y }), t, reduced)}
        glow={t >= 4_100 && t < 5_250 ? 'ok' : null}
      />
      <StageCard
        card={WILD.misfit}
        p={pose([...handKeys(handX(2, n), 180, null, null, { x: 0, y: 0 }), { at: 3_600, opacity: 1 }, { at: 3_900, opacity: 0.45 }], t, reduced)}
      />
      <Chip x={handX(0, n)} y={PICKER_Y} text={viaLabel(WILD.eight)} kind="gold" opacity={shown(t, 600, 1_500)} />
      <Chip x={handX(1, n)} y={PICKER_Y} text={viaLabel(WILD.next)} kind="ok" opacity={shown(t, 4_100, 5_200)} />
      {pickerOpacity > 0.01 && (
        <div className="ex-picker" style={{ opacity: pickerOpacity }}>
          {SUITS.map((suit, i) => (
            <span
              key={suit}
              className={`ex-suit ${suitColor(suit)}${i === namedIndex && t >= 2_900 ? ' on' : ''}`}
              style={place(pickerX(i), PICKER_Y)}
            >
              {SUIT_SYMBOLS[suit]}
            </span>
          ))}
        </div>
      )}
      <Tap x={pickerX(namedIndex)} y={PICKER_Y} at={2_700} t={t} reduced={reduced} />
    </>
  );
}

function rowKeys(i: number): Key[] {
  return [
    { at: 0, x: rowX(i), y: ROW_Y - 6, scale: ROW_SCALE, opacity: 0 },
    { at: i * 60, x: rowX(i), y: ROW_Y - 6, scale: ROW_SCALE, opacity: 0 },
    { at: i * 60 + 360, x: rowX(i), y: ROW_Y, scale: ROW_SCALE, opacity: 1, ease: easeOut },
  ];
}

function sceneScore(t: number, reduced: boolean): ReactNode {
  const done = SCORE_BEATS.filter((beat) => beat.at <= t);
  const last = done[done.length - 1];
  const lastSwitch = [...done].reverse().find((beat) => beat.note !== null);
  return (
    <>
      {RING_CHAIN.map((link, i) => {
        const scored = SCORE_BEATS.find((beat) => beat.step.kind === 'card' && beat.step.index === i);
        const bump = scored === undefined || reduced ? 0 : Math.max(0, 1 - Math.abs(t - scored.at - 120) / 150) * 0.08;
        const p = pose(rowKeys(i), t, reduced);
        return <StageCard key={link.card.id} card={link.card} p={{ ...p, scale: p.scale + bump }} {...wildProps(link)} />;
      })}
      {SCORE_BEATS.filter((beat) => beat.step.kind === 'card').map((beat) => (
        <Pop
          key={beat.at}
          x={rowX(beat.step.index ?? 0)}
          y={13}
          text={`+${beat.step.addValue}`}
          kind="value"
          at={beat.at}
          t={t}
          reduced={reduced}
        />
      ))}
      <Counters
        value={last?.step.value ?? 0}
        mult={last?.step.mult ?? CONFIG.chain.startMult}
        multBump={lastSwitch !== undefined && t - lastSwitch.at < 400}
        y={COUNTERS_Y}
        multPop={lastSwitch === undefined ? null : { text: `+${lastSwitch.step.addMult} Mult`, at: lastSwitch.at, t, reduced }}
      />
    </>
  );
}

/** When the cards of the ring scene reach their loop and Mult doubles. */
export const RING_AT = 2_300;
const RING_MOVE = 1_400;
const RING_CENTER = { x: 50, y: 28 };

function sceneRing(t: number, reduced: boolean): ReactNode {
  const n = RING_CHAIN.length;
  const ringOpacity = shown(t, RING_AT - 400, Number.POSITIVE_INFINITY, 400);
  return (
    <>
      <span className="ex-ring" style={{ ...place(RING_CENTER.x, RING_CENTER.y), width: '72%', height: top(22), opacity: ringOpacity }} />
      {RING_CHAIN.map((link, i) => {
        const to = ringPlace(i, n, RING_CENTER.x, RING_CENTER.y, 36, 11);
        const keys: Key[] = [
          { at: 0, x: rowX(i), y: ROW_Y, scale: ROW_SCALE },
          { at: RING_MOVE, x: rowX(i), y: ROW_Y, scale: ROW_SCALE },
          { at: RING_AT, x: to.x, y: to.y, scale: 0.72 },
        ];
        const ends = i === 0 || i === n - 1;
        return (
          <StageCard
            key={link.card.id}
            card={link.card}
            p={pose(keys, t, reduced)}
            {...wildProps(link)}
            glow={ends && t >= 500 && t < RING_AT + 600 ? 'gold' : null}
          />
        );
      })}
      <Chip x={50} y={51} text={RING_REASON} kind="gold" opacity={shown(t, 500, RING_AT)} />
      <Pop x={50} y={50} text={`Ring ×${CONFIG.chain.ringMult}`} kind="ring" at={RING_AT} t={t} reduced={reduced} />
      <Counters
        value={SCORE_BEFORE_RING.value}
        mult={t >= RING_AT ? RING.mult : SCORE_BEFORE_RING.mult}
        multBump={t >= RING_AT && t - RING_AT < 500}
        y={COUNTERS_Y}
      />
    </>
  );
}

const BAR_LEFT = 10;
const BAR_WIDTH = 80;

function sceneTarget(t: number, reduced: boolean): ReactNode {
  const n = RING_CHAIN.length;
  const top_ = RING.score * 1.15;
  const fill = progress(t, 1_700, 2_800, easeOut);
  const total = Math.round(RING.score * fill);
  const targetAt = BAR_LEFT + (BAR_WIDTH * TARGET) / top_;
  const cleared = total >= TARGET;
  const stamp = progress(t, 3_000, 3_350, easeOut);
  return (
    <>
      <span className="ex-ring small" style={{ ...place(50, 15), width: '44%', height: top(14) }} />
      {RING_CHAIN.map((link, i) => {
        const at = ringPlace(i, n, 50, 15, 22, 7);
        return (
          <StageCard
            key={link.card.id}
            card={link.card}
            p={pose([{ at: 0, x: at.x, y: at.y, scale: 0.42 }], t, reduced)}
            {...wildProps(link)}
          />
        );
      })}
      <div className="ex-equation" style={{ top: top(38), opacity: shown(t, 500) }} data-testid="ex-equation">
        <b className="v">{formatNumber(RING.value)}</b> × <b className="m">{formatNumber(RING.mult)}</b>
        <span style={{ opacity: shown(t, 1_100) }}>
          {' '}
          = <b className="s" data-testid="ex-score">{formatNumber(RING.score)}</b>
        </span>
      </div>
      <div className="ex-bar" style={{ top: top(60), left: `${BAR_LEFT}%`, width: `${BAR_WIDTH}%` }}>
        <span className={`ex-fill${cleared ? ' over' : ''}`} style={{ transform: `scaleX(${(RING.score * fill) / top_})` }} />
        <span className="ex-mark" style={{ left: `${((targetAt - BAR_LEFT) / BAR_WIDTH) * 100}%` }} />
      </div>
      <span className="ex-note" style={{ ...place(targetAt, 53) }} data-testid="ex-target">
        Target {formatNumber(TARGET)}
      </span>
      <span className="ex-note left" style={{ ...place(BAR_LEFT, 69) }} data-testid="ex-total">
        Total {formatNumber(total)}
      </span>
      <span className="ex-note right" style={{ ...place(BAR_LEFT + BAR_WIDTH, 69) }}>
        Chain 1 of {CONFIG.table.chains}
      </span>
      {stamp > 0 && (
        <span
          className="ex-stamp"
          data-testid="ex-cleared"
          style={{ ...place(50, 80), opacity: stamp, transform: `translate(-50%, -50%) rotate(-4deg) scale(${reduced ? 1 : 1.3 - 0.3 * stamp})` }}
        >
          Table cleared
        </span>
      )}
    </>
  );
}

const ROW_A = 15;
const ROW_B = 41;
const stopX = [15, 38.3, 61.6, 85];

function stopPlace(i: number) {
  return i < 4 ? { x: stopX[i], y: ROW_A } : { x: stopX[7 - i], y: ROW_B };
}

function sceneRun(t: number, reduced: boolean): ReactNode {
  const stops = Array.from({ length: RUN.stops }, (_, i) => i);
  const dot = (stop: number, table: number) => {
    const p = stopPlace(stop);
    return { x: p.x + (table - (RUN.tables - 1) / 2) * 4, y: p.y + 8.5 };
  };
  const token = pose(
    [
      { at: 0, ...dot(0, 0), opacity: 0 },
      { at: 1_900, ...dot(0, 0), opacity: 0 },
      { at: 2_100, ...dot(0, 0), opacity: 1 },
      { at: 2_400 },
      { at: 2_700, ...dot(0, 1) },
      { at: 2_900 },
      { at: 3_200, ...dot(0, 2) },
    ],
    t,
    reduced,
  );
  const shop = pose(
    [
      { at: 0, x: 50, y: 98, opacity: 0 },
      { at: 3_600, x: 50, y: 98, opacity: 0 },
      { at: 4_200, x: 50, y: 73, opacity: 1, ease: easeOut },
    ],
    t,
    reduced,
  );
  return (
    <>
      <svg className="ex-path" viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" style={{ opacity: shown(t, 0, Number.POSITIVE_INFINITY, 400) }}>
        <polyline points={stops.map((i) => `${stopPlace(i).x},${stopPlace(i).y}`).join(' ')} />
      </svg>
      {stops.map((i) => {
        const p = stopPlace(i);
        return (
          <span key={i} className="ex-stop-group" style={{ opacity: shown(t, i * 200, Number.POSITIVE_INFINITY, 250) }}>
            <span className="ex-stop" style={place(p.x, p.y)}>
              {i + 1}
            </span>
            {Array.from({ length: RUN.tables }, (_, table) => {
              const d = dot(i, table);
              return <span key={table} className={`ex-dot${table === RUN.tables - 1 ? ' host' : ''}`} style={place(d.x, d.y)} />;
            })}
          </span>
        );
      })}
      <span className="ex-token" style={{ ...place(token.x, token.y), opacity: token.opacity }} />
      <Chip x={dot(0, 2).x + 13} y={dot(0, 2).y + 7} text="Host table" kind="gold" opacity={shown(t, 3_200, 5_600)} />
      <div className="ex-shop" style={{ ...place(shop.x, shop.y), opacity: shop.opacity }}>
        <span className="ex-shop-title">Shop</span>
        <span className="ex-offer">
          <span className="ex-offer-kind">Charm</span>
          <b>{RUN.charm.name}</b>
          <span className="ex-price">${RUN.charm.price}</span>
        </span>
        <span className="ex-offer">
          <span className="ex-offer-kind">Stamp</span>
          <b>{RUN.stamp.name}</b>
          <span className="ex-price">${RUN.stamp.price}</span>
        </span>
      </div>
    </>
  );
}

/** The scenes in order. Each draws its frame at time t. */
export const SCENE_FRAMES: readonly ((t: number, reduced: boolean) => ReactNode)[] = [
  sceneBuild,
  sceneFollow,
  sceneWild,
  sceneScore,
  sceneRing,
  sceneTarget,
  sceneRun,
];

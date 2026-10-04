// The chains and the numbers that the explainer shows. The engine builds and scores them, so the explainer cannot show
// a chain that breaks the rules or a score that the game would not give.

import { CONFIG } from '../../config';
import {
  addToChain,
  CHARMS,
  charmPrice,
  currentSuit,
  followVia,
  rankLabel,
  scoreChain,
  STAMPS,
  SUIT_SYMBOLS,
  tableTarget,
  type Card,
  type ChainLink,
  type FollowVia,
  type Rank,
  type ScoreStep,
  type Suit,
} from '../../engine';

const card = (scene: string, suit: Suit, rank: Rank): Card => ({ id: `how-${scene}-${rank}${suit}`, suit, rank });

type Entry = Card | { readonly card: Card; readonly named: Suit };

/** Builds a chain with the engine. A card that cannot follow throws, so a broken story fails at once. */
function chainOf(entries: readonly Entry[]): ChainLink[] {
  return entries.reduce<ChainLink[]>(
    (chain, entry) => ('named' in entry ? addToChain(chain, entry.card, entry.named) : addToChain(chain, entry)),
    [],
  );
}

const WILD_RANK = rankLabel(CONFIG.cards.wildRank);
const RING_VERB = CONFIG.chain.ringMult === 2 ? 'doubles' : `multiplies by ${CONFIG.chain.ringMult}`;

export interface SceneInfo {
  readonly id: string;
  readonly title: string;
  readonly text: string;
  readonly ms: number;
}

const TEXT: readonly (readonly [string, string, string])[] = [
  ['build', 'Build a chain', 'Tap cards to put them in a row. Each card must follow the card before it.'],
  ['follow', 'Follow by suit or by rank', 'The next card must have the same suit or the same rank as the last card.'],
  ['wild', `${WILD_RANK}s are wild`, `An ${WILD_RANK} can follow any card. It names a suit, and the next card must have that suit.`],
  ['score', 'Value and Mult', `Each card adds its points to Value. Each change of suit adds ${CONFIG.chain.switchMult} to Mult.`],
  [
    'ring',
    'Close a ring',
    `Use ${CONFIG.chain.ringMinCards} or more cards and end on the suit or the rank of the first card. A ring ${RING_VERB} Mult.`,
  ],
  ['target', 'Beat the target', `A chain scores Value times Mult. Reach the target of the table in ${CONFIG.table.chains} chains or fewer.`],
  [
    'run',
    'Win the run',
    `Clear ${CONFIG.run.stops} stops of ${CONFIG.run.tablesPerStop} tables. At each third table, a host changes a rule. Between tables, buy charms and stamps.`,
  ],
];

export const SCENES: readonly SceneInfo[] = TEXT.map(([id, title, text], i) => ({ id, title, text, ms: CONFIG.explainer.sceneMs[i] }));

/** The short list of rules on the end card. */
export const RECAP: readonly string[] = [
  'Follow the suit or the rank of the last card.',
  `An ${WILD_RANK} is wild and names the next suit.`,
  `Each change of suit adds ${CONFIG.chain.switchMult} to Mult.`,
  `A ring of ${CONFIG.chain.ringMinCards} or more cards ${RING_VERB} Mult.`,
  `Value times Mult must reach the target in ${CONFIG.table.chains} chains.`,
];

/** A card that the player tries to add, and how it follows the chain. Null: it does not follow. */
export interface Attempt {
  readonly chain: readonly ChainLink[];
  readonly card: Card;
  readonly via: FollowVia | null;
}

const attempt = (chain: readonly ChainLink[], next: Card): Attempt => ({ chain, card: next, via: followVia(chain, next) });

/** The chip over a card that the player tries. */
export function viaLabel({ chain, card: next, via }: Attempt): string {
  switch (via) {
    case 'suit':
      return `Same suit ${SUIT_SYMBOLS[currentSuit(chain) ?? next.suit]}`;
    case 'rank':
      return `Same rank ${rankLabel(next.rank)}`;
    case 'eight':
      return 'Wild';
    case null:
      return 'No match';
    default:
      return 'Follows';
  }
}

// Scene 1: three cards leave the hand, one at a time, and make a row.
const b = (suit: Suit, rank: Rank) => card('build', suit, rank);
const BUILD_ROW = [b('S', 7), b('S', 13), b('H', 13)];
export const BUILD = {
  hand: [...BUILD_ROW, b('D', 12), b('C', 4)],
  chain: chainOf(BUILD_ROW),
};

// Scene 2: K♠ follows 7♠ by suit, Q♦ matches neither, K♥ follows K♠ by rank.
const f = (suit: Suit, rank: Rank) => card('follow', suit, rank);
const [F7S, FKS, FQD, FKH] = [f('S', 7), f('S', 13), f('D', 12), f('H', 13)];
export const FOLLOW = {
  start: chainOf([F7S]),
  hand: [FKS, FQD, FKH],
  tries: [attempt(chainOf([F7S]), FKS), attempt(chainOf([F7S, FKS]), FQD), attempt(chainOf([F7S, FKS]), FKH)],
  chain: chainOf([F7S, FKS, FKH]),
};

// Scene 3: an 8 follows K♥, names diamonds, and then 4♦ follows. 9♠ no longer fits.
const w = (suit: Suit, rank: Rank) => card('wild', suit, rank);
const [W7S, WKS, WKH, W8C, W4D, W9S] = [w('S', 7), w('S', 13), w('H', 13), w('C', CONFIG.cards.wildRank as Rank), w('D', 4), w('S', 9)];
const WILD_NAMED: Suit = 'D';
const WILD_START = chainOf([W7S, WKS, WKH]);
const WILD_WITH_EIGHT = chainOf([W7S, WKS, WKH, { card: W8C, named: WILD_NAMED }]);
export const WILD = {
  start: WILD_START,
  hand: [W8C, W4D, W9S],
  eight: attempt(WILD_START, W8C),
  named: WILD_NAMED,
  next: attempt(WILD_WITH_EIGHT, W4D),
  misfit: W9S,
  chain: chainOf([W7S, WKS, WKH, { card: W8C, named: WILD_NAMED }, W4D]),
};

// Scenes 4 to 6: the ring from seed K7QX2M. 6♣ 6♦ 7♦ 7♠ 8♠ (clubs) A♣ has 3 changes of suit and ends on clubs.
const r = (suit: Suit, rank: Rank) => card('ring', suit, rank);
export const RING_CHAIN = chainOf([
  r('C', 6),
  r('D', 6),
  r('D', 7),
  r('S', 7),
  { card: r('S', CONFIG.cards.wildRank as Rank), named: 'C' },
  r('C', 14),
]);
export const RING = scoreChain(RING_CHAIN);

const SCORED = RING.steps.filter((step) => step.kind === 'card' || step.kind === 'switch');
/** Value and Mult when the cards are scored, before the ring. */
export const SCORE_BEFORE_RING: ScoreStep = SCORED[SCORED.length - 1];
export const RING_STEP: ScoreStep | undefined = RING.steps.find((step) => step.kind === 'ring');

const FIRST = RING_CHAIN[0].card;
const LAST = RING_CHAIN[RING_CHAIN.length - 1].card;
/** Why the chain closes a ring: its last card shares the suit or the rank of its first card. */
export const RING_REASON = LAST.suit === FIRST.suit ? `Same suit ${SUIT_SYMBOLS[FIRST.suit]}` : `Same rank ${rankLabel(FIRST.rank)}`;

/** The target of the first table of the run. */
export const TARGET = tableTarget(1, 0);

/** A scoring step in scene 4, and its note: 0 for the first change of suit, then 1 and 2. */
export interface ScoreBeat {
  readonly at: number;
  readonly step: ScoreStep;
  readonly note: number | null;
}

// Scene 4 timing: the first card scores after this time, then each card and each change of suit takes its own time.
const SCORE_START_MS = 900;
const CARD_BEAT_MS = 600;
const SWITCH_BEAT_MS = 450;

export const SCORE_BEATS: readonly ScoreBeat[] = (() => {
  let at = SCORE_START_MS;
  let notes = 0;
  return SCORED.map((step) => {
    const beat = { at, step, note: step.kind === 'switch' ? notes++ : null };
    at += step.kind === 'card' ? CARD_BEAT_MS : SWITCH_BEAT_MS;
    return beat;
  });
})();

// Scene 7: the run, the host tables and the shop.
export const RUN = {
  stops: CONFIG.run.stops,
  tables: CONFIG.run.tablesPerStop,
  charm: { name: CHARMS.lantern.name, text: CHARMS.lantern.text, price: charmPrice('lantern') },
  stamp: { name: STAMPS.suit.name, text: STAMPS.suit.text, price: CONFIG.shop.stampPrice },
};

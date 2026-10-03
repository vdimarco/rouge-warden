export type Suit = 'S' | 'H' | 'D' | 'C';

/** 2 to 10, then J = 11, Q = 12, K = 13 and A = 14. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type Color = 'red' | 'black';

export interface Card {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
}

/** How a card joined the chain. */
export type FollowVia = 'first' | 'suit' | 'rank' | 'eight';

export interface ChainLink {
  readonly card: Card;
  /** The current suit after this card. For a wild 8 it is the named suit. */
  readonly suit: Suit;
  readonly via: FollowVia;
}

export type Suit = 'S' | 'H' | 'D' | 'C';

/** 2 to 10, then J = 11, Q = 12, K = 13 and A = 14. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type Color = 'red' | 'black';

export interface Card {
  readonly id: string;
  readonly suit: Suit;
  readonly rank: Rank;
}

/** How a card joined the chain. Turncoat and Bridge are once-per-chain charm follows. */
export type FollowVia = 'first' | 'suit' | 'rank' | 'eight' | 'turncoat' | 'bridge';

export interface ChainLink {
  readonly card: Card;
  /** The current suit after this card. For a wild 8 it is the named suit. */
  readonly suit: Suit;
  readonly via: FollowVia;
}

export type HostId = 'purist' | 'zebra' | 'climber' | 'miser' | 'jeweler';

export type CharmId =
  | 'lantern'
  | 'crown'
  | 'pawnbroker'
  | 'hinge'
  | 'luckyEight'
  | 'longHaul'
  | 'pocket'
  | 'turncoat'
  | 'bridge'
  | 'tidy'
  | 'ledger'
  | 'knot'
  | 'spiral';

export type Rarity = 'common' | 'uncommon' | 'rare';

/** The 4 suit slots and the table slot. */
export type SlotId = Suit | 'table';

export interface OwnedCharm {
  readonly id: CharmId;
  /** Mult that Spiral has gained from rings. 0 for every other charm. */
  readonly stacks: number;
}

export type CharmSlots = { readonly [K in SlotId]: OwnedCharm | null };

/** The limits on top of the follow rules: the host and the table charm. */
export interface Rules {
  readonly host: HostId | null;
  readonly tableCharm: CharmId | null;
}

export type StampId = 'suit' | 'copy' | 'eight' | 'burn';

/** A stamp with its targets, ready to apply to the run deck. */
export type StampUse =
  | { readonly id: 'suit'; readonly cardId: string; readonly suit: Suit }
  | { readonly id: 'copy'; readonly fromId: string; readonly toId: string }
  | { readonly id: 'eight'; readonly suit: Suit }
  | { readonly id: 'burn'; readonly cardId: string };

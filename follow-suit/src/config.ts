// Every tunable number in Follow Suit lives here.
// The brief is the source of truth for the starting values.

export const CONFIG = {
  cards: {
    // Cards 2 to 10 count their number. J, Q and K count `facePoints`. An A counts `acePoints`.
    facePoints: 10,
    acePoints: 11,
    // The rank that is wild and names a suit.
    wildRank: 8,
  },

  table: {
    handSize: 8,
    chains: 3,
    redraws: 2,
  },

  chain: {
    startValue: 0,
    startMult: 1,
    switchMult: 1,
    ringMinCards: 4,
    ringMult: 2,
  },

  run: {
    stops: 8,
    tablesPerStop: 3,
    startMoney: 4,
    // Base target for each stop.
    baseTargets: [150, 400, 1_000, 2_500, 6_000, 14_000, 30_000, 60_000],
    // The table target is the base times this scale. The third table is the host table.
    tableScale: [1, 1.5, 2],
    // The host table target is also multiplied by the host's own scale.
    hostScale: {
      purist: 1,
      zebra: 1,
      climber: 1,
      miser: 1,
      jeweler: 1,
    },
  },

  money: {
    // Pay for the first table, the second table and the host table.
    tablePay: [3, 4, 5],
    perUnusedChain: 1,
    // Paid for each power of ten that the total beats the target by.
    perPowerOfTen: 1,
  },

  shop: {
    charmOffers: 2,
    stampOffers: 2,
    rarityWeights: { common: 60, uncommon: 30, rare: 10 },
    charmPrices: { common: 4, uncommon: 6, rare: 8 },
    stampPrice: 3,
    rerollBase: 2,
    rerollStep: 1,
    // A charm sells for its price divided by this, rounded down.
    sellDivisor: 2,
  },

  charms: {
    lanternValue: 4,
    crownValue: 8,
    pawnbrokerMoney: 1,
    hingeSwitchMult: 2,
    luckyEightMult: 3,
    longHaulCards: 3,
    longHaulMult: 1,
    pocketValue: 6,
    tidyMult: 3,
    ledgerMinCards: 6,
    ledgerMoney: 2,
    knotRingMult: 3,
    spiralMult: 1,
  },

  stamps: {
    minDeckSize: 20,
  },

  // The score reveal after Play chain. Times are in milliseconds.
  feel: {
    cardMs: 180,
    cardCharmMs: 150,
    switchMs: 170,
    endCharmMs: 340,
    ringMs: 760,
    multiplyMs: 440,
    hostMs: 600,
    scoreHoldMs: 450,
    countUpMs: 650,
    coinGapMs: 150,
    // The ring is an ellipse around the chain row, in px.
    ringRadiusXPerCard: 22,
    ringRadiusXMin: 70,
    ringRadiusXMax: 148,
    ringRadiusY: 34,
    ringRadiusYShort: 15,
    ringBackScale: 0.86,
    ringFrontScale: 1.04,
  },

  sound: {
    // G4. Each chain starts at the root, and each switch moves one step up the major scale.
    rootHz: 392,
    majorScale: [0, 2, 4, 5, 7, 9, 11],
    noteMs: 420,
    ringChordSteps: [7, 9, 11],
    ringNoteGapMs: 70,
    coinHz: [1568, 2093],
    coinNoteMs: 70,
    volume: 0.16,
  },

  seed: {
    length: 6,
    // No 0, O, 1, I or L, because they look alike.
    alphabet: '23456789ABCDEFGHJKMNPQRSTUVWXYZ',
  },
} as const;

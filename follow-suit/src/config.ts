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
    // Base target for each stop. Tuned in milestone 5: see BALANCE.md. The brief started at
    // 150, 400, 1,000, 2,500, 6,000, 14,000, 30,000 and 60,000.
    baseTargets: [150, 300, 750, 1_875, 4_500, 10_500, 22_500, 45_000],
    // The table target is the base times this scale. The third table is the host table.
    tableScale: [1, 1.5, 2],
    // The host table target is also multiplied by the host's own scale. Each started at 1. The
    // scales put every host table at stop 2 at about the same clear rate: see BALANCE.md.
    hostScale: {
      purist: 0.18,
      zebra: 0.12,
      climber: 0.19,
      miser: 0.48,
      jeweler: 0.23,
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

  // The how-to-play explainer. Times are in milliseconds.
  explainer: {
    // Build a chain, suit or rank, 8s are wild, Value and Mult, close a ring, beat the target, win the run.
    sceneMs: [6_500, 7_500, 7_000, 8_000, 6_500, 7_000, 8_000],
    // With reduced motion a card fades in at its new place over this time instead of travelling there.
    fadeMs: 220,
    // A frame that comes later than this (a hidden tab, a slow phone) moves the clock by this much only.
    maxFrameMs: 100,
  },

  seed: {
    length: 6,
    // No 0, O, 1, I or L, because they look alike.
    alphabet: '23456789ABCDEFGHJKMNPQRSTUVWXYZ',
  },
} as const;

# Follow Suit: a card roguelike prototype

Add Follow Suit, a single-player card roguelike for phones in portrait, in a new `follow-suit/` folder. The player builds chains from a hand of 8 cards. Each card must follow the card before it by suit or by rank, as in Crazy Eights, and 8s are wild. Switches and rings raise the score. A run has 8 stops of 3 tables, with hosts, a shop, charms and stamps. The user asked for this prototype in a detailed brief, and the brief is the source of truth for every rule.

## Scope

- A Vite, React and TypeScript app in `follow-suit/`. The rules live in a pure engine with Vitest tests.
- Milestone 1: the engine and its tests.
- Milestone 2: one playable table and a Vercel preview. The user approves before milestone 3 starts.
- Milestone 3: the full run with hosts, money, the shop, charms, stamps, the deck view and seeds.
- Milestone 4: the score reveal, Web Audio sounds, the mute toggle and reduced motion.
- Milestone 5: a simulator that tunes the targets, with its report in `BALANCE.md`.
- Sounds come from the Web Audio API. Cards are drawn with CSS. The app uses no image or audio files.

## Out of scope

- Accounts, online play, monetization, achievements, unlocks, difficulty tiers, alternate decks, localization and native app builds.
- A Cottage Arcade cabinet. `follow-suit/IDEAS.md` keeps that idea for later.

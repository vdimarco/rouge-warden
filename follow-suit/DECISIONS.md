# Decisions

The brief is the source of truth. Where a rule was unclear, the simplest reading is recorded here.

## Project

1. **Repository.** The brief asks for a new folder and a new git repo. This work happens on the branch `claude/follow-suit-prototype-0fyikv` of `vdimarco/rouge-warden`, and a repo inside a repo does not push with its parent. So `follow-suit/` is a folder at the root of that repo, and the branch history is its history. To split it out later, run `git subtree split --prefix follow-suit`.
2. **Deploys.** The Vercel CLI is not installed in the build container, so the Vercel connector deploys instead. It made the project `follow-suit` in the `vdimarcos-projects` team, with `follow-suit/` as its root directory and no Git link. Each deploy builds a pushed commit of this branch. Vercel made the first deploy the project's production deploy, so `follow-suit.vercel.app` is public, like the arcade's own production domain. Each deployment URL needs a Vercel login. `README.md` gives the steps to deploy with the CLI.

## Chains

3. **8s always name a suit.** The player names a suit for every 8 they add: as the first card, and also when the 8 follows by suit or by rank.
4. **Switches.** A switch happens when the current suit after a card differs from the current suit before it. An 8 that names the current suit causes no switch. An 8 that names another suit causes one, even if its printed suit is the old current suit.
5. **Undo.** The player can undo again and again until the chain is empty.
6. **Chain length.** The player can play a chain of 1 card or more.
7. **Ring check.** The ring check compares the printed suit and rank of the last card with the first card. The named suit of an 8 does not count.

## Tables

8. **Redraws.** The player can redraw only when no chain is in progress. A redraw needs at least 1 selected card. The selected cards go to the discard pile.
9. **Empty draw pile.** A redraw or a refill draws as many cards as the draw pile holds. The hand can stay smaller than 8.
10. **Empty hand.** If the hand is empty and the total is below the target, the table is lost, because the player cannot build a chain. Only a small deck can cause this.
11. **Hand order.** The hand shows cards by suit, then by rank. The order has no effect on the rules.
12. **Live numbers.** The chain area shows Value and Mult from the base rules. Mult there is 1 plus the switches. The ring marker shows the ring multiplier on its own, so the player sees why the final Mult doubles.

## Seeds

13. **Seed format.** A new seed has 6 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ`. These leave out 0, O, 1, I and L, which look alike. A typed seed can be any text. Seed input ignores case and spaces.
14. **Seed source.** A new run takes its seed from the browser's random source. After that, every random choice in the run comes from the one seeded generator.
15. **Generator.** The generator is mulberry32. The seed text is hashed to a 32-bit start state. The run state stores the current state as one number, so a saved run continues the same sequence.
16. **Seed in the address.** `?seed=K7QX2M` in the page address starts from that seed. The browser checks use it to get a known hand.

## Milestone 2

17. **One table.** Milestone 2 plays the first table of stop 1: target 150, the starting $4 and no charms. New table starts another first table with a new seed.
18. **Targets.** Each target is rounded to a whole number, so the money check for powers of ten never meets a fraction.
19. **Dimmed cards.** A tap on a dimmed card shakes it and changes nothing. Screen readers hear the card as unavailable.
20. **The 8 picker.** Cancel closes the picker and leaves the chain as it was. A tap outside the picker does the same.

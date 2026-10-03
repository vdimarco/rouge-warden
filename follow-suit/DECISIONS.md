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

## Milestone 3: hosts

21. **Host order.** The seed shuffles all 5 hosts for stops 1 to 5, and shuffles them again for stops 6 to 8. A host can appear at stop 5 and again at stop 6.
22. **The Purist.** A card that names no suit must have the current suit. An 8 must name the current suit, except when it starts the chain, because a first card has no current suit to keep.
23. **The Zebra.** Colors are printed colors, for 8s too. An 8 that names hearts is still black if it is a club, and the next card must be red.
24. **The Climber.** Each card must have a higher rank than the previous card. An equal rank does not follow. An A is the highest rank.
25. **The Miser.** An 8 is a plain card. It follows only by suit or rank, names no suit and keeps its printed suit for charms and switches. Lucky Eight still counts it, because it is still an 8.
26. **The Jeweler.** A chain that is not a ring scores 0: its Mult is multiplied by 0 in a last step. Money from charms in that chain is still paid.

## Milestone 3: charms and money

27. **Turncoat and Bridge.** The normal follow rules come first, so a charm follow is spent only when no normal rule fits. Turncoat compares the printed colors of the card and the previous card. Undo gives the charm follow back. A host limit still applies to a charm follow.
28. **One table charm.** The table slot holds one charm, so Turncoat never meets Bridge, and Knot never meets Tidy.
29. **Crown.** Face cards are J, Q and K.
30. **Spiral.** The gain belongs to the charm. A ring adds 1 to it after the chain scores, so the next chain gets it. Selling Spiral loses the gain.
31. **Charm money.** Pawnbroker and Ledger pay when the chain is played, before the table pay.
32. **Live numbers.** The chain area and the ring marker use the base rules only. Knot, Hinge and the other charms show in the play animation.
33. **Suit charm slots.** There are 4 suit charms and 4 suit slots, and the shop never offers a charm the player owns. So a suit charm always has a free slot. A new suit charm goes to the first empty suit slot in the order ♠ ♥ ♣ ♦. The player can move it in the shop.
34. **Moving charms.** In the shop the player taps a suit charm, then another suit slot. If that slot has a charm, the two swap.
35. **Selling.** Charms sell only in the shop, as the brief lists Sell there.

## Milestone 3: shop, stamps and flow

36. **Rerolls.** A reroll replaces all 4 offers, also the ones already bought.
37. **Stamp offers.** The 2 stamp offers are 2 different stamps.
38. **Rarity.** If no charm of a rarity is left to offer, that rarity drops out of the weights.
39. **Stamp payment.** The player pays when they tap Use in the deck picker. Cancel costs nothing. A Burn Stamp with the deck at 20 cards stays in the shop, but it cannot be bought.
40. **Copy Stamp.** The two picks must be different cards. The first pick gives its rank.
41. **The run deck.** Stamps change the run deck. Each table shuffles the whole run deck again.
42. **After a clear.** A panel shows the pay for the table, then the player opens the shop.
43. **The last table.** The host table of stop 8 wins the run at once. No shop opens after it.
44. **A lost table.** The run end screen opens at once. It shows which table ended the run and its total.
45. **Start screen.** The page opens on a start screen with New run and a seed field. `?seed=` in the address skips it.

## Milestone 4: feel

46. **Switch notes.** The first switch of a chain plays the root of a G major scale. Each later switch plays the next step up. A chain with no switch plays no note.
47. **Ring sound.** A soft chord plays when a ring closes: the root, the third and the fifth, an octave above the root. The brief names no ring sound, but the ring is the signature moment.
48. **Ring shape.** The chain cards move onto an ellipse around the chain row, so the ring reads as a loop of cards on the table. Short screens use a flatter ellipse.
49. **Reduced motion.** The cards stay in place and a gold ring outline fades in around them. Points fade in and out without rising, and nothing grows or shakes.
50. **Coins.** After the total counts up, one coin plays for each power-of-ten dollar, and the money rises by $1 with each coin. The rest of the pay shows on the clear panel.
51. **During the reveal.** Cards and buttons do nothing until the reveal ends. The screen shows the run as it was until then, so the new hand appears only after the score.
52. **Mute.** The mute setting stays in this browser's storage. A private window can forget it.
53. **Timing.** Each card takes 180 ms. A charm on a card takes 150 ms, a switch 170 ms, a charm at the end of the chain 340 ms and the ring 760 ms. The chain score holds for 450 ms, and the total counts up in 650 ms.


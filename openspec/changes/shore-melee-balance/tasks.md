# Tasks

- [x] 1. Classify the kits from the code. Seven kits are melee and nine kits are ranged.
- [x] 2. Measure the gap. Run 480 Veteran matches on the parent commit (seeds 1 to 480). Melee kits won 44.5% and ranged kits won 54.1%.
- [x] 3. Find the cause. Log damage by source, deaths and bot modes in 12 matches, and run 378 one-on-one duels.
- [x] 4. Try five rule sets on seeds 1 to 160. Choose the 25% shot guard and the 15% closing speed.
- [x] 5. Add `MELEE`, `isMelee` and `isRanged` to `sim.js`. Apply the shot guard in `damage()` and the closing speed in `heroSpeed()`. Clear the speed when a hero is banished.
- [x] 6. Add `qa/tidebreak/melee-balance.test.mjs`.
- [x] 7. Update three tests that expected the old damage of a ranged shot on a melee hero: `base-attacks.test.mjs`, `items.test.mjs` and `shore-kits.test.mjs`.
- [x] 8. Re-measure with 480 matches on the same seeds. Melee and ranged kits both won 50.0%.
- [x] 9. Update `KIT_POWER` with the new lane values.
- [x] 10. Run all `qa/tidebreak/*.test.mjs` suites.
- [ ] 11. Play a melee hero by hand against a ranged bot in the browser. Check that the speed-up feels clear and fair.
- [ ] 12. Balance single kits in a separate change: Zephyrs, Jersey Devil, Nessie, Kitsune, Irontide, Stone Golem, Banshee, Coral Sage and Baba Yaga.
- [ ] 13. Review the canonical `moba-combat` spec and archive this change.

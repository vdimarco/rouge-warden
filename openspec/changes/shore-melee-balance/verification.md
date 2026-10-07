# Verification

## Checked

- **New rule test:** `qa/tidebreak/melee-balance.test.mjs` passes. It checks every ranged and melee kit pair. A ranged hero's basic attack on a melee hero deals 75% damage and gives 15% speed for 1.5 seconds. The speed ends after 1.5 seconds. Spells, melee basic attacks, caster wisps and ranged targets get no reduction and no speed. In a stepped fight, Kitsune's ordered shots deal 25% less to Bloodwake than to Phoenix, and only Bloodwake gets the speed.
- **All suites:** all 27 `qa/tidebreak/*.test.mjs` suites pass, including `sim.test.mjs` (full matches and seeded replay) and `team-presence.test.mjs`.
- **Updated tests:** three tests expected full damage from a ranged hero's basic attack on a melee hero. Each test now expects the guarded amount when the attacker is ranged and the target is melee. No check was removed.
  - `base-attacks.test.mjs`: the three-hit total of Baba Yaga's attacks on a melee foe.
  - `items.test.mjs`: the Iron plate armor check, when the foe is ranged.
  - `shore-kits.test.mjs`: Irontide's Challenge check. The attacker is a ranged hero, so the expected loss is 70 × 0.75.
- **Determinism:** the rule uses no random numbers. `sim.test.mjs` and `bot-difficulty.test.mjs` replay checks pass.
- **Balance:** 480 Veteran matches on seeds 1 to 480, before and after. Melee kits went from 44.5% to 50.0%. Ranged kits went from 54.1% to 50.0%. See `design.md` for each kit.
- **Same tool:** on seeds 1 to 8, `node qa/tidebreak/kit-strength.mjs 8 veteran 4` gives the same kit rates as the measurement harness.
- **Syntax:** `node --check` passes for `sim.js` and `bot-difficulty.js`. `git diff --check` passes.

## Not checked

- **Browser:** no browser check ran. The rule changes only the simulation. It adds no art, HUD or input. The `*.e2e.mjs` scripts did not run.
- **Hand play:** nobody played a melee hero by hand after the change. The feel of the closing speed is not confirmed.
- **Phone, audio and motion:** not affected and not checked.
- **Single kits:** nine kits are still outside 42% to 58%. See `design.md`.
- **OpenSpec CLI:** the CLI is not installed. The spec structure was checked by hand.

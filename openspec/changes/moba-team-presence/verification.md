# Verification

## Automated
All 20 `qa/tidebreak/*.test.mjs` suites pass, with the new `team-presence.test.mjs`. It covers the draft for all sixteen heroes and three seeds (no repeated hero, no repeated kit on a team, same seed gives the same draft, teammates talk), the drafted lineup and names in the match, an unchanged match without a lineup, first blood, double kill inside 12 seconds and not after, killing spree, shutdown, the ward alarm cooldown and lane name, assist and rally for both teams, the rally expiry, and two full bot matches with pings and kill records. `node --check` and `git diff --check` pass.

## Browser
Local Playwright with the preinstalled Chromium (software GL) at 1440x900, 390x844 and 844x390:
- The draft locks six distinct heroes, and the battlefield names match the board at all three sizes. The start button stays on screen. Enter skips the draft.
- Staged events show the kill feed, the "Double kill" style banner, the ward alarm banner, a minimap pulse and the team chat without covering controls.
- The Rally button records a rally ping at all three sizes. The tactical map shows hero portraits, the ward alarm and pings.
- A full six-minute bot match in the page fired these calls in order with no console errors: first blood, the Wild Hunt, ward alarms by lane, enemy ward destroyed, our ward has fallen, killing spree, double kill, mega kill, unstoppable, wicked sick, shut down, and defeat. Chat lines came from both teammates.
- HUD skill icons measure 54 to 62 px for every tested hero. The clock holds while the mouse is outside the window and runs after it returns.

## Recorded clips
All 40 clips load with no 404s. In a full in-page match, first blood, double kill, killing spree and the battle start played as recorded lines and no longer reached the speech engine. Lines without a clip (ward alarms, objectives) still use speech. `team-presence.test.mjs` checks that every multi-kill and streak name has a clip file.

## Music
In local Chromium the menu played A Legend Will Rise, the draft played Prepare to Fight, the match played the calm and battle tracks together, and a forced loss stopped them and played the defeat lament. No 404s or console errors. The six CC0 tracks total 5.7 MB and stream only for their scene.

## Not checked
Speech was checked with a stubbed speech engine, so the real voice and the sound mix have not been heard. The headless browser cannot play audio to a listener. Physical phone touch and performance were not tested. OpenSpec CLI is not installed, so the change was checked by hand against the existing delta format.

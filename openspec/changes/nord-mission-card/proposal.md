# Show the mission on the play shell

## Why

The objective, the stage, and the reason a beat failed lived on the native card. That card is not on the play page, so a player in the browser, and a check without the host, could not read them.

## What changes

The play shell draws a mission card while a mission is open: the title, the objective, the stage, a fail line that stays until the step changes, and a marker on a small map. The host sends those fields with the driving state. The same card can be shown from the page when the host is offline, so the frame can be checked. A setback writes the fail line. A step change clears it. Stages after the blank page now count on the card as well. No new mission is added.

## Impact

- Affected specs: nord-mission-card
- Affected code: the campaign setback line, the play shell card, and the stream message

# Roll a cart that waits

## Why

The follow walks away if you stop. Nothing on the lawn waits under your hands and tips if you sprint.

## What changes

After the gap is banked, a cart sits on the north lawn, west of that line. It rolls only while you walk at the handles. A stop leaves it where it is. A sprint tips it back to the start and stays on this beat. A car does not push it. The stop pays 360 once. The step is saved on version 11. Version 10 starts this beat over. How far it has rolled is session state. The seven story banks stay seven.

## Impact

- Affected specs: nord-roll, nord-unreal
- Affected code: `QuebecRoll.h`, `QuebecStorySave.h`, `QuebecCampaign`, the cart tests, and the version-11 save readers

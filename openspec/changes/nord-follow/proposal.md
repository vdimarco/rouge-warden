# Keep a gap behind a walker

## Why

The day already has an escort who follows the player, a car that chases the player, and a rival who races the player. None of those asks the player to hold a distance while someone else walks a line of their own.

## What changes

After the day is banked, one person walks due south across the north lawn at a walk. The player stands behind them and keeps a gap: close enough to stay with them, far enough not to crowd them. A matched walk holds the gap and pays once at the stop. A sprint crowds them. A stop lets them walk out of reach. Either fail sends them back to the corner and stays on this beat. A car does not count. A partner inside the close radius crowds them even when the watched player is in the band. The step is saved on version 10. Version 9 starts this beat over. How far they have walked is session state. The seven story banks stay seven.

## Impact

- Affected specs: nord-follow, nord-unreal
- Affected code: `QuebecFollow.h`, `QuebecStorySave.h`, `QuebecCampaign`, the follow tests, and the version-10 save readers

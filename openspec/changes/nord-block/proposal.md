# Head them off on the side street

## Why

The tail follows your car. Nothing on a road keeps its own line, and nothing cares that the side street is shorter.

## What changes

After the bells are banked, a courier drives one surveyed road from the north end. They do not follow the player. A car on the side street starts them. Only a car already on the block stops them. A bike, a pedalo, a scooter, or a walker does not. If they reach the block first, the side street is back and this beat stays open. The block pays 380 once. The step is saved on version 13. Version 12 starts this beat over. How far they have driven is session state. The seven story banks stay seven. Mission 15 is not retuned.

## Impact

- Affected specs: nord-block, nord-unreal
- Affected code: `QuebecBlock.h`, `QuebecStorySave.h`, `QuebecCampaign`, the block tests, and the version-13 save readers

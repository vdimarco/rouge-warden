# Send the day home

## Why

The new drives and walks are separate days. Nothing asks the player to use a car and then leave it, on one lawn, under a speed they choose.

## What changes

After the block is banked, the send-off has four stages on one lawn column. Walk to the door. Drive south to the gate under a speed cap. Stop the car in the bay. Walk the last stretch. A car does not open the door or finish the walk. A flat-out run starts the drive over and does not save. Coasting through the bay does not count. The send-off pays 520 once, at the walk. The stage is saved on version 14. Version 13 starts this beat over. How far the drive got is session state. The seven story banks stay seven. The five-stage day, the tail, the follow, the cart, the bells, and the block are not retuned.

## Impact

- Affected specs: nord-send, nord-unreal
- Affected code: `QuebecSend.h`, `QuebecStorySave.h`, `QuebecCampaign`, the send-off tests, and the version-14 save readers

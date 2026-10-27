# Stay inside the march

## Why

The follow stays behind a walker. The cart only moves when you push it, and a sprint tips it. Nothing walks itself at a walk and asks you to stay inside it, then step out at the end.

## What changes

After the slip is banked, a march waits on the lawn east of that door. Stepping in starts it. It walks south at 450 cm/s whether or not you keep up. Leaving the circle sends it back to the start and does not save. A sprint walks out the front. A stop falls out the back. A walk that stays inside reaches the end, and stepping out of the circle onto the mark pays 580 once. A car does not join and does not finish it. The step is saved on version 18. Version 17 starts this beat over. The seven story banks stay seven. The follow, the cart, the slip, and mission 16 are not retuned.

## Impact

- Affected specs: nord-march, nord-unreal
- Affected code: `QuebecMarch.h`, `QuebecStorySave.h`, `QuebecCampaign`, the march tests, and the version-18 save readers

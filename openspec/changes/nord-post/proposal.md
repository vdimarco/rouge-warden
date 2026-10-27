# Keep walking inside the mark

## Why

Every beat so far asks you to go somewhere. Nothing asks you to stay in one patch and keep a walking pace until a count fills, then wipes that count if you stop, sprint, or step out.

## What changes

After the lift is banked, a mark off a surveyed road takes someone on foot. Walking inside it fills a six-second count. Standing still does not. A sprint or a step out starts the count again and does not save. A car does not stand it. Filling the count banks the beat and pays 700 once. The step is saved on version 24. Version 23 starts this beat over. How long they have stood stays in the session. The seven story banks stay seven. The lift, the yard, and the bolt are not retuned.

## Impact

- Affected specs: nord-post, nord-unreal
- Affected code: `QuebecPost.h`, `QuebecStorySave.h`, `QuebecCampaign`, the post tests, and the version-24 save readers

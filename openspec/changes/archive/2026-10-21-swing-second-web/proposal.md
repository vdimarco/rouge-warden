# A second web takes a different building

## Why

In the chase view a second swing, or two swings in one frame, was landing on the building the first web already held. The kick of that second web also fired, so two presses stacked two launches.

## What changes

- While one web is already on a building, the next easy web skips that building.
- Two swing inputs in the same frame do the same: the second shot skips the building the first just took.
- A second web does not add another kick while the first is already attached.

## Capabilities

### Modified Capabilities

- `swing-moves`: a second web skips the building the first holds, and it does not kick.

## Impact

Flat play in `public/vr/js/main.js`. The ink web's reported ends in `public/vr/js/rope.js` stay the hand and the anchor. Tests in `qa/vr/flat.mjs`.

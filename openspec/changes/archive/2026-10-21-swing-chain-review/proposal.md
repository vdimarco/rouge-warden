## Why

A held swing can catch another tier or the antenna of the building it just left, because the next web compares collider ids. Over open water the same hold drops the sky rope and then refuses to fire, so the hero falls with the button still down.

## What changes

- The next web skips the whole building just left. Another tier and that building's antenna are the same building.
- A sky rope stays while the swing button is held. Letting the button up still lets it go.
- A clog, a pipe, and the crack still stay. A phone and a headset are unchanged.

## Capabilities

### Modified Capabilities

- `swing-moves`: a held swing catches a different building, and a sky rope stays while the button is held.

## Impact

`public/vr/js/physics.js` (`easyAnchor`), `public/vr/js/main.js` (`chainAim`, `holdChainRelease`), `qa/vr/chainbid.test.mjs`, `qa/vr/holdchain.e2e.mjs`.

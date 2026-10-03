# Tasks

- [x] Write `public/arcade/quiet.js`: contexts, media, speech, SoundCloud songs, `interrupted` state, no `AudioContext`, double include.
- [x] Load it first in `<head>` of every page with sound (the arcade page and 18 game pages, Primordia included).
- [x] Keep it out of `/vr/`. Pause the sound there when the page is hidden in flat mode.
- [x] Pause a SoundCloud song that starts after the page was hidden, even when SoundCloud's script loads late.
- [x] Skip Tell Me sounds that a timer starts while the page is hidden.
- [x] Write `qa/arcade/quiet.mjs`: the scan, the unit pages, every game page hidden four ways, and the pages with no sound.
- [x] Run the test on the old code (`--old`): all 18 sound pages fail there. On the new code they pass.
- [x] Run each later fix's check on the code from before the fix: it fails there.
- [ ] Validate the spec with the OpenSpec CLI when it is available.

## Checks

- `node qa/arcade/quiet.mjs` on the tree before the last review fixes: 663 of 663 pass. After them, the unit part (92 checks) and the pages that changed (arcade, Tell Me, In Full Swing, Crimson Rogue, Get Plunger'd, Primordia) were run again.
- A full run takes about 25 minutes.

Not checked: Safari and iOS (no WebKit here; the `interrupted` state is tested with a stand-in), a real phone, a headset, and audible output. The tests read `AudioContext.state`, media `paused` and the SoundCloud player state.

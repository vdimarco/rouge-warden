# Tasks

- [x] Draw every art layer and overlay with one 16:9 cover crop focused on the islands.
- [x] Drive sea level from 1.0° to 3.0° and smog from pollution, eased with the existing map tween.
- [x] Put the ending on an opaque paper panel, dim the map to 85%, and make the play UI inert.
- [x] Check seed 123 turn motion, clean versus dirty alpha, and the 390 end screen in `qa/breakthrough2/play.mjs`.
- [x] Keep the title under 500 KB by fetching later art only after play starts.
- [ ] Validate the spec with the OpenSpec CLI if it is installed.

`openspec` is not installed here, so the CLI check did not run. `node qa/breakthrough2/play.mjs` passed 233 checks. First load was 391047 bytes. Browser screenshots covered 390, 360, 320, landscape, and 1280. A physical phone and a motion sensor were not used. Reduced motion was checked in the browser.

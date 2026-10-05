# Tasks

- [x] Generate painted key art for the eight games with Higgsfield, using each old frame as a reference.
- [x] Record the jobs in `higgsfield/arcade-key-art.json` and add `scripts/arcade-key-art.mjs` to download them.
- [x] Download the art to `public/arcade/key/` and look at each picture.
- [x] Point the switcher entries and the five still machine screens at the new art.
- [x] Add a size and format check (WebP, under 100 KB) for `public/arcade/key/` to `qa/arcade/machines.mjs`.
- [x] Run `node qa/arcade/machines.mjs` and check the switcher in a browser at 390 x 844 and 1280 x 720.
- [ ] Validate the spec with the OpenSpec CLI when it is available.

## Checks

- `PARTS=switcher node qa/arcade/machines.mjs`: all passed (288 checks, with the file and picture checks).
- The `layout` part stopped answering at 375 x 667 after a key press, in this container's headless browser with a software GPU. That part does not use the art.
- Playwright screenshots of SWITCH GAME at 1280 x 720 and 390 x 844: every tile picture loads.
- The OpenSpec CLI is not installed, so the spec structure is not validated.
